<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Auth\{
    AuthController,
    SocialAuthController,
    EmailVerificationController,
    PasswordResetController,
};
use App\Http\Controllers\Student\{
    DashboardController,
    ProfileController,
    EnrollmentController,
    ProgressController,
    WishlistController,
    CartController,
    CertificateController,
    NoteController,
    QAController,
    SearchController,
};
use App\Http\Controllers\Instructor\{
    InstructorDashboardController,
    CourseManagementController,
    LessonController,
    VideoUploadController,
    QuizController,
    AnalyticsController,
    EarningsController,
    StudentManagementController,
};
use App\Http\Controllers\Admin\{
    AdminDashboardController,
    AdminUserController,
    AdminCourseController,
    AdminPaymentController,
    AdminReviewController,
    AdminCategoryController,
    AdminSettingsController,
};
use App\Http\Controllers\{
    CourseController,
    CategoryController,
    ReviewController,
    PaymentController,
    NotificationController,
};

// ──────────────────────────────────────────────────────────────
//  PUBLIC ROUTES
// ──────────────────────────────────────────────────────────────

// Auth
Route::prefix('auth')->group(function () {
    Route::post('/register',         [AuthController::class, 'register']);
    Route::post('/login',            [AuthController::class, 'login']);
    Route::post('/forgot-password',  [PasswordResetController::class, 'sendLink']);
    Route::post('/reset-password',   [PasswordResetController::class, 'reset']);

    // OAuth
    Route::get('/{provider}/redirect',  [SocialAuthController::class, 'redirect']);
    Route::get('/{provider}/callback',  [SocialAuthController::class, 'callback']);
});

// Public course browsing
Route::prefix('courses')->group(function () {
    Route::get('/',              [CourseController::class, 'index']);
    Route::get('/featured',      [CourseController::class, 'featured']);
    Route::get('/trending',      [CourseController::class, 'trending']);
    Route::get('/search',        [SearchController::class, 'search']);
    Route::get('/{slug}',        [CourseController::class, 'show']);
    Route::get('/{id}/reviews',  [ReviewController::class, 'index']);
});

// Public categories
Route::prefix('categories')->group(function () {
    Route::get('/',       [CategoryController::class, 'index']);
    Route::get('/{slug}', [CategoryController::class, 'show']);
});

// Certificate verification (public)
Route::get('/certificates/verify/{credentialId}', [CertificateController::class, 'verify']);


// ──────────────────────────────────────────────────────────────
//  AUTHENTICATED ROUTES
// ──────────────────────────────────────────────────────────────

Route::middleware('auth:sanctum')->group(function () {

    // Auth
    Route::prefix('auth')->group(function () {
        Route::post('/logout',           [AuthController::class, 'logout']);
        Route::get('/me',                [AuthController::class, 'me']);
        Route::post('/refresh',          [AuthController::class, 'refresh']);
        Route::get('/email/verify/{id}/{hash}', [EmailVerificationController::class, 'verify'])
             ->name('verification.verify');
        Route::post('/email/resend',     [EmailVerificationController::class, 'resend']);
    });

    // Notifications
    Route::prefix('notifications')->group(function () {
        Route::get('/',         [NotificationController::class, 'index']);
        Route::post('/read-all',[NotificationController::class, 'markAllRead']);
        Route::patch('/{id}',   [NotificationController::class, 'markRead']);
        Route::delete('/{id}',  [NotificationController::class, 'destroy']);
    });

    // ── STUDENT ───────────────────────────────────────────────

    Route::middleware('role:student,instructor,admin')->group(function () {

        // Dashboard
        Route::get('/dashboard', [DashboardController::class, 'index']);

        // Profile
        Route::prefix('user')->group(function () {
            Route::get('/profile',           [ProfileController::class, 'show']);
            Route::patch('/profile',         [ProfileController::class, 'update']);
            Route::post('/avatar',           [ProfileController::class, 'uploadAvatar']);
            Route::delete('/account',        [ProfileController::class, 'deleteAccount']);
            Route::get('/my-courses',        [EnrollmentController::class, 'index']);
            Route::get('/certificates',      [CertificateController::class, 'index']);
            Route::get('/achievements',      [DashboardController::class, 'achievements']);
            Route::get('/activity',          [DashboardController::class, 'activity']);
        });

        // Wishlist
        Route::prefix('wishlist')->group(function () {
            Route::get('/',           [WishlistController::class, 'index']);
            Route::post('/{courseId}',[WishlistController::class, 'add']);
            Route::delete('/{courseId}',[WishlistController::class, 'remove']);
        });

        // Cart
        Route::prefix('cart')->group(function () {
            Route::get('/',           [CartController::class, 'index']);
            Route::post('/{courseId}',[CartController::class, 'add']);
            Route::delete('/{courseId}',[CartController::class, 'remove']);
            Route::delete('/',        [CartController::class, 'clear']);
            Route::post('/coupon',    [CartController::class, 'applyCoupon']);
        });

        // Payments & Orders
        Route::prefix('payments')->group(function () {
            Route::post('/checkout',         [PaymentController::class, 'checkout']);
            Route::get('/callback/paystack', [PaymentController::class, 'paystackCallback']);
            Route::get('/callback/stripe',   [PaymentController::class, 'stripeCallback']);
            Route::post('/webhook/paystack', [PaymentController::class, 'paystackWebhook']);
            Route::post('/webhook/stripe',   [PaymentController::class, 'stripeWebhook']);
        });

        Route::prefix('orders')->group(function () {
            Route::get('/',    [PaymentController::class, 'orders']);
            Route::get('/{id}',[PaymentController::class, 'orderDetail']);
        });

        // Enrollment & Progress
        Route::prefix('courses/{courseId}')->group(function () {
            Route::post('/enroll',   [EnrollmentController::class, 'enroll']);  // free courses
            Route::get('/progress',  [ProgressController::class, 'show']);

            // Lessons
            Route::prefix('lessons/{lessonId}')->group(function () {
                Route::post('/progress', [ProgressController::class, 'update']);
                Route::get('/notes',     [NoteController::class, 'index']);
                Route::post('/notes',    [NoteController::class, 'store']);
            });

            // Notes (course-level)
            Route::get('/notes',  [NoteController::class, 'courseNotes']);

            // Q&A
            Route::get('/questions',      [QAController::class, 'index']);
            Route::post('/questions',     [QAController::class, 'store']);
            Route::post('/questions/{questionId}/answers', [QAController::class, 'answer']);
            Route::post('/questions/{questionId}/upvote',  [QAController::class, 'upvote']);

            // Reviews
            Route::post('/reviews', [ReviewController::class, 'store']);
            Route::put('/reviews',  [ReviewController::class, 'update']);
        });

        Route::delete('/notes/{id}',   [NoteController::class, 'destroy']);
    });


    // ── INSTRUCTOR ────────────────────────────────────────────

    Route::middleware('role:instructor,admin')->prefix('instructor')->group(function () {

        // Dashboard
        Route::get('/dashboard', [InstructorDashboardController::class, 'index']);
        Route::get('/stats',     [InstructorDashboardController::class, 'stats']);

        // Course management
        Route::prefix('courses')->group(function () {
            Route::get('/',                [CourseManagementController::class, 'index']);
            Route::post('/',               [CourseManagementController::class, 'store']);
            Route::get('/{id}',            [CourseManagementController::class, 'show']);
            Route::put('/{id}',            [CourseManagementController::class, 'update']);
            Route::delete('/{id}',         [CourseManagementController::class, 'destroy']);
            Route::post('/{id}/publish',   [CourseManagementController::class, 'publish']);
            Route::post('/{id}/unpublish', [CourseManagementController::class, 'unpublish']);
            Route::post('/{id}/thumbnail', [CourseManagementController::class, 'uploadThumbnail']);

            // Sections
            Route::get('/{courseId}/sections',      [LessonController::class, 'sections']);
            Route::post('/{courseId}/sections',     [LessonController::class, 'storeSection']);
            Route::put('/{courseId}/sections/{id}', [LessonController::class, 'updateSection']);
            Route::delete('/{courseId}/sections/{id}',[LessonController::class, 'deleteSection']);

            // Lessons
            Route::post('/{courseId}/sections/{sectionId}/lessons',     [LessonController::class, 'store']);
            Route::put('/{courseId}/lessons/{id}',                       [LessonController::class, 'update']);
            Route::delete('/{courseId}/lessons/{id}',                    [LessonController::class, 'destroy']);
            Route::post('/{courseId}/lessons/reorder',                   [LessonController::class, 'reorder']);

            // Video upload
            Route::post('/{courseId}/videos',        [VideoUploadController::class, 'store']);
            Route::get('/{courseId}/videos/{lessonId}/status', [VideoUploadController::class, 'status']);

            // Quizzes
            Route::post('/{courseId}/lessons/{lessonId}/quiz',  [QuizController::class, 'store']);
            Route::put('/{courseId}/lessons/{lessonId}/quiz',   [QuizController::class, 'update']);
            Route::delete('/{courseId}/lessons/{lessonId}/quiz',[QuizController::class, 'destroy']);
        });

        // Analytics
        Route::prefix('analytics')->group(function () {
            Route::get('/',           [AnalyticsController::class, 'overview']);
            Route::get('/revenue',    [AnalyticsController::class, 'revenue']);
            Route::get('/students',   [AnalyticsController::class, 'students']);
            Route::get('/courses/{id}', [AnalyticsController::class, 'courseDetail']);
        });

        // Earnings & Payouts
        Route::prefix('earnings')->group(function () {
            Route::get('/',       [EarningsController::class, 'index']);
            Route::get('/summary',[EarningsController::class, 'summary']);
        });
        Route::prefix('payouts')->group(function () {
            Route::get('/',     [EarningsController::class, 'payouts']);
            Route::post('/',    [EarningsController::class, 'requestPayout']);
        });

        // Student management
        Route::get('/students',     [StudentManagementController::class, 'index']);
        Route::get('/students/{id}',[StudentManagementController::class, 'show']);

        // Review responses
        Route::post('/reviews/{id}/reply', [ReviewController::class, 'reply']);
    });


    // ── ADMIN ─────────────────────────────────────────────────

    Route::middleware('role:admin')->prefix('admin')->group(function () {

        // Dashboard
        Route::get('/dashboard', [AdminDashboardController::class, 'index']);
        Route::get('/stats',     [AdminDashboardController::class, 'stats']);
        Route::get('/activity',  [AdminDashboardController::class, 'recentActivity']);

        // Users
        Route::prefix('users')->group(function () {
            Route::get('/',                  [AdminUserController::class, 'index']);
            Route::get('/{id}',              [AdminUserController::class, 'show']);
            Route::patch('/{id}',            [AdminUserController::class, 'update']);
            Route::patch('/{id}/role',       [AdminUserController::class, 'updateRole']);
            Route::patch('/{id}/status',     [AdminUserController::class, 'updateStatus']);
            Route::delete('/{id}',           [AdminUserController::class, 'destroy']);
            Route::post('/{id}/impersonate', [AdminUserController::class, 'impersonate']);
        });

        // Courses
        Route::prefix('courses')->group(function () {
            Route::get('/',                   [AdminCourseController::class, 'index']);
            Route::get('/{id}',               [AdminCourseController::class, 'show']);
            Route::patch('/{id}/status',      [AdminCourseController::class, 'updateStatus']);
            Route::patch('/{id}/featured',    [AdminCourseController::class, 'toggleFeatured']);
            Route::delete('/{id}',            [AdminCourseController::class, 'destroy']);
        });

        // Reviews
        Route::prefix('reviews')->group(function () {
            Route::get('/',              [AdminReviewController::class, 'index']);
            Route::patch('/{id}/status', [AdminReviewController::class, 'updateStatus']);
            Route::delete('/{id}',       [AdminReviewController::class, 'destroy']);
        });

        // Payments
        Route::prefix('payments')->group(function () {
            Route::get('/',            [AdminPaymentController::class, 'index']);
            Route::get('/{id}',        [AdminPaymentController::class, 'show']);
            Route::post('/{id}/refund',[AdminPaymentController::class, 'refund']);
        });

        // Categories (CRUD)
        Route::apiResource('categories', AdminCategoryController::class);
        Route::patch('categories/{id}/toggle', [AdminCategoryController::class, 'toggle']);

        // Platform settings
        Route::get('/settings',       [AdminSettingsController::class, 'index']);
        Route::patch('/settings',     [AdminSettingsController::class, 'update']);
        Route::post('/settings/test-email', [AdminSettingsController::class, 'testEmail']);

        // Payouts management
        Route::get('/payouts',               [EarningsController::class, 'adminPayouts']);
        Route::patch('/payouts/{id}/process',[EarningsController::class, 'processPayout']);

        // Coupons
        Route::apiResource('coupons', \App\Http\Controllers\Admin\AdminCouponController::class);

        // Platform stats export
        Route::get('/export/users',    [AdminDashboardController::class, 'exportUsers']);
        Route::get('/export/revenue',  [AdminDashboardController::class, 'exportRevenue']);
    });
});
