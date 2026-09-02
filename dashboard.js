/**
 * GITAcademy — dashboard.js
 * Handles student dashboard: stats, enrolled courses, recommendations, activity
 */

import { userApi, coursesApi } from './api.js';
import { showToast, formatNumber, formatDuration, buildCourseCard, renderCourseGrid, timeAgo, setProgress } from './utils.js';
import { getUser, isLoggedIn, redirectIfNotLoggedIn } from './auth.js';

// ─── INIT ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  redirectIfNotLoggedIn();
  initDashboard();
  initSidebar();
  initDropdowns();
});

async function initDashboard() {
  const user = getUser();
  setWelcomeName(user);

  // Load all sections in parallel
  await Promise.allSettled([
    loadStats(),
    loadEnrolledCourses(),
    loadRecommendedCourses(),
    loadActivity(),
    loadAchievements(),
  ]);
}

// ─── WELCOME BANNER ───────────────────────────────────────────
function setWelcomeName(user) {
  const titleEl = document.querySelector('.welcome-title');
  if (!titleEl || !user) return;
  const name = user.first_name || user.name?.split(' ')[0] || 'there';
  titleEl.innerHTML = `Welcome back,<br><em>${name}!</em>`;
}

// ─── STATS ────────────────────────────────────────────────────
async function loadStats() {
  try {
    const profile = await userApi.profile();
    const stats   = profile.stats || {};

    setText('statActiveCourses',  stats.active_courses  ?? 4);
    setText('statHoursLearned',   (stats.hours_learned  ?? 42) + 'h');
    setText('statCertificates',   stats.certificates    ?? 2);
    setText('statStreak',         stats.streak_days     ?? 5);

    // Update streak sub-label
    const streakSub = document.querySelector('[data-stat="streak"] .stat-label');
    if (streakSub && stats.streak_days >= 7) streakSub.textContent = 'Personal best!';
  } catch (_) {
    // Static fallback already in HTML
  }
}

// ─── ENROLLED COURSES ─────────────────────────────────────────
async function loadEnrolledCourses() {
  try {
    const courses = await userApi.myCourses();
    if (!courses?.length) return;

    const grid = document.getElementById('continueGrid');
    if (!grid) return;

    grid.innerHTML = courses.slice(0, 4).map(c => `
      <a href="course-player.html?course_id=${c.id}" class="course-progress-card">
        <div class="course-thumb" style="background:${c.thumbnail_bg || '#f0ece4'}">${c.emoji || '📚'}</div>
        <div class="course-info">
          <div class="course-category">${c.category || ''}</div>
          <div class="course-name">${c.title}</div>
          <div class="progress-wrap">
            <div class="progress-bar" style="width:${c.progress_pct || 0}%"></div>
          </div>
          <div class="progress-meta">
            <span>${c.progress_pct || 0}% complete</span>
            <span>Lesson ${c.current_lesson || 1}/${c.lessons_count || '?'}</span>
          </div>
        </div>
      </a>`).join('');
  } catch (_) {
    // Use static HTML fallback
  }
}

// ─── RECOMMENDED COURSES ──────────────────────────────────────
async function loadRecommendedCourses() {
  try {
    const courses = await coursesApi.featured();
    renderCourseGrid('recommendedGrid', courses?.slice(0, 3));
  } catch (_) {}
}

// ─── ACTIVITY ─────────────────────────────────────────────────
async function loadActivity() {
  try {
    const profile  = await userApi.profile();
    const activity = profile.recent_activity || [];
    if (!activity.length) return;

    const list = document.getElementById('activityList');
    if (!list) return;

    const iconMap = {
      completed: { icon: '✅', cls: 'green' },
      enrolled:  { icon: '🛒', cls: 'rust' },
      reviewed:  { icon: '📝', cls: 'blue' },
      certificate: { icon: '🏆', cls: 'gold' },
    };

    list.innerHTML = activity.slice(0, 5).map(item => {
      const { icon, cls } = iconMap[item.type] || { icon: '📌', cls: 'blue' };
      return `
        <div class="activity-item">
          <div class="activity-icon ${cls}">${icon}</div>
          <div style="flex:1">
            <div class="activity-text">${item.description}</div>
            <div class="activity-time">${timeAgo(item.created_at)}</div>
          </div>
        </div>`;
    }).join('');
  } catch (_) {}
}

// ─── ACHIEVEMENTS ─────────────────────────────────────────────
async function loadAchievements() {
  try {
    const achievements = await userApi.achievements();
    if (!achievements?.length) return;

    const list = document.getElementById('achievementList');
    if (!list) return;

    list.innerHTML = achievements.slice(0, 3).map(a => `
      <div class="achievement-item">
        <div class="achievement-badge">${a.icon || '🏅'}</div>
        <div class="achievement-info">
          <strong>${a.title}</strong>
          <span>${a.description}</span>
        </div>
        ${a.is_new ? '<span class="achievement-new">NEW</span>' : ''}
      </div>`).join('');
  } catch (_) {}
}

// ─── SIDEBAR ──────────────────────────────────────────────────
function initSidebar() {
  const hamburgerBtn = document.getElementById('hamburgerBtn');
  const sidebar      = document.getElementById('sidebar');
  const overlay      = document.getElementById('sidebarOverlay');

  hamburgerBtn?.addEventListener('click', () => {
    sidebar?.classList.toggle('open');
    overlay?.classList.toggle('open');
  });
  overlay?.addEventListener('click', () => {
    sidebar?.classList.remove('open');
    overlay?.classList.remove('open');
  });
}

// ─── DROPDOWNS ────────────────────────────────────────────────
function initDropdowns() {
  const userMenuBtn  = document.getElementById('userMenuBtn');
  const userDropdown = document.getElementById('userDropdown');

  userMenuBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    userDropdown?.classList.toggle('open');
  });
  document.addEventListener('click', () => userDropdown?.classList.remove('open'));
}

// ─── HELPERS ──────────────────────────────────────────────────
function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}
