/**
 * GestureFlow 3D - Optimized Main Application Orchestrator
 * High-framerate 60 FPS loop with decoupled vision inference,
 * adaptive performance scaling, performance telemetry, and capped pixel ratio.
 */

import * as THREE from 'three';
import { ParticleSystem } from './particles.js';
import { PhysicsEngine } from './physics.js';
import { GestureController } from './gestureController.js';
import { HandTrackingManager } from './handTracking.js';
import { UIManager } from './ui.js';
import { AmbientSynthesizer } from './audio.js';
import { FORMATIONS, FORMATION_ORDER } from './formations.js';

class App {
  constructor() {
    this.canvas = document.getElementById('webgl-canvas');
    this.video = document.getElementById('webcam-video');
    this.skeletonCanvas = document.getElementById('skeleton-canvas');

    // Performance & simulation state
    this.isPaused = false;
    this.fps = 60;
    this.fpsMovingAverage = 60;
    this.frameCount = 0;
    this.lastFpsUpdate = performance.now();
    
    // Quality Mode: 'auto' | 'high' | 'medium' | 'low'
    this.qualityMode = 'auto';
    this.autoTuneCooldown = 0;

    // Performance Instrumentation
    this.perfMetrics = {
      fps: 60,
      frameTime: 16.6,
      physicsTime: 2.0,
      visionTime: 0,
      renderTime: 3.0,
      particles: 20000
    };

    // Three.js Core
    this.scene = null;
    this.camera = null;
    this.renderer = null;

    // Subsystems
    this.particles = null;
    this.physics = null;
    this.gestureCtrl = null;
    this.handTracker = null;
    this.ui = null;
    this.audio = null;

    // Hand Tracking and Interaction State
    this.currentGestureState = null;
    this.currentHandData = null;

    // Scene camera orbit & tilt smoothing
    this.targetCameraRotX = 0;
    this.targetCameraRotY = 0;
    this.currentCameraRotX = 0;
    this.currentCameraRotY = 0;

    this.init();
  }

  async init() {
    this.initThree();
    this.initSceneBackdrop();
    this.initSubsystems();
    this.setupWindowEvents();
    this.startAnimationLoop();

    // Start vision tracking in decoupled mode
    await this.handTracker.initialize();
    this.updateCameraStatusBadge();
  }

  /**
   * Initialize Three.js WebGL Renderer with performance capped pixelRatio
   */
  initThree() {
    const width = window.innerWidth;
    const height = window.innerHeight;

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x050711, 0.007);

    this.camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
    this.camera.position.set(0, 0, 55);

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: 'high-performance',
      stencil: false,
      depth: true
    });
    this.renderer.setSize(width, height);
    // Cap pixel ratio to 1.5 to prevent high-DPI fillrate bottlenecks
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.setClearColor(0x050711, 1);
  }

  /**
   * Starry backdrop with low particle footprint
   */
  initSceneBackdrop() {
    const starCount = 1000;
    const starGeo = new THREE.BufferGeometry();
    const starPos = new Float32Array(starCount * 3);
    const starCol = new Float32Array(starCount * 3);

    for (let i = 0; i < starCount; i++) {
      const idx = i * 3;
      const u = Math.random();
      const v = Math.random();
      const theta = u * 2.0 * Math.PI;
      const phi = Math.acos(2.0 * v - 1.0);
      const r = 250 + Math.random() * 200;

      starPos[idx] = r * Math.sin(phi) * Math.cos(theta);
      starPos[idx + 1] = r * Math.sin(phi) * Math.sin(theta);
      starPos[idx + 2] = r * Math.cos(phi);

      const bright = 0.4 + Math.random() * 0.6;
      starCol[idx] = bright * 0.8;
      starCol[idx + 1] = bright * 0.9;
      starCol[idx + 2] = bright * 1.0;
    }

    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    starGeo.setAttribute('color', new THREE.BufferAttribute(starCol, 3));

    const starMat = new THREE.PointsMaterial({
      size: 1.2,
      vertexColors: true,
      transparent: true,
      opacity: 0.75,
      depthWrite: false
    });

    const starField = new THREE.Points(starGeo, starMat);
    this.scene.add(starField);
    this.starField = starField;
  }

  /**
   * Instantiate subsystems
   */
  initSubsystems() {
    this.particles = new ParticleSystem(this.scene, 20000);
    this.physics = new PhysicsEngine();
    this.gestureCtrl = new GestureController();
    this.audio = new AmbientSynthesizer();

    this.handTracker = new HandTrackingManager(
      this.video,
      this.skeletonCanvas,
      (results) => this.onHandResults(results)
    );

    this.ui = new UIManager({
      onFormationChange: (formationId) => {
        this.particles.setFormation(formationId);
      },
      onThemeChange: (themeId) => {
        this.particles.setColorTheme(themeId);
      },
      onQualityChange: (quality) => {
        this.setQualityPreset(quality);
      },
      onParticleCountChange: (count) => {
        this.qualityMode = 'custom';
        this.ui.setActiveQualityPill('custom');
        this.particles.setParticleCount(count);
      },
      onParticleSizeChange: (size) => {
        this.particles.setSize(size);
      },
      onSensitivityChange: (sens) => {
        this.physics.sensitivity = sens;
      },
      onForceStrengthChange: (force) => {
        this.physics.forceMultiplier = force;
      },
      onTurbulenceChange: (turb) => {
        this.physics.noiseStrength = turb;
      },
      onReset: () => {
        this.particles.resetParticles();
      },
      onTogglePause: (isPaused) => {
        this.isPaused = isPaused;
      },
      onToggleAudio: () => {
        return this.audio.toggle();
      },
      onScreenshot: () => {
        this.takeScreenshot();
      },
      onFlipCamera: () => {
        this.handTracker.isMirrored = !this.handTracker.isMirrored;
        if (this.video) {
          this.video.style.transform = this.handTracker.isMirrored ? 'scaleX(-1)' : 'scaleX(1)';
        }
      },
      onToggleCameraPreview: (visible) => {
        this.handTracker.togglePreview(visible);
      }
    });
  }

  setQualityPreset(preset) {
    this.qualityMode = preset;
    let count = 20000;
    let pixelRatio = 1.5;

    switch (preset) {
      case 'high':
        count = 30000;
        pixelRatio = 1.5;
        break;
      case 'medium':
        count = 18000;
        pixelRatio = 1.5;
        break;
      case 'low':
        count = 8000;
        pixelRatio = 1.25;
        break;
      case 'auto':
        count = 20000;
        pixelRatio = 1.5;
        break;
    }

    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, pixelRatio));
    this.particles.setParticleCount(count);

    if (this.ui.dom.sliderParticleCount) {
      this.ui.dom.sliderParticleCount.value = count;
      if (this.ui.dom.valParticleCount) {
        this.ui.dom.valParticleCount.textContent = count.toLocaleString();
      }
    }
  }

  onHandResults(results) {
    const processed = this.gestureCtrl.process(results, performance.now());
    this.currentGestureState = processed.gesture;
    this.currentHandData = processed.handData;

    this.ui.updateGestureDisplay(this.currentGestureState);

    // 1. Handle Swipe Event for Formation Switching
    if (this.currentHandData && this.currentHandData.swipeEvent) {
      const { direction } = this.currentHandData.swipeEvent;
      const currIdx = FORMATION_ORDER.indexOf(this.particles.currentFormationId);
      const totalFormations = FORMATION_ORDER.length;
      
      let nextIdx;
      if (direction === 'right') {
        nextIdx = (currIdx + 1) % totalFormations;
      } else {
        nextIdx = (currIdx - 1 + totalFormations) % totalFormations;
      }

      const nextFormationId = FORMATION_ORDER[nextIdx];
      this.particles.setFormation(nextFormationId);
      this.ui.setActiveFormationPill(nextFormationId);

      const formName = FORMATIONS[nextFormationId]?.name || nextFormationId;
      const arrow = direction === 'right' ? '➔' : '⬅';
      this.ui.showToast(`💨 Swipe ${direction.toUpperCase()} ${arrow} Formation: ${formName}`);
    }

    // 2. Handle Two-Hand Interactive Universe Twist Rotation
    if (this.currentHandData && this.currentHandData.hasTwoHands) {
      if (this.currentHandData.twoHandAngleDelta !== 0 && this.particles && this.particles.points) {
        this.particles.points.rotation.z += this.currentHandData.twoHandAngleDelta * 0.75;
      }
    }

    // 3. Hand tilt driving scene camera rotation (Single Hand mode)
    if (this.currentHandData && this.currentHandData.hasHand && !this.currentHandData.hasTwoHands) {
      const palm = this.currentHandData.normalizedPalm;
      if (palm) {
        this.targetCameraRotY = (palm.x - 0.5) * -0.7;
        this.targetCameraRotX = (palm.y - 0.5) * 0.5;
      }
    } else if (!this.currentHandData || !this.currentHandData.hasHand) {
      this.targetCameraRotX = 0;
      this.targetCameraRotY = 0;
    }

    this.updateCameraStatusBadge();
  }

  updateCameraStatusBadge() {
    let status = this.handTracker.status;
    let message = this.handTracker.statusMessage;

    if (this.handTracker.mouseFallbackActive) {
      status = 'fallback';
      message = 'Mouse interactive fallback';
    } else if (this.handTracker.isCameraActive) {
      status = 'active';
      message = 'Webcam: Live Tracking';
    }

    this.ui.updateCameraStatus(status, message);
  }

  setupWindowEvents() {
    let resizeTimeout;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        const w = window.innerWidth;
        const h = window.innerHeight;
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(w, h);
      }, 100);
    });
  }

  takeScreenshot() {
    this.renderer.render(this.scene, this.camera);
    const dataUrl = this.canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `gestureflow-3d-${Date.now()}.png`;
    link.href = dataUrl;
    link.click();
    this.ui.showToast('High-Res Screenshot Saved!');
  }

  /**
   * Main 60 FPS Render Loop
   */
  startAnimationLoop() {
    let lastTime = performance.now();

    const animate = (currentTime) => {
      requestAnimationFrame(animate);

      const frameStart = performance.now();
      const dt = Math.min(0.05, (currentTime - lastTime) / 1000);
      lastTime = currentTime;

      // 1. Calculate FPS & Moving Average
      this.frameCount++;
      if (currentTime - this.lastFpsUpdate >= 250) {
        this.fps = (this.frameCount * 1000) / (currentTime - this.lastFpsUpdate);
        this.fpsMovingAverage = this.fpsMovingAverage * 0.7 + this.fps * 0.3;
        this.frameCount = 0;
        this.lastFpsUpdate = currentTime;
        this.ui.updateStats(this.fpsMovingAverage, this.particles.count);

        // Adaptive performance controller in 'auto' mode
        if (this.qualityMode === 'auto') {
          this.autoTuneCooldown++;
          if (this.autoTuneCooldown >= 6) { // check every 1.5 seconds
            if (this.fpsMovingAverage < 45 && this.particles.count > 10000) {
              const newCount = Math.max(8000, Math.floor(this.particles.count * 0.8));
              this.particles.setParticleCount(newCount);
              if (this.ui.dom.sliderParticleCount) {
                this.ui.dom.sliderParticleCount.value = newCount;
                if (this.ui.dom.valParticleCount) {
                  this.ui.dom.valParticleCount.textContent = newCount.toLocaleString();
                }
              }
            } else if (this.fpsMovingAverage >= 58 && this.particles.count < 24000) {
              const newCount = Math.min(24000, this.particles.count + 2000);
              this.particles.setParticleCount(newCount);
              if (this.ui.dom.sliderParticleCount) {
                this.ui.dom.sliderParticleCount.value = newCount;
                if (this.ui.dom.valParticleCount) {
                  this.ui.dom.valParticleCount.textContent = newCount.toLocaleString();
                }
              }
            }
            this.autoTuneCooldown = 0;
          }
        }
      }

      // 2. Physics Step & Timing
      let physicsDuration = 0;
      if (!this.isPaused) {
        const pStart = performance.now();
        this.physics.update(
          this.particles.positions,
          this.particles.velocities,
          this.particles.targetPositions,
          this.particles.count,
          this.currentGestureState,
          this.currentHandData,
          dt
        );
        this.particles.renderUpdate(dt);
        physicsDuration = performance.now() - pStart;
      }

      // 3. Smooth Camera Tilt and Ambient Slow Orbit
      this.currentCameraRotX += (this.targetCameraRotX - this.currentCameraRotX) * 0.08;
      this.currentCameraRotY += (this.targetCameraRotY - this.currentCameraRotY) * 0.08;

      if (this.particles.points) {
        this.particles.points.rotation.y += 0.0015;
        this.particles.points.rotation.x = this.currentCameraRotX;
        this.particles.points.rotation.z = this.currentCameraRotY * 0.5;
      }

      if (this.starField) {
        this.starField.rotation.y += 0.0003;
      }

      // 4. Update Audio Synthesizer (throttled internally)
      this.audio.update(this.currentGestureState, this.currentHandData);

      // 5. Render Three.js Scene & Timing
      const rStart = performance.now();
      this.renderer.render(this.scene, this.camera);
      const renderDuration = performance.now() - rStart;

      const totalFrameDuration = performance.now() - frameStart;

      // 6. Update Performance Telemetry HUD if active
      if (this.ui.showPerfHUD) {
        this.perfMetrics.fps = this.fpsMovingAverage;
        this.perfMetrics.frameTime = totalFrameDuration;
        this.perfMetrics.physicsTime = physicsDuration;
        this.perfMetrics.visionTime = this.handTracker.inferenceDuration;
        this.perfMetrics.renderTime = renderDuration;
        this.perfMetrics.particles = this.particles.count;
        this.ui.updatePerfHUD(this.perfMetrics);
      }
    };

    requestAnimationFrame(animate);
  }
}

// Bootstrap Application
window.addEventListener('DOMContentLoaded', () => {
  window.__gestureFlowApp = new App();
});
