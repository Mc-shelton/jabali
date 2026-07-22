<?php
// The property under test: a ticket admits exactly one party, once, and the
// record of that entry cannot be destroyed by scanning again.
//
// The door is the least forgiving place this code runs — a queue, poor light,
// and staff who cannot debug anything. Every branch here is a decision someone
// has to act on in a second or two.
declare(strict_types=1);

$tmp = sys_get_temp_dir() . '/jc-admit-' . bin2hex(random_bytes(4));
mkdir($tmp . '/logs', 0775, true);
define('DATA_DIR', $tmp);
require __DIR__ . '/../public/api/_log.php';

$pass = 0; $fail = 0;
function check(string $name, $got, $want) {
    global $pass, $fail;
    if ($got === $want) { $pass++; echo "  ok   $name\n"; return; }
    $fail++;
    echo "  FAIL $name\n       got:  " . var_export($got, true) . "\n       want: " . var_export($want, true) . "\n";
}

// Pull in the pure decision functions. Requiring admit.php would run route(),
// which needs a live request and an admin session.
$src = file_get_contents(__DIR__ . '/../public/api/admit.php');
foreach (['admit_status', 'admit_view', 'find_by_code'] as $fn) {
    preg_match('/function ' . $fn . '.*?\n}/s', $src, $m);
    eval($m[0]);
}

function ticket(array $over = []): array {
    return $over + [
        'ticketCode' => 'JC-A1B2C3D4E5',
        'status'     => 'success',
        'itemType'   => 'ticket',
        'itemName'   => 'Regular',
        'quantity'   => 3,
        'amount'     => 3000,
        'eventTitle' => 'Test',
        'customer'   => ['preferredName' => 'Shellton', 'otherNames' => 'Omondi'],
    ];
}

echo "\n-- the four outcomes the door has to tell apart --\n";
check('a paid, unused ticket admits', admit_status(ticket()), 'ok');
check('an unknown code',              admit_status(null), 'not_found');
check('an unpaid order',              admit_status(ticket(['status' => 'pending'])), 'unpaid');
check('a failed payment',             admit_status(ticket(['status' => 'failed'])), 'unpaid');
check('an already-admitted order',    admit_status(ticket(['admittedAt' => '2026-11-08T19:02:00+03:00'])), 'already');
check('a merch receipt is not entry', admit_status(ticket(['itemType' => 'merch'])), 'merch');

// Precedence matters: an unpaid order that somehow carries an admittedAt must
// still read as unpaid, or a refunded ticket could be waved through.
check(
    'unpaid outranks already-admitted',
    admit_status(ticket(['status' => 'pending', 'admittedAt' => '2026-11-08T19:02:00+03:00'])),
    'unpaid'
);

echo "\n-- code matching survives the door --\n";
$orders = [ticket(), ticket(['ticketCode' => 'JC-999999FFFF'])];
check('exact match',            find_by_code($orders, 'JC-A1B2C3D4E5'), 0);
check('lowercase typed in',     find_by_code($orders, 'jc-a1b2c3d4e5'), 0);
check('surrounding spaces',     find_by_code($orders, '  JC-A1B2C3D4E5 '), 0);
// Staff reading a code aloud routinely drop the prefix.
check('prefix omitted',         find_by_code($orders, 'A1B2C3D4E5'), 0);
check('finds the second order', find_by_code($orders, 'JC-999999FFFF'), 1);
check('unknown code',           find_by_code($orders, 'JC-0000000000'), null);
check('empty input',            find_by_code($orders, ''), null);
check('empty input, no prefix guess', find_by_code($orders, '   '), null);

echo "\n-- what the door sees --\n";
$view = admit_view(ticket(), 'ok');
check('quantity is shown',   $view['quantity'], 3);
check('buyer is shown',      $view['buyer'], 'Shellton Omondi');
check('code is echoed back', $view['code'], 'JC-A1B2C3D4E5');
check('not yet admitted',    $view['admittedAt'], null);

// On a duplicate the original timestamp must come back, so staff can say when
// the ticket was already used rather than merely that it was.
$used = admit_view(ticket(['admittedAt' => '2026-11-08T19:02:00+03:00']), 'already');
check('duplicate reports the first entry time', $used['admittedAt'], '2026-11-08T19:02:00+03:00');

// An unknown code has no order behind it, so there is nothing to show but the
// verdict — and nothing that could leak details of a real ticket.
$missing = admit_view(null, 'not_found');
check('unknown code returns only a status', array_keys($missing), ['status']);

echo "\n$pass passed, $fail failed\n";
exit($fail === 0 ? 0 : 1);
