/**
 * GestureFlow 3D - Hand Gesture Recognition & Classification
 * Uses 21 3D MediaPipe Hand Landmarks to detect gestures, compute velocities,
 * and provide temporally smoothed confidence-rated gesture states.
 */

// MediaPipe Landmark Index Constants
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

export class GestureController {
  constructor() {
    // History & smoothing buffers
    this.prevLandmarks = null;
    this.prevTimestamp = 0;
    this.smoothedVelocity = { x: 0, y: 0, z: 0 };
    this.smoothedPalm = { x: 0, y: 0, z: 0 };
    this.smoothedPinch = { x: 0, y: 0, z: 0 };
    this.smoothedIndexTip = { x: 0, y: 0, z: 0 };
    this.smoothedHand1 = { x: 0, y: 0, z: 0 };
    this.smoothedHand2 = { x: 0, y: 0, z: 0 };
    
    // Temporal gesture confidence accumulator
    this.currentGesture = 'NO HAND DETECTED';
    this.gestureConfidence = 0;
    this.gestureCandidate = 'NO HAND DETECTED';
    this.candidateFrames = 0;
    this.requiredHoldFrames = 3; // 3 frames debounce to prevent UI flickering

    // Velocity history for fast swipe detection
    this.velocityMagnitude = 0;

    // Gesture definitions for UI display
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
        description: 'High-density gravitational attraction at pinch point'
      },
      'POINT': {
        icon: '👉',
        title: 'Index Beam',
        description: 'High-energy particle tractor stream following fingertip'
      },
      'TWO HANDS': {
        icon: '🙌',
        title: 'Two Hands Interplay',
        description: 'Dual-hand particle scaling and connective helical tunnel'
      },
      'FAST SWIPE': {
        icon: '💨',
        title: 'Kinetic Swipe',
        description: 'Directional shockwave turbulence from rapid hand velocity'
      },
      'NO HAND DETECTED': {
        icon: '✨',
        title: 'Ambient Mode',
        description: 'Smooth particle drift & interactive mouse/touch fallback'
      }
    };
  }

  /**
   * Euclidean distance between two 3D landmarks
   */
  dist3D(p1, p2) {
    const dx = p1.x - p2.x;
    const dy = p1.y - p2.y;
    const dz = (p1.z || 0) - (p2.z || 0);
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  /**
   * Convert normalized camera coordinates [0..1] to 3D World space coordinates
   */
  mapToWorldSpace(normPoint, depth = 35) {
    // Camera is mirrored horizontally: x in [0..1] -> [-X, +X]
    const worldX = (0.5 - normPoint.x) * 55;
    const worldY = (0.5 - normPoint.y) * 40;
    const worldZ = ((normPoint.z || 0) * -45) + (depth - 35);
    return { x: worldX, y: worldY, z: worldZ };
  }

  /**
   * Calculate palm center from key hand joints
   */
  calculatePalmCenter(landmarks) {
    const L = HAND_LANDMARKS;
    const indices = [L.WRIST, L.INDEX_MCP, L.MIDDLE_MCP, L.RING_MCP, L.PINKY_MCP];
    let sumX = 0, sumY = 0, sumZ = 0;
    for (const idx of indices) {
      sumX += landmarks[idx].x;
      sumY += landmarks[idx].y;
      sumZ += landmarks[idx].z || 0;
    }
    return {
      x: sumX / indices.length,
      y: sumY / indices.length,
      z: sumZ / indices.length
    };
  }

  /**
   * Check if individual fingers are extended (open) vs curled (closed)
   */
  getFingerStates(landmarks) {
    const L = HAND_LANDMARKS;
    const wrist = landmarks[L.WRIST];

    // Distance of fingertips and PIP joints to wrist
    const indexTipDist = this.dist3D(landmarks[L.INDEX_TIP], wrist);
    const indexPipDist = this.dist3D(landmarks[L.INDEX_PIP], wrist);
    const indexExtended = indexTipDist > indexPipDist * 1.15;

    const middleTipDist = this.dist3D(landmarks[L.MIDDLE_TIP], wrist);
    const middlePipDist = this.dist3D(landmarks[L.MIDDLE_PIP], wrist);
    const middleExtended = middleTipDist > middlePipDist * 1.15;

    const ringTipDist = this.dist3D(landmarks[L.RING_TIP], wrist);
    const ringPipDist = this.dist3D(landmarks[L.RING_PIP], wrist);
    const ringExtended = ringTipDist > ringPipDist * 1.15;

    const pinkyTipDist = this.dist3D(landmarks[L.PINKY_TIP], wrist);
    const pinkyPipDist = this.dist3D(landmarks[L.PINKY_PIP], wrist);
    const pinkyExtended = pinkyTipDist > pinkyPipDist * 1.15;

    // Thumb extension: distance between thumb tip and pinky MCP
    const thumbTipDistToPinky = this.dist3D(landmarks[L.THUMB_TIP], landmarks[L.PINKY_MCP]);
    const thumbMcpDistToPinky = this.dist3D(landmarks[L.THUMB_MCP], landmarks[L.PINKY_MCP]);
    const thumbExtended = thumbTipDistToPinky > thumbMcpDistToPinky * 1.1;

    // Pinch distance between thumb tip and index tip
    const pinchDist = this.dist3D(landmarks[L.THUMB_TIP], landmarks[L.INDEX_TIP]);

    return {
      thumb: thumbExtended,
      index: indexExtended,
      middle: middleExtended,
      ring: ringExtended,
      pinky: pinkyExtended,
      pinchDistance: pinchDist,
      extendedCount: (thumbExtended ? 1 : 0) + (indexExtended ? 1 : 0) + (middleExtended ? 1 : 0) + (ringExtended ? 1 : 0) + (pinkyExtended ? 1 : 0)
    };
  }

  /**
   * Process raw MediaPipe results for current frame
   */
  process(results, timestamp = performance.now()) {
    const dt = Math.max(0.001, (timestamp - this.prevTimestamp) / 1000);
    this.prevTimestamp = timestamp;

    const multiHandLandmarks = results && results.multiHandLandmarks;
    const handCount = multiHandLandmarks ? multiHandLandmarks.length : 0;

    if (handCount === 0) {
      this.smoothedVelocity = { x: 0, y: 0, z: 0 };
      this.velocityMagnitude = 0;
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
      const hand1Landmarks = multiHandLandmarks[0];
      const hand2Landmarks = multiHandLandmarks[1];

      const palm1 = this.calculatePalmCenter(hand1Landmarks);
      const palm2 = this.calculatePalmCenter(hand2Landmarks);

      const wHand1 = this.mapToWorldSpace(palm1);
      const wHand2 = this.mapToWorldSpace(palm2);

      // Smooth positions
      const alpha = 0.35;
      this.smoothedHand1.x += (wHand1.x - this.smoothedHand1.x) * alpha;
      this.smoothedHand1.y += (wHand1.y - this.smoothedHand1.y) * alpha;
      this.smoothedHand1.z += (wHand1.z - this.smoothedHand1.z) * alpha;

      this.smoothedHand2.x += (wHand2.x - this.smoothedHand2.x) * alpha;
      this.smoothedHand2.y += (wHand2.y - this.smoothedHand2.y) * alpha;
      this.smoothedHand2.z += (wHand2.z - this.smoothedHand2.z) * alpha;

      const normDist = this.dist3D(palm1, palm2);

      this.updateSmoothedGesture('TWO HANDS', 0.95);

      return {
        hasHand: true,
        hasTwoHands: true,
        gesture: this.getGestureState(),
        handData: {
          hasHand: true,
          hasTwoHands: true,
          hand1World: this.smoothedHand1,
          hand2World: this.smoothedHand2,
          twoHandsDistance: normDist,
          worldPosition: {
            x: (this.smoothedHand1.x + this.smoothedHand2.x) * 0.5,
            y: (this.smoothedHand1.y + this.smoothedHand2.y) * 0.5,
            z: (this.smoothedHand1.z + this.smoothedHand2.z) * 0.5
          },
          velocity: { x: 0, y: 0, z: 0 },
          pinchDistance: 1.0
        }
      };
    }

    // 2. Single Hand Tracking
    const landmarks = multiHandLandmarks[0];
    const L = HAND_LANDMARKS;
    const palm = this.calculatePalmCenter(landmarks);
    const wPalm = this.mapToWorldSpace(palm);

    // Calculate velocity
    if (this.prevLandmarks) {
      const prevPalm = this.calculatePalmCenter(this.prevLandmarks);
      const prevWPalm = this.mapToWorldSpace(prevPalm);
      const rawVx = (wPalm.x - prevWPalm.x) / dt;
      const rawVy = (wPalm.y - prevWPalm.y) / dt;
      const rawVz = (wPalm.z - prevWPalm.z) / dt;

      // Exponential smoothing for velocity
      const vAlpha = 0.4;
      this.smoothedVelocity.x += (rawVx - this.smoothedVelocity.x) * vAlpha;
      this.smoothedVelocity.y += (rawVy - this.smoothedVelocity.y) * vAlpha;
      this.smoothedVelocity.z += (rawVz - this.smoothedVelocity.z) * vAlpha;

      this.velocityMagnitude = Math.sqrt(
        this.smoothedVelocity.x * this.smoothedVelocity.x +
        this.smoothedVelocity.y * this.smoothedVelocity.y +
        this.smoothedVelocity.z * this.smoothedVelocity.z
      );
    }
    this.prevLandmarks = landmarks;

    // Smooth palm position
    const pAlpha = 0.35;
    this.smoothedPalm.x += (wPalm.x - this.smoothedPalm.x) * pAlpha;
    this.smoothedPalm.y += (wPalm.y - this.smoothedPalm.y) * pAlpha;
    this.smoothedPalm.z += (wPalm.z - this.smoothedPalm.z) * pAlpha;

    // Index fingertip position
    const wIndex = this.mapToWorldSpace(landmarks[L.INDEX_TIP]);
    this.smoothedIndexTip.x += (wIndex.x - this.smoothedIndexTip.x) * pAlpha;
    this.smoothedIndexTip.y += (wIndex.y - this.smoothedIndexTip.y) * pAlpha;
    this.smoothedIndexTip.z += (wIndex.z - this.smoothedIndexTip.z) * pAlpha;

    // Pinch point (midpoint between thumb and index tips)
    const pinchMid = {
      x: (landmarks[L.THUMB_TIP].x + landmarks[L.INDEX_TIP].x) * 0.5,
      y: (landmarks[L.THUMB_TIP].y + landmarks[L.INDEX_TIP].y) * 0.5,
      z: ((landmarks[L.THUMB_TIP].z || 0) + (landmarks[L.INDEX_TIP].z || 0)) * 0.5
    };
    const wPinch = this.mapToWorldSpace(pinchMid);
    this.smoothedPinch.x += (wPinch.x - this.smoothedPinch.x) * pAlpha;
    this.smoothedPinch.y += (wPinch.y - this.smoothedPinch.y) * pAlpha;
    this.smoothedPinch.z += (wPinch.z - this.smoothedPinch.z) * pAlpha;

    // Analyze finger postures
    const fingers = this.getFingerStates(landmarks);
    let detectedGesture = 'OPEN PALM';
    let rawConfidence = 0.8;

    // Classifier decision tree:
    if (this.velocityMagnitude > 45.0) {
      // High speed swipe gesture
      detectedGesture = 'FAST SWIPE';
      rawConfidence = Math.min(1.0, this.velocityMagnitude / 70.0);
    } else if (fingers.pinchDistance < 0.075) {
      // Pinch detected
      detectedGesture = 'PINCH';
      rawConfidence = Math.min(1.0, 1.0 - (fingers.pinchDistance / 0.075));
    } else if (fingers.index && !fingers.middle && !fingers.ring && !fingers.pinky) {
      // Pointing with index finger
      detectedGesture = 'POINT';
      rawConfidence = 0.9;
    } else if (fingers.extendedCount <= 1 && fingers.pinchDistance > 0.08) {
      // Closed fist
      detectedGesture = 'FIST';
      rawConfidence = 0.92;
    } else if (fingers.extendedCount >= 4) {
      // Open palm
      detectedGesture = 'OPEN PALM';
      rawConfidence = 0.95;
    } else {
      detectedGesture = 'OPEN PALM';
      rawConfidence = 0.6;
    }

    this.updateSmoothedGesture(detectedGesture, rawConfidence);

    // Calculate hand tilt for scene rotation
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
        worldPosition: this.smoothedPalm,
        indexTipWorld: this.smoothedIndexTip,
        pinchWorld: this.smoothedPinch,
        pinchDistance: fingers.pinchDistance,
        velocity: this.smoothedVelocity,
        speed: this.velocityMagnitude,
        tilt: { x: tiltX, y: tiltY },
        normalizedPalm: palm
      }
    };
  }

  /**
   * Temporal smoothing with hysteresis to prevent gesture flickering
   */
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
