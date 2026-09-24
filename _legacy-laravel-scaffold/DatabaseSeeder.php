<?php

namespace Database\Seeders;

use App\Models\{Category, Course, Coupon, Enrollment, Lesson, Section, User};
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

// ── DatabaseSeeder ─────────────────────────────────────────────────────────

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $this->call([
            CategorySeeder::class,
            UserSeeder::class,
            CourseSeeder::class,
            CouponSeeder::class,
        ]);

        $this->command->info('✅ Database seeded successfully!');
        $this->command->table(
            ['Role', 'Email', 'Password'],
            [
                ['Student',    'justiceelorm@example.com',   'password'],
                ['Instructor', 'atosiaw@example.com', 'password'],
                ['Admin',      'cliffordjunior@GITAcademy.com','admin123 + code: ADMIN2024'],
            ]
        );
    }
}


// ── UserSeeder ─────────────────────────────────────────────────────────────

class UserSeeder extends Seeder
{
    public function run(): void
    {
        // Admin
        User::create([
            'first_name'        => 'CLIFFORD',
            'last_name'         => 'AKEY JUNIOR',
            'email'             => 'cliffordjunior@GITAcademy.com',
            'password'          => Hash::make('admin123'),
            'role'              => 'admin',
            'status'            => 'active',
            'email_verified_at' => now(),
        ]);

        // Instructor
        User::create([
            'first_name'        => 'ATO SIAW',
            'last_name'         => 'QUARSHIE',
            'email'             => 'atosiaw@example.com',
            'password'          => Hash::make('password'),
            'role'              => 'instructor',
            'status'            => 'active',
            'bio'               => 'PhD in Computer Science from MIT. 15+ years in machine learning research and industry. Former Google Brain researcher.',
            'tagline'           => 'Machine Learning Researcher & Educator',
            'location'          => 'ACCRA, GHANA',
            'email_verified_at' => now(),
        ]);

        // Student
        User::create([
            'first_name'        => 'Jutice',
            'last_name'         => 'Elorm',
            'email'             => 'justiceelorm@example.com',
            'password'          => Hash::make('password'),
            'role'              => 'student',
            'status'            => 'active',
            'bio'               => 'Self-taught developer from Accra, Ghana. Passionate about ML and building African tech products.',
            'location'          => 'Accra, Ghana',
            'streak_days'       => 5,
            'hours_learned'     => 42,
            'email_verified_at' => now(),
        ]);

        // Extra student
        User::create([
            'first_name'        => 'Emeka',
            'last_name'         => 'Faith',
            'email'             => 'emeka@example.com',
            'password'          => Hash::make('password'),
            'role'              => 'student',
            'status'            => 'active',
            'location'          => 'Lagos, Nigeria',
            'email_verified_at' => now(),
        ]);

        $this->command->info('Users seeded: ' . User::count());
    }
}


// ── CourseSeeder ───────────────────────────────────────────────────────────

class CourseSeeder extends Seeder
{
    public function run(): void
    {
        $instructor = User::where('role', 'instructor')->first();
        $student    = User::where('email', 'ama@example.com')->first();

        $devCat  = Category::where('slug', 'development')->first();
        $dataCat = Category::where('slug', 'data-science')->first();
        $desCat  = Category::where('slug', 'design')->first();

        $coursesData = [
            [
                'title'           => 'Machine Learning A-Z: Hands-On Python & R',
                'slug'            => 'machine-learning-a-z',
                'subtitle'        => 'Learn to create Machine Learning Algorithms in Python and R',
                'description'     => 'This comprehensive course takes you from beginner to advanced ML concepts. Covering supervised learning, unsupervised learning, feature engineering, model evaluation, and real-world deployment.',
                'category_id'     => $dataCat?->id,
                'price'           => 49.00,
                'original_price'  => 129.00,
                'level'           => 'all',
                'emoji'           => '🤖',
                'thumbnail_bg'    => '#1a2f3e',
                'status'          => 'published',
                'is_featured'     => true,
                'rating'          => 4.8,
                'students_count'  => 48200,
                'reviews_count'   => 12400,
                'duration_minutes'=> 2700,
                'requirements'    => ['Basic Python knowledge', 'No ML experience needed'],
                'objectives'      => ['Build ML models from scratch', 'Master feature engineering', 'Deploy models to production'],
                'published_at'    => now()->subMonths(6),
            ],
            [
                'title'           => 'The Complete JavaScript Course 2026',
                'slug'            => 'complete-javascript-2026',
                'subtitle'        => 'From Zero to Expert — The Modern JavaScript Course',
                'description'     => 'Master JavaScript with the most comprehensive course available. From fundamentals to advanced OOP, async JS, and modern ES6+.',
                'category_id'     => $devCat?->id,
                'price'           => 39.00,
                'original_price'  => 99.00,
                'level'           => 'all',
                'emoji'           => '⚡',
                'thumbnail_bg'    => '#3d2800',
                'status'          => 'published',
                'rating'          => 4.9,
                'students_count'  => 38500,
                'reviews_count'   => 9800,
                'duration_minutes'=> 4140,
                'published_at'    => now()->subMonths(3),
            ],
            [
                'title'           => 'UI/UX Design Bootcamp: Figma to Prototype',
                'slug'            => 'uiux-design-bootcamp',
                'subtitle'        => 'Master UX research, UI design, and Figma prototyping',
                'description'     => 'A complete guide to becoming a UX/UI designer. Learn design thinking, user research, wireframing, Figma, and prototyping.',
                'category_id'     => $desCat?->id,
                'price'           => 44.00,
                'level'           => 'beginner',
                'emoji'           => '🎨',
                'thumbnail_bg'    => '#2d1a3e',
                'status'          => 'published',
                'rating'          => 4.7,
                'students_count'  => 22000,
                'reviews_count'   => 6200,
                'duration_minutes'=> 1920,
                'published_at'    => now()->subMonths(2),
            ],
            [
                'title'           => 'Python for Everybody — Zero to Hero',
                'slug'            => 'python-for-everybody',
                'subtitle'        => 'The most beginner-friendly Python course',
                'description'     => 'Start from absolute zero and build real Python applications. Fundamentals, OOP, file handling, APIs, data structures.',
                'category_id'     => $devCat?->id,
                'price'           => 0,
                'pricing_type'    => 'free',
                'level'           => 'beginner',
                'emoji'           => '🐍',
                'thumbnail_bg'    => '#1a3e1a',
                'status'          => 'published',
                'rating'          => 4.9,
                'students_count'  => 125000,
                'reviews_count'   => 18500,
                'duration_minutes'=> 1500,
                'published_at'    => now()->subMonths(12),
            ],
            [
                'title'           => 'Data Analysis with Pandas & Matplotlib',
                'slug'            => 'data-analysis-pandas',
                'subtitle'        => 'Analyse and visualise data like a data scientist',
                'description'     => 'Master Python data analysis. Clean messy data, build visualisations, and communicate findings professionally.',
                'category_id'     => $dataCat?->id,
                'price'           => 34.00,
                'level'           => 'intermediate',
                'emoji'           => '📊',
                'thumbnail_bg'    => '#1a3e2d',
                'status'          => 'published',
                'rating'          => 4.8,
                'students_count'  => 18400,
                'reviews_count'   => 4100,
                'duration_minutes'=> 1320,
                'published_at'    => now()->subMonths(4),
            ],
        ];

        foreach ($coursesData as $data) {
            $course = Course::create(array_merge($data, [
                'instructor_id'  => $instructor->id,
                'has_certificate'=> true,
            ]));

            // Create sections and lessons
            for ($s = 1; $s <= 3; $s++) {
                $section = Section::create([
                    'course_id'  => $course->id,
                    'title'      => "Section {$s}: " . ['Getting Started', 'Core Concepts', 'Advanced Topics'][$s - 1],
                    'sort_order' => $s,
                ]);

                for ($l = 1; $l <= 5; $l++) {
                    Lesson::create([
                        'course_id'        => $course->id,
                        'section_id'       => $section->id,
                        'title'            => "Lesson " . (($s-1)*5+$l) . ": " . fake()->sentence(3),
                        'type'             => 'video',
                        'duration_seconds' => rand(600, 3600),
                        'is_free'          => ($s === 1 && $l === 1),
                        'sort_order'       => $l,
                    ]);
                }
            }

            // Enroll the demo student in first 2 courses
            if (in_array($course->slug, ['machine-learning-a-z', 'complete-javascript-2024'])) {
                Enrollment::create([
                    'user_id'          => $student->id,
                    'course_id'        => $course->id,
                    'price_paid'       => $course->price,
                    'progress_pct'     => $course->slug === 'machine-learning-a-z' ? 68 : 22,
                    'status'           => 'active',
                    'last_accessed_at' => now()->subHours(rand(1, 72)),
                ]);
            }
        }

        $this->command->info('Courses seeded: ' . Course::count());
    }
}


// ── CouponSeeder ───────────────────────────────────────────────────────────

class CouponSeeder extends Seeder
{
    public function run(): void
    {
        $coupons = [
            ['code' => 'LEARN20',   'type' => 'percentage', 'value' => 20, 'max_uses' => 10000],
            ['code' => 'LAUNCH10',  'type' => 'percentage', 'value' => 10, 'max_uses' => 5000],
            ['code' => 'AFRICA50',  'type' => 'percentage', 'value' => 50, 'max_uses' => 1000, 'expires_at' => now()->addDays(30)],
            ['code' => 'WELCOME',   'type' => 'fixed',      'value' => 10, 'max_uses' => 1000, 'min_order_amount' => 20],
            ['code' => 'FULLSTACK', 'type' => 'percentage', 'value' => 30, 'max_uses' => 500],
        ];

        foreach ($coupons as $data) {
            Coupon::create(array_merge($data, ['is_active' => true]));
        }

        $this->command->info('Coupons seeded: ' . Coupon::count());
    }
}
