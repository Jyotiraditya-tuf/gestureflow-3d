/**
 * GestureFlow 3D - Main Application Orchestrator
 * Integrates Three.js 3D rendering, Particle Physics, MediaPipe Hands,
 * Glassmorphic HUD, and Audio Synthesis into a 60 FPS experience.
 */

import * as THREE from 'three';
import { ParticleSystem } from './particles.js';
import { PhysicsEngine } from './physics.js';
import { GestureController } from './gestureController.js';
import { HandTrackingManager } from './handTracking.js';
import { UIManager } from './ui.js';
import { AmbientSynthesizer } from './audio.js';

class App {
  constructor() {
    this.canvas = document.getElementById('webgl-canvas');
    this.video = document.getElementById('webcam-video');
    this.skeletonCanvas = document.getElementById('skeleton-canvas');

    // Performance & simulation state
    this.isPaused = false;
    this.fps = 60;
    this.frameCount = 0;
    this.lastFpsUpdate = performance.now();
    this.lowFpsDuration = 0;

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

    // Start vision tracking
    await this.handTracker.initialize();
    this.updateCameraStatusBadge();
  }

  /**
   * Initialize Three.js WebGL Renderer, Scene, Camera
   */
  initThree() {
    const width = window.innerWidth;
    const height = window.innerHeight;

    // 1. Scene
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x050711, 0.007);

    // 2. Camera
    this.camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
    this.camera.position.set(0, 0, 55);

    // 3. Renderer with high performance settings
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: 'high-performance',
      stencil: false,
      depth: true
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x050711, 1);
  }

  /**
   * Add deep ambient starry backdrop for immersive space depth
   */
  initSceneBackdrop() {
    const starCount = 1500;
    const starGeo = new THREE.BufferGeometry();
    const starPos = new Float32Array(starCount * 3);
    const starCol = new Float32Array(starCount * 3);

    for (let i = 0; i < starCount; i++) {
      const idx = i * 3;
      // Random sphere shell far away
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
   * Instantiate all modular subsystems
   */
  initSubsystems() {
    // 1. Particle System (~20,000 particles by default)
    this.particles = new ParticleSystem(this.scene, 20000);

    // 2. Physics Engine
    this.physics = new PhysicsEngine();

    // 3. Gesture Controller
    this.gestureCtrl = new GestureController();

    // 4. Ambient Audio Synthesizer
    this.audio = new AmbientSynthesizer();

    // 5. Hand Tracking Manager
    this.handTracker = new HandTrackingManager(
      this.video,
      this.skeletonCanvas,
      (results) => this.onHandResults(results)
    );

    // 6. Glassmorphism UI Manager
    this.ui = new UIManager({
      onFormationChange: (formationId) => {
        this.particles.setFormation(formationId);
      },
      onThemeChange: (themeId) => {
        this.particles.setColorTheme(themeId);
      },
      onParticleCountChange: (count) => {
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

  /**
   * Callback fired by MediaPipe Hands when new landmarks arrive
   */
  onHandResults(results) {
    const processed = this.gestureCtrl.process(results, performance.now());
    this.currentGestureState = processed.gesture;
    this.currentHandData = processed.handData;

    // Update UI gesture card
    this.ui.updateGestureDisplay(this.currentGestureState);

    // Hand tilt driving scene camera rotation
    if (this.currentHandData && this.currentHandData.hasHand && !this.currentHandData.hasTwoHands) {
      const palm = this.currentHandData.normalizedPalm;
      if (palm) {
        this.targetCameraRotY = (palm.x - 0.5) * -0.7;
        this.targetCameraRotX = (palm.y - 0.5) * 0.5;
      }
    } else {
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

  /**
   * Window and resize events
   */
  setupWindowEvents() {
    window.addEventListener('resize', () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h);
    });
  }

  /**
   * 4K / High resolution canvas screenshot capture
   */
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
   * Main 60 FPS Render & Simulation Loop
   */
  startAnimationLoop() {
    let lastTime = performance.now();

    const animate = (currentTime) => {
      requestAnimationFrame(animate);

      const dt = Math.min(0.05, (currentTime - lastTime) / 1000);
      lastTime = currentTime;

      // 1. Calculate FPS & Auto-throttle if needed
      this.frameCount++;
      if (currentTime - this.lastFpsUpdate >= 500) {
        this.fps = (this.frameCount * 1000) / (currentTime - this.lastFpsUpdate);
        this.frameCount = 0;
        this.lastFpsUpdate = currentTime;
        this.ui.updateStats(this.fps, this.particles.count);

        // Adaptive performance: If FPS stays under 32 for > 3 seconds on low-spec device, optimize
        if (this.fps < 32 && this.particles.count > 10000) {
          this.lowFpsDuration += 0.5;
          if (this.lowFpsDuration >= 3.0) {
            const reducedCount = Math.max(8000, Math.floor(this.particles.count * 0.75));
            this.particles.setParticleCount(reducedCount);
            if (this.ui.dom.sliderParticleCount) {
              this.ui.dom.sliderParticleCount.value = reducedCount;
              if (this.ui.dom.valParticleCount) {
                this.ui.dom.valParticleCount.textContent = reducedCount.toLocaleString();
              }
            }
            this.ui.showToast(`Auto-optimized particles to ${reducedCount.toLocaleString()} for smooth 60 FPS`);
            this.lowFpsDuration = 0;
          }
        } else {
          this.lowFpsDuration = 0;
        }
      }

      // 2. Physics & Particle Simulation (if not paused)
      if (!this.isPaused) {
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
      }

      // 3. Smooth Camera Tilt and Ambient Slow Orbit
      this.currentCameraRotX += (this.targetCameraRotX - this.currentCameraRotX) * 0.08;
      this.currentCameraRotY += (this.targetCameraRotY - this.currentCameraRotY) * 0.08;

      // Ambient slow cosmic rotation
      if (this.particles.points) {
        this.particles.points.rotation.y += 0.0015;
        this.particles.points.rotation.x = this.currentCameraRotX;
        this.particles.points.rotation.z = this.currentCameraRotY * 0.5;
      }

      if (this.starField) {
        this.starField.rotation.y += 0.0003;
      }

      // 4. Update Audio Synthesizer
      this.audio.update(this.currentGestureState, this.currentHandData);

      // 5. Render Three.js Scene
      this.renderer.render(this.scene, this.camera);
    };

    requestAnimationFrame(animate);
  }
}

// Bootstrap Application
window.addEventListener('DOMContentLoaded', () => {
  window.__gestureFlowApp = new App();
});
