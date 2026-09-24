/**
 * GITAcademy — navbar.js
 * Handles sticky navbar, mobile hamburger, search bar, user dropdown
 */

import { searchApi } from './api.js';
import { debounce, showToast } from './utils.js';
import { isLoggedIn, getUser, logout } from './auth.js';

document.addEventListener('DOMContentLoaded', initNavbar);

export function initNavbar() {
  initMobileMenu();
  initUserDropdown();
  initSearch();
  initStickyBehaviour();
  updateNavForAuthState();
  initLogoutButtons();
}

// ─── MOBILE MENU ──────────────────────────────────────────────
function initMobileMenu() {
  const hamburgerBtn = document.getElementById('hamburgerBtn');
  const mobileMenu   = document.getElementById('mobileMenu');
  const mobileNav    = document.getElementById('mobileNav');
  const overlay      = document.getElementById('sidebarOverlay');
  const target       = mobileMenu || mobileNav;

  if (!hamburgerBtn || !target) return;

  hamburgerBtn.addEventListener('click', () => {
    const isOpen = target.classList.toggle('open');
    hamburgerBtn.setAttribute('aria-expanded', isOpen);
    if (overlay) overlay.classList.toggle('open', isOpen);

    // Animate hamburger to X
    const spans = hamburgerBtn.querySelectorAll('span');
    if (isOpen) {
      spans[0]?.style.setProperty('transform', 'rotate(45deg) translate(5px, 5px)');
      spans[1]?.style.setProperty('opacity', '0');
      spans[2]?.style.setProperty('transform', 'rotate(-45deg) translate(5px, -5px)');
    } else {
      spans.forEach(s => { s.style.transform = ''; s.style.opacity = ''; });
    }
  });

  overlay?.addEventListener('click', () => {
    target.classList.remove('open');
    overlay.classList.remove('open');
    hamburgerBtn.setAttribute('aria-expanded', 'false');
    hamburgerBtn.querySelectorAll('span').forEach(s => { s.style.transform = ''; s.style.opacity = ''; });
  });

  // Close on nav link click (mobile)
  target.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      target.classList.remove('open');
      overlay?.classList.remove('open');
    });
  });
}

// ─── USER DROPDOWN ────────────────────────────────────────────
function initUserDropdown() {
  const btn      = document.getElementById('userMenuBtn') || document.querySelector('.nav-user');
  const dropdown = document.getElementById('userDropdown');
  if (!btn || !dropdown) return;

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    dropdown.classList.toggle('open');
    btn.setAttribute('aria-expanded', dropdown.classList.contains('open'));
  });

  document.addEventListener('click', (e) => {
    if (!dropdown.contains(e.target) && !btn.contains(e.target)) {
      dropdown.classList.remove('open');
      btn.setAttribute('aria-expanded', 'false');
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      dropdown.classList.remove('open');
      btn.setAttribute('aria-expanded', 'false');
    }
  });
}

// ─── SEARCH ───────────────────────────────────────────────────
function initSearch() {
  const inputs = document.querySelectorAll('.nav-search input, #heroSearch');

  inputs.forEach(input => {
    const debouncedSearch = debounce(async (q) => {
      if (q.length < 2) { closeSearchResults(input); return; }
      try {
        const results = await searchApi.global(q);
        showSearchResults(input, results);
      } catch (_) {}
    }, 350);

    input.addEventListener('input', (e) => debouncedSearch(e.target.value.trim()));

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const q = input.value.trim();
        if (q) window.location.href = `course-list.html?q=${encodeURIComponent(q)}`;
      }
      if (e.key === 'Escape') closeSearchResults(input);
    });

    // Close on click outside
    document.addEventListener('click', (e) => {
      if (!input.closest('.nav-search')?.contains(e.target)) closeSearchResults(input);
    });
  });
}

function showSearchResults(input, results) {
  closeSearchResults(input); // remove existing

  const wrap = input.closest('.nav-search') || input.parentElement;
  const dropdown = document.createElement('div');
  dropdown.id = 'searchDropdown';
  dropdown.style.cssText = `
    position:absolute;top:calc(100% + 6px);left:0;right:0;
    background:white;border:1px solid rgba(13,13,15,.08);border-radius:12px;
    box-shadow:0 12px 40px rgba(13,13,15,.14);z-index:9999;overflow:hidden;max-height:340px;overflow-y:auto;
  `;

  const courses = results?.courses?.slice(0, 5) || [];
  if (!courses.length) {
    dropdown.innerHTML = `<div style="padding:1rem 1.25rem;font-size:.85rem;color:rgba(13,13,15,.4)">No results for "${input.value}"</div>`;
  } else {
    dropdown.innerHTML = courses.map(c => `
      <a href="course-details.html?id=${c.id}" style="display:flex;align-items:center;gap:.75rem;padding:.75rem 1.25rem;transition:.15s;text-decoration:none;color:inherit;" onmouseover="this.style.background='#f0ece4'" onmouseout="this.style.background=''">
        <span style="font-size:1.4rem">${c.emoji || '📚'}</span>
        <div>
          <div style="font-size:.875rem;font-weight:600;margin-bottom:.1rem">${c.title}</div>
          <div style="font-size:.72rem;color:rgba(13,13,15,.4)">${c.category} · ${c.instructor?.name || ''}</div>
        </div>
        <div style="margin-left:auto;font-size:.85rem;font-weight:700">${c.price === 0 ? 'Free' : '$' + c.price}</div>
      </a>`).join('') +
      `<a href="course-list.html?q=${encodeURIComponent(input.value)}" style="display:block;padding:.75rem 1.25rem;font-size:.82rem;font-weight:600;color:var(--rust, #c4522a);border-top:1px solid rgba(13,13,15,.06);text-decoration:none;">See all results →</a>`;
  }

  wrap.style.position = 'relative';
  wrap.appendChild(dropdown);
}

function closeSearchResults(input) {
  const wrap = input.closest('.nav-search') || input.parentElement;
  wrap?.querySelector('#searchDropdown')?.remove();
}

// ─── STICKY BEHAVIOUR ─────────────────────────────────────────
function initStickyBehaviour() {
  const navbar = document.querySelector('.navbar');
  if (!navbar) return;

  let lastScroll = 0;
  window.addEventListener('scroll', () => {
    const current = window.scrollY;
    // Add shadow when scrolled
    navbar.style.boxShadow = current > 10 ? '0 2px 20px rgba(13,13,15,.12)' : '';
    lastScroll = current;
  }, { passive: true });
}

// ─── AUTH STATE ───────────────────────────────────────────────
function updateNavForAuthState() {
  const loggedIn = isLoggedIn();
  const user     = getUser();

  // Show/hide auth buttons vs user menu
  const authBtns = document.querySelectorAll('[data-show-guest]');
  const userMenu = document.querySelectorAll('[data-show-auth]');

  authBtns.forEach(el => el.style.display = loggedIn ? 'none' : '');
  userMenu.forEach(el => el.style.display = loggedIn ? '' : 'none');

  if (loggedIn && user) {
    const nameEl    = document.querySelector('.nav-user-name');
    const avatarEl  = document.querySelector('.nav-user .avatar, .avatar-sm');
    const initials  = ((user.first_name?.[0] || '') + (user.last_name?.[0] || '')).toUpperCase() || 'U';

    if (nameEl)   nameEl.textContent   = user.first_name || user.name || 'You';
    if (avatarEl) avatarEl.textContent = initials;
  }
}

// ─── LOGOUT BUTTONS ───────────────────────────────────────────
function initLogoutButtons() {
  document.querySelectorAll('[data-logout], a[href="login.html"].danger, .dropdown-item.danger').forEach(btn => {
    btn.addEventListener('click', (e) => {
      if (btn.href?.includes('login.html') || btn.dataset.logout !== undefined) {
        e.preventDefault();
        logout();
      }
    });
  });
}
