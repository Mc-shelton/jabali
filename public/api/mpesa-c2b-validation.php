<?php
// C2B validation endpoint. Direct payments are deliberately accepted: the
// dashboard records them as unclaimed for an admin to reconcile afterwards.
// Register this exact HTTPS URL as the shortcode's C2B Validation URL.

declare(strict_types=1);

require __DIR__ . '/_bootstrap.php';

json_out(['ResultCode' => 0, 'ResultDesc' => 'Accepted']);
