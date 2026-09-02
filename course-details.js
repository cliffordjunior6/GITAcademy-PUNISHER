/**
 * GITAcademy — course-details.js
 * Course preview page: enroll, wishlist, curriculum accordion, reviews
 */

import { coursesApi, cartApi, userApi } from './api.js';
import { getParam, showToast, formatPrice, formatDuration } from './utils.js';
import { isLoggedIn } from './auth.js';

export async function initCourseDetails() {
  const courseId = getParam('id');
  if (!courseId) return;

  try {
    const course = await coursesApi.get(courseId);
    renderCourseHero(course);
    renderCurriculum(course);
    renderInstructor(course);
    renderReviews(courseId);
    renderRelated(course);
  } catch {
    // Fall back to static content already in HTML
  }

  bindEnrollButtons();
  bindWishlist();
  initCurriculumAccordion();
  bindMobileEnrollBar();
  bindCountdownTimer();
}

function renderCourseHero(course) {
  const titleEl = document.querySelector('.course-title');
  if (titleEl) titleEl.textContent = course.title;
  const priceEl = document.querySelector('.enroll-price');
  if (priceEl) priceEl.textContent = course.price === 0 ? 'Free' : formatPrice(course.price);
}

function renderCurriculum(course) {
  const container = document.getElementById('sectionList');
  if (!container || !course.sections?.length) return;

  container.innerHTML = course.sections.map((section, si) => `
    <div class="curriculum-section ${si === 0 ? 'open' : ''}">
      <div class="section-header" onclick="this.parentElement.classList.toggle('open')">
        <div class="section-header-left">
          <span class="section-chevron">›</span>
          <span class="section-name">${section.title}</span>
        </div>
        <span class="section-meta">${section.lessons?.length || 0} lectures · ${formatDuration(section.duration_minutes)}</span>
      </div>
      <div class="lesson-list">
        ${(section.lessons || []).map(lesson => `
          <div class="lesson-item">
            <div class="lesson-icon ${lesson.is_free ? 'free' : ''}">
              ${lesson.type === 'video' ? '<svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>' : '📝'}
            </div>
            <span class="lesson-name">${lesson.title}</span>
            ${lesson.is_free ? '<span class="lesson-preview">Preview</span>' : ''}
            <span class="lesson-duration">${lesson.duration_formatted || '—'}</span>
          </div>`).join('')}
      </div>
    </div>`).join('');

  // Update curriculum stats
  const statsEl = document.querySelector('.curriculum-stats');
  if (statsEl) {
    const totalLessons = course.sections.reduce((acc, s) => acc + (s.lessons?.length || 0), 0);
    statsEl.textContent = `${course.sections.length} sections • ${totalLessons} lectures • ${formatDuration(course.duration_minutes)} total`;
  }
}

async function renderReviews(courseId) {
  try {
    const reviews = await coursesApi.reviews(courseId);
    const container = document.getElementById('reviewsList');
    if (!container || !reviews?.length) return;
    container.innerHTML = reviews.slice(0, 5).map(r => `
      <div class="review-item">
        <div class="review-header">
          <div class="reviewer-avatar">${r.user.name.slice(0,2).toUpperCase()}</div>
          <div><div class="reviewer-name">${r.user.name}</div>
          <div class="review-stars-date"><span class="review-stars-small">${'★'.repeat(r.rating)}${'☆'.repeat(5-r.rating)}</span><span>${r.created_at}</span></div></div>
        </div>
        <p class="review-text">${r.comment}</p>
      </div>`).join('');
  } catch { /* use static content */ }
}

function renderInstructor(course) {
  const ins = course.instructor;
  if (!ins) return;
  const nameEl = document.querySelector('.instructor-name-big');
  if (nameEl) nameEl.textContent = ins.name;
  const roleEl = document.querySelector('.instructor-role');
  if (roleEl) roleEl.textContent = ins.title || 'Instructor';
  const bioEl = document.querySelector('.instructor-bio');
  if (bioEl && ins.bio) bioEl.textContent = ins.bio;
  const avatarEl = document.querySelector('.instructor-avatar-big');
  if (avatarEl) avatarEl.textContent = ins.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  // Stats
  const stats = document.querySelectorAll('.instructor-stat');
  if (stats[0] && ins.rating)          stats[0].innerHTML = `⭐ ${ins.rating} Rating`;
  if (stats[1] && ins.students_count)  stats[1].innerHTML = `👥 ${ins.students_count.toLocaleString()} Students`;
  if (stats[2] && ins.courses_count)   stats[2].innerHTML = `📚 ${ins.courses_count} Courses`;
}

async function renderRelated(course) {
  try {
    const results = await coursesApi.list({ category: course.category, exclude: course.id, limit: 4 });
    const grid = document.querySelector('.related-grid');
    if (!grid || !results?.courses?.length) return;
    grid.innerHTML = (results.courses || []).slice(0, 4).map(c => `
      <a href="course-details.html?id=${c.id}" class="mini-course-card">
        <div class="mini-thumb" style="background:${c.thumbnail_bg || '#f0ece4'}">${c.emoji || '📚'}</div>
        <div class="mini-body">
          <div class="mini-title">${c.title}</div>
          <div class="mini-meta">
            <span>⭐ ${c.rating || '—'}</span>
            <span class="mini-price">${c.price === 0 ? 'Free' : '$' + c.price}</span>
          </div>
        </div>
      </a>`).join('');
  } catch { /* keep static HTML */ }
}

function bindEnrollButtons() {
  document.querySelectorAll('[data-action="add-to-cart"]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const courseId = btn.dataset.courseId || getParam('id');
      if (!isLoggedIn()) { window.location.href = 'login.html'; return; }
      try {
        await cartApi.add(courseId);
        showToast('Added to cart!', 'success');
        setTimeout(() => window.location.href = 'cart.html', 1200);
      } catch (err) {
        showToast(err.message || 'Could not add to cart', 'error');
      }
    });
  });
  document.querySelectorAll('[data-action="buy-now"]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const courseId = btn.dataset.courseId || getParam('id');
      if (!isLoggedIn()) { window.location.href = 'login.html'; return; }
      await cartApi.add(courseId).catch(() => {});
      window.location.href = 'checkout.html';
    });
  });
}

function bindWishlist() {
  const btn = document.getElementById('wishlistBtn');
  if (!btn) return;
  const courseId = getParam('id');
  btn.addEventListener('click', async () => {
    if (!isLoggedIn()) { window.location.href = 'login.html'; return; }
    const saved = btn.dataset.saved === 'true';
    try {
      if (saved) {
        await userApi.removeFromWishlist(courseId);
        btn.dataset.saved = 'false';
        showToast('Removed from wishlist', 'info');
      } else {
        await userApi.addToWishlist(courseId);
        btn.dataset.saved = 'true';
        showToast('Saved to wishlist ♥', 'success');
      }
    } catch { showToast('Please log in to save courses', 'warning'); }
  });
}

function initCurriculumAccordion() {
  document.querySelectorAll('.section-header').forEach(hdr => {
    hdr.addEventListener('click', () => hdr.parentElement.classList.toggle('open'));
  });
  const expandBtn = document.getElementById('expandAllBtn');
  if (expandBtn) {
    expandBtn.addEventListener('click', () => {
      const sections = document.querySelectorAll('.curriculum-section');
      const allOpen = [...sections].every(s => s.classList.contains('open'));
      sections.forEach(s => allOpen ? s.classList.remove('open') : s.classList.add('open'));
      expandBtn.textContent = allOpen ? 'Expand All' : 'Collapse All';
    });
  }
}

function bindMobileEnrollBar() {
  // Bar is shown on scroll past enroll card
  const enroll = document.querySelector('.enroll-card');
  if (!enroll) return;
  window.addEventListener('scroll', () => {
    const bar = document.querySelector('.mobile-enroll-bar');
    if (!bar) return;
    bar.style.display = window.scrollY > enroll.offsetTop + enroll.offsetHeight ? 'flex' : 'none';
  });
}

function bindCountdownTimer() {
  const timerEl = document.querySelector('.enroll-timer strong');
  if (!timerEl) return;
  let hours = 47, mins = 59, secs = 59;
  setInterval(() => {
    secs--;
    if (secs < 0) { secs = 59; mins--; }
    if (mins < 0) { mins = 59; hours--; }
    if (hours < 0) return;
    timerEl.textContent = `${hours}h ${mins}m ${secs}s`;
  }, 1000);
}

document.addEventListener('DOMContentLoaded', initCourseDetails);
