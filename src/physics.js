/**
 * GestureFlow 3D - Optimized Physics Engine & Force Fields
 * Highly vectorized particle dynamics with spring morphing, damping,
 * fast multi-frequency curl turbulence, squared-distance early exits,
 * and zero per-frame garbage collection.
 */

export class PhysicsEngine {
  constructor() {
    // Global simulation parameters
    this.springStrength = 0.045;   // Attraction to target shape
    this.damping = 0.88;          // Velocity drag
    this.noiseStrength = 0.18;    // Ambient curl turbulence
    this.noiseScale = 0.05;       // Spatial frequency
    this.forceMultiplier = 1.0;   // Master force slider
    this.sensitivity = 1.0;       // Gesture sensitivity
    
    // Time tracking
    this.time = 0;
  }

  /**
   * Update particle positions and velocities for one physics tick.
   * Optimized with squared-distance early exits, hoisted constants,
   * and fast trigonometric curl noise.
   */
  update(
    positions,
    velocities,
    targetPositions,
    count,
    gestureState,
    handData,
    dt = 0.016
  ) {
    this.time += dt;
    const t = this.time;
    const springK = this.springStrength;
    const damp = Math.pow(this.damping, dt * 60);
    const turbulence = this.noiseStrength * this.forceMultiplier;
    const nScale = this.noiseScale;

    // Extract gesture and hand details
    const gesture = gestureState ? gestureState.name : 'NO HAND DETECTED';
    const hasHand = handData && handData.hasHand;
    const hasTwoHands = handData && handData.hasTwoHands;

    // Hand positions in 3D scene space
    const handPos = (handData && handData.worldPosition) || { x: 0, y: 0, z: 0 };
    const indexTip = (handData && handData.indexTipWorld) || handPos;
    const pinchPoint = (handData && handData.pinchWorld) || handPos;
    const pinchDistance = handData ? handData.pinchDistance : 1.0;
    const handVelocity = (handData && handData.velocity) || { x: 0, y: 0, z: 0 };
    const handSpeed = Math.sqrt(
      handVelocity.x * handVelocity.x +
      handVelocity.y * handVelocity.y +
      handVelocity.z * handVelocity.z
    );

    // Two hands geometry
    const hand1Pos = (handData && handData.hand1World) || handPos;
    const hand2Pos = (handData && handData.hand2World) || handPos;
    const twoHandsDistance = handData ? handData.twoHandsDistance : 1.0;

    // Pre-calculate gesture radii and squared thresholds
    const sens = this.sensitivity;
    const forceMult = this.forceMultiplier;

    const blastRadius = 35.0 * sens;
    const blastRadiusSq = blastRadius * blastRadius;

    const attractRadius = 50.0 * sens;
    const attractRadiusSq = attractRadius * attractRadius;

    const pinchRadius = 45.0 * sens;
    const pinchRadiusSq = pinchRadius * pinchRadius;
    const pinchTightness = Math.max(0.1, 1.0 - Math.min(1.0, pinchDistance / 0.12));

    const beamRadius = 28.0 * sens;
    const beamRadiusSq = beamRadius * beamRadius;

    const swipeRadius = 40.0 * sens;
    const swipeRadiusSq = swipeRadius * swipeRadius;
    const isFastSwipe = hasHand && handSpeed > 0.8;

    // Pre-calculate two hands axis parameters
    let axisX = 0, axisY = 0, axisZ = 0, axisLen = 1, dirX = 0, dirY = 0, dirZ = 0;
    let scaleFactor = 1.0;
    if (hasTwoHands) {
      scaleFactor = Math.max(0.4, Math.min(3.0, twoHandsDistance * 2.2));
      axisX = hand2Pos.x - hand1Pos.x;
      axisY = hand2Pos.y - hand1Pos.y;
      axisZ = hand2Pos.z - hand1Pos.z;
      axisLen = Math.sqrt(axisX * axisX + axisY * axisY + axisZ * axisZ) + 0.001;
      dirX = axisX / axisLen;
      dirY = axisY / axisLen;
      dirZ = axisZ / axisLen;
    }

    // Time phases for fast turbulence
    const tPhase1 = t * 0.9;
    const tPhase2 = t * 0.7;
    const tPhase3 = t * 1.1;

    // Fast loop over all particles
    for (let i = 0; i < count; i++) {
      const idx = i * 3;
      const idxY = idx + 1;
      const idxZ = idx + 2;

      let px = positions[idx];
      let py = positions[idxY];
      let pz = positions[idxZ];

      let vx = velocities[idx];
      let vy = velocities[idxY];
      let vz = velocities[idxZ];

      let tx = targetPositions[idx];
      let ty = targetPositions[idxY];
      let tz = targetPositions[idxZ];

      // 1. If Two Hands detected, apply global dynamic scaling around origin
      if (hasTwoHands) {
        tx *= scaleFactor;
        ty *= scaleFactor;
        tz *= scaleFactor;
      }

      // 2. Spring force pulling particle to target formation
      let fx = (tx - px) * springK;
      let fy = (ty - py) * springK;
      let fz = (tz - pz) * springK;

      // 3. Fast Vectorized Harmonic Curl Noise (approximate fluid motion with zero memory allocation)
      if (turbulence > 0.001) {
        const nx = px * nScale;
        const ny = py * nScale;
        const nz = pz * nScale;

        // Multi-frequency divergence-free curl field
        const curlX = Math.sin(ny * 1.3 + tPhase1) + Math.cos(nz * 0.9 + tPhase2) * 0.5;
        const curlY = Math.sin(nz * 1.3 + tPhase2) + Math.cos(nx * 0.9 + tPhase3) * 0.5;
        const curlZ = Math.sin(nx * 1.3 + tPhase3) + Math.cos(ny * 0.9 + tPhase1) * 0.5;

        fx += curlX * turbulence;
        fy += curlY * turbulence;
        fz += curlZ * turbulence;
      }

      // 4. Gesture-Specific Force Fields with Squared-Distance Early Exits
      if (hasHand) {
        switch (gesture) {
          case 'OPEN PALM': {
            const dx = px - handPos.x;
            const dy = py - handPos.y;
            const dz = pz - handPos.z;
            const distSq = dx * dx + dy * dy + dz * dz;

            if (distSq < blastRadiusSq && distSq > 0.001) {
              const dist = Math.sqrt(distSq);
              const repelMag = ((blastRadius - dist) / blastRadius) * (2.4 * forceMult);
              const invDist = 1.0 / dist;
              fx += dx * invDist * repelMag;
              fy += dy * invDist * repelMag;
              fz += dz * invDist * repelMag;
            }
            // Gentle drift following palm movement
            fx += handVelocity.x * 0.18;
            fy += handVelocity.y * 0.18;
            fz += handVelocity.z * 0.18;
            break;
          }

          case 'FIST': {
            const dx = px - handPos.x;
            const dy = py - handPos.y;
            const dz = pz - handPos.z;
            const distSq = dx * dx + dy * dy + dz * dz;

            if (distSq < attractRadiusSq && distSq > 0.001) {
              const dist = Math.sqrt(distSq);
              const attractMag = (1.0 - dist / attractRadius) * (3.8 * forceMult);
              const invDist = 1.0 / dist;

              // Inward radial pull
              fx -= dx * invDist * attractMag;
              fy -= dy * invDist * attractMag;
              fz -= dz * invDist * attractMag;

              // Tangential rotational swirl
              const swirlSpeed = 1.6 * forceMult;
              fx += -dz * invDist * swirlSpeed;
              fz += dx * invDist * swirlSpeed;
            }
            break;
          }

          case 'PINCH': {
            const pDx = px - pinchPoint.x;
            const pDy = py - pinchPoint.y;
            const pDz = pz - pinchPoint.z;
            const pDistSq = pDx * pDx + pDy * pDy + pDz * pDz;

            if (pDistSq < pinchRadiusSq && pDistSq > 0.001) {
              const pDist = Math.sqrt(pDistSq);
              const pStrength = (handData && handData.pinchStrength !== undefined) ? handData.pinchStrength : pinchTightness;
              const singularityStrength = Math.pow(1.0 - pDist / pinchRadius, 1.6) * (5.6 * (0.25 + 0.75 * pStrength) * forceMult);
              const invDist = 1.0 / pDist;

              // Inward radial gravity pull to pinch singularity
              fx -= pDx * invDist * singularityStrength;
              fy -= pDy * invDist * singularityStrength;
              fz -= pDz * invDist * singularityStrength;

              // Accretion disk orbital vortex around pinch axis
              const swirlSpeed = (1.8 * (0.3 + 0.7 * pStrength)) * forceMult;
              fx += -pDz * invDist * swirlSpeed;
              fz += pDx * invDist * swirlSpeed;
            }
            break;
          }

          case 'POINT': {
            const tipDx = px - indexTip.x;
            const tipDy = py - indexTip.y;
            const tipDz = pz - indexTip.z;
            const tipDistSq = tipDx * tipDx + tipDy * tipDy + tipDz * tipDz;

            if (tipDistSq < beamRadiusSq && tipDistSq > 0.001) {
              const tipDist = Math.sqrt(tipDistSq);
              const beamPull = Math.pow(1.0 - tipDist / beamRadius, 2.0) * (3.2 * forceMult);
              const invDist = 1.0 / tipDist;

              fx -= tipDx * invDist * beamPull;
              fy -= tipDy * invDist * beamPull;
              fz -= tipDz * invDist * beamPull;

              // Vortex stream along fingertip
              fx += (handVelocity.x * 0.4 + Math.sin(t * 8 + i * 0.1) * 0.3) * forceMult;
              fy += (handVelocity.y * 0.4 + Math.cos(t * 8 + i * 0.1) * 0.3) * forceMult;
              fz += (handVelocity.z * 0.4) * forceMult;
            }
            break;
          }

          case 'TWO HANDS': {
            // Vector from hand1 to particle
            const h1pX = px - hand1Pos.x;
            const h1pY = py - hand1Pos.y;
            const h1pZ = pz - hand1Pos.z;

            // Projection onto axis
            const proj = h1pX * dirX + h1pY * dirY + h1pZ * dirZ;
            const normProj = proj / axisLen; // 0 at hand1, 1 at hand2

            if (normProj >= -0.2 && normProj <= 1.2) {
              const cX = hand1Pos.x + dirX * proj;
              const cY = hand1Pos.y + dirY * proj;
              const cZ = hand1Pos.z + dirZ * proj;

              const radX = px - cX;
              const radY = py - cY;
              const radZ = pz - cZ;
              const radDistSq = radX * radX + radY * radY + radZ * radZ;

              if (radDistSq < 625.0 && radDistSq > 0.001) { // 25^2 = 625
                const radDist = Math.sqrt(radDistSq);
                const tunnelPull = (1.0 - radDist / 25.0) * (2.0 * forceMult);
                const invRad = 1.0 / radDist;

                fx -= radX * invRad * tunnelPull;
                fy -= radY * invRad * tunnelPull;
                fz -= radZ * invRad * tunnelPull;

                // Swirl around connecting cylinder axis (dir x rad)
                const swirlX = dirY * radZ - dirZ * radY;
                const swirlY = dirZ * radX - dirX * radZ;
                const swirlZ = dirX * radY - dirY * radX;
                fx += swirlX * 1.5 * forceMult;
                fy += swirlY * 1.5 * forceMult;
                fz += swirlZ * 1.5 * forceMult;
              }
            }
            break;
          }

          default:
            break;
        }

        // 5. Fast Hand Movement / Swipe Wind Blast with Squared Distance Check
        if (isFastSwipe) {
          const dx = px - handPos.x;
          const dy = py - handPos.y;
          const dz = pz - handPos.z;
          const distSq = dx * dx + dy * dy + dz * dz;

          if (distSq < swipeRadiusSq) {
            const dist = Math.sqrt(distSq);
            const windPower = (1.0 - dist / swipeRadius) * (handSpeed * 0.4) * forceMult;
            fx += handVelocity.x * windPower;
            fy += handVelocity.y * windPower;
            fz += handVelocity.z * windPower;
          }
        }
      }

      // 6. Integrate velocity and position
      vx = (vx + fx * dt) * damp;
      vy = (vy + fy * dt) * damp;
      vz = (vz + fz * dt) * damp;

      px += vx * dt * 60;
      py += vy * dt * 60;
      pz += vz * dt * 60;

      // Write back to typed arrays
      positions[idx] = px;
      positions[idxY] = py;
      positions[idxZ] = pz;

      velocities[idx] = vx;
      velocities[idxY] = vy;
      velocities[idxZ] = vz;
    }
  }
}
