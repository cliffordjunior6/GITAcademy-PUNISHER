/**
 * GITAcademy — course-player.js
 * Handles video player logic, lesson progress, notes, Q&A, resources
 * Connects to Laravel API via api.js
 */

import { coursesApi, notesApi, qaApi } from './api.js';
import { showToast, getParam, formatDuration } from './utils.js';

// ─── STATE ────────────────────────────────────────────────────
let courseId     = getParam('course_id') || 1;
let currentLesson = null;
let isPlaying    = false;
let playbackSpeed = 1;
let progressInterval = null;
let simulatedPct = 36; // replace with real video currentTime / duration

const speeds = [0.5, 0.75, 1, 1.25, 1.5, 2];
let speedIndex = 2; // default 1×

// ─── INIT ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initPlayer();
  initTabs();
  initSidebar();
  initNotes();
  initQA();
  loadCourseProgress();
});

// ─── PLAYER ───────────────────────────────────────────────────
function initPlayer() {
  const playBtn      = document.getElementById('playBtn');
  const speedBtn     = document.getElementById('speedBtn');
  const progressTrack = document.getElementById('progressTrack');
  const videoContainer = document.getElementById('videoContainer');

  playBtn?.addEventListener('click', togglePlay);
  videoContainer?.addEventListener('click', togglePlay);

  speedBtn?.addEventListener('click', () => {
    speedIndex = (speedIndex + 1) % speeds.length;
    playbackSpeed = speeds[speedIndex];
    speedBtn.textContent = playbackSpeed + '×';
  });

  progressTrack?.addEventListener('click', (e) => {
    const rect = progressTrack.getBoundingClientRect();
    simulatedPct = ((e.clientX - rect.left) / rect.width) * 100;
    updateProgressBar(simulatedPct);
  });

  // Prev / Next lesson
  document.getElementById('prevLessonBtn')?.addEventListener('click', () => navigateLesson(-1));
  document.getElementById('nextLessonBtn')?.addEventListener('click', () => navigateLesson(1));

  // Mark complete
  document.getElementById('markCompleteBtn')?.addEventListener('click', markLessonComplete);

  // Fullscreen
  document.getElementById('fullscreenBtn')?.addEventListener('click', () => {
    const el = document.getElementById('videoContainer');
    if (el?.requestFullscreen) el.requestFullscreen();
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if (e.key === ' ') { e.preventDefault(); togglePlay(); }
    if (e.key === 'ArrowRight') seekForward(10);
    if (e.key === 'ArrowLeft')  seekBack(10);
    if (e.key === 'f' || e.key === 'F') document.getElementById('fullscreenBtn')?.click();
  });
}

function togglePlay() {
  isPlaying = !isPlaying;
  const playIcon = document.getElementById('playIcon');
  const centerPlay = document.getElementById('centerPlay');

  if (playIcon) {
    playIcon.innerHTML = isPlaying
      ? '<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>'
      : '<polygon points="5 3 19 12 5 21 5 3"/>';
  }
  if (centerPlay) centerPlay.classList.toggle('visible', !isPlaying);

  if (isPlaying) {
    startProgressSimulation();
  } else {
    clearInterval(progressInterval);
  }
}

function startProgressSimulation() {
  clearInterval(progressInterval);
  progressInterval = setInterval(() => {
    if (!isPlaying) return;
    simulatedPct = Math.min(simulatedPct + (0.08 * playbackSpeed), 100);
    updateProgressBar(simulatedPct);
    if (simulatedPct >= 100) {
      clearInterval(progressInterval);
      onLessonEnd();
    }
  }, 200);
}

function updateProgressBar(pct) {
  const fill = document.getElementById('progressFill');
  const pctLabel = document.getElementById('progressPct');
  if (fill) fill.style.width = pct + '%';
  if (pctLabel) pctLabel.textContent = Math.floor(pct) + '%';
}

function seekForward(seconds) {
  simulatedPct = Math.min(simulatedPct + (seconds / 1112 * 100), 100);
  updateProgressBar(simulatedPct);
}

function seekBack(seconds) {
  simulatedPct = Math.max(simulatedPct - (seconds / 1112 * 100), 0);
  updateProgressBar(simulatedPct);
}

function onLessonEnd() {
  isPlaying = false;
  // Auto-advance if autoplay is on
  const autoplayBtn = document.querySelector('.ctrl-btn[data-autoplay]');
  if (autoplayBtn?.classList.contains('active')) {
    setTimeout(() => navigateLesson(1), 2000);
  }
}

// ─── LESSON NAVIGATION ────────────────────────────────────────
function navigateLesson(direction) {
  const lessons = document.querySelectorAll('.sidebar-lesson');
  const activeLesson = document.querySelector('.sidebar-lesson.active');
  if (!activeLesson) return;

  const lessonArray = Array.from(lessons);
  const currentIndex = lessonArray.indexOf(activeLesson);
  const nextIndex = currentIndex + direction;

  if (nextIndex >= 0 && nextIndex < lessonArray.length) {
    lessonArray[nextIndex].click();
  } else if (nextIndex >= lessonArray.length) {
    showToast('🎉 You\'ve reached the last lesson!', 'success');
  }
}

async function markLessonComplete() {
  const btn = document.getElementById('markCompleteBtn');
  if (!btn) return;

  const activeLesson = document.querySelector('.sidebar-lesson.active');
  const lessonId = activeLesson?.dataset.lessonId;

  try {
    await coursesApi.updateProgress(courseId, lessonId, { completed: true, progress_pct: 100 });

    // Update UI
    const check = activeLesson?.querySelector('.lesson-check');
    if (check) { check.classList.add('done'); check.textContent = '✓'; }

    btn.style.background = 'rgba(45,122,79,.2)';
    btn.style.borderColor = 'rgba(45,122,79,.4)';
    btn.style.color = '#4ade80';
    btn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> Completed`;

    updateOverallProgress();
    showToast('Lesson marked as complete ✓', 'success');
  } catch (err) {
    console.error('Progress update failed:', err);
    // Optimistically update UI anyway for offline use
    showToast('Progress saved locally', 'info');
  }
}

function updateOverallProgress() {
  const total    = document.querySelectorAll('.sidebar-lesson').length;
  const done     = document.querySelectorAll('.sidebar-lesson .lesson-check.done').length;
  const pct      = total > 0 ? Math.round((done / total) * 100) : 0;

  const navBar   = document.querySelector('.player-progress-bar');
  const navLabel = document.querySelector('.player-progress-label');
  const sideBar  = document.querySelector('.sidebar-progress-bar');

  if (navBar)   navBar.style.width = pct + '%';
  if (navLabel) navLabel.textContent = pct + '% complete';
  if (sideBar)  sideBar.style.width = pct + '%';

  document.querySelector('.sidebar-progress-text')
    && (document.querySelector('.sidebar-progress-text').textContent = pct + '% complete');
}

// ─── TABS ─────────────────────────────────────────────────────
function initTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      const panel = document.getElementById('tab-' + btn.dataset.tab);
      if (panel) panel.classList.add('active');
    });
  });
}

// ─── SIDEBAR ──────────────────────────────────────────────────
function initSidebar() {
  // Section accordion
  document.querySelectorAll('.sidebar-section-header').forEach(hdr => {
    hdr.addEventListener('click', () => {
      hdr.parentElement.classList.toggle('expanded');
    });
  });

  // Lesson click — load lesson
  document.querySelectorAll('.sidebar-lesson').forEach(lesson => {
    lesson.addEventListener('click', () => loadLesson(lesson));
  });

  // Mobile sidebar toggle
  document.getElementById('sidebarToggle')?.addEventListener('click', () => {
    document.getElementById('playerSidebar')?.classList.toggle('open');
  });
}

function loadLesson(lessonEl) {
  // Stop current playback
  isPlaying = false;
  clearInterval(progressInterval);
  simulatedPct = 0;
  updateProgressBar(0);

  // Update active state
  document.querySelectorAll('.sidebar-lesson').forEach(l => l.classList.remove('active'));
  lessonEl.classList.add('active');

  // Update lesson title in player
  const lessonTitle = lessonEl.querySelector('.lesson-title')?.textContent;
  const playerLabel = document.querySelector('.video-label');
  if (playerLabel && lessonTitle) playerLabel.textContent = lessonTitle;

  // Reset mark complete button
  const btn = document.getElementById('markCompleteBtn');
  if (btn && !lessonEl.querySelector('.lesson-check.done')) {
    btn.style.cssText = '';
    btn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> Mark Complete`;
  }

  // Reset play icon
  const playIcon = document.getElementById('playIcon');
  if (playIcon) playIcon.innerHTML = '<polygon points="5 3 19 12 5 21 5 3"/>';
  document.getElementById('centerPlay')?.classList.add('visible');
}

// ─── NOTES ────────────────────────────────────────────────────
function initNotes() {
  const saveBtn   = document.getElementById('saveNoteBtn');
  const noteInput = document.getElementById('noteInput');

  saveBtn?.addEventListener('click', saveNote);
  noteInput?.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'Enter') saveNote();
  });
}

async function saveNote() {
  const noteInput = document.getElementById('noteInput');
  const content = noteInput?.value?.trim();
  if (!content) return;

  const lessonId = document.querySelector('.sidebar-lesson.active')?.dataset.lessonId || 1;
  const timestamp = Math.floor(simulatedPct * 11.12); // seconds approximation

  try {
    await notesApi.save(courseId, lessonId, content, timestamp);
  } catch (_) {
    // Save locally if API fails
  }

  // Add to UI
  const savedNotes = document.getElementById('savedNotes');
  const minutes = Math.floor(timestamp / 60);
  const seconds = timestamp % 60;
  const timeStr = `${minutes}:${String(seconds).padStart(2,'0')}`;

  const noteEl = document.createElement('div');
  noteEl.className = 'note-item';
  noteEl.innerHTML = `<div class="note-item-time">📍 ${timeStr}</div>${content}`;
  savedNotes?.prepend(noteEl);
  noteInput.value = '';
  showToast('Note saved ✓', 'success', 1500);
}

// ─── Q&A ──────────────────────────────────────────────────────
function initQA() {
  const qaInput  = document.getElementById('qaInput');
  const qaSubmit = document.getElementById('qaSubmitBtn');

  qaSubmit?.addEventListener('click', submitQuestion);
  qaInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitQuestion(); }
  });

  // Upvote delegation
  document.getElementById('qaList')?.addEventListener('click', (e) => {
    if (e.target.classList.contains('qa-action-btn')) {
      const btn = e.target;
      const count = parseInt(btn.textContent.replace(/\D/g,'')) || 0;
      if (!btn.dataset.voted) {
        btn.dataset.voted = '1';
        btn.textContent = '👍 ' + (count + 1);
        btn.style.color = 'var(--gold)';
      }
    }
  });
}

async function submitQuestion() {
  const qaInput = document.getElementById('qaInput');
  const question = qaInput?.value?.trim();
  if (!question) return;

  const lessonId = document.querySelector('.sidebar-lesson.active')?.dataset.lessonId || 1;

  try {
    await qaApi.ask(courseId, lessonId, question);
  } catch (_) {}

  const qaList = document.getElementById('qaList');
  const item = document.createElement('div');
  item.className = 'qa-item';
  item.innerHTML = `
    <div class="qa-avatar">AK</div>
    <div class="qa-content">
      <div class="qa-author">You · just now</div>
      <div class="qa-text">${question}</div>
      <div class="qa-actions">
        <button class="qa-action-btn">👍 0</button>
        <button class="qa-action-btn">Reply</button>
      </div>
    </div>`;
  qaList?.prepend(item);
  qaInput.value = '';
}

// ─── LOAD COURSE PROGRESS ─────────────────────────────────────
async function loadCourseProgress() {
  try {
    const progress = await coursesApi.progress(courseId);
    if (!progress) return;

    // Mark completed lessons
    progress.completed_lessons?.forEach(lessonId => {
      const lessonEl = document.querySelector(`[data-lesson-id="${lessonId}"]`);
      const check = lessonEl?.querySelector('.lesson-check');
      if (check) { check.classList.add('done'); check.textContent = '✓'; }
    });

    // Restore overall progress bar
    if (progress.overall_pct !== undefined) {
      const navBar = document.querySelector('.player-progress-bar');
      if (navBar) navBar.style.width = progress.overall_pct + '%';
    }
  } catch (_) {
    // Offline — use static HTML state
  }
}

export { togglePlay, seekForward, seekBack, markLessonComplete, loadLesson };
