/**
 * GestureFlow 3D - Optimized Ambient Audio Synthesizer (Web Audio API)
 * Generates reactive ambient soundscapes with throttled parameter dispatch
 * to prevent unnecessary main thread audio overhead.
 */

export class AmbientSynthesizer {
  constructor() {
    this.ctx = null;
    this.isEnabled = false;
    this.masterGain = null;
    
    // Sound generators
    this.oscillators = [];
    this.filter = null;
    this.noiseNode = null;
    this.noiseGain = null;

    // Parameter throttling (updates audio thread at 20Hz)
    this.lastAudioUpdate = 0;
    this.audioUpdateInterval = 50; // ms
    this.prevFreq = 450;
    this.prevQ = 4.0;
  }

  /**
   * Initialize audio context on first user interaction
   */
  async start() {
    if (this.ctx && this.ctx.state === 'suspended') {
      await this.ctx.resume();
      this.isEnabled = true;
      return true;
    }

    if (this.ctx) {
      this.isEnabled = true;
      return true;
    }

    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioContext();

      // Master output gain
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(0.15, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);

      // Resonant Lowpass Filter
      this.filter = this.ctx.createBiquadFilter();
      this.filter.type = 'lowpass';
      this.filter.frequency.setValueAtTime(450, this.ctx.currentTime);
      this.filter.Q.setValueAtTime(4.0, this.ctx.currentTime);
      this.filter.connect(this.masterGain);

      // Ambient Chord Oscillators (Cosmic Dm9 / Fmaj7 chord frequencies)
      const freqs = [73.42, 110.0, 164.81, 220.0, 329.63, 440.0];
      this.oscillators = freqs.map((freq, i) => {
        const osc = this.ctx.createOscillator();
        const oscGain = this.ctx.createGain();

        osc.type = i % 2 === 0 ? 'sine' : 'triangle';
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        osc.detune.setValueAtTime((Math.random() - 0.5) * 15, this.ctx.currentTime);

        const gainVal = 0.12 / (i + 1);
        oscGain.gain.setValueAtTime(gainVal, this.ctx.currentTime);

        osc.connect(oscGain);
        oscGain.connect(this.filter);
        osc.start();

        return { osc, gain: oscGain, baseFreq: freq };
      });

      // Subtle whoosh noise generator for fast hand swipes
      const bufferSize = this.ctx.sampleRate * 2;
      const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }

      this.noiseNode = this.ctx.createBufferSource();
      this.noiseNode.buffer = noiseBuffer;
      this.noiseNode.loop = true;

      const noiseFilter = this.ctx.createBiquadFilter();
      noiseFilter.type = 'bandpass';
      noiseFilter.frequency.setValueAtTime(800, this.ctx.currentTime);
      noiseFilter.Q.setValueAtTime(2.0, this.ctx.currentTime);

      this.noiseGain = this.ctx.createGain();
      this.noiseGain.gain.setValueAtTime(0.0, this.ctx.currentTime);

      this.noiseNode.connect(noiseFilter);
      noiseFilter.connect(this.noiseGain);
      this.noiseGain.connect(this.masterGain);
      this.noiseNode.start();

      this.isEnabled = true;
      return true;
    } catch (e) {
      console.warn('Web Audio could not be initialized:', e);
      return false;
    }
  }

  toggle() {
    if (!this.ctx) {
      return this.start();
    }
    if (this.ctx.state === 'running' && this.isEnabled) {
      this.masterGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05);
      this.isEnabled = false;
      return false;
    } else {
      this.ctx.resume();
      this.masterGain.gain.setTargetAtTime(0.15, this.ctx.currentTime, 0.05);
      this.isEnabled = true;
      return true;
    }
  }

  /**
   * Modulate audio parameters throttled to 20Hz
   */
  update(gestureState, handData) {
    if (!this.isEnabled || !this.ctx || !this.filter) return;

    const now = performance.now();
    if (now - this.lastAudioUpdate < this.audioUpdateInterval) return;
    this.lastAudioUpdate = now;

    const t = this.ctx.currentTime;
    const gesture = gestureState ? gestureState.name : 'NO HAND DETECTED';
    const speed = (handData && handData.speed) || 0;
    const pinchDist = handData ? handData.pinchDistance : 1.0;

    let targetFreq = 450;
    let targetQ = 4.0;
    let noiseTargetGain = Math.min(0.08, speed * 0.002);

    switch (gesture) {
      case 'OPEN PALM':
        targetFreq = 1200 + Math.min(1000, speed * 20);
        targetQ = 2.5;
        break;
      case 'FIST':
        targetFreq = 160;
        targetQ = 8.0;
        break;
      case 'PINCH':
        targetFreq = 300 + (1.0 - Math.min(1.0, pinchDist / 0.1)) * 1400;
        targetQ = 6.0;
        break;
      case 'POINT':
        targetFreq = 900;
        targetQ = 5.0;
        break;
      case 'FAST SWIPE':
        targetFreq = 1800;
        noiseTargetGain = 0.15;
        break;
      default:
        targetFreq = 450;
        break;
    }

    if (Math.abs(targetFreq - this.prevFreq) > 10 || Math.abs(targetQ - this.prevQ) > 0.2) {
      this.filter.frequency.setTargetAtTime(targetFreq, t, 0.1);
      this.filter.Q.setTargetAtTime(targetQ, t, 0.1);
      this.prevFreq = targetFreq;
      this.prevQ = targetQ;
    }

    if (this.noiseGain) {
      this.noiseGain.gain.setTargetAtTime(noiseTargetGain, t, 0.05);
    }
  }
}
