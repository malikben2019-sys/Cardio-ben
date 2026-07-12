// audio.js — sound cues, speech, synthesized background music, haptics
export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.musicGain = null;
    this.musicLoopId = null;
    this.noiseBuffer = null;
    this.nextStepTime = 0;
    this.step16 = 0;
    this.enabled = true;
    this.musicStyle = 'energy'; // 'energy' | 'rock' | 'off'
    this.hapticsEnabled = true;
    this.speechLang = 'ar-SA';
    this.BASSLINE_ENERGY = [110, 110, 130.81, 98];
    this.BASSLINE_ROCK = [82.41, 82.41, 98, 87.31];
  }

  getCtx() {
    if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  }

  getNoiseBuffer(ctx) {
    if (this.noiseBuffer) return this.noiseBuffer;
    const len = ctx.sampleRate * 0.3;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2);
    this.noiseBuffer = buf;
    return buf;
  }

  beep(freq = 880, duration = 150, vol = 0.2) {
    if (!this.enabled) return;
    try {
      const ctx = this.getCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = freq;
      osc.type = 'sine';
      osc.connect(gain); gain.connect(ctx.destination);
      gain.gain.setValueAtTime(vol, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration / 1000);
      osc.start(); osc.stop(ctx.currentTime + duration / 1000);
    } catch (e) {}
  }

  tickSound(isTock) { this.beep(isTock ? 700 : 1000, 90, 0.15); }

  vibrate(pattern) {
    if (!this.hapticsEnabled) return;
    try { if (navigator.vibrate) navigator.vibrate(pattern); } catch (e) {}
  }

  duckMusic() {
    if (!this.musicGain) return;
    const ctx = this.getCtx();
    const now = ctx.currentTime;
    this.musicGain.gain.cancelScheduledValues(now);
    this.musicGain.gain.setValueAtTime(this.musicGain.gain.value, now);
    this.musicGain.gain.linearRampToValueAtTime(0.10, now + 0.15);
    this.musicGain.gain.linearRampToValueAtTime(0.35, now + 1.2);
  }

  speak(text) {
    if (!this.enabled) return;
    this.duckMusic();
    try {
      if (!('speechSynthesis' in window)) return;
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = this.speechLang;
      u.rate = 1.1;
      u.pitch = 1.05;
      window.speechSynthesis.speak(u);
    } catch (e) {}
  }

  playKick(t, punchy) {
    const ctx = this.getCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(punchy ? 170 : 150, t);
    osc.frequency.exponentialRampToValueAtTime(45, t + (punchy ? 0.10 : 0.14));
    gain.gain.setValueAtTime(0.95, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + (punchy ? 0.18 : 0.22));
    osc.connect(gain); gain.connect(this.musicGain);
    osc.start(t); osc.stop(t + 0.25);
  }
  playHat(t, open) {
    const ctx = this.getCtx();
    const src = ctx.createBufferSource();
    src.buffer = this.getNoiseBuffer(ctx);
    const filt = ctx.createBiquadFilter();
    filt.type = 'highpass'; filt.frequency.value = 8000;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(open ? 0.12 : 0.07, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + (open ? 0.16 : 0.045));
    src.connect(filt); filt.connect(gain); gain.connect(this.musicGain);
    src.start(t); src.stop(t + 0.2);
  }
  playClapOrSnare(t, snare) {
    const ctx = this.getCtx();
    const src = ctx.createBufferSource();
    src.buffer = this.getNoiseBuffer(ctx);
    const filt = ctx.createBiquadFilter();
    filt.type = 'bandpass'; filt.frequency.value = snare ? 2200 : 1500; filt.Q.value = 0.8;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(snare ? 0.32 : 0.28, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + (snare ? 0.14 : 0.18));
    src.connect(filt); filt.connect(gain); gain.connect(this.musicGain);
    src.start(t); src.stop(t + 0.2);
  }
  playBass(t, freq, dur, power) {
    const ctx = this.getCtx();
    const gain = ctx.createGain();
    const filt = ctx.createBiquadFilter();
    filt.type = 'lowpass'; filt.frequency.value = power ? 900 : 500;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(power ? 0.22 : 0.18, t + 0.02);
    gain.gain.linearRampToValueAtTime(0.001, t + dur);
    filt.connect(gain); gain.connect(this.musicGain);
    const osc1 = ctx.createOscillator();
    osc1.type = 'sawtooth'; osc1.frequency.value = freq;
    osc1.connect(filt); osc1.start(t); osc1.stop(t + dur + 0.05);
    if (power) {
      const osc2 = ctx.createOscillator();
      osc2.type = 'sawtooth'; osc2.frequency.value = freq * 1.5;
      osc2.connect(filt); osc2.start(t); osc2.stop(t + dur + 0.05);
    }
  }

  scheduleMusicLoop() {
    if (!this.musicGain || !this.enabled || this.musicStyle === 'off') {
      this.musicLoopId = setTimeout(() => this.scheduleMusicLoop(), 150);
      return;
    }
    const ctx = this.getCtx();
    const bpm = this.musicStyle === 'rock' ? 140 : 128;
    const stepTime = 60 / bpm / 4;
    while (this.nextStepTime < ctx.currentTime + 0.15) {
      const s = this.step16 % 16;
      if (this.musicStyle === 'rock') {
        if (s % 4 === 0) this.playKick(this.nextStepTime, true);
        if (s === 4 || s === 12) this.playClapOrSnare(this.nextStepTime, true);
        if (s % 4 === 2) this.playHat(this.nextStepTime, false);
        if (s % 4 === 0) this.playBass(this.nextStepTime, this.BASSLINE_ROCK[Math.floor(this.step16 / 16) % this.BASSLINE_ROCK.length], stepTime * 3.5, true);
      } else {
        if (s % 4 === 0) this.playKick(this.nextStepTime, false);
        if (s === 4 || s === 12) this.playClapOrSnare(this.nextStepTime, false);
        if (s % 2 === 0) this.playHat(this.nextStepTime, s % 8 === 6);
        if (s % 8 === 0) this.playBass(this.nextStepTime, this.BASSLINE_ENERGY[Math.floor(this.step16 / 16) % this.BASSLINE_ENERGY.length], stepTime * 7, false);
      }
      this.nextStepTime += stepTime;
      this.step16++;
    }
    this.musicLoopId = setTimeout(() => this.scheduleMusicLoop(), 40);
  }

  initMusic() {
    if (this.musicStyle === 'off') return;
    const ctx = this.getCtx();
    if (!this.musicGain) {
      this.musicGain = ctx.createGain();
      this.musicGain.gain.value = 0.35;
      this.musicGain.connect(ctx.destination);
    }
    if (!this.musicLoopId) {
      this.nextStepTime = ctx.currentTime + 0.05;
      this.step16 = 0;
      this.scheduleMusicLoop();
    }
  }

  stopMusic() {
    if (this.musicLoopId) { clearTimeout(this.musicLoopId); this.musicLoopId = null; }
  }

  setEnabled(enabled) {
    this.enabled = enabled;
    if (enabled) { this.getCtx(); this.initMusic(); } else { this.stopMusic(); }
  }

  setMusicStyle(style) {
    this.musicStyle = style;
    if (style === 'off') this.stopMusic();
    else if (this.enabled) this.initMusic();
  }
}
