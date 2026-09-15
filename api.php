<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

function jsonResponse($payload, $status = 200): void {
    http_response_code($status);
    echo json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
    exit;
}

function getBody(): array {
    $raw = file_get_contents('php://input');
    if ($raw === false || trim($raw) === '') {
        return [];
    }
    $json = json_decode($raw, true);
    return is_array($json) ? $json : [];
}

function normalizeUser(array $user): array {
    $first = $user['first_name'] ?? ($user['name'] ?? 'User');
    $last = $user['last_name'] ?? '';
    return [
        'id' => (int) ($user['id'] ?? 0),
        'first_name' => $first,
        'last_name' => $last,
        'name' => trim($first . ($last ? ' ' . $last : '')),
        'email' => $user['email'] ?? '',
        'role' => $user['role'] ?? 'student',
        'status' => $user['status'] ?? 'active',
    ];
}

$demoUsers = [
    [
        'id' => 1,
        'first_name' => 'Justice',
        'last_name' => 'Elorm',
        'email' => 'justiceelorm@example.com',
        'password' => 'password',
        'role' => 'student',
        'status' => 'active',
    ],
    [
        'id' => 2,
        'first_name' => 'Ato Siaw',
        'last_name' => 'Quarshie',
        'email' => 'atosiaw@example.com',
        'password' => 'password',
        'role' => 'instructor',
        'status' => 'active',
    ],
    [
        'id' => 3,
        'first_name' => 'Clifford',
        'last_name' => 'Junior',
        'email' => 'cliffordjunior@GITAcademy.com',
        'password' => 'admin123',
        'role' => 'admin',
        'status' => 'active',
    ],
];

function resolveDemoUser(string $email, string $password): ?array {
    global $demoUsers;
    foreach ($demoUsers as $user) {
        if (strtolower($user['email']) === strtolower($email) && $user['password'] === $password) {
            return $user;
        }
    }
    return null;
}

function resolveTokenUser(string $token): ?array {
    global $demoUsers;
    if (!$token || !str_contains($token, ':')) {
        return null;
    }
    [$kind, $role, $id] = explode(':', $token, 3);
    if ($kind !== 'demo') {
        return null;
    }
    foreach ($demoUsers as $user) {
        if ((string) $user['id'] === (string) $id && $user['role'] === $role) {
            return $user;
        }
    }
    return null;
}

$route = $_GET['route'] ?? parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$route = $route === '/api.php' ? '/' : $route;
$route = preg_replace('#^/+#', '/', $route);
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$authorization = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
$token = preg_match('/Bearer\s+(.*)$/i', $authorization, $matches) ? trim($matches[1]) : null;

$courseData = json_decode(file_get_contents(__DIR__ . '/courses.json'), true);
$courses = $courseData['courses'] ?? [];

switch ($route) {
    case '/auth/login':
        if ($method !== 'POST') jsonResponse(['message' => 'Method not allowed'], 405);
        $input = getBody();
        $email = trim((string) ($input['email'] ?? ''));
        $password = (string) ($input['password'] ?? '');
        $role = trim((string) ($input['role'] ?? 'student'));
        $adminCode = trim((string) ($input['admin_code'] ?? ''));

        $user = resolveDemoUser($email, $password);
        if (!$user) {
            jsonResponse(['message' => 'Invalid credentials'], 401);
        }
        if ($user['role'] === 'admin' && $role === 'admin' && $adminCode !== 'ADMIN2024') {
            jsonResponse(['message' => 'Admin access code is required'], 403);
        }

        $tokenValue = 'demo:' . $user['role'] . ':' . $user['id'];
        jsonResponse(['token' => $tokenValue, 'user' => normalizeUser($user)]);

    case '/auth/register':
        if ($method !== 'POST') jsonResponse(['message' => 'Method not allowed'], 405);
        $input = getBody();
        $first = trim((string) ($input['first_name'] ?? $input['firstName'] ?? 'Student'));
        $last = trim((string) ($input['last_name'] ?? $input['lastName'] ?? 'User'));
        $email = trim((string) ($input['email'] ?? ''));
        $password = (string) ($input['password'] ?? '');
        if (!$email || !$password) {
            jsonResponse(['message' => 'Email and password are required'], 422);
        }

        $newUser = [
            'id' => 999 + count($demoUsers),
            'first_name' => $first,
            'last_name' => $last,
            'email' => $email,
            'password' => $password,
            'role' => 'student',
            'status' => 'active',
        ];
        $demoUsers[] = $newUser;
        jsonResponse([
            'token' => 'demo:student:' . $newUser['id'],
            'user' => normalizeUser($newUser),
        ]);

    case '/auth/logout':
        jsonResponse(['message' => 'Logged out successfully']);

    case '/auth/me':
        if (!$token) jsonResponse(['message' => 'Unauthenticated'], 401);
        $user = resolveTokenUser($token);
        if (!$user) jsonResponse(['message' => 'Invalid token'], 401);
        jsonResponse(normalizeUser($user));

    case '/courses':
        $query = strtolower(trim((string) ($_GET['q'] ?? '')));
        $items = $courses;
        if ($query !== '') {
            $items = array_values(array_filter($items, function ($course) use ($query) {
                $haystack = strtolower(($course['title'] ?? '') . ' ' . ($course['category'] ?? '') . ' ' . ($course['subcategory'] ?? ''));
                return str_contains($haystack, $query);
            }));
        }
        jsonResponse($items);

    case '/courses/featured':
        $filtered = array_values(array_filter($courses, fn($course) => !empty($course['is_bestseller']) || !empty($course['is_new'])));
        jsonResponse(array_slice($filtered, 0, 4));

    case '/courses/trending':
        jsonResponse(array_slice($courses, 0, 4));

    case '/categories':
        $categories = json_decode(file_get_contents(__DIR__ . '/categories.json'), true);
        jsonResponse($categories['categories'] ?? $categories);

    case '/dashboard':
        jsonResponse([
            'stats' => ['courses' => 12, 'hours' => 42, 'certificates' => 3, 'streak' => 5],
            'courses' => [
                ['title' => 'Machine Learning A-Z', 'progress' => 68, 'category' => 'AI'],
                ['title' => 'JavaScript Bootcamp', 'progress' => 22, 'category' => 'Web Dev'],
            ],
        ]);

    case '/instructor/dashboard':
        jsonResponse([
            'stats' => ['students' => 548, 'revenue' => 12800, 'courses' => 18, 'rating' => 4.8],
            'courses' => [
                ['title' => 'Machine Learning A-Z', 'students' => 2600, 'revenue' => 14200],
                ['title' => 'UI/UX Design Bootcamp', 'students' => 1140, 'revenue' => 6500],
            ],
        ]);

    case '/admin/stats':
        jsonResponse([
            'stats' => ['users' => 1284, 'courses' => 420, 'revenue' => 65980, 'active' => 87],
            'users' => [
                ['name' => 'Justice Elorm', 'role' => 'student'],
                ['name' => 'Ato Siaw Quarshie', 'role' => 'instructor'],
                ['name' => 'Clifford Junior', 'role' => 'admin'],
            ],
        ]);

    case '/payments/checkout':
        $body = getBody();
        $amount = (float) ($body['amount'] ?? 93.0);
        $currency = strtoupper((string) ($body['currency'] ?? 'GHS'));
        jsonResponse([
            'payment_url' => '/payment-success.html?status=paid&ref=' . uniqid('GHS-'),
            'reference' => 'GHS-' . uniqid(),
            'currency' => $currency,
            'amount' => $amount,
            'status' => 'pending',
            'message' => 'Demo payment initiated successfully.',
        ]);

    default:
        if (preg_match('#^/courses/(\d+)$#', $route, $matches)) {
            $id = (int) $matches[1];
            foreach ($courses as $course) {
                if ((int) ($course['id'] ?? 0) === $id) {
                    jsonResponse($course);
                }
            }
            jsonResponse(['message' => 'Course not found'], 404);
        }
        jsonResponse(['message' => 'Route not found', 'route' => $route], 404);
}
