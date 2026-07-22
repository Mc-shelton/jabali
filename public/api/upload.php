<?php
// Image upload (admin only).
//   POST upload.php  (multipart/form-data, field "image", optional "folder")
//        → { url }
//
// Validates the real MIME type (not the client-claimed one), enforces a size
// cap, and writes a random filename so uploads can't overwrite or be guessed.
// The folder is matched against a whitelist rather than used as a path, so no
// amount of ../ in the request can escape the uploads directory.
require __DIR__ . '/_bootstrap.php';

route([
    'POST' => function () {
        require_auth();
        require_csrf();

        if (empty($_FILES['image']) || !is_uploaded_file($_FILES['image']['tmp_name'] ?? '')) {
            error_out('No file uploaded.', 422);
        }

        $file = $_FILES['image'];

        if ($file['error'] !== UPLOAD_ERR_OK) {
            error_out('Upload failed (code ' . $file['error'] . ').', 422);
        }
        if ($file['size'] > MAX_UPLOAD_BYTES) {
            error_out('Image is larger than the ' . (MAX_UPLOAD_BYTES / 1048576) . ' MB limit.', 422);
        }

        // Trust the file's actual contents, not its extension or claimed type.
        // No finfo_close(): it's deprecated as of PHP 8.5 (the handle is freed
        // automatically), and the notice would print ahead of the JSON body and
        // break the client's parse. The handle goes out of scope here anyway.
        $finfo = finfo_open(FILEINFO_MIME_TYPE);
        $mime = finfo_file($finfo, $file['tmp_name']);

        if (!isset(ALLOWED_IMAGE_TYPES[$mime])) {
            error_out('Only JPEG, PNG, or WebP images are allowed.', 422);
        }
        $ext = ALLOWED_IMAGE_TYPES[$mime];

        // Whitelist match, never a path join with client input.
        $folder = (string) ($_POST['folder'] ?? UPLOAD_FOLDER_DEFAULT);
        if (!in_array($folder, UPLOAD_FOLDERS, true)) {
            $folder = UPLOAD_FOLDER_DEFAULT;
        }

        // A member may upload, because keeping their own photo current is the
        // point of the member portal — but only into the members folder. Left
        // to the client's value they could file an image under `site` or
        // `events` and use the portal as general storage for the public web
        // root. Overridden rather than rejected: the only folder they have any
        // business writing to is this one.
        if (!is_admin()) {
            $folder = 'members';
        }

        $dir = UPLOAD_BASE_DIR . '/' . $folder;
        if (!is_dir($dir) && !mkdir($dir, 0775, true) && !is_dir($dir)) {
            error_out('Upload directory is not writable.', 500);
        }

        $name = date('Ymd') . '-' . bin2hex(random_bytes(8)) . '.' . $ext;
        $dest = $dir . '/' . $name;

        if (!move_uploaded_file($file['tmp_name'], $dest)) {
            error_out('Could not save the uploaded file.', 500);
        }
        @chmod($dest, 0644);

        json_out(['url' => UPLOAD_BASE_URL . '/' . $folder . '/' . $name], 201);
    },
]);
