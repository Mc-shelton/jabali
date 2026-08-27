<?php
// Direct PayBill callback shaping and direct-payment regressions.
declare(strict_types=1);

const MPESA = [
    'shortcode' => '123456',
    'c2b_callback_key' => 'test-secret',
];

$tmp = sys_get_temp_dir() . '/jc-c2b-test-' . bin2hex(random_bytes(5));
mkdir($tmp, 0775, true);
define('DATA_DIR', $tmp);

require __DIR__ . '/../public/api/_c2b.php';

$pass = 0; $fail = 0;
function check(string $name, $got, $want): void {
    global $pass, $fail;
    if ($got === $want) { $pass++; echo "  ok   $name\n"; return; }
    $fail++;
    echo "  FAIL $name\n       got:  " . var_export($got, true) . "\n       want: " . var_export($want, true) . "\n";
}

$payload = [
    'TransactionType' => 'Pay Bill',
    'TransID' => 'sja2xk9abc',
    'TransTime' => '20260827143005',
    'TransAmount' => '1250.00',
    'BusinessShortCode' => 123456,
    'BillRefNumber' => 'Jabali',
    'MSISDN' => '254712345678',
    'FirstName' => 'Amina',
    'LastName' => 'N.',
];

echo "\n-- callback authentication --\n";
check('configured key accepted', c2b_callback_key_valid('test-secret'), true);
check('wrong key rejected', c2b_callback_key_valid('wrong'), false);

echo "\n-- callback shaping --\n";
$payment = c2b_normalise_confirmation($payload);
check('valid payload accepted', is_array($payment), true);
check('receipt normalised', $payment['receipt'], 'SJA2XK9ABC');
check('amount parsed', $payment['amount'], 1250.0);
check('payer name joined', $payment['payerName'], 'Amina N.');
check('valid Kenyan phone retained', $payment['phone'], '254712345678');
check('M-Pesa time uses Kenya offset', $payment['paidAt'], '2026-08-27T14:30:05+03:00');

$redactedPhone = $payload;
$redactedPhone['MSISDN'] = hash('sha256', '254712345678');
check('redacted MSISDN is not presented as a false phone',
    c2b_normalise_confirmation($redactedPhone)['phone'], '');

$wrongShortcode = $payload;
$wrongShortcode['BusinessShortCode'] = '999999';
check('other shortcode rejected', c2b_normalise_confirmation($wrongShortcode), null);

$noReceipt = $payload;
$noReceipt['TransID'] = '';
check('missing receipt rejected', c2b_normalise_confirmation($noReceipt), null);

echo "\n-- direct-payment reconciliation --\n";
$payments = [$payment, ['receipt' => 'SJA2XK9DEF', 'amount' => 500]];
$orders = [['status' => 'success', 'receipt' => 'sja2xk9abc']];
check('paid order receipt excluded', c2b_direct_stats($payments, $orders), [
    'count' => 1,
    'amount' => 500.0,
]);
check('exact stored receipt claims payment regardless of order status', c2b_direct_stats($payments, [
    ['status' => 'pending', 'receipt' => 'SJA2XK9ABC'],
]), [
    'count' => 1,
    'amount' => 500.0,
]);
check('stored payment reference claims a receiptless order payment', c2b_direct_stats([
    ['receipt' => 'SJA2XK9XYZ', 'amount' => 700, 'accountReference' => 'jc-ab12cd34ef'],
], [
    ['status' => 'pending', 'receipt' => null, 'paymentReference' => 'JCAB12CD34EF'],
]), [
    'count' => 0,
    'amount' => 0.0,
]);
check('unknown account reference remains a direct payment', c2b_direct_stats([
    ['receipt' => 'SJA2XK9XYZ', 'amount' => 700, 'accountReference' => 'JC0000000000'],
], [
    ['status' => 'success', 'receipt' => null, 'paymentReference' => 'JCAB12CD34EF'],
]), [
    'count' => 1,
    'amount' => 700.0,
]);

$directPayments = c2b_direct_payments([
    ['receipt' => 'SJA2XK9OLD', 'amount' => 100, 'paidAt' => '2026-08-26T10:00:00+03:00'],
    $payment,
], []);
check('direct payments are newest first', $directPayments[0]['receipt'], 'SJA2XK9ABC');

$adminRecord = c2b_admin_record(array_replace($payment, ['requestRef' => 'ABC123']));
check('confirmed direct payment has successful status', $adminRecord['status'], 'success');
check('account reference becomes the item name', $adminRecord['itemName'], 'JABALI');
check('payment method becomes the item tag', $adminRecord['itemType'], 'direct');
check('admin record has a stable receipt id', $adminRecord['id'], 'c2b-sja2xk9abc');
check('admin record exposes account reference', $adminRecord['accountReference'], 'JABALI');
check('admin record exposes callback log reference', $adminRecord['requestRef'], 'ABC123');
check('old malformed phone is hidden from admin record',
    c2b_admin_record(array_replace($payment, ['phone' => '84512346486']))['customer']['phone'], '');

echo "\n-- durable write-ahead capture --\n";
$raw = json_encode($payload);
$captureError = null;
$capture = c2b_capture_callback($raw, $captureError, 'ABC123');
check('valid callback captured', is_array($capture), true);
check('capture has request reference', $capture['requestRef'], 'ABC123');
check('capture body hash matches', $capture['sha256'], hash('sha256', $raw));
$captures = c2b_read_captures();
check('captured body normalises on replay', $captures[0]['payment']['receipt'], 'SJA2XK9ABC');
check('replayed payment retains capture id', $captures[0]['payment']['captureId'], $capture['captureId']);
check('replayed payment retains log reference', $captures[0]['payment']['requestRef'], 'ABC123');

$tooLargeError = null;
$tooLarge = c2b_capture_callback(str_repeat('x', C2B_MAX_CALLBACK_BYTES + 1), $tooLargeError);
check('oversized callback rejected before disk', $tooLarge, null);
check('oversized rejection is diagnosable', str_contains($tooLargeError, 'exceeded'), true);

echo "\n-- idempotent materialisation and replay --\n";
$persistError = null;
check('first materialisation added', c2b_persist_payment($payment, $persistError), 'added');
check('same receipt is a duplicate', c2b_persist_payment($payment, $persistError), 'duplicate');
$conflict = $payment;
$conflict['amount'] = 999.0;
check('same receipt with different amount is flagged', c2b_persist_payment($conflict, $persistError), 'conflict');

$payload2 = $payload;
$payload2['TransID'] = 'SJA2XK9DEF';
$payload2['TransAmount'] = '500';
$capture2Error = null;
c2b_capture_callback(json_encode($payload2), $capture2Error, 'DEF456');
$replay = c2b_replay_inbox();
check('replay adds only missing receipt', $replay['added'], 1);
check('replay recognises existing receipt', $replay['duplicates'], 1);
check('resilient read has both receipts', count(c2b_read_payments_resilient()), 2);

$conflictPayload = $payload;
$conflictPayload['TransAmount'] = '999';
$conflictCaptureError = null;
c2b_capture_callback(json_encode($conflictPayload), $conflictCaptureError, 'CON123');
$conflictReplay = c2b_replay_inbox();
check('replay surfaces conflicting receipt data', $conflictReplay['conflicts'], ['SJA2XK9ABC']);

echo "\n-- recovery from bad input and a damaged materialised store --\n";
$badError = null;
c2b_capture_callback('{not-json', $badError, 'BAD123');
$replayWithBad = c2b_replay_inbox();
check('invalid callback retained for review', $replayWithBad['invalid'], 1);

file_put_contents(c2b_store_path(), '{damaged-json');
$third = $payment;
$third['receipt'] = 'SJA2XK9GHI';
$damageError = null;
check('damaged store is not overwritten', c2b_persist_payment($third, $damageError), 'error');
check('damage has explicit recovery reason', str_contains($damageError, 'invalid JSON'), true);
check('inbox still supplies known payments', count(c2b_read_payments_resilient()), 2);

foreach (glob($tmp . '/*') ?: [] as $file) @unlink($file);
@rmdir($tmp);

echo "\n$pass passed, $fail failed\n";
exit($fail > 0 ? 1 : 0);
