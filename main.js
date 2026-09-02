/**
 * GITAcademy — main.js
 * Application entry point.
 * Auto-detects the current page and initialises the right modules.
 *
 * Usage in HTML:
 *   <script type="module" src="main.js"></script>
 *
 * This single script replaces per-page inline <script> tags when
 * you convert the HTML files to Blade templates.
 */

// ── Core modules always loaded ─────────────────────────────────
import { initNavbar }        from './navbar.js';
import { populateNav }       from './auth.js';

// ── Page-specific modules (lazy via dynamic import) ────────────
const PAGE_MAP = {
  // Auth
  'login.html':           () => import('./auth.js').then(m => m.initAuthForms()),
  'register.html':        () => import('./auth.js').then(m => m.initAuthForms()),
  'forgot-password.html': () => import('./auth.js').then(m => m.initAuthForms()),
  'reset-password.html':  () => import('./auth.js').then(m => m.initAuthForms()),

  // Student
  'dashboard.html':       () => import('./dashboard.js').then(m => m.default?.() ?? Promise.resolve()),
  'profile.html':         () => initProfile(),
  'edit-profile.html':    () => initEditProfile(),

  // Course discovery
  'home.html':            () => initHome(),
  'course-list.html':     () => import('./course-list.js').then(m => m.initCourseList()),
  'course-details.html':  () => import('./course-details.js').then(m => m.initCourseDetails()),
  'category-list.html':   () => initCategoryList(),

  // Course player
  'course-player.html':   () => import('./course-player.js').then(() => {}),

  // Instructor
  'instructor-dashboard.html': () => initInstructorDashboard(),
  'create-course.html':        () => import('./create-course.js').then(() => {}),
  'edit-course.html':          () => import('./course-editor.js').then(() => {}),
  'upload-video.html':         () => import('./upload-video.js').then(() => {}),
  'course-analytics.html':     () => initCourseAnalytics(),

  // Checkout
  'cart.html':             () => initCart(),
  'checkout.html':         () => initCheckout(),
  'payment-success.html':  () => initPaymentSuccess(),
  'payment-failed.html':   () => {},

  // Admin
  'admin-dashboard.html':  () => {},
  'admin-users.html':      () => {},
  'admin-courses.html':    () => {},
  'admin-payments.html':   () => {},

  // Static
  'about.html':   () => {},
  'contact.html': () => initContact(),
  'help.html':    () => initHelp(),
  'terms.html':   () => initLegalPage(),
  'privacy.html': () => initLegalPage(),
};

// ── Bootstrap ──────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  // Always run
  initNavbar();
  populateNav();
  initGlobalUI();

  // Page-specific
  const page = getCurrentPage();
  const init = PAGE_MAP[page];
  if (init) {
    try { await init(); }
    catch (err) { console.warn(`[LearnHub] Page init error on ${page}:`, err); }
  }
});

// ── Helpers ────────────────────────────────────────────────────
function getCurrentPage() {
  const path = window.location.pathname.split('/').pop() || 'index.html';
  // Strip query string / hash
  return path.split('?')[0].split('#')[0] || 'index.html';
}

// ── Global UI (runs on every page) ────────────────────────────
function initGlobalUI() {
  // Smooth-scroll all anchor links
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', e => {
      const target = document.querySelector(a.getAttribute('href'));
      if (target) { e.preventDefault(); target.scrollIntoView({ behavior: 'smooth' }); }
    });
  });

  // Auto-close dropdowns on outside click
  document.addEventListener('click', e => {
    document.querySelectorAll('.dropdown.open, .user-dropdown.open').forEach(d => {
      if (!d.contains(e.target) && !d.previousElementSibling?.contains(e.target)) {
        d.classList.remove('open');
      }
    });
  });

  // Escape key closes modals / drawers
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-overlay, .drawer.open').forEach(el => el.remove());
      document.querySelectorAll('.dropdown.open, .user-dropdown.open').forEach(d => d.classList.remove('open'));
    }
  });

  // Animate elements as they enter viewport
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in-view');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1 });
    document.querySelectorAll('[data-animate]').forEach(el => observer.observe(el));
  }

  // Form input: clear error state on focus
  document.addEventListener('focusin', e => {
    if (e.target.matches('.form-input.error')) {
      e.target.classList.remove('error');
      e.target.closest('.form-group')?.querySelector('.form-error')?.remove();
    }
  });

  // Tooltips (data-tooltip attribute)
  initTooltips();
}

// ── Tooltips ────────────────────────────────────────────────────
function initTooltips() {
  document.querySelectorAll('[data-tooltip]').forEach(el => {
    const tip = document.createElement('div');
    tip.className = 'lh-tooltip';
    tip.textContent = el.dataset.tooltip;
    tip.style.cssText = `
      position:absolute;background:var(--ink);color:var(--cream);
      padding:.35rem .75rem;border-radius:6px;font-size:.75rem;font-weight:500;
      white-space:nowrap;pointer-events:none;z-index:9999;
      opacity:0;transition:.15s;transform:translateY(4px);
    `;
    document.body.appendChild(tip);

    el.addEventListener('mouseenter', () => {
      const rect = el.getBoundingClientRect();
      tip.style.top  = (rect.bottom + window.scrollY + 6) + 'px';
      tip.style.left = (rect.left + rect.width / 2 - tip.offsetWidth / 2) + 'px';
      tip.style.opacity = '1';
      tip.style.transform = 'translateY(0)';
    });
    el.addEventListener('mouseleave', () => {
      tip.style.opacity = '0';
      tip.style.transform = 'translateY(4px)';
    });
  });
}

// ── Page-specific init functions ────────────────────────────────

async function initProfile() {
  const { Tabs } = await import('./tabs.js');
  new Tabs({
    tabSelector:   '[data-tab]',
    panelSelector: '[data-panel]',
    useHash:       true,
  });
}

function initEditProfile() {
  // Avatar upload preview
  const avatarInput = document.getElementById('avatarInput');
  const avatarPreview = document.getElementById('avatarPreview');
  avatarInput?.addEventListener('change', function() {
    if (!this.files[0]) return;
    const reader = new FileReader();
    reader.onload = e => { if (avatarPreview) avatarPreview.src = e.target.result; };
    reader.readAsDataURL(this.files[0]);
  });

  // Password match validation
  const newPass    = document.getElementById('newPassword');
  const confirmPass = document.getElementById('confirmPassword');
  const matchMsg   = document.getElementById('passwordMatchMsg');
  const check = () => {
    if (!newPass?.value || !confirmPass?.value) return;
    const match = newPass.value === confirmPass.value;
    confirmPass.classList.toggle('error', !match);
    if (matchMsg) { matchMsg.textContent = match ? '✓ Passwords match' : '✗ Passwords don\'t match'; matchMsg.style.color = match ? 'var(--success)' : 'var(--error)'; }
  };
  newPass?.addEventListener('input', check);
  confirmPass?.addEventListener('input', check);
}

async function initHome() {
  const { coursesApi, categoriesApi } = await import('./api.js');
  const { renderCourseGrid } = await import('./utils.js');

  // Hero search
  const heroSearch = document.getElementById('heroSearch');
  heroSearch?.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      window.location.href = `course-list.html?q=${encodeURIComponent(heroSearch.value.trim())}`;
    }
  });

  // Load trending courses from API
  try {
    const trending = await coursesApi.trending();
    renderCourseGrid('trendingGrid', trending?.slice(0, 4));
    const featured = await coursesApi.featured();
    renderCourseGrid('featuredGrid', featured?.slice(0, 4));
  } catch (_) { /* static HTML fallback */ }
}

function initCategoryList() {
  // Category card hover effects handled via CSS
  // Add click tracking
  document.querySelectorAll('.category-card').forEach(card => {
    card.addEventListener('click', () => {
      const slug = card.dataset.slug;
      if (slug) window.location.href = `course-list.html?cat=${slug}`;
    });
  });
}

function initInstructorDashboard() {
  // Date range filter on chart
  document.querySelectorAll('.date-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.date-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });
}

function initCourseAnalytics() {
  document.querySelectorAll('.date-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.date-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });
}

function initCart() {
  // Coupon code
  const applyBtn   = document.getElementById('applyBtn');
  const couponInput = document.getElementById('couponInput');
  applyBtn?.addEventListener('click', () => {
    const code = couponInput?.value?.trim()?.toUpperCase();
    const valid = ['LEARN20', 'LAUNCH10', 'AFRICA50'];
    const discounts = { LEARN20: 0.2, LAUNCH10: 0.1, AFRICA50: 0.5 };
    if (valid.includes(code)) {
      document.getElementById('couponSuccess')?.classList.add('show');
      document.getElementById('couponSavingsLine').style.display = 'flex';
    } else {
      couponInput.style.borderColor = 'var(--error)';
      setTimeout(() => couponInput.style.borderColor = '', 2000);
    }
  });
}

function initCheckout() {
  // Enable pay button only when terms checked
  const termsCheck = document.getElementById('termsCheck');
  const payBtn     = document.getElementById('payBtn');
  termsCheck?.addEventListener('change', () => {
    if (payBtn) payBtn.disabled = !termsCheck.checked;
  });

  // Card number formatting
  document.getElementById('cardNum')?.addEventListener('input', function() {
    const v = this.value.replace(/\D/g, '').substring(0, 16);
    this.value = v.replace(/(.{4})/g, '$1 ').trim();
  });
}

function initPaymentSuccess() {
  // Confetti
  const wrap = document.getElementById('confettiWrap');
  if (!wrap) return;
  const colors = ['#e8c547','#2d4a3e','#c4522a','#f5f0e8','#4a9eff'];
  for (let i = 0; i < 80; i++) {
    const el = document.createElement('div');
    const color = colors[Math.floor(Math.random() * colors.length)];
    const size  = Math.random() * 10 + 5;
    el.style.cssText = `
      position:absolute;top:-20px;left:${Math.random()*100}%;
      width:${size}px;height:${size}px;background:${color};
      border-radius:${Math.random()>.5?'50%':'2px'};
      animation:confettiFall ${Math.random()*2+1.5}s linear ${Math.random()*.8}s forwards;
    `;
    wrap.appendChild(el);
  }
  if (!document.getElementById('confetti-style')) {
    const s = document.createElement('style');
    s.id = 'confetti-style';
    s.textContent = `@keyframes confettiFall{to{transform:translateY(110vh) rotate(720deg);opacity:0}}`;
    document.head.appendChild(s);
  }
  setTimeout(() => wrap.remove(), 4000);
}

function initContact() {
  // FAQ accordion
  document.querySelectorAll('.faq-question').forEach(q => {
    q.addEventListener('click', () => q.parentElement.classList.toggle('open'));
  });

  // Form submission
  document.getElementById('submitContactBtn')?.addEventListener('click', () => {
    document.getElementById('contactForm').style.display = 'none';
    document.getElementById('successMsg')?.classList.add('show');
    document.getElementById('submitContactBtn').style.display = 'none';
  });
}

function initHelp() {
  // Search bar
  const input = document.querySelector('.help-search input');
  const btn   = document.querySelector('.help-search-btn');
  const search = () => {
    const q = input?.value?.trim();
    if (q) window.location.href = `course-list.html?q=${encodeURIComponent(q)}`;
  };
  btn?.addEventListener('click', search);
  input?.addEventListener('keydown', e => { if (e.key === 'Enter') search(); });
}

function initLegalPage() {
  // Sticky TOC scroll highlight
  const sections = document.querySelectorAll('.doc-section');
  const tocLinks = document.querySelectorAll('.toc-link');
  if (!sections.length || !tocLinks.length) return;

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        tocLinks.forEach(l => l.classList.remove('active'));
        const link = document.querySelector(`.toc-link[href="#${entry.target.id}"]`);
        link?.classList.add('active');
      }
    });
  }, { rootMargin: '-20% 0px -70% 0px' });

  sections.forEach(s => observer.observe(s));
}
