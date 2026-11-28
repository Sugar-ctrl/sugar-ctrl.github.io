/* Tiny WebAudio chiptune sound effects. No audio files, no dependencies. */
(function (global) {
  'use strict';

  const PJ = global.PJ || (global.PJ = {});

  const MUSIC_BPM = 70;
  const MUSIC_STEP = 60 / MUSIC_BPM / 2;
  const MUSIC_CHORDS = [
    [146.83, 174.61, 220.00], // Dm
    [116.54, 146.83, 174.61], // Bb
    [87.31, 130.81, 174.61],  // F
    [130.81, 164.81, 196.00], // C
    [146.83, 174.61, 220.00], // Dm
    [116.54, 146.83, 174.61], // Bb
    [98.00, 116.54, 146.83],  // Gm
    [110.00, 138.59, 164.81]  // A
  ];
  const MUSIC_ROOTS = [73.42, 58.27, 87.31, 65.41, 73.42, 58.27, 49.00, 55.00];
  const MUSIC_ARP = [0, 2, 1, 2, 0, 1, 2, 1];

  function readMuted() {
    try {
      return global.localStorage && global.localStorage.getItem('pixel-runner-muted') === '1';
    } catch (error) {
      return false;
    }
  }

  class Sfx {
    constructor() {
      this.ctx = null;
      this.master = null;
      this.muted = readMuted();
      this.volume = 1;
      this.baseGain = 0.24;
      this.globalGain = 3;
      this.limiter = null;

      // The original ambient score lives on its own bus so the SFX and music
      // sliders can be mixed independently. Muting still silences both.
      this.musicGain = null;
      this.musicVolume = 0.55;
      this.musicTimer = null;
      this.musicStep = 0;
      this.musicNextTime = 0;
      this.musicWind = null;
    }

    _targetGain() {
      return this.muted ? 0 : this.baseGain * this.volume * this.globalGain;
    }

    _musicTargetGain() {
      return this.muted ? 0 : this.musicVolume * this.globalGain;
    }

    init() {
      if (this.ctx) {
        this.resume();
        return;
      }

      const AudioContextClass = global.AudioContext || global.webkitAudioContext;
      if (!AudioContextClass) return;

      try {
        this.ctx = new AudioContextClass();
        // All buses share this final safety limiter so the 3x ceiling stays
        // loud without hard-clipping stacked pads and effects.
        this.limiter = this.ctx.createDynamicsCompressor();
        this.limiter.threshold.value = -3;
        this.limiter.knee.value = 0;
        this.limiter.ratio.value = 20;
        this.limiter.attack.value = 0.003;
        this.limiter.release.value = 0.22;
        this.limiter.connect(this.ctx.destination);

        this.master = this.ctx.createGain();
        this.master.gain.value = this._targetGain();
        this.master.connect(this.limiter);

        this.musicGain = this.ctx.createGain();
        this.musicGain.gain.value = this._musicTargetGain();
        this.musicGain.connect(this.limiter);
        this._startMusic();
      } catch (error) {
        this.ctx = null;
        this.master = null;
        this.musicGain = null;
        this.limiter = null;
      }
    }

    setVolume(volume) {
      this.volume = Math.max(0, Math.min(1, Number(volume) || 0));
      if (this.master && this.ctx) {
        const now = this.ctx.currentTime;
        this.master.gain.cancelScheduledValues(now);
        this.master.gain.setTargetAtTime(this._targetGain(), now, 0.015);
      }
      return this.volume;
    }

    getVolume() {
      return this.volume;
    }

    setMusicVolume(volume) {
      this.musicVolume = Math.max(0, Math.min(1, Number(volume) || 0));
      if (this.musicGain && this.ctx) {
        const now = this.ctx.currentTime;
        this.musicGain.gain.cancelScheduledValues(now);
        this.musicGain.gain.setTargetAtTime(this._musicTargetGain(), now, 0.035);
      }
      return this.musicVolume;
    }

    getMusicVolume() {
      return this.musicVolume;
    }

    resume() {
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume().catch(function () {});
      }
    }

    setMuted(muted) {
      this.muted = !!muted;
      try {
        if (global.localStorage) {
          global.localStorage.setItem('pixel-runner-muted', this.muted ? '1' : '0');
        }
      } catch (error) {
        /* localStorage may be unavailable in private/file contexts. */
      }
      if (this.master && this.ctx) {
        const now = this.ctx.currentTime;
        this.master.gain.cancelScheduledValues(now);
        this.master.gain.setTargetAtTime(this._targetGain(), now, 0.01);
        if (this.musicGain) {
          this.musicGain.gain.cancelScheduledValues(now);
          this.musicGain.gain.setTargetAtTime(this._musicTargetGain(), now, 0.01);
        }
      }
    }

    toggleMute() {
      this.setMuted(!this.muted);
      return this.muted;
    }

    _startMusic() {
      if (!this.ctx || !this.musicGain || this.musicTimer) return;
      this.musicStep = 0;
      this.musicNextTime = this.ctx.currentTime + 0.18;
      this._buildWind();
      this.musicTimer = global.setInterval(() => this._scheduleMusic(), 120);
      this._scheduleMusic();
    }

    _buildWind() {
      if (!this.ctx || !this.musicGain || this.musicWind) return;
      const length = Math.floor(this.ctx.sampleRate * 2);
      const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      let air = 0;
      for (let i = 0; i < length; i++) {
        air = air * 0.985 + (Math.random() * 2 - 1) * 0.015;
        data[i] = air;
      }
      const source = this.ctx.createBufferSource();
      const filter = this.ctx.createBiquadFilter();
      const gain = this.ctx.createGain();
      source.buffer = buffer;
      source.loop = true;
      filter.type = 'lowpass';
      filter.frequency.value = 420;
      filter.Q.value = 0.4;
      gain.gain.value = 0.018;
      source.connect(filter);
      filter.connect(gain);
      gain.connect(this.musicGain);
      source.start();
      this.musicWind = source;
    }

    _scheduleMusic() {
      if (!this.ctx || !this.musicGain) return;
      const now = this.ctx.currentTime;
      let guard = 0;
      while (this.musicNextTime < now + 0.7 && guard < 10) {
        this._scheduleMusicStep(this.musicStep, this.musicNextTime, MUSIC_STEP);
        this.musicStep = (this.musicStep + 1) % 64;
        this.musicNextTime += MUSIC_STEP;
        guard += 1;
      }
    }

    _scheduleMusicStep(step, when, stepDuration) {
      if (!this.ctx || !this.musicGain) return;

      const bar = Math.floor(step / 8) % 8;
      const chord = MUSIC_CHORDS[bar];
      const barTime = step % 8 === 0;

      if (barTime) {
        const barLength = stepDuration * 8;
        for (let i = 0; i < chord.length; i++) {
          this._musicVoice(chord[i], when, barLength * 0.96, 'triangle', 0.011, 0.7);
          this._musicVoice(chord[i] * 1.003, when, barLength * 0.92, 'sine', 0.0055, 0.9);
        }
        this._musicVoice(MUSIC_ROOTS[bar], when, barLength * 0.94, 'sine', 0.032, 0.35);
        this._musicVoice(MUSIC_ROOTS[bar] * 1.5, when + 0.04, barLength * 0.78, 'triangle', 0.006, 0.5);
      }

      if (step % 2 === 0) {
        const note = chord[MUSIC_ARP[(step >> 1) % 8]] * 2;
        this._musicVoice(note, when, stepDuration * 0.72, 'triangle', 0.0065, 0.012);
      }

      if (step % 16 === 12) {
        const bell = chord[2] * 4;
        this._musicVoice(bell, when, 0.9, 'sine', 0.004, 0.02);
        this._musicVoice(bell * 1.5, when + 0.06, 0.65, 'sine', 0.0025, 0.02);
      }
    }

    _musicVoice(frequency, when, duration, type, volume, attack) {
      if (!this.ctx || !this.musicGain) return;
      const start = Math.max(this.ctx.currentTime + 0.005, when);
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type || 'sine';
      osc.frequency.setValueAtTime(Math.max(20, frequency), start);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.linearRampToValueAtTime(Math.max(0.0002, volume), start + Math.max(0.01, attack || 0.02));
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      osc.connect(gain);
      gain.connect(this.musicGain);
      osc.start(start);
      osc.stop(start + duration + 0.04);
    }

    _tone(frequency, duration, options) {
      if (this.muted || !this.ctx || !this.master) return;
      const opts = options || {};
      const now = this.ctx.currentTime + (opts.delay || 0);
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const volume = opts.volume == null ? 0.07 : opts.volume;
      const attack = opts.attack == null ? 0.006 : opts.attack;

      osc.type = opts.type || 'square';
      osc.frequency.setValueAtTime(Math.max(20, frequency), now);
      if (opts.slideTo) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(20, opts.slideTo), now + duration);
      }

      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume), now + attack);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

      osc.connect(gain);
      gain.connect(this.master);
      osc.start(now);
      osc.stop(now + duration + 0.03);
    }

    _notes(notes, options) {
      const opts = options || {};
      const step = opts.step || 0.08;
      for (let i = 0; i < notes.length; i++) {
        this._tone(notes[i], opts.duration || 0.09, {
          type: opts.type || 'square',
          volume: opts.volume == null ? 0.06 : opts.volume,
          delay: i * step,
          attack: 0.004
        });
      }
    }

    click() {
      if (!this.ctx) this.init();
      this._tone(760, 0.035, { type: 'square', volume: 0.04 });
    }

    jump() {
      this._tone(290, 0.12, { type: 'square', volume: 0.065, slideTo: 560 });
      this._tone(580, 0.06, { type: 'triangle', volume: 0.025, delay: 0.03 });
    }

    land() {
      this._tone(95, 0.055, { type: 'triangle', volume: 0.055, slideTo: 60 });
    }

    gem() {
      this._tone(1040, 0.07, { type: 'triangle', volume: 0.07 });
      this._tone(1560, 0.11, { type: 'square', volume: 0.04, delay: 0.055 });
    }

    stomp() {
      this._tone(200, 0.09, { type: 'square', volume: 0.075, slideTo: 70 });
      this._tone(440, 0.05, { type: 'triangle', volume: 0.035, delay: 0.02 });
    }

    hurt() {
      this._tone(260, 0.3, { type: 'sawtooth', volume: 0.08, slideTo: 62 });
      this._tone(130, 0.22, { type: 'square', volume: 0.04, slideTo: 40, delay: 0.04 });
    }

    checkpoint() {
      this._notes([523, 659, 784], { step: 0.075, duration: 0.12, type: 'triangle', volume: 0.065 });
    }

    win() {
      this._notes([523, 659, 784, 1046, 784, 1046, 1318], {
        step: 0.1,
        duration: 0.2,
        type: 'square',
        volume: 0.055
      });
    }

    pause() {
      this._tone(440, 0.06, { type: 'square', volume: 0.035 });
      this._tone(330, 0.08, { type: 'square', volume: 0.03, delay: 0.06 });
    }

    timeShift() {
      this._tone(196, 0.34, { type: 'triangle', volume: 0.055, slideTo: 784 });
      this._tone(392, 0.22, { type: 'sine', volume: 0.035, slideTo: 1046, delay: 0.06 });
      this._tone(784, 0.12, { type: 'triangle', volume: 0.025, delay: 0.2 });
    }
  }

  PJ.Sfx = Sfx;
})(typeof window !== 'undefined' ? window : globalThis);
