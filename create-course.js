/**
 * GITAcademy — create-course.js
 * Handles multi-step course creation wizard
 */

import { instructorApi } from './api.js';
import { showToast, slugify, debounce } from './utils.js';
import { redirectIfNotLoggedIn, isInstructor } from './auth.js';

let currentStep = 1;
let courseData  = {};
const TOTAL_STEPS = 5;

document.addEventListener('DOMContentLoaded', () => {
  redirectIfNotLoggedIn();
  initSteps();
  initObjectives();
  initCurriculumBuilder();
  initThumbnailUpload();
  initPricingCards();
  initAutoSave();
  loadDraft();
});

// ─── STEP NAVIGATION ──────────────────────────────────────────
function initSteps() {
  document.querySelectorAll('.step-item').forEach(item => {
    item.addEventListener('click', () => {
      const step = parseInt(item.dataset.step);
      if (step < currentStep) goToStep(step); // can go back freely
    });
  });
}

export function goToStep(step) {
  if (step < 1 || step > TOTAL_STEPS) return;

  // Validate current step before advancing
  if (step > currentStep && !validateStep(currentStep)) return;

  // Collect data from current step
  collectStepData(currentStep);

  document.querySelectorAll('.step-panel').forEach(p => p.classList.remove('active'));
  const panel = document.getElementById('panel-' + step);
  if (panel) panel.classList.add('active');

  // Update stepper indicators
  document.querySelectorAll('.step-item').forEach((item, i) => {
    item.classList.remove('active', 'done');
    const num = item.querySelector('.step-num');
    if (i + 1 < step) { item.classList.add('done'); if (num) num.textContent = '✓'; }
    else if (i + 1 === step) { item.classList.add('active'); if (num) num.textContent = i + 1; }
    else { if (num) num.textContent = i + 1; }
  });

  // Update progress bar
  const pct = ((step - 1) / (TOTAL_STEPS - 1)) * 100;
  const bar = document.getElementById('progressFill');
  if (bar) bar.style.width = pct + '%';

  currentStep = step;
  window.scrollTo({ top: 0, behavior: 'smooth' });
  saveDraft();
}

function validateStep(step) {
  if (step === 1) {
    const title = document.getElementById('courseTitleInput')?.value?.trim();
    if (!title || title.length < 10) {
      showToast('Please enter a course title (min 10 characters)', 'error');
      document.getElementById('courseTitleInput')?.focus();
      return false;
    }
  }
  return true;
}

function collectStepData(step) {
  if (step === 1) {
    courseData.title       = document.getElementById('courseTitleInput')?.value?.trim();
    courseData.subtitle    = document.querySelector('[placeholder*="attention-grabbing"]')?.value?.trim();
    courseData.description = document.querySelector('textarea')?.value?.trim();
    courseData.slug        = slugify(courseData.title || '');
  }
  if (step === 4) {
    const selected = document.querySelector('.pricing-card.selected .pricing-card-title')?.textContent;
    courseData.pricing_type = selected?.toLowerCase() || 'paid';
    courseData.price          = document.querySelector('[placeholder="e.g. 49"]')?.value;
    courseData.original_price = document.querySelector('[placeholder="e.g. 129"]')?.value;
  }
}

// ─── OBJECTIVES ───────────────────────────────────────────────
function initObjectives() {
  const list    = document.getElementById('objectivesList');
  const addBtn  = document.getElementById('addObjectiveBtn');
  if (!list || !addBtn) return;

  addBtn.addEventListener('click', () => {
    const item = document.createElement('div');
    item.className = 'objective-item';
    item.innerHTML = '<input class="objective-input" type="text" placeholder="Another learning outcome…"/><button class="btn-remove-obj">×</button>';
    list.appendChild(item);
    item.querySelector('input')?.focus();
  });

  list.addEventListener('click', e => {
    if (e.target.classList.contains('btn-remove-obj')) {
      if (list.querySelectorAll('.objective-item').length > 1) {
        e.target.closest('.objective-item').remove();
      } else {
        showToast('Minimum 1 learning objective required', 'error');
      }
    }
  });
}

// ─── CURRICULUM BUILDER ───────────────────────────────────────
function initCurriculumBuilder() {
  const builder = document.getElementById('curriculumBuilder');
  const addSectionBtn = document.getElementById('addSectionBtn');
  if (!builder || !addSectionBtn) return;

  addSectionBtn.addEventListener('click', () => {
    const sectionCount = builder.querySelectorAll('.section-block').length + 1;
    const block = createSectionBlock(sectionCount);
    builder.insertBefore(block, addSectionBtn);
    block.querySelector('.section-input')?.focus();
  });

  // Delegation for add lesson / delete section
  builder.addEventListener('click', e => {
    if (e.target.closest('.btn-section-action:not([style*="error"])') ||
        e.target.closest('[title="Add Lesson"]')) {
      const section = e.target.closest('.section-block');
      const lessonRow = createLessonRow();
      section?.querySelector('.section-lessons')?.insertBefore(
        lessonRow,
        section.querySelector('.btn-add-lesson')
      );
      lessonRow.querySelector('.lesson-title-input')?.focus();
    }

    if (e.target.classList.contains('btn-add-lesson') || e.target.closest('.btn-add-lesson')) {
      const section = e.target.closest('.section-block');
      const lessonRow = createLessonRow();
      const addBtn = section?.querySelector('.btn-add-lesson');
      section?.querySelector('.section-lessons')?.insertBefore(lessonRow, addBtn);
      lessonRow.querySelector('.lesson-title-input')?.focus();
    }

    if (e.target.classList.contains('btn-remove-lesson') || e.target.closest('.btn-remove-lesson')) {
      e.target.closest('.lesson-row')?.remove();
    }
  });
}

function createSectionBlock(num) {
  const div = document.createElement('div');
  div.className = 'section-block';
  div.innerHTML = `
    <div class="section-block-header">
      <span class="section-block-handle">⠿</span>
      <input class="section-input" type="text" placeholder="Section title…" value="Section ${num}: New Section"/>
      <button class="btn-section-action" title="Add Lesson">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        Add Lesson
      </button>
      <button class="btn-section-action" style="color:var(--error)">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg>
      </button>
    </div>
    <div class="section-lessons">
      <button class="btn-add-lesson">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        Add lesson
      </button>
    </div>`;
  return div;
}

function createLessonRow() {
  const div = document.createElement('div');
  div.className = 'lesson-row';
  div.innerHTML = `
    <span class="lesson-handle">⠿</span>
    <select class="lesson-type-select"><option>▶ Video</option><option>📝 Quiz</option><option>📄 Article</option></select>
    <input class="lesson-title-input" type="text" placeholder="Lesson title…"/>
    <span class="lesson-duration">—</span>
    <button class="btn-remove-lesson">×</button>`;
  return div;
}

// ─── THUMBNAIL ────────────────────────────────────────────────
function initThumbnailUpload() {
  const input = document.getElementById('thumbInput');
  if (!input) return;

  input.addEventListener('change', function() {
    if (!this.files[0]) return;
    const reader = new FileReader();
    reader.onload = e => {
      const uploader = document.querySelector('.thumb-uploader');
      if (uploader) {
        uploader.style.cssText += `background-image:url(${e.target.result});background-size:cover;background-position:center;`;
        uploader.querySelector('.thumb-uploader-icon').style.display = 'none';
        uploader.querySelector('.thumb-uploader-title').textContent = 'Thumbnail uploaded ✓';
      }
    };
    reader.readAsDataURL(this.files[0]);
  });
}

// ─── PRICING CARDS ────────────────────────────────────────────
function initPricingCards() {
  document.querySelectorAll('.pricing-card').forEach(card => {
    card.addEventListener('click', () => {
      document.querySelectorAll('.pricing-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      const isFree = card.querySelector('.pricing-card-title')?.textContent?.toLowerCase() === 'free';
      const priceFields = document.getElementById('priceFields');
      if (priceFields) priceFields.style.display = isFree ? 'none' : 'grid';
    });
  });
}

// ─── DRAFT AUTO-SAVE ──────────────────────────────────────────
function initAutoSave() {
  const inputs = document.querySelectorAll('.form-input, .objective-input, .section-input, .lesson-title-input');
  const debouncedSave = debounce(saveDraft, 1500);
  inputs.forEach(input => input.addEventListener('input', debouncedSave));
}

function saveDraft() {
  collectStepData(currentStep);
  try {
    localStorage.setItem('lh_course_draft', JSON.stringify({ ...courseData, step: currentStep, savedAt: new Date().toISOString() }));
    const saveBtn = document.getElementById('saveDraftBtn');
    if (saveBtn) {
      const orig = saveBtn.textContent;
      saveBtn.textContent = 'Saved ✓';
      saveBtn.style.color = 'var(--gold)';
      setTimeout(() => { saveBtn.textContent = orig; saveBtn.style.color = ''; }, 2000);
    }
  } catch (_) {}
}

function loadDraft() {
  try {
    const draft = JSON.parse(localStorage.getItem('lh_course_draft'));
    if (!draft) return;
    if (draft.title) document.getElementById('courseTitleInput').value = draft.title;
    if (draft.step && draft.step > 1) {
      // Optional: resume at saved step
    }
  } catch (_) {}
}

// ─── PUBLISH ──────────────────────────────────────────────────
export async function publishCourse() {
  collectStepData(currentStep);
  try {
    const result = await instructorApi.createCourse(courseData);
    localStorage.removeItem('lh_course_draft');
    showToast('Course submitted for review! 🎉', 'success');
    setTimeout(() => window.location.href = 'instructor-dashboard.html', 1500);
  } catch (err) {
    showToast(err.data?.message || 'Publish failed. Please try again.', 'error');
  }
}

window.goToStep     = goToStep;
window.publishCourse = publishCourse;
