<?php
// Shared-group capacity, settlement projection, and public privacy contract.
declare(strict_types=1);

$testDir = sys_get_temp_dir() . '/jc-ticket-groups-' . bin2hex(random_bytes(5));
mkdir($testDir, 0775, true);
define('DATA_DIR', $testDir);

function store_path(string $name): string { return DATA_DIR . '/' . $name . '.json'; }
function store_read(string $name, $default = []) {
    $raw = @file_get_contents(store_path($name));
    if ($raw === false) return $default;
    return json_decode($raw, true) ?? $default;
}
function error_out(string $message, int $status = 400): void {
    throw new RuntimeException("$status:$message");
}

require __DIR__ . '/../public/api/_ticket_groups.php';

$pass = 0; $fail = 0;
function check_group(string $name, $condition): void {
    global $pass, $fail;
    if ($condition) { $pass++; echo "  ok   $name\n"; return; }
    $fail++; echo "  FAIL $name\n";
}

[$group, $slotOne] = ticket_group_reserve('', 'Choir Friends', 'concert', 'Group of 2', 2, 800, 'Alice');
[$sameGroup, $slotTwo] = ticket_group_reserve($group['token'], '', 'concert', 'Group of 2', 2, 800, 'Bob');
check_group('creator names a new group', $group['name'] === 'Choir Friends');
check_group('invite joins the same group', $sameGroup['id'] === $group['id']);

$fullRejected = false;
try {
    ticket_group_reserve($group['token'], '', 'concert', 'Group of 2', 2, 800, 'Carol');
} catch (RuntimeException $e) {
    $fullRejected = str_contains($e->getMessage(), 'group is full');
}
check_group('atomic capacity check rejects the next member', $fullRejected);

ticket_group_attach_order($group['token'], $slotOne['id'], 'order-one');
file_put_contents(store_path('orders'), json_encode([
    ['id' => 'order-one', 'status' => 'success'],
]));
$stored = ticket_group_find($group['token']);
$public = ticket_group_public($stored);
check_group('paid and pending places both occupy capacity', $public['paidCount'] === 1 && $public['pendingCount'] === 1);
check_group('full state is derived from occupied places', $public['full'] === true && $public['remaining'] === 0);
check_group('public invite hides member and slot records', !isset($public['slots']) && !str_contains(json_encode($public), 'Alice'));

ticket_group_release($group['token'], $slotTwo['id']);
$public = ticket_group_public(ticket_group_find($group['token']));
check_group('released payment attempt reopens its place', $public['full'] === false && $public['remaining'] === 1);

foreach (glob($testDir . '/*') ?: [] as $file) unlink($file);
rmdir($testDir);

echo "\n$pass passed, $fail failed\n";
exit($fail > 0 ? 1 : 0);
