<?php

namespace App\Models;

use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\{HasMany, BelongsToMany, HasOne};
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable implements MustVerifyEmail
{
    use HasApiTokens, HasFactory, Notifiable, SoftDeletes;

    protected $fillable = [
        'first_name', 'last_name', 'email', 'password',
        'role', 'status', 'avatar', 'bio', 'tagline',
        'location', 'website', 'streak_days', 'hours_learned',
        'timezone', 'language', 'social_links',
        'email_verified_at',
    ];

    protected $hidden = ['password', 'remember_token'];

    protected $casts = [
        'email_verified_at' => 'datetime',
        'password'          => 'hashed',
        'social_links'      => 'array',
        'hours_learned'     => 'float',
        'streak_days'       => 'integer',
    ];

    // ── Relationships ──────────────────────────────────────────

    public function courses(): HasMany
    {
        return $this->hasMany(Course::class, 'instructor_id');
    }

    public function enrollments(): HasMany
    {
        return $this->hasMany(Enrollment::class);
    }

    public function enrolledCourses(): BelongsToMany
    {
        return $this->belongsToMany(Course::class, 'enrollments')
                    ->withPivot(['progress_pct', 'status', 'completed_at', 'last_accessed_at'])
                    ->withTimestamps();
    }

    public function completedCourses(): BelongsToMany
    {
        return $this->enrolledCourses()->wherePivot('status', 'completed');
    }

    public function wishlist(): BelongsToMany
    {
        return $this->belongsToMany(Course::class, 'wishlists')->withTimestamps();
    }

    public function cart(): BelongsToMany
    {
        return $this->belongsToMany(Course::class, 'carts')->withTimestamps();
    }

    public function certificates(): HasMany
    {
        return $this->hasMany(Certificate::class);
    }

    public function reviews(): HasMany
    {
        return $this->hasMany(Review::class);
    }

    public function orders(): HasMany
    {
        return $this->hasMany(Order::class);
    }

    public function notes(): HasMany
    {
        return $this->hasMany(Note::class);
    }

    public function questions(): HasMany
    {
        return $this->hasMany(Question::class);
    }

    public function achievements(): BelongsToMany
    {
        return $this->belongsToMany(Achievement::class, 'user_achievements')
                    ->withPivot(['is_new', 'earned_at'])
                    ->withTimestamps();
    }

    public function socialAccounts(): HasMany
    {
        return $this->hasMany(SocialAccount::class);
    }

    public function earnings(): HasMany
    {
        return $this->hasMany(Earning::class, 'instructor_id');
    }

    public function payouts(): HasMany
    {
        return $this->hasMany(Payout::class, 'instructor_id');
    }

    public function lessonProgress(): HasMany
    {
        return $this->hasMany(LessonProgress::class);
    }

    // ── Helpers ────────────────────────────────────────────────

    public function isStudent(): bool    { return $this->role === 'student'; }
    public function isInstructor(): bool { return $this->role === 'instructor'; }
    public function isAdmin(): bool      { return $this->role === 'admin'; }

    public function getFullNameAttribute(): string
    {
        return "{$this->first_name} {$this->last_name}";
    }

    public function getAvatarUrlAttribute(): ?string
    {
        if (!$this->avatar) return null;
        return str_starts_with($this->avatar, 'http')
            ? $this->avatar
            : asset("storage/{$this->avatar}");
    }

    public function isEnrolledIn(int $courseId): bool
    {
        return $this->enrollments()
                    ->where('course_id', $courseId)
                    ->whereIn('status', ['active', 'completed'])
                    ->exists();
    }

    public function hasCompletedCourse(int $courseId): bool
    {
        return $this->enrollments()
                    ->where('course_id', $courseId)
                    ->where('status', 'completed')
                    ->exists();
    }

    public function getTotalStudentsAttribute(): int
    {
        if (!$this->isInstructor()) return 0;
        return Enrollment::whereHas('course', fn($q) => $q->where('instructor_id', $this->id))
                         ->count();
    }

    public function getPendingPayoutAttribute(): float
    {
        return $this->earnings()
                    ->where('status', 'available')
                    ->sum('net_amount');
    }

    // Scopes
    public function scopeStudents($query)    { return $query->where('role', 'student'); }
    public function scopeInstructors($query) { return $query->where('role', 'instructor'); }
    public function scopeAdmins($query)      { return $query->where('role', 'admin'); }
    public function scopeActive($query)      { return $query->where('status', 'active'); }
}
