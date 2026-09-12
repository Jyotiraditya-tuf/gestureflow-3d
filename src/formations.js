/**
 * GestureFlow 3D - Parametric 3D Formations Generator
 * Generates coordinate arrays [x, y, z, ...] for thousands of particles
 * using pure mathematics and parametric geometry.
 */

/**
 * Helper to ensure float coordinates are well-distributed
 */
function randomRange(min, max) {
  return min + Math.random() * (max - min);
}

function gaussianRandom(mean = 0, stdev = 1) {
  const u = 1 - Math.random();
  const v = Math.random();
  const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  return z * stdev + mean;
}

/**
 * 1. SPHERE FORMATION
 * Uniform Fibonacci sphere with slight volumetric depth jitter
 */
export function createSphereFormation(count, radius = 22) {
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const phi = Math.PI * (Math.sqrt(5) - 1); // Golden ratio angle ~ 2.39996

  for (let i = 0; i < count; i++) {
    const y = 1 - (i / (count - 1)) * 2; // y goes from 1 to -1
    const radiusAtY = Math.sqrt(Math.max(0, 1 - y * y)); // radius at y
    const theta = phi * i;

    // Add slight volumetric layer distribution (shell + internal core)
    const rOffset = Math.pow(Math.random(), 0.5); // uniform disk/shell
    const r = radius * (0.65 + 0.35 * rOffset);

    const x = Math.cos(theta) * radiusAtY * r;
    const yPos = y * r;
    const z = Math.sin(theta) * radiusAtY * r;

    positions[i * 3] = x;
    positions[i * 3 + 1] = yPos;
    positions[i * 3 + 2] = z;

    // Gradient based on latitude and radius
    const normY = (y + 1) * 0.5;
    colors[i * 3] = 0.1 + 0.8 * normY; // R
    colors[i * 3 + 1] = 0.4 + 0.5 * (1 - Math.abs(y)); // G
    colors[i * 3 + 2] = 0.9 - 0.4 * normY; // B
  }

  return { positions, colors };
}

/**
 * 2. GALAXY FORMATION
 * Multi-arm logarithmic spiral with dense galactic core and vertical gas flare
 */
export function createGalaxyFormation(count, radius = 34, numArms = 4) {
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);

  for (let i = 0; i < count; i++) {
    // 25% of particles in the dense galactic core, 75% in the spiral arms
    const isCore = Math.random() < 0.25;

    let r, theta, z;

    if (isCore) {
      r = Math.pow(Math.random(), 2.0) * (radius * 0.25);
      theta = Math.random() * Math.PI * 2;
      z = gaussianRandom(0, (radius * 0.12) * (1 - r / (radius * 0.25)));
    } else {
      // Spiral arms
      const armIndex = i % numArms;
      const armOffset = (armIndex / numArms) * Math.PI * 2;
      
      // Radius distribution concentrated near core but extending outwards
      r = radius * 0.15 + Math.pow(Math.random(), 1.4) * (radius * 0.85);
      
      // Logarithmic spiral angle with scatter
      const spiralAngle = 3.2 * Math.log(r / 3.0);
      const scatter = gaussianRandom(0, 0.22);
      theta = armOffset + spiralAngle + scatter;

      // Vertical thickness tapers off at the outer rim
      const maxZ = (radius * 0.15) * Math.exp(-r / (radius * 0.7));
      z = gaussianRandom(0, Math.max(0.4, maxZ));
    }

    const x = Math.cos(theta) * r;
    const y = z; // Y is vertical in Three.js
    const zPos = Math.sin(theta) * r;

    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = zPos;

    // Color: Core is warm golden/amber, arms are cyan/electric violet
    const distNorm = Math.min(1.0, r / radius);
    if (isCore) {
      colors[i * 3] = 1.0;
      colors[i * 3 + 1] = 0.85 - distNorm * 0.4;
      colors[i * 3 + 2] = 0.4 + distNorm * 0.3;
    } else {
      colors[i * 3] = 0.2 + 0.6 * (1.0 - distNorm);
      colors[i * 3 + 1] = 0.5 + 0.5 * Math.sin(theta);
      colors[i * 3 + 2] = 0.95;
    }
  }

  return { positions, colors };
}

/**
 * 3. VORTEX FORMATION
 * Hyperbolic conical tornado funnel with high angular velocity
 */
export function createVortexFormation(count, height = 44, topRadius = 26, bottomRadius = 2.5) {
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);

  for (let i = 0; i < count; i++) {
    // Height distribution with more particles concentrated in the eye/stem
    const progress = Math.pow(Math.random(), 0.9); // 0 at bottom, 1 at top
    const y = (progress - 0.5) * height;

    // Funnel radius curve
    const rBase = bottomRadius + (topRadius - bottomRadius) * Math.pow(progress, 1.8);
    const rJitter = gaussianRandom(0, rBase * 0.15);
    const r = Math.max(0.8, rBase + rJitter);

    // Fast spiral winding
    const turns = 10.0;
    const theta = progress * Math.PI * 2 * turns + (i % 6) * (Math.PI / 3) + Math.random() * 0.3;

    const x = Math.cos(theta) * r;
    const z = Math.sin(theta) * r;

    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;

    // Color: deep blue at bottom vortex to fiery cyan/magenta at top rim
    colors[i * 3] = 0.1 + 0.9 * Math.pow(progress, 2);
    colors[i * 3 + 1] = 0.3 + 0.7 * (1.0 - Math.abs(progress - 0.5) * 2);
    colors[i * 3 + 2] = 0.9 - 0.4 * progress;
  }

  return { positions, colors };
}

/**
 * 4. TORUS FORMATION
 * Parametric donut ring with volumetric cross-section
 */
export function createTorusFormation(count, majorRadius = 20, minorRadius = 7.5) {
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);

  for (let i = 0; i < count; i++) {
    const u = Math.random() * Math.PI * 2; // Angle around the ring
    const v = Math.random() * Math.PI * 2; // Angle around the tube

    // Volumetric dispersion inside the tube
    const rDist = Math.sqrt(Math.random()) * minorRadius;

    const x = (majorRadius + rDist * Math.cos(v)) * Math.cos(u);
    const y = rDist * Math.sin(v);
    const z = (majorRadius + rDist * Math.cos(v)) * Math.sin(u);

    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;

    // Color gradient looping around the torus ring
    colors[i * 3] = 0.5 + 0.5 * Math.sin(u);
    colors[i * 3 + 1] = 0.5 + 0.5 * Math.cos(v);
    colors[i * 3 + 2] = 0.8 + 0.2 * Math.sin(u + v);
  }

  return { positions, colors };
}

/**
 * 5. 3D HEART FORMATION
 * Mathematical 3D cardioid heart with volumetric depth and delicate contours
 */
export function createHeartFormation(count, scale = 1.3) {
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);

  for (let i = 0; i < count; i++) {
    const t = Math.random() * Math.PI * 2;
    const v = (Math.random() - 0.5) * Math.PI; // latitude [-pi/2, pi/2]
    const depthScale = Math.cos(v);

    // 2D Cardioid base curve
    const xBase = 16 * Math.pow(Math.sin(t), 3);
    const yBase = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);

    // Internal volume jitter
    const vol = Math.pow(Math.random(), 0.35);

    const x = (xBase * depthScale * vol) * scale;
    const y = (yBase * vol + 2.5) * scale; // shifted slightly up to center
    const z = (8.5 * Math.sin(v) * Math.abs(Math.sin(t)) * vol) * scale;

    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;

    // Glowing ruby/crimson with hot pink highlights
    const heightNorm = (y + 16) / 32;
    colors[i * 3] = 1.0; // Rich Red
    colors[i * 3 + 1] = 0.15 + 0.45 * Math.abs(z / 10); // Pink edge glow
    colors[i * 3 + 2] = 0.4 + 0.5 * heightNorm;
  }

  return { positions, colors };
}

/**
 * 6. DNA DOUBLE HELIX FORMATION
 * Two intertwined helical strands with connecting base-pair rungs
 */
export function createDNAFormation(count, length = 46, radius = 9, turns = 4.5) {
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);

  // 70% in outer dual strands, 30% in base-pair rungs
  const strandCount = Math.floor(count * 0.7);

  for (let i = 0; i < count; i++) {
    let x, y, z;
    let isStrand1 = false;
    let isStrand2 = false;

    if (i < strandCount) {
      // Outer strands
      isStrand1 = i % 2 === 0;
      isStrand2 = !isStrand1;
      const strandOffset = isStrand1 ? 0 : Math.PI;

      const progress = i / strandCount; // 0 to 1
      y = (progress - 0.5) * length;

      const angle = progress * Math.PI * 2 * turns + strandOffset;
      const r = radius + gaussianRandom(0, 0.4);

      x = Math.cos(angle) * r;
      z = Math.sin(angle) * r;
    } else {
      // Connecting base-pair rungs
      const rungProgress = Math.random();
      const rungStep = Math.floor(rungProgress * turns * 20) / (turns * 20); // discrete rung levels
      y = (rungStep - 0.5) * length;

      const angle = rungStep * Math.PI * 2 * turns;
      const interp = (Math.random() - 0.5) * 2; // -1 to 1 along rung vector

      x = Math.cos(angle) * (radius * interp);
      z = Math.sin(angle) * (radius * interp);
    }

    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;

    // Color: Strand 1 is cyan/electric blue, Strand 2 is neon purple, rungs are glowing gold
    if (i >= strandCount) {
      colors[i * 3] = 0.95;
      colors[i * 3 + 1] = 0.85;
      colors[i * 3 + 2] = 0.2;
    } else if (isStrand1) {
      colors[i * 3] = 0.0;
      colors[i * 3 + 1] = 0.85;
      colors[i * 3 + 2] = 1.0;
    } else {
      colors[i * 3] = 0.9;
      colors[i * 3 + 1] = 0.15;
      colors[i * 3 + 2] = 0.95;
    }
  }

  return { positions, colors };
}

/**
 * 7. EXPLOSION FORMATION
 * Multi-layered outward blast shockwave with turbulent ejecta rays
 */
export function createExplosionFormation(count, maxRadius = 38) {
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);

  for (let i = 0; i < count; i++) {
    // Generate uniform random spherical direction
    const u = Math.random();
    const v = Math.random();
    const theta = u * 2.0 * Math.PI;
    const phi = Math.acos(2.0 * v - 1.0);

    const dirX = Math.sin(phi) * Math.cos(theta);
    const dirY = Math.sin(phi) * Math.sin(theta);
    const dirZ = Math.cos(phi);

    // Shockwave radius distributions (dense outer shockwave shell + fast particles)
    let dist;
    const roll = Math.random();
    if (roll < 0.4) {
      // Outer spherical blast shell
      dist = maxRadius * (0.85 + 0.15 * Math.random());
    } else if (roll < 0.75) {
      // Linear trail streaks
      dist = maxRadius * Math.pow(Math.random(), 0.7);
    } else {
      // Hot high-energy core
      dist = maxRadius * 0.25 * Math.pow(Math.random(), 2.0);
    }

    // Add ray/filament clustering
    const rayAngle = Math.floor(theta * 4) / 4;
    const filamentJitter = (theta - rayAngle) * 2;
    const filamentBonus = Math.exp(-filamentJitter * filamentJitter * 8) * 4;

    const finalR = dist + filamentBonus;

    positions[i * 3] = dirX * finalR;
    positions[i * 3 + 1] = dirY * finalR;
    positions[i * 3 + 2] = dirZ * finalR;

    // Fiery blast colors: White-hot core -> orange -> vibrant magenta/smoke
    const norm = finalR / maxRadius;
    if (norm < 0.3) {
      colors[i * 3] = 1.0;
      colors[i * 3 + 1] = 1.0;
      colors[i * 3 + 2] = 0.8;
    } else if (norm < 0.7) {
      colors[i * 3] = 1.0;
      colors[i * 3 + 1] = 0.45;
      colors[i * 3 + 2] = 0.1;
    } else {
      colors[i * 3] = 0.9;
      colors[i * 3 + 1] = 0.1;
      colors[i * 3 + 2] = 0.5;
    }
  }

  return { positions, colors };
}

/**
 * 8. RANDOM NEBULA FORMATION
 * Clustered volumetric 3D cosmic gas cloud with multiple harmonic density nodes
 */
export function createNebulaFormation(count, extent = 32) {
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);

  // 4 major nebula cloud cluster centers
  const clusters = [
    { x: -12, y: 6, z: 4, radius: 14, color: [0.2, 0.7, 1.0] },
    { x: 10, y: -8, z: -6, radius: 16, color: [1.0, 0.2, 0.6] },
    { x: 4, y: 12, z: -10, radius: 12, color: [0.1, 0.9, 0.7] },
    { x: -6, y: -10, z: 12, radius: 15, color: [0.8, 0.4, 1.0] }
  ];

  for (let i = 0; i < count; i++) {
    const cluster = clusters[i % clusters.length];
    
    // Gaussian 3D cloud around cluster center
    const x = cluster.x + gaussianRandom(0, cluster.radius * 0.45);
    const y = cluster.y + gaussianRandom(0, cluster.radius * 0.45);
    const z = cluster.z + gaussianRandom(0, cluster.radius * 0.45);

    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;

    // Blend cluster color with organic noise
    const noise = Math.sin(x * 0.1) * Math.cos(y * 0.1) * Math.sin(z * 0.1);
    colors[i * 3] = Math.min(1.0, Math.max(0.1, cluster.color[0] + noise * 0.2));
    colors[i * 3 + 1] = Math.min(1.0, Math.max(0.1, cluster.color[1] + noise * 0.2));
    colors[i * 3 + 2] = Math.min(1.0, Math.max(0.1, cluster.color[2] + noise * 0.2));
  }

  return { positions, colors };
}

/**
 * 9. SATURN FORMATION (BONUS)
 * Central planetary globe with detailed tilted ring discs & Cassini division
 */
export function createSaturnFormation(count, planetRadius = 10, ringInner = 14, ringOuter = 28) {
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);

  // 35% planet, 65% rings
  const planetCount = Math.floor(count * 0.35);
  const tilt = 0.45; // ~26 degrees tilt
  const cosTilt = Math.cos(tilt);
  const sinTilt = Math.sin(tilt);

  for (let i = 0; i < count; i++) {
    let x, y, z;
    let isPlanet = i < planetCount;

    if (isPlanet) {
      // Planet sphere
      const u = Math.random();
      const v = Math.random();
      const theta = u * 2.0 * Math.PI;
      const phi = Math.acos(2.0 * v - 1.0);
      const r = planetRadius * Math.pow(Math.random(), 0.3); // volumetric

      x = r * Math.sin(phi) * Math.cos(theta);
      y = r * Math.cos(phi) * 0.9; // oblate spheroid (flattened poles)
      z = r * Math.sin(phi) * Math.sin(theta);

      colors[i * 3] = 0.92;
      colors[i * 3 + 1] = 0.78 + 0.15 * Math.sin(y * 0.8); // atmosphere bands
      colors[i * 3 + 2] = 0.55;
    } else {
      // Ring system with Cassini division (empty gap between 19.5 and 21.5)
      let r = ringInner + Math.random() * (ringOuter - ringInner);
      if (r > 19.5 && r < 21.5) {
        // Shift out of Cassini gap
        r = Math.random() < 0.5 ? 19.3 : 21.7;
      }

      const theta = Math.random() * Math.PI * 2;
      const rawX = Math.cos(theta) * r;
      const rawZ = Math.sin(theta) * r;
      const rawY = gaussianRandom(0, 0.25); // very thin vertical profile

      // Apply axial tilt
      x = rawX;
      y = rawY * cosTilt - rawZ * sinTilt;
      z = rawY * sinTilt + rawZ * cosTilt;

      // Ring icy colors
      const ringNorm = (r - ringInner) / (ringOuter - ringInner);
      colors[i * 3] = 0.6 + 0.35 * Math.sin(r * 1.5);
      colors[i * 3 + 1] = 0.7 + 0.25 * ringNorm;
      colors[i * 3 + 2] = 0.95;
    }

    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;
  }

  return { positions, colors };
}

/**
 * Registry of all available formations
 */
export const FORMATIONS = {
  sphere: { name: 'Sphere', fn: createSphereFormation, id: 'sphere', key: '1' },
  galaxy: { name: 'Galaxy', fn: createGalaxyFormation, id: 'galaxy', key: '2' },
  vortex: { name: 'Vortex', fn: createVortexFormation, id: 'vortex', key: '3' },
  torus: { name: 'Torus', fn: createTorusFormation, id: 'torus', key: '4' },
  heart: { name: 'Heart', fn: createHeartFormation, id: 'heart', key: '5' },
  dna: { name: 'DNA Helix', fn: createDNAFormation, id: 'dna', key: '6' },
  explosion: { name: 'Explosion', fn: createExplosionFormation, id: 'explosion', key: '7' },
  nebula: { name: 'Nebula', fn: createNebulaFormation, id: 'nebula', key: '8' },
  saturn: { name: 'Saturn', fn: createSaturnFormation, id: 'saturn', key: '9' }
};
