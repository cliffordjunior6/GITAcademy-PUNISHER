<?php
/**
 * GITAcademy backend bootstrap.
 * Plain PHP + SQLite — no Composer / framework required.
 * This is the real backend that api.js talks to at BASE_URL = '/api'.
 */

declare(strict_types=1);
error_reporting(E_ALL);
ini_set('display_errors', '0'); // never leak PHP errors into JSON responses

require_once __DIR__ . '/env.php';
require_once __DIR__ . '/mailer.php';
require_once __DIR__ . '/paystack.php';

define('API_DIR', __DIR__);
define('DB_PATH', API_DIR . '/' . str_replace('api/', '', env('DB_PATH', 'database.sqlite')));
define('PLATFORM_FEE_PCT', 0.30); // platform takes 30%, instructor keeps 70%
define('ADMIN_INVITE_CODE', env('ADMIN_INVITE_CODE', 'ADMIN2024')); // real value set via .env — see .env.example
define('TOKEN_TTL_SECONDS', 60 * 60 * 24 * 14); // sessions expire after 14 days of issue (real, enforced below)

function db(): PDO {
    static $pdo = null;
    if ($pdo !== null) return $pdo;

    $isNew = !file_exists(DB_PATH);
    $pdo = new PDO('sqlite:' . DB_PATH);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
    $pdo->exec('PRAGMA foreign_keys = ON');

    if ($isNew) {
        $schema = file_get_contents(API_DIR . '/schema.sql');
        $pdo->exec($schema);
    }
    return $pdo;
}

function json_response($data, int $status = 200): void {
    http_response_code($status);
    header('Content-Type: application/json');
    echo json_encode($data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

function error_response(string $message, int $status = 400, array $errors = []): void {
    $payload = ['message' => $message];
    if ($errors) $payload['errors'] = $errors;
    json_response($payload, $status);
}

function body(): array {
    $raw = file_get_contents('php://input');
    if (!$raw) return $_POST ?: [];
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

function bearer_token(): ?string {
    $headers = function_exists('getallheaders') ? getallheaders() : [];
    $auth = $headers['Authorization'] ?? $headers['authorization'] ?? ($_SERVER['HTTP_AUTHORIZATION'] ?? '');
    if ($auth && preg_match('/Bearer\s+(\S+)/', $auth, $m)) {
        return $m[1];
    }
    return null;
}

/** Returns the authenticated user array, or null. */
function current_user(): ?array {
    $token = bearer_token();
    if (!$token) return null;
    $stmt = db()->prepare('SELECT u.*, t.expires_at FROM tokens t JOIN users u ON u.id = t.user_id WHERE t.token = ?');
    $stmt->execute([$token]);
    $user = $stmt->fetch();
    if (!$user) return null;
    // Real, enforced session expiry — not just UI decoration
    if (strtotime($user['expires_at']) < time()) {
        db()->prepare('DELETE FROM tokens WHERE token = ?')->execute([$token]);
        return null;
    }
    return $user;
}

/** Require auth; optionally require one of the given roles. Exits with 401/403 on failure. */
function require_auth(array $roles = []): array {
    $user = current_user();
    if (!$user) {
        error_response('Unauthenticated. Please log in again.', 401);
    }
    if ($roles && !in_array($user['role'], $roles, true)) {
        error_response('You do not have permission to do that.', 403);
    }
    return $user;
}

function make_token(int $userId): string {
    $token = bin2hex(random_bytes(32));
    $expiresAt = date('Y-m-d H:i:s', time() + TOKEN_TTL_SECONDS);
    $stmt = db()->prepare('INSERT INTO tokens (token, user_id, expires_at) VALUES (?, ?, ?)');
    $stmt->execute([$token, $userId, $expiresAt]);
    return $token;
}

/**
 * Real brute-force protection: max 8 failed attempts per identifier
 * (email+IP) in a 15-minute window. Call on every failed login/register
 * attempt via record_failed_attempt(); check before processing via
 * too_many_attempts().
 */
function attempt_identifier(string $email): string {
    return strtolower($email) . '|' . ($_SERVER['REMOTE_ADDR'] ?? 'unknown');
}

function too_many_attempts(string $identifier): bool {
    $stmt = db()->prepare("SELECT COUNT(*) c FROM login_attempts WHERE identifier = ? AND attempted_at > datetime('now', '-15 minutes')");
    $stmt->execute([$identifier]);
    return (int)$stmt->fetch()['c'] >= 8;
}

function record_failed_attempt(string $identifier): void {
    db()->prepare('INSERT INTO login_attempts (identifier) VALUES (?)')->execute([$identifier]);
}

function clear_attempts(string $identifier): void {
    db()->prepare('DELETE FROM login_attempts WHERE identifier = ?')->execute([$identifier]);
}

function public_user(array $u): array {
    return [
        'id' => (int)$u['id'],
        'first_name' => $u['first_name'],
        'last_name' => $u['last_name'],
        'email' => $u['email'],
        'role' => $u['role'],
        'status' => $u['status'],
        'avatar' => $u['avatar'],
        'bio' => $u['bio'],
        'tagline' => $u['tagline'],
        'location' => $u['location'],
        'website' => $u['website'],
        'twitter' => $u['twitter'] ?? null,
        'linkedin' => $u['linkedin'] ?? null,
        'github' => $u['github'] ?? null,
        'youtube' => $u['youtube'] ?? null,
        'streak_days' => (int)$u['streak_days'],
        'hours_learned' => (float)$u['hours_learned'],
    ];
}

function order_number(): string {
    return 'GH-' . date('Y') . '-' . str_pad((string)random_int(0, 999999), 6, '0', STR_PAD_LEFT);
}

/** Deterministic, stable credential ID for a completed enrollment — same every time, not random per request. */
function credential_id(int $userId, int $courseId, string $completedAt = ''): string {
    $year = $completedAt ? substr($completedAt, 0, 4) : date('Y');
    $hash = substr(strtoupper(md5($userId . '-' . $courseId . '-gitacademy-cert')), 0, 6);
    return "GA-CERT-$year-$hash";
}

/**
 * Real local file storage for uploaded videos. Validates extension AND
 * actual MIME type (never trust the client), generates a random filename
 * (never trust the original name — prevents path traversal / overwrite),
 * and enforces a max size from .env. Returns the stored relative path,
 * or throws with a user-facing message on failure.
 */
function store_uploaded_video(array $file): array {
    $allowedExt = ['mp4', 'webm', 'mov', 'm4v'];
    $allowedMime = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-m4v'];
    $maxBytes = (int)env('UPLOADS_MAX_MB', 200) * 1024 * 1024;

    if (!isset($file['error']) || $file['error'] !== UPLOAD_ERR_OK) {
        throw new RuntimeException('Upload failed (code ' . ($file['error'] ?? 'unknown') . ').');
    }
    if ($file['size'] > $maxBytes) {
        throw new RuntimeException('File is too large. Max ' . env('UPLOADS_MAX_MB', 200) . 'MB.');
    }
    $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
    if (!in_array($ext, $allowedExt, true)) {
        throw new RuntimeException('Unsupported file type. Allowed: ' . implode(', ', $allowedExt));
    }
    $realMime = function_exists('mime_content_type') ? mime_content_type($file['tmp_name']) : $file['type'];
    if (!in_array($realMime, $allowedMime, true)) {
        throw new RuntimeException('File content does not match a supported video type.');
    }

    $uploadsDir = dirname(API_DIR) . '/' . env('UPLOADS_PATH', 'uploads');
    if (!is_dir($uploadsDir)) mkdir($uploadsDir, 0755, true);

    // Random filename — never trust the client-supplied name
    $randomName = bin2hex(random_bytes(16)) . '.' . $ext;
    $destination = $uploadsDir . '/' . $randomName;

    if (!move_uploaded_file($file['tmp_name'], $destination)) {
        throw new RuntimeException('Could not save the uploaded file.');
    }

    return [
        'path' => env('UPLOADS_PATH', 'uploads') . '/' . $randomName,
        'original_name' => $file['name'],
        'size_bytes' => $file['size'],
    ];
}
