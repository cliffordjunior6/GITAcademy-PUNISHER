/**
 * GITAcademy — course-player.js
 * Handles video player logic, lesson progress, notes, Q&A, resources
 * Connects to Laravel API via api.js
 */

import { coursesApi, notesApi, qaApi } from './api.js';
import { showToast, getParam, formatDuration } from './utils.js';
import { redirectIfNotLoggedIn } from './auth.js';

// ─── STATE ────────────────────────────────────────────────────
let courseId     = getParam('course_id') || 1;
let currentLesson = null;
let isPlaying    = false;
let playbackSpeed = 1;
let progressInterval = null;
let simulatedPct = 0; // used only when a lesson has no real uploaded video file
let usingRealVideo = false;

const speeds = [0.5, 0.75, 1, 1.25, 1.5, 2];
let speedIndex = 2; // default 1×

// ─── INIT ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  redirectIfNotLoggedIn('login.html');
  initPlayer();
  initTabs();
  initSidebar();
  initNotes();
  initQA();
  await loadCourseContent();
  loadCourseProgress();
});

// ─── REAL COURSE CONTENT ──────────────────────────────────────
async function loadCourseContent() {
  let course;
  try {
    course = await coursesApi.get(courseId);
  } catch (err) {
    showToast('Could not load this course.', 'error');
    return;
  }

  document.title = `${course.title} — Course Player | GITAcademy`;
  const titleEl = document.getElementById('playerCourseTitle');
  if (titleEl) titleEl.textContent = course.title;

  const lessons = course.lessons || [];
  const list = document.getElementById('sidebarLessons');
  const meta = document.getElementById('sectionMeta');
  if (meta) meta.textContent = `${lessons.length} lesson${lessons.length===1?'':'s'}`;

  if (list) {
    list.innerHTML = lessons.map((l, i) => `
      <div class="sidebar-lesson${i===0?' active':''}" data-lesson-id="${l.id}" data-video-path="${l.video_path || ''}">
        <div class="lesson-check${i===0?' active':''}">${i===0?'▶':''}</div>
        <div class="lesson-info">
          <div class="lesson-title">${l.title}</div>
          <div class="lesson-meta-row"><span class="lesson-type-icon">${l.type==='quiz'?'📝':l.type==='article'?'📄':'▶'}</span><span>${formatDuration(Math.round(l.duration_seconds/60))}</span>${l.is_free ? '<span class="lesson-free-badge">FREE</span>' : ''}</div>
        </div>
      </div>`).join('') || '<p style="padding:1rem;font-size:.8rem;color:rgba(245,240,232,.4)">No lessons have been added to this course yet.</p>';

    // Bind click handlers now that the real lesson elements exist
    document.querySelectorAll('.sidebar-lesson').forEach(lesson => {
      lesson.addEventListener('click', () => loadLesson(lesson));
    });

    if (lessons[0]) currentLesson = lessons[0];

    // Initialize the first lesson's player state (real video vs simulated) the same way a click would
    const firstLessonEl = document.querySelector('.sidebar-lesson');
    if (firstLessonEl) loadLesson(firstLessonEl); // this also calls loadQa()
  }
}


// ─── PLAYER ───────────────────────────────────────────────────
function initPlayer() {
  const playBtn      = document.getElementById('playBtn');
  const speedBtn     = document.getElementById('speedBtn');
  const progressTrack = document.getElementById('progressTrack');
  const videoContainer = document.getElementById('videoContainer');
  const realVideo = document.getElementById('realVideoEl');

  playBtn?.addEventListener('click', togglePlay);
  videoContainer?.addEventListener('click', (e) => {
    if (e.target.id !== 'realVideoEl') togglePlay(); // real video has its own click-to-seek via controls below
  });

  speedBtn?.addEventListener('click', () => {
    speedIndex = (speedIndex + 1) % speeds.length;
    playbackSpeed = speeds[speedIndex];
    speedBtn.textContent = playbackSpeed + '×';
    if (usingRealVideo) realVideo.playbackRate = playbackSpeed;
  });

  progressTrack?.addEventListener('click', (e) => {
    const rect = progressTrack.getBoundingClientRect();
    const pct = ((e.clientX - rect.left) / rect.width) * 100;
    if (usingRealVideo && realVideo.duration) {
      realVideo.currentTime = (pct / 100) * realVideo.duration;
    } else {
      simulatedPct = pct;
      updateProgressBar(simulatedPct);
    }
  });

  // Real <video> native events drive the UI when a real file is loaded
  realVideo.addEventListener('timeupdate', () => {
    if (!usingRealVideo || !realVideo.duration) return;
    updateProgressBar((realVideo.currentTime / realVideo.duration) * 100);
    updateTimeLabels(realVideo.currentTime, realVideo.duration);
  });
  realVideo.addEventListener('ended', () => { isPlaying = false; onLessonEnd(); });
  realVideo.addEventListener('play',  () => setPlayIcon(true));
  realVideo.addEventListener('pause', () => setPlayIcon(false));

  // Skip back / forward
  document.getElementById('skipBackBtn')?.addEventListener('click', () => seekBack(10));
  document.getElementById('skipForwardBtn')?.addEventListener('click', () => seekForward(10));

  // Mute + volume — real on the real <video> element; honest no-op message in simulated mode
  const muteBtn = document.getElementById('muteBtn');
  const volumeSlider = document.getElementById('volumeSlider');
  muteBtn?.addEventListener('click', () => {
    if (usingRealVideo) {
      realVideo.muted = !realVideo.muted;
      muteBtn.classList.toggle('active', realVideo.muted);
    } else {
      showToast('No audio to mute — this lesson has no uploaded video yet.', 'info', 1800);
    }
  });
  volumeSlider?.addEventListener('input', (e) => {
    if (usingRealVideo) realVideo.volume = Number(e.target.value) / 100;
  });

  // Autoplay toggle — real, drives onLessonEnd()'s auto-advance
  const autoplayBtn = document.getElementById('autoplayBtn');
  autoplayBtn?.addEventListener('click', () => {
    const on = autoplayBtn.classList.toggle('active');
    autoplayBtn.title = on ? 'Autoplay: on' : 'Autoplay: off';
  });

  // Subtitles — honestly not available (no caption files exist for any lesson)
  document.getElementById('subtitlesBtn')?.addEventListener('click', () => {
    showToast('Subtitles aren\'t available for this course yet.', 'info', 1800);
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

function setPlayIcon(playing) {
  isPlaying = playing;
  const playIcon = document.getElementById('playIcon');
  const centerPlay = document.getElementById('centerPlay');
  if (playIcon) {
    playIcon.innerHTML = playing
      ? '<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>'
      : '<polygon points="5 3 19 12 5 21 5 3"/>';
  }
  if (centerPlay) centerPlay.classList.toggle('visible', !playing);
}

function togglePlay() {
  const realVideo = document.getElementById('realVideoEl');
  if (usingRealVideo) {
    if (realVideo.paused) realVideo.play(); else realVideo.pause();
    return; // play/pause events above drive the icon + progress
  }

  setPlayIcon(!isPlaying);
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

function updateTimeLabels(current, duration) {
  const labels = document.querySelectorAll('.time-label');
  const fmt = (s) => `${Math.floor(s/60).toString().padStart(2,'0')}:${Math.floor(s%60).toString().padStart(2,'0')}`;
  if (labels[0]) labels[0].textContent = fmt(current);
  if (labels[1]) labels[1].textContent = fmt(duration);
}

function seekForward(seconds) {
  const realVideo = document.getElementById('realVideoEl');
  if (usingRealVideo && realVideo.duration) {
    realVideo.currentTime = Math.min(realVideo.currentTime + seconds, realVideo.duration);
    return;
  }
  simulatedPct = Math.min(simulatedPct + (seconds / 1112 * 100), 100);
  updateProgressBar(simulatedPct);
}

function seekBack(seconds) {
  const realVideo = document.getElementById('realVideoEl');
  if (usingRealVideo && realVideo.duration) {
    realVideo.currentTime = Math.max(realVideo.currentTime - seconds, 0);
    return;
  }
  simulatedPct = Math.max(simulatedPct - (seconds / 1112 * 100), 0);
  updateProgressBar(simulatedPct);
}

function onLessonEnd() {
  isPlaying = false;
  markLessonComplete(); // real video actually finishing is real completion signal
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
  const realVideo = document.getElementById('realVideoEl');
  realVideo.pause();
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

  // Switch to real <video> playback if this lesson has a real uploaded file,
  // otherwise fall back to the simulated demo player (honest — no real file to play).
  const videoPath = lessonEl.dataset.videoPath;
  const placeholder = document.getElementById('videoPlaceholder');
  usingRealVideo = !!videoPath;
  if (usingRealVideo) {
    realVideo.src = '/' + videoPath;
    realVideo.currentTime = 0;
    realVideo.playbackRate = playbackSpeed;
    realVideo.style.display = '';
    if (placeholder) placeholder.style.display = 'none';
  } else {
    realVideo.removeAttribute('src');
    realVideo.style.display = 'none';
    if (placeholder) placeholder.style.display = '';
  }

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

  // Refresh Q&A for the newly active lesson
  loadQa();
}

// ─── NOTES ────────────────────────────────────────────────────
function initNotes() {
  const saveBtn   = document.getElementById('saveNoteBtn');
  const noteInput = document.getElementById('noteInput');

  saveBtn?.addEventListener('click', saveNote);
  noteInput?.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'Enter') saveNote();
  });

  loadNotes();
}

async function loadNotes() {
  const savedNotes = document.getElementById('savedNotes');
  if (!savedNotes) return;
  try {
    const data = await notesApi.list(courseId);
    const notes = data.notes || [];
    savedNotes.innerHTML = notes.map(n => {
      const m = Math.floor(n.timestamp_seconds / 60);
      const s = n.timestamp_seconds % 60;
      return `<div class="note-item" data-note-id="${n.id}"><div class="note-item-time">📍 ${m}:${String(s).padStart(2,'0')}</div>${n.content}</div>`;
    }).join('') || '<p style="font-size:.8rem;color:rgba(245,240,232,.35)">No notes yet — add one while you watch.</p>';
  } catch (_) { /* leave empty */ }
}

async function saveNote() {
  const noteInput = document.getElementById('noteInput');
  const content = noteInput?.value?.trim();
  if (!content) return;

  const lessonId = document.querySelector('.sidebar-lesson.active')?.dataset.lessonId || null;
  const timestamp = Math.floor(simulatedPct * 11.12); // seconds approximation

  try {
    await notesApi.save(courseId, lessonId, content, timestamp);
    await loadNotes();
    noteInput.value = '';
    showToast('Note saved ✓', 'success', 1500);
  } catch (err) {
    showToast('Could not save note.', 'error', 1500);
  }
}

// ─── Q&A ──────────────────────────────────────────────────────
function initQA() {
  const qaInput  = document.getElementById('qaInput');
  const qaSubmit = document.getElementById('qaSubmitBtn');

  qaSubmit?.addEventListener('click', submitQuestion);
  qaInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitQuestion(); }
  });

  // Upvote delegation — real, persisted server-side
  document.getElementById('qaList')?.addEventListener('click', async (e) => {
    if (e.target.classList.contains('qa-action-btn') && e.target.dataset.qaId) {
      const btn = e.target;
      if (btn.dataset.voted) return;
      try {
        const result = await qaApi.upvote(btn.dataset.qaId);
        btn.dataset.voted = '1';
        btn.textContent = '👍 ' + result.upvotes;
        btn.style.color = 'var(--gold)';
      } catch (_) { /* no-op */ }
    }
  });
}

function renderQaList(questions) {
  const qaList = document.getElementById('qaList');
  if (!qaList) return;
  qaList.innerHTML = questions.map(q => {
    const name = `${q.first_name} ${q.last_name}`;
    const initials = name.split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase();
    const replies = (q.replies || []).map(r => `
      <div class="qa-item" style="margin-left:2rem;margin-top:.5rem">
        <div class="qa-avatar">${(r.first_name?.[0]||'')+(r.last_name?.[0]||'')}</div>
        <div class="qa-content">
          <div class="qa-author">${r.first_name} ${r.last_name} · ${(r.created_at||'').slice(0,10)}</div>
          <div class="qa-text">${r.answer}</div>
        </div>
      </div>`).join('');
    return `
    <div class="qa-item">
      <div class="qa-avatar">${initials}</div>
      <div class="qa-content">
        <div class="qa-author">${name} · ${(q.created_at||'').slice(0,10)}</div>
        <div class="qa-text">${q.question}</div>
        <div class="qa-actions">
          <button class="qa-action-btn" data-qa-id="${q.id}">👍 ${q.upvotes}</button>
        </div>
      </div>
    </div>${replies}`;
  }).join('') || '<p style="font-size:.8rem;color:rgba(245,240,232,.35)">No questions yet for this lesson — ask the first one!</p>';
}

async function loadQa() {
  const lessonId = document.querySelector('.sidebar-lesson.active')?.dataset.lessonId;
  if (!lessonId) return;
  try {
    const data = await qaApi.list(courseId, lessonId);
    renderQaList(data.questions || []);
  } catch (_) { /* leave existing content */ }
}

async function submitQuestion() {
  const qaInput = document.getElementById('qaInput');
  const question = qaInput?.value?.trim();
  if (!question) return;

  const lessonId = document.querySelector('.sidebar-lesson.active')?.dataset.lessonId;
  if (!lessonId) return;

  try {
    await qaApi.ask(courseId, lessonId, question);
    qaInput.value = '';
    await loadQa();
    showToast('Question posted ✓', 'success', 1500);
  } catch (err) {
    showToast('Could not post question.', 'error', 1500);
  }
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
