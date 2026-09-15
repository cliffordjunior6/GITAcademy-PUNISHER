export function debounce(fn, wait = 250) {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), wait);
  };
}

export const CURRENCY = { code: 'GHS', symbol: '₵' };

export function getParam(name, fallback = null) {
  const params = new URLSearchParams(window.location.search);
  const value = params.get(name);
  return value ?? fallback;
}

export function formatPrice(value, options = {}) {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount) || amount <= 0) {
    return options.freeText ?? 'Free';
  }

  const formatted = new Intl.NumberFormat('en-GH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);

  const symbol = CURRENCY.symbol;
  const suffix = options.includeCode ? ' GHS' : '';
  return `${symbol}${formatted}${suffix}`;
}

export function formatNumber(value) {
  const num = Number(value ?? 0);
  if (!Number.isFinite(num)) return '0';
  return new Intl.NumberFormat('en-GH').format(num);
}

export function formatDuration(minutes) {
  const total = Number(minutes ?? 0);
  if (!Number.isFinite(total) || total <= 0) return '0m';

  const hrs = Math.floor(total / 60);
  const mins = total % 60;
  if (hrs && mins) return `${hrs}h ${mins}m`;
  if (hrs) return `${hrs}h`;
  return `${mins}m`;
}

export function buildCourseCard(course = {}) {
  const price = course.price === 0 || course.free ? 'Free' : formatPrice(course.price);
  const rating = course.rating ?? 4.8;
  const lessons = course.lessons || course.lessons_count || 12;
  const bg = course.thumbnail_bg || '#f0ece4';
  const emoji = course.emoji || '📚';
  const title = course.title || 'Course';

  return `
    <a href="course-details.html?id=${course.id || 1}" class="course-card">
      <div class="course-thumb" style="background:${bg}">${emoji}</div>
      <div class="course-body">
        <div class="course-tag">${course.category || 'Featured'}</div>
        <h3>${title}</h3>
        <div class="course-meta">
          <span>⭐ ${rating}</span>
          <span>${lessons} lessons</span>
        </div>
        <div class="course-footer">
          <span class="author">${course.instructor || 'GITAcademy'}</span>
          <span class="price">${price}</span>
        </div>
      </div>
    </a>
  `;
}

export function renderCourseGrid(elementId, courses = []) {
  const target = document.getElementById(elementId);
  if (!target) return;

  target.innerHTML = (courses || []).slice(0, 4).map(buildCourseCard).join('');
}

export function timeAgo(dateString) {
  if (!dateString) return 'just now';
  const then = new Date(dateString).getTime();
  const diff = Date.now() - then;
  const minutes = Math.max(1, Math.round(diff / 60000));

  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

export function setProgress(element, value) {
  const node = typeof element === 'string' ? document.getElementById(element) : element;
  if (!node) return;
  const pct = Math.max(0, Math.min(100, Number(value ?? 0)));
  node.style.width = `${pct}%`;
  node.setAttribute('aria-valuenow', String(pct));
}

export function showToast(message, type = 'success', timeout = 2500) {
  const existing = document.querySelector('.gitacademy-toast');
  if (existing) existing.remove();

  const node = document.createElement('div');
  node.className = `gitacademy-toast ${type}`;
  node.textContent = message;
  node.style.cssText = `
    position: fixed; right: 20px; bottom: 20px; z-index: 9999;
    background: #0d0d0f; color: #f5f0e8; padding: 0.8rem 1rem; border-radius: 12px;
    box-shadow: 0 10px 30px rgba(0,0,0,.18); font-weight: 600;
  `;
  document.body.appendChild(node);

  window.setTimeout(() => node.remove(), timeout);
}

export function safeParse(key, fallback = null) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

export function getDemoUsers() {
  const seed = [
    { id: 1, first_name: 'Justice', last_name: 'Elorm', email: 'justiceelorm@example.com', password: 'password', role: 'student' },
    { id: 2, first_name: 'Ato', last_name: 'Siaw', email: 'atosiaw@example.com', password: 'password', role: 'instructor' },
    { id: 3, first_name: 'Clifford', last_name: 'Junior', email: 'cliffordjunior@GITAcademy.com', password: 'admin123', role: 'admin' },
  ];

  const saved = safeParse('gitacademy_users', null);
  if (saved && Array.isArray(saved) && saved.length) return saved;
  localStorage.setItem('gitacademy_users', JSON.stringify(seed));
  return seed;
}

export async function getDemoCourses() {
  const stored = safeParse('gitacademy_courses', null);
  if (stored && Array.isArray(stored) && stored.length) return stored;

  try {
    const response = await fetch('./courses.json');
    const json = await response.json();
    const courses = Array.isArray(json) ? json : json.courses || [];
    localStorage.setItem('gitacademy_courses', JSON.stringify(courses));
    return courses;
  } catch {
    return [
      { id: 1, title: 'Machine Learning A-Z', category: 'AI', price: 490, instructor: 'Prof. Ato', rating: 4.9, thumbnail_bg: '#e8f5e9', emoji: '🤖' },
      { id: 2, title: 'UI/UX Design Bootcamp', category: 'Design', price: 440, instructor: 'Joseph Gadasu', rating: 4.7, thumbnail_bg: '#e8eaf6', emoji: '🎨' },
      { id: 3, title: 'Python for Data Science', category: 'Data', price: 390, instructor: 'Naa', rating: 4.8, thumbnail_bg: '#fce4ec', emoji: '🐍' },
    ];
  }
}

export function ensureDemoState() {
  getDemoUsers();
  if (!localStorage.getItem('gitacademy_cart')) {
    localStorage.setItem('gitacademy_cart', JSON.stringify([]));
  }
}

export default {
  CURRENCY,
  getParam,
  formatPrice,
  formatNumber,
  formatDuration,
  buildCourseCard,
  renderCourseGrid,
  timeAgo,
  setProgress,
  showToast,
  safeParse,
  getDemoUsers,
  getDemoCourses,
  ensureDemoState,
};
