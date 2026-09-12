/**
 * GestureFlow 3D - Physics Engine & Force Fields
 * Lightweight, high-performance particle dynamics with spring morphing,
 * damping, 3D curl-noise turbulence, and gesture force fields.
 */

// Simple fast 3D Simplex-like Noise generator for turbulence without external deps
class FastNoise3D {
  constructor(seed = 1337) {
    this.p = new Uint8Array(512);
    const permutation = new Uint8Array(256);
    for (let i = 0; i < 256; i++) permutation[i] = i;
    
    // Shuffle with seed
    let s = seed;
    for (let i = 255; i > 0; i--) {
      s = (s * 1664525 + 1013904223) & 0xffffffff;
      const j = Math.abs(s) % (i + 1);
      const temp = permutation[i];
      permutation[i] = permutation[j];
      permutation[j] = temp;
    }
    for (let i = 0; i < 512; i++) {
      this.p[i] = permutation[i & 255];
    }
  }

  // Fast hash-based smooth noise
  noise(x, y, z) {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    const Z = Math.floor(z) & 255;

    const u = x - Math.floor(x);
    const v = y - Math.floor(y);
    const w = z - Math.floor(z);

    // Fade curves
    const fx = u * u * u * (u * (u * 6 - 15) + 10);
    const fy = v * v * v * (v * (v * 6 - 15) + 10);
    const fz = w * w * w * (w * (w * 6 - 15) + 10);

    const A = this.p[X] + Y;
    const AA = this.p[A] + Z;
    const AB = this.p[A + 1] + Z;
    const B = this.p[X + 1] + Y;
    const BA = this.p[B] + Z;
    const BB = this.p[B + 1] + Z;

    const grad = (hash, x, y, z) => {
      const h = hash & 15;
      const u = h < 8 ? x : y;
      const v = h < 4 ? y : h === 12 || h === 14 ? x : z;
      return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
    };

    const l1 = grad(this.p[AA], u, v, w) * (1 - fx) + grad(this.p[BA], u - 1, v, w) * fx;
    const l2 = grad(this.p[AB], u, v - 1, w) * (1 - fx) + grad(this.p[BB], u - 1, v - 1, w) * fx;
    const l3 = grad(this.p[AA + 1], u, v, w - 1) * (1 - fx) + grad(this.p[BA + 1], u - 1, v, w - 1) * fx;
    const l4 = grad(this.p[AB + 1], u, v - 1, w - 1) * (1 - fx) + grad(this.p[BB + 1], u - 1, v - 1, w - 1) * fx;

    const y1 = l1 * (1 - fy) + l2 * fy;
    const y2 = l3 * (1 - fy) + l4 * fy;

    return y1 * (1 - fz) + y2 * fz;
  }

  // 3D Curl of noise (incompressible fluid field)
  curl(x, y, z, eps = 0.1) {
    const n1 = this.noise(x, y + eps, z);
    const n2 = this.noise(x, y - eps, z);
    const n3 = this.noise(x, y, z + eps);
    const n4 = this.noise(x, y, z - eps);
    const n5 = this.noise(x + eps, y, z);
    const n6 = this.noise(x - eps, y, z);

    const dFdy = (n1 - n2) / (2 * eps);
    const dFdz = (n3 - n4) / (2 * eps);
    const dFdx = (n5 - n6) / (2 * eps);

    return {
      x: dFdy - dFdz,
      y: dFdz - dFdx,
      z: dFdx - dFdy
    };
  }
}

export class PhysicsEngine {
  constructor() {
    this.noiseGen = new FastNoise3D(42);
    
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
   * Update particle positions and velocities for one physics tick
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
        const scaleFactor = Math.max(0.4, Math.min(3.0, twoHandsDistance * 2.2));
        tx *= scaleFactor;
        ty *= scaleFactor;
        tz *= scaleFactor;
      }

      // 2. Spring force pulling particle to target formation
      let fx = (tx - px) * springK;
      let fy = (ty - py) * springK;
      let fz = (tz - pz) * springK;

      // 3. Ambient 3D Curl Noise (fluid-like breathing)
      if (turbulence > 0.001) {
        const curl = this.noiseGen.curl(
          px * nScale + t * 0.15,
          py * nScale + t * 0.12,
          pz * nScale + t * 0.18
        );
        fx += curl.x * turbulence;
        fy += curl.y * turbulence;
        fz += curl.z * turbulence;
      }

      // 4. Gesture-Specific Force Fields
      if (hasHand) {
        // Distance to primary hand centroid
        const dx = px - handPos.x;
        const dy = py - handPos.y;
        const dz = pz - handPos.z;
        const distSq = dx * dx + dy * dy + dz * dz + 0.1;
        const dist = Math.sqrt(distSq);

        switch (gesture) {
          case 'OPEN PALM': {
            // Expands outward into a large spherical repulsion cloud
            // Also shifts center of field with hand movement
            const blastRadius = 35.0 * this.sensitivity;
            if (dist < blastRadius) {
              const repelMag = ((blastRadius - dist) / blastRadius) * 2.4 * this.forceMultiplier;
              fx += (dx / dist) * repelMag;
              fy += (dy / dist) * repelMag;
              fz += (dz / dist) * repelMag;
            }
            // Gentle drift following palm movement
            fx += handVelocity.x * 0.18;
            fy += handVelocity.y * 0.18;
            fz += handVelocity.z * 0.18;
            break;
          }

          case 'FIST': {
            // Strong black-hole gravitational attraction to palm center + tangential swirl
            const attractRadius = 50.0 * this.sensitivity;
            if (dist < attractRadius) {
              const attractMag = (1.0 - dist / attractRadius) * 3.8 * this.forceMultiplier;
              // Inward radial pull
              fx -= (dx / dist) * attractMag;
              fy -= (dy / dist) * attractMag;
              fz -= (dz / dist) * attractMag;

              // Tangential rotational swirl
              const swirlSpeed = 1.6 * this.forceMultiplier;
              fx += (-dz / dist) * swirlSpeed;
              fz += (dx / dist) * swirlSpeed;
            }
            break;
          }

          case 'PINCH': {
            // Gravitational singularity at pinch point
            // Attraction scales inversely with finger distance
            const pDx = px - pinchPoint.x;
            const pDy = py - pinchPoint.y;
            const pDz = pz - pinchPoint.z;
            const pDistSq = pDx * pDx + pDy * pDy + pDz * pDz + 0.05;
            const pDist = Math.sqrt(pDistSq);

            // Proximity bonus: closer fingers = tighter black hole
            const pinchTightness = Math.max(0.1, 1.0 - Math.min(1.0, pinchDistance / 0.12));
            const pinchRadius = 45.0 * this.sensitivity;

            if (pDist < pinchRadius) {
              const singularityStrength = Math.pow(1.0 - pDist / pinchRadius, 1.5) * (4.5 * pinchTightness) * this.forceMultiplier;
              fx -= (pDx / pDist) * singularityStrength;
              fy -= (pDy / pDist) * singularityStrength;
              fz -= (pDz / pDist) * singularityStrength;

              // Orbital spin around pinch axis
              fx += (-pDz / pDist) * (1.2 * pinchTightness);
              fz += (pDx / pDist) * (1.2 * pinchTightness);
            }
            break;
          }

          case 'POINT': {
            // Tractor beam / particle stream following index fingertip
            const tipDx = px - indexTip.x;
            const tipDy = py - indexTip.y;
            const tipDz = pz - indexTip.z;
            const tipDistSq = tipDx * tipDx + tipDy * tipDy + tipDz * tipDz + 0.1;
            const tipDist = Math.sqrt(tipDistSq);

            const beamRadius = 28.0 * this.sensitivity;
            if (tipDist < beamRadius) {
              const beamPull = Math.pow(1.0 - tipDist / beamRadius, 2.0) * 3.2 * this.forceMultiplier;
              fx -= (tipDx / tipDist) * beamPull;
              fy -= (tipDy / tipDist) * beamPull;
              fz -= (tipDz / tipDist) * beamPull;

              // Add turbulent vortex stream along fingertip direction
              fx += (handVelocity.x * 0.4 + Math.sin(t * 8 + i) * 0.4) * this.forceMultiplier;
              fy += (handVelocity.y * 0.4 + Math.cos(t * 8 + i) * 0.4) * this.forceMultiplier;
              fz += (handVelocity.z * 0.4) * this.forceMultiplier;
            }
            break;
          }

          case 'TWO HANDS': {
            // Vortex / tunnel effect along the axis between both hands
            const axisX = hand2Pos.x - hand1Pos.x;
            const axisY = hand2Pos.y - hand1Pos.y;
            const axisZ = hand2Pos.z - hand1Pos.z;
            const axisLen = Math.sqrt(axisX * axisX + axisY * axisY + axisZ * axisZ) + 0.01;
            const dirX = axisX / axisLen;
            const dirY = axisY / axisLen;
            const dirZ = axisZ / axisLen;

            // Vector from hand1 to particle
            const h1pX = px - hand1Pos.x;
            const h1pY = py - hand1Pos.y;
            const h1pZ = pz - hand1Pos.z;

            // Projection onto axis
            const proj = h1pX * dirX + h1pY * dirY + h1pZ * dirZ;
            const normProj = proj / axisLen; // 0 at hand1, 1 at hand2

            if (normProj >= -0.2 && normProj <= 1.2) {
              // Closest point on segment
              const cX = hand1Pos.x + dirX * proj;
              const cY = hand1Pos.y + dirY * proj;
              const cZ = hand1Pos.z + dirZ * proj;

              const radX = px - cX;
              const radY = py - cY;
              const radZ = pz - cZ;
              const radDist = Math.sqrt(radX * radX + radY * radY + radZ * radZ) + 0.1;

              if (radDist < 25.0) {
                // Cylindrical vortex pull toward tunnel axis
                const tunnelPull = (1.0 - radDist / 25.0) * 2.0 * this.forceMultiplier;
                fx -= (radX / radDist) * tunnelPull;
                fy -= (radY / radDist) * tunnelPull;
                fz -= (radZ / radDist) * tunnelPull;

                // Swirl around connecting cylinder axis (cross product: dir x rad)
                const swirlX = dirY * radZ - dirZ * radY;
                const swirlY = dirZ * radX - dirX * radZ;
                const swirlZ = dirX * radY - dirY * radX;
                fx += swirlX * 1.5 * this.forceMultiplier;
                fy += swirlY * 1.5 * this.forceMultiplier;
                fz += swirlZ * 1.5 * this.forceMultiplier;
              }
            }
            break;
          }

          default:
            break;
        }

        // 5. Fast Hand Movement / Swipe Wind Blast
        if (handSpeed > 0.8) {
          const swipeRadius = 40.0 * this.sensitivity;
          if (dist < swipeRadius) {
            const windPower = (1.0 - dist / swipeRadius) * (handSpeed * 0.4) * this.forceMultiplier;
            fx += handVelocity.x * windPower;
            fy += handVelocity.y * windPower;
            fz += handVelocity.z * windPower;

            // Shockwave turbulence jitter
            fx += (Math.random() - 0.5) * windPower * 1.5;
            fy += (Math.random() - 0.5) * windPower * 1.5;
            fz += (Math.random() - 0.5) * windPower * 1.5;
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

      // Write back
      positions[idx] = px;
      positions[idxY] = py;
      positions[idxZ] = pz;

      velocities[idx] = vx;
      velocities[idxY] = vy;
      velocities[idxZ] = vz;
    }
  }
}
