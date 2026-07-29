<?php
declare(strict_types=1);

function payment_bypass_keys_match(bool $enabled, string $configuredKey, string $sentKey): bool
{
    return $enabled && $configuredKey !== '' && $sentKey !== ''
        && hash_equals($configuredKey, $sentKey);
}

function payment_bypass_is_loopback(string $address): bool
{
    return in_array($address, ['127.0.0.1', '::1'], true);
}

function payment_bypass_authorized(): bool
{
    $enabled = defined('PAYMENT_BYPASS_ENABLED') && PAYMENT_BYPASS_ENABLED === true;
    $configured = defined('PAYMENT_BYPASS_KEY') ? trim((string) PAYMENT_BYPASS_KEY) : '';
    $sent = trim((string) ($_SERVER['HTTP_X_JC_PAYMENT_BYPASS'] ?? ''));
    $remote = (string) ($_SERVER['REMOTE_ADDR'] ?? '');
    return payment_bypass_is_loopback($remote)
        && payment_bypass_keys_match($enabled, $configured, $sent);
}
