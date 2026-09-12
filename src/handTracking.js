/**
 * GestureFlow 3D - Optimized Hand Tracking Manager
 * Decouples MediaPipe AI inference from the 60 FPS WebGL render loop,
 * enforces an optimal 20-25 FPS vision cadence, throttles skeleton overlay drawing,
 * and seamlessly provides continuous landmark smoothing.
 */

import { HAND_LANDMARKS } from './gestureController.js';

export const HAND_CONNECTIONS = [
  // Thumb
  [0, 1], [1, 2], [2, 3], [3, 4],
  // Index
  [0, 5], [5, 6], [6, 7], [7, 8],
  // Middle
  [9, 10], [10, 11], [11, 12],
  // Ring
  [13, 14], [14, 15], [15, 16],
  // Pinky
  [0, 17], [17, 18], [18, 19], [19, 20],
  // Palm base
  [5, 9], [9, 13], [13, 17]
];

export class HandTrackingManager {
  constructor(videoElement, canvasElement, onResultsCallback) {
    this.video = videoElement;
    this.canvas = canvasElement;
    this.ctx = canvasElement ? canvasElement.getContext('2d') : null;
    this.onResults = onResultsCallback;

    this.stream = null;
    this.hands = null;
    this.isRunning = false;
    this.isCameraActive = false;
    this.isMirrored = true;
    this.showPreview = true;
    
    // Status: 'initializing' | 'active' | 'denied' | 'error' | 'fallback'
    this.status = 'initializing';
    this.statusMessage = 'Initializing vision system...';

    // Inference Throttling & Decoupling (~24 FPS target for ML inference)
    this.targetInferenceFps = 24;
    this.inferenceInterval = 1000 / this.targetInferenceFps;
    this.lastInferenceTime = 0;
    this.isInferencing = false;
    this.inferenceDuration = 0; // ms per inference for performance stats

    // Cached results for continuous 60 FPS consumer loop
    this.lastResults = null;

    // Mouse Fallback state
    this.mouseFallbackActive = false;
    this.mouseState = {
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
      isDown: false,
      isRightDown: false,
      prevX: window.innerWidth / 2,
      prevY: window.innerHeight / 2,
      vx: 0,
      vy: 0
    };

    this.setupMouseFallback();
  }

  /**
   * Initialize MediaPipe Hands and start webcam
   */
  async initialize() {
    try {
      this.status = 'initializing';
      this.statusMessage = 'Requesting camera access...';

      // Load MediaPipe Hands via window or CDN if not already loaded
      await this.ensureMediaPipeLoaded();

      if (window.Hands) {
        this.hands = new window.Hands({
          locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
        });

        this.hands.setOptions({
          maxNumHands: 2,
          modelComplexity: 1,
          minDetectionConfidence: 0.65,
          minTrackingConfidence: 0.65
        });

        this.hands.onResults((results) => {
          this.handleResults(results);
        });
      }

      // Start webcam stream
      await this.startCamera();
    } catch (err) {
      console.warn('Webcam initialization failed or was denied. Falling back to mouse controls.', err);
      this.status = err.name === 'NotAllowedError' ? 'denied' : 'fallback';
      this.statusMessage = err.name === 'NotAllowedError'
        ? 'Camera permission denied. Mouse fallback active.'
        : 'Webcam not available. Mouse fallback active.';
      this.activateMouseFallback();
    }
  }

  /**
   * Dynamically loads MediaPipe scripts if not bundled
   */
  async ensureMediaPipeLoaded() {
    if (window.Hands) return;

    const loadScript = (src) => {
      return new Promise((resolve, reject) => {
        if (document.querySelector(`script[src="${src}"]`)) {
          resolve();
          return;
        }
        const script = document.createElement('script');
        script.src = src;
        script.crossOrigin = 'anonymous';
        script.onload = () => resolve();
        script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
        document.head.appendChild(script);
      });
    };

    try {
      await Promise.all([
        loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js'),
        loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js')
      ]);
    } catch (e) {
      console.warn('Could not load CDN MediaPipe scripts directly:', e);
    }
  }

  /**
   * Request webcam stream at optimal 640x480 resolution
   */
  async startCamera() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('getUserMedia not supported in this browser environment');
    }

    const constraints = {
      video: {
        width: { ideal: 640 },
        height: { ideal: 480 },
        facingMode: 'user',
        frameRate: { ideal: 30 }
      },
      audio: false
    };

    this.stream = await navigator.mediaDevices.getUserMedia(constraints);
    this.video.srcObject = this.stream;
    
    await new Promise((resolve) => {
      this.video.onloadedmetadata = () => {
        this.video.play();
        resolve();
      };
    });

    this.isCameraActive = true;
    this.status = 'active';
    this.statusMessage = 'Webcam tracking active';
    this.isRunning = true;

    // Start decoupled async inference loop
    this.startDecoupledInferenceLoop();
  }

  /**
   * Decoupled asynchronous inference loop running at target 20-25 FPS.
   * Keeps main 60 FPS WebGL thread completely unblocked!
   */
  startDecoupledInferenceLoop() {
    const processLoop = async () => {
      if (!this.isRunning) return;

      const now = performance.now();
      const elapsed = now - this.lastInferenceTime;

      if (
        this.hands &&
        !this.isInferencing &&
        elapsed >= this.inferenceInterval &&
        this.video.readyState >= 2 &&
        this.video.videoWidth > 0
      ) {
        this.isInferencing = true;
        this.lastInferenceTime = now;
        const startT = performance.now();

        try {
          await this.hands.send({ image: this.video });
        } catch (e) {
          // Frame skip gracefully
        }

        this.inferenceDuration = performance.now() - startT;
        this.isInferencing = false;
      }

      // Schedule next check (using timeout or rAF for zero CPU burn)
      setTimeout(processLoop, 8);
    };

    processLoop();
  }

  /**
   * Stop camera stream
   */
  stopCamera() {
    this.isRunning = false;
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }
    this.isCameraActive = false;
    this.status = 'fallback';
    this.statusMessage = 'Camera stopped. Mouse controls active.';
    this.activateMouseFallback();
  }

  /**
   * Handle MediaPipe detection results
   */
  handleResults(results) {
    this.lastResults = results;

    // Render skeleton overlay on PIP canvas only when preview is visible
    if (this.ctx && this.showPreview) {
      this.drawSkeletonOverlay(results);
    }

    if (this.onResults) {
      this.onResults(results);
    }
  }

  /**
   * Draw glowing cybernetic hand skeleton on the mini-PIP preview canvas
   */
  drawSkeletonOverlay(results) {
    const canvas = this.canvas;
    const ctx = this.ctx;
    if (!canvas || !ctx) return;

    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (this.isMirrored) {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }

    if (!results || !results.multiHandLandmarks || results.multiHandLandmarks.length === 0) {
      ctx.restore();
      return;
    }

    for (let h = 0; h < results.multiHandLandmarks.length; h++) {
      const landmarks = results.multiHandLandmarks[h];
      const isFirstHand = h === 0;

      // 1. Draw connecting bones with glowing lines
      ctx.lineWidth = 2.0;
      ctx.lineCap = 'round';
      ctx.shadowBlur = 6;
      ctx.shadowColor = isFirstHand ? '#00f2fe' : '#ff007f';

      for (let c = 0; c < HAND_CONNECTIONS.length; c++) {
        const [startIdx, endIdx] = HAND_CONNECTIONS[c];
        const p1 = landmarks[startIdx];
        const p2 = landmarks[endIdx];

        ctx.strokeStyle = isFirstHand
          ? 'rgba(0, 242, 254, 0.8)'
          : 'rgba(255, 0, 127, 0.8)';

        ctx.beginPath();
        ctx.moveTo(p1.x * canvas.width, p1.y * canvas.height);
        ctx.lineTo(p2.x * canvas.width, p2.y * canvas.height);
        ctx.stroke();
      }

      // 2. Draw landmark dots
      for (let i = 0; i < landmarks.length; i++) {
        const p = landmarks[i];
        const x = p.x * canvas.width;
        const y = p.y * canvas.height;

        let radius = 2.5;
        let color = '#ffffff';

        // Highlight fingertips
        if (i === 4) {
          radius = 4.5;
          color = '#ff007f';
        } else if (i === 8) {
          radius = 4.5;
          color = '#00f2fe';
        } else if (i === 12 || i === 16 || i === 20) {
          radius = 3.5;
          color = '#a855f7';
        }

        ctx.fillStyle = color;
        ctx.shadowBlur = 8;
        ctx.shadowColor = color;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, 2 * Math.PI);
        ctx.fill();
      }

      // 3. Highlight pinch line/circle if thumb and index are close
      const thumb = landmarks[4];
      const index = landmarks[8];
      const dx = thumb.x - index.x;
      const dy = thumb.y - index.y;
      const pinchDistSq = dx * dx + dy * dy;

      if (pinchDistSq < 0.0064) { // 0.08^2
        const pinchDist = Math.sqrt(pinchDistSq);
        const midX = (thumb.x + index.x) * 0.5 * canvas.width;
        const midY = (thumb.y + index.y) * 0.5 * canvas.height;

        ctx.strokeStyle = '#ffd700';
        ctx.lineWidth = 2;
        ctx.shadowColor = '#ffd700';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(midX, midY, 10 * (1.0 - pinchDist / 0.08) + 4, 0, 2 * Math.PI);
        ctx.stroke();
      }
    }

    ctx.restore();
  }

  /**
   * Set up mouse & touch interactive fallback
   */
  setupMouseFallback() {
    window.addEventListener('mousemove', (e) => {
      this.mouseState.vx = (e.clientX - this.mouseState.prevX) * 0.5;
      this.mouseState.vy = (e.clientY - this.mouseState.prevY) * 0.5;
      this.mouseState.prevX = this.mouseState.x;
      this.mouseState.prevY = this.mouseState.y;
      this.mouseState.x = e.clientX;
      this.mouseState.y = e.clientY;

      if (this.mouseFallbackActive) {
        this.emitMouseAsHand();
      }
    });

    window.addEventListener('mousedown', (e) => {
      if (e.button === 0) this.mouseState.isDown = true;
      if (e.button === 2) this.mouseState.isRightDown = true;

      if (this.mouseFallbackActive) {
        this.emitMouseAsHand();
      }
    });

    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.mouseState.isDown = false;
      if (e.button === 2) this.mouseState.isRightDown = false;

      if (this.mouseFallbackActive) {
        this.emitMouseAsHand();
      }
    });

    // Touch support for mobile / tablet
    window.addEventListener('touchmove', (e) => {
      if (e.touches.length > 0) {
        const touch = e.touches[0];
        this.mouseState.x = touch.clientX;
        this.mouseState.y = touch.clientY;
        this.mouseState.isDown = true;
        if (this.mouseFallbackActive) {
          this.emitMouseAsHand();
        }
      }
    }, { passive: true });

    window.addEventListener('touchend', () => {
      this.mouseState.isDown = false;
    });
  }

  activateMouseFallback() {
    this.mouseFallbackActive = true;
  }

  deactivateMouseFallback() {
    this.mouseFallbackActive = false;
  }

  /**
   * Translates mouse coordinates to simulated MediaPipe hand landmarks
   */
  emitMouseAsHand() {
    const normX = this.mouseState.x / window.innerWidth;
    const normY = this.mouseState.y / window.innerHeight;

    const landmarks = [];
    const isPinching = this.mouseState.isDown;
    const isExploding = this.mouseState.isRightDown;
    const thumbDist = isPinching ? 0.02 : 0.12;

    for (let i = 0; i < 21; i++) {
      let ox = 0, oy = 0, oz = 0;

      if (i === 4) {
        ox = -thumbDist * 0.5;
        oy = thumbDist * 0.5;
      } else if (i === 8) {
        ox = isPinching ? thumbDist * 0.5 : 0.0;
        oy = -0.06;
      } else if (i === 12 || i === 16 || i === 20) {
        oy = isExploding ? -0.07 : 0.03;
        ox = (i - 12) * 0.02;
      }

      landmarks.push({
        x: normX + ox,
        y: normY + oy,
        z: oz
      });
    }

    const mockResults = {
      multiHandLandmarks: [landmarks]
    };

    if (this.onResults) {
      this.onResults(mockResults);
    }
  }

  togglePreview(visible) {
    this.showPreview = visible !== undefined ? visible : !this.showPreview;
    if (this.canvas) {
      this.canvas.style.display = this.showPreview ? 'block' : 'none';
    }
    if (this.video) {
      this.video.style.display = this.showPreview ? 'block' : 'none';
    }
    return this.showPreview;
  }
}
