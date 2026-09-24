/**
 * GITAcademy — video-controls.js
 * Standalone video UI controls — volume, subtitles, fullscreen, PiP
 * Works with both real <video> elements and simulated players
 */

export class VideoControls {
  constructor(options = {}) {
    this.videoEl       = options.videoEl || null;       // real <video> element or null
    this.containerEl   = options.containerEl || document.getElementById('videoContainer');
    this.onPlayChange  = options.onPlayChange || (() => {});
    this.onSeek        = options.onSeek || (() => {});

    this.volume        = 0.8;
    this.isMuted       = false;
    this.isFullscreen  = false;
    this.subtitlesOn   = false;
    this.currentSpeed  = 1;
    this.speeds        = [0.5, 0.75, 1, 1.25, 1.5, 2];

    this._init();
  }

  _init() {
    this._bindVolumeSlider();
    this._bindMuteBtn();
    this._bindSubtitlesBtn();
    this._bindFullscreenBtn();
    this._bindPiPBtn();
    this._bindSpeedSelect();
    this._bindHotkeys();
    this._listenFullscreenChange();
  }

  // ── VOLUME ────────────────────────────────────────────────
  _bindVolumeSlider() {
    const slider = document.querySelector('.volume-slider');
    if (!slider) return;
    slider.value = this.volume * 100;
    slider.addEventListener('input', () => {
      this.volume = slider.value / 100;
      this.isMuted = this.volume === 0;
      this._applyVolume();
    });
  }

  _applyVolume() {
    if (this.videoEl) this.videoEl.volume = this.isMuted ? 0 : this.volume;
    this._updateMuteIcon();
  }

  setVolume(v) {
    this.volume = Math.max(0, Math.min(1, v));
    const slider = document.querySelector('.volume-slider');
    if (slider) slider.value = this.volume * 100;
    this._applyVolume();
  }

  // ── MUTE ──────────────────────────────────────────────────
  _bindMuteBtn() {
    const btn = document.querySelector('.ctrl-btn[data-mute]') ||
                document.querySelector('[title="Mute"]');
    btn?.addEventListener('click', () => this.toggleMute());
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    if (this.videoEl) this.videoEl.muted = this.isMuted;
    this._updateMuteIcon();
  }

  _updateMuteIcon() {
    const btn = document.querySelector('[title="Mute"]');
    if (!btn) return;
    btn.innerHTML = this.isMuted
      ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
           <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
           <line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/>
         </svg>`
      : `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
           <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
           <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
         </svg>`;
  }

  // ── SUBTITLES ─────────────────────────────────────────────
  _bindSubtitlesBtn() {
    const btn = document.querySelector('[title="Subtitles"]');
    btn?.addEventListener('click', () => this.toggleSubtitles(btn));
  }

  toggleSubtitles(btn) {
    this.subtitlesOn = !this.subtitlesOn;
    if (btn) btn.classList.toggle('active', this.subtitlesOn);

    if (this.videoEl?.textTracks?.length) {
      Array.from(this.videoEl.textTracks).forEach(track => {
        track.mode = this.subtitlesOn ? 'showing' : 'disabled';
      });
    }

    // Show subtitle overlay if no native tracks
    let overlay = document.getElementById('subtitle-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'subtitle-overlay';
      overlay.style.cssText = 'position:absolute;bottom:80px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,.75);color:white;padding:.4rem 1rem;border-radius:6px;font-size:.9rem;display:none;pointer-events:none;text-align:center;max-width:80%';
      this.containerEl?.appendChild(overlay);
    }
    overlay.style.display = this.subtitlesOn ? 'block' : 'none';
    if (this.subtitlesOn) overlay.textContent = 'Subtitles enabled (English)';
  }

  // ── FULLSCREEN ────────────────────────────────────────────
  _bindFullscreenBtn() {
    document.getElementById('fullscreenBtn')?.addEventListener('click', () => this.toggleFullscreen());
  }

  toggleFullscreen() {
    const el = this.containerEl || document.documentElement;
    if (!document.fullscreenElement) {
      el.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  }

  _listenFullscreenChange() {
    document.addEventListener('fullscreenchange', () => {
      this.isFullscreen = !!document.fullscreenElement;
      const btn = document.getElementById('fullscreenBtn');
      if (!btn) return;
      btn.innerHTML = this.isFullscreen
        ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
             <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/>
           </svg>`
        : `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
             <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
           </svg>`;
    });
  }

  // ── PICTURE-IN-PICTURE ────────────────────────────────────
  _bindPiPBtn() {
    const btn = document.querySelector('[title="Picture in Picture"]');
    btn?.addEventListener('click', () => {
      if (this.videoEl && document.pictureInPictureEnabled) {
        if (document.pictureInPictureElement) {
          document.exitPictureInPicture();
        } else {
          this.videoEl.requestPictureInPicture().catch(console.error);
        }
      }
    });
  }

  // ── PLAYBACK SPEED ────────────────────────────────────────
  _bindSpeedSelect() {
    const btn = document.getElementById('speedBtn');
    if (!btn) return;
    btn.addEventListener('click', () => {
      const currentIdx = this.speeds.indexOf(this.currentSpeed);
      const nextIdx = (currentIdx + 1) % this.speeds.length;
      this.setSpeed(this.speeds[nextIdx]);
      btn.textContent = this.currentSpeed + '×';
    });
  }

  setSpeed(speed) {
    this.currentSpeed = speed;
    if (this.videoEl) this.videoEl.playbackRate = speed;
  }

  // ── KEYBOARD SHORTCUTS ────────────────────────────────────
  _bindHotkeys() {
    document.addEventListener('keydown', (e) => {
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      switch(e.key) {
        case 'm': case 'M': this.toggleMute(); break;
        case 'c': case 'C': this.toggleSubtitles(document.querySelector('[title="Subtitles"]')); break;
        case 'f': case 'F': this.toggleFullscreen(); break;
        case 'ArrowUp':
          e.preventDefault();
          this.setVolume(this.volume + 0.1);
          break;
        case 'ArrowDown':
          e.preventDefault();
          this.setVolume(this.volume - 0.1);
          break;
      }
    });
  }

  // ── REAL VIDEO ELEMENT BINDINGS ───────────────────────────
  bindRealVideo(videoEl) {
    this.videoEl = videoEl;
    this._applyVolume();

    videoEl.addEventListener('timeupdate', () => {
      const pct = (videoEl.currentTime / videoEl.duration) * 100;
      const fill = document.getElementById('progressFill');
      if (fill) fill.style.width = pct + '%';

      // Update time labels
      const current = document.getElementById('currentTime');
      const total   = document.getElementById('totalTime');
      if (current) current.textContent = formatVideoTime(videoEl.currentTime);
      if (total)   total.textContent   = formatVideoTime(videoEl.duration);
    });

    videoEl.addEventListener('ended', () => {
      const playIcon = document.getElementById('playIcon');
      if (playIcon) playIcon.innerHTML = '<polygon points="5 3 19 12 5 21 5 3"/>';
    });

    videoEl.addEventListener('waiting', () => {
      document.getElementById('bufferingSpinner')?.classList.remove('hidden');
    });
    videoEl.addEventListener('playing', () => {
      document.getElementById('bufferingSpinner')?.classList.add('hidden');
    });
  }
}

function formatVideoTime(secs) {
  if (!secs || isNaN(secs)) return '0:00';
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${String(s).padStart(2,'0')}`;
}

export { formatVideoTime };
