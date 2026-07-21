<?php
// Order settlement — shared by the public status poll (tickets.php) and the
// admin reconcile (orders.php).
//
// The rule everything here follows: a paid order is never re-opened, and a
// `failed` order is never final until Safaricom says so. Status polling can only
// ever guess, so it must be correctable — an order marked failed while the
// customer was simply slow to enter their PIN has to be able to become success
// once the real answer arrives.

declare(strict_types=1);

require_once __DIR__ . '/_mpesa.php';
require_once __DIR__ . '/_fulfil.php';

// Re-ask Daraja about an unsettled order and apply the answer.
// `$force` skips the rate limit and the initial grace period — used by the
// customer's manual Refresh button and by the admin reconcile.
function refresh_order_status(array $order, bool $force = false): array
{
    if (empty($order['checkoutRequestId'])) return $order;
    if (($order['status'] ?? '') === 'success') return $order;   // never re-open a paid order

    // Daraja is slow, and every open checkout tab polls independently.
    $sinceQuery = time() - (int) ($order['lastQueryAt'] ?? 0);
    if (!$force && $sinceQuery < 5) return $order;

    // Give the customer a moment to actually see the prompt before asking.
    $age = time() - strtotime($order['createdAt'] ?? 'now');
    if (!$force && $age < 8) return $order;

    $q = mpesa_stk_query($order['checkoutRequestId']);
    $order['lastQueryAt'] = time();
    $order['lastQueryCode'] = $q['code'];

    if ($q['status'] === 'success') {
        // May be correcting an order previously marked failed — the whole reason
        // a failed order stays re-queryable.
        if (($order['status'] ?? '') === 'failed') {
            $order['correctedFrom'] = 'failed';
        }
        $order['status'] = 'success';
        $order['resultDesc'] = $q['desc'];
        $order['paidAt'] = $order['paidAt'] ?? date('c');
        $order['settledBy'] = 'query';
        fulfil_order($order);           // e-ticket + confirmation email, idempotent

        log_info('Order settled', [
            'orderId'   => $order['id'] ?? null,
            'to'        => 'success',
            'by'        => 'query',
            'corrected' => isset($order['correctedFrom']),
            'emailOk'   => $order['emailOk'] ?? null,
        ]);
    } elseif ($q['status'] === 'failed' && ($order['status'] ?? '') === 'pending') {
        $order['status'] = 'failed';
        $order['resultDesc'] = $q['desc'];
        $order['settledBy'] = 'query';

        log_info('Order settled', [
            'orderId' => $order['id'] ?? null,
            'to'      => 'failed',
            'by'      => 'query',
            'code'    => $q['code'],
        ]);
    }

    return $order;
}
