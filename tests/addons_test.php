<?php
// The property under test: merchandise added to a ticket order at checkout is
// priced from the STORED product, exactly like the main item.
//
// The risk is specific. The browser now sends a basket rather than one item, so
// if any part of the figure came from the request — a price, a discount, a
// product that isn't on sale — a crafted payload would set its own total and
// the M-Pesa prompt would ask for it.
declare(strict_types=1);

$tmp = sys_get_temp_dir() . '/jc-addons-' . bin2hex(random_bytes(4));
mkdir($tmp . '/logs', 0775, true);
define('DATA_DIR', $tmp);

function clean_string($value, int $maxLen = 500): string {
    if (!is_string($value)) return '';
    $value = trim($value);
    $value = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', $value);
    return mb_substr($value, 0, $maxLen);
}
function slugify(string $value): string {
    $value = mb_strtolower(trim($value));
    $value = preg_replace('/[^a-z0-9]+/', '-', $value);
    return trim($value, '-') ?: 'item';
}
function error_out(string $m, int $c = 400): void { throw new RuntimeException($m); }
function store_read(string $name, $default = []) {
    $path = DATA_DIR . '/' . $name . '.json';
    if (!is_file($path)) return $default;
    return json_decode(file_get_contents($path) ?: 'null', true) ?? $default;
}
function store_write(string $name, $data): void {
    file_put_contents(DATA_DIR . '/' . $name . '.json', json_encode($data));
}

require __DIR__ . '/../public/api/_merch.php';

// resolve_options and resolve_addons out of tickets.php, without its routing.
$src = file_get_contents(__DIR__ . '/../public/api/tickets.php');
preg_match('/function resolve_options.*?\n}\n/s', $src, $m1);
preg_match('/function resolve_addons.*?\n}\n/s', $src, $m2);
eval($m1[0]);
eval($m2[0]);

$pass = 0; $fail = 0;
function check(string $name, $got, $want) {
    global $pass, $fail;
    if ($got === $want) { $pass++; echo "  ok   $name\n"; return; }
    $fail++;
    echo "  FAIL $name\n       got:  " . json_encode($got) . "\n       want: " . json_encode($want) . "\n";
}

// A catalogue: a plain tee, a discounted hoodie, a sized cap, and a donation.
$products = [
    merch_normalise(['name' => 'Tee', 'price' => 'KES 1,000'], []),
    merch_normalise(['name' => 'Hoodie', 'price' => 'KES 2,000',
        'discount' => ['enabled' => true, 'type' => 'percent', 'value' => 25]], []),
    merch_normalise(['name' => 'Cap', 'price' => 'KES 500', 'options' => [[
        'name' => 'Size', 'required' => true,
        'choices' => [['label' => 'S', 'priceDelta' => 0], ['label' => 'XL', 'priceDelta' => 150]],
    ]]], []),
    merch_normalise(['name' => 'Support', 'price' => '',
        'openAmount' => ['enabled' => true, 'min' => 100]], []),
];
store_write('merch', ['products' => $products, 'promoCodes' => []]);

$event = ['merchIds' => array_map(fn($p) => $p['id'], $products)];
$add = fn($sent) => resolve_addons($event, $sent);

echo "\n-- nothing added --\n";
[$lines, $total] = $add([]);
check('no lines', count($lines), 0);
check('no total',  $total, 0);

echo "\n-- a simple line --\n";
[$lines, $total] = $add([['name' => 'Tee', 'quantity' => 2]]);
check('one line',        count($lines), 1);
check('quantity kept',   $lines[0]['quantity'], 2);
check('unit price',      $lines[0]['unitPrice'], 1000);
check('line total',      $lines[0]['amount'], 2000);
check('basket total',    $total, 2000);

echo "\n-- the product's discount is applied --\n";
// The whole point of a discount: it must come off here too, not only on the
// shop page.
[$lines, $total] = $add([['name' => 'Hoodie', 'quantity' => 1]]);
check('discounted unit', $lines[0]['unitPrice'], 1500);
check('discounted total', $total, 1500);

echo "\n-- variant price deltas --\n";
[$lines, $total] = $add([['name' => 'Cap', 'quantity' => 2,
    'options' => [['name' => 'Size', 'choice' => 'XL']]]]);
check('delta added to unit', $lines[0]['unitPrice'], 650);
check('delta times quantity', $total, 1300);
check('choice recorded',      $lines[0]['options'][0]['choice'], 'XL');

echo "\n-- the client cannot set the price --\n";
// Every one of these is a figure supplied by the request. None may survive.
[$lines, $total] = $add([[
    'name' => 'Tee', 'quantity' => 1,
    'price' => 'KES 1', 'unitPrice' => 1, 'amount' => 1,
    'discount' => ['enabled' => true, 'type' => 'percent', 'value' => 99],
]]);
check('sent price ignored',    $lines[0]['unitPrice'], 1000);
check('sent amount ignored',   $lines[0]['amount'], 1000);
check('sent discount ignored', $total, 1000);

echo "\n-- quantity is bounded --\n";
[$lines] = $add([['name' => 'Tee', 'quantity' => 9999]]);
check('quantity capped at 20', $lines[0]['quantity'], 20);
[$lines] = $add([['name' => 'Tee', 'quantity' => -5]]);
check('negative becomes 1',    $lines[0]['quantity'], 1);
// A negative quantity that survived would SUBTRACT from the total — a basket
// that pays the buyer.
[, $total] = $add([['name' => 'Tee', 'quantity' => 1], ['name' => 'Hoodie', 'quantity' => -3]]);
check('no line can reduce the total', $total > 0, true);

echo "\n-- what is not on offer is not sold --\n";
[$lines, $total] = $add([['name' => 'Ferrari', 'quantity' => 1]]);
check('unknown product dropped', count($lines), 0);
check('unknown adds nothing',    $total, 0);

// An open-amount product is a donation with a buyer-named figure; as a bolt-on
// line with a quantity it has no meaningful price at all.
[$lines, $total] = $add([['name' => 'Support', 'quantity' => 3]]);
check('donation not addable', count($lines), 0);
check('donation adds nothing', $total, 0);

// A product in the catalogue but NOT offered by this event must not be
// purchasable through that event's checkout.
$other = merch_normalise(['name' => 'Secret', 'price' => 'KES 9,000'], $products);
store_write('merch', ['products' => array_merge($products, [$other]), 'promoCodes' => []]);
[$lines, $total] = $add([['name' => 'Secret', 'quantity' => 1]]);
check('product not on this event is dropped', count($lines), 0);
check('and adds nothing',                     $total, 0);

echo "\n-- several lines --\n";
[$lines, $total] = $add([
    ['name' => 'Tee', 'quantity' => 2],                                        // 2000
    ['name' => 'Hoodie', 'quantity' => 1],                                     // 1500
    ['name' => 'Cap', 'quantity' => 1, 'options' => [['name' => 'Size', 'choice' => 'S']]], // 500
]);
check('three lines', count($lines), 3);
check('total is the sum', $total, 4000);

echo "\n$pass passed, $fail failed\n";
exit($fail === 0 ? 0 : 1);
