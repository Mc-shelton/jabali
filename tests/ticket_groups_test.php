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
check_group('public group identifies its creator', ticket_group_public($group)['createdBy'] === 'Alice');
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
check_group(
    'public invite hides member and slot records beyond the named creator',
    !isset($public['slots']) && !str_contains(json_encode($public), 'order-one')
);

ticket_group_release($group['token'], $slotTwo['id']);
$public = ticket_group_public(ticket_group_find($group['token']));
check_group('released payment attempt reopens its place', $public['full'] === false && $public['remaining'] === 1);

// One open group already exists above. Four more reach the per-package limit;
// another event/package remains independent, and a sixth here is rejected.
for ($i = 2; $i <= 5; $i++) {
    ticket_group_reserve('', "Choir Friends $i", 'concert', 'Group of 2', 2, 800, "Creator $i");
}
$available = ticket_groups_available('concert', 'Group of 2');
check_group('five open groups are publicly available', count($available) === MAX_OPEN_TICKET_GROUPS);
check_group('creation limit is visible before a buyer starts payment', ticket_group_limit_reached('concert', 'Group of 2'));

$closed = ticket_group_set_closed($group['id'], true);
check_group('admin can close a group', $closed['closed'] === true && count(ticket_groups_available('concert', 'Group of 2')) === 4);
check_group('closed group frees an open-group slot', !ticket_group_limit_reached('concert', 'Group of 2'));
$closedJoinRejected = false;
try {
    ticket_group_reserve($group['token'], '', 'concert', 'Group of 2', 2, 800, 'Closed Joiner');
} catch (RuntimeException $e) {
    $closedJoinRejected = str_contains($e->getMessage(), 'closed by the administrator');
}
check_group('closed group rejects invite joins', $closedJoinRejected);
$reopened = ticket_group_set_closed($group['id'], false);
check_group('admin can reopen a group', $reopened['closed'] === false && ticket_group_limit_reached('concert', 'Group of 2'));

$limitRejected = false;
try {
    ticket_group_reserve('', 'One too many', 'concert', 'Group of 2', 2, 800, 'Sixth Creator');
} catch (RuntimeException $e) {
    $limitRejected = str_contains($e->getMessage(), 'already 5 open groups');
}
check_group('sixth open group is rejected', $limitRejected);

$otherPackageWorked = true;
try {
    ticket_group_reserve('', 'Different tier', 'concert', 'Group of 3', 3, 700, 'Another Creator');
} catch (RuntimeException $e) {
    $otherPackageWorked = false;
}
check_group('limit is scoped to one event and package', $otherPackageWorked);

// Closing one group permits a replacement, but the original cannot then be
// reopened because that would silently take the package above five open groups.
ticket_group_set_closed($group['id'], true);
ticket_group_reserve('', 'Replacement group', 'concert', 'Group of 2', 2, 800, 'Replacement Creator');
$reopenLimitRejected = false;
try {
    ticket_group_set_closed($group['id'], false);
} catch (RuntimeException $e) {
    $reopenLimitRejected = str_contains($e->getMessage(), '5 other groups are open');
}
check_group('reopening cannot exceed the five-group limit', $reopenLimitRejected);

foreach (glob($testDir . '/*') ?: [] as $file) unlink($file);
rmdir($testDir);

echo "\n$pass passed, $fail failed\n";
exit($fail > 0 ? 1 : 0);
