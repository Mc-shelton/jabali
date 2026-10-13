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

echo "\n-- family package composition --\n";
$family = [
    'type' => 'family',
    'family' => [
        'basePrice' => 1000,
        'minMembers' => 3,
        'maxMembers' => 6,
        'groups' => [
            ['id' => 'parent', 'label' => 'Parent', 'ageLabel' => '18+', 'min' => 1, 'max' => 2,
             'pricing' => ['type' => 'full', 'value' => 0]],
            ['id' => 'child', 'label' => 'Child', 'ageLabel' => '3-12', 'min' => 0, 'max' => 4,
             'pricing' => ['type' => 'percent', 'value' => 50]],
            ['id' => 'baby', 'label' => 'Baby', 'ageLabel' => '0-2', 'min' => 0, 'max' => 1,
             'pricing' => ['type' => 'fixed', 'value' => 100]],
        ],
    ],
];

[$composition, $ticketMeta, $amount, $error] = resolve_family_composition($family, [
    ['id' => 'parent', 'quantity' => 2],
    ['id' => 'child', 'quantity' => 1],
]);
if ($error === null && $amount === 2500) echo "  ok   category discounts set the family total\n";
else { $fail++; echo "  FAIL family total: " . ($error ?? $amount) . "\n"; }
if (count($ticketMeta) === 3 && $ticketMeta[2]['memberLabel'] === 'Child') echo "  ok   each admission retains its category\n";
else { $fail++; echo "  FAIL family ticket metadata\n"; }
if (family_package_minimum_amount($family) === 1600) echo "  ok   package card finds cheapest valid composition\n";
else { $fail++; echo "  FAIL family minimum display price\n"; }

[, , , $tooSmall] = resolve_family_composition($family, [['id' => 'parent', 'quantity' => 1]]);
if ($tooSmall === 'This family package is for 3 to 6 people.') echo "  ok   minimum family size is enforced\n";
else { $fail++; echo "  FAIL family minimum validation\n"; }

[, , , $unknown] = resolve_family_composition($family, [
    ['id' => 'parent', 'quantity' => 2],
    ['id' => 'invented', 'quantity' => 1],
]);
if ($unknown === 'That family member category is no longer available.') echo "  ok   unknown categories are rejected\n";
else { $fail++; echo "  FAIL unknown family category\n"; }

echo (count($cases) + 9 - $fail) . " passed, $fail failed\n";
exit($fail === 0 ? 0 : 1);
