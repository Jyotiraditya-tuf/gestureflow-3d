/**
 * GestureFlow 3D - Advanced Gesture Recognition & State Controller
 * High-performance 3D hand landmark analysis with centralized configuration,
 * horizontal swipe formation switching, two-hand angular orientation,
 * continuous pinch gravity strength, and temporal hysteresis.
 */

export const HAND_LANDMARKS = {
  WRIST: 0,
  THUMB_CMC: 1,
  THUMB_MCP: 2,
  THUMB_IP: 3,
  THUMB_TIP: 4,
  INDEX_MCP: 5,
  INDEX_PIP: 6,
  INDEX_DIP: 7,
  INDEX_TIP: 8,
  MIDDLE_MCP: 9,
  MIDDLE_PIP: 10,
  MIDDLE_DIP: 11,
  MIDDLE_TIP: 12,
  RING_MCP: 13,
  RING_PIP: 14,
  RING_DIP: 15,
  RING_TIP: 16,
  PINKY_MCP: 17,
  PINKY_PIP: 18,
  PINKY_DIP: 19,
  PINKY_TIP: 20
};

/**
 * Centralized Gesture & Interaction Thresholds Configuration
 */
export const GESTURE_CONFIG = {
  SWIPE_VELOCITY_THRESHOLD: 32.0,      // World units/sec for horizontal swipe
  SWIPE_COOLDOWN: 650,                 // Cooldown in ms between swipe triggers
  PINCH_MIN_DISTANCE: 0.025,           // Distance for 100% pinch strength
  PINCH_MAX_DISTANCE: 0.082,           // Distance for 0% pinch strength
  GESTURE_STABILITY_FRAMES: 3,         // Hysteresis frame window for smooth transitions
  ROTATION_SENSITIVITY: 1.4,           // Two-hand angular rotation multiplier
  GRAVITY_STRENGTH: 4.8                // Base gravity multiplier
};

export class GestureController {
  constructor() {
    this.prevLandmarks = null;
    this.prevTimestamp = 0;
    
    // Smoothed spatial coordinates
    this.smoothedVelocity = { x: 0, y: 0, z: 0 };
    this.smoothedPalm = { x: 0, y: 0, z: 0 };
    this.smoothedPinch = { x: 0, y: 0, z: 0 };
    this.smoothedIndexTip = { x: 0, y: 0, z: 0 };
    this.smoothedHand1 = { x: 0, y: 0, z: 0 };
    this.smoothedHand2 = { x: 0, y: 0, z: 0 };
    
    // Temporal gesture confidence accumulator & hysteresis
    this.currentGesture = 'NO HAND DETECTED';
    this.gestureConfidence = 0;
    this.gestureCandidate = 'NO HAND DETECTED';
    this.candidateFrames = 0;
    this.requiredHoldFrames = GESTURE_CONFIG.GESTURE_STABILITY_FRAMES;

    this.velocityMagnitude = 0;

    // Swipe gesture debouncing & event state
    this.lastSwipeTime = 0;
    this.pendingSwipeEvent = null;

    // Two-hand angular rotation state
    this.prevTwoHandAngle = null;
    this.currentTwoHandAngle = 0;
    this.twoHandAngleDelta = 0;

    this.gestureMeta = {
      'OPEN PALM': {
        icon: '✋',
        title: 'Open Palm',
        description: 'Spherical expansion force field; shifts particle center'
      },
      'FIST': {
        icon: '✊',
        title: 'Closed Fist',
        description: 'Gravitational black hole compression with vortex spin'
      },
      'PINCH': {
        icon: '🤏',
        title: 'Pinch Singularity',
        description: 'Localized gravitational well scaling with pinch tightness'
      },
      'POINT': {
        icon: '👉',
        title: 'Index Beam',
        description: 'High-energy particle tractor stream following fingertip'
      },
      'TWO HANDS': {
        icon: '🙌',
        title: 'Two Hands Interplay',
        description: 'Dual-hand scaling & interactive universe twist rotation'
      },
      'FAST SWIPE': {
        icon: '💨',
        title: 'Kinetic Swipe',
        description: 'Horizontal wave switches 3D particle formations'
      },
      'NO HAND DETECTED': {
        icon: '✨',
        title: 'Ambient Mode',
        description: 'Smooth particle drift & interactive mouse/touch fallback'
      }
    };
  }

  dist3DSq(p1, p2) {
    const dx = p1.x - p2.x;
    const dy = p1.y - p2.y;
    const dz = (p1.z || 0) - (p2.z || 0);
    return dx * dx + dy * dy + dz * dz;
  }

  mapToWorldSpace(normPoint, depth = 35) {
    const worldX = (0.5 - normPoint.x) * 55;
    const worldY = (0.5 - normPoint.y) * 40;
    const worldZ = ((normPoint.z || 0) * -45) + (depth - 35);
    return { x: worldX, y: worldY, z: worldZ };
  }

  calculatePalmCenter(landmarks) {
    const L = HAND_LANDMARKS;
    const p0 = landmarks[L.WRIST];
    const p5 = landmarks[L.INDEX_MCP];
    const p9 = landmarks[L.MIDDLE_MCP];
    const p13 = landmarks[L.RING_MCP];
    const p17 = landmarks[L.PINKY_MCP];

    return {
      x: (p0.x + p5.x + p9.x + p13.x + p17.x) * 0.2,
      y: (p0.y + p5.y + p9.y + p13.y + p17.y) * 0.2,
      z: ((p0.z || 0) + (p5.z || 0) + (p9.z || 0) + (p13.z || 0) + (p17.z || 0)) * 0.2
    };
  }

  getFingerStates(landmarks) {
    const L = HAND_LANDMARKS;
    const wrist = landmarks[L.WRIST];

    // Using squared distances: tipDistSq > pipDistSq * 1.32
    const indexExtended = this.dist3DSq(landmarks[L.INDEX_TIP], wrist) > this.dist3DSq(landmarks[L.INDEX_PIP], wrist) * 1.32;
    const middleExtended = this.dist3DSq(landmarks[L.MIDDLE_TIP], wrist) > this.dist3DSq(landmarks[L.MIDDLE_PIP], wrist) * 1.32;
    const ringExtended = this.dist3DSq(landmarks[L.RING_TIP], wrist) > this.dist3DSq(landmarks[L.RING_PIP], wrist) * 1.32;
    const pinkyExtended = this.dist3DSq(landmarks[L.PINKY_TIP], wrist) > this.dist3DSq(landmarks[L.PINKY_PIP], wrist) * 1.32;

    const thumbTipDistSq = this.dist3DSq(landmarks[L.THUMB_TIP], landmarks[L.PINKY_MCP]);
    const thumbMcpDistSq = this.dist3DSq(landmarks[L.THUMB_MCP], landmarks[L.PINKY_MCP]);
    const thumbExtended = thumbTipDistSq > thumbMcpDistSq * 1.21;

    const pinchDistSq = this.dist3DSq(landmarks[L.THUMB_TIP], landmarks[L.INDEX_TIP]);
    const pinchDist = Math.sqrt(pinchDistSq);

    const extCount = (thumbExtended ? 1 : 0) + (indexExtended ? 1 : 0) + (middleExtended ? 1 : 0) + (ringExtended ? 1 : 0) + (pinkyExtended ? 1 : 0);

    // Calculate continuous pinch strength (0.0 = open, 1.0 = tightly pinched)
    const { PINCH_MIN_DISTANCE, PINCH_MAX_DISTANCE } = GESTURE_CONFIG;
    const pinchStrength = Math.max(0, Math.min(1, (PINCH_MAX_DISTANCE - pinchDist) / (PINCH_MAX_DISTANCE - PINCH_MIN_DISTANCE)));

    return {
      thumb: thumbExtended,
      index: indexExtended,
      middle: middleExtended,
      ring: ringExtended,
      pinky: pinkyExtended,
      pinchDistance: pinchDist,
      pinchStrength: pinchStrength,
      extendedCount: extCount
    };
  }

  process(results, timestamp = performance.now()) {
    const dt = Math.max(0.001, (timestamp - this.prevTimestamp) / 1000);
    this.prevTimestamp = timestamp;

    const multiHandLandmarks = results && results.multiHandLandmarks;
    const handCount = multiHandLandmarks ? multiHandLandmarks.length : 0;

    // Reset transient swipe event for this frame
    let swipeEvent = null;

    if (handCount === 0) {
      this.smoothedVelocity.x = 0;
      this.smoothedVelocity.y = 0;
      this.smoothedVelocity.z = 0;
      this.velocityMagnitude = 0;
      this.prevTwoHandAngle = null;
      this.twoHandAngleDelta = 0;
      this.updateSmoothedGesture('NO HAND DETECTED', 1.0);
      return {
        hasHand: false,
        hasTwoHands: false,
        gesture: this.getGestureState(),
        handData: null
      };
    }

    // 1. Two Hands Detected
    if (handCount >= 2) {
      const palm1 = this.calculatePalmCenter(multiHandLandmarks[0]);
      const palm2 = this.calculatePalmCenter(multiHandLandmarks[1]);

      const wHand1 = this.mapToWorldSpace(palm1);
      const wHand2 = this.mapToWorldSpace(palm2);

      const alpha = 0.35;
      this.smoothedHand1.x += (wHand1.x - this.smoothedHand1.x) * alpha;
      this.smoothedHand1.y += (wHand1.y - this.smoothedHand1.y) * alpha;
      this.smoothedHand1.z += (wHand1.z - this.smoothedHand1.z) * alpha;

      this.smoothedHand2.x += (wHand2.x - this.smoothedHand2.x) * alpha;
      this.smoothedHand2.y += (wHand2.y - this.smoothedHand2.y) * alpha;
      this.smoothedHand2.z += (wHand2.z - this.smoothedHand2.z) * alpha;

      const normDist = Math.sqrt(this.dist3DSq(palm1, palm2));

      // Calculate angle between both hands in XY screen space
      const currentAngle = Math.atan2(this.smoothedHand2.y - this.smoothedHand1.y, this.smoothedHand2.x - this.smoothedHand1.x);
      this.currentTwoHandAngle = currentAngle;

      if (this.prevTwoHandAngle !== null) {
        let diff = currentAngle - this.prevTwoHandAngle;
        // Unwrap angular discontinuity
        if (diff > Math.PI) diff -= Math.PI * 2;
        if (diff < -Math.PI) diff += Math.PI * 2;
        this.twoHandAngleDelta = diff * GESTURE_CONFIG.ROTATION_SENSITIVITY;
      } else {
        this.twoHandAngleDelta = 0;
      }
      this.prevTwoHandAngle = currentAngle;

      this.updateSmoothedGesture('TWO HANDS', 0.95);

      return {
        hasHand: true,
        hasTwoHands: true,
        gesture: this.getGestureState(),
        handData: {
          hasHand: true,
          hasTwoHands: true,
          handCount: 2,
          hand1World: this.smoothedHand1,
          hand2World: this.smoothedHand2,
          twoHandsDistance: normDist,
          twoHandAngle: this.currentTwoHandAngle,
          twoHandAngleDelta: this.twoHandAngleDelta,
          worldPosition: {
            x: (this.smoothedHand1.x + this.smoothedHand2.x) * 0.5,
            y: (this.smoothedHand1.y + this.smoothedHand2.y) * 0.5,
            z: (this.smoothedHand1.z + this.smoothedHand2.z) * 0.5
          },
          velocity: { x: 0, y: 0, z: 0 },
          speed: 0,
          pinchDistance: 1.0,
          pinchStrength: 0.0,
          swipeEvent: null
        }
      };
    }

    // Reset two hand tracking state when 1 hand
    this.prevTwoHandAngle = null;
    this.twoHandAngleDelta = 0;

    // 2. Single Hand Tracking
    const landmarks = multiHandLandmarks[0];
    const L = HAND_LANDMARKS;
    const palm = this.calculatePalmCenter(landmarks);
    const wPalm = this.mapToWorldSpace(palm);

    if (this.prevLandmarks) {
      const prevPalm = this.calculatePalmCenter(this.prevLandmarks);
      const prevWPalm = this.mapToWorldSpace(prevPalm);
      const rawVx = (wPalm.x - prevWPalm.x) / dt;
      const rawVy = (wPalm.y - prevWPalm.y) / dt;
      const rawVz = (wPalm.z - prevWPalm.z) / dt;

      const vAlpha = 0.42;
      this.smoothedVelocity.x += (rawVx - this.smoothedVelocity.x) * vAlpha;
      this.smoothedVelocity.y += (rawVy - this.smoothedVelocity.y) * vAlpha;
      this.smoothedVelocity.z += (rawVz - this.smoothedVelocity.z) * vAlpha;

      this.velocityMagnitude = Math.sqrt(
        this.smoothedVelocity.x * this.smoothedVelocity.x +
        this.smoothedVelocity.y * this.smoothedVelocity.y +
        this.smoothedVelocity.z * this.smoothedVelocity.z
      );

      // --- ADVANCED HORIZONTAL SWIPE DETECTION ---
      const absVx = Math.abs(this.smoothedVelocity.x);
      const absVy = Math.abs(this.smoothedVelocity.y);
      const isSwipeSpeed = absVx > GESTURE_CONFIG.SWIPE_VELOCITY_THRESHOLD;
      const isHorizontalDominant = absVx > absVy * 1.25;
      const isCooldownElapsed = (timestamp - this.lastSwipeTime) > GESTURE_CONFIG.SWIPE_COOLDOWN;

      if (isSwipeSpeed && isHorizontalDominant && isCooldownElapsed) {
        const direction = this.smoothedVelocity.x > 0 ? 'right' : 'left';
        swipeEvent = {
          direction,
          velocity: this.smoothedVelocity.x,
          speed: this.velocityMagnitude,
          timestamp
        };
        this.lastSwipeTime = timestamp;
      }
    }
    this.prevLandmarks = landmarks;

    const pAlpha = 0.35;
    this.smoothedPalm.x += (wPalm.x - this.smoothedPalm.x) * pAlpha;
    this.smoothedPalm.y += (wPalm.y - this.smoothedPalm.y) * pAlpha;
    this.smoothedPalm.z += (wPalm.z - this.smoothedPalm.z) * pAlpha;

    const wIndex = this.mapToWorldSpace(landmarks[L.INDEX_TIP]);
    this.smoothedIndexTip.x += (wIndex.x - this.smoothedIndexTip.x) * pAlpha;
    this.smoothedIndexTip.y += (wIndex.y - this.smoothedIndexTip.y) * pAlpha;
    this.smoothedIndexTip.z += (wIndex.z - this.smoothedIndexTip.z) * pAlpha;

    const pinchMid = {
      x: (landmarks[L.THUMB_TIP].x + landmarks[L.INDEX_TIP].x) * 0.5,
      y: (landmarks[L.THUMB_TIP].y + landmarks[L.INDEX_TIP].y) * 0.5,
      z: ((landmarks[L.THUMB_TIP].z || 0) + (landmarks[L.INDEX_TIP].z || 0)) * 0.5
    };
    const wPinch = this.mapToWorldSpace(pinchMid);
    this.smoothedPinch.x += (wPinch.x - this.smoothedPinch.x) * pAlpha;
    this.smoothedPinch.y += (wPinch.y - this.smoothedPinch.y) * pAlpha;
    this.smoothedPinch.z += (wPinch.z - this.smoothedPinch.z) * pAlpha;

    const fingers = this.getFingerStates(landmarks);
    let detectedGesture = 'OPEN PALM';
    let rawConfidence = 0.8;

    if (this.velocityMagnitude > 40.0) {
      detectedGesture = 'FAST SWIPE';
      rawConfidence = Math.min(1.0, this.velocityMagnitude / 65.0);
    } else if (fingers.pinchStrength > 0.05 || fingers.pinchDistance < GESTURE_CONFIG.PINCH_MAX_DISTANCE) {
      detectedGesture = 'PINCH';
      rawConfidence = Math.max(0.7, fingers.pinchStrength);
    } else if (fingers.index && !fingers.middle && !fingers.ring && !fingers.pinky) {
      detectedGesture = 'POINT';
      rawConfidence = 0.9;
    } else if (fingers.extendedCount <= 1 && fingers.pinchDistance > GESTURE_CONFIG.PINCH_MAX_DISTANCE) {
      detectedGesture = 'FIST';
      rawConfidence = 0.92;
    } else if (fingers.extendedCount >= 4) {
      detectedGesture = 'OPEN PALM';
      rawConfidence = 0.95;
    } else {
      detectedGesture = 'OPEN PALM';
      rawConfidence = 0.65;
    }

    this.updateSmoothedGesture(detectedGesture, rawConfidence);

    const wrist = landmarks[L.WRIST];
    const middleMcp = landmarks[L.MIDDLE_MCP];
    const tiltX = (middleMcp.x - wrist.x);
    const tiltY = (middleMcp.y - wrist.y);

    return {
      hasHand: true,
      hasTwoHands: false,
      gesture: this.getGestureState(),
      handData: {
        hasHand: true,
        hasTwoHands: false,
        handCount: 1,
        worldPosition: this.smoothedPalm,
        indexTipWorld: this.smoothedIndexTip,
        pinchWorld: this.smoothedPinch,
        pinchDistance: fingers.pinchDistance,
        pinchStrength: fingers.pinchStrength,
        velocity: this.smoothedVelocity,
        speed: this.velocityMagnitude,
        tilt: { x: tiltX, y: tiltY },
        normalizedPalm: palm,
        swipeEvent: swipeEvent,
        twoHandsDistance: 1.0,
        twoHandAngle: 0,
        twoHandAngleDelta: 0
      }
    };
  }

  updateSmoothedGesture(detected, confidence) {
    if (detected === this.gestureCandidate) {
      this.candidateFrames++;
      if (this.candidateFrames >= this.requiredHoldFrames) {
        this.currentGesture = detected;
        this.gestureConfidence = confidence;
      }
    } else {
      this.gestureCandidate = detected;
      this.candidateFrames = 1;
    }
  }

  getGestureState() {
    const meta = this.gestureMeta[this.currentGesture] || this.gestureMeta['NO HAND DETECTED'];
    return {
      name: this.currentGesture,
      confidence: this.gestureConfidence,
      icon: meta.icon,
      title: meta.title,
      description: meta.description
    };
  }
}

