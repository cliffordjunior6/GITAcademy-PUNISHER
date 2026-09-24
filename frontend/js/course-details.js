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
}

function renderCourseHero(course) {
  const titleEl = document.querySelector('.course-title');
  if (titleEl) titleEl.innerHTML = course.title;
  const priceEl = document.querySelector('.enroll-price');
  if (priceEl) priceEl.textContent = course.price === 0 ? 'Free' : formatPrice(course.price);

  // Real discount display — only shown when the course actually has one
  const priceRow = document.getElementById('enrollPriceRow');
  if (priceRow && course.original_price && course.original_price > course.price) {
    const pct = Math.round((1 - course.price / course.original_price) * 100);
    priceRow.innerHTML = `<span class="enroll-price">${course.price === 0 ? 'Free' : formatPrice(course.price)}</span>
      <span class="enroll-price-old">${formatPrice(course.original_price)}</span>
      <span class="enroll-discount">${pct}% off</span>`;
  }

  // Real preview thumbnail — real emoji, and navigates to THIS course (was hardcoded to course 1)
  const preview = document.getElementById('enrollPreview');
  if (preview) {
    preview.textContent = course.emoji || '📚';
    const overlay = document.createElement('div');
    overlay.className = 'enroll-preview-overlay';
    overlay.innerHTML = '<div class="play-btn"><svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg></div>';
    preview.appendChild(overlay);
    preview.style.background = course.thumbnail_bg || 'var(--smoke)';
    preview.addEventListener('click', () => { window.location = `course-player.html?course_id=${course.id}`; });
  }

  // Enroll buttons — real "Enroll for Free" one-click path for free courses,
  // using the direct enroll endpoint instead of the cart/checkout ceremony
  const primaryBtn = document.getElementById('primaryEnrollBtn');
  const secondaryBtn = document.getElementById('secondaryEnrollBtn');
  const mobileBtn = document.getElementById('mobileEnrollBtn');
  if (course.price === 0) {
    if (primaryBtn) {
      primaryBtn.dataset.action = 'enroll-free';
      primaryBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> Enroll for Free';
    }
    if (secondaryBtn) secondaryBtn.style.display = 'none';
    if (mobileBtn) { mobileBtn.dataset.action = 'enroll-free'; mobileBtn.textContent = 'Enroll for Free'; }
  }

  const subEl = document.getElementById('courseSubtitle');
  if (subEl) subEl.textContent = course.subtitle || course.description || '';

  document.getElementById('breadcrumbTitle').textContent = course.title;
  const catLink = document.getElementById('breadcrumbCat');
  if (catLink) {
    catLink.textContent = course.category || 'Courses';
    catLink.href = course.category_slug ? `course-list.html?cat=${course.category_slug}` : 'course-list.html';
  }
  const catTag = document.getElementById('courseCategoryTag');
  if (catTag) catTag.textContent = `${course.emoji || '📚'} ${course.category || 'Course'}`;

  const ratingNum = document.getElementById('ratingNum');
  if (ratingNum) ratingNum.textContent = (course.rating || 0).toFixed(1);
  const ratingStars = document.getElementById('ratingStars');
  if (ratingStars) ratingStars.textContent = '★'.repeat(Math.round(course.rating || 0)) + '☆'.repeat(5 - Math.round(course.rating || 0));
  const ratingCount = document.getElementById('ratingCount');
  if (ratingCount) ratingCount.textContent = `(${(course.reviews_count || 0).toLocaleString()} ratings)`;

  const studentsCount = document.getElementById('studentsCount');
  if (studentsCount) studentsCount.textContent = (course.students_count || 0).toLocaleString();

  const miniAvatar = document.getElementById('miniAvatar');
  const miniLink = document.getElementById('miniInstructorLink');
  if (course.instructor) {
    if (miniAvatar) miniAvatar.textContent = course.instructor.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
    if (miniLink) { miniLink.textContent = course.instructor.name; miniLink.href = `instructor-profile.html?id=${course.instructor.id}`; }
  }

  const tagsEl = document.getElementById('courseTags');
  if (tagsEl) {
    const tags = [
      formatDuration(course.duration_minutes) + ' of video',
      course.level || 'All Levels',
      course.has_certificate ? 'Certificate included' : null,
      course.language || 'English',
      'Lifetime access',
    ].filter(Boolean);
    tagsEl.innerHTML = tags.map(t => `<span class="course-tag">${t}</span>`).join('');
  }
}

function renderCurriculum(course) {
  const container = document.getElementById('sectionList');
  const lessons = course.lessons || [];
  if (!container || !lessons.length) return;

  // The backend stores a flat lesson list per course (no nested sections), so we
  // render one "Course Content" group rather than pretending there are multiple sections.
  container.innerHTML = `
    <div class="curriculum-section open">
      <div class="section-header" onclick="this.parentElement.classList.toggle('open')">
        <div class="section-header-left">
          <span class="section-chevron">›</span>
          <span class="section-name">Course Content</span>
        </div>
        <span class="section-meta">${lessons.length} lectures · ${formatDuration(course.duration_minutes)}</span>
      </div>
      <div class="lesson-list">
        ${lessons.map(lesson => `
          <div class="lesson-item">
            <div class="lesson-icon ${lesson.is_free ? 'free' : ''}">
              ${lesson.type === 'video' ? '<svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>' : '📝'}
            </div>
            <span class="lesson-name">${lesson.title}</span>
            ${lesson.is_free ? '<span class="lesson-preview">Preview</span>' : ''}
            <span class="lesson-duration">${formatDuration(Math.round((lesson.duration_seconds||0)/60))}</span>
          </div>`).join('')}
      </div>
    </div>`;

  const statsEl = document.querySelector('.curriculum-stats');
  if (statsEl) {
    statsEl.textContent = `${lessons.length} lectures • ${formatDuration(course.duration_minutes)} total`;
  }
}

async function renderReviews(courseId) {
  try {
    const data = await coursesApi.reviews(courseId);
    const reviews = data.reviews || [];

    // Rating summary widget
    const avg = reviews.length ? reviews.reduce((s,r)=>s+r.rating,0) / reviews.length : 0;
    const bigNum = document.getElementById('reviewsBigNum');
    if (bigNum) bigNum.textContent = avg.toFixed(1);
    const bigStars = document.getElementById('reviewsBigStars');
    if (bigStars) bigStars.textContent = '★'.repeat(Math.round(avg)) + '☆'.repeat(5 - Math.round(avg));
    const label = document.getElementById('reviewsTotalLabel');
    if (label) label.textContent = `${reviews.length} rating${reviews.length===1?'':'s'}`;

    const starCounts = [0,0,0,0,0]; // index 0 = 5★ ... index 4 = 1★
    reviews.forEach(r => { const i = 5 - r.rating; if (starCounts[i] !== undefined) starCounts[i]++; });
    const maxCount = Math.max(1, ...starCounts);
    const barsEl = document.getElementById('ratingBars');
    if (barsEl) {
      barsEl.innerHTML = starCounts.map((c, i) => {
        const stars = 5 - i;
        const pct = Math.round(c / maxCount * 100);
        return `<div class="rating-bar-row"><span>${stars} ★</span><div class="rating-bar-wrap"><div class="rating-bar-fill" style="width:${pct}%"></div></div><span class="rating-bar-pct">${c}</span></div>`;
      }).join('');
    }

    const container = document.getElementById('reviewsList');
    if (!container) return;
    if (!reviews.length) {
      container.innerHTML = '<p style="font-size:.85rem;color:rgba(13,13,15,.4);padding:1rem 0">No reviews yet — be the first to review this course after completing it!</p>';
      return;
    }
    container.innerHTML = reviews.slice(0, 5).map(r => {
      const name = `${r.first_name} ${r.last_name}`;
      return `
      <div class="review-item">
        <div class="review-header">
          <div class="reviewer-avatar">${name.slice(0,2).toUpperCase()}</div>
          <div class="reviewer-info"><div class="reviewer-name">${name}</div>
          <div class="review-stars-date"><span class="review-stars-small">${'★'.repeat(r.rating)}${'☆'.repeat(5-r.rating)}</span><span>${(r.created_at||'').slice(0,10)}</span></div></div>
        </div>
        <p class="review-text">${r.title ? `<strong>${r.title}</strong> — ` : ''}${r.comment || ''}</p>
      </div>`;
    }).join('');
  } catch { /* use static content */ }
}

function renderInstructor(course) {
  const ins = course.instructor;
  if (!ins) return;
  const nameEl = document.querySelector('.instructor-name-big');
  if (nameEl) nameEl.textContent = ins.name;
  const roleEl = document.querySelector('.instructor-role');
  if (roleEl) roleEl.textContent = ins.title || 'Instructor';
  const bioEl = document.getElementById('instructorBio');
  if (bioEl) bioEl.textContent = ins.title ? `${ins.name} — ${ins.title}` : `${ins.name} is an instructor on GITAcademy.`;
  const avatarEl = document.querySelector('.instructor-avatar-big');
  if (avatarEl) avatarEl.textContent = ins.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const profileLink = document.getElementById('instructorProfileLink');
  if (profileLink) profileLink.href = `instructor-profile.html?id=${ins.id}`;
  // Stats — real, computed server-side across this instructor's courses
  const stats = document.querySelectorAll('.instructor-stat');
  if (stats[0]) stats[0].innerHTML = `⭐ ${ins.rating || 0} Rating`;
  if (stats[1]) stats[1].innerHTML = `👥 ${(ins.students_count || 0).toLocaleString()} Students`;
  if (stats[2]) stats[2].innerHTML = `📚 ${ins.courses_count || 0} Courses`;
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
            <span class="mini-price">${c.price === 0 ? 'Free' : '₵' + c.price}</span>
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
  // Free courses — real one-click enroll via the direct endpoint, no cart/checkout ceremony
  document.querySelectorAll('[data-action="enroll-free"]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const courseId = getParam('id');
      if (!isLoggedIn()) { window.location.href = 'login.html'; return; }
      const original = btn.innerHTML;
      btn.disabled = true;
      btn.textContent = 'Enrolling…';
      try {
        await coursesApi.enroll(courseId);
        showToast('Enrolled! Redirecting to the course…', 'success');
        setTimeout(() => window.location.href = `course-player.html?course_id=${courseId}`, 1000);
      } catch (err) {
        showToast(err.data?.message || 'Could not enroll', 'error');
        btn.disabled = false;
        btn.innerHTML = original;
      }
    });
  });
}

function bindWishlist() {
  const btn = document.getElementById('wishlistBtn');
  if (!btn) return;
  const courseId = getParam('id');

  const savedHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="var(--rust)" stroke="var(--rust)" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg> Saved to Wishlist';
  const unsavedHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg> Add to Wishlist';

  // Reflect real initial saved state (logged-in users only)
  if (isLoggedIn()) {
    userApi.wishlist().then(data => {
      const saved = (data.courses || []).some(c => String(c.id) === String(courseId));
      btn.dataset.saved = saved ? 'true' : 'false';
      btn.innerHTML = saved ? savedHTML : unsavedHTML;
    }).catch(() => {});
  }

  btn.addEventListener('click', async () => {
    if (!isLoggedIn()) { window.location.href = 'login.html'; return; }
    const saved = btn.dataset.saved === 'true';
    try {
      if (saved) {
        await userApi.removeFromWishlist(courseId);
        btn.dataset.saved = 'false';
        btn.innerHTML = unsavedHTML;
        showToast('Removed from wishlist', 'info');
      } else {
        await userApi.addToWishlist(courseId);
        btn.dataset.saved = 'true';
        btn.innerHTML = savedHTML;
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

document.addEventListener('DOMContentLoaded', initCourseDetails);
