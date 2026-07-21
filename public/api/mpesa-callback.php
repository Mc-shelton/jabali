<?php
// M-Pesa callback receiver. Safaricom POSTs the payment result here after the
// customer responds to the STK prompt. Must be a public HTTPS URL (no auth).
//
// Always answers 200 with the acknowledgement Daraja expects, even on problems,
// so Safaricom doesn't keep retrying.
require __DIR__ . '/_bootstrap.php';
require __DIR__ . '/_fulfil.php';

const STORE = 'orders';

function ack(): void
{
    json_out(['ResultCode' => 0, 'ResultDesc' => 'Accepted']);
}

if (($_SERVER['REQUEST_METHOD'] ?? 'POST') !== 'POST') {
    ack();
}

$payload = json_decode(file_get_contents('php://input') ?: 'null', true);
$cb = $payload['Body']['stkCallback'] ?? null;

if (!is_array($cb) || empty($cb['CheckoutRequestID'])) {
    ack();
}

$checkoutId = $cb['CheckoutRequestID'];
$resultCode = $cb['ResultCode'] ?? null;
$resultDesc = (string) ($cb['ResultDesc'] ?? '');

// Pull the receipt number out of the metadata items on success.
$receipt = null;
foreach ($cb['CallbackMetadata']['Item'] ?? [] as $item) {
    if (($item['Name'] ?? '') === 'MpesaReceiptNumber') {
        $receipt = $item['Value'] ?? null;
    }
}

$paid = ($resultCode === 0 || $resultCode === '0');

log_info('M-Pesa callback received', [
    'checkout'   => $checkoutId,
    'ResultCode' => $resultCode,
    'desc'       => $resultDesc,
    'receipt'    => $receipt,
]);

$orders = store_read(STORE, []);
foreach ($orders as $i => $order) {
    if (($order['checkoutRequestId'] ?? '') !== $checkoutId) continue;

    $current = $order['status'] ?? 'pending';

    // This callback is Safaricom's own word on the transaction, so it outranks
    // anything our status polling guessed. It may therefore correct an order
    // that polling marked `failed` while the customer was simply being slow —
    // previously that money was collected but the order stayed failed forever
    // and no e-ticket was ever sent.
    //
    // The one thing it must never do is undo a success: callbacks can arrive
    // twice, and a duplicate must not flip a paid order to failed.
    if ($current === 'success') {
        break;
    }
    if (!$paid && $current === 'failed') {
        break;                                  // already failed; nothing new
    }

    $orders[$i]['status'] = $paid ? 'success' : 'failed';
    $orders[$i]['resultDesc'] = $resultDesc;
    $orders[$i]['receipt'] = $receipt;
    $orders[$i]['paidAt'] = date('c');
    $orders[$i]['settledBy'] = 'callback';
    if ($current === 'failed' && $paid) {
        $orders[$i]['correctedFrom'] = 'failed'; // visible in the admin table
        log_warn('Order corrected from failed to paid by callback', [
            'orderId' => $order['id'] ?? null,
            'receipt' => $receipt,
        ]);
    }

    log_info('Order settled', [
        'orderId' => $order['id'] ?? null,
        'from'    => $current,
        'to'      => $orders[$i]['status'],
        'by'      => 'callback',
    ]);

    if ($orders[$i]['status'] === 'success') {
        fulfil_order($orders[$i]); // e-ticket + confirmation email
    }
    store_write(STORE, $orders);
    break;
}

ack();
