/**
 * GITAcademy — dashboard.js
 * Handles student dashboard: stats, enrolled courses, recommendations, activity
 */

import { userApi, coursesApi, cartApi } from './api.js';
import { showToast, formatNumber, formatDuration, buildCourseCard, renderCourseGrid, timeAgo, setProgress } from './utils.js';
import { getUser, isLoggedIn, redirectIfNotLoggedIn, logout } from './auth.js';

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
  setNavIdentity(user);

  // Load all sections in parallel
  await Promise.allSettled([
    loadStats(),
    loadEnrolledCourses(),
    loadRecommendedCourses(),
    loadActivity(),
    loadAchievements(),
    loadSidebarBadges(),
  ]);
}

// ─── WELCOME BANNER ───────────────────────────────────────────
function setWelcomeName(user) {
  const titleEl = document.querySelector('.welcome-title');
  if (!titleEl || !user) return;
  const name = user.first_name || user.name?.split(' ')[0] || 'there';
  titleEl.innerHTML = `Welcome back,<br><em>${name}!</em>`;
}

function setNavIdentity(user) {
  if (!user) return;
  const navName = document.querySelector('.nav-user-name');
  const avatar = document.querySelector('.nav-user .avatar, .nav-user-wrap .avatar');
  if (navName) navName.textContent = user.first_name || 'You';
  if (avatar) avatar.textContent = ((user.first_name?.[0]||'') + (user.last_name?.[0]||'')).toUpperCase() || 'U';
}

async function loadSidebarBadges() {
  try {
    const cart = await cartApi.get();
    setText('sbCartCount', (cart.items || []).length);
  } catch (_) { /* leave placeholder */ }
  try {
    const saved = await userApi.wishlist();
    setText('sbSavedCount', (saved.courses || []).length);
  } catch (_) { /* leave placeholder */ }
}

// ─── STATS ────────────────────────────────────────────────────
let cachedEnrolledCourses = null;

async function loadStats() {
  try {
    const user = getUser();
    const coursesResp = await userApi.myCourses();
    cachedEnrolledCourses = coursesResp.courses || [];
    setText('sbMyCoursesCount', cachedEnrolledCourses.length);
    const certResp = await userApi.certificates().catch(() => ({ certificates: [] }));

    const active = cachedEnrolledCourses.filter(c => c.enrollment_status !== 'completed').length;
    const certificates = (certResp.certificates || []).length;

    setText('statActiveCourses',  active);
    setText('statHoursLearned',   Math.round(user?.hours_learned || 0) + 'h');
    setText('statCertificates',   certificates);
    setText('statStreak',         user?.streak_days || 0);

    const streakSub = document.querySelector('[data-stat="streak"] .stat-label');
    if (streakSub && (user?.streak_days || 0) >= 7) streakSub.textContent = 'Personal best!';

    const sub = document.getElementById('welcomeSub');
    if (sub) {
      if (cachedEnrolledCourses.length) {
        const inProgress = cachedEnrolledCourses.find(c => c.enrollment_status !== 'completed') || cachedEnrolledCourses[0];
        sub.textContent = `You're ${inProgress.progress_pct || 0}% through ${inProgress.title}. Keep going!`;
      } else {
        sub.textContent = "You haven't enrolled in any courses yet — browse the catalogue to get started.";
      }
    }
  } catch (_) {
    // Static fallback already in HTML
  }
}

// ─── ENROLLED COURSES ─────────────────────────────────────────
async function loadEnrolledCourses() {
  try {
    const courses = cachedEnrolledCourses || (await userApi.myCourses()).courses || [];
    const grid = document.getElementById('continueGrid');
    if (!grid) return;

    if (!courses.length) {
      grid.innerHTML = `<p style="padding:1rem;color:rgba(13,13,15,.4);font-size:.9rem">You haven't enrolled in any courses yet. <a href="course-list.html" style="color:var(--rust)">Browse courses →</a></p>`;
      return;
    }

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
            <span>${c.enrollment_status === 'completed' ? 'Completed ✓' : 'In progress'}</span>
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
    const data = await coursesApi.featured();
    renderCourseGrid('recommendedGrid', (data.courses || []).slice(0, 3));
  } catch (_) {}
}

// ─── ACTIVITY ─────────────────────────────────────────────────
async function loadActivity() {
  try {
    const courses = cachedEnrolledCourses || (await userApi.myCourses()).courses || [];
    const list = document.getElementById('activityList');
    if (!list) return;

    if (!courses.length) {
      list.innerHTML = `<p style="padding:1rem 0;color:rgba(13,13,15,.4);font-size:.85rem">No activity yet — enroll in a course to get started.</p>`;
      return;
    }

    const items = courses.slice(0, 5).map(c => {
      const done = c.enrollment_status === 'completed';
      return {
        icon: done ? '✅' : '🛒',
        cls: done ? 'green' : 'rust',
        text: done ? `<strong>Completed</strong> — ${c.title}` : `Enrolled in <strong>${c.title}</strong> (${c.progress_pct || 0}% complete)`,
      };
    });

    list.innerHTML = items.map(item => `
        <div class="activity-item">
          <div class="activity-icon ${item.cls}">${item.icon}</div>
          <div style="flex:1">
            <div class="activity-text">${item.text}</div>
          </div>
        </div>`).join('');
  } catch (_) {}
}

// ─── ACHIEVEMENTS ─────────────────────────────────────────────
async function loadAchievements() {
  try {
    const data = await userApi.achievements();
    const achievements = data.achievements || [];
    const list = document.getElementById('achievementList');
    if (!list) return;

    if (!achievements.length) {
      list.innerHTML = `<p style="padding:.5rem 0;color:rgba(13,13,15,.4);font-size:.85rem">Keep learning to unlock achievements!</p>`;
      return;
    }

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

  document.querySelectorAll('.dropdown-item.danger').forEach(btn => {
    btn.addEventListener('click', (e) => { e.preventDefault(); logout(); });
  });
}

// ─── HELPERS ──────────────────────────────────────────────────
function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}
