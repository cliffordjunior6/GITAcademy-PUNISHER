<?php
/**
 * Dev/demo server router for `php -S localhost:8000 router.php`.
 * - Requests to /api/*  -> handled by api/index.php (the real backend)
 * - Everything else     -> served as a static file from the project root
 *   (this mirrors what the nginx.conf / Apache config do in production)
 */
$uri = urldecode(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH));

if (strpos($uri, '/api') === 0) {
    require __DIR__ . '/api/index.php';
    return true;
}

// Never serve dotfiles (.env, .git, etc.) or the legacy-scaffold folder as static assets
$blocked = preg_match('#(^|/)\.[^/]+$#', $uri) || strpos($uri, '/_legacy-laravel-scaffold') === 0;
if ($blocked) {
    http_response_code(404);
    require __DIR__ . '/404.html';
    return true;
}

$file = __DIR__ . $uri;
if ($uri !== '/' && file_exists($file) && !is_dir($file)) {
    return false; // let the built-in server serve the static file directly
}

// Default to index.html for the root or any unknown path (simple SPA-ish fallback)
if ($uri === '/' ) {
    require __DIR__ . '/index.html';
    return true;
}

http_response_code(404);
require __DIR__ . '/404.html';
return true;
