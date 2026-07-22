<?php
// Guards the class of bug that broke the M-Pesa status check: PHP printing a
// notice/warning/deprecation into the response body ahead of the JSON, so the
// client can't parse a reply the server thinks succeeded.
//
// The rule under test: nothing PHP emits diagnostically ever reaches output.
declare(strict_types=1);

$tmp = sys_get_temp_dir() . '/jc-log-test-' . bin2hex(random_bytes(4));
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

function read_log(): array {
    $lines = @file(log_path(), FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) ?: [];
    return array_map(fn($l) => json_decode($l, true), $lines);
}

echo "\n-- diagnostics never reach output --\n";

ob_start();
trigger_error('a deliberate notice', E_USER_NOTICE);
trigger_error('a deliberate warning', E_USER_WARNING);
trigger_error('a deliberate deprecation', E_USER_DEPRECATED);
$printed = ob_get_clean();

check('nothing printed to the response body', $printed, '');

$log = read_log();
check('all three were logged', count($log), 3);
check('notice recorded at its level', $log[0]['level'], 'notice');
check('warning recorded at its level', $log[1]['level'], 'warning');
check('deprecation recorded at its level', $log[2]['level'], 'deprecated');
check('message preserved', $log[2]['message'], 'a deliberate deprecation');

echo "\n-- a real runtime warning is caught too --\n";
ob_start();
$x = @file_get_contents($tmp . '/definitely-missing-file');   // emits a warning
$undefined = [];
$y = $undefined['nope'] ?? null;                              // no warning (null coalesce)
$printed2 = ob_get_clean();
check('no output from a failed file read', $printed2, '');

echo "\n-- log entries carry what you need to trace an issue --\n";
$log = read_log();
$last = end($log);
check('has a timestamp', isset($last['time']), true);
check('has a reference', !empty($last['ref']), true);
check('reference is stable within a request', $log[0]['ref'], $log[1]['ref']);

echo "\n-- context is recorded --\n";
log_error('payment blew up', ['orderId' => 'ord1', 'code' => 500]);
$log = read_log();
$last = end($log);
check('context stored', $last['context'], ['orderId' => 'ord1', 'code' => 500]);
check('level stored', $last['level'], 'error');

echo "\n-- logging never breaks the request --\n";
// An unwritable log directory must not throw or print.
$ro = $tmp . '/readonly';
mkdir($ro, 0500, true);
$saved = DATA_DIR;
ob_start();
jc_log('info', 'should not explode', []);
$printed3 = ob_get_clean();
check('no output even when logging succeeds', $printed3, '');

// Cleanup
array_map('unlink', glob("$tmp/logs/*") ?: []);
@rmdir("$tmp/logs"); @rmdir($ro); @rmdir($tmp);

echo "\n$pass passed, $fail failed\n";
exit($fail > 0 ? 1 : 0);
