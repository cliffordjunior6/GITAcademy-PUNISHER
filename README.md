# GITAcademy Frontend

A complete, production-ready frontend for an online learning platform — built with semantic HTML, a CSS design-token system, and ES module JavaScript. Zero framework dependencies. Designed to connect to a **Laravel** backend (Sanctum auth, REST API).

---

## 🚀 Quick Start

Open `index.html` in a browser — this is the master navigation hub with live search across all 36 pages.

**Home base:** `learnhub_responsive.html` — all pages link back here.

---

## 🧪 Demo Credentials

| Role | Email | Password | Notes |
|---|---|---|---|
| Student | `justiceelorm@example.com` | `password` | → redirects to `dashboard.html` |
| Instructor | `atosiaw@example.com` | `password` | → redirects to `instructor-dashboard.html` |
| Admin | `cliffordjunior@GITAcademy.com` | `admin123` | Requires admin code: `ADMIN2024` → `admin-dashboard.html` |

> Credentials are stored in `users.json`. The login/register pages simulate a 1.2s API call and store the user in `localStorage`.

---

## 📁 Project Structure

```
GITAcademy/
│
├── index.html                      ← Master project navigator (start here)
│
├── ── Auth ──────────────────────────────────────────────────────
│   ├── learnhub_responsive.html    ← Landing page with role selector
│   ├── login.html                  ← Login with 3-role tab selector + URL param
│   ├── register.html               ← Registration with role-specific fields
│   ├── forgot-password.html        ← Email recovery with success state
│   └── reset-password.html         ← Password reset with token + strength meter
│
├── ── Student ───────────────────────────────────────────────────
│   ├── dashboard.html              ← Stats, continue learning, recommendations
│   ├── profile.html                ← Tabs: About, Courses, Certs, Achievements
│   └── edit-profile.html           ← Avatar upload, social links, password change
│
├── ── Course Discovery ──────────────────────────────────────────
│   ├── home.html                   ← Hero search, categories, trending, instructors
│   ├── course-list.html            ← Filter sidebar, sort, search, pagination
│   ├── course-details.html         ← Enroll card, curriculum accordion, reviews
│   └── category-list.html          ← 12 categories with subcategories
│
├── ── Learning ──────────────────────────────────────────────────
│   └── course-player.html          ← Video player, progress, notes, Q&A, resources
│
├── ── Instructor ────────────────────────────────────────────────
│   ├── instructor-dashboard.html   ← Revenue chart, courses table, enrollments
│   ├── create-course.html          ← 5-step wizard with curriculum builder
│   ├── edit-course.html            ← Section editor with auto-save
│   ├── upload-video.html           ← Drag & drop XHR upload with progress
│   └── course-analytics.html       ← Charts, student table, rating breakdown
│
├── ── Checkout ──────────────────────────────────────────────────
│   ├── cart.html                   ← Items, coupon (LEARN20), order summary
│   ├── checkout.html               ← Card / Mobile Money / PayPal tabs
│   ├── payment-success.html        ← Confetti, receipt, enrolled courses
│   └── payment-failed.html         ← Error details, alternatives, support
│
├── ── Admin ─────────────────────────────────────────────────────
│   ├── admin-dashboard.html        ← Dark theme, KPIs, activity log
│   ├── admin-users.html            ← User table with role badges, actions
│   ├── admin-courses.html          ← Course review queue, approve/reject
│   └── admin-payments.html         ← Transaction log, refund management
│
├── ── Static ────────────────────────────────────────────────────
│   ├── about.html                  ← Mission, team, animated stats counter
│   ├── contact.html                ← Form with validation, FAQ accordion
│   ├── help.html                   ← Search, categories, article filter
│   ├── terms.html                  ← 11 sections, sticky TOC, smooth scroll
│   └── privacy.html                ← 10 sections, data table, sticky TOC
│
├── ── Utility ───────────────────────────────────────────────────
│   ├── notifications.html          ← Filter, mark-read, settings toggles
│   └── 404.html                    ← Dark error page, search, quick links
│
├── ── CSS ───────────────────────────────────────────────────────
│   ├── main.css          ← Import bundle (single <link> for all styles)
│   ├── global.css        ← Design tokens, resets, utilities
│   ├── navbar.css
│   ├── footer.css
│   ├── forms.css
│   ├── buttons.css
│   ├── course-card.css
│   ├── course-player.css
│   ├── dashboard.css
│   ├── instructor.css
│   ├── admin.css
│   └── responsive.css    ← xs/sm/md/lg/xl breakpoints + print + touch
│
├── ── JavaScript ────────────────────────────────────────────────
│   ├── main.js           ← App entry point — auto-detects page, lazy loads
│   ├── api.js            ← All Laravel API endpoints with Bearer token
│   ├── auth.js           ← Login, register, session, role redirect
│   ├── utils.js          ← 25+ helpers: format, DOM, toast, course builder
│   ├── navbar.js         ← Mobile menu, live search dropdown, sticky
│   ├── dashboard.js      ← Stats, enrolled courses, recommendations
│   ├── notifications.js  ← Bell badge, dropdown, 60s polling
│   ├── modal.js          ← confirm(), alert(), custom modals
│   ├── tabs.js           ← Tab component (hash routing) + Dropdown class
│   ├── course-list.js    ← Filter, sort, search, pagination engine
│   ├── course-details.js ← Enroll, wishlist, curriculum, reviews
│   ├── course-player.js  ← Play/pause, progress, lesson nav, notes, Q&A
│   ├── video-controls.js ← Volume, fullscreen, PiP, speed, hotkeys
│   ├── create-course.js  ← 5-step wizard, curriculum builder, draft save
│   ├── upload-video.js   ← XHR upload with real progress events
│   └── course-editor.js  ← Edit course, auto-save, publish toggle
│
└── ── Data ──────────────────────────────────────────────────────
    ├── courses.json       ← 10 courses with full metadata
    ├── users.json         ← 5 users (2 students, 1 instructor, 1 admin)
    │                         + demo_credentials object
    └── categories.json    ← 12 categories + 18 popular topics
```

---

## 🎨 Design System

| Token | Value | Usage |
|---|---|---|
| `--ink` | `#0d0d0f` | Primary text, dark navbars |
| `--cream` | `#f5f0e8` | Page backgrounds, light navbars |
| `--gold` | `#e8c547` | Ratings, accents, admin CTAs |
| `--moss` | `#2d4a3e` | Success, student role, progress bars |
| `--rust` | `#c4522a` | Logo, primary buttons, links |
| `--smoke` | `#f0ece4` | Input fills, card backgrounds |
| `--purple` | `#7c3aed` | Instructor role colour |
| `--error` | `#e05555` | Errors, admin role colour |

**Fonts:** `Fraunces` (headings, display) + `DM Sans` (body text)

---

## 📱 Responsive Breakpoints

| Name | Width | Target |
|---|---|---|
| xs | `< 480px` | Small phones — single column, no labels |
| sm | `< 600px` | Phones — reduced padding |
| md | `< 768px` | Tablets — sidebar drawer, nav collapses |
| lg | `< 1024px` | Small laptops — 2-col grids |
| xl | `< 1200px` | Laptops — 3-col max |
| 2xl | `≥ 1200px` | Desktop — full layout |

Additional: `prefers-reduced-motion`, `hover: none` (touch), `print`.

---

## ⚡ Usage

### Option A — Single import (recommended)
```html
<head>
  <link rel="stylesheet" href="main.css"/>
</head>
<body>
  <!-- page content -->
  <script type="module" src="main.js"></script>
</body>
```

`main.js` reads the current filename and lazy-loads the right modules automatically.

### Option B — Per-page imports
```html
<script type="module">
  import { initCourseList } from './course-list.js';
  document.addEventListener('DOMContentLoaded', initCourseList);
</script>
```

---

## 🔧 Laravel Integration

### 1. Convert to Blade templates
```
mv home.html resources/views/home.blade.php
```
Extract shared navbar/footer into `resources/views/layouts/app.blade.php`.

### 2. Set API base URL
```blade
{{-- In layouts/app.blade.php --}}
<script>
  window.GITAcademy_API_URL = "{{ config('app.url') }}/api";
</script>
```
`api.js` reads `window.GITAcademy_API_URL` automatically.

### 3. Install Laravel Sanctum
```bash
php artisan sanctum:install
php artisan migrate
```
`auth.js` posts to `/api/auth/login`, stores the Bearer token in localStorage, and injects it on every subsequent request.

### 4. Example API routes
```php
// routes/api.php
Route::prefix('auth')->group(function () {
    Route::post('/login',           [AuthController::class, 'login']);
    Route::post('/register',        [AuthController::class, 'register']);
    Route::post('/logout',          [AuthController::class, 'logout'])->middleware('auth:sanctum');
    Route::post('/forgot-password', [PasswordController::class, 'send']);
    Route::post('/reset-password',  [PasswordController::class, 'reset']);
    Route::get('/me',               [AuthController::class, 'me'])->middleware('auth:sanctum');
});

Route::middleware('auth:sanctum')->group(function () {
    Route::apiResource('courses',   CourseController::class);
    Route::apiResource('user',      UserController::class);
    Route::apiResource('cart',      CartController::class);
    Route::post('cart/coupon',      [CartController::class, 'applyCoupon']);
    Route::apiResource('instructor/courses', InstructorCourseController::class);
    Route::post('payments/checkout', [PaymentController::class, 'checkout']);
});
```

### 5. Connect payments (Paystack recommended for Africa)
```js
// Uncomment in checkout.html:
const { payment_url } = await paymentsApi.initiateCheckout({
  cart_id: cartId,
  method:  'paystack',  // or 'stripe', 'momo'
});
window.location.href = payment_url;
```

### 6. Replace static course cards
```js
import { coursesApi }   from './api.js';
import { renderCourseGrid } from './utils.js';

const courses = await coursesApi.list({ sort: 'popular', limit: 8 });
renderCourseGrid('trendingGrid', courses);
```

---

## ✅ Feature Checklist

- [x] 36 fully responsive HTML pages
- [x] Role-based auth (Student / Instructor / Admin) on login & register
- [x] URL param role pre-selection (`login.html?role=instructor`)
- [x] Role redirect guard on dashboard (instructor/admin auto-redirect)
- [x] Design token CSS system (light + dark themes)
- [x] 16 ES module JS files — zero framework dependencies
- [x] Live search with debounce on course listing
- [x] Working filter engine (category, level, price, rating, sort)
- [x] Dynamic pagination
- [x] Immersive video player with keyboard shortcuts (Space, arrows, M, F)
- [x] Course notes with timestamp, Q&A submit
- [x] 5-step course creation wizard with curriculum drag-reorder
- [x] Real XHR video upload with live progress bar
- [x] Cart with coupon codes (try `LEARN20`)
- [x] Mobile Money + Card + PayPal checkout tabs
- [x] Confetti on payment success
- [x] Admin dark-theme panel with user/course/payment tables
- [x] Notifications centre with filter, mark-read, settings
- [x] 404 page with search and quick links
- [x] Scroll-reveal animations via IntersectionObserver
- [x] Animated stats counters (about page)
- [x] Contact form with validation + loading state
- [x] Terms/Privacy sticky TOC with smooth scroll
- [x] Notification bell linked across all logged-in pages
- [x] User name/avatar populated from localStorage on every page
- [x] All HTML files properly closed (verified)
- [x] All internal links verified (no broken links)
- [x] Print stylesheet
- [x] Touch device optimisations (44px tap targets)
- [x] Reduced motion support
- [x] Laravel-ready API layer with commented integration code

---

## 🗑 Files to Delete

These are old draft iterations — not part of the project:

- `learnhub.html`
- `learnhub_final.html`
- `learnhub_fixed.html`

---

*GITAcademy Frontend · 36 HTML · 16 JS · 12 CSS · 3 JSON · 1.1 MB*  
*Built March – April 2026 · MIT License*
