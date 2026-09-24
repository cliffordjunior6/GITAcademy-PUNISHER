<?php
declare(strict_types=1);
require_once __DIR__ . '/bootstrap.php';

// CORS (harmless for same-origin deployment, useful if frontend is hosted separately)
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

// Real security headers
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('Referrer-Policy: strict-origin-when-cross-origin');
if (env('APP_ENV') === 'production') {
    header('Strict-Transport-Security: max-age=31536000; includeSubDomains');
}

$method = $_SERVER['REQUEST_METHOD'];
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
// Strip a leading /api so this file works whether it's reached via /api/xxx or mounted at /
$path = preg_replace('#^/api#', '', $path);
$path = rtrim($path, '/');
if ($path === '') $path = '/';
$query = [];
parse_str(parse_url($_SERVER['REQUEST_URI'], PHP_URL_QUERY) ?? '', $query);

$routes = [];
function route(string $method, string $pattern, callable $handler) {
    global $routes;
    $routes[] = [$method, $pattern, $handler];
}

/** Turns "/courses/{id}/reviews" into a matchable regex. */
function match_route(string $pattern, string $path): ?array {
    $regex = preg_replace('#\{[a-zA-Z_]+\}#', '([^/]+)', $pattern);
    $regex = '#^' . $regex . '$#';
    if (preg_match($regex, $path, $m)) {
        array_shift($m);
        return $m;
    }
    return null;
}

function param_names(string $pattern): array {
    preg_match_all('#\{([a-zA-Z_]+)\}#', $pattern, $m);
    return $m[1];
}

// ────────────────────────────────────────────────────────────
// AUTH
// ────────────────────────────────────────────────────────────
route('POST', '/auth/register', function () {
    $b = body();
    $first = trim($b['first_name'] ?? '');
    $last = trim($b['last_name'] ?? '');
    $email = strtolower(trim($b['email'] ?? ''));
    $password = $b['password'] ?? '';

    // Real rate limiting — max 5 registration attempts per IP per 15 minutes
    $ipIdentifier = 'register|' . ($_SERVER['REMOTE_ADDR'] ?? 'unknown');
    if (too_many_attempts($ipIdentifier)) {
        error_response('Too many signup attempts. Please try again in 15 minutes.', 429);
    }

    if (!$first || !$last || !$email || !$password) {
        record_failed_attempt($ipIdentifier);
        error_response('Please fill in all required fields.', 422);
    }
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        error_response('Please enter a valid email address.', 422, ['email' => ['Invalid email address.']]);
    }
    if (strlen($password) < 6) {
        error_response('Password must be at least 6 characters.', 422, ['password' => ['Too short.']]);
    }

    $stmt = db()->prepare('SELECT id FROM users WHERE email = ?');
    $stmt->execute([$email]);
    if ($stmt->fetch()) {
        error_response('An account with that email already exists.', 422, ['email' => ['Email already registered.']]);
    }

    $requestedRole = $b['role'] ?? 'student';
    if ($requestedRole === 'admin') {
        if (($b['admin_invite_code'] ?? '') !== ADMIN_INVITE_CODE) {
            error_response('A valid admin invite code is required to register as admin.', 403);
        }
        $role = 'admin';
    } else {
        $role = in_array($requestedRole, ['student', 'instructor'], true) ? $requestedRole : 'student';
    }

    $stmt = db()->prepare('INSERT INTO users (first_name, last_name, email, password, role) VALUES (?, ?, ?, ?, ?)');
    $stmt->execute([$first, $last, $email, password_hash($password, PASSWORD_DEFAULT), $role]);
    $userId = (int)db()->lastInsertId();

    $stmt = db()->prepare('SELECT * FROM users WHERE id = ?');
    $stmt->execute([$userId]);
    $user = $stmt->fetch();

    json_response(['token' => make_token($userId), 'user' => public_user($user)], 201);
});

route('POST', '/auth/login', function () {
    $b = body();
    $email = strtolower(trim($b['email'] ?? ''));
    $password = $b['password'] ?? '';
    $role = $b['role'] ?? null;
    $adminCode = $b['admin_code'] ?? '';

    if (!$email || !$password) {
        error_response('Please enter your email and password.', 422);
    }

    // Real brute-force protection
    $identifier = attempt_identifier($email);
    if (too_many_attempts($identifier)) {
        error_response('Too many login attempts. Please try again in 15 minutes.', 429);
    }

    $stmt = db()->prepare('SELECT * FROM users WHERE email = ?');
    $stmt->execute([$email]);
    $user = $stmt->fetch();

    if (!$user || !password_verify($password, $user['password'])) {
        record_failed_attempt($identifier);
        error_response('Invalid email or password.', 401);
    }
    if ($user['status'] === 'suspended') {
        error_response('This account has been suspended. Contact support.', 403);
    }
    if ($role === 'admin' && $user['role'] !== 'admin') {
        error_response('This account does not have admin access.', 403);
    }
    if ($role === 'admin' && $adminCode !== ADMIN_INVITE_CODE) {
        record_failed_attempt($identifier);
        error_response('Invalid admin access code.', 403);
    }
    if ($role === 'instructor' && !in_array($user['role'], ['instructor', 'admin'], true)) {
        error_response('This account is not registered as an instructor.', 403);
    }

    clear_attempts($identifier);

    json_response(['token' => make_token((int)$user['id']), 'user' => public_user($user)]);
});

route('POST', '/auth/logout', function () {
    $token = bearer_token();
    if ($token) {
        $stmt = db()->prepare('DELETE FROM tokens WHERE token = ?');
        $stmt->execute([$token]);
    }
    json_response(['message' => 'Logged out.']);
});

route('GET', '/auth/me', function () {
    $user = require_auth();
    json_response(public_user($user));
});

route('POST', '/auth/forgot-password', function () {
    $b = body();
    $email = strtolower(trim($b['email'] ?? ''));
    if (!$email) error_response('Email is required.', 422);

    // Always return the same message whether or not the account exists,
    // to avoid leaking which emails are registered.
    $stmt = db()->prepare('SELECT id, first_name FROM users WHERE email = ?');
    $stmt->execute([$email]);
    $user = $stmt->fetch();

    if ($user) {
        $token = bin2hex(random_bytes(32));
        $expiresAt = date('Y-m-d H:i:s', time() + 1800); // 30 minutes, real and enforced
        db()->prepare('INSERT INTO password_resets (token, user_id, expires_at) VALUES (?, ?, ?)')
            ->execute([$token, $user['id'], $expiresAt]);

        $resetUrl = rtrim(env('APP_URL', ''), '/') . "/reset-password.html?token=$token&email=" . urlencode($email);
        $body = "<p>Hi {$user['first_name']},</p>" .
            "<p>Click the link below to reset your GITAcademy password. This link expires in 30 minutes.</p>" .
            "<p><a href=\"$resetUrl\">$resetUrl</a></p>" .
            "<p>If you didn't request this, you can safely ignore this email.</p>";
        send_email($email, 'Reset your GITAcademy password', $body);
    }

    json_response(['message' => 'If that email exists, a reset link has been sent.']);
});

route('POST', '/auth/reset-password', function () {
    $b = body();
    $token = $b['token'] ?? '';
    $password = $b['password'] ?? '';
    if (!$token || strlen($password) < 6) {
        error_response('A valid reset link and a password of at least 6 characters are required.', 422);
    }

    $stmt = db()->prepare('SELECT * FROM password_resets WHERE token = ?');
    $stmt->execute([$token]);
    $reset = $stmt->fetch();

    if (!$reset || $reset['used'] || strtotime($reset['expires_at']) < time()) {
        error_response('This reset link is invalid or has expired. Please request a new one.', 400);
    }

    db()->prepare('UPDATE users SET password = ? WHERE id = ?')
        ->execute([password_hash($password, PASSWORD_DEFAULT), $reset['user_id']]);
    db()->prepare('UPDATE password_resets SET used = 1 WHERE token = ?')->execute([$token]);
    // Invalidate all existing sessions for this user as a real security measure
    db()->prepare('DELETE FROM tokens WHERE user_id = ?')->execute([$reset['user_id']]);

    json_response(['message' => 'Password updated. You can now log in.']);
});

// ────────────────────────────────────────────────────────────
// CATEGORIES
// ────────────────────────────────────────────────────────────
route('GET', '/categories', function () {
    $rows = db()->query('SELECT * FROM categories WHERE is_active = 1 ORDER BY sort_order, name')->fetchAll();
    json_response(['categories' => $rows]);
});

route('GET', '/categories/{slug}', function ($slug) {
    $stmt = db()->prepare('SELECT * FROM categories WHERE slug = ? OR id = ?');
    $stmt->execute([$slug, $slug]);
    $cat = $stmt->fetch();
    if (!$cat) error_response('Category not found.', 404);
    json_response($cat);
});

// ────────────────────────────────────────────────────────────
// COURSES (public)
// ────────────────────────────────────────────────────────────
function course_out(array $c, ?PDO $pdo = null): array {
    $pdo = $pdo ?? db();
    $stmt = $pdo->prepare('SELECT first_name, last_name, bio FROM users WHERE id = ?');
    $stmt->execute([$c['instructor_id']]);
    $instr = $stmt->fetch();
    $instrStats = null;
    if ($instr) {
        $s = $pdo->prepare('SELECT COUNT(*) courses_count, COALESCE(SUM(students_count),0) students_count, COALESCE(AVG(NULLIF(rating,0)),0) rating FROM courses WHERE instructor_id = ?');
        $s->execute([$c['instructor_id']]);
        $instrStats = $s->fetch();
    }
    $cat = null;
    if ($c['category_id']) {
        $s = $pdo->prepare('SELECT name, slug FROM categories WHERE id = ?');
        $s->execute([$c['category_id']]);
        $cat = $s->fetch();
    }
    return [
        'id' => (int)$c['id'],
        'title' => $c['title'],
        'slug' => $c['slug'],
        'subtitle' => $c['subtitle'],
        'description' => $c['description'],
        'category' => $cat['name'] ?? null,
        'category_slug' => $cat['slug'] ?? null,
        'emoji' => $c['emoji'],
        'thumbnail_bg' => $c['thumbnail_bg'],
        'price' => (float)$c['price'],
        'original_price' => $c['original_price'] !== null ? (float)$c['original_price'] : null,
        'currency' => 'GHS',
        'level' => $c['level'],
        'language' => $c['language'],
        'duration_minutes' => (int)$c['duration_minutes'],
        'lessons_count' => (int)$c['lessons_count'],
        'students_count' => (int)$c['students_count'],
        'rating' => (float)$c['rating'],
        'reviews_count' => (int)$c['reviews_count'],
        'status' => $c['status'],
        'has_certificate' => (bool)$c['has_certificate'],
        'is_featured' => (bool)$c['is_featured'],
        'what_you_learn' => json_decode($c['what_you_learn'] ?? '[]', true) ?: [],
        'instructor' => $instr ? [
            'id' => (int)$c['instructor_id'],
            'name' => trim(($instr['first_name'] ?? '') . ' ' . ($instr['last_name'] ?? '')),
            'title' => $instr['bio'] ?? '',
            'rating' => $instrStats ? round((float)$instrStats['rating'], 1) : 0,
            'students_count' => $instrStats ? (int)$instrStats['students_count'] : 0,
            'courses_count' => $instrStats ? (int)$instrStats['courses_count'] : 0,
        ] : null,
        'instructor_id' => (int)$c['instructor_id'],
    ];
}

route('GET', '/courses', function () use ($query) {
    $sql = 'SELECT * FROM courses WHERE status = "published"';
    $params = [];
    if (!empty($query['category'])) {
        $sql .= ' AND category_id IN (SELECT id FROM categories WHERE slug = ? OR name = ?)';
        $params[] = $query['category']; $params[] = $query['category'];
    }
    if (!empty($query['q'])) {
        $sql .= ' AND title LIKE ?';
        $params[] = '%' . $query['q'] . '%';
    }
    if (!empty($query['exclude'])) {
        $sql .= ' AND id != ?';
        $params[] = (int)$query['exclude'];
    }
    $sql .= ' ORDER BY is_featured DESC, students_count DESC';
    if (!empty($query['limit'])) {
        $sql .= ' LIMIT ' . (int)$query['limit'];
    }
    $stmt = db()->prepare($sql);
    $stmt->execute($params);
    $rows = array_map('course_out', $stmt->fetchAll());
    json_response(['courses' => $rows, 'total' => count($rows)]);
});

route('GET', '/courses/featured', function () {
    $rows = db()->query('SELECT * FROM courses WHERE status="published" AND is_featured = 1 ORDER BY students_count DESC LIMIT 8')->fetchAll();
    json_response(['courses' => array_map('course_out', $rows)]);
});

route('GET', '/courses/trending', function () {
    $rows = db()->query('SELECT * FROM courses WHERE status="published" ORDER BY students_count DESC LIMIT 8')->fetchAll();
    json_response(['courses' => array_map('course_out', $rows)]);
});

route('GET', '/courses/search', function () use ($query) {
    $q = $query['q'] ?? '';
    $stmt = db()->prepare('SELECT * FROM courses WHERE status="published" AND (title LIKE ? OR description LIKE ?) LIMIT 20');
    $like = '%' . $q . '%';
    $stmt->execute([$like, $like]);
    json_response(['courses' => array_map('course_out', $stmt->fetchAll())]);
});

route('GET', '/courses/{id}', function ($id) {
    $stmt = db()->prepare('SELECT * FROM courses WHERE id = ? OR slug = ?');
    $stmt->execute([$id, $id]);
    $c = $stmt->fetch();
    if (!$c) error_response('Course not found.', 404);
    $out = course_out($c);

    $lessons = db()->prepare('SELECT * FROM lessons WHERE course_id = ? ORDER BY sort_order');
    $lessons->execute([$c['id']]);
    $out['lessons'] = $lessons->fetchAll();

    json_response($out);
});

route('POST', '/courses/{id}/enroll', function ($id) {
    $user = require_auth();
    $stmt = db()->prepare('SELECT * FROM courses WHERE id = ?');
    $stmt->execute([$id]);
    $course = $stmt->fetch();
    if (!$course) error_response('Course not found.', 404);

    $existing = db()->prepare('SELECT id FROM enrollments WHERE user_id = ? AND course_id = ?');
    $existing->execute([$user['id'], $id]);
    if ($existing->fetch()) {
        json_response(['message' => 'Already enrolled.']);
    }

    if ((float)$course['price'] > 0) {
        error_response('This course requires payment. Please check out first.', 402);
    }

    $stmt = db()->prepare('INSERT INTO enrollments (user_id, course_id, price_paid, last_accessed_at) VALUES (?, ?, 0, CURRENT_TIMESTAMP)');
    $stmt->execute([$user['id'], $id]);
    db()->prepare('UPDATE courses SET students_count = students_count + 1 WHERE id = ?')->execute([$id]);

    json_response(['message' => 'Enrolled successfully.'], 201);
});

route('GET', '/courses/{id}/progress', function ($id) {
    $user = require_auth();
    $stmt = db()->prepare('SELECT * FROM enrollments WHERE user_id = ? AND course_id = ?');
    $stmt->execute([$user['id'], $id]);
    $enr = $stmt->fetch();
    if (!$enr) error_response('You are not enrolled in this course.', 403);

    $lp = db()->prepare('SELECT lesson_id, is_completed FROM lesson_progress WHERE user_id = ? AND course_id = ?');
    $lp->execute([$user['id'], $id]);
    json_response([
        'progress_pct' => (int)$enr['progress_pct'],
        'status' => $enr['status'],
        'completed_lessons' => array_column(array_filter($lp->fetchAll(), fn($r) => $r['is_completed']), 'lesson_id'),
    ]);
});

route('PATCH', '/courses/{courseId}/progress/{lessonId}', function ($courseId, $lessonId) {
    $user = require_auth();
    $stmt = db()->prepare('SELECT * FROM enrollments WHERE user_id = ? AND course_id = ?');
    $stmt->execute([$user['id'], $courseId]);
    $enr = $stmt->fetch();
    if (!$enr) error_response('You are not enrolled in this course.', 403);

    $b = body();
    $completed = !empty($b['completed']);

    $up = db()->prepare('INSERT INTO lesson_progress (user_id, lesson_id, course_id, is_completed, completed_at)
        VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(user_id, lesson_id) DO UPDATE SET is_completed = excluded.is_completed, completed_at = excluded.completed_at');
    $up->execute([$user['id'], $lessonId, $courseId, $completed ? 1 : 0]);

    // Recompute progress_pct from lesson count
    $total = db()->prepare('SELECT COUNT(*) c FROM lessons WHERE course_id = ?');
    $total->execute([$courseId]);
    $totalCount = (int)$total->fetch()['c'];
    $done = db()->prepare('SELECT COUNT(*) c FROM lesson_progress WHERE user_id = ? AND course_id = ? AND is_completed = 1');
    $done->execute([$user['id'], $courseId]);
    $doneCount = (int)$done->fetch()['c'];
    $pct = $totalCount > 0 ? (int)round($doneCount / $totalCount * 100) : (int)$body['progress_pct'] ?? 0;
    if (!empty($b['progress_pct'])) $pct = max($pct, (int)$b['progress_pct']);

    $status = $pct >= 100 ? 'completed' : 'active';
    $completedAt = $pct >= 100 ? ", completed_at = CURRENT_TIMESTAMP" : "";
    db()->prepare("UPDATE enrollments SET progress_pct = ?, status = ?, last_accessed_at = CURRENT_TIMESTAMP $completedAt WHERE user_id = ? AND course_id = ?")
        ->execute([$pct, $status, $user['id'], $courseId]);

    json_response(['progress_pct' => $pct, 'status' => $status]);
});

route('GET', '/courses/{id}/reviews', function ($id) {
    $stmt = db()->prepare('SELECT r.*, u.first_name, u.last_name FROM reviews r JOIN users u ON u.id = r.user_id WHERE r.course_id = ? AND r.status = "approved" ORDER BY r.created_at DESC');
    $stmt->execute([$id]);
    json_response(['reviews' => $stmt->fetchAll()]);
});

route('POST', '/courses/{id}/reviews', function ($id) {
    $user = require_auth();
    $enrolled = db()->prepare('SELECT id FROM enrollments WHERE user_id = ? AND course_id = ?');
    $enrolled->execute([$user['id'], $id]);
    if (!$enrolled->fetch()) error_response('You must be enrolled to review this course.', 403);

    $b = body();
    $rating = (int)($b['rating'] ?? 0);
    if ($rating < 1 || $rating > 5) error_response('Rating must be between 1 and 5.', 422);

    $stmt = db()->prepare('INSERT INTO reviews (user_id, course_id, rating, title, comment) VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(user_id, course_id) DO UPDATE SET rating = excluded.rating, title = excluded.title, comment = excluded.comment');
    $stmt->execute([$user['id'], $id, $rating, $b['title'] ?? '', $b['comment'] ?? '']);

    $agg = db()->prepare('SELECT AVG(rating) avg_r, COUNT(*) c FROM reviews WHERE course_id = ? AND status = "approved"');
    $agg->execute([$id]);
    $a = $agg->fetch();
    db()->prepare('UPDATE courses SET rating = ?, reviews_count = ? WHERE id = ?')->execute([round((float)$a['avg_r'], 2), (int)$a['c'], $id]);

    json_response(['message' => 'Review submitted.'], 201);
});

// ────────────────────────────────────────────────────────────
// QUIZ (course-level quiz, used by quiz.html)
// ────────────────────────────────────────────────────────────
route('GET', '/courses/{id}/quiz', function ($id) {
    require_auth();
    $stmt = db()->prepare('SELECT id, question, options, sort_order FROM quiz_questions WHERE course_id = ? ORDER BY sort_order');
    $stmt->execute([$id]);
    $qs = array_map(function ($r) {
        $r['options'] = json_decode($r['options'], true);
        return $r;
    }, $stmt->fetchAll());
    json_response(['questions' => $qs]);
});

route('POST', '/courses/{id}/quiz/check', function ($id) {
    require_auth();
    $b = body();
    $stmt = db()->prepare('SELECT * FROM quiz_questions WHERE id = ? AND course_id = ?');
    $stmt->execute([$b['question_id'] ?? 0, $id]);
    $q = $stmt->fetch();
    if (!$q) error_response('Question not found.', 404);
    $correct = (int)$q['correct_answer'] === (int)($b['selected'] ?? -1);
    json_response(['correct' => $correct, 'correct_answer' => (int)$q['correct_answer'], 'explanation' => $q['explanation']]);
});

route('POST', '/courses/{id}/quiz/submit', function ($id) {
    $user = require_auth();
    $b = body();
    $answers = $b['answers'] ?? []; // {question_id: chosen_index}

    $stmt = db()->prepare('SELECT id, correct_answer FROM quiz_questions WHERE course_id = ?');
    $stmt->execute([$id]);
    $questions = $stmt->fetchAll();

    $score = 0;
    foreach ($questions as $q) {
        $chosen = $answers[(string)$q['id']] ?? $answers[$q['id']] ?? null;
        if ($chosen !== null && (int)$chosen === (int)$q['correct_answer']) $score++;
    }
    $total = count($questions);
    $pct = $total > 0 ? (int)round($score / $total * 100) : 0;
    $passed = $pct >= 60;

    $ins = db()->prepare('INSERT INTO quiz_attempts (user_id, course_id, answers, score, total_questions, passed) VALUES (?, ?, ?, ?, ?, ?)');
    $ins->execute([$user['id'], $id, json_encode($answers), $score, $total, $passed ? 1 : 0]);

    if ($passed) {
        $c = db()->prepare('SELECT title FROM courses WHERE id = ?');
        $c->execute([$id]);
        $title = $c->fetch()['title'] ?? 'the course';
        db()->prepare('INSERT INTO notifications (user_id, title, body) VALUES (?, ?, ?)')
            ->execute([$user['id'], 'Quiz passed! 🎉', "You scored {$pct}% on the \"$title\" quiz."]);
    }

    json_response(['score' => $score, 'total_questions' => $total, 'percentage' => $pct, 'passed' => $passed]);
});

// ────────────────────────────────────────────────────────────
// USER
// ────────────────────────────────────────────────────────────
route('GET', '/user/profile', function () {
    $user = require_auth();
    json_response(public_user($user));
});

route('PUT', '/user/profile', function () {
    $user = require_auth();
    $b = body();
    $fields = ['first_name','last_name','bio','tagline','location','website','twitter','linkedin','github','youtube'];
    $set = []; $vals = [];
    foreach ($fields as $f) {
        if (array_key_exists($f, $b)) { $set[] = "$f = ?"; $vals[] = $b[$f]; }
    }
    if ($set) {
        $vals[] = $user['id'];
        db()->prepare('UPDATE users SET ' . implode(', ', $set) . ' WHERE id = ?')->execute($vals);
    }
    $stmt = db()->prepare('SELECT * FROM users WHERE id = ?');
    $stmt->execute([$user['id']]);
    json_response(public_user($stmt->fetch()));
});

route('PUT', '/user/password', function () {
    $user = require_auth();
    $b = body();
    if (empty($b['current_password']) || empty($b['password'])) error_response('Both current and new password are required.', 422);
    if (!password_verify($b['current_password'], $user['password'])) error_response('Current password is incorrect.', 401);
    db()->prepare('UPDATE users SET password = ? WHERE id = ?')->execute([password_hash($b['password'], PASSWORD_DEFAULT), $user['id']]);
    json_response(['message' => 'Password updated.']);
});

route('GET', '/user/courses', function () {
    $user = require_auth();
    $stmt = db()->prepare('SELECT e.*, c.*, e.id as enrollment_id, e.status as enrollment_status_raw FROM enrollments e JOIN courses c ON c.id = e.course_id WHERE e.user_id = ? ORDER BY e.last_accessed_at DESC');
    $stmt->execute([$user['id']]);
    $rows = $stmt->fetchAll();
    $out = array_map(function ($r) {
        $c = course_out($r);
        $c['progress_pct'] = (int)$r['progress_pct'];
        $c['enrollment_status'] = $r['enrollment_status_raw'];
        return $c;
    }, $rows);
    json_response(['courses' => $out]);
});

route('GET', '/user/certificates', function () {
    $user = require_auth();
    $stmt = db()->prepare("SELECT e.*, c.title as course_title, c.emoji, u2.first_name as instr_first, u2.last_name as instr_last
        FROM enrollments e JOIN courses c ON c.id = e.course_id JOIN users u2 ON u2.id = c.instructor_id
        WHERE e.user_id = ? AND e.status = 'completed' ORDER BY e.completed_at DESC");
    $stmt->execute([$user['id']]);
    $rows = $stmt->fetchAll();
    $certs = array_map(fn($r) => [
        'course_id' => (int)$r['course_id'],
        'course_title' => $r['course_title'],
        'emoji' => $r['emoji'],
        'instructor_name' => trim($r['instr_first'] . ' ' . $r['instr_last']),
        'credential_id' => credential_id((int)$user['id'], (int)$r['course_id'], $r['completed_at'] ?? ''),
        'issued_at' => $r['completed_at'],
    ], $rows);
    json_response(['certificates' => $certs]);
});

route('GET', '/user/achievements', function () {
    require_auth();
    json_response(['achievements' => []]);
});

route('GET', '/user/notifications', function () {
    $user = require_auth();
    $stmt = db()->prepare('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50');
    $stmt->execute([$user['id']]);
    json_response(['notifications' => $stmt->fetchAll()]);
});

route('PATCH', '/user/notifications/{id}/read', function ($id) {
    $user = require_auth();
    db()->prepare('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?')->execute([$id, $user['id']]);
    json_response(['message' => 'ok']);
});

route('GET', '/user/wishlist', function () {
    $user = require_auth();
    $stmt = db()->prepare('SELECT c.* FROM wishlists w JOIN courses c ON c.id = w.course_id WHERE w.user_id = ?');
    $stmt->execute([$user['id']]);
    json_response(['courses' => array_map('course_out', $stmt->fetchAll())]);
});

route('POST', '/user/wishlist', function () {
    $user = require_auth();
    $b = body();
    db()->prepare('INSERT OR IGNORE INTO wishlists (user_id, course_id) VALUES (?, ?)')->execute([$user['id'], $b['course_id'] ?? 0]);
    json_response(['message' => 'Added to wishlist.'], 201);
});

route('DELETE', '/user/wishlist/{courseId}', function ($courseId) {
    $user = require_auth();
    db()->prepare('DELETE FROM wishlists WHERE user_id = ? AND course_id = ?')->execute([$user['id'], $courseId]);
    json_response(['message' => 'Removed from wishlist.']);
});

// ────────────────────────────────────────────────────────────
// CART
// ────────────────────────────────────────────────────────────
function cart_out(int $userId): array {
    $stmt = db()->prepare('SELECT c.* FROM carts ca JOIN courses c ON c.id = ca.course_id WHERE ca.user_id = ? ORDER BY ca.created_at');
    $stmt->execute([$userId]);
    $items = array_map('course_out', $stmt->fetchAll());
    $subtotal = array_sum(array_column($items, 'price'));
    return ['items' => $items, 'subtotal' => $subtotal, 'currency' => 'GHS'];
}

route('GET', '/cart', function () {
    $user = require_auth();
    json_response(cart_out((int)$user['id']));
});

route('POST', '/cart', function () {
    $user = require_auth();
    $b = body();
    $courseId = (int)($b['course_id'] ?? 0);
    $c = db()->prepare('SELECT id FROM courses WHERE id = ?');
    $c->execute([$courseId]);
    if (!$c->fetch()) error_response('Course not found.', 404);
    db()->prepare('INSERT OR IGNORE INTO carts (user_id, course_id) VALUES (?, ?)')->execute([$user['id'], $courseId]);
    json_response(cart_out((int)$user['id']), 201);
});

route('DELETE', '/cart/{courseId}', function ($courseId) {
    $user = require_auth();
    db()->prepare('DELETE FROM carts WHERE user_id = ? AND course_id = ?')->execute([$user['id'], $courseId]);
    json_response(cart_out((int)$user['id']));
});

route('DELETE', '/cart', function () {
    $user = require_auth();
    db()->prepare('DELETE FROM carts WHERE user_id = ?')->execute([$user['id']]);
    json_response(['message' => 'Cart cleared.']);
});

route('POST', '/cart/coupon', function () {
    require_auth();
    $b = body();
    $code = strtoupper(trim($b['code'] ?? ''));
    $known = ['WELCOME10' => 0.10, 'STUDENT20' => 0.20];
    if (!isset($known[$code])) error_response('Invalid or expired coupon code.', 422);
    json_response(['code' => $code, 'discount_pct' => $known[$code] * 100]);
});

// ────────────────────────────────────────────────────────────
// PAYMENTS / CHECKOUT
// ────────────────────────────────────────────────────────────
/**
 * Real, shared order-finalization logic: enrolls the student, splits
 * instructor earnings 70/30, sends the notification, and clears the cart.
 * Does NOT insert order_items — the caller is responsible for that, since
 * the real-payment path inserts them at pending-order creation time (before
 * payment completes) while demo mode inserts them here at instant-completion
 * time; each caller does it exactly once.
 */
function finalize_paid_order(PDO $pdo, int $orderId, int $userId, array $cartItems, string $orderNumber): void {
    foreach ($cartItems as $item) {
        $exists = $pdo->prepare('SELECT id FROM enrollments WHERE user_id = ? AND course_id = ?');
        $exists->execute([$userId, $item['id']]);
        if (!$exists->fetch()) {
            $pdo->prepare('INSERT INTO enrollments (user_id, course_id, order_id, price_paid, last_accessed_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)')
                ->execute([$userId, $item['id'], $orderId, $item['price']]);
            $pdo->prepare('UPDATE courses SET students_count = students_count + 1 WHERE id = ?')->execute([$item['id']]);
        }

        $gross = $item['price'];
        $fee = round($gross * PLATFORM_FEE_PCT, 2);
        $net = round($gross - $fee, 2);
        $pdo->prepare('INSERT INTO earnings (instructor_id, course_id, gross_amount, platform_fee, net_amount, status) VALUES (?, ?, ?, ?, ?, "available")')
            ->execute([$item['instructor_id'], $item['id'], $gross, $fee, $net]);

        $pdo->prepare('INSERT INTO notifications (user_id, title, body) VALUES (?, ?, ?)')
            ->execute([$userId, 'Payment successful — Order ' . $orderNumber, "You've been enrolled in \"{$item['title']}\". Happy learning!"]);
    }
    $pdo->prepare('DELETE FROM carts WHERE user_id = ?')->execute([$userId]);
}

route('POST', '/payments/checkout', function () {
    $user = require_auth();
    $b = body();
    $cart = cart_out((int)$user['id']);
    if (!$cart['items']) error_response('Your cart is empty.', 422);

    $discountPct = 0;
    if (!empty($b['coupon_code'])) {
        $known = ['WELCOME10' => 0.10, 'STUDENT20' => 0.20];
        $code = strtoupper(trim($b['coupon_code']));
        if (isset($known[$code])) $discountPct = $known[$code];
    }
    $subtotal = $cart['subtotal'];
    $discount = round($subtotal * $discountPct, 2);
    $total = round($subtotal - $discount, 2);
    $method = in_array($b['payment_method'] ?? 'momo', ['momo', 'card', 'free'], true) ? $b['payment_method'] : 'momo';

    $pdo = db();

    // ── REAL PAYMENT MODE: Paystack is configured ───────────────
    if (paystack_is_configured() && $total > 0) {
        $orderNumber = order_number();
        $reference = 'PSK-' . strtoupper(bin2hex(random_bytes(8)));
        $ins = $pdo->prepare('INSERT INTO orders (order_number, user_id, subtotal, discount, total, currency, payment_method, status, payment_reference)
            VALUES (?, ?, ?, ?, ?, "GHS", ?, "pending", ?)');
        $ins->execute([$orderNumber, $user['id'], $subtotal, $discount, $total, $method, $reference]);
        $orderId = (int)$pdo->lastInsertId();

        // Record what was in the cart now, so the confirm/webhook step can
        // finalize the exact items purchased even after the cart is cleared.
        foreach ($cart['items'] as $item) {
            $pdo->prepare('INSERT INTO order_items (order_id, course_id, course_title, price) VALUES (?, ?, ?, ?)')
                ->execute([$orderId, $item['id'], $item['title'], $item['price']]);
        }

        try {
            $callbackUrl = rtrim(env('APP_URL', ''), '/') . '/payment-success.html?reference=' . $reference;
            $paystackData = paystack_initialize($user['email'], $total, $reference, $callbackUrl, ['order_id' => $orderId]);
        } catch (Throwable $e) {
            error_response('Could not start payment: ' . $e->getMessage(), 502);
        }

        json_response([
            'mode' => 'redirect',
            'authorization_url' => $paystackData['authorization_url'] ?? null,
            'reference' => $reference,
            'order_number' => $orderNumber,
            'total' => $total,
            'currency' => 'GHS',
            'status' => 'pending',
        ], 201);
    }

    // ── DEMO MODE: no real gateway configured — completes instantly ──
    $pdo->beginTransaction();
    try {
        $orderNumber = order_number();
        $ins = $pdo->prepare('INSERT INTO orders (order_number, user_id, subtotal, discount, total, currency, payment_method, status, payment_reference, paid_at)
            VALUES (?, ?, ?, ?, ?, "GHS", ?, "paid", ?, CURRENT_TIMESTAMP)');
        $ref = 'PSK-' . strtoupper(bin2hex(random_bytes(6)));
        $ins->execute([$orderNumber, $user['id'], $subtotal, $discount, $total, $method, $ref]);
        $orderId = (int)$pdo->lastInsertId();

        foreach ($cart['items'] as $item) {
            $pdo->prepare('INSERT INTO order_items (order_id, course_id, course_title, price) VALUES (?, ?, ?, ?)')
                ->execute([$orderId, $item['id'], $item['title'], $item['price']]);
        }

        finalize_paid_order($pdo, $orderId, (int)$user['id'], $cart['items'], $orderNumber);
        $pdo->commit();
    } catch (Throwable $e) {
        $pdo->rollBack();
        error_response('Checkout failed: ' . $e->getMessage(), 500);
    }

    json_response([
        'mode' => 'instant',
        'order_number' => $orderNumber,
        'reference' => $ref,
        'subtotal' => $subtotal,
        'discount' => $discount,
        'total' => $total,
        'currency' => 'GHS',
        'status' => 'paid',

        'items' => $cart['items'],
    ], 201);
});

route('GET', '/payments/verify/{ref}', function ($ref) {
    $user = require_auth();
    $stmt = db()->prepare('SELECT * FROM orders WHERE payment_reference = ? AND user_id = ?');
    $stmt->execute([$ref, $user['id']]);
    $order = $stmt->fetch();
    if (!$order) error_response('Order not found.', 404);
    json_response($order);
});

/**
 * Called by the frontend after Paystack redirects the browser back
 * (checkout.html's callback_url points here indirectly via payment-success.html).
 * Confirms the payment really succeeded with Paystack's server (never trust
 * the redirect alone — that's spoofable) before finalizing the order.
 * Idempotent: if the webhook already finalized this order, this just
 * returns the existing paid order.
 */
route('POST', '/payments/paystack/confirm/{ref}', function ($ref) {
    $user = require_auth();
    if (!paystack_is_configured()) error_response('Payment gateway not configured.', 400);

    $stmt = db()->prepare('SELECT * FROM orders WHERE payment_reference = ? AND user_id = ?');
    $stmt->execute([$ref, $user['id']]);
    $order = $stmt->fetch();
    if (!$order) error_response('Order not found.', 404);

    $buildItemCourses = function (int $orderId) {
        $itemsStmt = db()->prepare('SELECT oi.course_id as id, oi.course_title as title, oi.price, c.instructor_id
            FROM order_items oi JOIN courses c ON c.id = oi.course_id WHERE oi.order_id = ?');
        $itemsStmt->execute([$orderId]);
        return $itemsStmt->fetchAll();
    };

    if ($order['status'] === 'paid') {
        $items = $buildItemCourses((int)$order['id']);
        $courses = array_map(function ($it) {
            $c = db()->prepare('SELECT * FROM courses WHERE id = ?');
            $c->execute([$it['id']]);
            return course_out($c->fetch());
        }, $items);
        json_response(['status' => 'paid', 'order_number' => $order['order_number'], 'total' => (float)$order['total'], 'currency' => 'GHS', 'items' => $courses, 'already_finalized' => true]);
    }

    try {
        $txn = paystack_verify($ref);
    } catch (Throwable $e) {
        error_response('Could not verify payment: ' . $e->getMessage(), 502);
    }

    if (($txn['status'] ?? '') !== 'success') {
        db()->prepare('UPDATE orders SET status = "failed" WHERE id = ?')->execute([$order['id']]);
        error_response('Payment was not successful.', 402);
    }

    $items = $buildItemCourses((int)$order['id']);
    $pdo = db();
    $pdo->beginTransaction();
    try {
        if ($items) {
            finalize_paid_order($pdo, (int)$order['id'], (int)$user['id'], $items, $order['order_number']);
        }
        $pdo->prepare('UPDATE orders SET status = "paid", paid_at = CURRENT_TIMESTAMP WHERE id = ?')->execute([$order['id']]);
        $pdo->commit();
    } catch (Throwable $e) {
        $pdo->rollBack();
        error_response('Could not finalize order: ' . $e->getMessage(), 500);
    }

    $courses = array_map(function ($it) {
        $c = db()->prepare('SELECT * FROM courses WHERE id = ?');
        $c->execute([$it['id']]);
        return course_out($c->fetch());
    }, $items);
    json_response(['status' => 'paid', 'order_number' => $order['order_number'], 'total' => (float)$order['total'], 'currency' => 'GHS', 'items' => $courses]);
});

/**
 * Real Paystack webhook receiver. This is the RECOMMENDED way to confirm
 * payment in production (more reliable than the browser redirect alone,
 * which can fail to fire if the user closes the tab). Verifies the real
 * HMAC-SHA512 signature Paystack sends before trusting the payload.
 * Configure this URL as your webhook in the Paystack dashboard:
 *   https://yourdomain.com/api/payments/paystack/webhook
 */
route('POST', '/payments/paystack/webhook', function () {
    $raw = file_get_contents('php://input');
    $signature = $_SERVER['HTTP_X_PAYSTACK_SIGNATURE'] ?? '';
    if (!paystack_verify_webhook_signature($raw, $signature)) {
        error_response('Invalid signature.', 401);
    }

    $event = json_decode($raw, true);
    if (($event['event'] ?? '') !== 'charge.success') {
        json_response(['message' => 'Event ignored.']);
    }

    $ref = $event['data']['reference'] ?? '';
    $stmt = db()->prepare('SELECT * FROM orders WHERE payment_reference = ?');
    $stmt->execute([$ref]);
    $order = $stmt->fetch();
    if (!$order || $order['status'] === 'paid') {
        json_response(['message' => 'Nothing to do.']); // unknown or already finalized — idempotent
    }

    $pdo = db();
    $pdo->beginTransaction();
    try {
        $itemsStmt = $pdo->prepare('SELECT oi.course_id as id, oi.course_title as title, oi.price, c.instructor_id
            FROM order_items oi JOIN courses c ON c.id = oi.course_id WHERE oi.order_id = ?');
        $itemsStmt->execute([$order['id']]);
        $items = $itemsStmt->fetchAll();
        if ($items) {
            finalize_paid_order($pdo, (int)$order['id'], (int)$order['user_id'], $items, $order['order_number']);
        }
        $pdo->prepare('UPDATE orders SET status = "paid", paid_at = CURRENT_TIMESTAMP WHERE id = ?')->execute([$order['id']]);
        $pdo->commit();
    } catch (Throwable $e) {
        $pdo->rollBack();
        error_log('Paystack webhook finalize failed: ' . $e->getMessage());
    }

    json_response(['message' => 'ok']);
});

route('GET', '/payments/history', function () {
    $user = require_auth();
    $stmt = db()->prepare('SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC');
    $stmt->execute([$user['id']]);
    json_response(['orders' => $stmt->fetchAll()]);
});

// ────────────────────────────────────────────────────────────
// INSTRUCTOR
// ────────────────────────────────────────────────────────────
route('GET', '/instructor/dashboard', function () {
    $user = require_auth(['instructor', 'admin']);
    $courses = db()->prepare('SELECT * FROM courses WHERE instructor_id = ?');
    $courses->execute([$user['id']]);
    $courseRows = $courses->fetchAll();
    $courseIds = array_column($courseRows, 'id');

    $totalStudents = 0; $totalEarnings = 0;
    if ($courseIds) {
        $in = implode(',', array_fill(0, count($courseIds), '?'));
        $st = db()->prepare("SELECT COUNT(DISTINCT user_id) c FROM enrollments WHERE course_id IN ($in)");
        $st->execute($courseIds);
        $totalStudents = (int)$st->fetch()['c'];

        $er = db()->prepare("SELECT COALESCE(SUM(net_amount),0) s FROM earnings WHERE instructor_id = ?");
        $er->execute([$user['id']]);
        $totalEarnings = (float)$er->fetch()['s'];
    }

    json_response([
        'total_courses' => count($courseRows),
        'total_students' => $totalStudents,
        'total_earnings' => $totalEarnings,
        'currency' => 'GHS',
        'courses' => array_map('course_out', $courseRows),
    ]);
});

route('GET', '/instructor/courses', function () {
    $user = require_auth(['instructor', 'admin']);
    $stmt = db()->prepare('SELECT * FROM courses WHERE instructor_id = ? ORDER BY created_at DESC');
    $stmt->execute([$user['id']]);
    json_response(['courses' => array_map('course_out', $stmt->fetchAll())]);
});

route('POST', '/instructor/courses', function () {
    $user = require_auth(['instructor', 'admin']);
    $b = body();
    $title = trim($b['title'] ?? '');
    if (!$title) error_response('Course title is required.', 422);

    $slug = strtolower(trim(preg_replace('/[^a-zA-Z0-9]+/', '-', $title), '-')) . '-' . substr(bin2hex(random_bytes(3)), 0, 6);
    $categoryId = null;
    if (!empty($b['category'])) {
        $c = db()->prepare('SELECT id FROM categories WHERE name = ? OR slug = ?');
        $c->execute([$b['category'], $b['category']]);
        $catRow = $c->fetch();
        $categoryId = $catRow['id'] ?? null;
    }

    $stmt = db()->prepare('INSERT INTO courses (instructor_id, category_id, title, slug, subtitle, description, emoji, thumbnail_bg, price, original_price, level, status, what_you_learn)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
    $stmt->execute([
        $user['id'], $categoryId, $title, $slug,
        $b['subtitle'] ?? '', $b['description'] ?? '',
        $b['emoji'] ?? '📚', $b['thumbnail_bg'] ?? '#f0ece4',
        (float)($b['price'] ?? 0), isset($b['original_price']) ? (float)$b['original_price'] : null,
        $b['level'] ?? 'All Levels',
        in_array($b['status'] ?? 'draft', ['draft', 'published'], true) ? $b['status'] : 'draft',
        json_encode($b['what_you_learn'] ?? []),
    ]);
    $id = (int)db()->lastInsertId();
    $stmt = db()->prepare('SELECT * FROM courses WHERE id = ?');
    $stmt->execute([$id]);
    json_response(course_out($stmt->fetch()), 201);
});

function own_course_or_admin(array $user, $id): array {
    $stmt = db()->prepare('SELECT * FROM courses WHERE id = ?');
    $stmt->execute([$id]);
    $course = $stmt->fetch();
    if (!$course) error_response('Course not found.', 404);
    if ($user['role'] !== 'admin' && (int)$course['instructor_id'] !== (int)$user['id']) {
        error_response('You do not have permission to manage this course.', 403);
    }
    return $course;
}

route('GET', '/instructor/courses/{id}', function ($id) {
    $user = require_auth(['instructor', 'admin']);
    $course = own_course_or_admin($user, $id);
    $out = course_out($course);
    $lessons = db()->prepare('SELECT * FROM lessons WHERE course_id = ? ORDER BY sort_order');
    $lessons->execute([$id]);
    $out['lessons'] = $lessons->fetchAll();
    json_response($out);
});

route('PUT', '/instructor/courses/{id}', function ($id) {
    $user = require_auth(['instructor', 'admin']);
    own_course_or_admin($user, $id);
    $b = body();
    $fields = ['title','subtitle','description','emoji','thumbnail_bg','price','original_price','level','status'];
    $set = []; $vals = [];
    foreach ($fields as $f) {
        if (array_key_exists($f, $b)) { $set[] = "$f = ?"; $vals[] = $b[$f]; }
    }
    if (array_key_exists('what_you_learn', $b)) { $set[] = 'what_you_learn = ?'; $vals[] = json_encode($b['what_you_learn']); }
    if ($set) {
        $set[] = 'updated_at = CURRENT_TIMESTAMP';
        $vals[] = $id;
        db()->prepare('UPDATE courses SET ' . implode(', ', $set) . ' WHERE id = ?')->execute($vals);
    }
    $stmt = db()->prepare('SELECT * FROM courses WHERE id = ?');
    $stmt->execute([$id]);
    json_response(course_out($stmt->fetch()));
});

route('DELETE', '/instructor/courses/{id}', function ($id) {
    $user = require_auth(['instructor', 'admin']);
    own_course_or_admin($user, $id);
    db()->prepare('DELETE FROM courses WHERE id = ?')->execute([$id]);
    json_response(['message' => 'Course deleted.']);
});

// Lessons (simple flat list per course — used by course editor "Add Content")
route('GET', '/instructor/courses/{id}/lessons', function ($id) {
    $user = require_auth(['instructor', 'admin']);
    own_course_or_admin($user, $id);
    $stmt = db()->prepare('SELECT * FROM lessons WHERE course_id = ? ORDER BY sort_order');
    $stmt->execute([$id]);
    json_response(['lessons' => $stmt->fetchAll()]);
});

route('POST', '/instructor/courses/{id}/lessons', function ($id) {
    $user = require_auth(['instructor', 'admin']);
    own_course_or_admin($user, $id);
    $b = body();
    if (empty($b['title'])) error_response('Lesson title is required.', 422);
    $order = db()->prepare('SELECT COALESCE(MAX(sort_order), 0) + 1 n FROM lessons WHERE course_id = ?');
    $order->execute([$id]);
    $n = $order->fetch()['n'];
    $ins = db()->prepare('INSERT INTO lessons (course_id, title, type, duration_seconds, sort_order, is_free) VALUES (?, ?, ?, ?, ?, ?)');
    $ins->execute([$id, $b['title'], $b['type'] ?? 'video', (int)($b['duration_seconds'] ?? 0), $n, !empty($b['is_free']) ? 1 : 0]);
    db()->prepare('UPDATE courses SET lessons_count = lessons_count + 1 WHERE id = ?')->execute([$id]);
    json_response(['message' => 'Lesson added.', 'id' => (int)db()->lastInsertId()], 201);
});

route('PATCH', '/instructor/lessons/{id}', function ($id) {
    $user = require_auth(['instructor', 'admin']);
    $stmt = db()->prepare('SELECT l.*, c.instructor_id FROM lessons l JOIN courses c ON c.id = l.course_id WHERE l.id = ?');
    $stmt->execute([$id]);
    $lesson = $stmt->fetch();
    if (!$lesson) error_response('Lesson not found.', 404);
    if ($user['role'] !== 'admin' && (int)$lesson['instructor_id'] !== (int)$user['id']) {
        error_response('You do not have permission to edit this lesson.', 403);
    }

    $b = body();
    $fields = ['title', 'description'];
    $set = []; $vals = [];
    foreach ($fields as $f) {
        if (array_key_exists($f, $b)) { $set[] = "$f = ?"; $vals[] = $b[$f]; }
    }
    if (array_key_exists('is_free', $b)) { $set[] = 'is_free = ?'; $vals[] = !empty($b['is_free']) ? 1 : 0; }
    if (array_key_exists('is_downloadable', $b)) { $set[] = 'is_downloadable = ?'; $vals[] = !empty($b['is_downloadable']) ? 1 : 0; }
    if ($set) {
        $vals[] = $id;
        db()->prepare('UPDATE lessons SET ' . implode(', ', $set) . ' WHERE id = ?')->execute($vals);
    }

    $stmt = db()->prepare('SELECT * FROM lessons WHERE id = ?');
    $stmt->execute([$id]);
    json_response($stmt->fetch());
});

route('POST', '/instructor/courses/{id}/videos', function ($id) {
    $user = require_auth(['instructor', 'admin']);
    own_course_or_admin($user, $id);

    if (empty($_FILES['video'])) {
        error_response('No video file was received.', 422);
    }

    try {
        $stored = store_uploaded_video($_FILES['video']);
    } catch (RuntimeException $e) {
        error_response($e->getMessage(), 422);
    }

    $b = $_POST;
    $lessonId = $b['lesson_id'] ?? null;

    if ($lessonId) {
        // Attach to an existing lesson
        $check = db()->prepare('SELECT id FROM lessons WHERE id = ? AND course_id = ?');
        $check->execute([$lessonId, $id]);
        if (!$check->fetch()) error_response('Lesson not found on this course.', 404);
        db()->prepare('UPDATE lessons SET video_path = ?, video_original_name = ?, video_size_bytes = ? WHERE id = ?')
            ->execute([$stored['path'], $stored['original_name'], $stored['size_bytes'], $lessonId]);
    } else {
        // No lesson specified — create one from the uploaded file
        $title = $b['title'] ?? pathinfo($stored['original_name'], PATHINFO_FILENAME);
        $order = db()->prepare('SELECT COALESCE(MAX(sort_order), 0) + 1 n FROM lessons WHERE course_id = ?');
        $order->execute([$id]);
        $n = $order->fetch()['n'];
        $ins = db()->prepare('INSERT INTO lessons (course_id, title, type, sort_order, video_path, video_original_name, video_size_bytes) VALUES (?, ?, "video", ?, ?, ?, ?)');
        $ins->execute([$id, $title, $n, $stored['path'], $stored['original_name'], $stored['size_bytes']]);
        $lessonId = (int)db()->lastInsertId();
        db()->prepare('UPDATE courses SET lessons_count = lessons_count + 1 WHERE id = ?')->execute([$id]);
    }

    json_response([
        'message' => 'Video uploaded and saved.',
        'lesson_id' => (int)$lessonId,
        'url' => '/' . $stored['path'],
        'size_bytes' => $stored['size_bytes'],
    ], 201);
});

route('GET', '/instructor/courses/{id}/analytics', function ($id) {
    $user = require_auth(['instructor', 'admin']);
    own_course_or_admin($user, $id);
    $stmt = db()->prepare('SELECT COUNT(*) students, AVG(progress_pct) avg_progress FROM enrollments WHERE course_id = ?');
    $stmt->execute([$id]);
    $row = $stmt->fetch();
    $rev = db()->prepare('SELECT COALESCE(SUM(gross_amount),0) revenue FROM earnings WHERE course_id = ?');
    $rev->execute([$id]);
    json_response([
        'students' => (int)$row['students'],
        'avg_progress' => round((float)$row['avg_progress'], 1),
        'revenue' => (float)$rev->fetch()['revenue'],
        'currency' => 'GHS',
    ]);
});

route('GET', '/instructor/courses/{id}/students', function ($id) {
    $user = require_auth(['instructor', 'admin']);
    own_course_or_admin($user, $id);
    $stmt = db()->prepare('SELECT u.id, u.first_name, u.last_name, u.email, e.progress_pct, e.status, e.created_at
        FROM enrollments e JOIN users u ON u.id = e.user_id WHERE e.course_id = ? ORDER BY e.created_at DESC');
    $stmt->execute([$id]);
    json_response(['students' => $stmt->fetchAll()]);
});

route('GET', '/instructor/revenue', function () {
    $user = require_auth(['instructor', 'admin']);
    $stmt = db()->prepare('SELECT e.*, c.title as course_title FROM earnings e JOIN courses c ON c.id = e.course_id WHERE e.instructor_id = ? ORDER BY e.created_at DESC');
    $stmt->execute([$user['id']]);
    $rows = $stmt->fetchAll();
    $total = array_sum(array_column($rows, 'net_amount'));
    json_response(['earnings' => $rows, 'total_net' => $total, 'currency' => 'GHS']);
});

// ────────────────────────────────────────────────────────────
// ADMIN
// ────────────────────────────────────────────────────────────
route('GET', '/admin/stats', function () {
    require_auth(['admin']);
    $pdo = db();
    $users = (int)$pdo->query('SELECT COUNT(*) c FROM users')->fetch()['c'];
    $courses = (int)$pdo->query('SELECT COUNT(*) c FROM courses')->fetch()['c'];
    $revenue = (float)$pdo->query('SELECT COALESCE(SUM(total),0) s FROM orders WHERE status="paid"')->fetch()['s'];
    $enrollments = (int)$pdo->query('SELECT COUNT(*) c FROM enrollments')->fetch()['c'];
    json_response(['users' => $users, 'courses' => $courses, 'revenue' => $revenue, 'currency' => 'GHS', 'enrollments' => $enrollments]);
});

route('GET', '/admin/users', function () use ($query) {
    require_auth(['admin']);
    $sql = 'SELECT id, first_name, last_name, email, role, status, created_at FROM users WHERE 1=1';
    $params = [];
    if (!empty($query['role'])) { $sql .= ' AND role = ?'; $params[] = $query['role']; }
    if (!empty($query['q'])) { $sql .= ' AND (first_name LIKE ? OR last_name LIKE ? OR email LIKE ?)'; $like = '%'.$query['q'].'%'; array_push($params, $like, $like, $like); }
    $sql .= ' ORDER BY created_at DESC';
    $stmt = db()->prepare($sql);
    $stmt->execute($params);
    json_response(['users' => $stmt->fetchAll()]);
});

route('GET', '/admin/users/{id}', function ($id) {
    require_auth(['admin']);
    $stmt = db()->prepare('SELECT id, first_name, last_name, email, role, status, bio, created_at FROM users WHERE id = ?');
    $stmt->execute([$id]);
    $u = $stmt->fetch();
    if (!$u) error_response('User not found.', 404);
    json_response($u);
});

route('PATCH', '/admin/users/{id}', function ($id) {
    require_auth(['admin']);
    $b = body();
    $fields = ['first_name','last_name','role','status'];
    $set = []; $vals = [];
    foreach ($fields as $f) if (array_key_exists($f, $b)) { $set[] = "$f = ?"; $vals[] = $b[$f]; }
    if ($set) { $vals[] = $id; db()->prepare('UPDATE users SET '.implode(', ', $set).' WHERE id = ?')->execute($vals); }
    json_response(['message' => 'User updated.']);
});

route('PATCH', '/admin/users/{id}/suspend', function ($id) {
    require_auth(['admin']);
    $stmt = db()->prepare('SELECT status FROM users WHERE id = ?');
    $stmt->execute([$id]);
    $row = $stmt->fetch();
    if (!$row) error_response('User not found.', 404);
    $new = $row['status'] === 'suspended' ? 'active' : 'suspended';
    db()->prepare('UPDATE users SET status = ? WHERE id = ?')->execute([$new, $id]);
    json_response(['message' => "User is now $new.", 'status' => $new]);
});

route('DELETE', '/admin/users/{id}', function ($id) {
    require_auth(['admin']);
    db()->prepare('DELETE FROM users WHERE id = ?')->execute([$id]);
    json_response(['message' => 'User deleted.']);
});

route('GET', '/admin/courses', function () use ($query) {
    require_auth(['admin']);
    $sql = 'SELECT * FROM courses WHERE 1=1';
    $params = [];
    if (!empty($query['status'])) { $sql .= ' AND status = ?'; $params[] = $query['status']; }
    $sql .= ' ORDER BY created_at DESC';
    $stmt = db()->prepare($sql);
    $stmt->execute($params);
    json_response(['courses' => array_map('course_out', $stmt->fetchAll())]);
});

route('PATCH', '/admin/courses/{id}/approve', function ($id) {
    require_auth(['admin']);
    db()->prepare('UPDATE courses SET status = "published" WHERE id = ?')->execute([$id]);
    $c = db()->prepare('SELECT title, instructor_id FROM courses WHERE id = ?');
    $c->execute([$id]);
    $course = $c->fetch();
    if ($course) {
        db()->prepare('INSERT INTO notifications (user_id, title, body) VALUES (?, ?, ?)')
            ->execute([$course['instructor_id'], 'Course approved ✓', "\"{$course['title']}\" is now live on GITAcademy."]);
    }
    json_response(['message' => 'Course approved and published.']);
});

route('PATCH', '/admin/courses/{id}/reject', function ($id) {
    require_auth(['admin']);
    db()->prepare('UPDATE courses SET status = "archived" WHERE id = ?')->execute([$id]);
    json_response(['message' => 'Course rejected.']);
});

route('PATCH', '/admin/courses/{id}/featured', function ($id) {
    require_auth(['admin']);
    $stmt = db()->prepare('SELECT is_featured FROM courses WHERE id = ?');
    $stmt->execute([$id]);
    $row = $stmt->fetch();
    if (!$row) error_response('Course not found.', 404);
    $new = $row['is_featured'] ? 0 : 1;
    db()->prepare('UPDATE courses SET is_featured = ? WHERE id = ?')->execute([$new, $id]);
    json_response(['is_featured' => (bool)$new]);
});

route('DELETE', '/admin/courses/{id}', function ($id) {
    require_auth(['admin']);
    db()->prepare('DELETE FROM courses WHERE id = ?')->execute([$id]);
    json_response(['message' => 'Course deleted.']);
});

// Admin: categories CRUD
route('POST', '/admin/categories', function () {
    require_auth(['admin']);
    $b = body();
    if (empty($b['name'])) error_response('Category name is required.', 422);
    $slug = strtolower(trim(preg_replace('/[^a-zA-Z0-9]+/', '-', $b['name']), '-'));
    $stmt = db()->prepare('INSERT INTO categories (name, slug, emoji, color, description) VALUES (?, ?, ?, ?, ?)');
    $stmt->execute([$b['name'], $slug, $b['emoji'] ?? '📁', $b['color'] ?? '#2d4a3e', $b['description'] ?? '']);
    json_response(['id' => (int)db()->lastInsertId(), 'message' => 'Category created.'], 201);
});

route('PUT', '/admin/categories/{id}', function ($id) {
    require_auth(['admin']);
    $b = body();
    $fields = ['name','emoji','color','description','sort_order'];
    $set = []; $vals = [];
    foreach ($fields as $f) if (array_key_exists($f, $b)) { $set[] = "$f = ?"; $vals[] = $b[$f]; }
    if ($set) { $vals[] = $id; db()->prepare('UPDATE categories SET '.implode(', ', $set).' WHERE id = ?')->execute($vals); }
    json_response(['message' => 'Category updated.']);
});

route('PATCH', '/admin/categories/{id}/toggle', function ($id) {
    require_auth(['admin']);
    $stmt = db()->prepare('SELECT is_active FROM categories WHERE id = ?');
    $stmt->execute([$id]);
    $row = $stmt->fetch();
    if (!$row) error_response('Category not found.', 404);
    $new = $row['is_active'] ? 0 : 1;
    db()->prepare('UPDATE categories SET is_active = ? WHERE id = ?')->execute([$new, $id]);
    json_response(['is_active' => (bool)$new]);
});

route('DELETE', '/admin/categories/{id}', function ($id) {
    require_auth(['admin']);
    db()->prepare('DELETE FROM categories WHERE id = ?')->execute([$id]);
    json_response(['message' => 'Category deleted.']);
});

// Admin: reviews moderation
route('GET', '/admin/reviews', function () {
    require_auth(['admin']);
    $stmt = db()->query('SELECT r.*, u.first_name, u.last_name, c.title as course_title FROM reviews r
        JOIN users u ON u.id = r.user_id JOIN courses c ON c.id = r.course_id ORDER BY r.created_at DESC');
    json_response(['reviews' => $stmt->fetchAll()]);
});

route('PATCH', '/admin/reviews/{id}/status', function ($id) {
    require_auth(['admin']);
    $b = body();
    $status = in_array($b['status'] ?? '', ['pending','approved','flagged','removed'], true) ? $b['status'] : 'approved';
    db()->prepare('UPDATE reviews SET status = ? WHERE id = ?')->execute([$status, $id]);
    json_response(['message' => 'Review status updated.', 'status' => $status]);
});

route('DELETE', '/admin/reviews/{id}', function ($id) {
    require_auth(['admin']);
    db()->prepare('DELETE FROM reviews WHERE id = ?')->execute([$id]);
    json_response(['message' => 'Review deleted.']);
});

// Admin: payments
route('GET', '/admin/payments', function () {
    require_auth(['admin']);
    $stmt = db()->query('SELECT o.*, u.first_name, u.last_name, u.email FROM orders o JOIN users u ON u.id = o.user_id ORDER BY o.created_at DESC');
    json_response(['payments' => $stmt->fetchAll()]);
});

route('POST', '/admin/payments/{id}/refund', function ($id) {
    require_auth(['admin']);
    db()->prepare('UPDATE orders SET status = "refunded" WHERE id = ?')->execute([$id]);
    db()->prepare('UPDATE enrollments SET status = "refunded" WHERE order_id = ?')->execute([$id]);
    json_response(['message' => 'Order refunded.']);
});

route('GET', '/admin/activity', function () {
    require_auth(['admin']);
    $stmt = db()->query('SELECT "enrollment" as type, e.created_at, u.first_name, u.last_name, c.title FROM enrollments e
        JOIN users u ON u.id = e.user_id JOIN courses c ON c.id = e.course_id ORDER BY e.created_at DESC LIMIT 20');
    json_response(['activity' => $stmt->fetchAll()]);
});

// Admin: platform settings (key/value)
route('GET', '/admin/settings', function () {
    require_auth(['admin']);
    $rows = db()->query('SELECT key, value FROM settings')->fetchAll();
    $out = [];
    foreach ($rows as $r) $out[$r['key']] = $r['value'];
    json_response($out);
});

route('PATCH', '/admin/settings', function () {
    require_auth(['admin']);
    $b = body();
    $stmt = db()->prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
    foreach ($b as $k => $v) {
        $stmt->execute([$k, is_scalar($v) ? (string)$v : json_encode($v)]);
    }
    json_response(['message' => 'Settings saved.']);
});

// ────────────────────────────────────────────────────────────
// CONTACT (public — no auth required)
// ────────────────────────────────────────────────────────────
route('POST', '/contact', function () {
    $b = body();
    $email = trim($b['email'] ?? '');
    $message = trim($b['message'] ?? '');
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        error_response('Please enter a valid email address.', 422);
    }
    if (strlen($message) < 5) {
        error_response('Please enter a message.', 422);
    }
    $stmt = db()->prepare('INSERT INTO contact_messages (first_name, last_name, email, topic, message) VALUES (?, ?, ?, ?, ?)');
    $stmt->execute([$b['first_name'] ?? '', $b['last_name'] ?? '', $email, $b['topic'] ?? 'Other', $message]);
    json_response(['message' => 'Message received. We\'ll get back to you soon.'], 201);
});

route('GET', '/admin/contact-messages', function () {
    require_auth(['admin']);
    $rows = db()->query('SELECT * FROM contact_messages ORDER BY created_at DESC')->fetchAll();
    json_response(['messages' => $rows]);
});

// ────────────────────────────────────────────────────────────
// NOTES
// ────────────────────────────────────────────────────────────
route('GET', '/courses/{id}/notes', function ($id) {
    $user = require_auth();
    $stmt = db()->prepare('SELECT * FROM lesson_notes WHERE user_id = ? AND course_id = ? ORDER BY created_at DESC');
    $stmt->execute([$user['id'], $id]);
    json_response(['notes' => $stmt->fetchAll()]);
});

route('POST', '/courses/{id}/notes', function ($id) {
    $user = require_auth();
    $b = body();
    if (empty($b['content'])) error_response('Note content is required.', 422);
    $stmt = db()->prepare('INSERT INTO lesson_notes (user_id, course_id, lesson_id, content, timestamp_seconds) VALUES (?, ?, ?, ?, ?)');
    $stmt->execute([$user['id'], $id, $b['lesson_id'] ?? null, $b['content'], (int)($b['timestamp'] ?? 0)]);
    json_response(['id' => (int)db()->lastInsertId(), 'message' => 'Note saved.'], 201);
});

route('DELETE', '/notes/{id}', function ($id) {
    $user = require_auth();
    db()->prepare('DELETE FROM lesson_notes WHERE id = ? AND user_id = ?')->execute([$id, $user['id']]);
    json_response(['message' => 'Note deleted.']);
});

// ────────────────────────────────────────────────────────────
// Q&A
// ────────────────────────────────────────────────────────────
route('GET', '/courses/{courseId}/lessons/{lessonId}/qa', function ($courseId, $lessonId) {
    require_auth();
    $stmt = db()->prepare('SELECT q.*, u.first_name, u.last_name FROM qa_questions q JOIN users u ON u.id = q.user_id
        WHERE q.course_id = ? AND q.lesson_id = ? ORDER BY q.created_at DESC');
    $stmt->execute([$courseId, $lessonId]);
    $questions = $stmt->fetchAll();
    foreach ($questions as &$q) {
        $r = db()->prepare('SELECT r.*, u.first_name, u.last_name FROM qa_replies r JOIN users u ON u.id = r.user_id WHERE r.qa_id = ? ORDER BY r.created_at');
        $r->execute([$q['id']]);
        $q['replies'] = $r->fetchAll();
    }
    json_response(['questions' => $questions]);
});

route('POST', '/courses/{courseId}/lessons/{lessonId}/qa', function ($courseId, $lessonId) {
    $user = require_auth();
    $b = body();
    if (empty($b['question'])) error_response('Question text is required.', 422);
    $stmt = db()->prepare('INSERT INTO qa_questions (user_id, course_id, lesson_id, question) VALUES (?, ?, ?, ?)');
    $stmt->execute([$user['id'], $courseId, $lessonId, $b['question']]);
    json_response(['id' => (int)db()->lastInsertId(), 'message' => 'Question posted.'], 201);
});

route('POST', '/qa/{id}/reply', function ($id) {
    $user = require_auth();
    $b = body();
    if (empty($b['answer'])) error_response('Answer text is required.', 422);
    db()->prepare('INSERT INTO qa_replies (qa_id, user_id, answer) VALUES (?, ?, ?)')->execute([$id, $user['id'], $b['answer']]);
    json_response(['message' => 'Reply posted.'], 201);
});

route('POST', '/qa/{id}/upvote', function ($id) {
    require_auth();
    db()->prepare('UPDATE qa_questions SET upvotes = upvotes + 1 WHERE id = ?')->execute([$id]);
    $stmt = db()->prepare('SELECT upvotes FROM qa_questions WHERE id = ?');
    $stmt->execute([$id]);
    json_response(['upvotes' => (int)$stmt->fetch()['upvotes']]);
});

// ────────────────────────────────────────────────────────────
// INSTRUCTORS (public profile)
// ────────────────────────────────────────────────────────────
route('GET', '/instructors/{id}', function ($id) {
    $stmt = db()->prepare('SELECT id, first_name, last_name, bio, avatar FROM users WHERE id = ? AND role IN ("instructor", "admin")');
    $stmt->execute([$id]);
    $instr = $stmt->fetch();
    if (!$instr) error_response('Instructor not found.', 404);

    $s = db()->prepare('SELECT COUNT(*) courses_count, COALESCE(SUM(students_count),0) students_count, COALESCE(AVG(NULLIF(rating,0)),0) rating, COALESCE(SUM(reviews_count),0) reviews_count FROM courses WHERE instructor_id = ? AND status = "published"');
    $s->execute([$id]);
    $stats = $s->fetch();

    $courses = db()->prepare('SELECT * FROM courses WHERE instructor_id = ? AND status = "published" ORDER BY students_count DESC');
    $courses->execute([$id]);

    json_response([
        'id' => (int)$instr['id'],
        'name' => trim($instr['first_name'] . ' ' . $instr['last_name']),
        'title' => $instr['bio'] ?? '',
        'rating' => round((float)$stats['rating'], 1),
        'students_count' => (int)$stats['students_count'],
        'courses_count' => (int)$stats['courses_count'],
        'reviews_count' => (int)$stats['reviews_count'],
        'courses' => array_map('course_out', $courses->fetchAll()),
    ]);
});

// ────────────────────────────────────────────────────────────
// SEARCH
// ────────────────────────────────────────────────────────────
route('GET', '/search', function () use ($query) {
    $q = $query['q'] ?? '';
    $like = '%' . $q . '%';
    $stmt = db()->prepare('SELECT * FROM courses WHERE status="published" AND title LIKE ? LIMIT 10');
    $stmt->execute([$like]);
    json_response(['courses' => array_map('course_out', $stmt->fetchAll())]);
});

// ────────────────────────────────────────────────────────────
// DISPATCH
// ────────────────────────────────────────────────────────────
foreach ($routes as [$m, $pattern, $handler]) {
    if ($m !== $method) continue;
    $params = match_route($pattern, $path);
    if ($params === null) continue;
    try {
        $handler(...$params);
        exit;
    } catch (Throwable $e) {
        error_response('Server error: ' . $e->getMessage(), 500);
    }
}

error_response("Not found: $method $path", 404);
