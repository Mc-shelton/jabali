<?php
// The property under test: moving merchandise into a shared catalogue must not
// change what an event offers for sale, and must not change what anything is
// priced at.
//
// The risk this guards is quiet: if resolution drops a product, the event page
// simply shows one fewer card and the checkout answers "no longer available".
// Nothing errors, nothing is logged, and the first sign is a sale that didn't
// happen.
declare(strict_types=1);

$tmp = sys_get_temp_dir() . '/jc-merch-' . bin2hex(random_bytes(4));
mkdir($tmp . '/logs', 0775, true);
define('DATA_DIR', $tmp);

// The two bootstrap helpers _merch.php actually uses.
function clean_string($value, int $maxLen = 500): string {
    if (!is_string($value)) return '';
    $value = trim($value);
    $value = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', $value);
    return mb_substr($value, 0, $maxLen);
}
function slugify(string $value): string {
    $value = mb_strtolower(trim($value));
    $value = preg_replace('/[^a-z0-9]+/', '-', $value);
    $value = trim($value, '-');
    return $value !== '' ? $value : 'item-' . substr(bin2hex(random_bytes(4)), 0, 6);
}
function store_read(string $name, $default = []) {
    $path = DATA_DIR . '/' . $name . '.json';
    if (!is_file($path)) return $default;
    return json_decode(file_get_contents($path) ?: 'null', true) ?? $default;
}
function store_write(string $name, $data): void {
    file_put_contents(DATA_DIR . '/' . $name . '.json', json_encode($data));
}

require __DIR__ . '/../public/api/_merch.php';

$pass = 0; $fail = 0;
function check(string $name, $got, $want) {
    global $pass, $fail;
    if ($got === $want) { $pass++; echo "  ok   $name\n"; return; }
    $fail++;
    echo "  FAIL $name\n       got:  " . json_encode($got) . "\n       want: " . json_encode($want) . "\n";
}

$hoodie = [
    'name'  => 'Classic Hoodie',
    'price' => 'KES 2,500',
    'options' => [[
        'name' => 'Size', 'required' => true,
        'choices' => [
            ['label' => 'M', 'priceDelta' => 0],
            ['label' => 'XL', 'priceDelta' => 200],
        ],
    ]],
];

echo "\n-- ids are stable across renames --\n";
// Events point at ids. If an id were re-derived from the name on every save, a
// typo fix would silently unlink the product from every event selling it.
$products = [];
$p1 = merch_normalise($hoodie, $products);
check('id from the name', $p1['id'], 'classic-hoodie');

$products[] = $p1;
$renamed = merch_normalise(['name' => 'Classic Hoodie 2026', 'price' => 'KES 2,500'], $products, $p1);
check('rename keeps the id',  $renamed['id'],   'classic-hoodie');
check('rename changes the name', $renamed['name'], 'Classic Hoodie 2026');
check('createdAt is preserved',  $renamed['createdAt'], $p1['createdAt']);

echo "\n-- two products with the same name get distinct ids --\n";
$dup = merch_normalise(['name' => 'Classic Hoodie', 'price' => 'KES 100'], $products);
check('second gets a suffix', $dup['id'], 'classic-hoodie-2');

echo "\n-- resolution --\n";
store_write('merch', ['products' => [$p1], 'promoCodes' => []]);

$resolved = merch_resolve_for_event(['merchIds' => ['classic-hoodie']]);
check('one product resolved',   count($resolved), 1);
check('name survives',          $resolved[0]['name'],  'Classic Hoodie');
check('price survives',         $resolved[0]['price'], 'KES 2,500');
// Pricing reads options off the resolved item, so a lost priceDelta silently
// undercharges every XL sold.
check('option delta survives',  $resolved[0]['options'][0]['choices'][1]['priceDelta'], 200);

check('unknown id is skipped',  count(merch_resolve_for_event(['merchIds' => ['ghost']])), 0);
check('no ids resolves empty',  count(merch_resolve_for_event([])), 0);
check('duplicate ids collapse', count(merch_resolve_for_event(['merchIds' => ['classic-hoodie', 'classic-hoodie']])), 1);

echo "\n-- events saved before the catalogue keep selling --\n";
// The live server owns its own data and is not redeployed with ours, so events
// arrive still carrying inline products. Those must keep working untouched.
$legacy = merch_resolve_for_event(['merch' => [['name' => 'Old Tee', 'price' => 'KES 700']]]);
check('legacy item resolved',   count($legacy), 1);
check('legacy name survives',   $legacy[0]['name'], 'Old Tee');
check('legacy is marked',       str_starts_with($legacy[0]['id'], 'legacy:'), true);

// A half-migrated event holds the id AND the old inline copy. It must offer the
// product once, not twice.
$half = merch_resolve_for_event([
    'merchIds' => ['classic-hoodie'],
    'merch'    => [['name' => 'Classic Hoodie', 'price' => 'KES 2,500']],
]);
check('half-migrated shows once', count($half), 1);
check('the catalogue copy wins',  $half[0]['id'], 'classic-hoodie');

// Mixed: one migrated, one not. Both must be on sale.
$mixed = merch_resolve_for_event([
    'merchIds' => ['classic-hoodie'],
    'merch'    => [['name' => 'Old Tee', 'price' => 'KES 700']],
]);
check('mixed offers both', count($mixed), 2);

echo "\n-- empty rows are not stored --\n";
check('blank is empty',        merch_is_empty(merch_public_fields([])), true);
check('named is not empty',    merch_is_empty(merch_public_fields(['name' => 'Tee'])), false);
// A donation has no fixed price but is still a real product.
check('open amount is not empty',
    merch_is_empty(merch_public_fields(['openAmount' => ['enabled' => true, 'min' => 10]])), false);

echo "\n-- merch promo codes --\n";
store_write('merch', ['products' => [$p1], 'promoCodes' => [
    ['code' => 'choir10', 'type' => 'percent', 'value' => 10],
    ['code' => '', 'type' => 'flat', 'value' => 50],      // no code — dropped
    ['code' => 'ZERO', 'type' => 'flat', 'value' => 0],   // no value — dropped
]]);
$codes = merch_promo_codes();
check('invalid codes dropped', count($codes), 1);
check('code is upper-cased',   $codes[0]['code'], 'CHOIR10');
check('type survives',         $codes[0]['type'], 'percent');

$clean = merch_clean_promos([['code' => 'flat50', 'type' => 'flat', 'value' => 50]]);
check('flat type survives',    $clean[0]['type'], 'flat');
check('unknown type becomes percent',
    merch_clean_promos([['code' => 'X', 'type' => 'nonsense', 'value' => 5]])[0]['type'], 'percent');

echo "\n-- a bare array still reads as products --\n";
store_write('merch', [$p1]);
check('legacy store shape works', count(merch_load()), 1);
check('no promos in that shape',  count(merch_promo_codes()), 0);

echo "\n$pass passed, $fail failed\n";
exit($fail === 0 ? 0 : 1);
