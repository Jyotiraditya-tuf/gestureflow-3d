/**
 * GestureFlow 3D - Particle System Manager
 * Creates and updates high-performance THREE.Points with BufferGeometry,
 * additive blending, dynamic color palettes, and procedural glow sprites.
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
   * Switch active formation with smooth morphing
   */
  setFormation(formationId, instant = false) {
    const formationDef = FORMATIONS[formationId] || FORMATIONS.sphere;
    this.currentFormationId = formationDef.id;

    // Generate new mathematical coordinates & colors
    const { positions: newTargets, colors: newCol } = formationDef.fn(this.count);

    // Apply color theme or default formation colors
    const theme = COLOR_THEMES[this.currentThemeId];

    for (let i = 0; i < this.count; i++) {
      const idx = i * 3;

      // Copy target positions
      this.targetPositions[idx] = newTargets[idx];
      this.targetPositions[idx + 1] = newTargets[idx + 1];
      this.targetPositions[idx + 2] = newTargets[idx + 2];

      // Compute target color
      let r = newCol[idx];
      let g = newCol[idx + 1];
      let b = newCol[idx + 2];

      if (this.currentThemeId === 'rainbow') {
        const hue = (i / this.count + (newTargets[idx] * 0.01)) % 1.0;
        const color = new THREE.Color().setHSL(hue, 0.9, 0.6);
        r = color.r;
        g = color.g;
        b = color.b;
      } else if (theme && theme.colors.length > 0) {
        const cIdx = i % theme.colors.length;
        const c1 = theme.colors[cIdx];
        const c2 = theme.colors[(cIdx + 1) % theme.colors.length];
        const blend = (i / this.count);
        r = c1.r * (1 - blend) + c2.r * blend;
        g = c1.g * (1 - blend) + c2.g * blend;
        b = c1.b * (1 - blend) + c2.b * blend;
      }

      this.targetColors[idx] = r;
      this.targetColors[idx + 1] = g;
      this.targetColors[idx + 2] = b;

      if (instant) {
        // Instant teleport for first load or reset
        this.positions[idx] = newTargets[idx];
        this.positions[idx + 1] = newTargets[idx + 1];
        this.positions[idx + 2] = newTargets[idx + 2];

        this.velocities[idx] = 0;
        this.velocities[idx + 1] = 0;
        this.velocities[idx + 2] = 0;

        this.currentColors[idx] = r;
        this.currentColors[idx + 1] = g;
        this.currentColors[idx + 2] = b;
      }

      this.sizes[i] = this.baseParticleSize * (0.7 + 0.6 * Math.random());
    }

    // Attach buffers to Three.js geometry
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.geometry.setAttribute('color', new THREE.BufferAttribute(this.currentColors, 3));
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
   * Smooth color morphing and buffer commit per frame
   */
  renderUpdate(dt = 0.016) {
    const colorAlpha = Math.min(1.0, dt * 3.5);

    // Color interpolation loop
    for (let i = 0; i < this.count * 3; i++) {
      this.currentColors[i] += (this.targetColors[i] - this.currentColors[i]) * colorAlpha;
    }

    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.color.needsUpdate = true;
  }
}
