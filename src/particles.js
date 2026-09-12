/**
 * GestureFlow 3D - Optimized Particle System Manager
 * High-performance THREE.Points with BufferGeometry, formation caching,
 * conditional GPU buffer uploads, and zero-allocation updates.
 */

import * as THREE from 'three';
import { FORMATIONS } from './formations.js';

export const COLOR_THEMES = {
  nebula: {
    id: 'nebula',
    name: 'Cosmic Nebula',
    colors: [new THREE.Color('#00f2fe'), new THREE.Color('#9333ea'), new THREE.Color('#ec4899')]
  },
  cyberpunk: {
    id: 'cyberpunk',
    name: 'Cyberpunk Neon',
    colors: [new THREE.Color('#00ffcc'), new THREE.Color('#ff007f'), new THREE.Color('#ffe600')]
  },
  electric: {
    id: 'electric',
    name: 'Electric Cyan',
    colors: [new THREE.Color('#00f2fe'), new THREE.Color('#3b82f6'), new THREE.Color('#ffffff')]
  },
  solar: {
    id: 'solar',
    name: 'Solar Flare',
    colors: [new THREE.Color('#ff4500'), new THREE.Color('#ffaa00'), new THREE.Color('#ffff77')]
  },
  emerald: {
    id: 'emerald',
    name: 'Emerald Matrix',
    colors: [new THREE.Color('#10b981'), new THREE.Color('#059669'), new THREE.Color('#a7f3d0')]
  },
  rainbow: {
    id: 'rainbow',
    name: 'Prismatic Spectrum',
    colors: []
  }
};

/**
 * Procedurally generates a soft radial glowing circular particle sprite
 */
function createGlowTexture(size = 128) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  const center = size / 2;
  const gradient = ctx.createRadialGradient(center, center, 0, center, center, center);
  
  gradient.addColorStop(0.0, 'rgba(255, 255, 255, 1.0)');
  gradient.addColorStop(0.2, 'rgba(255, 255, 255, 0.85)');
  gradient.addColorStop(0.45, 'rgba(220, 240, 255, 0.45)');
  gradient.addColorStop(0.7, 'rgba(100, 180, 255, 0.12)');
  gradient.addColorStop(1.0, 'rgba(0, 0, 0, 0.0)');

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  return texture;
}

export class ParticleSystem {
  constructor(scene, count = 20000) {
    this.scene = scene;
    this.count = count;
    this.currentFormationId = 'galaxy';
    this.currentThemeId = 'nebula';

    // Particle size slider
    this.baseParticleSize = 0.85;

    // Cache of precomputed formation coordinates per count: Map<formationKey, {positions, colors}>
    this.formationCache = new Map();

    // Color morphing tracking to avoid redundant per-frame GPU buffer uploads
    this.isColorMorphing = false;
    this.colorMorphProgress = 1.0;

    // Allocate Typed Buffers
    this.positions = new Float32Array(this.count * 3);
    this.velocities = new Float32Array(this.count * 3);
    this.targetPositions = new Float32Array(this.count * 3);
    this.currentColors = new Float32Array(this.count * 3);
    this.targetColors = new Float32Array(this.count * 3);
    this.sizes = new Float32Array(this.count);

    // Glow sprite
    this.glowTexture = createGlowTexture(128);

    // Build Three.js geometry & mesh
    this.geometry = new THREE.BufferGeometry();
    this.material = new THREE.PointsMaterial({
      size: this.baseParticleSize,
      map: this.glowTexture,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      vertexColors: true,
      sizeAttenuation: true
    });

    this.points = new THREE.Points(this.geometry, this.material);
    this.points.frustumCulled = false;
    this.scene.add(this.points);

    // Initialize formation
    this.setFormation('galaxy', true);
  }

  /**
   * Resize or recreate particle buffer array
   */
  setParticleCount(newCount) {
    if (newCount === this.count) return;
    this.count = newCount;
    this.formationCache.clear(); // clear cached shapes for old count

    // Reallocate arrays
    this.positions = new Float32Array(this.count * 3);
    this.velocities = new Float32Array(this.count * 3);
    this.targetPositions = new Float32Array(this.count * 3);
    this.currentColors = new Float32Array(this.count * 3);
    this.targetColors = new Float32Array(this.count * 3);
    this.sizes = new Float32Array(this.count);

    this.setFormation(this.currentFormationId, true);
  }

  /**
   * Retrieve cached formation or generate if absent
   */
  getFormationData(formationId) {
    const formationDef = FORMATIONS[formationId] || FORMATIONS.sphere;
    const cacheKey = `${formationDef.id}_${this.count}`;

    if (this.formationCache.has(cacheKey)) {
      return this.formationCache.get(cacheKey);
    }

    const data = formationDef.fn(this.count);
    this.formationCache.set(cacheKey, data);
    return data;
  }

  /**
   * Switch active formation with smooth morphing
   */
  setFormation(formationId, instant = false) {
    const formationDef = FORMATIONS[formationId] || FORMATIONS.sphere;
    this.currentFormationId = formationDef.id;

    // Get cached or newly generated coordinates
    const { positions: newTargets, colors: newCol } = this.getFormationData(this.currentFormationId);

    // Apply color theme or default formation colors
    const theme = COLOR_THEMES[this.currentThemeId];
    const isRainbow = this.currentThemeId === 'rainbow';
    const hasTheme = theme && theme.colors.length > 0;
    const themeColors = hasTheme ? theme.colors : null;
    const themeLength = themeColors ? themeColors.length : 1;

    const tempColor = new THREE.Color();

    for (let i = 0; i < this.count; i++) {
      const idx = i * 3;
      const idxY = idx + 1;
      const idxZ = idx + 2;

      // Copy target positions
      this.targetPositions[idx] = newTargets[idx];
      this.targetPositions[idxY] = newTargets[idxY];
      this.targetPositions[idxZ] = newTargets[idxZ];

      // Compute target color
      let r = newCol[idx];
      let g = newCol[idxY];
      let b = newCol[idxZ];

      if (isRainbow) {
        const hue = (i / this.count + (newTargets[idx] * 0.01)) % 1.0;
        tempColor.setHSL(hue, 0.9, 0.6);
        r = tempColor.r;
        g = tempColor.g;
        b = tempColor.b;
      } else if (hasTheme) {
        const cIdx = i % themeLength;
        const c1 = themeColors[cIdx];
        const c2 = themeColors[(cIdx + 1) % themeLength];
        const blend = (i / this.count);
        r = c1.r * (1 - blend) + c2.r * blend;
        g = c1.g * (1 - blend) + c2.g * blend;
        b = c1.b * (1 - blend) + c2.b * blend;
      }

      this.targetColors[idx] = r;
      this.targetColors[idxY] = g;
      this.targetColors[idxZ] = b;

      if (instant) {
        // Instant teleport for first load or reset
        this.positions[idx] = newTargets[idx];
        this.positions[idxY] = newTargets[idxY];
        this.positions[idxZ] = newTargets[idxZ];

        this.velocities[idx] = 0;
        this.velocities[idxY] = 0;
        this.velocities[idxZ] = 0;

        this.currentColors[idx] = r;
        this.currentColors[idxY] = g;
        this.currentColors[idxZ] = b;
      }

      this.sizes[i] = this.baseParticleSize * (0.7 + 0.6 * Math.random());
    }

    if (instant) {
      this.isColorMorphing = false;
      this.colorMorphProgress = 1.0;
      this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
      this.geometry.setAttribute('color', new THREE.BufferAttribute(this.currentColors, 3));
      this.geometry.attributes.position.needsUpdate = true;
      this.geometry.attributes.color.needsUpdate = true;
    } else {
      this.isColorMorphing = true;
      this.colorMorphProgress = 0.0;
    }
  }

  /**
   * Set color theme
   */
  setColorTheme(themeId) {
    if (!COLOR_THEMES[themeId]) return;
    this.currentThemeId = themeId;
    this.setFormation(this.currentFormationId, false);
  }

  /**
   * Set particle size
   */
  setSize(size) {
    this.baseParticleSize = size;
    this.material.size = size;
  }

  /**
   * Reset all particles with an explosion dispersion
   */
  resetParticles() {
    for (let i = 0; i < this.count; i++) {
      const idx = i * 3;
      // Scatter randomly outwards
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const speed = 15 + Math.random() * 25;

      this.velocities[idx] = Math.sin(phi) * Math.cos(theta) * speed;
      this.velocities[idx + 1] = Math.sin(phi) * Math.sin(theta) * speed;
      this.velocities[idx + 2] = Math.cos(phi) * speed;
    }
  }

  /**
   * Smooth color morphing and conditional GPU buffer uploads
   */
  renderUpdate(dt = 0.016) {
    // 1. Only process and upload colors when morphing
    if (this.isColorMorphing) {
      const colorAlpha = Math.min(1.0, dt * 3.5);
      this.colorMorphProgress += colorAlpha;

      let maxDiff = 0;
      const totalFloats = this.count * 3;

      for (let i = 0; i < totalFloats; i++) {
        const diff = this.targetColors[i] - this.currentColors[i];
        this.currentColors[i] += diff * colorAlpha;
        const absDiff = diff < 0 ? -diff : diff;
        if (absDiff > maxDiff) maxDiff = absDiff;
      }

      this.geometry.attributes.color.needsUpdate = true;

      // When colors have converged, stop color updates to save CPU & GPU bus bandwidth
      if (maxDiff < 0.005 || this.colorMorphProgress >= 1.0) {
        this.isColorMorphing = false;
      }
    }

    // Positions always update during active physics
    this.geometry.attributes.position.needsUpdate = true;
  }
}
