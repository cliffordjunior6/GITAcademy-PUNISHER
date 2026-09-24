<?php
/**
 * Seeds api/database.sqlite with fictional demo data.
 * Run once: php api/seed.php
 * Safe to re-run: it wipes and recreates the database file first.
 *
 * NOTE: All accounts below are fictional demo data for local
 * presentation only — none belong to real people.
 */
declare(strict_types=1);
require_once __DIR__ . '/bootstrap.php';

if (file_exists(DB_PATH)) unlink(DB_PATH);
$pdo = db(); // creates schema fresh

$root = dirname(__DIR__);

// ── Categories ──────────────────────────────────────────────
$categories = json_decode(file_get_contents("$root/categories.json"), true)['categories'] ?? [];
$catSlugToId = [];
$stmt = $pdo->prepare('INSERT INTO categories (name, slug, emoji, color, description, sort_order) VALUES (?, ?, ?, ?, ?, ?)');
foreach ($categories as $i => $c) {
    $stmt->execute([$c['name'], $c['slug'], $c['emoji'] ?? '📁', $c['color'] ?? '#2d4a3e', '', $i]);
    $catSlugToId[$c['slug']] = (int)$pdo->lastInsertId();
    $catSlugToId[$c['name']] = $catSlugToId[$c['slug']];
}

// ── Users (fictional demo accounts) ────────────────────────
// Demo password for every account below is: password  (admin also needs code ADMIN2024)
$demoUsers = [
    ['first_name' => 'Justice', 'last_name' => 'Elorm',  'email' => 'justiceelorm@example.com', 'role' => 'student',    'bio' => 'Self-taught developer from Accra, Ghana.'],
    ['first_name' => 'Ato',     'last_name' => 'Siaw',   'email' => 'atosiaw@example.com',       'role' => 'instructor','bio' => 'Machine Learning Researcher & Educator.'],
    ['first_name' => 'Emeka',   'last_name' => 'Boateng','email' => 'emeka@example.com',         'role' => 'student',   'bio' => 'Aspiring web developer.'],
    ['first_name' => 'Fatima',  'last_name' => 'Sule',   'email' => 'fatima@example.com',        'role' => 'student',   'bio' => 'UI/UX enthusiast.'],
    ['first_name' => 'Clifford','last_name' => 'Junior', 'email' => 'cliffordjunior@gitacademy.com', 'role' => 'admin', 'bio' => 'Platform administrator.'],
    ['first_name' => 'Abena',   'last_name' => 'Owusu',  'email' => 'abena.instructor@example.com', 'role' => 'instructor','bio' => 'Full-stack instructor, 8 years experience.'],
];
$userIds = [];
$stmt = $pdo->prepare('INSERT INTO users (first_name, last_name, email, password, role, bio) VALUES (?, ?, ?, ?, ?, ?)');
foreach ($demoUsers as $u) {
    $stmt->execute([$u['first_name'], $u['last_name'], $u['email'], password_hash('password', PASSWORD_DEFAULT), $u['role'], $u['bio']]);
    $userIds[$u['email']] = (int)$pdo->lastInsertId();
}

// ── Courses (from courses.json, re-priced in GHS — no currency conversion, same numbers) ──
$courses = json_decode(file_get_contents("$root/courses.json"), true)['courses'] ?? [];
$instructorPool = [$userIds['atosiaw@example.com'], $userIds['abena.instructor@example.com']];
$courseIds = [];
$stmt = $pdo->prepare('INSERT INTO courses (instructor_id, category_id, title, slug, subtitle, description, emoji, thumbnail_bg, price, original_price, level, language, duration_minutes, lessons_count, students_count, rating, reviews_count, status, has_certificate, is_featured, what_you_learn)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, "published", ?, ?, ?)');
foreach ($courses as $i => $c) {
    $catId = $catSlugToId[$c['category'] ?? ''] ?? null;
    $instructorId = $instructorPool[$i % count($instructorPool)];
    $stmt->execute([
        $instructorId, $catId, $c['title'], $c['slug'] ?? null, $c['subtitle'] ?? '', $c['description'] ?? '',
        $c['emoji'] ?? '📚', $c['thumbnail_bg'] ?? '#f0ece4',
        (float)($c['price'] ?? 0), isset($c['original_price']) ? (float)$c['original_price'] : null,
        $c['level'] ?? 'All Levels', $c['language'] ?? 'English',
        (int)($c['duration_minutes'] ?? 0), (int)($c['lessons_count'] ?? 5), (int)($c['students_count'] ?? 0),
        (float)($c['rating'] ?? 0), (int)($c['reviews_count'] ?? 0),
        (int)($c['certificate'] ?? true), !empty($c['is_bestseller']) ? 1 : 0,
        json_encode($c['what_you_learn'] ?? []),
    ]);
    $courseIds[] = (int)$pdo->lastInsertId();
}

// ── Lessons + one quiz per course (so "Learn" and "Take Quiz" journeys work) ──
$lessonStmt = $pdo->prepare('INSERT INTO lessons (course_id, title, type, duration_seconds, sort_order, is_free, video_path, video_original_name, video_size_bytes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
$quizStmt = $pdo->prepare('INSERT INTO quiz_questions (course_id, question, options, correct_answer, explanation, sort_order) VALUES (?, ?, ?, ?, ?, ?)');
foreach ($courseIds as $idx => $cid) {
    $lessonTitles = ['Course Introduction', 'Core Concepts', 'Hands-on Practice', 'Building a Real Project', 'Wrapping Up & Next Steps'];
    foreach ($lessonTitles as $li => $title) {
        // Real intro video for the first lesson of every course — a genuine,
        // original short video (built from this course's own real title,
        // instructor, level and learning outcomes), not a placeholder.
        $videoPath = null; $videoName = null; $videoSize = null;
        if ($li === 0) {
            $realVideoFile = __DIR__ . '/../uploads/course-' . $cid . '-intro.mp4';
            if (file_exists($realVideoFile)) {
                $videoPath = 'uploads/course-' . $cid . '-intro.mp4';
                $videoName = 'course-' . $cid . '-intro.mp4';
                $videoSize = filesize($realVideoFile);
            }
        }
        $lessonStmt->execute([$cid, $title, 'video', 600 + $li * 120, $li, $li === 0 ? 1 : 0, $videoPath, $videoName, $videoSize]);
    }
    $pdo->prepare('UPDATE courses SET lessons_count = ? WHERE id = ?')->execute([count($lessonTitles), $cid]);

    $courseTitle = $courses[$idx]['title'] ?? 'this course';
    $quizStmt->execute([$cid, "What is the main focus of \"$courseTitle\"?", json_encode(['Core fundamentals covered in this course', 'Unrelated trivia', 'Cooking recipes', 'None of the above']), 0, 'Straight from the course description.', 0]);
    $quizStmt->execute([$cid, 'Completing all lessons marks the course as:', json_encode(['Completed', 'Archived', 'Deleted', 'Draft']), 0, 'Progress reaches 100% once every lesson is marked complete.', 1]);
    $quizStmt->execute([$cid, 'Which currency are course prices shown in on GITAcademy?', json_encode(['Ghanaian Cedi (₵ / GHS)', 'US Dollar ($)', 'Euro (€)', 'British Pound (£)']), 0, 'GITAcademy prices everything in Ghanaian cedis.', 2]);
}

// ── Demo enrollments so dashboards aren't empty ────────────
$studentId = $userIds['justiceelorm@example.com'];
foreach (array_slice($courseIds, 0, 3) as $i => $cid) {
    $pct = $i === 0 ? 100 : ($i === 1 ? 45 : 0);
    $status = $i === 0 ? 'completed' : 'active';
    $completedAtSql = $status === 'completed' ? ", completed_at = datetime('now', '-14 days')" : '';
    $pdo->prepare("INSERT INTO enrollments (user_id, course_id, price_paid, progress_pct, status, last_accessed_at) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)")
        ->execute([$studentId, $cid, 0, $pct, $status]);
    if ($status === 'completed') {
        $pdo->prepare("UPDATE enrollments SET completed_at = datetime('now', '-14 days') WHERE user_id = ? AND course_id = ?")
            ->execute([$studentId, $cid]);
    }
    $pdo->prepare('UPDATE courses SET students_count = students_count + 1 WHERE id = ?')->execute([$cid]);

    // Keep lesson_progress consistent with the seeded percentage so real progress updates don't reset it.
    $lessonsForCourse = $pdo->prepare('SELECT id FROM lessons WHERE course_id = ? ORDER BY sort_order');
    $lessonsForCourse->execute([$cid]);
    $lessonIds = array_column($lessonsForCourse->fetchAll(), 'id');
    $toComplete = (int)round(count($lessonIds) * $pct / 100);
    for ($j = 0; $j < $toComplete; $j++) {
        $pdo->prepare('INSERT INTO lesson_progress (user_id, lesson_id, course_id, is_completed, completed_at) VALUES (?, ?, ?, 1, CURRENT_TIMESTAMP)')
            ->execute([$studentId, $lessonIds[$j], $cid]);
    }
}

// ── A sample review ────────────────────────────────────────
$pdo->prepare('INSERT INTO reviews (user_id, course_id, rating, title, comment, status) VALUES (?, ?, 5, ?, ?, "approved")')
    ->execute([$studentId, $courseIds[0], 'Great course!', 'Learned a lot, would recommend to any beginner.']);

echo "Seed complete.\n";
echo "  Users: " . count($demoUsers) . "\n";
echo "  Categories: " . count($categories) . "\n";
echo "  Courses: " . count($courseIds) . "\n";
echo "\nDemo accounts (password: 'password', admin code: '" . ADMIN_INVITE_CODE . "'):\n";
foreach ($demoUsers as $u) echo "  {$u['role']}: {$u['email']}\n";
