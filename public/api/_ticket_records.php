<?php
// Compatibility helpers for the two ticket shapes that exist in the order
// store. New orders have one record per independently scannable ticket. Orders
// issued before that change have one top-level code which admits their party.

declare(strict_types=1);

function order_ticket_records(array $order): array
{
    $records = [];

    if (!empty($order['tickets']) && is_array($order['tickets'])) {
        $total = count($order['tickets']);
        foreach ($order['tickets'] as $index => $ticket) {
            if (!is_array($ticket) || empty($ticket['code'])) continue;
            $records[] = [
                'code'       => (string) $ticket['code'],
                'admittedAt' => $ticket['admittedAt'] ?? null,
                'memberType' => $ticket['memberType'] ?? null,
                'memberLabel'=> $ticket['memberLabel'] ?? null,
                'ageLabel'   => $ticket['ageLabel'] ?? null,
                'quantity'   => 1,
                'number'     => $index + 1,
                'total'      => $total,
                'legacy'     => false,
            ];
        }
        if ($records) return $records;
    }

    if (!empty($order['ticketCode'])) {
        return [[
            'code'       => (string) $order['ticketCode'],
            'admittedAt' => $order['admittedAt'] ?? null,
            'quantity'   => max(1, (int) ($order['quantity'] ?? 1)),
            'number'     => 1,
            'total'      => 1,
            'legacy'     => true,
        ]];
    }

    return [];
}

function order_ticket_record_at(array $order, ?int $ticketIndex): ?array
{
    if ($ticketIndex === null) return null;
    $ticket = $order['tickets'][$ticketIndex] ?? null;
    if (!is_array($ticket) || empty($ticket['code'])) return null;

    return [
        'code'       => (string) $ticket['code'],
        'admittedAt' => $ticket['admittedAt'] ?? null,
        'memberType' => $ticket['memberType'] ?? null,
        'memberLabel'=> $ticket['memberLabel'] ?? null,
        'ageLabel'   => $ticket['ageLabel'] ?? null,
        'quantity'   => 1,
        'number'     => $ticketIndex + 1,
        'total'      => count((array) ($order['tickets'] ?? [])),
        'legacy'     => false,
    ];
}
