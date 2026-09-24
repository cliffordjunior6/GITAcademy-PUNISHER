/**
 * GITAcademy — utils.js
 * Common utility functions used across the platform
 */

// ─── FORMAT HELPERS ───────────────────────────────────────────

/** Format a price in Ghanaian cedis: 49 → "₵49.00" or "Free". No currency conversion — numbers are treated as GHS amounts as-is. */
export function formatPrice(amount, currency = 'GHS') {
  if (!amount || amount === 0) return 'Free';
  const n = Number(amount);
  const hasCents = Math.round(n * 100) % 100 !== 0;
  return '₵' + n.toLocaleString('en-GH', { minimumFractionDigits: hasCents ? 2 : 0, maximumFractionDigits: 2 });
}

/** Format a number with K/M suffix: 48200 → "48.2K" */
export function formatNumber(n) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1_000)     return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
  return n?.toString() || '0';
}

/** Format minutes to "Xh Ym": 145 → "2h 25m" */
export function formatDuration(minutes) {
  if (!minutes) return '—';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/** Format a date: "2024-03-27" → "March 27, 2024" */
export function formatDate(dateStr, options = {}) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
    ...options,
  });
}

/** Relative time: "2 hours ago", "3 days ago" */
export function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1)   return 'just now';
  if (mins < 60)  return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)   return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7)   return `${days}d ago`;
  return formatDate(dateStr, { month: 'short', day: 'numeric' });
}

/** Truncate text: "This is a very long…" */
export function truncate(str, maxLength = 80) {
  if (!str) return '';
  return str.length <= maxLength ? str : str.slice(0, maxLength).trimEnd() + '…';
}

/** Slugify: "My Course Title" → "my-course-title" */
export function slugify(str) {
  return str.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/** Get initials from name: "Ama Kofi" → "AK" */
export function getInitials(name = '') {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

// ─── STAR RATING ──────────────────────────────────────────────

/** Returns a string of filled/empty stars: 4.3 → "★★★★☆" */
export function starsHTML(rating) {
  const full  = Math.floor(rating);
  const half  = rating % 1 >= 0.5 ? 1 : 0;
  const empty = 5 - full - half;
  return '★'.repeat(full) + (half ? '⭐' : '') + '☆'.repeat(empty);
}

// ─── DOM HELPERS ──────────────────────────────────────────────

/** Show a toast notification */
export function showToast(message, type = 'success', duration = 3000) {
  const existing = document.getElementById('lh-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id = 'lh-toast';
  const colors = { success:'#2d7a4f', error:'#e05555', warning:'#d97706', info:'#2563eb' };
  toast.style.cssText = `
    position:fixed;bottom:2rem;right:2rem;background:${colors[type] || colors.success};
    color:white;padding:.85rem 1.4rem;border-radius:12px;font-size:.875rem;font-weight:600;
    box-shadow:0 8px 30px rgba(13,13,15,.25);display:flex;align-items:center;gap:.5rem;
    z-index:9999;transform:translateY(80px);opacity:0;transition:.3s;font-family:inherit;
  `;
  const icons = { success:'✓', error:'✕', warning:'⚠', info:'ℹ' };
  toast.innerHTML = `<span>${icons[type] || '✓'}</span><span>${message}</span>`;
  document.body.appendChild(toast);

  requestAnimationFrame(() => {
    toast.style.transform = 'translateY(0)';
    toast.style.opacity = '1';
  });
  setTimeout(() => {
    toast.style.transform = 'translateY(80px)';
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

/** Confirm dialog — returns true/false */
export function confirm(message) {
  return window.confirm(message);
}

/** Set button loading state */
export function setLoading(btn, loading, loadingText = 'Loading…', originalText = null) {
  if (loading) {
    btn._originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = loadingText;
    btn.style.opacity = '0.7';
  } else {
    btn.disabled = false;
    btn.textContent = originalText || btn._originalText || '';
    btn.style.opacity = '1';
  }
}

/** Smooth scroll to element */
export function scrollTo(selector) {
  const el = document.querySelector(selector);
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ─── URL / PARAMS ─────────────────────────────────────────────

/** Get URL query param: getParam('id') */
export function getParam(key) {
  return new URLSearchParams(window.location.search).get(key);
}

/** Get URL hash without #: getHash() → 'certificates' */
export function getHash() {
  return window.location.hash.replace('#', '');
}

/** Update URL query param without reload */
export function setParam(key, value) {
  const url = new URL(window.location.href);
  if (value === null || value === undefined) {
    url.searchParams.delete(key);
  } else {
    url.searchParams.set(key, value);
  }
  window.history.replaceState({}, '', url.toString());
}

// ─── STORAGE ──────────────────────────────────────────────────

export const storage = {
  get: (key, fallback = null) => {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
  },
  set: (key, value) => {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) {}
  },
  remove: (key) => localStorage.removeItem(key),
};

// ─── VALIDATION ───────────────────────────────────────────────

export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function passwordStrength(password) {
  let score = 0;
  if (password.length >= 8)            score++;
  if (/[A-Z]/.test(password))          score++;
  if (/[0-9]/.test(password))          score++;
  if (/[^A-Za-z0-9]/.test(password))   score++;
  const labels = ['Too weak', 'Could be stronger', 'Getting there', 'Strong ✓'];
  const colors = ['#e05555', '#e8a020', '#4a90d9', '#2d7a4f'];
  return { score, label: labels[score - 1] || '', color: colors[score - 1] || '' };
}

// ─── DEBOUNCE / THROTTLE ──────────────────────────────────────

export function debounce(fn, delay = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

export function throttle(fn, limit = 200) {
  let last = 0;
  return (...args) => {
    const now = Date.now();
    if (now - last >= limit) { last = now; fn(...args); }
  };
}

// ─── COURSE CARD BUILDER ──────────────────────────────────────

/** Build a course card HTML string from a course object */
export function buildCourseCard(course) {
  const price = course.price === 0
    ? '<span class="course-price free">Free</span>'
    : `<span class="course-price">${formatPrice(course.price)}</span>`;

  return `
    <a href="course-details.html?id=${course.id}" class="course-card">
      <div class="course-thumb" style="background:${course.thumbnail_bg || '#f0ece4'}">
        <span>${course.emoji || '📚'}</span>
        ${course.is_bestseller ? '<span class="course-badge">Bestseller</span>' : ''}
        ${course.is_new ? '<span class="course-badge new">New</span>' : ''}
        ${course.price === 0 ? '<span class="course-badge free">Free</span>' : ''}
      </div>
      <div class="course-body">
        <div class="course-cat">${course.category || ''}</div>
        <div class="course-title">${truncate(course.title, 65)}</div>
        <div class="course-instructor">${course.instructor?.name || ''}</div>
        <div class="course-meta">
          <span class="course-stars">${starsHTML(course.rating || 0)}</span>
          <span>${(course.rating || 0).toFixed(1)}</span>
          <span>(${formatNumber(course.reviews_count || 0)})</span>
          <span>· ${formatDuration(course.duration_minutes)}</span>
        </div>
        <div class="course-footer">
          <div>${price}</div>
          <button class="btn-enroll" onclick="event.preventDefault(); addToCart(${course.id})">Enroll</button>
        </div>
      </div>
    </a>`;
}

/** Render a grid of course cards into a container */
export function renderCourseGrid(containerId, courses) {
  const container = document.getElementById(containerId);
  if (!container) return;
  if (!courses?.length) {
    container.innerHTML = `<div class="no-results"><div class="no-results-icon">🔍</div><h3>No courses found</h3><p>Try adjusting your filters or search terms.</p></div>`;
    return;
  }
  container.innerHTML = courses.map(buildCourseCard).join('');
}

// ─── PROGRESS BAR ─────────────────────────────────────────────

export function setProgress(barId, pct) {
  const bar = document.getElementById(barId);
  if (bar) bar.style.width = Math.min(100, Math.max(0, pct)) + '%';
}

// ─── COPY TO CLIPBOARD ────────────────────────────────────────

export async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    showToast('Copied to clipboard!', 'success', 2000);
    return true;
  } catch {
    return false;
  }
}
