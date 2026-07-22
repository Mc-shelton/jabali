<?php
// Dependency-free PDF e-ticket. No Composer / FPDF — the file is emitted by
// hand, which keeps the deploy a plain FTP copy with nothing to install.
//
// The QR is drawn as vector rectangles rather than an embedded image: no image
// object, no filters, and it stays sharp at any zoom or print size, which is
// what a phone camera at a dim venue door needs.

declare(strict_types=1);

require_once __DIR__ . '/_qr.php';

// Escape text for a PDF string literal.
function pdf_esc(string $s): string
{
    // PDF standard fonts are Latin-1; drop anything outside it so the file stays valid.
    $s = @iconv('UTF-8', 'ISO-8859-1//TRANSLIT//IGNORE', $s);
    return str_replace(['\\', '(', ')'], ['\\\\', '\\(', '\\)'], (string) $s);
}

// One line of text. $font is 'H' for bold, anything else for regular.
function pdf_text(string $text, string $font, float $size, float $x, float $y, array $rgb): string
{
    if ($text === '') return '';

    return sprintf(
        "BT %s %.1f Tf %.3f %.3f %.3f rg %.1f %.1f Td (%s) Tj ET\n",
        $font === 'H' ? '/F2' : '/F1',
        $size, $rgb[0], $rgb[1], $rgb[2], $x, $y, pdf_esc($text)
    );
}

function pdf_rect(float $x, float $y, float $w, float $h, array $rgb): string
{
    return sprintf("%.3f %.3f %.3f rg %.1f %.1f %.1f %.1f re f\n", $rgb[0], $rgb[1], $rgb[2], $x, $y, $w, $h);
}

// Draws the QR with its origin at the bottom-left. PDF's y axis points up while
// the matrix runs top-down, so rows are flipped here.
//
// Every dark module is appended to one path and filled in a single operation —
// a 21x21 symbol is up to 441 rectangles, and one fill keeps the stream small.
function pdf_qr(array $matrix, float $x, float $y, float $size): string
{
    $n = count($matrix);
    $m = $size / $n;

    $ops = "0 0 0 rg\n";
    for ($r = 0; $r < $n; $r++) {
        for ($c = 0; $c < $n; $c++) {
            if ($matrix[$r][$c] !== 1) continue;
            // +0.02 overlaps neighbours very slightly: without it some viewers
            // antialias a hairline gap between modules, which readers see as a
            // broken pattern.
            $ops .= sprintf("%.2f %.2f %.2f %.2f re\n", $x + $c * $m, $y + ($n - 1 - $r) * $m, $m + 0.02, $m + 0.02);
        }
    }
    return $ops . "f\n";
}

// Build the PDF and return the raw bytes.
function pdf_ticket(array $order): string
{
    $navy  = [0.09, 0.29, 0.48];
    $ink   = [0.05, 0.11, 0.16];
    $muted = [0.35, 0.41, 0.46];
    $brass = [0.80, 0.48, 0.00];
    $rule  = [0.87, 0.89, 0.91];

    $code   = (string) ($order['ticketCode'] ?? '');
    $isTicket = ($order['itemType'] ?? 'ticket') !== 'merch';

    $W = 595.0;                       // A4
    $L = 56.0;                        // left margin
    $R = $W - 56.0;                   // right edge

    $c = '';

    // Brass band across the head, and a hairline frame holding the page together.
    $c .= pdf_rect(0, 818, $W, 24, $brass);
    $c .= sprintf("%.3f %.3f %.3f RG 0.7 w %.1f %.1f %.1f %.1f re S\n",
        $rule[0], $rule[1], $rule[2], 32, 32, $W - 64, 770);

    $c .= pdf_text('JABALI CHORALE', 'H', 21, $L, 762, $navy);
    $c .= pdf_text($isTicket ? 'E - T I C K E T' : 'R E C E I P T', 'H', 9, $L, 742, $brass);

    $c .= sprintf("%.3f %.3f %.3f RG 0.7 w %.1f %.1f m %.1f %.1f l S\n", $rule[0], $rule[1], $rule[2], $L, 728, $R, 728);

    // Event.
    $c .= pdf_text((string) ($order['eventTitle'] ?? ''), 'H', 23, $L, 690, $ink);

    $date = $order['eventDate'] ?? '';
    $when = $date ? date('l, j F Y', strtotime((string) $date)) : '';
    $venue = (string) ($order['eventVenue'] ?? '');
    $sub = trim($when . ($when && $venue ? '   ·   ' : '') . $venue);
    $c .= pdf_text($sub, 'R', 11.5, $L, 670, $muted);

    // Detail column on the left, QR on the right. Labels sit above values so the
    // two columns stay legible when a value runs long.
    $rows = [];
    $rows[] = ['ADMITS', ($order['quantity'] ?? 1) . ' x ' . ($order['itemName'] ?? '')];

    $optionBits = [];
    foreach ((array) ($order['options'] ?? []) as $opt) {
        $optionBits[] = ($opt['name'] ?? '') . ': ' . ($opt['choice'] ?? '');
    }
    if ($optionBits) $rows[] = ['OPTIONS', implode('   ·   ', $optionBits)];

    $rows[] = ['AMOUNT PAID', 'KES ' . number_format((int) ($order['amount'] ?? 0))];

    $buyer = trim(($order['customer']['preferredName'] ?? '') . ' ' . ($order['customer']['otherNames'] ?? ''));
    if ($buyer !== '') $rows[] = ['ISSUED TO', $buyer];
    if (!empty($order['receipt'])) $rows[] = ['M-PESA RECEIPT', (string) $order['receipt']];

    $y = 610;
    foreach ($rows as [$label, $value]) {
        $c .= pdf_text($label, 'H', 8, $L, $y, $muted);
        $c .= pdf_text((string) $value, 'R', 13, $L, $y - 18, $ink);
        $y -= 46;
    }

    // The QR, with the ticket code repeated beneath it. The code is printed in
    // full because a scanner is not guaranteed: a damaged phone camera, a dark
    // doorway or a creased printout all end with someone typing it in.
    if ($code !== '' && $isTicket) {
        $qrSize = 150.0;
        $qrX = $R - $qrSize;
        $qrY = 470.0;

        try {
            $matrix = qr_encode($code);

            // A quiet zone is part of the symbol, not decoration — without four
            // clear modules on every side, readers fail to find the pattern.
            $quiet = ($qrSize / count($matrix)) * 4;
            $c .= pdf_rect($qrX - $quiet, $qrY - $quiet, $qrSize + $quiet * 2, $qrSize + $quiet * 2, [1, 1, 1]);
            $c .= pdf_qr($matrix, $qrX, $qrY, $qrSize);
            $c .= pdf_text('SCAN AT ENTRY', 'H', 8, $qrX, $qrY - $quiet - 14, $muted);
        } catch (Throwable $e) {
            // A code outside the encoder's range must not cost the buyer their
            // ticket — the printed code below is still valid at the door.
            $c .= pdf_text('(code below is valid at entry)', 'R', 9, $qrX, $qrY, $muted);
        }
    }

    // Ticket code, given the weight it earns as the thing actually checked.
    $c .= sprintf("%.3f %.3f %.3f RG 0.7 w %.1f %.1f m %.1f %.1f l S\n", $rule[0], $rule[1], $rule[2], $L, 430, $R, 430);
    $c .= pdf_text('TICKET CODE', 'H', 8, $L, 405, $muted);
    $c .= pdf_text($code, 'H', 32, $L, 368, $brass);

    $c .= pdf_text('Present this code at entry. Keep it safe.', 'R', 10.5, $L, 330, $muted);
    $c .= pdf_text('Jabali Chorale  ·  Nairobi, Kenya', 'R', 9, $L, 56, $muted);

    // Assemble the objects with a correct xref table.
    $objects = [];
    $objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
    $objects[2] = "<< /Type /Pages /Kids [3 0 R] /Count 1 >>";
    $objects[3] = "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] "
        . "/Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> /Contents 4 0 R >>";
    $objects[4] = "<< /Length " . strlen($c) . " >>\nstream\n" . $c . "endstream";
    $objects[5] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";
    $objects[6] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>";

    $pdf = "%PDF-1.4\n";
    $offsets = [];
    foreach ($objects as $num => $body) {
        $offsets[$num] = strlen($pdf);
        $pdf .= "$num 0 obj\n$body\nendobj\n";
    }

    $xrefPos = strlen($pdf);
    $count = count($objects) + 1;
    $pdf .= "xref\n0 $count\n0000000000 65535 f \n";
    for ($i = 1; $i < $count; $i++) {
        $pdf .= sprintf("%010d 00000 n \n", $offsets[$i]);
    }
    $pdf .= "trailer\n<< /Size $count /Root 1 0 R >>\nstartxref\n$xrefPos\n%%EOF";

    return $pdf;
}
