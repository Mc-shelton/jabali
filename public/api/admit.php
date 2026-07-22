<?php
// Door check-in — admin only.
//   GET  admit.php?code=JC-...    → look up a code, change nothing
//   POST admit.php?code=JC-...    → admit the order, once
//
// Split deliberately. GET is what a scanner fires repeatedly while a camera
// hunts for focus, and it must never consume a ticket; POST is the door staff
// deciding to let someone in.
require __DIR__ . '/_bootstrap.php';
require __DIR__ . '/_orders.php';

const STORE = 'orders';

// Possible outcomes, in the order the door cares about them.
//   ok            → let them in
//   already       → this order has been admitted before
//   unpaid        → the payment never settled
//   merch         → a merchandise receipt, not an entry ticket
//   not_found     → no such code
function admit_status(?array $order): string
{
    if ($order === null)                                   return 'not_found';
    if (($order['itemType'] ?? 'ticket') === 'merch')       return 'merch';
    if (($order['status'] ?? '') !== 'success')             return 'unpaid';
    if (!empty($order['admittedAt']))                       return 'already';
    return 'ok';
}

// What the door needs on screen: who, how many, and when it was used if it was.
function admit_view(?array $order, string $status): array
{
    if ($order === null) return ['status' => $status];

    return [
        'status'     => $status,
        'code'       => $order['ticketCode'] ?? '',
        'event'      => $order['eventTitle'] ?? '',
        'item'       => $order['itemName'] ?? '',
        'quantity'   => (int) ($order['quantity'] ?? 1),
        'buyer'      => trim(($order['customer']['preferredName'] ?? '') . ' ' . ($order['customer']['otherNames'] ?? '')),
        'amount'     => (int) ($order['amount'] ?? 0),
        'admittedAt' => $order['admittedAt'] ?? null,
    ];
}

// Codes are printed uppercase and typed in by tired people at a door. Match
// case-insensitively and tolerate a missing prefix or stray spaces.
function find_by_code(array $orders, string $code): ?int
{
    $code = strtoupper(trim($code));
    if ($code === '') return null;
    if (strpos($code, 'JC-') !== 0) $code = 'JC-' . $code;

    foreach ($orders as $i => $o) {
        if (strtoupper((string) ($o['ticketCode'] ?? '')) === $code) return $i;
    }
    return null;
}

route([
    // Look up without consuming. Safe to call as often as a camera fires.
    'GET' => function () {
        require_admin();

        $orders = store_read(STORE, []);
        $i = find_by_code($orders, (string) ($_GET['code'] ?? ''));
        $order = $i === null ? null : $orders[$i];

        json_out(admit_view($order, admit_status($order)));
    },

    // Admit the order. The whole order is admitted at once — a code covers the
    // full quantity, so a group of three enters on one scan.
    'POST' => function () {
        require_admin();
        require_csrf();

        $orders = store_read(STORE, []);
        $i = find_by_code($orders, (string) ($_GET['code'] ?? ''));

        if ($i === null) {
            json_out(admit_view(null, 'not_found'));
        }

        $status = admit_status($orders[$i]);

        // Anything other than a clean ticket is reported back unchanged. In
        // particular an already-admitted order keeps its ORIGINAL admittedAt:
        // overwriting it would erase the evidence of the first entry, which is
        // the only thing that makes a duplicate detectable afterwards.
        if ($status !== 'ok') {
            log_warn('Entry refused at the door', [
                'code'   => $orders[$i]['ticketCode'] ?? null,
                'reason' => $status,
            ]);
            json_out(admit_view($orders[$i], $status));
        }

        $orders[$i]['admittedAt'] = date('c');
        store_write(STORE, $orders);

        log_info('Admitted at the door', [
            'code'     => $orders[$i]['ticketCode'] ?? null,
            'quantity' => $orders[$i]['quantity'] ?? 1,
            'event'    => $orders[$i]['eventTitle'] ?? null,
        ]);

        json_out(admit_view($orders[$i], 'ok'));
    },
]);
