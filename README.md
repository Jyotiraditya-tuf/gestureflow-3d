# 🌌 GestureFlow 3D

> An interactive, real-time 3D particle universe controlled entirely by hand gestures through your webcam using Three.js, MediaPipe Hands, and WebGL.

---

## ✨ Overview

**GestureFlow 3D** is a browser-based 3D visual computing application that translates human hand kinematics into dynamic particle physics simulations. By leveraging MediaPipe's on-device machine learning and Three.js WebGL rendering, users can manipulate tens of thousands of particles in real time through natural hand gestures, pinches, velocity swipes, and dual-hand interactions.

---

## 🚀 Features

- **⚡ High-Performance 3D Particle Engine**:
  - Renders **10,000 to 50,000+** particles at a rock-solid 60 FPS using `THREE.BufferGeometry` and `THREE.Points`.
  - Zero garbage collection inside the animation render loop via pre-allocated typed arrays (`Float32Array`).
  - Additive blending with soft radial glowing particle sprites.
  - Adaptive performance monitor that auto-tunes particle count if frame drops are detected on lower-end devices.

- **🌀 9 Parametric 3D Formations with Continuous Morphing**:
  1. **Sphere**: Uniform Fibonacci spherical distribution with depth jitter.
  2. **Galaxy**: Multi-arm logarithmic spiral with a dense galactic core and vertical gas dispersion.
  3. **Vortex**: Hyperbolic 3D funnel with high angular velocity.
  4. **Torus**: Parametric donut ring with volumetric cross-section.
  5. **Heart (3D)**: Mathematical cardioid heart surface with depth contours.
  6. **DNA Double Helix**: Intertwined helical strands with connecting base-pair rungs.
  7. **Explosion**: Multi-cluster outward shockwave blast with turbulent ejecta rays.
  8. **Nebula**: Clustered 3D cosmic fractal gas cloud.
  9. **Saturn**: Central planetary globe with detailed tilted ring discs and Cassini division.

- **✋ Real-Time On-Device Hand Gesture Recognition**:
  - **Open Palm**: Expands particles outward into a spherical cloud; moves the field center.
  - **Closed Fist**: Gravitational black hole compression with inward orbital spin.
  - **Pinch (Thumb + Index)**: Proportional gravitational singularity at pinch coordinates.
  - **Pointing Beam**: Particle tractor beam and dynamic vortex trailing the index fingertip.
  - **Two Hands Interplay**: Distance between hands dynamically scales the particle universe ($0.5\times - 2.5\times$) with a connecting helical vortex tunnel.
  - **Fast Kinetic Swipe**: Directional wind blasts and shockwave turbulence from rapid hand velocity.
  - **Hand Tilt / Orbit**: Tilting hand smoothly rotates the 3D scene camera.

- **🎨 Futuristic Cyberpunk Glassmorphic HUD**:
  - Live AI gesture card with confidence bar and action description.
  - Draggable & collapsible Picture-in-Picture (PIP) camera preview with glowing hand skeleton overlay.
  - Real-time physics sliders: Particle Density, Particle Glow Size, Sensitivity, Force Multiplier, Curl Turbulence.
  - 6 Vibrant Color Palettes: Cosmic Nebula, Cyberpunk Neon, Electric Cyan, Solar Flare, Emerald Matrix, and Prismatic Spectrum.
  - One-click 4K Screenshot Capture.

- **🎵 Reactive Ambient Audio Synthesizer**:
  - Built-in Web Audio API synthesizer that generates procedural ambient chords and resonant filter sweeps modulated by hand velocity and gestures.

- **🖱️ Seamless Fallback**:
  - Full mouse, touch, and keyboard support when camera access is disabled or unavailable.

---

## 🔒 Privacy & Security

> [!IMPORTANT]
> **100% Local Browser Execution**: All computer vision and hand landmark detection happens entirely on your local machine using WebAssembly and WebGL. **No webcam video frames, images, or biometric data are ever recorded, saved, or transmitted to any external server.**

---

## 🛠️ Tech Stack

- **Graphics & Rendering**: [Three.js](https://threejs.org/) (WebGL, BufferGeometry, PointsMaterial, Additive Blending)
- **Computer Vision & AI**: [MediaPipe Hands](https://developers.google.com/mediapipe/solutions/vision/hand_landmarker) (21 3D landmarks, on-device ML)
- **Physics Simulation**: Custom Verlet / Spring-Damper dynamics with fast 3D Curl Noise turbulence
- **Audio Engine**: Web Audio API (BiquadFilter, multi-oscillator polyphony, noise generator)
- **Styling**: Modern CSS3 (Glassmorphism, backdrop-filter, CSS Grid/Flexbox)
- **Build Tool**: [Vite](https://vitejs.dev/)

---

## 📐 How Hand Tracking & Gesture Classification Works

1. **Landmark Extraction**:
   MediaPipe Hands identifies 21 3D coordinates $(x, y, z)$ per hand normalized to $[0, 1]$.

2. **World Space Coordinate Mapping**:
   Coordinates are mirrored and transformed into 3D world space coordinates aligned with the Three.js camera projection plane:
   $$\text{world}_X = (0.5 - \text{norm}_X) \times 55$$
   $$\text{world}_Y = (0.5 - \text{norm}_Y) \times 40$$

3. **Postural & Geometric Classification**:
   - **Finger State**: Ratio of tip-to-wrist distance versus PIP-to-wrist distance determines extension.
   - **Pinch Distance**: Euclidean distance between landmark 4 (thumb tip) and landmark 8 (index tip).
   - **Palm Centroid**: Weighted average of landmarks 0, 5, 9, 13, and 17.
   - **Velocity**: First derivative of position with exponential smoothing filter.

4. **Temporal Smoothing & Hysteresis**:
   To prevent rapid state flickering, candidate gestures must hold for consecutive frames before updating the active state.

---

## 🎮 Controls & Shortcuts

### Hand Gestures
| Gesture | Visual Indicator | Particle Physics Action |
| :--- | :---: | :--- |
| **Open Palm** | ✋ | Spherical repulsion force field + shifts particle center |
| **Closed Fist** | ✊ | High-gravity black hole compression + inward swirl |
| **Pinch** | 🤏 | Gravitational singularity at pinch point (distance-proportional) |
| **Pointing Beam** | 👉 | Tractor beam & stream following index fingertip |
| **Two Hands** | 🙌 | Dual-hand universe scaling + connective vortex tunnel |
| **Fast Swipe** | 💨 | Directional wind momentum impulse + shockwave turbulence |

### Keyboard Shortcuts
| Key | Action |
| :---: | :--- |
| <kbd>1</kbd> - <kbd>9</kbd> | Morph between 9 formations (Sphere, Galaxy, Vortex, Torus, Heart, DNA, Explosion, Nebula, Saturn) |
| <kbd>Space</kbd> | Pause / Resume simulation |
| <kbd>R</kbd> | Reset particle field with outward dispersion blast |
| <kbd>M</kbd> | Toggle reactive ambient audio synthesizer |
| <kbd>S</kbd> | Export high-resolution 4K PNG screenshot |
| <kbd>H</kbd> | Toggle Glassmorphic HUD visibility (Clean mode) |
| <kbd>F</kbd> | Toggle Fullscreen mode |
| <kbd>C</kbd> | Toggle Webcam PIP window visibility |
| <kbd>?</kbd> | Open Gesture & Shortcut Guide |

### Mouse & Touch Fallback
- **Move Cursor / Touch**: Directs interactive particle stream.
- **Left Click + Drag**: Singularity Attractor (Simulates Pinch).
- **Right Click + Drag**: Repulsion Blast (Simulates Open Palm).
- **Scroll Wheel**: Adjusts camera zoom.

---

## 📁 Project Structure

```
gestureflow-3d/
├── index.html                 # Main application HTML & layout
├── package.json               # Dependencies & scripts
├── vite.config.js             # Vite configuration
├── README.md                  # Comprehensive project documentation
├── public/
│   └── favicon.svg            # Cyberpunk particle SVG icon
└── src/
    ├── main.js                # App coordinator, render loop, resize & lifecycle
    ├── particles.js           # ParticleSystem class (BufferGeometry, color themes, morphing)
    ├── formations.js          # Parametric 3D shapes (Sphere, Galaxy, Vortex, Torus, Heart, DNA, etc.)
    ├── physics.js             # Physics engine (Velocity, damping, 3D curl noise, force fields)
    ├── handTracking.js        # MediaPipe Hands manager, video feed, skeleton canvas overlay
    ├── gestureController.js   # Gesture classifier with temporal smoothing & kinematics
    ├── ui.js                  # Glassmorphism HUD manager, sliders, badges & notifications
    ├── audio.js               # Reactive ambient Web Audio synthesizer
    └── styles.css             # Futuristic dark mode styling & glassmorphism
```

---

## 📦 Installation & Local Setup

### Prerequisites
- [Node.js](https://nodejs.org/) (v18.0.0 or higher recommended)
- A modern web browser with WebGL and webcam support (Chrome, Edge, Firefox, Brave, Safari)

### Steps

1. **Clone or Navigate to the Project Directory**:
   ```bash
   cd gestureflow-3d
   ```

2. **Install Dependencies**:
   ```bash
   npm install
   ```

3. **Start the Development Server**:
   ```bash
   npm run dev
   ```

4. **Open in Browser**:
   Open `http://localhost:3000` in your browser.
   Grant webcam access when prompted to enable real-time hand tracking.

5. **Build for Production**:
   ```bash
   npm run build
   ```
   The optimized production bundle will be output to the `dist/` directory.

---

## ⚡ Performance Optimization Tips

1. **Hardware Acceleration**: Ensure hardware acceleration is enabled in your browser settings (`chrome://settings/system`).
2. **Lighting**: Good ambient lighting improves hand landmark detection accuracy and frame rates.
3. **Particle Density Slider**: For older laptops or integrated GPUs, set particle density to 10,000–15,000 particles using the HUD slider.

---

## 🔮 Future Enhancements

- [ ] Custom GLSL GPGPU compute shaders for 100,000+ particle simulations.
- [ ] Multi-hand collaborative mode via WebRTC peer-to-peer data channels.
- [ ] VR / WebXR hand tracking mode for Apple Vision Pro and Meta Quest 3.
- [ ] Custom 3D mesh OBJ/GLTF file importer allowing users to morph particles into custom 3D models.

---

## 📄 License

MIT License © 2026 GestureFlow 3D Team.
