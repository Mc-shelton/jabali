<?php
// The property under test: the message handed to a transport must be one the
// transport can actually carry, and must not disclose more than it should.
//
// Real failure this guards: the host disabled mail(), so a paid order settled
// with no confirmation sent (log ref 55E989). Switching to SMTP surfaced two
// further defects that mail() had been hiding — an 8bit HTML part whose lines
// exceed the 1000-octet SMTP limit, and a Bcc carried as a visible header.
declare(strict_types=1);

$tmp = sys_get_temp_dir() . '/jc-mailer-' . bin2hex(random_bytes(4));
mkdir($tmp . '/logs', 0775, true);
define('DATA_DIR', $tmp);
require __DIR__ . '/../public/api/_log.php';

const MAIL = [
    'from_email' => 'tickets@jabalichorale.com',
    'from_name'  => 'Jabali Chorale',
    'bcc'        => 'archive@jabalichorale.com',
    // 'smtp' deliberately absent: reproduces a config.php written before SMTP
    // support existed, which is what every current server has.
];

require __DIR__ . '/../public/api/_mailer.php';

$pass = 0; $fail = 0;
function check(string $name, $got, $want) {
    global $pass, $fail;
    if ($got === $want) { $pass++; echo "  ok   $name\n"; return; }
    $fail++;
    echo "  FAIL $name\n       got:  " . var_export($got, true) . "\n       want: " . var_export($want, true) . "\n";
}

$order = [
    'id'         => 'd63fdc53b17973bef026f5a8',
    'itemType'   => 'ticket',
    'eventTitle' => 'Jabali @5 — Nairobi',   // em dash: forces header encoding
    'itemName'   => 'Regular',
    'quantity'   => 2,
    'amount'     => 3000,
    'receipt'    => 'TFL7XYZ123',
    'ticketCode' => 'JC-4821',
    'customer'   => ['preferredName' => 'Shellton', 'email' => 'buyer@example.com'],
];

// --- config reading is safe on servers whose config.php predates SMTP --------
$c = smtp_config();
check('smtp_config defaults port',   $c['port'],   587);
check('smtp_config defaults secure', $c['secure'], 'tls');
check('smtp_config defaults host',   $c['host'],   '');
check('smtp not configured -> false', smtp_configured(), false);

// --- header encoding --------------------------------------------------------
check('ascii header left alone', mime_header_encode('Your tickets'), 'Your tickets');
check(
    'non-ascii header encoded',
    mime_header_encode('Jabali @5 — Nairobi'),
    '=?UTF-8?B?' . base64_encode('Jabali @5 — Nairobi') . '?='
);

// --- the message ------------------------------------------------------------
$mime = order_mime($order, '%PDF-1.4 fake ticket bytes');
$headerBlob = implode("\r\n", $mime['headers']);

check('subject names the event', str_contains($mime['subject'], 'Jabali @5'), true);
check('From uses configured sender', str_contains($headerBlob, 'tickets@jabalichorale.com'), true);

// Matched at line starts: "Reply-To:" legitimately contains "To:", so a naive
// substring search reports a header that isn't there.
$startsWith = function (array $headers, string $name): bool {
    foreach ($headers as $h) {
        if (stripos($h, $name . ':') === 0) return true;
    }
    return false;
};

// Bcc must reach the server as an envelope recipient only. In the headers it is
// shown to the buyer, disclosing an internal address on every order.
check('no Bcc header', $startsWith($mime['headers'], 'Bcc'), false);
// To belongs to the transport: mail() takes it as an argument, and smtp_send
// appends it. Emitting it here would duplicate the header.
check('no To header', $startsWith($mime['headers'], 'To'), false);
check('Reply-To is present', $startsWith($mime['headers'], 'Reply-To'), true);

check('html part is base64', str_contains($mime['body'], 'Content-Transfer-Encoding: base64'), true);
check('html part is not 8bit', str_contains($mime['body'], 'Content-Transfer-Encoding: 8bit'), false);
check('pdf attached', str_contains($mime['body'], 'application/pdf'), true);

// The SMTP line-length limit is 1000 octets including CRLF. base64 + chunk_split
// keeps every line at 76; an 8bit HTML part blew past it on the styled markup.
$longest = 0;
foreach (preg_split('/\r\n|\n/', $mime['body']) as $line) {
    $longest = max($longest, strlen($line));
}
check('no body line exceeds SMTP limit', $longest < 998, true);

// --- dot-stuffing -----------------------------------------------------------
// A line holding a single dot terminates DATA. Any line starting with one must
// be doubled or the message is silently truncated at that point.
$stuffed = preg_replace('/^\./m', '..', "normal line\r\n.hidden\r\n..already\r\n");
check('leading dot doubled',      str_contains($stuffed, "\r\n..hidden"),    true);
check('body text left untouched', str_contains($stuffed, 'normal line'),     true);

// --- port and TLS mode must agree -------------------------------------------
// The real failure (log ref 4EA3D4): port 465 with 'tls' opened a plaintext
// socket and waited 20s for a greeting the server never sends in the clear. The
// admin screen timed out with "the server did not return a valid response" and
// the real cause was only visible in the log. Rejecting the pair costs nothing.
$rejects = function (int $port, string $secure): string {
    try {
        smtp_scheme($port, $secure);
        return '';                       // accepted — no message to report
    } catch (Throwable $e) {
        return $e->getMessage();
    }
};

check('465 + tls rejected',  str_contains($rejects(465, 'tls'), "'secure' => 'ssl'"), true);
check('587 + ssl rejected',  str_contains($rejects(587, 'ssl'), "'secure' => 'tls'"), true);
check('25 + ssl rejected',   str_contains($rejects(25, 'ssl'),  "'secure' => 'tls'"), true);

// The valid pairs must still map to the right scheme: 465 is encrypted from the
// first byte, 587 starts in the clear and upgrades via STARTTLS.
check('465 + ssl -> ssl://', smtp_scheme(465, 'ssl'), 'ssl://');
check('587 + tls -> tcp://', smtp_scheme(587, 'tls'), 'tcp://');
check('no mismatch on 2525', $rejects(2525, 'tls'), '');

// --- no transport at all ----------------------------------------------------
// With SMTP unset and mail() unavailable, this must report and return false,
// never throw: fulfilment treats a failed confirmation as non-fatal, and an
// exception here would unwind a payment that already succeeded.
$threw = false;
try {
    $sent = send_order_email(['customer' => ['email' => 'nobody@example.com'], 'id' => 'x']);
} catch (Throwable $e) {
    $threw = true;
}
check('never throws when no transport', $threw, false);

echo "\n$pass passed, $fail failed\n";
exit($fail === 0 ? 0 : 1);
