<?php
// The property under test: the symbol is a valid QR code, not merely a
// plausible-looking grid of squares.
//
// This matters more than usual here. A malformed QR renders perfectly well and
// simply never scans — the failure surfaces at the venue door, with a queue.
// So nothing below compares against a matrix this encoder produced; every check
// is against an invariant the standard imposes, which a buggy encoder cannot
// satisfy by accident.
declare(strict_types=1);

require __DIR__ . '/../public/api/_qr.php';

$pass = 0; $fail = 0;
function check(string $name, $got, $want) {
    global $pass, $fail;
    if ($got === $want) { $pass++; echo "  ok   $name\n"; return; }
    $fail++;
    echo "  FAIL $name\n       got:  " . var_export($got, true) . "\n       want: " . var_export($want, true) . "\n";
}

echo "\n-- GF(256) arithmetic --\n";
[$exp, $log] = qr_gf();
check('exp/log are inverses', $log[$exp[57]], 57);
check('field wraps at 255',   $exp[255], $exp[0]);
// 2 is the generator, so a^1 = 2 and the reduction polynomial shows at a^8.
check('a^1 is 2',             $exp[1], 2);
check('a^8 reduces to 0x1D',  $exp[8], 0x1D);
check('multiplication works', qr_gf_mul(0, 42), 0);

echo "\n-- Reed-Solomon: the codeword must vanish at the generator's roots --\n";
// This is the real proof. C(x) is built to be divisible by
// g(x) = (x-a^0)(x-a^1)...(x-a^n-1), so C(a^i) = 0 for every i below n.
// Wrong field arithmetic, a wrong generator or a wrong division all break it.
$evalAt = function (array $cw, int $power) use ($exp, $log): int {
    $acc = 0;
    $n = count($cw);
    foreach ($cw as $i => $c) {
        if ($c === 0) continue;
        $acc ^= $exp[($log[$c] + $power * ($n - 1 - $i)) % 255];
    }
    return $acc;
};

$data = [32, 91, 11, 120, 209, 114, 220, 77, 67, 64, 236, 17, 236, 17, 236, 17];
$ec   = qr_rs_encode($data, 10);
check('produced 10 EC codewords', count($ec), 10);

$full = array_merge($data, $ec);
$roots = 0;
for ($i = 0; $i < 10; $i++) {
    if ($evalAt($full, $i) === 0) $roots++;
}
check('codeword vanishes at all 10 roots', $roots, 10);

// A corrupted codeword must NOT vanish — otherwise the check above proves
// nothing, because a function returning zero always would also pass it.
$corrupt = $full;
$corrupt[3] ^= 0x01;
$stillZero = 0;
for ($i = 0; $i < 10; $i++) {
    if ($evalAt($corrupt, $i) === 0) $stillZero++;
}
check('a corrupted codeword does not', $stillZero < 10, true);

// The generator polynomial has degree n and is monic.
$gen = qr_rs_generator(16);
check('generator degree', count($gen) - 1, 16);
check('generator is monic', $gen[0], 1);

echo "\n-- alphanumeric encoding --\n";
// Hand-computable: 'H' is 17, 'E' is 14, and a pair packs as 45*first + second.
// 17*45 + 14 = 779 = 0b01100001011.
check('a pair packs into 11 bits', implode('', qr_alphanumeric_bits('HE')), '01100001011');
// An odd trailing character takes 6 bits: 'A' is 10 = 0b001010.
check('odd tail takes 6 bits', implode('', qr_alphanumeric_bits('A')), '001010');
// A real ticket code: 9 characters = 4 pairs at 11 bits + 1 tail at 6 = 50.
check('a ticket code encodes to 50 bits', count(qr_alphanumeric_bits('JC-E0B693')), 50);

$rejected = false;
try { qr_alphanumeric_bits('lower'); } catch (Throwable $e) { $rejected = true; }
check('lowercase is refused', $rejected, true);

$rejected = false;
try { qr_alphanumeric_bits('a@b'); } catch (Throwable $e) { $rejected = true; }
check('punctuation outside the set is refused', $rejected, true);

echo "\n-- format information carries a valid BCH code --\n";
// Undo the fixed XOR mask, then divide by the BCH generator. A correct format
// word leaves no remainder.
$validFormats = 0;
for ($mask = 0; $mask < 8; $mask++) {
    $rem = qr_format_bits($mask) ^ 0b101010000010010;
    for ($i = 14; $i >= 10; $i--) {
        if ($rem & (1 << $i)) $rem ^= 0b10100110111 << ($i - 10);
    }
    if ($rem === 0) $validFormats++;
}
check('all 8 format words are valid BCH', $validFormats, 8);
// The mask number must survive the round trip, or scanners unmask with the
// wrong pattern and read noise.
check('mask 5 round-trips', (qr_format_bits(5) ^ 0b101010000010010) >> 10 & 0b111, 5);

echo "\n-- symbol geometry --\n";
$m = qr_encode('JC-E0B693');
check('version 1 is 21x21', count($m), 21);
check('rows are square',    count($m[0]), 21);

// Finder patterns: a 7x7 ring with a 3x3 core, in three corners.
$finderOk = function (array $m, int $r0, int $c0): bool {
    return $m[$r0][$c0] === 1 && $m[$r0 + 1][$c0 + 1] === 0 && $m[$r0 + 3][$c0 + 3] === 1
        && $m[$r0 + 6][$c0 + 6] === 1 && $m[$r0 + 1][$c0 + 3] === 0;
};
check('top-left finder',     $finderOk($m, 0, 0), true);
check('top-right finder',    $finderOk($m, 0, 14), true);
check('bottom-left finder',  $finderOk($m, 14, 0), true);

// Timing patterns alternate, starting dark at the 8th module.
check('horizontal timing alternates', [$m[6][8], $m[6][9], $m[6][10]], [1, 0, 1]);
check('vertical timing alternates',   [$m[8][6], $m[9][6], $m[10][6]], [1, 0, 1]);
check('the dark module is set',       $m[21 - 8][8], 1);

// The count of non-function modules is fixed by the standard: 208 bits for
// version 1, 359 for version 2. This is the sharpest check on the function-module
// map, which is the easiest part of a layout to get subtly wrong.
$countData = function (int $size, int $version): int {
    $n = 0;
    for ($r = 0; $r < $size; $r++) {
        for ($c = 0; $c < $size; $c++) {
            if (!qr_is_function_module($size, $r, $c, $version)) $n++;
        }
    }
    return $n;
};
check('version 1 has 208 data modules', $countData(21, 1), 208);
check('version 2 has 359 data modules', $countData(25, 2), 359);

echo "\n-- capacity --\n";
// Long enough to need version 2, still inside alphanumeric.
$m2 = qr_encode('JC-E0B693-EXTRA-PAYLOAD-1234');
check('longer text grows to version 2', count($m2), 25);

$rejected = false;
try { qr_encode(str_repeat('A', 60)); } catch (Throwable $e) { $rejected = true; }
check('refuses what it cannot encode', $rejected, true);

// Encoding is deterministic: the same code must produce the same symbol, or a
// reprint would not match the ticket already in a buyer's inbox.
check('encoding is deterministic', qr_encode('JC-E0B693'), $m);

echo "\n$pass passed, $fail failed\n";
exit($fail === 0 ? 0 : 1);
