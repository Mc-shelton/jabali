<?php
// Exercises the schema engine directly. clean_string normally comes from
// _bootstrap.php, which starts a session; stub it so this runs standalone.
declare(strict_types=1);

function clean_string($value, int $maxLen = 500): string
{
    if (!is_string($value)) return '';
    $value = trim($value);
    $value = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', $value);
    return mb_substr($value, 0, $maxLen);
}

$API = __DIR__ . '/../public/api';
require "$API/_schema.php";
require "$API/_sections.php";

$pass = 0; $fail = 0;
function check(string $name, $got, $want) {
    global $pass, $fail;
    if ($got === $want) { $pass++; echo "  ok   $name\n"; return; }
    $fail++;
    echo "  FAIL $name\n       got:  " . json_encode($got) . "\n       want: " . json_encode($want) . "\n";
}

$contact = content_section('contact')['fields'];
$social  = content_section('social')['fields'];
$members = content_section('members')['fields'];

echo "\n-- round trip --\n";
$in = [
    'intro' => ['title' => 'Contact & Booking', 'lead' => 'Lead text.', 'note' => 'Note text.'],
    'items' => [['label' => 'Email', 'value' => 'a@b.com']],
];
check('preserves valid input', normalise_fields($contact, $in), $in);

echo "\n-- guard rails --\n";
check('title truncated to 60',
    mb_strlen(normalise_fields($contact, ['intro' => ['title' => str_repeat('x', 200)]])['intro']['title']),
    60);

// A dangerous scheme must never reach an href. It nulls out, which is also how
// social.js already signals "hide this platform" — so the link simply vanishes.
foreach (['javascript:alert(1)', 'data:text/html,<script>', 'vbscript:x'] as $bad) {
    check("dangerous scheme dropped ($bad)",
        normalise_fields($social, ['links' => [['id' => 'x', 'label' => 'X', 'url' => $bad]]])['links'][0]['url'],
        null);
}

check('http url kept',
    normalise_fields($social, ['links' => [['id' => 'yt', 'label' => 'YouTube', 'url' => 'https://youtube.com/@x']]])['links'][0]['url'],
    'https://youtube.com/@x');

check('relative url kept',
    normalise_fields($members, ['members' => [['name' => 'A', 'photo' => '/uploads/members/a.jpg']]])['members'][0]['photo'],
    '/uploads/members/a.jpg');

check('nullable empty url → null',
    normalise_fields($social, ['links' => [['id' => 'ig', 'label' => 'Instagram', 'url' => '']]])['links'][0]['url'],
    null);

check('control chars stripped',
    normalise_fields($contact, ['intro' => ['title' => "Con\x00tact"]])['intro']['title'],
    'Contact');

echo "\n-- list hygiene --\n";
check('blank rows dropped',
    normalise_fields($contact, ['items' => [
        ['label' => 'Email', 'value' => 'a@b.com'],
        ['label' => '', 'value' => ''],
        ['label' => 'Phone', 'value' => '+254'],
    ]])['items'],
    [['label' => 'Email', 'value' => 'a@b.com'], ['label' => 'Phone', 'value' => '+254']]);

check('maxItems capped',
    count(normalise_fields($contact, ['items' => array_fill(0, 50, ['label' => 'L', 'value' => 'V'])])['items']),
    12);

echo "\n-- shape --\n";
check('unknown keys stripped',
    array_keys(normalise_fields($contact, ['items' => [], 'intro' => [], 'evil' => 'x'])),
    ['intro', 'items']);

check('hydrate empty gives full shape',
    schema_hydrate($contact, []),
    ['intro' => ['title' => '', 'lead' => '', 'note' => ''], 'items' => []]);

check('non-array stored hydrates',
    schema_hydrate($social, null),
    ['links' => []]);

echo "\n-- every seed round-trips unchanged --\n";
// The most important check in this file: if a seed survives normalise_fields()
// byte-identical, deploying the content engine changes nothing on the site.
foreach (content_sections() as $name => $schema) {
    $path = "$API/data/content_$name.json";
    if (!is_file($path)) {
        echo "  FAIL $name has no seed file\n";
        $fail++;
        continue;
    }
    $raw = json_decode(file_get_contents($path), true);
    check("$name seed is stable", normalise_fields($schema['fields'], $raw), $raw);
}

echo "\n-- every section is reachable from the schema --\n";
foreach (content_sections() as $name => $schema) {
    check("$name declares fields", !empty($schema['fields']), true);
    check("$name has a label", !empty($schema['label']), true);
}

echo "\n$pass passed, $fail failed\n";
exit($fail > 0 ? 1 : 0);
