/**
 * GITAcademy — auth.js
 * Handles login, register, logout, session management
 * Connects to Laravel Sanctum / Passport backend
 */

import { authApi, setToken, clearToken } from './api.js';

// ─── Session helpers ───────────────────────────────────────────
export function getUser() {
  try {
    return JSON.parse(localStorage.getItem('lh_user')) || null;
  } catch {
    return null;
  }
}

export function setUser(user) {
  localStorage.setItem('lh_user', JSON.stringify(user));
}

export function isLoggedIn() {
  return !!localStorage.getItem('lh_token');
}

export function isInstructor() {
  const user = getUser();
  return user?.role === 'instructor' || user?.role === 'admin';
}

export function isAdmin() {
  const user = getUser();
  return user?.role === 'admin';
}

export function redirectIfNotLoggedIn(redirectTo = 'login.html') {
  if (!isLoggedIn()) {
    window.location.href = redirectTo;
  }
}

export function redirectIfLoggedIn(redirectTo = 'dashboard.html') {
  if (isLoggedIn()) {
    window.location.href = redirectTo;
  }
}

// ─── LOGIN ─────────────────────────────────────────────────────
export async function login(email, password, rememberMe = false) {
  const data = await authApi.login(email, password);
  if (data.token) {
    setToken(data.token);
    setUser(data.user);
    return data.user;
  }
  throw new Error('Login failed — no token returned');
}

// ─── REGISTER ─────────────────────────────────────────────────
export async function register({ firstName, lastName, email, password }) {
  const data = await authApi.register({ first_name: firstName, last_name: lastName, email, password });
  if (data.token) {
    setToken(data.token);
    setUser(data.user);
    return data.user;
  }
  throw new Error('Registration failed');
}

// ─── LOGOUT ───────────────────────────────────────────────────
export async function logout() {
  try {
    await authApi.logout();
  } catch (_) {
    // Logout even if server call fails
  } finally {
    clearToken();
    window.location.href = 'login.html';
  }
}

// ─── FORGOT PASSWORD ───────────────────────────────────────────
export async function forgotPassword(email) {
  return authApi.forgotPassword(email);
}

// ─── RESET PASSWORD ────────────────────────────────────────────
export async function resetPassword(token, email, password, passwordConfirmation) {
  return authApi.resetPassword({
    token,
    email,
    password,
    password_confirmation: passwordConfirmation,
  });
}

// ─── REFRESH USER ─────────────────────────────────────────────
export async function refreshUser() {
  const user = await authApi.me();
  setUser(user);
  return user;
}

// ─── UI HELPERS ───────────────────────────────────────────────
export function initAuthForms() {

  // Login form
  const loginForm = document.getElementById('loginForm');
  const loginBtn  = document.getElementById('loginBtn');
  const loginErr  = document.getElementById('loginError');
  if (loginBtn) {
    loginBtn.addEventListener('click', async () => {
      const email    = document.getElementById('email')?.value?.trim();
      const password = document.getElementById('password')?.value;
      if (!email || !password) {
        showError(loginErr, 'Please enter your email and password.');
        return;
      }
      setBtnLoading(loginBtn, true, 'Logging in…');
      try {
        await login(email, password);
        window.location.href = 'dashboard.html';
      } catch (err) {
        showError(loginErr, err.data?.message || 'Invalid credentials. Please try again.');
        setBtnLoading(loginBtn, false, 'Log in to GITAcademy');
      }
    });
  }

  // Register form
  const registerBtn = document.getElementById('registerBtn');
  const registerErr = document.getElementById('registerError');
  if (registerBtn) {
    registerBtn.addEventListener('click', async () => {
      const firstName = document.getElementById('firstName')?.value?.trim();
      const lastName  = document.getElementById('lastName')?.value?.trim();
      const email     = document.getElementById('email')?.value?.trim();
      const password  = document.getElementById('password')?.value;
      const confirm   = document.getElementById('confirmPassword')?.value;
      const terms     = document.getElementById('terms')?.checked;

      if (!firstName || !lastName || !email || !password) {
        showError(registerErr, 'Please fill in all required fields.');
        return;
      }
      if (password !== confirm) {
        showError(registerErr, 'Passwords do not match.');
        return;
      }
      if (!terms) {
        showError(registerErr, 'You must agree to the Terms of Service.');
        return;
      }

      setBtnLoading(registerBtn, true, 'Creating your account…');
      try {
        await register({ firstName, lastName, email, password });
        window.location.href = 'dashboard.html';
      } catch (err) {
        const msg = err.data?.errors?.email?.[0] || err.data?.message || 'Registration failed. Please try again.';
        showError(registerErr, msg);
        setBtnLoading(registerBtn, false, 'Create my free account');
      }
    });
  }

  // Forgot password form
  const forgotBtn = document.getElementById('forgotBtn');
  if (forgotBtn) {
    forgotBtn.addEventListener('click', async () => {
      const email = document.getElementById('email')?.value?.trim();
      if (!email) return;
      setBtnLoading(forgotBtn, true, 'Sending…');
      try {
        await forgotPassword(email);
        document.getElementById('formState')?.classList.add('hide');
        document.getElementById('successState')?.classList.add('show');
        document.getElementById('successEmail').textContent = email;
      } catch (err) {
        setBtnLoading(forgotBtn, false, 'Send Reset Link');
      }
    });
  }

  // Logout buttons
  document.querySelectorAll('[data-logout]').forEach(btn => {
    btn.addEventListener('click', (e) => { e.preventDefault(); logout(); });
  });
}

// ─── DOM helpers ──────────────────────────────────────────────
function showError(el, msg) {
  if (!el) return;
  el.textContent = msg;
  el.style.display = 'block';
  setTimeout(() => { el.style.display = 'none'; }, 5000);
}

function setBtnLoading(btn, loading, label) {
  btn.disabled = loading;
  btn.textContent = label;
  btn.style.opacity = loading ? '0.7' : '1';
}

// ─── Populate nav with user info ──────────────────────────────
export function populateNav() {
  const user = getUser();
  if (!user) return;

  const nameEl = document.querySelector('.nav-user-name');
  const avatarEl = document.querySelector('.avatar');

  if (nameEl) nameEl.textContent = user.first_name || user.name || 'You';
  if (avatarEl) {
    const initials = ((user.first_name?.[0] || '') + (user.last_name?.[0] || '')).toUpperCase() || 'U';
    avatarEl.textContent = initials;
  }
}

// ─── Auto-init on DOM ready ───────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initAuthForms();
  populateNav();
});
