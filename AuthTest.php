<?php

namespace Tests\Feature\Auth;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AuthTest extends TestCase
{
    use RefreshDatabase;

    // ── Registration ─────────────────────────────────────────

    public function test_student_can_register(): void
    {
        $response = $this->postJson('/api/auth/register', [
            'first_name'            => 'Justice',
            'last_name'             => 'Elorm',
            'email'                 => 'justiceelorm@test.com',
            'password'              => 'password123',
            'password_confirmation' => 'password123',
            'role'                  => 'student',
        ]);

        $response->assertStatus(201)
                 ->assertJsonStructure(['token', 'user' => ['id','first_name','role']]);

        $this->assertDatabaseHas('users', ['email' => 'justiceelorm@test.com', 'role' => 'student']);
    }

    public function test_instructor_can_register(): void
    {
        $response = $this->postJson('/api/auth/register', [
            'first_name'            => 'ATO SIAW',
            'last_name'             => 'QUARSHIE',
            'email'                 => 'atosiaw@test.com',
            'password'              => 'password123',
            'password_confirmation' => 'password123',
            'role'                  => 'instructor',
            'expertise'             => 'Machine Learning',
        ]);

        $response->assertStatus(201);
        $this->assertDatabaseHas('users', ['email' => 'atosiaw@test.com', 'role' => 'instructor']);
    }

    public function test_admin_registration_requires_invite_code(): void
    {
        $response = $this->postJson('/api/auth/register', [
            'first_name'            => 'Admin',
            'last_name'             => 'User',
            'email'                 => 'admin@test.com',
            'password'              => 'password123',
            'password_confirmation' => 'password123',
            'role'                  => 'admin',
            // No admin_invite_code
        ]);

        $response->assertStatus(422)
                 ->assertJsonValidationErrors(['admin_invite_code']);
    }

    public function test_admin_registration_succeeds_with_correct_code(): void
    {
        $response = $this->postJson('/api/auth/register', [
            'first_name'            => 'Admin',
            'last_name'             => 'User',
            'email'                 => 'admin@test.com',
            'password'              => 'password123',
            'password_confirmation' => 'password123',
            'role'                  => 'admin',
            'admin_invite_code'     => 'ADMIN2024',
        ]);

        $response->assertStatus(201);
    }

    public function test_duplicate_email_rejected(): void
    {
        User::factory()->create(['email' => 'existing@test.com']);

        $response = $this->postJson('/api/auth/register', [
            'first_name'            => 'New',
            'last_name'             => 'User',
            'email'                 => 'existing@test.com',
            'password'              => 'password123',
            'password_confirmation' => 'password123',
        ]);

        $response->assertStatus(422)->assertJsonValidationErrors(['email']);
    }

    // ── Login ─────────────────────────────────────────────────

    public function test_user_can_login(): void
    {
        $user = User::factory()->create([
            'email'    => 'test@test.com',
            'password' => bcrypt('password123'),
            'role'     => 'student',
        ]);

        $response = $this->postJson('/api/auth/login', [
            'email'    => 'test@test.com',
            'password' => 'password123',
        ]);

        $response->assertOk()
                 ->assertJsonStructure(['token', 'user'])
                 ->assertJsonPath('user.role', 'student');
    }

    public function test_wrong_password_rejected(): void
    {
        User::factory()->create(['email' => 'test@test.com', 'password' => bcrypt('correct')]);

        $this->postJson('/api/auth/login', [
            'email'    => 'test@test.com',
            'password' => 'wrong',
        ])->assertStatus(422);
    }

    public function test_suspended_user_cannot_login(): void
    {
        User::factory()->create([
            'email'    => 'banned@test.com',
            'password' => bcrypt('password'),
            'status'   => 'suspended',
        ]);

        $this->postJson('/api/auth/login', [
            'email'    => 'banned@test.com',
            'password' => 'password',
        ])->assertStatus(403);
    }

    // ── Auth Guards ───────────────────────────────────────────

    public function test_unauthenticated_cannot_access_dashboard(): void
    {
        $this->getJson('/api/dashboard')->assertStatus(401);
    }

    public function test_student_cannot_access_instructor_routes(): void
    {
        $student = User::factory()->create(['role' => 'student']);

        $this->actingAs($student)
             ->getJson('/api/instructor/dashboard')
             ->assertStatus(403);
    }

    public function test_instructor_cannot_access_admin_routes(): void
    {
        $instructor = User::factory()->create(['role' => 'instructor']);

        $this->actingAs($instructor)
             ->getJson('/api/admin/dashboard')
             ->assertStatus(403);
    }

    public function test_authenticated_user_can_logout(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)
             ->postJson('/api/auth/logout')
             ->assertOk()
             ->assertJsonPath('message', 'Logged out successfully.');
    }
}


// ─────────────────────────────────────────────────────────────
// tests/Feature/Course/CourseTest.php
// ─────────────────────────────────────────────────────────────
namespace Tests\Feature\Course;

use App\Models\{Category, Course, Enrollment, User};
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CourseTest extends TestCase
{
    use RefreshDatabase;

    public function test_anyone_can_list_published_courses(): void
    {
        Course::factory(5)->published()->create();
        Course::factory(3)->create(['status' => 'draft']);

        $response = $this->getJson('/api/courses');

        $response->assertOk()
                 ->assertJsonStructure(['courses', 'pagination']);

        // Only published courses returned
        $this->assertCount(5, $response->json('courses.data'));
    }

    public function test_courses_can_be_filtered_by_category(): void
    {
        $category = Category::factory()->create();
        Course::factory(3)->published()->create(['category_id' => $category->id]);
        Course::factory(2)->published()->create();

        $this->getJson("/api/courses?filter[category_id]={$category->id}")
             ->assertOk()
             ->assertJsonCount(3, 'courses.data');
    }

    public function test_courses_can_be_searched(): void
    {
        Course::factory()->published()->create(['title' => 'Python for Machine Learning']);
        Course::factory()->published()->create(['title' => 'JavaScript Fundamentals']);

        $this->getJson('/api/courses/search?q=machine+learning')
             ->assertOk()
             ->assertJsonFragment(['title' => 'Python for Machine Learning']);
    }

    public function test_course_detail_shows_curriculum(): void
    {
        $course = Course::factory()->published()->has(
            \App\Models\Section::factory()->has(\App\Models\Lesson::factory(5))
        )->create();

        $this->getJson("/api/courses/{$course->slug}")
             ->assertOk()
             ->assertJsonStructure(['course' => ['sections']]);
    }

    public function test_student_can_enroll_in_free_course(): void
    {
        $student = User::factory()->create(['role' => 'student']);
        $course  = Course::factory()->published()->create(['price' => 0, 'pricing_type' => 'free']);

        $this->actingAs($student)
             ->postJson("/api/courses/{$course->id}/enroll")
             ->assertOk()
             ->assertJsonFragment(['message' => 'Enrolled successfully.']);

        $this->assertDatabaseHas('enrollments', [
            'user_id'   => $student->id,
            'course_id' => $course->id,
        ]);
    }

    public function test_enrolled_student_can_update_lesson_progress(): void
    {
        $student  = User::factory()->create(['role' => 'student']);
        $course   = Course::factory()->published()->create();
        $section  = \App\Models\Section::factory()->create(['course_id' => $course->id]);
        $lesson   = \App\Models\Lesson::factory()->create(['course_id' => $course->id, 'section_id' => $section->id]);
        Enrollment::factory()->create(['user_id' => $student->id, 'course_id' => $course->id]);

        $this->actingAs($student)
             ->postJson("/api/courses/{$course->id}/lessons/{$lesson->id}/progress", ['completed' => true])
             ->assertOk()
             ->assertJsonPath('is_completed', true);

        $this->assertDatabaseHas('lesson_progress', [
            'user_id'      => $student->id,
            'lesson_id'    => $lesson->id,
            'is_completed' => true,
        ]);
    }

    public function test_student_can_add_to_wishlist(): void
    {
        $student = User::factory()->create(['role' => 'student']);
        $course  = Course::factory()->published()->create();

        $this->actingAs($student)
             ->postJson("/api/wishlist/{$course->id}")
             ->assertOk();

        $this->assertDatabaseHas('wishlists', ['user_id' => $student->id, 'course_id' => $course->id]);
    }

    public function test_instructor_can_create_course(): void
    {
        $instructor = User::factory()->create(['role' => 'instructor']);

        $this->actingAs($instructor)
             ->postJson('/api/instructor/courses', [
                 'title'       => 'My New Course',
                 'description' => 'Course description',
                 'price'       => 49.00,
             ])
             ->assertStatus(201)
             ->assertJsonPath('course.status', 'draft');
    }
}


// ─────────────────────────────────────────────────────────────
// tests/Feature/Course/ReviewTest.php
// ─────────────────────────────────────────────────────────────
class ReviewTest extends TestCase
{
    use RefreshDatabase;

    public function test_enrolled_student_can_submit_review(): void
    {
        $student = User::factory()->create(['role' => 'student']);
        $course  = Course::factory()->published()->create();
        Enrollment::factory()->create(['user_id' => $student->id, 'course_id' => $course->id]);

        $this->actingAs($student)
             ->postJson("/api/courses/{$course->id}/reviews", [
                 'rating'  => 5,
                 'comment' => 'This is an excellent course with great content and clear explanations.',
             ])
             ->assertStatus(201);
    }

    public function test_unenrolled_student_cannot_review(): void
    {
        $student = User::factory()->create(['role' => 'student']);
        $course  = Course::factory()->published()->create();

        $this->actingAs($student)
             ->postJson("/api/courses/{$course->id}/reviews", [
                 'rating'  => 4,
                 'comment' => 'This is a long enough comment to pass validation.',
             ])
             ->assertStatus(403);
    }

    public function test_student_cannot_review_same_course_twice(): void
    {
        $student = User::factory()->create(['role' => 'student']);
        $course  = Course::factory()->published()->create();
        Enrollment::factory()->create(['user_id' => $student->id, 'course_id' => $course->id]);
        \App\Models\Review::factory()->create(['user_id' => $student->id, 'course_id' => $course->id]);

        $this->actingAs($student)
             ->postJson("/api/courses/{$course->id}/reviews", [
                 'rating'  => 3,
                 'comment' => 'Attempting a second review which should be rejected.',
             ])
             ->assertStatus(422);
    }
}


// ─────────────────────────────────────────────────────────────
// tests/Feature/Admin/AdminTest.php
// ─────────────────────────────────────────────────────────────
namespace Tests\Feature\Admin;

use App\Models\{Course, User};
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AdminTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();
        $this->admin = User::factory()->create(['role' => 'admin']);
    }

    public function test_admin_can_view_dashboard(): void
    {
        $this->actingAs($this->admin)
             ->getJson('/api/admin/dashboard')
             ->assertOk()
             ->assertJsonStructure(['stats', 'activity', 'revenue']);
    }

    public function test_admin_can_list_users(): void
    {
        User::factory(10)->create();

        $this->actingAs($this->admin)
             ->getJson('/api/admin/users')
             ->assertOk()
             ->assertJsonStructure(['users']);
    }

    public function test_admin_can_suspend_user(): void
    {
        $user = User::factory()->create(['status' => 'active']);

        $this->actingAs($this->admin)
             ->patchJson("/api/admin/users/{$user->id}/status", ['status' => 'suspended'])
             ->assertOk();

        $this->assertDatabaseHas('users', ['id' => $user->id, 'status' => 'suspended']);
    }

    public function test_admin_can_approve_course(): void
    {
        $course = Course::factory()->create(['status' => 'pending']);

        $this->actingAs($this->admin)
             ->patchJson("/api/admin/courses/{$course->id}/status", ['status' => 'published'])
             ->assertOk();

        $this->assertDatabaseHas('courses', ['id' => $course->id, 'status' => 'published']);
    }

    public function test_admin_can_manage_categories(): void
    {
        $response = $this->actingAs($this->admin)
                         ->postJson('/api/admin/categories', [
                             'name' => 'Blockchain',
                             'icon' => '⛓️',
                         ]);

        $response->assertStatus(201);
        $this->assertDatabaseHas('categories', ['name' => 'Blockchain']);
    }
}


// ─────────────────────────────────────────────────────────────
// tests/Unit/CouponTest.php
// ─────────────────────────────────────────────────────────────
namespace Tests\Unit;

use App\Models\Coupon;
use Tests\TestCase;

class CouponTest extends TestCase
{
    public function test_percentage_coupon_calculates_correctly(): void
    {
        $coupon = new Coupon(['type' => 'percentage', 'value' => 20, 'is_active' => true]);
        $this->assertEquals(20.0, $coupon->calculateDiscount(100));
        $this->assertEquals(9.8, $coupon->calculateDiscount(49));
    }

    public function test_fixed_coupon_cannot_exceed_total(): void
    {
        $coupon = new Coupon(['type' => 'fixed', 'value' => 50, 'is_active' => true]);
        $this->assertEquals(30.0, $coupon->calculateDiscount(30)); // cap at total
        $this->assertEquals(50.0, $coupon->calculateDiscount(100));
    }

    public function test_expired_coupon_is_invalid(): void
    {
        $coupon = new Coupon([
            'type'       => 'percentage',
            'value'      => 10,
            'is_active'  => true,
            'expires_at' => now()->subDay(),
        ]);
        $this->assertFalse($coupon->isValid(100));
    }

    public function test_inactive_coupon_is_invalid(): void
    {
        $coupon = new Coupon(['type' => 'percentage', 'value' => 10, 'is_active' => false]);
        $this->assertFalse($coupon->isValid(100));
    }

    public function test_min_order_coupon_rejected_for_small_orders(): void
    {
        $coupon = new Coupon([
            'type'              => 'percentage',
            'value'             => 20,
            'is_active'         => true,
            'min_order_amount'  => 50,
        ]);
        $this->assertFalse($coupon->isValid(30));
        $this->assertTrue($coupon->isValid(60));
    }

    public function test_exhausted_coupon_is_invalid(): void
    {
        $coupon = new Coupon([
            'type'       => 'percentage',
            'value'      => 10,
            'is_active'  => true,
            'max_uses'   => 100,
            'used_count' => 100,
        ]);
        $this->assertFalse($coupon->isValid(100));
    }
}
