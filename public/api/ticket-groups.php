<?php
// Public read for an invite link. It deliberately exposes only group progress,
// never member names, phone numbers, emails, receipts, or order identifiers.
require __DIR__ . '/_bootstrap.php';
require __DIR__ . '/_ticket_groups.php';

route([
    'GET' => function () {
        $token = strtolower(clean_string($_GET['token'] ?? '', 32));
        $group = ticket_group_find($token);
        if (!$group) error_out('This group link is invalid or no longer available.', 404);
        json_out(ticket_group_public($group));
    },
]);
