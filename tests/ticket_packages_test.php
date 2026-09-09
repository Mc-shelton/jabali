<?php
// A package's price is per bundle, while its ticketCount determines admissions.
// The server owns the multiplier so a browser cannot award itself extra entry.
declare(strict_types=1);

require __DIR__ . '/../public/api/_ticket_packages.php';

$cases = [
    'legacy package defaults to one' => [null, 1],
    'single ticket remains one'      => [1, 1],
    'couple package has two'         => [2, 2],
    'zero is bounded to one'         => [0, 1],
    'negative is bounded to one'     => [-4, 1],
    'large values are capped'        => [999, 50],
];

$fail = 0;
foreach ($cases as $name => [$sent, $want]) {
    $got = normalise_ticket_count($sent);
    if ($got === $want) echo "  ok   $name\n";
    else { $fail++; echo "  FAIL $name: got $got, want $want\n"; }
}

$got = ticket_admission_quantity(3, 2);
if ($got === 6) echo "  ok   three couple packages admit six\n";
else { $fail++; echo "  FAIL multiplier: got $got, want 6\n"; }

if (MAX_TICKETS_PER_ORDER === 50) echo "  ok   one email is capped at fifty tickets\n";
else { $fail++; echo "  FAIL order cap\n"; }

if (max_ticket_package_purchase_quantity(3) === 1) echo "  ok   bundles are limited to one per purchase\n";
else { $fail++; echo "  FAIL bundle purchase limit\n"; }

if (max_ticket_package_purchase_quantity(1) === 50) echo "  ok   single tickets retain multi-buy\n";
else { $fail++; echo "  FAIL single-ticket purchase limit\n"; }

echo (count($cases) + 4 - $fail) . " passed, $fail failed\n";
exit($fail === 0 ? 0 : 1);
