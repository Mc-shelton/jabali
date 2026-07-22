<?php
// The property under test: an enquiry submitted from the website reaches the
// chorale in a form they can read and reply to, and a hostile submission
// cannot use it to send something else.
//
// Real failure this guards: every "get in touch" route on the site — the
// partnerships CTA, the events CTA, the join form — used to dead-end at a
// mailto: link or a plain address, which does nothing at all on a phone.
declare(strict_types=1);

$tmp = sys_get_temp_dir() . '/jc-enquiry-' . bin2hex(random_bytes(4));
mkdir($tmp . '/logs', 0775, true);
define('DATA_DIR', $tmp);
require __DIR__ . '/../public/api/_log.php';

const MAIL = [
    'from_email' => 'tickets@jabalichorale.com',
    'from_name'  => 'Jabali Chorale',
    'bcc'        => 'archive@jabalichorale.com',
];

require __DIR__ . '/../public/api/_mailer.php';

$pass = 0; $fail = 0;
function check(string $name, $got, $want) {
    global $pass, $fail;
    if ($got === $want) { $pass++; echo "  ok   $name\n"; return; }
    $fail++;
    echo "  FAIL $name\n       got:  " . var_export($got, true) . "\n       want: " . var_export($want, true) . "\n";
}

$enquiry = [
    'id'      => 'a1b2c3',
    'topic'   => 'partnership',
    'heading' => 'New partnership enquiry',
    'subject' => 'New partnership enquiry — Grace Wanjiru',
    'name'    => 'Grace Wanjiru',
    'email'   => 'grace@example.org',
    'fields'  => [
        'Enquiry type' => 'Partnership',
        'Name'         => 'Grace Wanjiru',
        'Email'        => 'grace@example.org',
        'Organisation / church' => 'Nairobi Chapel',
    ],
    'message'     => "First line.\nSecond line.",
    'submittedAt' => 'Tue 22 Jul 2026, 14:30',
];

// --- the recipient ----------------------------------------------------------
// ENQUIRY_TO is deliberately undefined here, reproducing a config.php written
// before the form existed. An unconfigured server must still deliver.
check('falls back to the chorale inbox', enquiry_recipient(), 'jabalichorale@gmail.com');

// --- the message the chorale receives ---------------------------------------
$html = enquiry_email_html($enquiry);

check('carries the sender name',   str_contains($html, 'Grace Wanjiru'), true);
check('carries the organisation',  str_contains($html, 'Nairobi Chapel'), true);
check('carries the topic',         str_contains($html, 'Partnership'), true);
check('carries the message',       str_contains($html, 'First line.'), true);
// A paragraph break the person typed should survive into the inbox rather than
// collapsing the whole message onto one line.
check('keeps the line break',      str_contains($html, '<br'), true);

// --- Reply-To is the enquirer, From is not ----------------------------------
// From must stay on our own domain: a From carrying someone else's address
// fails SPF and puts the whole message in spam. Reply still has to reach them,
// so that goes in Reply-To.
$mime = build_mime($enquiry['subject'], $html, null, null, $enquiry['email']);
$header = fn(string $name) => implode('|', array_filter(
    $mime['headers'],
    fn($h) => str_starts_with($h, $name . ':')
));

check('From is our own domain',  str_contains($header('From'), 'tickets@jabalichorale.com'), true);
check('From is not the sender',  str_contains($header('From'), 'grace@example.org'), false);
check('Reply-To is the sender',  str_contains($header('Reply-To'), 'grace@example.org'), true);
check('subject names the topic', $mime['subject'], 'New partnership enquiry — Grace Wanjiru');

// A Reply-To is only useful if it's an address. Anything else must fall back to
// ours rather than emitting a header the mail server will reject.
$bad = build_mime('x', '<p>x</p>', null, null, 'not an address');
$badReplyTo = implode('|', array_filter($bad['headers'], fn($h) => str_starts_with($h, 'Reply-To:')));
check('invalid Reply-To falls back', str_contains($badReplyTo, 'tickets@jabalichorale.com'), true);

// --- injection --------------------------------------------------------------
// Every field is attacker-controlled. Markup in one must not become markup in
// the email, or a submission could forge content in the chorale's inbox.
$hostile = $enquiry;
$hostile['name'] = '<script>alert(1)</script>';
$hostile['fields']['Name'] = '<script>alert(1)</script>';
$hostile['message'] = '<img src=x onerror=alert(1)>';
$hostileHtml = enquiry_email_html($hostile);

check('script tag escaped',  str_contains($hostileHtml, '<script>'), false);
check('img tag escaped',     str_contains($hostileHtml, '<img src=x'), false);
check('escaped text is kept', str_contains($hostileHtml, '&lt;script&gt;'), true);

// --- SMTP-carriable ---------------------------------------------------------
// SMTP refuses lines longer than 1000 octets; the inline-styled markup here is
// past that on its own, so the part has to be base64 with chunk_split.
$longest = 0;
foreach (preg_split('/\r\n|\n/', $mime['body']) as $line) {
    $longest = max($longest, strlen($line));
}
check('no body line exceeds SMTP limit', $longest < 998, true);
check('html part is base64', str_contains($mime['body'], 'Content-Transfer-Encoding: base64'), true);

// --- never throws -----------------------------------------------------------
// With no transport configured this must report and return false. An enquiry
// is stored before it is sent, so a delivery failure is recoverable — an
// exception escaping into the endpoint would turn it into a 500 and tell the
// visitor to send their message again.
$threw = false;
try {
    $sent = send_enquiry_email($enquiry);
} catch (Throwable $e) {
    $threw = true;
}
check('never throws when no transport', $threw, false);

echo "\n$pass passed, $fail failed\n";
exit($fail === 0 ? 0 : 1);
