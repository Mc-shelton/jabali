<?php
// Media upload (admin only).
//   POST media-upload.php (multipart/form-data, field "file", folder "music")
//        → { url, name }
//
// Bucket media is server-managed and deliberately excluded from deployments.
// Keep the destination whitelist here narrow: client input never becomes a
// filesystem path, and uploaded PHP/HTML/script files are never accepted.
require __DIR__ . '/_bootstrap.php';

const MEDIA_UPLOADS = [
    'music' => [
        'dir' => '/bucket/website/music',
        'url' => '/bucket/website/music',
        'maxBytes' => 50 * 1024 * 1024,
        'types' => [
            'audio/mpeg'  => 'mp3',
            'audio/mp4'   => 'm4a',
            'audio/x-m4a' => 'm4a',
            'audio/wav'   => 'wav',
            'audio/x-wav' => 'wav',
            'audio/ogg'   => 'ogg',
            'application/ogg' => 'ogg',
            'audio/flac'  => 'flac',
            'audio/x-flac' => 'flac',
        ],
    ],
];

route([
    'POST' => function () {
        require_admin();
        require_csrf();

        if (empty($_FILES['file']) || !is_uploaded_file($_FILES['file']['tmp_name'] ?? '')) {
            error_out('No media file uploaded. The server upload limit may have been exceeded.', 422);
        }

        $file = $_FILES['file'];
        if (($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
            error_out('Upload failed (code ' . ($file['error'] ?? UPLOAD_ERR_NO_FILE) . ').', 422);
        }

        $folder = (string) ($_POST['folder'] ?? '');
        $target = MEDIA_UPLOADS[$folder] ?? null;
        if ($target === null) {
            error_out('Unknown media destination.', 422);
        }
        if (($file['size'] ?? 0) > $target['maxBytes']) {
            error_out('Media file is larger than the 50 MB limit.', 422);
        }

        $finfo = finfo_open(FILEINFO_MIME_TYPE);
        $mime = finfo_file($finfo, $file['tmp_name']);
        if (!isset($target['types'][$mime])) {
            error_out('Only MP3, M4A, WAV, OGG, or FLAC audio is allowed.', 422);
        }

        $dir = dirname(__DIR__) . $target['dir'];
        if (!is_dir($dir) && !mkdir($dir, 0775, true) && !is_dir($dir)) {
            error_out('Media directory is not writable.', 500);
        }

        $original = pathinfo((string) ($file['name'] ?? 'audio'), PATHINFO_FILENAME);
        $slug = strtolower((string) preg_replace('/[^a-z0-9]+/i', '-', $original));
        $slug = trim($slug, '-') ?: 'audio';
        $slug = substr($slug, 0, 80);
        $ext = $target['types'][$mime];
        $name = $slug . '-' . date('Ymd') . '-' . bin2hex(random_bytes(4)) . '.' . $ext;
        $dest = $dir . '/' . $name;

        if (!move_uploaded_file($file['tmp_name'], $dest)) {
            error_out('Could not save the uploaded media.', 500);
        }
        @chmod($dest, 0644);

        json_out([
            'url' => $target['url'] . '/' . rawurlencode($name),
            'name' => $name,
        ], 201);
    },
]);
