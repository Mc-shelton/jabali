<?php
// Admin-issued tickets must behave like admissions without becoming payments.
declare(strict_types=1);

function mint_ticket_codes(array $orders, int $quantity): array
{
    return array_map(
        fn(int $index) => 'JC-COMP' . str_pad((string) ($index + 1), 5, '0', STR_PAD_LEFT),
        range(0, $quantity - 1)
    );
}

require __DIR__ . '/../public/api/_complimentary_tickets.php';
require __DIR__ . '/../public/api/_mailer.php';

$pass = 0; $fail = 0;
function check(string $name, $got, $want): void {
    global $pass, $fail;
    if ($got === $want) { $pass++; echo "  ok   $name\n"; return; }
    $fail++;
    echo "  FAIL $name\n       got:  " . var_export($got, true) . "\n       want: " . var_export($want, true) . "\n";
}

$events = [[
    'slug' => 'concert',
    'title' => 'Concert',
    'date' => '2026-11-08',
    'venue' => 'Auditorium',
    'packages' => [
        ['name' => 'Regular', 'type' => 'standard', 'ticketCount' => 1],
        ['name' => 'Family', 'type' => 'family', 'ticketCount' => 4],
    ],
], [
    'slug' => 'free-event',
    'title' => 'Free event',
    'packages' => [],
]];

echo "\n-- catalogue choices are authoritative --\n";
$resolved = resolve_complimentary_ticket_request([
    'eventSlug' => 'concert',
    'packageName' => 'Regular',
    'quantity' => 3,
    'customer' => [
        'preferredName' => 'Amina',
        'otherNames' => 'Otieno',
        'email' => 'amina@example.com',
        'phone' => '0712345678',
    ],
    'note' => 'Guest of the choir',
], $events);
check('event resolved from store', $resolved['event']['title'], 'Concert');
check('package resolved from store', $resolved['packageName'], 'Regular');
check('quantity means individual tickets', $resolved['quantity'], 3);
check('audit note retained', $resolved['note'], 'Guest of the choir');

$badPackage = false;
try {
    resolve_complimentary_ticket_request([
        'eventSlug' => 'concert', 'packageName' => 'Invented', 'quantity' => 1,
        'customer' => ['preferredName' => 'Amina', 'email' => 'amina@example.com'],
    ], $events);
} catch (OutOfBoundsException $e) {
    $badPackage = true;
}
check('invented package refused', $badPackage, true);

$badEmail = false;
try {
    resolve_complimentary_ticket_request([
        'eventSlug' => 'concert', 'packageName' => 'Regular', 'quantity' => 1,
        'customer' => ['preferredName' => 'Amina', 'email' => 'not-an-email'],
    ], $events);
} catch (DomainException $e) {
    $badEmail = true;
}
check('invalid recipient refused', $badEmail, true);

echo "\n-- events without paid packages still support named guests --\n";
$general = resolve_complimentary_ticket_request([
    'eventSlug' => 'free-event',
    'packageName' => '',
    'quantity' => 1,
    'customer' => ['preferredName' => 'Guest', 'email' => 'guest@example.com'],
], $events);
check('general admission supplied', $general['packageName'], 'General admission');

echo "\n-- issued record is admission, not revenue --\n";
$order = make_complimentary_order($resolved, []);
check('immediately valid for door checks', $order['status'], 'success');
check('explicit non-billable marker', $order['billingType'], 'complimentary');
check('zero revenue', $order['amount'], 0);
check('not represented as paid', $order['paidAt'], null);
check('no M-Pesa receipt invented', $order['receipt'], null);
check('one independent record per person', count($order['tickets']), 3);
check('first code remains compatibility reference', $order['ticketCode'], $order['tickets'][0]['code']);
check('fulfilment is ready to run', $order['emailed'], false);

$html = order_email_html($order);
check('email does not claim payment was received', str_contains($html, 'Payment received'), false);
check('email identifies the no-charge issue', str_contains($html, 'Complimentary — no payment required'), true);

echo "\n$pass passed, $fail failed\n";
exit($fail === 0 ? 0 : 1);
