<?php
// M-Pesa helper regressions that do not make a real Daraja request.
declare(strict_types=1);

const MPESA = [
    'env'               => 'sandbox',
    'consumer_key'      => 'test-key',
    'consumer_secret'   => 'test-secret',
    'shortcode'         => '174379',
    'passkey'           => 'test-passkey',
    'transaction_type'  => 'CustomerPayBillOnline',
    'callback_url'      => 'https://example.test/callback',
    'account_reference' => 'Test',
];

// _mpesa.php only calls these when a network operation is made.
function log_info(string $message, array $context = []): void {}
function log_error(string $message, array $context = []): void {}

require __DIR__ . '/../public/api/_mpesa.php';

$pass = 0; $fail = 0;
function check(string $name, $got, $want): void {
    global $pass, $fail;
    if ($got === $want) { $pass++; echo "  ok   $name\n"; return; }
    $fail++;
    echo "  FAIL $name\n       got:  " . var_export($got, true) . "\n       want: " . var_export($want, true) . "\n";
}

echo "\n-- phone formatting --\n";
check('local Safaricom number', mpesa_format_phone('0712 345 678'), '254712345678');
check('international Safaricom number', mpesa_format_phone('+254 712 345 678'), '254712345678');
check('new 01 prefix', mpesa_format_phone('0112-345-678'), '254112345678');
check('invalid number', mpesa_format_phone('12345'), '');

echo "\n-- account references --\n";
check('unique order reference preserved', mpesa_account_reference('JC12ab34cd56'), 'JC12AB34CD56');
check('reference punctuation removed', mpesa_account_reference('JC-12 ab'), 'JC12AB');
check('blank reference falls back to config', mpesa_account_reference(''), 'TEST');

echo "\n-- credential logging guard --\n";
$source = file_get_contents(__DIR__ . '/../public/api/_mpesa.php') ?: '';
check('consumer key is not added to log context', str_contains($source, "'key_used'"), false);
check('consumer secret is not added to log context', str_contains($source, "'secret_used'"), false);
check('Daraja connection is pinned to IPv4', str_contains($source, 'CURLOPT_IPRESOLVE'), true);

echo "\n$pass passed, $fail failed\n";
exit($fail > 0 ? 1 : 0);
