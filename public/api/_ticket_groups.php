<?php
// Shared ticket groups. A group owns a fixed number of one-person seats; each
// seat points at the member's ordinary ticket order, so payment settlement and
// fulfilment keep using the same trusted path as every other checkout.

declare(strict_types=1);

const TICKET_GROUP_STORE = 'ticket_groups';
const TICKET_GROUP_UNATTACHED_TTL = 600;

function ticket_group_orders_by_id(): array
{
    $indexed = [];
    foreach ((array) store_read('orders', []) as $order) {
        if (!empty($order['id'])) $indexed[(string) $order['id']] = $order;
    }
    return $indexed;
}

function ticket_group_slot_status(array $slot, array $orders): string
{
    $orderId = (string) ($slot['orderId'] ?? '');
    if ($orderId === '' || !isset($orders[$orderId])) {
        // This tiny window normally lasts only until tickets.php saves the new
        // order. If PHP is interrupted in between, release the orphan rather
        // than blocking that group forever.
        $created = strtotime((string) ($slot['createdAt'] ?? 'now')) ?: time();
        return time() - $created > TICKET_GROUP_UNATTACHED_TTL ? 'failed' : 'pending';
    }
    $status = (string) ($orders[$orderId]['status'] ?? 'pending');
    return in_array($status, ['success', 'failed'], true) ? $status : 'pending';
}

function ticket_group_counts(array $group, ?array $orders = null): array
{
    $orders = $orders ?? ticket_group_orders_by_id();
    $paid = 0;
    $pending = 0;
    foreach ((array) ($group['slots'] ?? []) as $slot) {
        $status = ticket_group_slot_status((array) $slot, $orders);
        if ($status === 'success') $paid++;
        elseif ($status === 'pending') $pending++;
    }
    return ['paid' => $paid, 'pending' => $pending, 'occupied' => $paid + $pending];
}

function ticket_group_public(array $group): array
{
    $counts = ticket_group_counts($group);
    $capacity = (int) ($group['capacity'] ?? 1);
    return [
        'token'       => (string) ($group['token'] ?? ''),
        'name'        => (string) ($group['name'] ?? ''),
        'eventSlug'   => (string) ($group['eventSlug'] ?? ''),
        'packageName' => (string) ($group['packageName'] ?? ''),
        'capacity'    => $capacity,
        'memberPrice' => (int) ($group['memberPrice'] ?? 0),
        'paidCount'   => $counts['paid'],
        'pendingCount'=> $counts['pending'],
        'occupied'    => $counts['occupied'],
        'remaining'   => max(0, $capacity - $counts['occupied']),
        'full'        => $counts['occupied'] >= $capacity,
    ];
}

function ticket_group_find(string $token): ?array
{
    if (!preg_match('/^[a-f0-9]{32}$/', $token)) return null;
    foreach ((array) store_read(TICKET_GROUP_STORE, []) as $group) {
        $stored = (string) ($group['token'] ?? '');
        if ($stored !== '' && hash_equals($stored, $token)) return (array) $group;
    }
    return null;
}

// Exclusive read-modify-write for the group store. store_write() protects the
// bytes from corruption, but its lock begins after a normal read; this helper
// keeps the capacity check and seat reservation in one lock so two people
// cannot both claim the final place.
function ticket_groups_mutate(callable $mutator)
{
    if (!is_dir(DATA_DIR) && !mkdir(DATA_DIR, 0775, true) && !is_dir(DATA_DIR)) {
        error_out('Data directory is not writable.', 500);
    }
    $path = store_path(TICKET_GROUP_STORE);
    $fp = fopen($path, 'c+');
    if ($fp === false || !flock($fp, LOCK_EX)) {
        if (is_resource($fp)) fclose($fp);
        error_out('Could not lock ticket groups.', 500);
    }

    rewind($fp);
    $raw = stream_get_contents($fp);
    $groups = json_decode($raw ?: '[]', true);
    if (!is_array($groups)) $groups = [];

    $result = $mutator($groups);
    $json = json_encode(array_values($groups), JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    ftruncate($fp, 0);
    rewind($fp);
    fwrite($fp, $json);
    fflush($fp);
    flock($fp, LOCK_UN);
    fclose($fp);
    return $result;
}

// Returns [group, slot]. Failed orders do not occupy a place; pending M-Pesa
// prompts do, which prevents overbooking while somebody enters their PIN.
function ticket_group_reserve(
    string $token,
    string $groupName,
    string $eventSlug,
    string $packageName,
    int $capacity,
    int $memberPrice,
    string $memberName
): array {
    return ticket_groups_mutate(function (&$groups) use (
        $token, $groupName, $eventSlug, $packageName, $capacity, $memberPrice, $memberName
    ) {
        $index = null;
        if ($token !== '') {
            foreach ($groups as $i => $candidate) {
                if (hash_equals((string) ($candidate['token'] ?? ''), $token)) {
                    $index = $i;
                    break;
                }
            }
            if ($index === null) error_out('This group link is invalid or no longer available.', 404);
        } else {
            if ($groupName === '') error_out('Please give your group a name.', 422);
            $token = bin2hex(random_bytes(16));
            $groups[] = [
                'id'          => bin2hex(random_bytes(12)),
                'token'       => $token,
                'name'        => $groupName,
                'eventSlug'   => $eventSlug,
                'packageName' => $packageName,
                'capacity'    => $capacity,
                'memberPrice' => $memberPrice,
                'createdAt'   => date('c'),
                'slots'       => [],
            ];
            $index = count($groups) - 1;
        }

        $group = (array) $groups[$index];
        if (($group['eventSlug'] ?? '') !== $eventSlug || ($group['packageName'] ?? '') !== $packageName) {
            error_out('This group link belongs to a different ticket package.', 409);
        }
        if ((int) ($group['capacity'] ?? 0) !== $capacity || (int) ($group['memberPrice'] ?? 0) !== $memberPrice) {
            error_out('This group package has changed. Please create a new group.', 409);
        }

        $counts = ticket_group_counts($group);
        if ($counts['occupied'] >= $capacity) {
            error_out('This group is full. Please create a new group.', 409);
        }

        $slot = [
            'id'         => bin2hex(random_bytes(10)),
            'orderId'    => null,
            'memberName' => $memberName,
            'createdAt'  => date('c'),
        ];
        $group['slots'][] = $slot;
        $groups[$index] = $group;
        return [$group, $slot];
    });
}

function ticket_group_attach_order(string $token, string $slotId, string $orderId): void
{
    ticket_groups_mutate(function (&$groups) use ($token, $slotId, $orderId) {
        foreach ($groups as &$group) {
            if (($group['token'] ?? '') !== $token) continue;
            foreach ($group['slots'] as &$slot) {
                if (($slot['id'] ?? '') === $slotId) $slot['orderId'] = $orderId;
            }
        }
        unset($group, $slot);
        return null;
    });
}

function ticket_group_release(string $token, string $slotId): void
{
    ticket_groups_mutate(function (&$groups) use ($token, $slotId) {
        foreach ($groups as &$group) {
            if (($group['token'] ?? '') !== $token) continue;
            $group['slots'] = array_values(array_filter(
                (array) ($group['slots'] ?? []),
                fn($slot) => ($slot['id'] ?? '') !== $slotId
            ));
        }
        unset($group);
        return null;
    });
}
