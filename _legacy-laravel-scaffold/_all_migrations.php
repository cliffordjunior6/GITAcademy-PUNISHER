<?php
// ============================================================
// LearnHub — Database Migrations
// Run: php artisan migrate
// ============================================================
// Each migration is shown as a separate file below.
// In your project these live in database/migrations/
// ============================================================

// ──────────────────────────────────────────────────────────────
// 2024_01_01_000001_create_users_table.php
// ──────────────────────────────────────────────────────────────
/*
<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('users', function (Blueprint $table) {
            $table->id();
            $table->string('first_name');
            $table->string('last_name');
            $table->string('email')->unique();
            $table->timestamp('email_verified_at')->nullable();
            $table->string('password')->nullable(); // nullable for OAuth users
            $table->enum('role', ['student', 'instructor', 'admin'])->default('student');
            $table->enum('status', ['active', 'suspended', 'pending'])->default('active');
            $table->string('avatar')->nullable();
            $table->text('bio')->nullable();
            $table->string('tagline')->nullable();
            $table->string('location')->nullable();
            $table->string('website')->nullable();
            $table->integer('streak_days')->default(0);
            $table->decimal('hours_learned', 8, 2)->default(0);
            $table->string('timezone')->default('UTC');
            $table->string('language')->default('en');
            $table->json('social_links')->nullable(); // {twitter, linkedin, github, youtube}
            $table->rememberToken();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['email', 'role']);
            $table->index('status');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('users');
    }
};
*/

// ──────────────────────────────────────────────────────────────
// 2024_01_01_000002_create_categories_table.php
// ──────────────────────────────────────────────────────────────
/*
<?php
return new class extends Migration {
    public function up(): void
    {
        Schema::create('categories', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('slug')->unique();
            $table->string('icon')->nullable(); // emoji or icon name
            $table->string('color')->nullable(); // hex color for UI
            $table->text('description')->nullable();
            $table->unsignedBigInteger('parent_id')->nullable();
            $table->boolean('is_active')->default(true);
            $table->integer('sort_order')->default(0);
            $table->timestamps();

            $table->foreign('parent_id')->references('id')->on('categories')->nullOnDelete();
            $table->index('slug');
            $table->index('is_active');
        });
    }
    public function down(): void { Schema::dropIfExists('categories'); }
};
*/

// ──────────────────────────────────────────────────────────────
// 2024_01_01_000003_create_courses_table.php
// ──────────────────────────────────────────────────────────────
/*
<?php
return new class extends Migration {
    public function up(): void
    {
        Schema::create('courses', function (Blueprint $table) {
            $table->id();
            $table->foreignId('instructor_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('category_id')->nullable()->constrained()->nullOnDelete();
            $table->string('title');
            $table->string('slug')->unique();
            $table->string('subtitle')->nullable();
            $table->longText('description')->nullable();
            $table->string('thumbnail')->nullable();
            $table->string('preview_video')->nullable();
            $table->string('emoji')->nullable();
            $table->string('thumbnail_bg')->nullable();
            $table->decimal('price', 10, 2)->default(0);
            $table->decimal('original_price', 10, 2)->nullable();
            $table->enum('pricing_type', ['free', 'paid', 'subscription'])->default('paid');
            $table->enum('level', ['beginner', 'intermediate', 'advanced', 'all'])->default('all');
            $table->string('language')->default('English');
            $table->integer('duration_minutes')->default(0);
            $table->integer('lessons_count')->default(0);
            $table->integer('students_count')->default(0);
            $table->decimal('rating', 3, 2)->default(0);
            $table->integer('reviews_count')->default(0);
            $table->json('requirements')->nullable();   // ["Know basic Python", ...]
            $table->json('objectives')->nullable();     // ["Build ML models", ...]
            $table->json('tags')->nullable();
            $table->enum('status', ['draft', 'pending', 'published', 'archived'])->default('draft');
            $table->boolean('has_certificate')->default(true);
            $table->boolean('is_featured')->default(false);
            $table->timestamp('published_at')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['status', 'published_at']);
            $table->index(['category_id', 'status']);
            $table->index(['instructor_id', 'status']);
            $table->fullText(['title', 'description', 'subtitle']);
        });
    }
    public function down(): void { Schema::dropIfExists('courses'); }
};
*/

// ──────────────────────────────────────────────────────────────
// 2024_01_01_000004_create_sections_table.php
// ──────────────────────────────────────────────────────────────
/*
<?php
return new class extends Migration {
    public function up(): void
    {
        Schema::create('sections', function (Blueprint $table) {
            $table->id();
            $table->foreignId('course_id')->constrained()->cascadeOnDelete();
            $table->string('title');
            $table->text('description')->nullable();
            $table->integer('sort_order')->default(0);
            $table->integer('duration_minutes')->default(0);
            $table->timestamps();

            $table->index(['course_id', 'sort_order']);
        });
    }
    public function down(): void { Schema::dropIfExists('sections'); }
};
*/

// ──────────────────────────────────────────────────────────────
// 2024_01_01_000005_create_lessons_table.php
// ──────────────────────────────────────────────────────────────
/*
<?php
return new class extends Migration {
    public function up(): void
    {
        Schema::create('lessons', function (Blueprint $table) {
            $table->id();
            $table->foreignId('section_id')->constrained()->cascadeOnDelete();
            $table->foreignId('course_id')->constrained()->cascadeOnDelete();
            $table->string('title');
            $table->longText('description')->nullable();
            $table->enum('type', ['video', 'article', 'quiz', 'assignment'])->default('video');
            $table->string('video_url')->nullable();
            $table->string('video_key')->nullable();  // S3 key
            $table->integer('duration_seconds')->default(0);
            $table->longText('content')->nullable();  // for articles
            $table->boolean('is_free')->default(false); // preview lesson
            $table->integer('sort_order')->default(0);
            $table->timestamps();

            $table->index(['section_id', 'sort_order']);
            $table->index(['course_id', 'sort_order']);
        });
    }
    public function down(): void { Schema::dropIfExists('lessons'); }
};
*/

// ──────────────────────────────────────────────────────────────
// 2024_01_01_000006_create_enrollments_table.php
// ──────────────────────────────────────────────────────────────
/*
<?php
return new class extends Migration {
    public function up(): void
    {
        Schema::create('enrollments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('course_id')->constrained()->cascadeOnDelete();
            $table->foreignId('order_id')->nullable()->constrained()->nullOnDelete();
            $table->decimal('price_paid', 10, 2)->default(0);
            $table->integer('progress_pct')->default(0);
            $table->foreignId('current_lesson_id')->nullable()->constrained('lessons')->nullOnDelete();
            $table->enum('status', ['active', 'completed', 'refunded'])->default('active');
            $table->timestamp('completed_at')->nullable();
            $table->timestamp('last_accessed_at')->nullable();
            $table->timestamps();

            $table->unique(['user_id', 'course_id']);
            $table->index(['user_id', 'status']);
            $table->index(['course_id', 'status']);
        });
    }
    public function down(): void { Schema::dropIfExists('enrollments'); }
};
*/

// ──────────────────────────────────────────────────────────────
// 2024_01_01_000007_create_lesson_progress_table.php
// ──────────────────────────────────────────────────────────────
/*
<?php
return new class extends Migration {
    public function up(): void
    {
        Schema::create('lesson_progress', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('lesson_id')->constrained()->cascadeOnDelete();
            $table->foreignId('course_id')->constrained()->cascadeOnDelete();
            $table->boolean('is_completed')->default(false);
            $table->integer('watch_seconds')->default(0);  // how far watched
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();

            $table->unique(['user_id', 'lesson_id']);
            $table->index(['user_id', 'course_id']);
        });
    }
    public function down(): void { Schema::dropIfExists('lesson_progress'); }
};
*/

// ──────────────────────────────────────────────────────────────
// 2024_01_01_000008_create_quizzes_table.php
// ──────────────────────────────────────────────────────────────
/*
<?php
return new class extends Migration {
    public function up(): void
    {
        Schema::create('quizzes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('lesson_id')->constrained()->cascadeOnDelete();
            $table->foreignId('course_id')->constrained()->cascadeOnDelete();
            $table->string('title');
            $table->integer('time_limit_minutes')->nullable();
            $table->integer('pass_percentage')->default(60);
            $table->boolean('shuffle_questions')->default(false);
            $table->timestamps();
        });

        Schema::create('quiz_questions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('quiz_id')->constrained()->cascadeOnDelete();
            $table->text('question');
            $table->json('options');           // ["option A", "option B", ...]
            $table->integer('correct_answer'); // index of correct option
            $table->text('explanation')->nullable();
            $table->integer('sort_order')->default(0);
            $table->timestamps();
        });

        Schema::create('quiz_attempts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('quiz_id')->constrained()->cascadeOnDelete();
            $table->json('answers');           // {question_id: chosen_index}
            $table->integer('score');
            $table->integer('total_questions');
            $table->boolean('passed');
            $table->integer('time_taken_seconds')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'quiz_id']);
        });
    }
    public function down(): void
    {
        Schema::dropIfExists('quiz_attempts');
        Schema::dropIfExists('quiz_questions');
        Schema::dropIfExists('quizzes');
    }
};
*/

// ──────────────────────────────────────────────────────────────
// 2024_01_01_000009_create_orders_table.php
// ──────────────────────────────────────────────────────────────
/*
<?php
return new class extends Migration {
    public function up(): void
    {
        Schema::create('orders', function (Blueprint $table) {
            $table->id();
            $table->string('order_number')->unique(); // LH-2024-001847
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->decimal('subtotal', 10, 2);
            $table->decimal('discount', 10, 2)->default(0);
            $table->decimal('total', 10, 2);
            $table->string('coupon_code')->nullable();
            $table->enum('payment_method', ['paystack', 'stripe', 'momo', 'free'])->default('paystack');
            $table->enum('status', ['pending', 'paid', 'failed', 'refunded'])->default('pending');
            $table->string('payment_reference')->nullable();  // gateway reference
            $table->json('gateway_response')->nullable();
            $table->string('currency')->default('USD');
            $table->timestamp('paid_at')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'status']);
            $table->index('order_number');
        });

        Schema::create('order_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_id')->constrained()->cascadeOnDelete();
            $table->foreignId('course_id')->constrained()->cascadeOnDelete();
            $table->string('course_title');
            $table->decimal('price', 10, 2);
            $table->decimal('original_price', 10, 2)->nullable();
            $table->timestamps();

            $table->index(['order_id', 'course_id']);
        });
    }
    public function down(): void
    {
        Schema::dropIfExists('order_items');
        Schema::dropIfExists('orders');
    }
};
*/

// ──────────────────────────────────────────────────────────────
// 2024_01_01_000010_create_coupons_table.php
// ──────────────────────────────────────────────────────────────
/*
<?php
return new class extends Migration {
    public function up(): void
    {
        Schema::create('coupons', function (Blueprint $table) {
            $table->id();
            $table->string('code')->unique();
            $table->enum('type', ['percentage', 'fixed'])->default('percentage');
            $table->decimal('value', 8, 2); // 20 = 20% or $20
            $table->integer('max_uses')->nullable();
            $table->integer('used_count')->default(0);
            $table->decimal('min_order_amount', 10, 2)->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamp('expires_at')->nullable();
            $table->timestamps();

            $table->index('code');
            $table->index('is_active');
        });
    }
    public function down(): void { Schema::dropIfExists('coupons'); }
};
*/

// ──────────────────────────────────────────────────────────────
// 2024_01_01_000011_create_reviews_table.php
// ──────────────────────────────────────────────────────────────
/*
<?php
return new class extends Migration {
    public function up(): void
    {
        Schema::create('reviews', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('course_id')->constrained()->cascadeOnDelete();
            $table->tinyInteger('rating'); // 1–5
            $table->tinyInteger('rating_content')->nullable();
            $table->tinyInteger('rating_instructor')->nullable();
            $table->tinyInteger('rating_value')->nullable();
            $table->tinyInteger('rating_structure')->nullable();
            $table->string('title')->nullable();
            $table->text('comment');
            $table->boolean('would_recommend')->nullable();
            $table->enum('status', ['pending', 'approved', 'flagged', 'removed'])->default('pending');
            $table->string('instructor_reply')->nullable();
            $table->timestamp('replied_at')->nullable();
            $table->timestamps();

            $table->unique(['user_id', 'course_id']);
            $table->index(['course_id', 'status']);
            $table->index(['status', 'created_at']);
        });
    }
    public function down(): void { Schema::dropIfExists('reviews'); }
};
*/

// ──────────────────────────────────────────────────────────────
// 2024_01_01_000012_create_wishlists_table.php
// ──────────────────────────────────────────────────────────────
/*
<?php
return new class extends Migration {
    public function up(): void
    {
        Schema::create('wishlists', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('course_id')->constrained()->cascadeOnDelete();
            $table->timestamps();

            $table->unique(['user_id', 'course_id']);
            $table->index('user_id');
        });

        Schema::create('carts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('course_id')->constrained()->cascadeOnDelete();
            $table->timestamps();

            $table->unique(['user_id', 'course_id']);
        });
    }
    public function down(): void
    {
        Schema::dropIfExists('carts');
        Schema::dropIfExists('wishlists');
    }
};
*/

// ──────────────────────────────────────────────────────────────
// 2024_01_01_000013_create_certificates_table.php
// ──────────────────────────────────────────────────────────────
/*
<?php
return new class extends Migration {
    public function up(): void
    {
        Schema::create('certificates', function (Blueprint $table) {
            $table->id();
            $table->string('credential_id')->unique(); // LH-CERT-2024-001847
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('course_id')->constrained()->cascadeOnDelete();
            $table->foreignId('enrollment_id')->constrained()->cascadeOnDelete();
            $table->string('pdf_path')->nullable();
            $table->timestamp('issued_at');
            $table->timestamps();

            $table->unique(['user_id', 'course_id']);
            $table->index('credential_id');
        });
    }
    public function down(): void { Schema::dropIfExists('certificates'); }
};
*/

// ──────────────────────────────────────────────────────────────
// 2024_01_01_000014_create_notes_table.php
// ──────────────────────────────────────────────────────────────
/*
<?php
return new class extends Migration {
    public function up(): void
    {
        Schema::create('notes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('course_id')->constrained()->cascadeOnDelete();
            $table->foreignId('lesson_id')->constrained()->cascadeOnDelete();
            $table->text('content');
            $table->integer('timestamp_seconds')->default(0); // video timestamp
            $table->timestamps();
            $table->softDeletes();

            $table->index(['user_id', 'course_id']);
        });
    }
    public function down(): void { Schema::dropIfExists('notes'); }
};
*/

// ──────────────────────────────────────────────────────────────
// 2024_01_01_000015_create_qa_table.php
// ──────────────────────────────────────────────────────────────
/*
<?php
return new class extends Migration {
    public function up(): void
    {
        Schema::create('questions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('course_id')->constrained()->cascadeOnDelete();
            $table->foreignId('lesson_id')->nullable()->constrained()->nullOnDelete();
            $table->string('title');
            $table->text('body');
            $table->integer('upvotes')->default(0);
            $table->boolean('is_answered')->default(false);
            $table->timestamps();
            $table->softDeletes();

            $table->index(['course_id', 'lesson_id']);
        });

        Schema::create('answers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('question_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->text('body');
            $table->integer('upvotes')->default(0);
            $table->boolean('is_instructor_answer')->default(false);
            $table->boolean('is_accepted')->default(false);
            $table->timestamps();
            $table->softDeletes();
        });
    }
    public function down(): void
    {
        Schema::dropIfExists('answers');
        Schema::dropIfExists('questions');
    }
};
*/

// ──────────────────────────────────────────────────────────────
// 2024_01_01_000016_create_notifications_table.php
// ──────────────────────────────────────────────────────────────
/*
<?php
// Uses Laravel's built-in database notifications
// php artisan notifications:table
// This creates the 'notifications' table automatically.
*/

// ──────────────────────────────────────────────────────────────
// 2024_01_01_000017_create_payouts_table.php
// ──────────────────────────────────────────────────────────────
/*
<?php
return new class extends Migration {
    public function up(): void
    {
        Schema::create('earnings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('instructor_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('order_item_id')->constrained()->cascadeOnDelete();
            $table->foreignId('course_id')->constrained()->cascadeOnDelete();
            $table->decimal('gross_amount', 10, 2);  // what student paid
            $table->decimal('platform_fee', 10, 2);  // platform's cut (30%)
            $table->decimal('net_amount', 10, 2);     // instructor's share (70%)
            $table->enum('status', ['pending', 'available', 'paid'])->default('pending');
            $table->timestamp('available_at')->nullable();
            $table->timestamps();

            $table->index(['instructor_id', 'status']);
        });

        Schema::create('payouts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('instructor_id')->constrained('users')->cascadeOnDelete();
            $table->decimal('amount', 10, 2);
            $table->string('currency')->default('USD');
            $table->string('payment_method');  // paystack, bank_transfer
            $table->string('account_details')->nullable();
            $table->enum('status', ['requested', 'processing', 'completed', 'failed'])->default('requested');
            $table->string('reference')->nullable();
            $table->timestamp('processed_at')->nullable();
            $table->timestamps();

            $table->index(['instructor_id', 'status']);
        });
    }
    public function down(): void
    {
        Schema::dropIfExists('payouts');
        Schema::dropIfExists('earnings');
    }
};
*/

// ──────────────────────────────────────────────────────────────
// 2024_01_01_000018_create_social_accounts_table.php
// ──────────────────────────────────────────────────────────────
/*
<?php
return new class extends Migration {
    public function up(): void
    {
        Schema::create('social_accounts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('provider'); // google, github
            $table->string('provider_id');
            $table->string('token')->nullable();
            $table->timestamps();

            $table->unique(['provider', 'provider_id']);
            $table->index('user_id');
        });
    }
    public function down(): void { Schema::dropIfExists('social_accounts'); }
};
*/

// ──────────────────────────────────────────────────────────────
// 2024_01_01_000019_create_achievements_table.php
// ──────────────────────────────────────────────────────────────
/*
<?php
return new class extends Migration {
    public function up(): void
    {
        Schema::create('achievements', function (Blueprint $table) {
            $table->id();
            $table->string('title');
            $table->string('description');
            $table->string('icon')->default('🏅');
            $table->string('type'); // streak, completion, enrollment, review
            $table->integer('threshold')->default(1);
            $table->timestamps();
        });

        Schema::create('user_achievements', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('achievement_id')->constrained()->cascadeOnDelete();
            $table->boolean('is_new')->default(true);
            $table->timestamp('earned_at');
            $table->timestamps();

            $table->unique(['user_id', 'achievement_id']);
        });
    }
    public function down(): void
    {
        Schema::dropIfExists('user_achievements');
        Schema::dropIfExists('achievements');
    }
};
*/
