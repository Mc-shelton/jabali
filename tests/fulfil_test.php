<?php
// The property under test: fulfilment is a side effect of a payment that has
// already happened, so nothing in it may undo one.
//
// Real failure this guards: an exception in send_order_email() unwound the
// reconcile before store_write(), so an order M-Pesa had confirmed as PAID was
// never saved as paid. The mail server was effectively deciding whether money
// counted.
declare(strict_types=1);

$tmp = sys_get_temp_dir() . '/jc-fulfil-' . bin2hex(random_bytes(4));
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

// Stub the two things fulfil_order depends on, so we can make them misbehave.
$GLOBALS['mail_behaviour'] = 'ok';

function pdf_ticket(array $order): string {
    if ($GLOBALS['mail_behaviour'] === 'pdf_throws') {
        throw new RuntimeException('PDF generation exploded');
    }
    return '%PDF-1.4 fake';
}

function send_order_email(array $order, ?string $pdf = null): bool {
    switch ($GLOBALS['mail_behaviour']) {
        case 'throws':      throw new Error('Call to undefined function mail()');
        case 'returns_false': return false;
        default:            return true;
    }
}

// Pull in fulfil_order alone: requiring the file would drag in the real
// _ticket.php / _mailer.php and collide with the stubs above.
$src = file_get_contents(__DIR__ . '/../public/api/_fulfil.php');
// Non-greedy: the file now defines resend_confirmation() after this one, and a
// greedy match would pull it in too. Inner braces are indented, so the first
// "\n}" is fulfil_order's own closing brace.
preg_match('/function fulfil_order.*?\n}/s', $src, $m);
eval($m[0]);

// resend_confirmation() calls fulfil_order(), which the eval above just defined.
preg_match('/function resend_confirmation.*?\n}/s', $src, $mr);
eval($mr[0]);

function paid_order(): array {
    return [
        'id' => 'ord1', 'status' => 'success', 'itemType' => 'ticket',
        'ticketCode' => 'JC-1', 'emailed' => false,
        'customer' => ['email' => 'buyer@example.com', 'preferredName' => 'Buyer'],
        'amount' => 1000, 'quantity' => 1, 'eventTitle' => 'Concert',
    ];
}

echo "\n-- the happy path still works --\n";
$GLOBALS['mail_behaviour'] = 'ok';
$o = paid_order();
fulfil_order($o);
check('order stays paid', $o['status'], 'success');
check('email marked sent', $o['emailOk'], true);
check('marked as attempted', $o['emailed'], true);

echo "\n-- a THROWING mailer must not undo the payment --\n";
$GLOBALS['mail_behaviour'] = 'throws';
$o = paid_order();
$threw = false;
try { fulfil_order($o); } catch (Throwable $e) { $threw = true; }
check('exception did not escape', $threw, false);
check('order is STILL paid', $o['status'], 'success');
check('failure recorded on the order', $o['emailOk'], false);
check('reason captured', $o['emailError'], 'Call to undefined function mail()');

echo "\n-- a throwing PDF generator is contained too --\n";
$GLOBALS['mail_behaviour'] = 'pdf_throws';
$o = paid_order();
$threw = false;
try { fulfil_order($o); } catch (Throwable $e) { $threw = true; }
check('exception did not escape', $threw, false);
check('order is STILL paid', $o['status'], 'success');
check('failure flagged', $o['emailOk'], false);

echo "\n-- a mailer that just returns false --\n";
$GLOBALS['mail_behaviour'] = 'returns_false';
$o = paid_order();
fulfil_order($o);
check('order is STILL paid', $o['status'], 'success');
check('flagged as not emailed', $o['emailOk'], false);

echo "\n-- one attempt only, however it went --\n";
$GLOBALS['mail_behaviour'] = 'throws';
$o = paid_order();
fulfil_order($o);
$first = $o['emailedAt'];
$GLOBALS['mail_behaviour'] = 'ok';
fulfil_order($o);                       // second call on an already-attempted order
check('not retried on a later poll', $o['emailedAt'], $first);
check('still flagged as failed', $o['emailOk'], false);

echo "\n-- unpaid orders are never fulfilled --\n";
$GLOBALS['mail_behaviour'] = 'ok';
$o = paid_order();
$o['status'] = 'pending';
fulfil_order($o);
check('pending order not emailed', $o['emailed'], false);

echo "\n-- re-sending recovers a buyer left without a ticket --\n";
// The case this exists for: the mailer was down when the payment settled, so a
// paid order carries emailed=true and emailOk=false and would never retry.
$GLOBALS['mail_behaviour'] = 'returns_false';
$o = paid_order();
fulfil_order($o);
check('first attempt failed', $o['emailOk'], false);
check('and is marked attempted', $o['emailed'], true);

$GLOBALS['mail_behaviour'] = 'ok';
$ok = resend_confirmation($o);
check('re-send reports success', $ok, true);
check('email now marked sent', $o['emailOk'], true);
check('attempt counted', $o['resendCount'], 1);

$ok = resend_confirmation($o);
check('counts each attempt', $o['resendCount'], 2);

echo "\n-- a stale error must not outlive a successful re-send --\n";
$GLOBALS['mail_behaviour'] = 'throws';
$o = paid_order();
fulfil_order($o);
check('error recorded', isset($o['emailError']), true);
$GLOBALS['mail_behaviour'] = 'ok';
resend_confirmation($o);
check('error cleared once sent', isset($o['emailError']), false);

echo "\n-- re-sending must not claim an unpaid order was paid --\n";
$GLOBALS['mail_behaviour'] = 'ok';
$o = paid_order();
$o['status'] = 'pending';
$o['emailed'] = false;
check('refused for pending order', resend_confirmation($o), false);
check('nothing was sent', $o['emailed'], false);

$o = paid_order();
$o['status'] = 'failed';
check('refused for failed order', resend_confirmation($o), false);

echo "\n-- a throwing mailer must not break re-send either --\n";
$GLOBALS['mail_behaviour'] = 'throws';
$o = paid_order();
$threw = false;
try { resend_confirmation($o); } catch (Throwable $e) { $threw = true; }
check('exception did not escape', $threw, false);
check('order is still paid', $o['status'], 'success');

echo "\n-- failures are written to the log --\n";
$lines = @file(log_path(), FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) ?: [];
$errors = array_filter(array_map(fn($l) => json_decode($l, true), $lines),
                       fn($e) => ($e['level'] ?? '') === 'error');
check('fulfilment errors logged', count($errors) >= 2, true);

array_map('unlink', glob("$tmp/logs/*") ?: []);
@rmdir("$tmp/logs"); @rmdir($tmp);

echo "\n$pass passed, $fail failed\n";
exit($fail > 0 ? 1 : 0);
