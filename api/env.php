<?php
/**
 * Minimal .env loader — no Composer dependency needed.
 * Loads KEY=VALUE pairs from a .env file into getenv()/$_ENV, if present.
 * Falls back to .env.example's structure with safe demo defaults if no
 * real .env exists yet, so the app still runs out of the box.
 */
declare(strict_types=1);

function load_env(string $path): void {
    if (!file_exists($path)) return;
    foreach (file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
        $line = trim($line);
        if ($line === '' || str_starts_with($line, '#')) continue;
        if (!str_contains($line, '=')) continue;
        [$key, $value] = explode('=', $line, 2);
        $key = trim($key);
        $value = trim($value);
        // Strip matching surrounding quotes
        if (strlen($value) >= 2 && (($value[0] === '"' && str_ends_with($value, '"')) || ($value[0] === "'" && str_ends_with($value, "'")))) {
            $value = substr($value, 1, -1);
        }
        if ($key !== '' && getenv($key) === false) {
            putenv("$key=$value");
            $_ENV[$key] = $value;
        }
    }
}

/** Read a config value: real .env value if set, otherwise the given demo-safe default. */
function env(string $key, $default = null) {
    $value = getenv($key);
    if ($value === false || $value === '') return $default;
    return $value;
}

load_env(dirname(__DIR__) . '/.env');
