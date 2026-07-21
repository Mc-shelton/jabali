<?php
// Minimal, dependency-free PDF e-ticket generator. No Composer / FPDF needed —
// it emits a single-page PDF by hand. Enough for a clean text ticket with a
// border, the event details, the buyer, and a scannable reference code.

declare(strict_types=1);

// Escape text for a PDF string literal.
function pdf_esc(string $s): string
{
    // PDF standard fonts are Latin-1; drop anything outside it so the file stays valid.
    $s = @iconv('UTF-8', 'ISO-8859-1//TRANSLIT//IGNORE', $s);
    return str_replace(['\\', '(', ')'], ['\\\\', '\\(', '\\)'], (string) $s);
}

// Build the PDF and return the raw bytes.
function pdf_ticket(array $order): string
{
    $code = $order['ticketCode'] ?? '';
    $lines = [];
    $lines[] = ['JABALI CHORALE', 'H', 26, 0.09, 0.29, 0.48];
    $lines[] = [strtoupper(($order['itemType'] ?? 'ticket') === 'merch' ? 'Purchase Receipt' : 'E-Ticket'), 'H', 12, 0.80, 0.48, 0.0];
    $lines[] = ['', 'H', 8, 0, 0, 0];
    $lines[] = [$order['eventTitle'] ?? '', 'H', 18, 0.05, 0.11, 0.16];

    $date = $order['eventDate'] ?? '';
    $when = $date ? date('l, j F Y', strtotime($date)) : '';
    if ($when) $lines[] = [$when . (($order['eventVenue'] ?? '') ? '  ·  ' . $order['eventVenue'] : ''), 'R', 11, 0.35, 0.41, 0.46];

    $lines[] = ['', 'H', 10, 0, 0, 0];
    $lines[] = [($order['quantity'] ?? 1) . ' x ' . ($order['itemName'] ?? ''), 'H', 14, 0.05, 0.11, 0.16];

    // Chosen variant, so the ticket matches what was actually bought.
    $optionBits = [];
    foreach ((array) ($order['options'] ?? []) as $opt) {
        $optionBits[] = ($opt['name'] ?? '') . ': ' . ($opt['choice'] ?? '');
    }
    if ($optionBits) {
        $lines[] = [implode('  ·  ', $optionBits), 'R', 11, 0.35, 0.41, 0.46];
    }

    $lines[] = ['Amount paid: KES ' . number_format((int) ($order['amount'] ?? 0)), 'R', 12, 0.05, 0.11, 0.16];

    $buyer = trim(($order['customer']['preferredName'] ?? '') . ' ' . ($order['customer']['otherNames'] ?? ''));
    if ($buyer) $lines[] = ['Issued to: ' . $buyer, 'R', 11, 0.35, 0.41, 0.46];
    if (!empty($order['receipt'])) $lines[] = ['M-Pesa receipt: ' . $order['receipt'], 'R', 11, 0.35, 0.41, 0.46];

    $lines[] = ['', 'H', 14, 0, 0, 0];
    $lines[] = ['TICKET CODE', 'R', 10, 0.35, 0.41, 0.46];
    $lines[] = [$code, 'H', 30, 0.80, 0.48, 0.0];
    $lines[] = ['', 'H', 10, 0, 0, 0];
    $lines[] = ['Present this code at entry. Keep it safe.', 'R', 10, 0.35, 0.41, 0.46];

    // Content stream: a rounded-ish border + text lines flowing down the page.
    $c = "0.85 0.87 0.90 RG 1 w\n";               // light border stroke
    $c .= "40 40 515 762 re S\n";                  // border rectangle (A4-ish)
    $c .= "0.80 0.48 0.0 rg 40 792 515 10 re f\n"; // brass accent bar at top

    $y = 720;
    foreach ($lines as [$text, $font, $size, $r, $g, $b]) {
        if ($text !== '') {
            $fontRef = $font === 'H' ? '/F2' : '/F1'; // F2 = bold, F1 = regular
            $c .= sprintf("BT %s %d Tf %.2f %.2f %.2f rg 70 %d Td (%s) Tj ET\n", $fontRef, $size, $r, $g, $b, $y, pdf_esc($text));
        }
        $y -= (int) ($size * 1.7);
    }

    // Assemble the PDF objects with a correct xref table.
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
