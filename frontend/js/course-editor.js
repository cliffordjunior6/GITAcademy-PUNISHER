/**
 * GITAcademy — course-editor.js
 * Handles the edit course page — section switching, auto-save, publish/unpublish
 */

import { instructorApi } from './api.js';
import { showToast, debounce, getParam } from './utils.js';
import { redirectIfNotLoggedIn } from './auth.js';

const courseId = getParam('id') || 1;
let hasUnsaved = false;

document.addEventListener('DOMContentLoaded', () => {
  redirectIfNotLoggedIn();
  initLeftNav();
  initSaveButton();
  initAutoSave();
  initStatusToggle();
  loadCourseData();
});

// ─── LEFT NAV ─────────────────────────────────────────────────
function initLeftNav() {
  document.querySelectorAll('.lnav-link[onclick]').forEach(link => {
    // onclick already defined in HTML — just track section shown
    const original = link.getAttribute('onclick');
    link.setAttribute('onclick', original);
  });
}

export function showSection(name) {
  document.querySelectorAll('[id^="section-"]').forEach(s => s.style.display = 'none');
  const target = document.getElementById('section-' + name);
  if (target) target.style.display = 'block';

  document.querySelectorAll('.lnav-link').forEach(l => l.classList.remove('active'));
  event?.target?.classList.add('active');
}
window.showSection = showSection;

// ─── SAVE ─────────────────────────────────────────────────────
function initSaveButton() {
  document.getElementById('saveBtn')?.addEventListener('click', saveCurrentSection);

  // Section-level save buttons
  document.querySelectorAll('.btn-primary-action').forEach(btn => {
    if (btn.textContent.includes('Save')) {
      btn.addEventListener('click', saveCurrentSection);
    }
  });
}

async function saveCurrentSection() {
  const data = collectFormData();
  try {
    await instructorApi.updateCourse(courseId, data);
    hasUnsaved = false;
    showSaveToast();
  } catch (err) {
    showToast(err.data?.message || 'Failed to save. Please try again.', 'error');
  }
}

function collectFormData() {
  const data = {};
  const visible = document.querySelector('[id^="section-"]:not([style*="none"])');
  if (!visible) return data;

  visible.querySelectorAll('.form-input').forEach(input => {
    if (input.id) data[input.id] = input.value;
  });
  return data;
}

function showSaveToast() {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2800);
}

// ─── AUTO-SAVE ────────────────────────────────────────────────
function initAutoSave() {
  const debouncedSave = debounce(() => {
    hasUnsaved = true;
    const saveBtn = document.getElementById('saveBtn');
    if (saveBtn) {
      saveBtn.textContent = 'Save Changes *';
      saveBtn.style.background = '#d97706';
    }
  }, 800);

  document.querySelectorAll('.form-input').forEach(input => {
    input.addEventListener('input', debouncedSave);
  });

  // Warn on unload
  window.addEventListener('beforeunload', (e) => {
    if (hasUnsaved) { e.preventDefault(); e.returnValue = ''; }
  });
}

// ─── STATUS TOGGLE ────────────────────────────────────────────
function initStatusToggle() {
  const statusBtn = document.querySelector('.btn-status');
  if (!statusBtn) return;

  statusBtn.addEventListener('click', async () => {
    const isPublished = statusBtn.textContent.includes('Published');
    try {
      await instructorApi.updateCourse(courseId, { status: isPublished ? 'draft' : 'published' });
      statusBtn.textContent = isPublished ? '● Draft' : '● Published';
      statusBtn.style.background = isPublished ? 'rgba(255,255,255,.06)' : 'rgba(45,74,62,.2)';
      statusBtn.style.color = isPublished ? 'rgba(245,240,232,.5)' : 'rgba(45,180,100,.85)';
      showToast(isPublished ? 'Course moved to Draft' : 'Course published ✓', 'success');
    } catch (err) {
      showToast('Failed to update status', 'error');
    }
  });
}

// ─── LOAD COURSE DATA ─────────────────────────────────────────
async function loadCourseData() {
  try {
    const courses = await instructorApi.courses();
    const course  = courses?.find(c => c.id == courseId) || courses?.[0];
    if (!course) return;

    // Populate nav title
    const navTitle = document.querySelector('.nav-course-name');
    if (navTitle) navTitle.textContent = course.title || 'Untitled Course';

    // Populate basic info fields
    const titleInput = document.getElementById('title');
    if (titleInput) titleInput.value = course.title || '';

    const descInput = document.querySelector('textarea.form-input');
    if (descInput) descInput.value = course.description || '';
  } catch (_) {
    // Use static HTML content
  }
}
