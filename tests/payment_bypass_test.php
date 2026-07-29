<?php
declare(strict_types=1);
require __DIR__ . '/../public/api/_payment_bypass.php';

$cases = [
    'disabled even with matching key' => [false, 'secret', 'secret', false],
    'missing configured key' => [true, '', 'secret', false],
    'missing request key' => [true, 'secret', '', false],
    'wrong key' => [true, 'secret', 'other', false],
    'enabled and matching' => [true, 'secret', 'secret', true],
];
$fail = 0;
foreach ($cases as $name => [$enabled, $configured, $sent, $want]) {
    if (payment_bypass_keys_match($enabled, $configured, $sent) === $want) {
        echo "  ok   $name\n";
    } else {
        $fail++;
        echo "  FAIL $name\n";
    }
}
$loopbackCases = [
    'IPv4 loopback accepted' => ['127.0.0.1', true],
    'IPv6 loopback accepted' => ['::1', true],
    'LAN address rejected' => ['192.168.1.20', false],
    'public address rejected' => ['203.0.113.10', false],
    'missing address rejected' => ['', false],
];
foreach ($loopbackCases as $name => [$address, $want]) {
    if (payment_bypass_is_loopback($address) === $want) {
        echo "  ok   $name\n";
    } else {
        $fail++;
        echo "  FAIL $name\n";
    }
}
echo (count($cases) + count($loopbackCases) - $fail) . " passed, $fail failed\n";
exit($fail === 0 ? 0 : 1);
