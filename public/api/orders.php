<?php
// Orders / sales — admin only.
//   GET  orders.php              → all orders, newest first
//   POST orders.php?reconcile=1  → re-query every unsettled order against Daraja
require __DIR__ . '/_bootstrap.php';
require __DIR__ . '/_orders.php';

route([
    'GET' => function () {
        require_auth();

        $orders = store_read('orders', []);
        // Newest first.
        usort($orders, fn($a, $b) => strcmp($b['createdAt'] ?? '', $a['createdAt'] ?? ''));

        $paid = array_filter($orders, fn($o) => ($o['status'] ?? '') === 'success');
        $revenue = array_sum(array_map(fn($o) => (int) ($o['amount'] ?? 0), $paid));

        json_out([
            'orders' => array_values($orders),
            'stats'  => [
                'total'   => count($orders),
                'paid'    => count($paid),
                'revenue' => $revenue,
            ],
        ]);
    },

    // Re-query every unsettled order against Daraja. This is the recovery path
    // for orders that status polling wrongly marked failed while the customer
    // was still paying — those had their money taken but never got an e-ticket.
    'POST' => function () {
        require_auth();
        require_csrf();

        if (empty($_GET['reconcile'])) {
            error_out('Nothing to do.', 400);
        }

        $orders = store_read('orders', []);
        $checked = 0;
        $recovered = 0;
        $settled = 0;
        $failedChecks = 0;

        foreach ($orders as $i => $order) {
            if (($order['status'] ?? '') === 'success') continue;
            if (empty($order['checkoutRequestId'])) continue;

            $was = $order['status'] ?? 'pending';
            $checked++;

            // Contain each order: one that blows up (an unreachable Daraja, a
            // mailer fault) must not abandon the whole run and throw away the
            // orders already confirmed paid in this loop.
            try {
                $orders[$i] = refresh_order_status($order, true);
            } catch (Throwable $e) {
                $failedChecks++;
                log_error('Reconcile failed for one order: ' . $e->getMessage(), [
                    'orderId' => $order['id'] ?? null,
                    'file'    => basename($e->getFile()),
                    'line'    => $e->getLine(),
                ]);
                continue;
            }

            $now = $orders[$i]['status'] ?? 'pending';
            if ($now !== $was) {
                $settled++;
                if ($was === 'failed' && $now === 'success') $recovered++;
            }
        }

        // Always persist whatever was resolved, even if some orders errored.
        store_write('orders', $orders);

        log_info('Reconcile run', [
            'checked'   => $checked,
            'settled'   => $settled,
            'recovered' => $recovered,
            'errored'   => $failedChecks,
        ]);

        json_out([
            'checked'   => $checked,
            'settled'   => $settled,
            'recovered' => $recovered,
            'errored'   => $failedChecks,
        ]);
    },
]);
