<?php
// Dependency-free QR encoder, deliberately narrow: versions 1-2, error
// correction level M, alphanumeric mode, single data block.
//
// That is not a limitation in practice — ticket codes are short and drawn from
// [0-9A-Z-], which is exactly QR's alphanumeric alphabet. Staying inside one
// block avoids the interleaving rules, which is where a hand-written encoder is
// most likely to go quietly wrong.
//
// "Quietly" is the risk worth naming: a malformed QR still renders as a
// plausible-looking square and simply never scans. So qr_encode() refuses
// anything outside its range rather than emitting a best effort, and the tests
// check the output against the standard's own invariants instead of against a
// matrix this file produced.

declare(strict_types=1);

const QR_ALPHANUM = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:';

// [version => [size, total codewords, EC codewords]] at level M, single block.
const QR_VERSIONS = [
    1 => [21, 26, 10],
    2 => [25, 44, 16],
];

// ---------------------------------------------------------------- GF(256)
// Arithmetic for Reed-Solomon, over the field the QR spec fixes: primitive
// polynomial x^8 + x^4 + x^3 + x^2 + 1 (0x11D), generator element 2.
function qr_gf(): array
{
    static $tables = null;
    if ($tables !== null) return $tables;

    $exp = array_fill(0, 512, 0);
    $log = array_fill(0, 256, 0);

    $x = 1;
    for ($i = 0; $i < 255; $i++) {
        $exp[$i] = $x;
        $log[$x] = $i;
        $x <<= 1;
        if ($x & 0x100) $x ^= 0x11D;   // reduce back into the field
    }
    // Doubling the table lets callers add exponents without a modulo.
    for ($i = 255; $i < 512; $i++) $exp[$i] = $exp[$i - 255];

    return $tables = [$exp, $log];
}

function qr_gf_mul(int $a, int $b): int
{
    if ($a === 0 || $b === 0) return 0;
    [$exp, $log] = qr_gf();
    return $exp[$log[$a] + $log[$b]];
}

// The generator polynomial for `n` EC codewords: (x - a^0)(x - a^1)...(x - a^n-1)
function qr_rs_generator(int $n): array
{
    [$exp] = qr_gf();
    $g = [1];

    for ($i = 0; $i < $n; $i++) {
        $next = array_fill(0, count($g) + 1, 0);
        // Coefficients run in descending powers. Multiplying by (x + a^i): the
        // x term shifts each coefficient up a power, the a^i term scales it in
        // place. Swapping these leaves a leading coefficient of a^i instead of
        // 1, and every codeword built from it fails its own roots.
        foreach ($g as $j => $coef) {
            $next[$j]     ^= $coef;
            $next[$j + 1] ^= qr_gf_mul($coef, $exp[$i]);
        }
        $g = $next;
    }
    return $g;
}

// Polynomial division; the remainder is the EC codewords.
function qr_rs_encode(array $data, int $ecCount): array
{
    $gen = qr_rs_generator($ecCount);
    $rem = array_fill(0, $ecCount, 0);

    foreach ($data as $byte) {
        $factor = $byte ^ array_shift($rem);
        $rem[] = 0;
        if ($factor !== 0) {
            foreach ($gen as $i => $coef) {
                if ($i === 0) continue;             // leading term is always 1
                $rem[$i - 1] ^= qr_gf_mul($coef, $factor);
            }
        }
    }
    return $rem;
}

// ---------------------------------------------------------------- bit stream
// Alphanumeric mode packs characters in pairs: two chars share 11 bits, and a
// trailing odd character takes 6. That density is why a ticket code fits in the
// smallest symbol.
function qr_alphanumeric_bits(string $text): array
{
    $bits = [];
    $push = function (int $value, int $length) use (&$bits) {
        for ($i = $length - 1; $i >= 0; $i--) $bits[] = ($value >> $i) & 1;
    };

    $vals = [];
    foreach (str_split($text) as $ch) {
        $v = strpos(QR_ALPHANUM, $ch);
        if ($v === false) {
            throw new RuntimeException("character '$ch' is not valid in QR alphanumeric mode");
        }
        $vals[] = $v;
    }

    $n = count($vals);
    for ($i = 0; $i + 1 < $n; $i += 2) {
        $push($vals[$i] * 45 + $vals[$i + 1], 11);
    }
    if ($n % 2) $push($vals[$n - 1], 6);

    return $bits;
}

// ---------------------------------------------------------------- matrix
function qr_is_function_module(int $size, int $row, int $col, int $version): bool
{
    // Finder patterns with their separators, in three corners.
    if ($row < 9 && $col < 9) return true;
    if ($row < 9 && $col >= $size - 8) return true;
    if ($row >= $size - 8 && $col < 9) return true;

    // Timing patterns.
    if ($row === 6 || $col === 6) return true;

    // Version 2 carries one alignment pattern; version 1 has none.
    if ($version === 2 && $row >= 16 && $row <= 20 && $col >= 16 && $col <= 20) return true;

    return false;
}

function qr_place_finder(array &$m, int $row, int $col): void
{
    for ($r = -1; $r <= 7; $r++) {
        for ($c = -1; $c <= 7; $c++) {
            $rr = $row + $r; $cc = $col + $c;
            if (!isset($m[$rr][$cc])) continue;
            $inRing = ($r >= 0 && $r <= 6 && ($c === 0 || $c === 6))
                   || ($c >= 0 && $c <= 6 && ($r === 0 || $r === 6));
            $inCore = $r >= 2 && $r <= 4 && $c >= 2 && $c <= 4;
            $m[$rr][$cc] = ($inRing || $inCore) ? 1 : 0;
        }
    }
}

function qr_mask(int $pattern, int $row, int $col): bool
{
    switch ($pattern) {
        case 0: return ($row + $col) % 2 === 0;
        case 1: return $row % 2 === 0;
        case 2: return $col % 3 === 0;
        case 3: return ($row + $col) % 3 === 0;
        case 4: return (intdiv($row, 2) + intdiv($col, 3)) % 2 === 0;
        case 5: return (($row * $col) % 2) + (($row * $col) % 3) === 0;
        case 6: return ((($row * $col) % 2) + (($row * $col) % 3)) % 2 === 0;
        default: return ((($row + $col) % 2) + (($row * $col) % 3)) % 2 === 0;
    }
}

// Format information: 2 bits of EC level + 3 bits of mask, protected by a
// BCH(15,5) code and XORed with a fixed mask so an all-zero format is never
// all-zero on the symbol.
function qr_format_bits(int $mask): int
{
    $data = (0b00 << 3) | $mask;         // 0b00 = error correction level M

    // Ten steps of polynomial division. The test is on bit 9 of the value
    // BEFORE the shift — that bit is what lands in the degree-10 position and
    // must be cancelled. Shifting first and testing bit 14 divides by the
    // wrong term and yields a remainder that is not a BCH codeword at all.
    $rem = $data;
    for ($i = 0; $i < 10; $i++) {
        $rem = ($rem << 1) ^ ((($rem >> 9) & 1) * 0b10100110111);
    }

    return (($data << 10) | ($rem & 0x3FF)) ^ 0b101010000010010;
}

function qr_place_format(array &$m, int $size, int $mask): void
{
    $bits = qr_format_bits($mask);

    for ($i = 0; $i < 15; $i++) {
        $bit = ($bits >> $i) & 1;

        // Copy around the top-left finder...
        if ($i < 6)       $m[$i][8] = $bit;
        elseif ($i === 6) $m[7][8] = $bit;
        elseif ($i === 7) $m[8][8] = $bit;
        elseif ($i === 8) $m[8][7] = $bit;
        else              $m[8][14 - $i] = $bit;

        // ...and again split across the other two, so damage to one corner is
        // survivable.
        if ($i < 8) $m[8][$size - 1 - $i] = $bit;
        else        $m[$size - 15 + $i][8] = $bit;
    }

    $m[$size - 8][8] = 1;   // the always-dark module
}

// Penalty scoring, used only to pick between the eight masks. Any mask produces
// a readable symbol; this just prefers the one least likely to confuse a
// scanner. Rules 1-3 of the standard, which carry most of the weight.
function qr_penalty(array $m, int $size): int
{
    $score = 0;

    // Rule 1 — runs of five or more same-coloured modules in a line.
    for ($pass = 0; $pass < 2; $pass++) {
        for ($a = 0; $a < $size; $a++) {
            $run = 1;
            for ($b = 1; $b < $size; $b++) {
                $cur  = $pass ? $m[$b][$a]     : $m[$a][$b];
                $prev = $pass ? $m[$b - 1][$a] : $m[$a][$b - 1];
                if ($cur === $prev) {
                    $run++;
                } else {
                    if ($run >= 5) $score += $run - 2;
                    $run = 1;
                }
            }
            if ($run >= 5) $score += $run - 2;
        }
    }

    // Rule 2 — 2x2 blocks of one colour.
    for ($r = 0; $r < $size - 1; $r++) {
        for ($c = 0; $c < $size - 1; $c++) {
            $v = $m[$r][$c];
            if ($v === $m[$r][$c + 1] && $v === $m[$r + 1][$c] && $v === $m[$r + 1][$c + 1]) {
                $score += 3;
            }
        }
    }

    // Rule 3 — the finder-like 1:1:3:1:1 sequence appearing in the data, which
    // a scanner can mistake for a real finder pattern.
    $needle = [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0];
    for ($pass = 0; $pass < 2; $pass++) {
        for ($a = 0; $a < $size; $a++) {
            for ($b = 0; $b + 11 <= $size; $b++) {
                $hit = true;
                for ($k = 0; $k < 11; $k++) {
                    $v = $pass ? $m[$b + $k][$a] : $m[$a][$b + $k];
                    if ($v !== $needle[$k]) { $hit = false; break; }
                }
                if ($hit) $score += 40;
            }
        }
    }

    return $score;
}

// Returns the QR symbol as a square array of 0/1 rows, without a quiet zone —
// the caller decides the margin, since it depends on the medium.
function qr_encode(string $text): array
{
    $text = strtoupper(trim($text));

    // Pick the smallest version that fits. Refusing to guess beyond version 2
    // keeps this inside the single-block case it was written for.
    $version = null; $totalCw = 0; $ecCw = 0; $size = 0;
    $bits = qr_alphanumeric_bits($text);

    foreach (QR_VERSIONS as $v => [$s, $total, $ec]) {
        $dataBits = ($total - $ec) * 8;
        // 4 bits of mode + 9 bits of character count precede the payload.
        if (13 + count($bits) <= $dataBits) {
            $version = $v; $size = $s; $totalCw = $total; $ecCw = $ec;
            break;
        }
    }
    if ($version === null) {
        throw new RuntimeException('text too long for a version-2 QR symbol: ' . strlen($text) . ' chars');
    }

    $dataCw = $totalCw - $ecCw;

    // Assemble the bit stream: mode, length, payload, terminator, padding.
    $stream = [0, 0, 1, 0];                                  // alphanumeric mode
    for ($i = 8; $i >= 0; $i--) $stream[] = (strlen($text) >> $i) & 1;
    foreach ($bits as $b) $stream[] = $b;

    $capacity = $dataCw * 8;
    for ($i = 0; $i < 4 && count($stream) < $capacity; $i++) $stream[] = 0;
    while (count($stream) % 8 !== 0) $stream[] = 0;

    $codewords = [];
    foreach (array_chunk($stream, 8) as $byte) {
        $codewords[] = (int) bindec(implode('', $byte));
    }
    // Alternating pad bytes fixed by the standard.
    $pads = [0xEC, 0x11];
    for ($i = 0; count($codewords) < $dataCw; $i++) $codewords[] = $pads[$i % 2];

    $all = array_merge($codewords, qr_rs_encode($codewords, $ecCw));

    // --- lay out the symbol -------------------------------------------------
    $blank = array_fill(0, $size, array_fill(0, $size, 0));

    $base = $blank;
    qr_place_finder($base, 0, 0);
    qr_place_finder($base, 0, $size - 7);
    qr_place_finder($base, $size - 7, 0);

    for ($i = 8; $i < $size - 8; $i++) {
        $base[6][$i] = $base[$i][6] = ($i % 2 === 0) ? 1 : 0;
    }

    if ($version === 2) {
        for ($r = 16; $r <= 20; $r++) {
            for ($c = 16; $c <= 20; $c++) {
                $ring = ($r === 16 || $r === 20 || $c === 16 || $c === 20);
                $base[$r][$c] = ($ring || ($r === 18 && $c === 18)) ? 1 : 0;
            }
        }
    }

    // Data snakes up and down in two-module-wide columns from the bottom right,
    // skipping the vertical timing pattern.
    $bitIndex = 0;
    $stream = [];
    foreach ($all as $cw) {
        for ($i = 7; $i >= 0; $i--) $stream[] = ($cw >> $i) & 1;
    }

    $placed = [];
    $upward = true;
    for ($col = $size - 1; $col > 0; $col -= 2) {
        if ($col === 6) $col--;                     // timing column is not data
        for ($n = 0; $n < $size; $n++) {
            $row = $upward ? $size - 1 - $n : $n;
            foreach ([$col, $col - 1] as $c) {
                if (qr_is_function_module($size, $row, $c, $version)) continue;
                $placed[] = [$row, $c, $stream[$bitIndex] ?? 0];
                $bitIndex++;
            }
        }
        $upward = !$upward;
    }

    // Try every mask, keep the least penalised.
    $best = null; $bestScore = PHP_INT_MAX;
    for ($mask = 0; $mask < 8; $mask++) {
        $m = $base;
        foreach ($placed as [$row, $col, $bit]) {
            $m[$row][$col] = qr_mask($mask, $row, $col) ? $bit ^ 1 : $bit;
        }
        qr_place_format($m, $size, $mask);

        $score = qr_penalty($m, $size);
        if ($score < $bestScore) { $bestScore = $score; $best = $m; }
    }

    return $best;
}
