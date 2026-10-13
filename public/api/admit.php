<?php
// Door check-in — admin only.
//   GET  admit.php?code=JC-...    → look up a code, change nothing
//   POST admit.php?code=JC-...    → admit that individual ticket, once
//
// Split deliberately. GET is what a scanner fires repeatedly while a camera
// hunts for focus, and it must never consume a ticket; POST is the door staff
// deciding to let someone in.
require __DIR__ . '/_bootstrap.php';
require __DIR__ . '/_orders.php';

const STORE = 'orders';

// Possible outcomes, in the order the door cares about them.
//   ok            → let them in
//   already       → this individual ticket has been admitted before
//   unpaid        → the payment never settled
//   merch         → a merchandise receipt, not an entry ticket
//   not_found     → no such code
function admit_status(?array $order, ?array $ticket = null): string
{
    if ($order === null)                                   return 'not_found';
    if (($order['itemType'] ?? 'ticket') === 'merch')       return 'merch';
    if (($order['status'] ?? '') !== 'success')             return 'unpaid';
    if (!empty(($ticket ?? $order)['admittedAt']))           return 'already';
    return 'ok';
}

// What the door needs on screen: who, how many, and when it was used if it was.
function admit_view(?array $order, string $status, ?array $ticket = null): array
{
    if ($order === null) return ['status' => $status];

    return [
        'status'     => $status,
        'code'       => $ticket['code'] ?? $order['ticketCode'] ?? '',
        'event'      => $order['eventTitle'] ?? '',
        'item'       => $order['itemName'] ?? '',
        // Every new QR admits one person. A legacy top-level QR keeps its old
        // party quantity so tickets already in buyers' inboxes still work.
        'quantity'   => (int) ($ticket['quantity'] ?? $order['quantity'] ?? 1),
        'ticketNumber' => $ticket['number'] ?? null,
        'ticketTotal'  => $ticket['total'] ?? null,
        'memberLabel'  => $ticket['memberLabel'] ?? null,
        'ageLabel'     => $ticket['ageLabel'] ?? null,
        'buyer'      => trim(($order['customer']['preferredName'] ?? '') . ' ' . ($order['customer']['otherNames'] ?? '')),
        'amount'     => (int) ($order['amount'] ?? 0),
        'admittedAt' => $ticket['admittedAt'] ?? $order['admittedAt'] ?? null,
    ];
}

// Codes are printed uppercase and typed in by tired people at a door. Match
// case-insensitively and tolerate a missing prefix or stray spaces.
function find_ticket_by_code(array $orders, string $code): ?array
{
    $code = strtoupper(trim($code));
    if ($code === '') return null;
    if (strpos($code, 'JC-') !== 0) $code = 'JC-' . $code;

    foreach ($orders as $i => $o) {
        if (!empty($o['tickets']) && is_array($o['tickets'])) {
            foreach ($o['tickets'] as $ticketIndex => $ticket) {
                if (strtoupper((string) ($ticket['code'] ?? '')) === $code) {
                    return ['orderIndex' => $i, 'ticketIndex' => $ticketIndex];
                }
            }
            // ticketCode duplicates the first new ticket for compatibility; it
            // must not also be treated as a legacy group-level code.
            continue;
        }
        if (strtoupper((string) ($o['ticketCode'] ?? '')) === $code) {
            return ['orderIndex' => $i, 'ticketIndex' => null];
        }
    }
    return null;
}

// Kept for callers/tests that only need the containing order.
function find_by_code(array $orders, string $code): ?int
{
    $match = find_ticket_by_code($orders, $code);
    return $match['orderIndex'] ?? null;
}

// Consume one ticket and return its presentation record. A null index is the
// legacy shape, where the top-level QR admits the whole original party.
function mark_ticket_admitted(array &$order, ?int $ticketIndex, ?string $at = null): ?array
{
    $admittedAt = $at ?? date('c');
    if ($ticketIndex === null) {
        $order['admittedAt'] = $admittedAt;
        return null;
    }

    if (!isset($order['tickets'][$ticketIndex])) return null;
    $order['tickets'][$ticketIndex]['admittedAt'] = $admittedAt;

    // The top-level timestamp means the whole order is fully admitted.
    // Individual timestamps remain the audit trail for each QR.
    $allAdmitted = array_reduce(
        $order['tickets'],
        fn($complete, $row) => $complete && !empty($row['admittedAt']),
        true
    );
    if ($allAdmitted) $order['admittedAt'] = $admittedAt;

    return order_ticket_record_at($order, $ticketIndex);
}

route([
    // Look up without consuming. Safe to call as often as a camera fires.
    'GET' => function () {
        require_admin();

        $orders = store_read(STORE, []);
        $match = find_ticket_by_code($orders, (string) ($_GET['code'] ?? ''));
        $order = $match === null ? null : $orders[$match['orderIndex']];
        $ticket = $match === null
            ? null
            : order_ticket_record_at($order, $match['ticketIndex']);

        json_out(admit_view($order, admit_status($order, $ticket), $ticket));
    },

    // Admit only the scanned ticket. Legacy group codes still admit their full
    // original quantity at once, preserving already-issued tickets.
    'POST' => function () {
        require_admin();
        require_csrf();

        $orders = store_read(STORE, []);
        $match = find_ticket_by_code($orders, (string) ($_GET['code'] ?? ''));

        if ($match === null) {
            json_out(admit_view(null, 'not_found'));
        }

        $i = $match['orderIndex'];
        $ticketIndex = $match['ticketIndex'];
        $ticket = order_ticket_record_at($orders[$i], $ticketIndex);
        $status = admit_status($orders[$i], $ticket);

        // Anything other than a clean ticket is reported back unchanged. In
        // particular an already-admitted order keeps its ORIGINAL admittedAt:
        // overwriting it would erase the evidence of the first entry, which is
        // the only thing that makes a duplicate detectable afterwards.
        if ($status !== 'ok') {
            log_warn('Entry refused at the door', [
                'code'   => $ticket['code'] ?? $orders[$i]['ticketCode'] ?? null,
                'reason' => $status,
            ]);
            json_out(admit_view($orders[$i], $status, $ticket));
        }

        $ticket = mark_ticket_admitted($orders[$i], $ticketIndex);
        store_write(STORE, $orders);

        log_info('Admitted at the door', [
            'code'     => $ticket['code'] ?? $orders[$i]['ticketCode'] ?? null,
            'quantity' => $ticket['quantity'] ?? $orders[$i]['quantity'] ?? 1,
            'event'    => $orders[$i]['eventTitle'] ?? null,
        ]);

        json_out(admit_view($orders[$i], 'ok', $ticket));
    },
]);
