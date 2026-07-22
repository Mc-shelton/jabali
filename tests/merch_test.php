<?php
// Tests option resolution and pricing. The security property under test: the
// price is always derived from the STORED item, so a crafted request can't
// choose its own price or invent an option that doesn't exist.
declare(strict_types=1);

function clean_string($value, int $maxLen = 500): string
{
    if (!is_string($value)) return '';
    $value = trim($value);
    $value = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', $value);
    return mb_substr($value, 0, $maxLen);
}
function error_out(string $m, int $c = 400): void { throw new RuntimeException($m); }

$API = __DIR__ . '/../public/api';
// Pull in just the two functions under test, without the routing side effects.
$src = file_get_contents("$API/tickets.php");
preg_match('/function price_to_int.*?\n}/s', $src, $m1);
preg_match('/function resolve_options.*?\n}\n/s', $src, $m2);
eval($m1[0]);
eval($m2[0]);

$pass = 0; $fail = 0;
function check(string $name, $got, $want) {
    global $pass, $fail;
    if ($got === $want) { $pass++; echo "  ok   $name\n"; return; }
    $fail++;
    echo "  FAIL $name\n       got:  " . json_encode($got) . "\n       want: " . json_encode($want) . "\n";
}

$tshirt = [
    'name' => 'T-Shirt',
    'price' => 'KES 1,500',
    'options' => [
        [
            'name' => 'Size', 'required' => true,
            'choices' => [
                ['label' => 'S', 'priceDelta' => 0],
                ['label' => 'L', 'priceDelta' => 100],
                ['label' => 'XL', 'priceDelta' => 200],
            ],
        ],
        [
            'name' => 'Colour', 'required' => false,
            'choices' => [
                ['label' => 'Navy', 'priceDelta' => 0],
                ['label' => 'Gold', 'priceDelta' => 150],
            ],
        ],
    ],
];

echo "\n-- pricing --\n";
check('base price parsed', price_to_int('KES 1,500'), 1500);

[$chosen, $delta, $err] = resolve_options($tshirt, [['name' => 'Size', 'choice' => 'XL']]);
check('XL adds 200', $delta, 200);
check('no error', $err, null);
check('choice recorded', $chosen[0]['choice'], 'XL');
check('total is base + delta', price_to_int($tshirt['price']) + $delta, 1700);

[, $delta2] = resolve_options($tshirt, [
    ['name' => 'Size', 'choice' => 'L'],
    ['name' => 'Colour', 'choice' => 'Gold'],
]);
check('deltas stack (100 + 150)', $delta2, 250);

[, $delta3] = resolve_options($tshirt, [['name' => 'Size', 'choice' => 'S']]);
check('zero-delta option adds nothing', $delta3, 0);

echo "\n-- validation --\n";
[, , $e1] = resolve_options($tshirt, []);
check('missing required option rejected', $e1, 'Please choose a Size.');

[, , $e2] = resolve_options($tshirt, [['name' => 'Size', 'choice' => 'XXXL']]);
check('unknown choice rejected', $e2, '"XXXL" is not an available Size.');

[$c3, $d3, $e3] = resolve_options($tshirt, [
    ['name' => 'Size', 'choice' => 'S'],
    ['name' => 'Colour', 'choice' => ''],
]);
check('optional option may be blank', $e3, null);
check('blank optional not recorded', count($c3), 1);

echo "\n-- a crafted request cannot set its own price --\n";
// Attacker sends a priceDelta of their own; it must be ignored entirely, with
// the delta taken from the stored choice.
[$c4, $d4, $e4] = resolve_options($tshirt, [
    ['name' => 'Size', 'choice' => 'XL', 'priceDelta' => -1400],
]);
check('client priceDelta ignored', $d4, 200);
check('stored delta used', $c4[0]['priceDelta'], 200);

// An option the item never declared must not appear or affect price.
[$c5, $d5, $e5] = resolve_options($tshirt, [
    ['name' => 'Size', 'choice' => 'S'],
    ['name' => 'Discount', 'choice' => 'Free'],
]);
check('undeclared option ignored', count($c5), 1);
check('undeclared option adds no delta', $d5, 0);

echo "\n-- items with no options --\n";
[$c6, $d6, $e6] = resolve_options(['name' => 'CD', 'price' => 'KES 500'], [['name' => 'Size', 'choice' => 'L']]);
check('no declared options -> nothing chosen', $c6, []);
check('no declared options -> no delta', $d6, 0);
check('no declared options -> no error', $e6, null);

echo "\n$pass passed, $fail failed\n";
exit($fail > 0 ? 1 : 0);
