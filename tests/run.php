#!/usr/bin/env php
<?php
// Runs every test suite and lints the API. Exits non-zero if anything fails,
// which is what stops a broken build reaching the live site.
//
//   php tests/run.php
declare(strict_types=1);

$root = dirname(__DIR__);
$failed = [];

echo "\n=== PHP lint ===\n";
foreach (glob("$root/public/api/*.php") ?: [] as $file) {
    $name = basename($file);
    exec('php -l ' . escapeshellarg($file) . ' 2>&1', $out, $code);
    if ($code !== 0) {
        $failed[] = "lint $name";
        echo "  FAIL $name\n    " . implode("\n    ", $out) . "\n";
    }
    $out = [];
}
echo '  ' . count(glob("$root/public/api/*.php") ?: []) . " files checked\n";

// Deprecated calls that print a notice into the response body ahead of the JSON,
// which makes a successful request look like a network failure to the client.
// This has bitten twice (finfo_close, curl_close) — so it is now a build error.
echo "\n=== deprecated-call sweep ===\n";
$banned = ['curl_close', 'finfo_close', 'strftime', 'utf8_encode', 'utf8_decode', 'each'];
foreach (glob("$root/public/api/*.php") ?: [] as $file) {
    $src = file_get_contents($file) ?: '';
    // Strip comments so the explanatory notes about these functions don't trip it.
    $stripped = preg_replace('!//.*$|/\*.*?\*/!ms', '', $src);
    foreach ($banned as $fn) {
        if (preg_match('/\b' . $fn . '\s*\(/', $stripped)) {
            $failed[] = "deprecated $fn in " . basename($file);
            echo '  FAIL ' . basename($file) . ": calls $fn()\n";
        }
    }
}
echo '  ' . count($banned) . " patterns checked\n";

// A filled-in config.php must never be committed: the repository is public.
echo "\n=== secrets are not tracked ===\n";
exec('cd ' . escapeshellarg($root) . ' && git ls-files public/api/config.php dist.zip 2>/dev/null', $tracked);
if ($tracked) {
    foreach ($tracked as $t) {
        $failed[] = "tracked secret: $t";
        echo "  FAIL $t is tracked by git — it holds live credentials\n";
    }
} else {
    echo "  ok   config.php and dist.zip are untracked\n";
}

echo "\n=== suites ===\n";
foreach (['schema_test', 'merch_test', 'log_test', 'fulfil_test', 'mailer_test', 'enquiry_test', 'qr_test', 'admit_test'] as $suite) {
    $out = [];
    exec('php ' . escapeshellarg(__DIR__ . "/$suite.php") . ' 2>&1', $out, $code);
    $summary = trim((string) end($out));
    printf("  %-14s %s\n", $suite, $summary);
    if ($code !== 0) {
        $failed[] = $suite;
        echo '    ' . implode("\n    ", array_filter($out, fn($l) => str_contains($l, 'FAIL'))) . "\n";
    }
}

echo "\n";
if ($failed) {
    echo 'FAILED: ' . implode(', ', $failed) . "\n\n";
    exit(1);
}
echo "All checks passed.\n\n";
