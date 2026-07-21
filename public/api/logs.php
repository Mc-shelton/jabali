<?php
// Log viewer — admin only.
//   GET logs.php                       → recent entries (today)
//   GET logs.php?day=YYYY-MM-DD        → a specific day
//   GET logs.php?level=error&limit=200 → filter by level
//
// Reads the newest entries from the JSON-lines files written by _log.php. The
// files themselves are blocked from the web by api/data/.htaccess, so this is
// the only way to see them without shell access.
require __DIR__ . '/_bootstrap.php';

route([
    'GET' => function () {
        require_auth();

        $day = (string) ($_GET['day'] ?? date('Y-m-d'));
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $day)) {
            error_out('Invalid day.', 422);
        }

        $level = clean_string($_GET['level'] ?? '', 20);
        $limit = max(1, min(1000, (int) ($_GET['limit'] ?? 300)));

        // Which days have logs at all, so the UI can offer a day picker.
        $days = [];
        foreach (glob(log_dir() . '/api-*.log') ?: [] as $file) {
            if (preg_match('/api-(\d{4}-\d{2}-\d{2})\.log$/', $file, $m)) {
                $days[] = $m[1];
            }
        }
        rsort($days);

        $path = log_path($day);
        $entries = [];

        if (is_file($path)) {
            // Read the tail rather than the whole file: a busy day's log can be
            // large and only the recent end is ever interesting.
            $lines = @file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) ?: [];
            $lines = array_reverse($lines);                 // newest first

            foreach ($lines as $line) {
                if (count($entries) >= $limit) break;
                $entry = json_decode($line, true);
                if (!is_array($entry)) continue;
                if ($level !== '' && ($entry['level'] ?? '') !== $level) continue;
                $entries[] = $entry;
            }
        }

        json_out([
            'day'     => $day,
            'days'    => $days,
            'entries' => $entries,
        ]);
    },

    // Clear a day's log once an issue has been dealt with.
    'DELETE' => function () {
        require_auth();
        require_csrf();

        $day = (string) ($_GET['day'] ?? '');
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $day)) {
            error_out('Invalid day.', 422);
        }
        $path = log_path($day);
        if (is_file($path)) @unlink($path);

        json_out(['cleared' => $day]);
    },
]);
