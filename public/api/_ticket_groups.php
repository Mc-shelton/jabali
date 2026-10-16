<?php
// Shared ticket groups. A group owns a fixed number of one-person seats; each
// seat points at the member's ordinary ticket order, so payment settlement and
// fulfilment keep using the same trusted path as every other checkout.

declare(strict_types=1);

const TICKET_GROUP_STORE = 'ticket_groups';
const TICKET_GROUP_UNATTACHED_TTL = 600;
const MAX_OPEN_TICKET_GROUPS = 5;

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

function ticket_group_public(array $group, ?array $orders = null): array
{
    $counts = ticket_group_counts($group, $orders);
    $capacity = (int) ($group['capacity'] ?? 1);
    return [
        'token'       => (string) ($group['token'] ?? ''),
        'name'        => (string) ($group['name'] ?? ''),
        'createdBy'   => (string) ($group['createdBy'] ?? ($group['slots'][0]['memberName'] ?? '')),
        'eventSlug'   => (string) ($group['eventSlug'] ?? ''),
        'packageName' => (string) ($group['packageName'] ?? ''),
        'capacity'    => $capacity,
        'memberPrice' => (int) ($group['memberPrice'] ?? 0),
        'paidCount'   => $counts['paid'],
        'pendingCount'=> $counts['pending'],
        'occupied'    => $counts['occupied'],
        'remaining'   => max(0, $capacity - $counts['occupied']),
        'full'        => $counts['occupied'] >= $capacity,
        'closed'      => !empty($group['adminClosed']),
    ];
}

function ticket_groups_available(string $eventSlug, string $packageName): array
{
    $orders = ticket_group_orders_by_id();
    $available = [];
    foreach ((array) store_read(TICKET_GROUP_STORE, []) as $group) {
        if (($group['eventSlug'] ?? '') !== $eventSlug || ($group['packageName'] ?? '') !== $packageName) continue;
        $public = ticket_group_public((array) $group, $orders);
        // A group whose creator's attempt failed has nobody in it and no shared
        // link in circulation, so it should neither be advertised nor consume
        // one of the five useful open-group positions.
        if ($public['occupied'] < 1 || $public['full'] || $public['closed']) continue;
        $available[] = $public;
    }
    usort($available, fn($a, $b) => $b['occupied'] <=> $a['occupied']);
    return $available;
}

function ticket_group_limit_reached(string $eventSlug, string $packageName): bool
{
    return count(ticket_groups_available($eventSlug, $packageName)) >= MAX_OPEN_TICKET_GROUPS;
}

function ticket_groups_admin(array $orderRows): array
{
    $orders = [];
    foreach ($orderRows as $order) {
        if (!empty($order['id'])) $orders[(string) $order['id']] = $order;
    }

    $result = [];
    foreach ((array) store_read(TICKET_GROUP_STORE, []) as $group) {
        $public = ticket_group_public((array) $group, $orders);
        $members = [];
        foreach ((array) ($group['slots'] ?? []) as $slot) {
            $orderId = (string) ($slot['orderId'] ?? '');
            $order = $orders[$orderId] ?? [];
            $members[] = [
                'name'       => (string) ($slot['memberName'] ?? ''),
                'status'     => ticket_group_slot_status((array) $slot, $orders),
                'orderId'    => $orderId,
                'email'      => (string) ($order['customer']['email'] ?? ''),
                'phone'      => (string) ($order['customer']['phone'] ?? ($order['mpesaPhone'] ?? '')),
                'amount'     => (int) ($order['amount'] ?? 0),
                'receipt'    => (string) ($order['receipt'] ?? ''),
                'ticketCode' => (string) ($order['ticketCode'] ?? ''),
                'createdAt'  => (string) ($slot['createdAt'] ?? ''),
                'paidAt'     => (string) ($order['paidAt'] ?? ''),
            ];
        }
        $site = defined('SITE_URL') && SITE_URL !== '' ? rtrim((string) SITE_URL, '/') : '';
        $public['id'] = (string) ($group['id'] ?? '');
        $public['createdAt'] = (string) ($group['createdAt'] ?? '');
        $public['state'] = $public['closed']
            ? 'closed'
            : ($public['occupied'] === 0 ? 'inactive' : ($public['full'] ? 'full' : 'open'));
        $public['inviteUrl'] = $site . '/events/' . rawurlencode($public['eventSlug'])
            . '?group=' . rawurlencode($public['token']);
        $public['members'] = $members;
        $result[] = $public;
    }
    usort($result, fn($a, $b) => strcmp($b['createdAt'], $a['createdAt']));
    return $result;
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

function ticket_group_set_closed(string $id, bool $closed): array
{
    if (!preg_match('/^[a-f0-9]{24}$/', $id)) error_out('Group not found.', 404);

    return ticket_groups_mutate(function (&$groups) use ($id, $closed) {
        $orders = ticket_group_orders_by_id();
        $index = null;
        foreach ($groups as $i => $candidate) {
            if (hash_equals((string) ($candidate['id'] ?? ''), $id)) {
                $index = $i;
                break;
            }
        }
        if ($index === null) error_out('Group not found.', 404);

        $group = (array) $groups[$index];
        $counts = ticket_group_counts($group, $orders);
        $capacity = (int) ($group['capacity'] ?? 0);

        if (!$closed) {
            if ($capacity < 1 || $counts['occupied'] >= $capacity) {
                error_out('A full group cannot be reopened.', 409);
            }

            $openCount = 0;
            foreach ($groups as $candidate) {
                if (($candidate['id'] ?? '') === $id || !empty($candidate['adminClosed'])) continue;
                if (
                    ($candidate['eventSlug'] ?? '') !== ($group['eventSlug'] ?? '')
                    || ($candidate['packageName'] ?? '') !== ($group['packageName'] ?? '')
                ) continue;
                $candidateCounts = ticket_group_counts((array) $candidate, $orders);
                $candidateCapacity = (int) ($candidate['capacity'] ?? 0);
                if ($candidateCounts['occupied'] > 0 && $candidateCounts['occupied'] < $candidateCapacity) $openCount++;
            }
            if ($openCount >= MAX_OPEN_TICKET_GROUPS) {
                error_out('This group cannot be reopened while 5 other groups are open for this ticket.', 409);
            }
        }

        $group['adminClosed'] = $closed;
        $group['adminClosedAt'] = $closed ? date('c') : null;
        $groups[$index] = $group;
        return ticket_group_public($group, $orders);
    });
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

            $orders = ticket_group_orders_by_id();
            $openCount = 0;
            foreach ($groups as $candidate) {
                if (!empty($candidate['adminClosed'])) continue;
                if (
                    ($candidate['eventSlug'] ?? '') !== $eventSlug
                    || ($candidate['packageName'] ?? '') !== $packageName
                ) continue;
                $candidateCounts = ticket_group_counts((array) $candidate, $orders);
                $candidateCapacity = (int) ($candidate['capacity'] ?? 0);
                if ($candidateCounts['occupied'] > 0 && $candidateCounts['occupied'] < $candidateCapacity) $openCount++;
            }
            if ($openCount >= MAX_OPEN_TICKET_GROUPS) {
                error_out(
                    'There are already 5 open groups for this ticket. Please join one of them instead.',
                    409
                );
            }

            $token = bin2hex(random_bytes(16));
            $groups[] = [
                'id'          => bin2hex(random_bytes(12)),
                'token'       => $token,
                'name'        => $groupName,
                'createdBy'   => $memberName,
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
        if (!empty($group['adminClosed'])) {
            error_out('This group has been closed by the administrator.', 409);
        }
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
