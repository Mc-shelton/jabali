<?php
// Daraja rejects callback URLs containing reserved words such as "mpesa".
// Keep the public route neutral while the established receiver remains the
// single implementation and the old internal path stays backward-compatible.

declare(strict_types=1);

require __DIR__ . '/mpesa-c2b-confirmation.php';
