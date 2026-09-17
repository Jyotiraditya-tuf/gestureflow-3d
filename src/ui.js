/**
 * GestureFlow 3D - Optimized User Interface Manager
 * Dirty-checked DOM updates, Quality Mode selector (High/Med/Low/Auto),
 * Performance Diagnostics instrumentation, and responsive HUD.
 */

import { FORMATIONS } from './formations.js';
import { COLOR_THEMES } from './particles.js';

export class UIManager {
  constructor(callbacks = {}) {
    this.callbacks = callbacks;
    this.isUiVisible = true;
    this.isPaused = false;
    this.isPipMinimized = false;
    this.showPerfHUD = false;

    // DOM state cache for dirty-checking
    this.domCache = {
      fps: '',
      particleCount: '',
      cameraStatusClass: '',
      cameraStatusText: '',
      gestureIcon: '',
      gestureName: '',
      gestureDesc: '',
      confidenceWidth: '',
      activeFormation: 'galaxy',
      activeTheme: 'nebula',
      activeQuality: 'auto',
      perfStats: ''
    };

    this.dom = {};
    this.cacheDomElements();
    this.bindEvents();
  }

  cacheDomElements() {
    this.dom = {
      appContainer: document.getElementById('app'),
      hudContainer: document.getElementById('hud-container'),
      
      // Status badges
      cameraBadge: document.getElementById('camera-status-badge'),
      cameraStatusText: document.getElementById('camera-status-text'),
      fpsCounter: document.getElementById('fps-counter'),
      visionFpsCounter: document.getElementById('vision-fps-counter'),
      particleCountBadge: document.getElementById('particle-count-badge'),

      // Gesture Card
      gestureIcon: document.getElementById('gesture-icon'),
      gestureName: document.getElementById('gesture-name'),
      gestureDescription: document.getElementById('gesture-description'),
      gestureConfidenceFill: document.getElementById('gesture-confidence-fill'),

      // Quality Buttons
      qualityPills: document.querySelectorAll('.quality-pill'),

      // Control inputs
      formationPills: document.querySelectorAll('.formation-pill'),
      colorThemePills: document.querySelectorAll('.theme-pill'),
      
      sliderParticleCount: document.getElementById('slider-particle-count'),
      valParticleCount: document.getElementById('val-particle-count'),
      
      sliderParticleSize: document.getElementById('slider-particle-size'),
      valParticleSize: document.getElementById('val-particle-size'),
      
      sliderSensitivity: document.getElementById('slider-sensitivity'),
      valSensitivity: document.getElementById('val-sensitivity'),
      
      sliderForceStrength: document.getElementById('slider-force-strength'),
      valForceStrength: document.getElementById('val-force-strength'),
      
      sliderTurbulence: document.getElementById('slider-turbulence'),
      valTurbulence: document.getElementById('val-turbulence'),

      // Action buttons
      btnPause: document.getElementById('btn-pause'),
      btnReset: document.getElementById('btn-reset'),
      btnAudio: document.getElementById('btn-audio'),
      btnScreenshot: document.getElementById('btn-screenshot'),
      btnFullscreen: document.getElementById('btn-fullscreen'),
      btnHelp: document.getElementById('btn-help'),
      btnToggleHud: document.getElementById('btn-toggle-hud'),
      btnPerf: document.getElementById('btn-perf'),

      // Performance HUD
      perfOverlay: document.getElementById('perf-overlay'),
      perfContent: document.getElementById('perf-content'),

      // PIP Webcam
      pipContainer: document.getElementById('webcam-pip'),
      btnTogglePip: document.getElementById('btn-toggle-pip'),
      btnFlipCamera: document.getElementById('btn-flip-camera'),
      btnClosePip: document.getElementById('btn-close-pip'),
      
      // Modals & Toasts
      helpModal: document.getElementById('help-modal'),
      btnCloseHelp: document.getElementById('btn-close-help'),
      toastContainer: document.getElementById('toast-container')
    };
  }

  bindEvents() {
    // 1. Formation buttons
    if (this.dom.formationPills) {
      this.dom.formationPills.forEach((pill) => {
        pill.addEventListener('click', () => {
          const formationId = pill.dataset.formation;
          this.setActiveFormationPill(formationId);
          if (this.callbacks.onFormationChange) {
            this.callbacks.onFormationChange(formationId);
          }
          this.showToast(`Formation: ${FORMATIONS[formationId]?.name || formationId}`);
        });
      });
    }

    // 2. Color theme buttons
    if (this.dom.colorThemePills) {
      this.dom.colorThemePills.forEach((pill) => {
        pill.addEventListener('click', () => {
          const themeId = pill.dataset.theme;
          this.setActiveThemePill(themeId);
          if (this.callbacks.onThemeChange) {
            this.callbacks.onThemeChange(themeId);
          }
          this.showToast(`Theme: ${COLOR_THEMES[themeId]?.name || themeId}`);
        });
      });
    }

    // 3. Quality Presets
    if (this.dom.qualityPills) {
      this.dom.qualityPills.forEach((pill) => {
        pill.addEventListener('click', () => {
          const quality = pill.dataset.quality;
          this.setActiveQualityPill(quality);
          if (this.callbacks.onQualityChange) {
            this.callbacks.onQualityChange(quality);
          }
          this.showToast(`Quality: ${quality.toUpperCase()}`);
        });
      });
    }

    // 4. Sliders
    if (this.dom.sliderParticleCount) {
      this.dom.sliderParticleCount.addEventListener('input', (e) => {
        const count = parseInt(e.target.value, 10);
        if (this.dom.valParticleCount) this.dom.valParticleCount.textContent = count.toLocaleString();
        if (this.callbacks.onParticleCountChange) {
          this.callbacks.onParticleCountChange(count);
        }
      });
    }

    if (this.dom.sliderParticleSize) {
      this.dom.sliderParticleSize.addEventListener('input', (e) => {
        const size = parseFloat(e.target.value);
        if (this.dom.valParticleSize) this.dom.valParticleSize.textContent = size.toFixed(2);
        if (this.callbacks.onParticleSizeChange) {
          this.callbacks.onParticleSizeChange(size);
        }
      });
    }

    if (this.dom.sliderSensitivity) {
      this.dom.sliderSensitivity.addEventListener('input', (e) => {
        const sens = parseFloat(e.target.value);
        if (this.dom.valSensitivity) this.dom.valSensitivity.textContent = `${sens.toFixed(1)}x`;
        if (this.callbacks.onSensitivityChange) {
          this.callbacks.onSensitivityChange(sens);
        }
      });
    }

    if (this.dom.sliderForceStrength) {
      this.dom.sliderForceStrength.addEventListener('input', (e) => {
        const force = parseFloat(e.target.value);
        if (this.dom.valForceStrength) this.dom.valForceStrength.textContent = `${force.toFixed(1)}x`;
        if (this.callbacks.onForceStrengthChange) {
          this.callbacks.onForceStrengthChange(force);
        }
      });
    }

    if (this.dom.sliderTurbulence) {
      this.dom.sliderTurbulence.addEventListener('input', (e) => {
        const turb = parseFloat(e.target.value);
        if (this.dom.valTurbulence) this.dom.valTurbulence.textContent = turb.toFixed(2);
        if (this.callbacks.onTurbulenceChange) {
          this.callbacks.onTurbulenceChange(turb);
        }
      });
    }

    // 5. Action Buttons
    if (this.dom.btnPause) {
      this.dom.btnPause.addEventListener('click', () => this.togglePause());
    }

    if (this.dom.btnReset) {
      this.dom.btnReset.addEventListener('click', () => {
        if (this.callbacks.onReset) this.callbacks.onReset();
        this.showToast('Particle Field Reset');
      });
    }

    if (this.dom.btnAudio) {
      this.dom.btnAudio.addEventListener('click', () => {
        if (this.callbacks.onToggleAudio) {
          const isAudioOn = this.callbacks.onToggleAudio();
          this.updateAudioButtonState(isAudioOn);
        }
      });
    }

    if (this.dom.btnScreenshot) {
      this.dom.btnScreenshot.addEventListener('click', () => {
        if (this.callbacks.onScreenshot) this.callbacks.onScreenshot();
      });
    }

    if (this.dom.btnFullscreen) {
      this.dom.btnFullscreen.addEventListener('click', () => this.toggleFullscreen());
    }

    if (this.dom.btnHelp) {
      this.dom.btnHelp.addEventListener('click', () => this.toggleHelpModal(true));
    }

    if (this.dom.btnCloseHelp) {
      this.dom.btnCloseHelp.addEventListener('click', () => this.toggleHelpModal(false));
    }

    if (this.dom.btnPerf) {
      this.dom.btnPerf.addEventListener('click', () => this.togglePerfHUD());
    }

    // 6. PIP Controls
    if (this.dom.btnTogglePip && this.dom.pipContainer) {
      this.dom.btnTogglePip.addEventListener('click', () => {
        this.isPipMinimized = !this.isPipMinimized;
        this.dom.pipContainer.classList.toggle('minimized', this.isPipMinimized);
      });
    }

    if (this.dom.btnFlipCamera) {
      this.dom.btnFlipCamera.addEventListener('click', () => {
        if (this.callbacks.onFlipCamera) this.callbacks.onFlipCamera();
        this.showToast('Camera Mirrored');
      });
    }

    if (this.dom.btnClosePip && this.dom.pipContainer) {
      this.dom.btnClosePip.addEventListener('click', () => {
        const isShown = this.dom.pipContainer.classList.toggle('hidden');
        if (this.callbacks.onToggleCameraPreview) {
          this.callbacks.onToggleCameraPreview(!isShown);
        }
      });
    }

    // 7. Global Keyboard Shortcuts
    window.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      const key = e.key;
      const formationKeys = {
        '1': 'sphere',
        '2': 'galaxy',
        '3': 'vortex',
        '4': 'torus',
        '5': 'heart',
        '6': 'dna',
        '7': 'explosion',
        '8': 'nebula',
        '9': 'saturn'
      };

      if (formationKeys[key]) {
        const formId = formationKeys[key];
        this.setActiveFormationPill(formId);
        if (this.callbacks.onFormationChange) {
          this.callbacks.onFormationChange(formId);
        }
        this.showToast(`Formation: ${FORMATIONS[formId]?.name}`);
      } else if (key === ' ' || key === 'Spacebar') {
        e.preventDefault();
        this.togglePause();
      } else if (key === 'r' || key === 'R') {
        if (this.callbacks.onReset) this.callbacks.onReset();
        this.showToast('Particle Field Reset');
      } else if (key === 'm' || key === 'M') {
        if (this.callbacks.onToggleAudio) {
          const isAudioOn = this.callbacks.onToggleAudio();
          this.updateAudioButtonState(isAudioOn);
        }
      } else if (key === 'h' || key === 'H') {
        this.toggleHud();
      } else if (key === 'p' || key === 'P') {
        this.togglePerfHUD();
      } else if (key === 'f' || key === 'F') {
        this.toggleFullscreen();
      } else if (key === 's' || key === 'S') {
        if (this.callbacks.onScreenshot) this.callbacks.onScreenshot();
      } else if (key === 'c' || key === 'C') {
        if (this.dom.pipContainer) {
          this.dom.pipContainer.classList.toggle('hidden');
        }
      } else if (key === '?') {
        this.toggleHelpModal();
      } else if (key === 'Escape') {
        this.toggleHelpModal(false);
      }
    });
  }

  setActiveFormationPill(formationId) {
    if (this.domCache.activeFormation === formationId) return;
    this.domCache.activeFormation = formationId;

    if (!this.dom.formationPills) return;
    this.dom.formationPills.forEach((pill) => {
      pill.classList.toggle('active', pill.dataset.formation === formationId);
    });
  }

  setActiveThemePill(themeId) {
    if (this.domCache.activeTheme === themeId) return;
    this.domCache.activeTheme = themeId;

    if (!this.dom.colorThemePills) return;
    this.dom.colorThemePills.forEach((pill) => {
      pill.classList.toggle('active', pill.dataset.theme === themeId);
    });
  }

  setActiveQualityPill(quality) {
    if (this.domCache.activeQuality === quality) return;
    this.domCache.activeQuality = quality;

    if (!this.dom.qualityPills) return;
    this.dom.qualityPills.forEach((pill) => {
      pill.classList.toggle('active', pill.dataset.quality === quality);
    });
  }

  updateCameraStatus(status, message) {
    if (!this.dom.cameraBadge || !this.dom.cameraStatusText) return;

    const newClass = `status-badge status-${status}`;
    if (this.domCache.cameraStatusClass !== newClass) {
      this.domCache.cameraStatusClass = newClass;
      this.dom.cameraBadge.className = newClass;
    }

    if (this.domCache.cameraStatusText !== message) {
      this.domCache.cameraStatusText = message;
      this.dom.cameraStatusText.textContent = message;
    }
  }

  updateGestureDisplay(gestureState) {
    if (!gestureState) return;

    const icon = gestureState.icon || '✨';
    const name = gestureState.title || gestureState.name;
    const desc = gestureState.description || '';
    const pct = `${Math.round((gestureState.confidence || 0.8) * 100)}%`;

    if (this.dom.gestureIcon && this.domCache.gestureIcon !== icon) {
      this.domCache.gestureIcon = icon;
      this.dom.gestureIcon.textContent = icon;
    }

    if (this.dom.gestureName && this.domCache.gestureName !== name) {
      this.domCache.gestureName = name;
      this.dom.gestureName.textContent = name;
    }

    if (this.dom.gestureDescription && this.domCache.gestureDesc !== desc) {
      this.domCache.gestureDesc = desc;
      this.dom.gestureDescription.textContent = desc;
    }

    if (this.dom.gestureConfidenceFill && this.domCache.confidenceWidth !== pct) {
      this.domCache.confidenceWidth = pct;
      this.dom.gestureConfidenceFill.style.width = pct;
    }
  }

  updateStats(renderFps, visionFps, particleCount) {
    const fpsStr = `${Math.round(renderFps)} FPS`;
    if (this.dom.fpsCounter && this.domCache.fps !== fpsStr) {
      this.domCache.fps = fpsStr;
      this.dom.fpsCounter.textContent = fpsStr;
      if (renderFps < 30) {
        this.dom.fpsCounter.style.color = '#ef4444';
      } else if (renderFps < 50) {
        this.dom.fpsCounter.style.color = '#f59e0b';
      } else {
        this.dom.fpsCounter.style.color = '#10b981';
      }
    }

    const vFpsStr = `${Math.round(visionFps || 24)} FPS Vision`;
    if (this.dom.visionFpsCounter && this.domCache.visionFps !== vFpsStr) {
      this.domCache.visionFps = vFpsStr;
      this.dom.visionFpsCounter.textContent = vFpsStr;
    }

    const pStr = `${particleCount.toLocaleString()} particles`;
    if (this.dom.particleCountBadge && this.domCache.particleCount !== pStr) {
      this.domCache.particleCount = pStr;
      this.dom.particleCountBadge.textContent = pStr;
    }
  }

  updatePerfHUD(metrics) {
    if (!this.showPerfHUD || !this.dom.perfContent) return;

    const { frameTime, physicsTime, visionTime, renderTime, fps, visionFps, particles, resolution, quality } = metrics;
    const text = `⚡ TELEMETRY & ADAPTIVE SCALING
• Render Frame:    ${Math.round(fps)} FPS (${frameTime.toFixed(1)}ms)
• Vision AI Model: ${Math.round(visionFps || 24)} FPS (${visionTime.toFixed(1)}ms)
• Physics Step:    ${physicsTime.toFixed(1)}ms
• WebGL Draw:      ${renderTime.toFixed(1)}ms
• Particle Count:  ${particles.toLocaleString()}
• Resolution DPI:  ${resolution || '1.50x'} [${quality || 'AUTO'}]`;

    if (this.domCache.perfStats !== text) {
      this.domCache.perfStats = text;
      this.dom.perfContent.textContent = text;
    }
  }

  togglePerfHUD() {
    this.showPerfHUD = !this.showPerfHUD;
    if (this.dom.perfOverlay) {
      this.dom.perfOverlay.classList.toggle('active', this.showPerfHUD);
    }
    if (this.dom.btnPerf) {
      this.dom.btnPerf.classList.toggle('active', this.showPerfHUD);
    }
    this.showToast(this.showPerfHUD ? 'Performance Diagnostics: ON [P]' : 'Performance Diagnostics: OFF');
  }

  togglePause() {
    this.isPaused = !this.isPaused;
    if (this.dom.btnPause) {
      this.dom.btnPause.innerHTML = this.isPaused
        ? '<span class="icon">▶</span> Resume'
        : '<span class="icon">⏸</span> Pause';
      this.dom.btnPause.classList.toggle('paused', this.isPaused);
    }
    if (this.callbacks.onTogglePause) {
      this.callbacks.onTogglePause(this.isPaused);
    }
    this.showToast(this.isPaused ? 'Simulation Paused' : 'Simulation Resumed');
  }

  updateAudioButtonState(isOn) {
    if (!this.dom.btnAudio) return;
    this.dom.btnAudio.innerHTML = isOn
      ? '<span class="icon">🔊</span> Audio: ON'
      : '<span class="icon">🔇</span> Audio: OFF';
    this.dom.btnAudio.classList.toggle('active', isOn);
    this.showToast(isOn ? 'Ambient Audio Active' : 'Audio Muted');
  }

  toggleHud() {
    this.isUiVisible = !this.isUiVisible;
    if (this.dom.hudContainer) {
      this.dom.hudContainer.classList.toggle('hidden-hud', !this.isUiVisible);
    }
    this.showToast(this.isUiVisible ? 'HUD Visible' : 'HUD Hidden (Press H to restore)');
  }

  toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }

  toggleHelpModal(show) {
    if (!this.dom.helpModal) return;
    const isVisible = show !== undefined ? show : !this.dom.helpModal.classList.contains('active');
    this.dom.helpModal.classList.toggle('active', isVisible);
  }

  showToast(message, duration = 2200) {
    if (!this.dom.toastContainer) return;
    const toast = document.createElement('div');
    toast.className = 'toast-message';
    toast.textContent = message;
    this.dom.toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('fade-out');
      setTimeout(() => toast.remove(), 400);
    }, duration);
  }
}
