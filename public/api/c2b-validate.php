<?php
// Daraja-safe public route for C2B validation. The shared implementation always
// accepts direct PayBill payments so they can be reconciled after confirmation.

declare(strict_types=1);

require __DIR__ . '/mpesa-c2b-validation.php';
