/* Pixel Runner — core constants, input, collision helpers and the tiny pixel font.
   Classic scripts are used on purpose so index.html also works from file://. */
(function (global) {
  'use strict';

  const PJ = global.PJ || (global.PJ = {});

  const TILE = 16;
  const VIEW_W = 480;
  const VIEW_H = 270;

  const TILE_EMPTY = 0;
  const TILE_SOLID = 1;
  const TILE_SPIKE = 2;

  const EPS = 0.0001;

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function approach(value, target, amount) {
    if (value < target) return Math.min(value + amount, target);
    if (value > target) return Math.max(value - amount, target);
    return target;
  }

  function rectsOverlap(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  function pad2(value) {
    return value < 10 ? '0' + value : String(value);
  }

  function formatTime(seconds) {
    const safe = Math.max(0, Math.floor(seconds));
    const minutes = Math.floor(safe / 60);
    const rest = safe % 60;
    return pad2(minutes) + ':' + pad2(rest);
  }

  // Stable pseudo-random value for a tile, so the art looks hand-dithered without
  // changing from frame to frame.
  function hash2(x, y) {
    let n = (x | 0) * 374761393 + (y | 0) * 668265263;
    n = (n ^ (n >> 13)) * 1274126177;
    n = n ^ (n >> 16);
    return (n >>> 0) / 4294967296;
  }

  function hexToRgb(hex) {
    const clean = String(hex).replace('#', '');
    const value = parseInt(clean.length === 3 ? clean.replace(/(.)/g, '$1$1') : clean, 16);
    return {
      r: (value >> 16) & 255,
      g: (value >> 8) & 255,
      b: value & 255
    };
  }

  function mixColor(from, to, amount) {
    const a = hexToRgb(from);
    const b = hexToRgb(to);
    const t = clamp(amount, 0, 1);
    const r = Math.round(a.r + (b.r - a.r) * t);
    const g = Math.round(a.g + (b.g - a.g) * t);
    const b2 = Math.round(a.b + (b.b - a.b) * t);
    return 'rgb(' + r + ',' + g + ',' + b2 + ')';
  }

  /**
   * Axis-separated AABB movement against a tile level.
   * Bodies are plain {x, y, w, h}.  The tiny sub-steps keep fast-moving bodies
   * from tunnelling through a one-tile wall.
   */
  function moveBodyX(body, dx, level) {
    if (!dx) return false;
    const steps = Math.max(1, Math.ceil(Math.abs(dx) / (TILE * 0.5)));
    const step = dx / steps;

    for (let i = 0; i < steps; i++) {
      body.x += step;
      const top = Math.floor((body.y + EPS) / TILE);
      const bottom = Math.floor((body.y + body.h - EPS) / TILE);

      if (step > 0) {
        const tx = Math.floor((body.x + body.w - EPS) / TILE);
        for (let ty = top; ty <= bottom; ty++) {
          if (level.tileAt(tx, ty) === TILE_SOLID) {
            body.x = tx * TILE - body.w;
            return true;
          }
        }
      } else {
        const tx = Math.floor((body.x + EPS) / TILE);
        for (let ty = top; ty <= bottom; ty++) {
          if (level.tileAt(tx, ty) === TILE_SOLID) {
            body.x = (tx + 1) * TILE;
            return true;
          }
        }
      }
    }
    return false;
  }

  function moveBodyY(body, dy, level) {
    const result = { grounded: false, ceiling: false };
    if (!dy) return result;

    const steps = Math.max(1, Math.ceil(Math.abs(dy) / (TILE * 0.5)));
    const step = dy / steps;

    for (let i = 0; i < steps; i++) {
      body.y += step;
      const left = Math.floor((body.x + EPS) / TILE);
      const right = Math.floor((body.x + body.w - EPS) / TILE);

      if (step > 0) {
        const ty = Math.floor((body.y + body.h - EPS) / TILE);
        for (let tx = left; tx <= right; tx++) {
          if (level.tileAt(tx, ty) === TILE_SOLID) {
            body.y = ty * TILE - body.h;
            result.grounded = true;
            return result;
          }
        }
      } else {
        const ty = Math.floor((body.y + EPS) / TILE);
        for (let tx = left; tx <= right; tx++) {
          if (level.tileAt(tx, ty) === TILE_SOLID) {
            body.y = (ty + 1) * TILE;
            result.ceiling = true;
            return result;
          }
        }
      }
    }
    return result;
  }

  function floorProbe(body, level, distance) {
    const probe = { x: body.x + 1, y: body.y + body.h, w: body.w - 2, h: distance || 2 };
    const left = Math.floor((probe.x + EPS) / TILE);
    const right = Math.floor((probe.x + probe.w - EPS) / TILE);
    const bottom = Math.floor((probe.y + probe.h - EPS) / TILE);
    for (let tx = left; tx <= right; tx++) {
      if (level.tileAt(tx, bottom) === TILE_SOLID) return true;
    }
    return false;
  }

  /* ------------------------------------------------------------------ */
  /* Input                                                              */
  /* ------------------------------------------------------------------ */

  const DEFAULT_BINDINGS = Object.freeze({
    left: ['ArrowLeft', 'KeyA'],
    right: ['ArrowRight', 'KeyD'],
    jump: ['ArrowUp', 'KeyW', 'Space', 'KeyJ'],
    down: ['KeyS', 'ArrowDown'],
    pause: ['Escape', 'KeyP'],
    restart: ['KeyR'],
    time: ['KeyT'],
    talk: ['KeyE']
  });

  const DEFAULT_TUNING = Object.freeze({
    runSpeed: 118,
    jumpSpeed: 340,
    gravity: 1120,
    icePushAccel: 420,
    iceFriction: 88,
    iceMaxSpeed: 60,
    meltScale: 1,
    nightChill: 11,
    sunWarmth: 20,
    timeEase: 4.2
  });

  function cloneBindings(bindings) {
    const source = bindings || DEFAULT_BINDINGS;
    const out = {};
    Object.keys(DEFAULT_BINDINGS).forEach((action) => {
      const value = source[action];
      out[action] = Array.isArray(value) && value.length
        ? value.filter((code) => typeof code === 'string' && code.length > 0).slice(0, 4)
        : DEFAULT_BINDINGS[action].slice();
      if (!out[action].length) out[action] = DEFAULT_BINDINGS[action].slice();
    });
    return out;
  }

  class Input {
    constructor() {
      this._keys = new Set();
      this._virtual = new Set();
      this.pressed = new Set();
      this.released = new Set();
      this.bindings = cloneBindings();
      this._codeToAction = new Map();
      this.suspended = false;

      this._onKeyDown = (event) => {
        if (this.suspended) return;
        const action = this._codeToAction.get(event.code);
        if (!action) return;
        event.preventDefault();
        if (event.repeat) return;
        this._keys.add(action);
        this.pressed.add(action);
        this.released.delete(action);
      };

      this._onKeyUp = (event) => {
        if (this.suspended) return;
        const action = this._codeToAction.get(event.code);
        if (!action) return;
        event.preventDefault();
        this._keys.delete(action);
        this.released.add(action);
        this.pressed.delete(action);
      };

      this._onBlur = () => {
        this._keys.clear();
        this._virtual.clear();
        this.pressed.clear();
      };

      if (global.window && global.window.addEventListener) {
        global.window.addEventListener('keydown', this._onKeyDown, { passive: false });
        global.window.addEventListener('keyup', this._onKeyUp, { passive: false });
        global.window.addEventListener('blur', this._onBlur);
      }

      this.setBindings(this.bindings);
    }

    setBindings(bindings) {
      this.bindings = cloneBindings(bindings);
      this._codeToAction.clear();
      Object.keys(this.bindings).forEach((action) => {
        this.bindings[action].forEach((code) => {
          if (!this._codeToAction.has(code)) this._codeToAction.set(code, action);
        });
      });
      this.clearAll();
      return this.bindings;
    }

    matches(action, code) {
      return (this.bindings[action] || []).indexOf(code) !== -1;
    }

    setSuspended(suspended) {
      this.suspended = !!suspended;
      if (this.suspended) this.clearAll();
    }

    isDown(action) {
      return this._keys.has(action) || this._virtual.has(action);
    }

    wasPressed(action) {
      return this.pressed.has(action);
    }

    wasReleased(action) {
      return this.released.has(action);
    }

    setVirtual(action, down) {
      const wasDown = this.isDown(action);
      if (down) this._virtual.add(action);
      else this._virtual.delete(action);
      const isDown = this.isDown(action);

      if (!wasDown && isDown) {
        this.pressed.add(action);
        this.released.delete(action);
      } else if (wasDown && !isDown) {
        this.released.add(action);
        this.pressed.delete(action);
      }
    }

    endFrame() {
      this.pressed.clear();
      this.released.clear();
    }

    clearAll() {
      this._keys.clear();
      this._virtual.clear();
      this.pressed.clear();
      this.released.clear();
    }
  }

  /* ------------------------------------------------------------------ */
  /* 5x7 pixel font (uppercase only)                                    */
  /* ------------------------------------------------------------------ */

  const GLYPHS = {
    ' ': ['00000', '00000', '00000', '00000', '00000', '00000', '00000'],
    A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
    B: ['11110', '10001', '10001', '11110', '10001', '10001', '11110'],
    C: ['01110', '10001', '10000', '10000', '10000', '10001', '01110'],
    D: ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
    E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
    F: ['11111', '10000', '10000', '11110', '10000', '10000', '10000'],
    G: ['01110', '10001', '10000', '10111', '10001', '10001', '01111'],
    H: ['10001', '10001', '10001', '11111', '10001', '10001', '10001'],
    I: ['11111', '00100', '00100', '00100', '00100', '00100', '11111'],
    J: ['00111', '00010', '00010', '00010', '10010', '10010', '01100'],
    K: ['10001', '10010', '10100', '11000', '10100', '10010', '10001'],
    L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
    M: ['10001', '11011', '10101', '10101', '10001', '10001', '10001'],
    N: ['10001', '11001', '10101', '10011', '10001', '10001', '10001'],
    O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
    P: ['11110', '10001', '10001', '11110', '10000', '10000', '10000'],
    Q: ['01110', '10001', '10001', '10001', '10101', '10010', '01101'],
    R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
    S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
    T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
    U: ['10001', '10001', '10001', '10001', '10001', '10001', '01110'],
    V: ['10001', '10001', '10001', '10001', '10001', '01010', '00100'],
    W: ['10001', '10001', '10001', '10101', '10101', '10101', '01010'],
    X: ['10001', '10001', '01010', '00100', '01010', '10001', '10001'],
    Y: ['10001', '10001', '01010', '00100', '00100', '00100', '00100'],
    Z: ['11111', '00001', '00010', '00100', '01000', '10000', '11111'],
    '0': ['01110', '10001', '10011', '10101', '11001', '10001', '01110'],
    '1': ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
    '2': ['01110', '10001', '00001', '00010', '00100', '01000', '11111'],
    '3': ['11111', '00010', '00100', '00010', '00001', '10001', '01110'],
    '4': ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
    '5': ['11111', '10000', '11110', '00001', '00001', '10001', '01110'],
    '6': ['00110', '01000', '10000', '11110', '10001', '10001', '01110'],
    '7': ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
    '8': ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
    '9': ['01110', '10001', '10001', '01111', '00001', '00010', '01100'],
    ':': ['00000', '00100', '00100', '00000', '00100', '00100', '00000'],
    '/': ['00001', '00001', '00010', '00100', '01000', '10000', '10000'],
    '-': ['00000', '00000', '00000', '11111', '00000', '00000', '00000'],
    '.': ['00000', '00000', '00000', '00000', '00000', '00110', '00110'],
    '!': ['00100', '00100', '00100', '00100', '00100', '00000', '00100'],
    '?': ['01110', '10001', '00001', '00010', '00100', '00000', '00100'],
    '+': ['00000', '00100', '00100', '11111', '00100', '00100', '00000'],
    '%': ['11001', '11010', '00100', '01000', '10011', '00011', '00000'],
    '<': ['00010', '00100', '01000', '10000', '01000', '00100', '00010'],
    '>': ['01000', '00100', '00010', '00001', '00010', '00100', '01000']
  };

  class PixelFont {
    static width(text, scale) {
      const s = scale || 1;
      return Math.max(0, text.length * 6 * s - s);
    }

    static draw(ctx, text, x, y, color, scale, align) {
      const s = scale || 1;
      const upper = String(text).toUpperCase();
      let startX = x;
      const width = PixelFont.width(upper, s);
      if (align === 'center') startX = x - Math.floor(width / 2);
      else if (align === 'right') startX = x - width;

      ctx.fillStyle = color;
      for (let i = 0; i < upper.length; i++) {
        const glyph = GLYPHS[upper[i]] || GLYPHS['?'];
        const gx = startX + i * 6 * s;
        for (let row = 0; row < 7; row++) {
          for (let col = 0; col < 5; col++) {
            if (glyph[row][col] === '1') {
              ctx.fillRect(gx + col * s, y + row * s, s, s);
            }
          }
        }
      }
    }
  }

  PJ.TILE = TILE;
  PJ.VIEW_W = VIEW_W;
  PJ.VIEW_H = VIEW_H;
  PJ.TILE_EMPTY = TILE_EMPTY;
  PJ.TILE_SOLID = TILE_SOLID;
  PJ.TILE_SPIKE = TILE_SPIKE;
  PJ.clamp = clamp;
  PJ.lerp = lerp;
  PJ.approach = approach;
  PJ.rectsOverlap = rectsOverlap;
  PJ.formatTime = formatTime;
  PJ.pad2 = pad2;
  PJ.hash2 = hash2;
  PJ.hexToRgb = hexToRgb;
  PJ.mixColor = mixColor;
  PJ.DEFAULT_BINDINGS = DEFAULT_BINDINGS;
  PJ.DEFAULT_TUNING = DEFAULT_TUNING;
  PJ.cloneBindings = cloneBindings;
  PJ.TUNING = Object.assign({}, DEFAULT_TUNING);
  PJ.moveBodyX = moveBodyX;
  PJ.moveBodyY = moveBodyY;
  PJ.floorProbe = floorProbe;
  PJ.Input = Input;
  PJ.PixelFont = PixelFont;
})(typeof window !== 'undefined' ? window : globalThis);
