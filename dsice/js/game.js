/* Main game simulation + renderer. The class only needs a canvas-like object,
   so a headless smoke test can render it with a no-op 2D context. */
(function (global) {
  'use strict';

  const PJ = global.PJ || (global.PJ = {});
  const TILE = PJ.TILE;
  const VIEW_W = PJ.VIEW_W;
  const VIEW_H = PJ.VIEW_H;
  const clamp = PJ.clamp;
  const lerp = PJ.lerp;
  const PixelFont = PJ.PixelFont;

  const SKY_STOPS = [0, 42, 88, 134, 180, 218, 270];

  const DESERT_PALETTES = [
    {
      sky: ['#4b6b91', '#708ba6', '#b69b9c', '#e6b58a', '#f4cb98', '#dda87a'],
      sun: '#ffe4ad',
      sunGlow: '#f6ba79',
      mesaFar: '#6d5361',
      mesaNear: '#594151',
      duneFar: '#b57f65',
      duneMid: '#9c6755',
      duneNear: '#7f5049',
      duneLight: '#e2b184',
      ruin: '#6c4a46',
      cactus: '#355b48',
      haze: '#f2d39c',
      dust: '#ffd99c',
      shadow: '#493b4e'
    },
    {
      sky: ['#3d83b5', '#63a3c8', '#9fc3c8', '#e3d1a0', '#f4df9e', '#eac37e'],
      sun: '#fff7d2',
      sunGlow: '#ffe4a2',
      mesaFar: '#7c5d56',
      mesaNear: '#674a47',
      duneFar: '#c4946a',
      duneMid: '#ae7c58',
      duneNear: '#916148',
      duneLight: '#e8c28c',
      ruin: '#795649',
      cactus: '#3b6a51',
      haze: '#f8e3b3',
      dust: '#ffe8ad',
      shadow: '#59414a'
    },
    {
      sky: ['#302e53', '#583e61', '#8a5460', '#c56f5b', '#e18a63', '#b26955'],
      sun: '#ffd09a',
      sunGlow: '#ef8b62',
      mesaFar: '#503946',
      mesaNear: '#402c39',
      duneFar: '#8a5853',
      duneMid: '#72464a',
      duneNear: '#5d3941',
      duneLight: '#c58a6c',
      ruin: '#50353a',
      cactus: '#2e4a41',
      haze: '#e7a073',
      dust: '#ffbd82',
      shadow: '#31293f'
    },
    {
      sky: ['#080d1c', '#0d1529', '#142039', '#1d2c46', '#2b3550', '#403b4d'],
      sun: '#d9e8ff',
      sunGlow: '#6f93c9',
      mesaFar: '#20263a',
      mesaNear: '#171c2c',
      duneFar: '#313247',
      duneMid: '#282839',
      duneNear: '#1e1f2d',
      duneLight: '#6c6b80',
      ruin: '#151724',
      cactus: '#173038',
      haze: '#4b5d83',
      dust: '#b9c9e8',
      shadow: '#080b18'
    }
  ];

  class Game {
    constructor(options) {
      const opts = options || {};
      this.canvas = opts.canvas;
      this.ctx = this.canvas.getContext('2d');
      this.ctx.imageSmoothingEnabled = false;
      this.input = opts.input;
      this.sfx = opts.sfx || { jump() {}, land() {}, gem() {}, stomp() {}, hurt() {}, checkpoint() {}, win() {}, pause() {}, click() {} };
      this.onStateChange = opts.onStateChange || function () {};

      this.level = new PJ.Level(opts.level || PJ.LEVELS[0]);
      this.state = 'title';
      this.animTime = 0;
      this.runTime = 0;
      this.deaths = 0;
      this.collected = 0;
      this.camera = { x: 0, y: 0, shake: 0, lookX: 0 };
      this.particles = [];
      this.toast = null;
      this.flash = 0;
      this.dustTimer = 0;
      this.icePushDustTimer = 0;
      this.debug = false;
      this.platforms = [];
      this.jumpPads = [];
      this.slopes = [];
      this.playerPlatform = null;
      this.icePlatform = null;

      this.timeValue = 1;
      this.timeTarget = 1;
      this.timePreset = 1;
      this.timeShiftFlash = 0;
      this.isNight = false;
      this.nightFactor = 0;
      this.sun = { screenX: 275, screenY: 48, dirX: 0.05, dirY: -1, power: 1 };
      this.palette = null;
      this.chill = 0;
      this.playerSunlit = false;
      this.failReason = null;
      this.settingsOpen = false;
      this.controlSummary = null;

      this.spores = this._makeSpores();
      this.motes = this._makeMotes();

      // Background art is authored in the 480x270 logical space. Rendering it
      // once to a small buffer and upscaling keeps the layered desert art
      // cheap on the 3x game canvas.
      this.bgCanvas = null;
      this.bgCtx = null;
      if (typeof document !== 'undefined' && document.createElement) {
        const bg = document.createElement('canvas');
        bg.width = VIEW_W;
        bg.height = VIEW_H;
        const bgCtx = bg.getContext('2d');
        if (bgCtx) {
          bgCtx.imageSmoothingEnabled = false;
          this.bgCanvas = bg;
          this.bgCtx = bgCtx;
        }
      }

      this._createRun();
      this._snapCamera();
    }

    /* ---------------------------------------------------------------- */
    /* State                                                             */
    /* ---------------------------------------------------------------- */

    _setState(next, payload) {
      this.state = next;
      this.onStateChange(next, payload || null);
    }

    startRun() {
      this._createRun();
      this.runTime = 0;
      this.deaths = 0;
      this._setState('playing');
    }

    restartRun() {
      this._createRun();
      this.runTime = 0;
      this.deaths = 0;
      this._setState('playing');
    }

    _controlText() {
      return this.controlSummary ||
        'A / D 移动，Space 跳跃，贴着冰块走就能推动。T 循环时间，1 / 2 / 3 / 4 直接选择时段；点击顶部时间可以拨动完整日晷。R 重开。';
    }

    _nearestNpc() {
      if (!this.player || !this.npcs.length) {
        this.nearNpc = null;
        return null;
      }
      let best = null;
      let bestDistance = Infinity;
      for (let i = 0; i < this.npcs.length; i++) {
        const npc = this.npcs[i];
        const dx = Math.abs(this.player.centerX - (npc.x + npc.w / 2));
        const dy = Math.abs(this.player.y + this.player.h / 2 - (npc.y + npc.h / 2));
        if (dx < 55 && dy < 30 && dx < bestDistance) {
          best = npc;
          bestDistance = dx;
        }
      }
      this.nearNpc = best;
      return best;
    }

    _checkTutorialDialogue() {
      if (this.state !== 'playing' || this.dialogueActive) return false;
      const npc = this._nearestNpc();
      if (!npc || !npc.auto || npc.talked || !npc.lines.length) return false;
      return this.startDialogue(npc);
    }

    startDialogue(npc) {
      if (this.state !== 'playing') return false;
      const target = npc || this.nearNpc || this._nearestNpc();
      if (!target || !target.lines || !target.lines.length) return false;
      this.dialogueNpc = target;
      this.dialogueName = target.name;
      this.dialogueRole = target.role || '';
      this.dialogueLines = target.lines.map((line) => line.replace('{controls}', this._controlText()));
      this.dialogueIndex = 0;
      this.dialogueActive = true;
      target.talked = true;
      if (target === this.npcs[this.npcs.length - 1]) this.iceIntroduced = true;
      return true;
    }

    advanceDialogue() {
      if (!this.dialogueActive) return false;
      this.dialogueIndex += 1;
      if (this.dialogueIndex >= this.dialogueLines.length) {
        this.closeDialogue();
        return false;
      }
      return true;
    }

    closeDialogue() {
      if (!this.dialogueActive) return;
      this.dialogueActive = false;
      this.dialogueIndex = 0;
      if (this.dialogueNpc) this.dialogueNpc.talked = true;
      this.dialogueNpc = null;
    }

    getDialoguePage() {
      return {
        name: this.dialogueName,
        role: this.dialogueRole,
        text: this.dialogueLines[this.dialogueIndex] || '',
        index: this.dialogueIndex,
        total: this.dialogueLines.length,
        last: this.dialogueIndex >= this.dialogueLines.length - 1
      };
    }

    _dialogueNpcTooFar() {
      if (!this.dialogueNpc || !this.player) return false;
      const npc = this.dialogueNpc;
      const dx = Math.abs(this.player.centerX - (npc.x + npc.w / 2));
      const dy = Math.abs(this.player.y + this.player.h / 2 - (npc.y + npc.h / 2));
      return dx > 96 || dy > 64;
    }

    isNpcNear() {
      return !!this._nearestNpc();
    }

    npcContains(worldX, worldY) {
      for (let i = 0; i < this.npcs.length; i++) {
        const rect = this.npcs[i].getRect();
        if (worldX >= rect.x && worldX <= rect.x + rect.w &&
          worldY >= rect.y && worldY <= rect.y + rect.h) return true;
      }
      return false;
    }

    tryTalkNpc() {
      if (this.state !== 'playing' || this.dialogueActive || !this.isNpcNear()) return false;
      return this.startDialogue(this.nearNpc);
    }

    setControlSummary(text) {
      this.controlSummary = text || null;
    }

    toTitle() {
      this._createRun();
      this.runTime = 0;
      this.deaths = 0;
      this._snapCamera();
      this._setState('title');
    }

    togglePause() {
      if (this.state === 'playing') {
        this._setState('paused');
        this.sfx.pause();
      } else if (this.state === 'paused') {
        this._setState('playing');
        this.sfx.click();
      }
    }

    pause() {
      if (this.state === 'playing') {
        this.closeDialogue();
        this._setState('paused');
        this.sfx.pause();
      }
    }

    resume() {
      if (this.state === 'paused') {
        this._setState('playing');
        this.sfx.click();
      }
    }

    toggleDebug() {
      this.debug = !this.debug;
      return this.debug;
    }

    cycleTime() {
      if (this.state !== 'playing') return this.timeTarget;
      const next = ((this.timePreset == null ? Math.round(this.timeValue) : this.timePreset) + 1) % 4;
      this.timeTarget = this.timePreset === 3 && next === 0 ? 4 : next;
      this.timePreset = next;
      this.timeShiftFlash = 0.55;
      if (this.sfx.timeShift) this.sfx.timeShift();
      return this.timeTarget;
    }

    setTime(index) {
      if (this.state !== 'playing') return this.timeTarget;
      const next = clamp(index | 0, 0, 3);
      this.timePreset = next;
      this.timeTarget = next === 0 && this.timeValue > 2.5 ? 4 : next;
      this.timeShiftFlash = 0.55;
      if (this.sfx.timeShift) this.sfx.timeShift();
      return this.timeTarget;
    }

    setTimeValue(value) {
      if (this.state !== 'playing') return this.timeValue;
      let next = clamp(Number(value) || 0, 0, 4);
      if (next >= 3.999) next = 0;
      this.timeValue = next;
      this.timeTarget = next;
      this.timePreset = Math.round(next) % 4;
      this._updateTime(0, true);
      return this.timeValue;
    }

    getTimeLabel() {
      const hour = (6 + this.timeValue * 6) % 24;
      if (hour >= 5 && hour < 8) return 'DAWN';
      if (hour >= 8 && hour < 11) return 'MORNING';
      if (hour >= 11 && hour < 14) return 'NOON';
      if (hour >= 14 && hour < 17) return 'AFTERNOON';
      if (hour >= 17 && hour < 19) return 'DUSK';
      return 'NIGHT';
    }

    getClockText() {
      const totalMinutes = Math.round(6 * 60 + this.timeValue * 6 * 60);
      const hours = Math.floor(totalMinutes / 60) % 24;
      const minutes = totalMinutes % 60;
      return PJ.pad2(hours) + ':' + PJ.pad2(minutes);
    }

    getTimeIndex() {
      return this.timePreset;
    }

    _createRun() {
      this.player = new PJ.Player(this.level.spawnPoint());
      this.gems = this.level.gems.map((gem) => new PJ.Gem(gem));
      this.enemies = this.level.enemySpawns.map((enemy) => new PJ.Slime(enemy));
      this.checkpoints = this.level.checkpointSpawns.map((cp) => new PJ.Checkpoint(cp));
      this.goal = new PJ.Goal(this.level.goal);
      this.ice = this.level.iceSpawn ? new PJ.IceBlock(this.level.iceSpawn) : null;
      this.platforms = this.level.platformSpawns.map((def) => new PJ.MovingPlatform(def));
      this.jumpPads = this.level.jumpPadSpawns.map((def) => new PJ.JumpPad(def));
      this.slopes = this.level.slopes.map((def) => ({
        x1: def.tx * TILE,
        x2: (def.tx + def.w) * TILE,
        baseY: (def.ty + 1) * TILE,
        rise: Math.max(1, def.h || 2) * TILE,
        down: def.dir === 'down'
      }));
      this.playerPlatform = null;
      this.icePlatform = null;
      this.respawn = this.level.spawnPoint();
      this.particles = [];
      this.collected = 0;
      this.toast = null;
      this.flash = 0;
      this.dustTimer = 0;
      this.camera.shake = 0;
      this.iceMeltTimer = 0;
      this.icePushDustTimer = 0;
      this.goalHintTimer = 0;
      this.npcs = this.level.npcSpawns.map((spawn, index) => {
        const npc = new PJ.Npc(spawn);
        const dialogue = this.level.dialogues[index] || {};
        npc.name = dialogue.name || 'SUNWARDEN / 守日人';
        npc.role = dialogue.role || 'GUIDE OF THE SANDS';
        npc.lines = (dialogue.lines || []).slice();
        npc.auto = !!dialogue.auto;
        npc.talked = false;
        return npc;
      });
      this.nearNpc = null;
      this.dialogueNpc = null;
      this.dialogueRole = '';
      this.iceIntroduced = this.npcs.length === 0;
      this.dialogueActive = false;
      this.dialogueIndex = 0;
      this.dialogueName = '';
      this.dialogueLines = [];
      this.timeValue = 1;
      this.timeTarget = 1;
      this.timePreset = 1;
      this.timeShiftFlash = 0;
      this.chill = 0;
      this.playerSunlit = false;
      this.failReason = null;
      this.settingsOpen = false;
      this._updateTime(0, true);
      this._snapCamera();
    }

    getStats() {
      return {
        time: this.runTime,
        integrity: this.ice ? Math.max(0, Math.ceil(this.ice.integrity)) : 0,
        chill: Math.max(0, Math.min(100, Math.ceil(this.chill))),
        deaths: this.deaths,
        shards: this.collected,
        shardsTotal: this.gems.length,
        level: this.level.label,
        timeOfDay: this.getTimeLabel(),
        isNight: this.isNight
      };
    }

    /* ---------------------------------------------------------------- */
    /* Update                                                            */
    /* ---------------------------------------------------------------- */

    update(dt) {
      this.animTime += dt;
      this._updateParticles(dt);

      if (this.camera.shake > 0) {
        this.camera.shake *= Math.exp(-9 * dt);
        if (this.camera.shake < 0.15) this.camera.shake = 0;
      }
      if (this.flash > 0) this.flash = Math.max(0, this.flash - dt * 1.7);
      if (this.timeShiftFlash > 0) this.timeShiftFlash = Math.max(0, this.timeShiftFlash - dt * 2.2);
      if (this.goalHintTimer > 0) this.goalHintTimer = Math.max(0, this.goalHintTimer - dt);
      if (this.toast) {
        this.toast.time -= dt;
        if (this.toast.time <= 0) this.toast = null;
      }

      if (this.state === 'playing') {
        if (this.settingsOpen) return;
        this.npcs.forEach((npc) => npc.update(dt));
        if (this.dialogueActive && this._dialogueNpcTooFar()) this.closeDialogue();
        if (!this.dialogueActive) this._checkTutorialDialogue();
        this.runTime += dt;
        this._updateTime(dt);
        this._updateGameplay(dt);
      } else if (this.state === 'complete') {
        this.goal.update(dt);
        this.checkpoints.forEach((cp) => cp.update(dt));
      }
    }

    _updateGameplay(dt) {
      this.checkpoints.forEach((cp) => cp.update(dt));
      this.goal.update(dt);
      this.platforms.forEach((platform) => platform.update(dt));
      this.jumpPads.forEach((pad) => pad.update(dt));

      if (this.player.dead) {
        this.player.deadTimer -= dt;
        this.playerPlatform = null;
        if (this.player.deadTimer <= 0) this._respawn();
        return;
      }

      this._tryDropThroughPlatform();
      this._carryPlatform();
      this._preStepSlopes(this.player, this.player.h, false);
      const prevBottom = this.player.y + this.player.h;
      this.player.update(dt, this.level, this.input);
      this._resolveIceHeadBump();
      this._resolvePlatforms(prevBottom);
      this._resolveSlopeWalls(this.player, this.player.h, false);
      this._resolveSlopes();
      this._checkJumpPads();

      if (this.player.justJumped) {
        this.sfx.jump();
        this._dust(this.player.x + this.player.w / 2, this.player.y + this.player.h - 2, 5, 35);
      }

      if (this.player.landedVelocity > 110) {
        this.sfx.land();
        this._dust(
          this.player.x + this.player.w / 2,
          this.player.y + this.player.h - 1,
          this.player.landedVelocity > 300 ? 9 : 5,
          45
        );
        if (this.player.landedVelocity > 330) this.camera.shake = Math.max(this.camera.shake, 2.5);
      }

      if (this.player.justTurned && this.player.grounded) {
        this._dust(this.player.x + this.player.w / 2, this.player.y + this.player.h - 1, 3, 22);
      }

      this.dustTimer -= dt;
      if (this.player.grounded && Math.abs(this.player.vx) > 65 && this.dustTimer <= 0) {
        this.dustTimer = 0.14;
        this._dust(this.player.x + this.player.w / 2 - this.player.facing * 3, this.player.y + this.player.h - 1, 2, 20);
      }

      this._updateIceInteraction(dt);
      this._updateIceSun(dt);
      this._updateChill(dt);

      this.enemies.forEach((enemy) => enemy.update(dt, this.level));
      this._checkGems();
      this._checkCheckpoints();
      this._checkEnemies(prevBottom);
      this._checkHazards();
      this._checkGoal();

      if (this.state !== 'playing') return;

      if (this.player.y > this.level.pixelH + 26) {
        this._die('fall');
        return;
      }

      this._updateCamera(dt);
    }

    _updateCamera(dt) {
      const maxX = Math.max(0, this.level.pixelW - VIEW_W);
      const maxY = Math.max(0, this.level.pixelH - VIEW_H);

      // Lookahead follows velocity, not facing.  Facing flips instantly when the
      // player changes direction; easing the offset here prevents that 40px
      // target jump from snapping the whole view left/right.
      const targetLook = clamp(this.player.vx * 0.22, -26, 26);
      this.camera.lookX = lerp(this.camera.lookX, targetLook, 1 - Math.exp(-3.2 * dt));

      const targetX = clamp(this.player.centerX - VIEW_W * 0.45 + this.camera.lookX, 0, maxX);
      const targetY = clamp(this.player.centerY - VIEW_H * 0.58, 0, maxY);

      // Frame-rate-independent exponential follow.  Combined with the eased
      // lookahead this keeps direction changes soft while still tracking runs.
      const follow = 1 - Math.exp(-7.2 * dt);
      this.camera.x = lerp(this.camera.x, targetX, follow);
      this.camera.y = lerp(this.camera.y, targetY, follow);
      this.camera.x = clamp(this.camera.x, 0, maxX);
      this.camera.y = clamp(this.camera.y, 0, maxY);
    }

    _cameraTargetX() {
      const maxX = Math.max(0, this.level.pixelW - VIEW_W);
      return clamp(this.player.centerX - VIEW_W * 0.45 + this.camera.lookX, 0, maxX);
    }

    _updateTime(dt, snap) {
      if (snap) {
        this.timeValue = this.timeTarget;
      } else {
        this.timeValue += (this.timeTarget - this.timeValue) * (1 - Math.exp(-PJ.TUNING.timeEase * dt));
        if (Math.abs(this.timeValue - this.timeTarget) < 0.001) this.timeValue = this.timeTarget;
      }

      if (this.timeTarget >= 4 && this.timeValue > 3.995) {
        this.timeValue = 0;
        this.timeTarget = 0;
      }

      const t = clamp(this.timeValue, 0, 4);
      let sunX;
      let sunY;
      let dirX;
      let dirY;

      if (t <= 2) {
        if (t <= 1) {
          const u = t;
          sunX = lerp(78, 276, u);
          sunY = lerp(112, 46, u);
          dirX = lerp(-0.9, 0.04, u);
        } else {
          const u = t - 1;
          sunX = lerp(276, 424, u);
          sunY = lerp(46, 120, u);
          dirX = lerp(0.04, 0.9, u);
        }
        dirY = -lerp(0.68, 1, 1 - Math.abs(t - 1));
      } else {
        // At night the sun is below the horizon and the moon takes its place.
        const u = t - 2;
        if (u <= 1) {
          sunX = lerp(424, 276, u);
          sunY = lerp(120, 58, u);
          dirX = lerp(0.9, 0.04, u);
        } else {
          const v = u - 1;
          sunX = lerp(276, 78, v);
          sunY = lerp(58, 112, v);
          dirX = lerp(0.04, -0.9, v);
        }
        dirY = -0.72;
      }

      const clockHour = (6 + t * 6) % 24;
      this.isNight = clockHour >= 19 || clockHour < 5;
      this.nightFactor = this.isNight ? (t <= 3 ? t - 2 : 4 - t) : 0;

      const len = Math.hypot(dirX, dirY) || 1;
      this.sun = {
        screenX: sunX,
        screenY: sunY,
        dirX: dirX / len,
        dirY: dirY / len,
        power: this.isNight ? 0 : 0.72 + 0.28 * (1 - Math.abs(t - 1)),
        isNight: this.isNight
      };
      this.palette = this._buildDesertPalette(t);
    }

    _buildDesertPalette(t) {
      let a;
      let b;
      let amount;
      if (t <= 1) {
        a = DESERT_PALETTES[0];
        b = DESERT_PALETTES[1];
        amount = t;
      } else if (t <= 2) {
        a = DESERT_PALETTES[1];
        b = DESERT_PALETTES[2];
        amount = t - 1;
      } else if (t <= 3) {
        a = DESERT_PALETTES[2];
        b = DESERT_PALETTES[3];
        amount = t - 2;
      } else {
        a = DESERT_PALETTES[3];
        b = DESERT_PALETTES[0];
        amount = t - 3;
      }

      const mix = (key) => PJ.mixColor(a[key], b[key], amount);
      return {
        sky: a.sky.map((color, index) => PJ.mixColor(color, b.sky[index], amount)),
        sun: mix('sun'),
        sunGlow: mix('sunGlow'),
        mesaFar: mix('mesaFar'),
        mesaNear: mix('mesaNear'),
        duneFar: mix('duneFar'),
        duneMid: mix('duneMid'),
        duneNear: mix('duneNear'),
        duneLight: mix('duneLight'),
        ruin: mix('ruin'),
        cactus: mix('cactus'),
        haze: mix('haze'),
        dust: mix('dust'),
        shadow: mix('shadow')
      };
    }

    _isSunlitAt(x, y) {
      if (this.isNight) return false;
      const dirX = this.sun.dirX;
      const dirY = this.sun.dirY;
      for (let distance = 6; distance <= 520; distance += 6) {
        const px = x + dirX * distance;
        const py = y + dirY * distance;
        if (py < 0) break;
        // Outside the level horizontally is open sky, not the movement
        // boundary wall. Treating it as solid shaded the outer platform edges.
        if (px < 0 || px >= this.level.pixelW) continue;
        if (this.level.isSolidAtPx(px, py)) return false;
      }
      return true;
    }

    _sunExposureAt(cx, y, width, height) {
      if (this.isNight) return 0;
      const columns = 5;
      const rows = height && height > 2 ? 2 : 1;
      const half = Math.max(1, width / 2);
      let sunlit = 0;
      let total = 0;
      for (let row = 0; row < rows; row++) {
        const py = y + (rows === 2 ? (row * height) / 2 : 0);
        for (let i = 0; i < columns; i++) {
          const x = cx - half + (i / (columns - 1)) * width;
          if (this._isSunlitAt(x, py)) sunlit += 1;
          total += 1;
        }
      }
      return sunlit / total;
    }

    _tryDropThroughPlatform() {
      const player = this.player;
      if (!this.playerPlatform || player.dropTimer > 0) return false;
      if (!this.input || !this.input.isDown('down')) return false;
      this.playerPlatform = null;
      player.y += 4;
      player.vy = Math.max(40, player.vy);
      player.grounded = false;
      player.dropTimer = 0.28;
      this._dust(player.x + player.w / 2, player.y + player.h, 3, 24);
      return true;
    }

    _platformOverlaps(body, platform, inset) {
      const pad = inset == null ? 2 : inset;
      return body.x + body.w > platform.x + pad && body.x < platform.x + platform.w - pad;
    }

    _carryPlatform() {
      const platform = this.playerPlatform;
      if (!platform) return;
      const player = this.player;
      if (!this._platformOverlaps(player, platform) || player.vy < -10) {
        this.playerPlatform = null;
        return;
      }
      player.x += platform.dx;
      player.y += platform.dy;
      player.grounded = true;
    }

    _resolvePlatforms(prevBottom) {
      const player = this.player;
      if (player.dropTimer > 0) return;
      const playerRect = player.getRect();

      if (this.playerPlatform) {
        const platform = this.playerPlatform;
        if (player.vy < -12 || !this._platformOverlaps(player, platform)) {
          this.playerPlatform = null;
        } else {
          player.y = platform.y - player.h;
          player.vy = 0;
          player.grounded = true;
          return;
        }
      }

      if (player.vy < 0) return;
      for (let i = 0; i < this.platforms.length; i++) {
        const platform = this.platforms[i];
        if (!this._platformOverlaps(playerRect, platform)) continue;
        const feet = player.y + player.h;
        if (prevBottom <= platform.prevY + 6 && feet >= platform.y && player.y < platform.y) {
          if (!player.grounded) {
            this.sfx.land();
            this._dust(player.x + player.w / 2, platform.y, 4, 26);
          }
          player.y = platform.y - player.h;
          player.vy = 0;
          player.grounded = true;
          this.playerPlatform = platform;
          return;
        }
      }
    }

    _slopeSurfaceAt(slope, cx) {
      const ratio = (cx - slope.x1) / Math.max(1, slope.x2 - slope.x1);
      return slope.down
        ? slope.baseY - slope.rise * (1 - ratio)
        : slope.baseY - slope.rise * ratio;
    }

    _slopeTilt(slope) {
      return slope.down
        ? Math.atan2(slope.rise, slope.x2 - slope.x1)
        : -Math.atan2(slope.rise, slope.x2 - slope.x1);
    }

    _slopeSurfaceForBody(slope, body) {
      let surfaceY = this._slopeSurfaceAt(slope, body.x + body.w / 2);
      const topY = slope.baseY - slope.rise;
      // Only a tiny, direction-aware lip at the high end. It bridges the AABB
      // corner onto the adjoining platform without creating an invisible flat
      // collision shelf on the slope.
      const movingTowardTop = slope.down ? body.vx < -5 : body.vx > 5;
      const atTop = slope.down
        ? body.x <= slope.x1 + 2
        : body.x + body.w >= slope.x2 - 2;
      if (movingTowardTop && atTop) surfaceY = topY;
      return surfaceY;
    }

    _isBlockedByHighFace(slope, body, height) {
      const topY = slope.baseY - slope.rise;
      const highX = slope.down ? slope.x1 : slope.x2;
      const bottom = body.y + height;
      if (bottom <= topY + 2) return false;
      if (body.y >= slope.baseY) return false;
      return body.x < highX && body.x + body.w > highX;
    }

    _resolveSlopeWalls(body, height, isIce) {
      for (let i = 0; i < this.slopes.length; i++) {
        const slope = this.slopes[i];
        if (!this._isBlockedByHighFace(slope, body, height)) continue;
        const highX = slope.down ? slope.x1 : slope.x2;
        if (slope.down) {
          body.x = highX - body.w;
        } else {
          body.x = highX;
        }
        body.vx = 0;
        if (!isIce) body.hitWall = true;
        return true;
      }
      return false;
    }

    _preStepSlopes(body, height, isIce) {
      if (body.vy < 0) return false;
      const cx = body.x + body.w / 2;
      for (let i = 0; i < this.slopes.length; i++) {
        const slope = this.slopes[i];
        if (cx < slope.x1 || cx > slope.x2) continue;
        if (this._isBlockedByHighFace(slope, body, height)) continue;
        const surfaceY = this._slopeSurfaceForBody(slope, body);
        const feet = body.y + height;
        if (feet >= surfaceY - 3 && feet <= surfaceY + 16 && body.y < surfaceY) {
          body.y = surfaceY - height;
          body.vy = 0;
          body.grounded = true;
          if (isIce) {
            body.tiltTarget = this._slopeTilt(slope);
            this.icePlatform = null;
          } else {
            this.playerPlatform = null;
          }
          return true;
        }
      }
      return false;
    }

    _resolveSlopes() {
      const player = this.player;
      if (player.vy < 0) return;
      for (let i = 0; i < this.slopes.length; i++) {
        const slope = this.slopes[i];
        const cx = player.centerX;
        if (cx < slope.x1 || cx > slope.x2) continue;
        if (this._isBlockedByHighFace(slope, player, player.h)) continue;
        const surfaceY = this._slopeSurfaceForBody(slope, player);
        const feet = player.y + player.h;
        if (feet >= surfaceY - 2 && feet <= surfaceY + 14 && player.y < surfaceY) {
          player.y = surfaceY - player.h;
          player.vy = 0;
          player.grounded = true;
          this.playerPlatform = null;
          return;
        }
      }
    }

    _checkJumpPads() {
      const player = this.player;
      if (player.vy < 0) return;
      for (let i = 0; i < this.jumpPads.length; i++) {
        const pad = this.jumpPads[i];
        const overlap = player.x + player.w > pad.x + 1 && player.x < pad.x + pad.w - 1;
        if (!overlap) continue;
        const feet = player.y + player.h;
        if (feet >= pad.y - 1 && feet <= pad.y + 10) {
          player.y = pad.y - player.h;
          player.vy = -pad.power;
          player.padLaunch = true;
          player.grounded = false;
          this.playerPlatform = null;
          pad.pulse = 1;
          this.sfx.jump();
          this._dust(player.x + player.w / 2, pad.y, 7, 44);
          return;
        }
      }
    }

    _carryIcePlatform() {
      const ice = this.ice;
      ice.carryDx = 0;
      ice.carryDy = 0;
      const platform = this.icePlatform;
      if (!platform) return;
      if (!this._platformOverlaps(ice, platform) || ice.vy < -10) {
        this.icePlatform = null;
        return;
      }
      ice.x += platform.dx;
      ice.y += platform.dy;
      ice.carryDx = platform.dx;
      ice.carryDy = platform.dy;
      ice.grounded = true;
    }

    _resolveIcePlatforms(prevBottom) {
      const ice = this.ice;
      const iceRect = ice.getRect();

      if (this.icePlatform) {
        const platform = this.icePlatform;
        if (ice.vy < -12 || !this._platformOverlaps(ice, platform)) {
          this.icePlatform = null;
        } else {
          ice.y = platform.y - ice.h;
          ice.vy = 0;
          ice.grounded = true;
          return;
        }
      }

      if (ice.vy < 0) return;
      for (let i = 0; i < this.platforms.length; i++) {
        const platform = this.platforms[i];
        if (!this._platformOverlaps(iceRect, platform)) continue;
        const feet = ice.y + ice.h;
        if (prevBottom <= platform.prevY + 6 && feet >= platform.y && ice.y < platform.y) {
          ice.y = platform.y - ice.h;
          ice.vy = 0;
          ice.grounded = true;
          this.icePlatform = platform;
          return;
        }
      }
    }

    _resolveIceSlopes() {
      const ice = this.ice;
      ice.tiltTarget = 0;
      if (ice.vy < 0) return;
      for (let i = 0; i < this.slopes.length; i++) {
        const slope = this.slopes[i];
        const cx = ice.x + ice.w / 2;
        if (cx < slope.x1 || cx > slope.x2) continue;
        if (this._isBlockedByHighFace(slope, ice, ice.h)) continue;
        const surfaceY = this._slopeSurfaceForBody(slope, ice);
        const feet = ice.y + ice.h;
        if (feet >= surfaceY - 2 && feet <= surfaceY + 16 && ice.y < surfaceY) {
          ice.y = surfaceY - ice.h;
          ice.vy = 0;
          ice.grounded = true;
          ice.tiltTarget = this._slopeTilt(slope);
          this.icePlatform = null;
          return;
        }
      }
    }

    _checkIceJumpPads() {
      const ice = this.ice;
      if (ice.vy < 0) return;
      for (let i = 0; i < this.jumpPads.length; i++) {
        const pad = this.jumpPads[i];
        const overlap = ice.x + ice.w > pad.x + 1 && ice.x < pad.x + pad.w - 1;
        if (!overlap) continue;
        const feet = ice.y + ice.h;
        if (feet >= pad.y - 1 && feet <= pad.y + 12) {
          ice.y = pad.y - ice.h;
          ice.vy = -pad.power * 0.66;
          ice.grounded = false;
          this.icePlatform = null;
          pad.pulse = 1;
          this.sfx.jump();
          this._dust(ice.x + ice.w / 2, pad.y, 8, 38);
          return;
        }
      }
    }

    _updateIceInteraction(dt) {
      const ice = this.ice;
      if (!ice || ice.arrived) return;
      const player = this.player;

      this._carryIcePlatform();
      this._preStepSlopes(ice, ice.h, true);
      const prevIceBottom = ice.y + ice.h;

      const verticallyAligned = player.y + player.h > ice.y + 3 && player.y < ice.y + ice.h - 3;
      let pushDir = 0;
      if (player.grounded && verticallyAligned) {
        const leftGap = ice.x - (player.x + player.w);
        const rightGap = player.x - (ice.x + ice.w);
        if (leftGap >= -3 && leftGap <= 5 && player.vx > 10) pushDir = 1;
        else if (rightGap >= -3 && rightGap <= 5 && player.vx < -10) pushDir = -1;
      }

      ice.beingPushed = false;
      if (pushDir !== 0) {
        const pushSpeed = Math.min(PJ.TUNING.iceMaxSpeed, Math.max(20, Math.abs(player.vx)));
        ice.pushVx = pushDir * pushSpeed;
        ice.beingPushed = true;
        player.vx = pushDir * Math.min(Math.abs(player.vx), pushSpeed);

        this.icePushDustTimer -= dt;
        if (this.icePushDustTimer <= 0) {
          this.icePushDustTimer = 0.12;
          const contactX = pushDir > 0 ? ice.x + 1 : ice.x + ice.w - 1;
          this._dust(contactX, ice.y + ice.h - 2, 1, 10);
        }
      }

      ice.update(dt, this.level);
      ice.beingPushed = false;
      this._resolveIcePlatforms(prevIceBottom);
      this._resolveSlopeWalls(ice, ice.h, true);
      this._resolveIceSlopes();
      this._checkIceJumpPads();
      this._resolvePlayerIce(dt, pushDir);
    }

    _resolveIceHeadBump() {
      const ice = this.ice;
      const player = this.player;
      if (!ice || ice.arrived || player.vy >= -10) return false;
      // Only a head-first overlap counts: the player's centre must be under the
      // ice. While pushing, the player is beside the block even if the boxes
      // touch, and treating that as a ceiling bump would cancel the jump.
      const underIce = player.centerX > ice.x + 2 && player.centerX < ice.x + ice.w - 2;
      if (!underIce) return false;
      const iceCenterY = ice.y + ice.h / 2;
      const belowIce = player.y + player.h > iceCenterY && player.y < ice.y + ice.h;
      if (!belowIce) return false;

      // Resolve the head bump here, before the generic player/ice side
      // separation can squeeze the character out from under the block.
      player.y = ice.y + ice.h;
      player.vy = 0;
      player.vx = 0;
      player.grounded = false;
      player.hitCeiling = true;
      return true;
    }

    _resolvePlayerIce(dt, pushDir) {
      const ice = this.ice;
      const player = this.player;
      if (!ice || ice.arrived) return;

      const playerRect = player.getRect();
      const iceRect = ice.getRect();
      const feet = player.y + player.h;
      const horizontallyOver = player.x + player.w > ice.x + 1 && player.x < ice.x + ice.w - 1;
      const riding = horizontallyOver && player.vy >= 0 &&
        player.y < ice.y && feet >= ice.y - 1 && feet <= ice.y + 10;

      // Support the rider even when the feet are exactly on the ice surface
      // (rect overlap is false at exact touch, which caused a 1-frame fall and
      // a visible vertical twitch every few frames).
      if (riding) {
        if (!player.wasGrounded && player.vy > 110) {
          this.sfx.land();
          this._dust(player.x + player.w / 2, ice.y, 4, 24);
        }
        if (ice.carryDx) player.x += ice.carryDx;
        if (ice.vx !== 0) {
          const blocked = PJ.moveBodyX(player, ice.vx * dt, this.level);
          if (blocked) player.vx = 0;
        }
        player.y = ice.y - player.h;
        player.vy = 0;
        player.grounded = true;
        return;
      }

      if (!PJ.rectsOverlap(playerRect, iceRect)) return;

      // Jump-pad head bump against the ice: stop the ascent and drop straight
      // down. The old generic side resolution squeezed the player left/right.
      const underIce = player.centerX > ice.x + 2 && player.centerX < ice.x + ice.w - 2;
      if (player.vy < -10 && underIce &&
        player.y + player.h > ice.y + ice.h / 2 && player.y < ice.y + ice.h) {
        player.y = ice.y + ice.h;
        player.vy = 0;
        player.vx = 0;
        player.grounded = false;
        player.hitCeiling = true;
        return;
      }

      const fromLeft = player.centerX < ice.centerX;
      if (fromLeft) player.x = ice.x - player.w;
      else player.x = ice.x + ice.w;

      // Keep contact pressure while pushing: only cancel horizontal velocity
      // when the player is not actively driving the block (or the block is
      // pinned against a wall). This removes the old push/stop stutter.
      const driving = pushDir !== 0 &&
        ((fromLeft && player.vx > 0) || (!fromLeft && player.vx < 0));
      if (!driving || ice.vx === 0) player.vx = 0;
    }

    _updateIceSun(dt) {
      const ice = this.ice;
      if (!ice || ice.arrived || !this.iceIntroduced) return;

      // Sample several points across the block so two overlapping shadows
      // cannot leave the center ray exposed and falsely report sunlight.
      const exposure = this._sunExposureAt(ice.x + ice.w / 2, ice.y + 1, ice.w - 4, ice.h * 0.55);
      ice.sunlit = exposure > 0.6;
      if (!ice.sunlit) {
        this.iceMeltTimer = 0;
        return;
      }

      const meltRate = (2.4 + 5.4 * this.sun.power) * PJ.TUNING.meltScale;
      ice.integrity = Math.max(0, ice.integrity - meltRate * dt);
      this.iceMeltTimer += dt;
      if (this.iceMeltTimer > 0.22) {
        this.iceMeltTimer = 0;
        this.particles.push(new PJ.Particle(ice.x + 6 + Math.random() * 5, ice.y + 12, {
          vx: (Math.random() - 0.5) * 18,
          vy: 25 + Math.random() * 25,
          gravity: 280,
          drag: 0.92,
          life: 0.4 + Math.random() * 0.35,
          color: Math.random() > 0.45 ? '#9df3ff' : '#eaffff',
          size: 1,
          glow: true
        }));
      }

      if (ice.integrity <= 0) this._failIce();
    }

    _updateChill(dt) {
      if (this.state !== 'playing' || this.player.dead || !this.iceIntroduced) return;

      if (this.isNight) {
        this.playerSunlit = false;
        this.chill = Math.min(100, this.chill + PJ.TUNING.nightChill * dt);
        if (this.chill >= 100) this._failChill();
        return;
      }

      const exposure = this._sunExposureAt(this.player.centerX, this.player.y + 2, this.player.w - 2, this.player.h * 0.55);
      this.playerSunlit = exposure > 0.6;
      if (this.playerSunlit) {
        this.chill = Math.max(0, this.chill - PJ.TUNING.sunWarmth * dt);
      }
    }

    _failIce() {
      if (this.state !== 'playing') return;
      this.closeDialogue();
      this.ice.integrity = 0;
      this.ice.arrived = true;
      this.deaths += 1;
      this.failReason = 'melt';
      this.flash = 0.55;
      this.camera.shake = 7;
      this.sfx.hurt();
      this._burst(this.ice.x + 8, this.ice.y + 7, 24, ['#8ff4ff', '#d9ffff', '#3fa8c9'], {
        speed: 120,
        gravity: 320,
        life: 0.8,
        size: 2,
        glow: true
      });
      this._toast('THE ICE MELTED', '#ff9a82', 2.2);
      const stats = this.getStats();
      stats.reason = 'melt';
      this._setState('failed', stats);
    }

    _failChill() {
      if (this.state !== 'playing') return;
      this.closeDialogue();
      this.chill = 100;
      this.deaths += 1;
      this.failReason = 'cold';
      this.flash = 0.55;
      this.camera.shake = 6;
      this.sfx.hurt();
      this._burst(this.player.centerX, this.player.centerY, 26, ['#d9f6ff', '#8bd9ff', '#6b9bd2', '#ffffff'], {
        speed: 110,
        gravity: 120,
        life: 0.9,
        size: 2,
        glow: true
      });
      this._toast('FROZEN IN THE NIGHT', '#bdefff', 2.2);
      const stats = this.getStats();
      stats.reason = 'cold';
      this._setState('failed', stats);
    }

    _snapCamera() {
      const maxY = Math.max(0, this.level.pixelH - VIEW_H);
      this.camera.lookX = clamp(this.player.vx * 0.22, -26, 26);
      this.camera.x = this._cameraTargetX();
      this.camera.y = clamp(this.player.centerY - VIEW_H * 0.58, 0, maxY);
      this.camera.shake = 0;
    }

    /* ---------------------------------------------------------------- */
    /* Interactions                                                      */
    /* ---------------------------------------------------------------- */

    _checkGems() {
      const playerRect = this.player.getRect();
      for (let i = 0; i < this.gems.length; i++) {
        const gem = this.gems[i];
        if (gem.collected) continue;
        if (PJ.rectsOverlap(playerRect, gem.getRect())) {
          gem.collected = true;
          this.collected += 1;
          this.sfx.gem();
          this._burst(gem.baseX + 4, gem.baseY + 4, 13, ['#7df7ff', '#d9ffff', '#34c9dc'], {
            speed: 80,
            gravity: 170,
            life: 0.55,
            size: 2,
            glow: true
          });
          if (this.collected === this.gems.length) {
            this._toast('ALL SHARDS!', '#7df7ff', 1.8);
            this.camera.shake = Math.max(this.camera.shake, 2);
          } else {
            this._toast('SHARD ' + this.collected + ' / ' + this.gems.length, '#7df7ff', 1.3);
          }
        }
      }
    }

    _checkCheckpoints() {
      const playerRect = this.player.getRect();
      for (let i = 0; i < this.checkpoints.length; i++) {
        const cp = this.checkpoints[i];
        if (cp.active) continue;
        if (!PJ.rectsOverlap(playerRect, cp.getRect())) continue;

        this.checkpoints.forEach((other) => {
          other.active = false;
        });
        cp.active = true;
        this.respawn = { x: cp.x + 3, y: cp.baseY - this.player.h };
        this.sfx.checkpoint();
        this._burst(cp.x + 8, cp.baseY - 22, 16, ['#57f0c4', '#d4fff2', '#2bc7b1'], {
          speed: 100,
          gravity: 90,
          life: 0.8,
          size: 2,
          glow: true
        });
        this._toast('CHECKPOINT', '#57f0c4', 1.3);
        break;
      }
    }

    _checkEnemies(prevBottom) {
      const playerRect = this.player.getRect();
      for (let i = 0; i < this.enemies.length; i++) {
        const enemy = this.enemies[i];
        if (enemy.dead) continue;
        const enemyRect = enemy.getRect();
        if (!PJ.rectsOverlap(playerRect, enemyRect)) continue;

        const stomped = this.player.vy > 25 && prevBottom <= enemyRect.y + 6;
        if (stomped) {
          enemy.dead = true;
          this.player.y = enemyRect.y - this.player.h - 1;
          this.player.vy = -280;
          this.player.grounded = false;
          this.sfx.stomp();
          this.camera.shake = Math.max(this.camera.shake, 3.5);
          this._burst(enemy.x + enemy.w / 2, enemy.y + enemy.h / 2, 12, ['#a8e063', '#e6ffb0', '#5d9e49'], {
            speed: 110,
            gravity: 360,
            life: 0.55,
            size: 2
          });
        } else if (this.player.invuln <= 0) {
          this._die('enemy');
          return;
        }
      }
    }

    _checkHazards() {
      if (this.player.dead) return;
      const feet = {
        x: this.player.x + 2,
        y: this.player.y + this.player.h - 5,
        w: this.player.w - 4,
        h: 5
      };
      const left = Math.floor(feet.x / TILE);
      const right = Math.floor((feet.x + feet.w - 0.001) / TILE);
      const top = Math.floor(feet.y / TILE);
      const bottom = Math.floor((feet.y + feet.h - 0.001) / TILE);
      for (let ty = top; ty <= bottom; ty++) {
        for (let tx = left; tx <= right; tx++) {
          if (this.level.tileAt(tx, ty) === PJ.TILE_SPIKE) {
            this._die('spike');
            return;
          }
        }
      }
    }

    _checkGoal() {
      if (this.state !== 'playing' || !this.ice || this.ice.arrived) return;

      if (PJ.rectsOverlap(this.ice.getRect(), this.goal.getRect())) {
        this.ice.arrived = true;
        this.ice.vx = 0;
        this.ice.vy = 0;
        this.ice.x = this.goal.x + 3;
        this.ice.y = this.goal.baseY - this.ice.h;
        this.goal.active = true;
        this._completeRun();
        return;
      }

      if (PJ.rectsOverlap(this.player.getRect(), this.goal.getRect()) && this.goalHintTimer <= 0) {
        this.goalHintTimer = 3.2;
        this._toast('BRING THE ICE TO THE ALTAR', '#9be8ff', 1.7);
      }
    }

    _die(cause) {
      if (this.player.dead || this.state !== 'playing') return;
      this.closeDialogue();
      this.player.dead = true;
      this.player.deadTimer = 0.58;
      this.player.vx = 0;
      this.player.vy = 0;
      this.deaths += 1;
      this.flash = 0.6;
      this.camera.shake = Math.max(this.camera.shake, 7);
      this.sfx.hurt();
      this._burst(this.player.centerX, this.player.centerY, 22, ['#ff8b7d', '#ffd7a3', '#f24e5d', '#ffffff'], {
        speed: 150,
        gravity: 520,
        life: 0.7,
        size: 2,
        glow: true
      });
      if (cause === 'fall') {
        this._toast('MIND THE GAP', '#ffb0a8', 1.2);
      }
    }

    _respawn() {
      this.player.reset(this.respawn);
      this.player.invuln = 1.15;
      this.player.dead = false;
      this.camera.shake = 0;
      this._snapCamera();
      this._burst(this.player.centerX, this.player.centerY, 12, ['#7df7ff', '#d9ffff', '#57f0c4'], {
        speed: 65,
        gravity: -30,
        life: 0.55,
        size: 2,
        glow: true
      });
    }

    _completeRun() {
      if (this.state !== 'playing') return;
      this.closeDialogue();
      this.sfx.win();
      this.flash = 0.35;
      this.camera.shake = 0;
      this._burst(this.ice.x + 8, this.ice.y + 6, 40, ['#b8ffff', '#ffe58a', '#ffb84d', '#8fe9ff', '#ffffff'], {
        speed: 160,
        gravity: 260,
        life: 1.4,
        size: 2,
        glow: true
      });
      this.ice.arrived = true;
      this.goal.active = true;
      const stats = this.getStats();
      this._setState('complete', stats);
    }

    /* ---------------------------------------------------------------- */
    /* Particles & toasts                                                */
    /* ---------------------------------------------------------------- */

    _burst(x, y, count, colors, options) {
      const opts = options || {};
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = (opts.speed || 100) * (0.25 + Math.random() * 0.9);
        this.particles.push(
          new PJ.Particle(x, y, {
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed - (opts.lift || 0),
            gravity: opts.gravity || 0,
            drag: 0.9,
            life: (opts.life || 0.6) * (0.6 + Math.random() * 0.7),
            color: colors[Math.floor(Math.random() * colors.length)],
            size: opts.size || 1,
            glow: opts.glow
          })
        );
      }
      if (this.particles.length > 260) {
        this.particles.splice(0, this.particles.length - 260);
      }
    }

    _dust(x, y, count, speed) {
      for (let i = 0; i < count; i++) {
        this.particles.push(
          new PJ.Particle(x + (Math.random() - 0.5) * 6, y, {
            vx: (Math.random() - 0.5) * (speed || 35),
            vy: -8 - Math.random() * 24,
            gravity: 120,
            drag: 0.88,
            life: 0.22 + Math.random() * 0.25,
            color: Math.random() > 0.55 ? '#e8c28c' : '#9c7358',
            size: 1
          })
        );
      }
    }

    _updateParticles(dt) {
      for (let i = this.particles.length - 1; i >= 0; i--) {
        const particle = this.particles[i];
        particle.update(dt);
        if (particle.life <= 0) this.particles.splice(i, 1);
      }
    }

    _toast(text, color, duration) {
      this.toast = { text: text, color: color || '#ffffff', time: duration || 1.4, max: duration || 1.4 };
    }

    /* ---------------------------------------------------------------- */
    /* Render                                                            */
    /* ---------------------------------------------------------------- */

    render() {
      const ctx = this.ctx;
      // The canvas has a higher backing resolution than the 480x270 logical
      // stage. This keeps the world chunky while allowing the reference-derived
      // 66x78 character sprites to render at one-to-one backing pixels.
      const renderScale = this.canvas.width / VIEW_W;
      ctx.setTransform(renderScale, 0, 0, renderScale, 0, 0);
      ctx.imageSmoothingEnabled = false;

      if (this.bgCtx) {
        const bg = this.bgCtx;
        bg.setTransform(1, 0, 0, 1, 0, 0);
        bg.globalAlpha = 1;
        this._drawBackground(bg);
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(this.bgCanvas, 0, 0, VIEW_W, VIEW_H);
      } else {
        this._drawBackground(ctx);
      }

      const shakeX = this.camera.shake ? Math.round(Math.sin(this.animTime * 83) * this.camera.shake) : 0;
      const shakeY = this.camera.shake ? Math.round(Math.cos(this.animTime * 71) * this.camera.shake * 0.6) : 0;
      const camX = Math.round(this.camera.x) + shakeX;
      const camY = Math.round(this.camera.y) + shakeY;

      ctx.save();
      ctx.translate(-camX, -camY);
      this._drawWorld(ctx);
      ctx.restore();

      if (this.timeShiftFlash > 0) {
        ctx.globalAlpha = Math.min(0.12, this.timeShiftFlash * 0.22);
        ctx.fillStyle = this.palette.haze;
        ctx.fillRect(0, 0, VIEW_W, VIEW_H);
        ctx.globalAlpha = 1;
      }

      if (this.chill > 0.01) {
        const cold = Math.min(1, this.chill / 100);
        ctx.globalAlpha = 0.025 + cold * 0.09;
        ctx.fillStyle = '#72c8ff';
        ctx.fillRect(0, 0, VIEW_W, VIEW_H);
        ctx.globalAlpha = 0.06 + cold * 0.2;
        ctx.fillRect(0, 0, VIEW_W, 2);
        ctx.fillRect(0, VIEW_H - 2, VIEW_W, 2);
        ctx.fillRect(0, 0, 2, VIEW_H);
        ctx.fillRect(VIEW_W - 2, 0, 2, VIEW_H);
        ctx.globalAlpha = 1;
      }

      this._drawHud(ctx);

      if (this.flash > 0) {
        ctx.globalAlpha = Math.min(0.32, this.flash * 0.55);
        ctx.fillStyle = '#ff4f61';
        ctx.fillRect(0, 0, VIEW_W, VIEW_H);
        ctx.globalAlpha = 1;
      }

      if (this.debug) this._drawDebug(ctx, camX, camY);
    }

    _drawBackground(ctx) {
      const palette = this.palette || this._buildDesertPalette(1);

      // Quantised desert sky, interpolated through the three times of day.
      for (let i = 0; i < 6; i++) {
        ctx.fillStyle = palette.sky[i];
        ctx.fillRect(0, SKY_STOPS[i], VIEW_W, SKY_STOPS[i + 1] - SKY_STOPS[i]);
      }

      ctx.globalAlpha = 0.035;
      ctx.fillStyle = palette.sunGlow;
      ctx.fillRect(0, 0, VIEW_W, 190);
      ctx.globalAlpha = 1;

      this._drawDistantClouds(ctx, palette);
      this._drawDesertSun(ctx, palette);
      this._drawDesertMesas(ctx, palette);
      this._drawDuneLayer(ctx, 207, 10, 94, 0.025, palette.duneFar, palette.duneLight, 0.4);
      this._drawDuneLayer(ctx, 224, 13, 76, 0.075, palette.duneMid, palette.duneLight, 2.1);
      this._drawDuneLayer(ctx, 240, 9, 122, 0.145, palette.duneNear, palette.duneLight, 4.0);
      this._drawDesertRuins(ctx, palette);
      this._drawDesertFlora(ctx, palette);
      this._drawSandWind(ctx, palette);
      this._drawHeatHaze(ctx, palette);

      ctx.globalAlpha = 0.07;
      ctx.fillStyle = palette.haze;
      ctx.fillRect(0, 194, VIEW_W, 22);
      ctx.globalAlpha = 1;
    }

    _drawDesertSun(ctx, palette) {
      const sx = this.sun.screenX - this.camera.x * 0.012;
      const sy = this.sun.screenY;

      if (this.isNight) {
        this._drawNightSky(ctx, palette, sx, sy);
        return;
      }

      const altitude = 1 - Math.abs(this.timeValue - 1);
      const radius = 20 + Math.round(altitude * 6);

      ctx.globalAlpha = 0.06;
      this._pixelCircle(ctx, sx, sy, radius * 3.3, palette.sunGlow);
      ctx.globalAlpha = 0.1;
      this._pixelCircle(ctx, sx, sy, radius * 2.1, palette.sunGlow);
      ctx.globalAlpha = 0.96;
      this._pixelCircle(ctx, sx, sy, radius, palette.sun);
      this._pixelCircle(ctx, sx - 4, sy - 4, Math.round(radius * 0.55), '#fff9df');
      ctx.globalAlpha = 0.14;
      ctx.fillStyle = palette.sunGlow;
      ctx.fillRect(0, Math.round(sy), VIEW_W, 2);
      ctx.globalAlpha = 1;
    }

    _drawNightSky(ctx, palette, moonX, moonY) {
      const nf = this.nightFactor || 0;

      // Sparse, deterministic stars. They fade with the night factor so the
      // dusk and dawn transitions stay soft.
      ctx.fillStyle = palette.dust;
      for (let i = 0; i < 42; i++) {
        const x = ((PJ.hash2(i + 5, 77) * VIEW_W - this.camera.x * 0.008) % (VIEW_W + 10) + VIEW_W + 10) % (VIEW_W + 10) - 5;
        const y = 12 + Math.floor(PJ.hash2(i + 11, 78) * 150);
        const twinkle = 0.45 + Math.sin(this.animTime * 1.7 + i) * 0.25;
        ctx.globalAlpha = Math.max(0, nf * twinkle * 0.55);
        ctx.fillRect(Math.round(x), y, i % 8 === 0 ? 2 : 1, 1);
      }

      const moonAlpha = 0.2 + 0.8 * nf;
      ctx.globalAlpha = moonAlpha * 0.08;
      this._pixelCircle(ctx, moonX, moonY, 66, palette.sunGlow);
      ctx.globalAlpha = moonAlpha * 0.16;
      this._pixelCircle(ctx, moonX, moonY, 38, palette.sunGlow);
      ctx.globalAlpha = moonAlpha;
      this._pixelCircle(ctx, moonX, moonY, 17, palette.sun);
      ctx.fillStyle = 'rgba(102, 132, 174, 0.35)';
      ctx.fillRect(Math.round(moonX) - 7, Math.round(moonY) - 4, 4, 3);
      ctx.fillRect(Math.round(moonX) + 4, Math.round(moonY) + 3, 5, 4);
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.fillRect(Math.round(moonX) - 4, Math.round(moonY) - 8, 3, 2);
      ctx.globalAlpha = 1;
    }

    _drawDistantClouds(ctx, palette) {
      const shift = (this.camera.x * 0.012) % 620;
      ctx.fillStyle = palette.haze;
      ctx.globalAlpha = 0.1;
      for (let i = -1; i < 3; i++) {
        const x = Math.round(i * 230 - shift + 40);
        const y = 64 + i * 9;
        const w = 62 + Math.round(PJ.hash2(i + 7, 71) * 52);
        ctx.fillRect(x + 8, y, w - 16, 2);
        ctx.fillRect(x + 2, y + 2, w - 4, 2);
        ctx.fillRect(x, y + 4, w, 1);
        ctx.fillRect(x + 22, y - 2, Math.max(12, w - 50), 1);
      }
      ctx.globalAlpha = 1;
    }

    _drawDesertMesas(ctx, palette) {
      for (let layer = 0; layer < 2; layer++) {
        const parallax = 0.018 + layer * 0.034;
        const baseY = 205 + layer * 11;
        const span = 760;
        const shift = (this.camera.x * parallax) % span;
        for (let i = -1; i < 5; i++) {
          const cx = Math.round(i * 188 - shift + PJ.hash2(i + 31, layer + 4) * 58);
          if (cx < -120 || cx > VIEW_W + 120) continue;
          const w = 58 + PJ.hash2(i + 8, layer + 7) * 86;
          const h = 38 + PJ.hash2(i + 13, layer + 9) * (layer === 0 ? 54 : 72);
          this._drawMesaShape(ctx, cx, baseY, w, h, layer === 0 ? palette.mesaFar : palette.mesaNear, layer);
        }
      }
    }

    _drawMesaShape(ctx, cx, baseY, width, height, color, layer) {
      const top = baseY - height;
      const plateau = width * 0.54;
      for (let y = 0; y < height; y += 4) {
        const t = y / height;
        const w = plateau + (width - plateau) * t;
        ctx.fillStyle = color;
        ctx.fillRect(Math.round(cx - w / 2), top + y, Math.round(w), 4);
      }
      // Horizontal strata and a sunlit cap.
      ctx.fillStyle = 'rgba(28,18,24,0.16)';
      for (let band = 1; band < 4; band++) {
        const by = Math.round(top + (height * band) / 4);
        ctx.fillRect(Math.round(cx - width * 0.35), by, Math.round(width * 0.7), 1);
      }
      ctx.fillStyle = layer === 0 ? 'rgba(255,220,170,0.16)' : 'rgba(255,218,160,0.11)';
      ctx.fillRect(Math.round(cx - plateau / 2), top, Math.round(plateau), 2);
      ctx.fillStyle = 'rgba(38,25,29,0.2)';
      ctx.fillRect(Math.round(cx + width * 0.12), top + 10, 2, Math.max(2, height - 14));
    }

    _drawDuneLayer(ctx, baseY, amplitude, wavelength, parallax, color, light, phase) {
      const offset = this.camera.x * parallax;
      for (let x = -4; x < VIEW_W + 4; x += 2) {
        const u = x + offset;
        const h1 = Math.sin(u / wavelength + phase) * amplitude;
        const h2 = Math.sin(u / (wavelength * 0.43) + phase * 1.7) * amplitude * 0.24;
        const top = Math.round(baseY - h1 - h2);
        ctx.fillStyle = color;
        ctx.fillRect(x, top, 2, VIEW_H - top);
        if (((x + Math.floor(offset)) & 31) < 2) {
          ctx.fillStyle = light;
          ctx.globalAlpha = 0.35;
          ctx.fillRect(x, top, 2, 1);
          ctx.globalAlpha = 1;
        }
      }
    }

    _drawDesertRuins(ctx, palette) {
      const span = 640;
      const shift = (this.camera.x * 0.19) % span;
      for (let i = -1; i < 5; i++) {
        let x = i * 168 - shift + PJ.hash2(i + 4, 44) * 50;
        if (x < -70) continue;
        if (x > VIEW_W + 70) continue;
        x = Math.round(x);
        const base = 242;
        const h = 30 + Math.floor(PJ.hash2(i + 7, 45) * 52);
        const w = 9 + Math.floor(PJ.hash2(i + 9, 46) * 7);

        ctx.fillStyle = palette.ruin;
        ctx.fillRect(x - w - 3, base - 4, w + 6, 4);
        ctx.fillRect(x - Math.floor(w / 2), base - h, w, h - 4);
        ctx.fillRect(x - Math.floor(w / 2) - 2, base - h, w + 4, 3);
        ctx.fillStyle = 'rgba(236,185,128,0.2)';
        ctx.fillRect(x - Math.floor(w / 2) + 1, base - h + 4, 1, h - 8);
        ctx.fillStyle = 'rgba(42,25,28,0.34)';
        ctx.fillRect(x + Math.floor(w / 2) - 1, base - h + 5, 1, h - 8);
        const broken = PJ.hash2(i + 2, 47);
        if (broken > 0.55) {
          const bx = x - Math.floor(w / 2) - 6;
          ctx.fillStyle = palette.ruin;
          ctx.fillRect(bx, base - h * 0.52, 5, 4);
          ctx.fillRect(bx - 1, base - h * 0.52 - 3, 3, 3);
          ctx.fillRect(bx + 3, base - h * 0.52 - 2, 2, 2);
        }
        if (broken > 0.78) {
          // A surviving fragment of an arch.
          const ax = x + Math.floor(w / 2) + 2;
          ctx.fillStyle = palette.ruin;
          ctx.fillRect(ax, base - h * 0.72, w - 2, h * 0.72 - 4);
          ctx.fillRect(ax - 7, base - h * 0.72, 12, 4);
          ctx.fillRect(ax - 8, base - h * 0.72 - 4, 4, 4);
        }
        if (PJ.hash2(i + 5, 49) > 0.5) {
          ctx.fillStyle = palette.ruin;
          ctx.fillRect(x + Math.floor(w / 2) + 1, base - h * 0.35, 6, 3);
        }
      }
    }

    _drawDesertFlora(ctx, palette) {
      const span = 700;
      const shift = (this.camera.x * 0.27) % span;
      for (let i = -1; i < 5; i++) {
        let x = i * 156 - shift + PJ.hash2(i + 21, 53) * 54;
        if (x < -50 || x > VIEW_W + 50) continue;
        x = Math.round(x);
        const h = 14 + Math.floor(PJ.hash2(i + 23, 54) * 22);
        this._drawCactus(ctx, x, 241, h, palette.cactus);
        if (PJ.hash2(i + 4, 55) > 0.52) {
          ctx.fillStyle = 'rgba(54,36,31,0.5)';
          ctx.fillRect(x + 12, 236, 8, 5);
          ctx.fillStyle = 'rgba(213,171,116,0.3)';
          ctx.fillRect(x + 13, 236, 5, 1);
        }
      }
    }

    _drawCactus(ctx, x, base, height, color) {
      ctx.fillStyle = color;
      ctx.fillRect(x, base - height, 4, height);
      ctx.fillRect(x + 1, base - height - 2, 2, 2);
      const armY = base - height * 0.58;
      ctx.fillRect(x - 5, armY, 5, 3);
      ctx.fillRect(x - 5, armY, 2, 10);
      ctx.fillRect(x + 4, armY - 4, 5, 3);
      ctx.fillRect(x + 7, armY - 8, 2, 10);
      ctx.fillStyle = 'rgba(132,174,110,0.35)';
      ctx.fillRect(x + 1, base - height + 2, 1, Math.max(2, height - 5));
      ctx.fillRect(x - 4, armY + 2, 1, 5);
    }

    _drawSandWind(ctx, palette) {
      for (let i = 0; i < this.spores.length; i += 1) {
        const mote = this.spores[i];
        const drift = Math.sin(this.animTime * 0.8 + mote.phase) * 5;
        const x = ((mote.x - this.camera.x * 0.12 - this.animTime * (8 + mote.freq * 8) + drift) % (VIEW_W + 30) + VIEW_W + 30) % (VIEW_W + 30) - 15;
        const y = mote.y + Math.sin(this.animTime * 0.7 + mote.phase) * 3;
        ctx.globalAlpha = 0.12 + (i % 4) * 0.05;
        ctx.fillStyle = palette.dust;
        ctx.fillRect(Math.round(x), Math.round(y), i % 3 === 0 ? 3 : 1, 1);
      }
      ctx.globalAlpha = 0.08;
      ctx.fillStyle = palette.haze;
      ctx.fillRect(0, 198, VIEW_W, 2);
      ctx.globalAlpha = 1;
    }

    _drawHeatHaze(ctx, palette) {
      ctx.globalAlpha = 0.06;
      ctx.fillStyle = palette.haze;
      for (let band = 0; band < 3; band++) {
        for (let x = 0; x < VIEW_W; x += 12) {
          const y = 172 + band * 12 + Math.round(Math.sin((x + this.camera.x * 0.2 + this.animTime * 16) / 26 + band) * 2);
          ctx.fillRect(x, y, 6, 1);
        }
      }
      ctx.globalAlpha = 1;
    }

    _pixelCircle(ctx, cx, cy, radius, color) {
      ctx.fillStyle = color;
      const r = Math.round(radius);
      for (let y = -r; y < r; y += 2) {
        const half = Math.floor(Math.sqrt(Math.max(0, r * r - y * y)) / 2) * 2;
        if (half <= 0) continue;
        ctx.fillRect(Math.round(cx - half), Math.round(cy + y), half * 2, 2);
      }
    }

    _drawWorld(ctx) {
      const left = Math.max(0, Math.floor(this.camera.x / TILE) - 1);
      const right = Math.min(this.level.cols - 1, Math.ceil((this.camera.x + VIEW_W) / TILE) + 1);
      const top = Math.max(0, Math.floor(this.camera.y / TILE) - 1);
      const bottom = Math.min(this.level.heightTiles - 1, Math.ceil((this.camera.y + VIEW_H) / TILE) + 1);

      // Dark chasm under gaps reads as depth instead of distant scenery.
      for (let tx = left; tx <= right; tx++) {
        if (!this.level.isSolidAt(tx, 15) && !this.level.isSolidAt(tx, 16)) {
          ctx.fillStyle = '#140c0b';
          ctx.fillRect(tx * TILE, 240, TILE, this.level.pixelH - 240);
          ctx.fillStyle = '#2a1712';
          ctx.fillRect(tx * TILE, 240, TILE, 1);
          if (PJ.hash2(tx, 31) > 0.55) {
            ctx.fillStyle = '#331e16';
            ctx.fillRect(tx * TILE + 3, 246 + Math.floor(PJ.hash2(tx, 32) * 18), 1, 1);
          }
        }
      }

      this.level.signs.forEach((sign) => this._drawSign(ctx, sign));

      for (let ty = top; ty <= bottom; ty++) {
        for (let tx = left; tx <= right; tx++) {
          this._drawTile(ctx, tx, ty);
        }
      }

      this._drawSlopes(ctx);
      this._drawTileShadows(ctx, left, right, top, bottom);
      this.platforms.forEach((platform) => platform.draw(ctx));
      this.jumpPads.forEach((pad) => pad.draw(ctx, this.animTime));
      this.checkpoints.forEach((cp) => cp.draw(ctx, this.animTime));
      this.goal.draw(ctx, this.animTime);
      this.npcs.forEach((npc) => npc.draw(ctx, this.animTime));

      if (this.ice) this.ice.draw(ctx, this.animTime);
      this.gems.forEach((gem) => gem.draw(ctx, this.animTime));
      this.enemies.forEach((enemy) => enemy.draw(ctx, this.animTime));

      if (!this.player.dead) {
        const blink = this.player.invuln > 0 && Math.floor(this.animTime * 13) % 2 === 0;
        if (!blink) this.player.draw(ctx, this.animTime);
      }

      if (this.state === 'playing' && !this.dialogueActive && this.isNpcNear()) {
        this._drawNpcPrompt(ctx, this.nearNpc);
      }

      this.particles.forEach((particle) => particle.draw(ctx));

      // Fireflies / dust motes.
      for (let i = 0; i < this.motes.length; i++) {
        const mote = this.motes[i];
        const mx = mote.x + Math.sin(this.animTime * mote.speed + mote.phase) * 4;
        const my = mote.y + Math.cos(this.animTime * mote.speed * 0.7 + mote.phase) * 3;
        if (mx < this.camera.x - 8 || mx > this.camera.x + VIEW_W + 8) continue;
        const glow = (Math.sin(this.animTime * 2.2 + mote.phase) + 1) / 2;
        ctx.globalAlpha = Math.ceil((0.25 + glow * 0.65) * 4) / 4;
        ctx.fillStyle = mote.color;
        ctx.fillRect(Math.round(mx), Math.round(my), 1, 1);
        if (glow > 0.72) {
          ctx.globalAlpha = 0.18;
          ctx.fillRect(Math.round(mx) - 1, Math.round(my), 3, 1);
          ctx.fillRect(Math.round(mx), Math.round(my) - 1, 1, 3);
        }
      }
      ctx.globalAlpha = 1;
    }

    _drawNpcPrompt(ctx, npc) {
      if (!npc) return;
      const x = Math.round(npc.x + npc.w / 2);
      const y = Math.round(npc.y) - 11;
      ctx.fillStyle = 'rgba(13, 18, 17, 0.9)';
      ctx.fillRect(x - 7, y - 1, 15, 9);
      ctx.fillStyle = 'rgba(255, 211, 106, 0.42)';
      ctx.fillRect(x - 7, y - 1, 15, 1);
      PixelFont.draw(ctx, 'E', x, y + 1, '#ffe4a2', 1, 'center');
      ctx.fillStyle = 'rgba(13, 18, 17, 0.9)';
      ctx.fillRect(x - 1, y + 8, 2, 2);
    }

    _drawSign(ctx, sign) {
      const x = sign.tx * TILE;
      const baseY = (sign.ty + 1) * TILE;
      const lines = sign.lines || [];
      let maxWidth = 0;
      lines.forEach((line) => {
        maxWidth = Math.max(maxWidth, PixelFont.width(line, 1));
      });
      const panelW = Math.min(76, maxWidth + 10);
      const panelH = 8 + lines.length * 9;
      const panelX = x - Math.floor(panelW / 2) + 8;
      const panelY = baseY - 9 - panelH;

      // Post.
      ctx.fillStyle = '#100d08';
      ctx.fillRect(x + 6, panelY + panelH - 2, 4, baseY - panelY - panelH + 2);
      ctx.fillStyle = '#55412c';
      ctx.fillRect(x + 7, panelY + panelH - 2, 2, baseY - panelY - panelH);

      // Weathered wooden panel.
      ctx.fillStyle = '#0b120d';
      ctx.fillRect(panelX - 1, panelY - 1, panelW + 2, panelH + 2);
      ctx.fillStyle = '#382a1c';
      ctx.fillRect(panelX, panelY, panelW, panelH);
      ctx.fillStyle = '#57442c';
      ctx.fillRect(panelX + 2, panelY + 2, panelW - 4, 2);
      ctx.fillStyle = '#8f7d4f';
      ctx.fillRect(panelX + 2, panelY + 2, 2, 2);
      ctx.fillRect(panelX + panelW - 4, panelY + 2, 2, 2);
      ctx.fillStyle = '#243a20';
      ctx.fillRect(panelX + 3, panelY + panelH - 3, 5, 2);
      ctx.fillRect(panelX + panelW - 9, panelY + panelH - 4, 4, 2);

      ctx.fillStyle = '#f6dfb3';
      for (let i = 0; i < lines.length; i++) {
        PixelFont.draw(ctx, lines[i], panelX + 5, panelY + 6 + i * 9, '#f6dfb3', 1);
      }
    }

    _drawTile(ctx, tx, ty) {
      const tile = this.level.tileAt(tx, ty);
      if (tile === PJ.TILE_EMPTY) return;
      if (tile === PJ.TILE_SPIKE) {
        this._drawSpikes(ctx, tx, ty);
        return;
      }

      const x = tx * TILE;
      const y = ty * TILE;
      const solidLeft = this.level.isSolidAt(tx - 1, ty);
      const solidRight = this.level.isSolidAt(tx + 1, ty);
      const solidTop = this.level.isSolidAt(tx, ty - 1);
      const solidBottom = this.level.isSolidAt(tx, ty + 1);

      ctx.fillStyle = '#4a302b';
      ctx.fillRect(x, y, TILE, TILE);
      ctx.fillStyle = '#75503f';
      ctx.fillRect(x + 1, y + 1, TILE - 2, TILE - 2);
      ctx.fillStyle = '#654335';
      ctx.fillRect(x + 1, y + 1, TILE - 2, 2);

      // Sandstone block seams.
      ctx.fillStyle = 'rgba(55,32,28,0.42)';
      ctx.fillRect(x + 8, y + 4, 1, TILE - 6);
      ctx.fillRect(x + 2, y + 11, 12, 1);
      ctx.fillStyle = 'rgba(194,138,91,0.35)';
      ctx.fillRect(x + 9, y + 4, 1, 5);

      // Wind-worn grains and a few embedded stones.
      for (let i = 0; i < 3; i++) {
        const hx = PJ.hash2(tx * 5 + i, ty * 7 + i);
        const hy = PJ.hash2(tx * 3 + i * 4, ty * 11 + i);
        const px = x + 2 + Math.floor(hx * 12);
        const py = y + 6 + Math.floor(hy * 8);
        ctx.fillStyle = i === 0 ? '#9a6b49' : '#5a3a31';
        ctx.fillRect(px, py, 1 + (i === 1 ? 1 : 0), 1);
      }
      if (PJ.hash2(tx, ty + 20) > 0.66) {
        ctx.fillStyle = '#a67852';
        ctx.fillRect(x + 4 + Math.floor(PJ.hash2(tx, ty) * 6), y + 10, 2, 1);
      }
      if (PJ.hash2(tx + 3, ty + 9) > 0.82) {
        ctx.fillStyle = '#49302b';
        ctx.fillRect(x + 3, y + 7, 1, 4);
        ctx.fillRect(x + 4, y + 9, 2, 1);
      }

      if (!solidTop) {
        ctx.fillStyle = '#8f5f41';
        ctx.fillRect(x, y, TILE, 6);
        ctx.fillStyle = '#c28d5c';
        ctx.fillRect(x, y, TILE, 4);
        ctx.fillStyle = '#e8b979';
        ctx.fillRect(x, y, TILE, 2);
        ctx.fillStyle = '#f6d99e';
        const lx = 2 + Math.floor(PJ.hash2(tx, ty) * 10);
        ctx.fillRect(x + lx, y, 2 + Math.floor(PJ.hash2(tx, ty + 2) * 2), 1);
        ctx.fillStyle = '#a8754d';
        ctx.fillRect(x, y + 4, TILE, 1);
        ctx.fillRect(x + 3, y + 5, 3, 1);
        ctx.fillRect(x + 11, y + 5, 2, 1);

        // Tiny desert details: dry grass, bones, and carved fragments.
        const deco = PJ.hash2(tx + 17, ty + 3);
        if (deco > 0.91) {
          const bx = x + 4 + Math.floor(PJ.hash2(tx + 2, ty + 6) * 8);
          ctx.fillStyle = '#e7d8b0';
          ctx.fillRect(bx, y - 1, 3, 1);
          ctx.fillRect(bx + 1, y - 2, 1, 1);
          ctx.fillStyle = '#8c7253';
          ctx.fillRect(bx + 1, y, 1, 1);
        } else if (deco > 0.8) {
          const gx = x + 3 + Math.floor(PJ.hash2(tx + 5, ty + 2) * 10);
          ctx.fillStyle = '#9a7c45';
          ctx.fillRect(gx, y - 3, 1, 3);
          ctx.fillRect(gx + 2, y - 2, 1, 2);
          ctx.fillRect(gx + 4, y - 4, 1, 4);
        }
      }

      if (!solidBottom) {
        ctx.fillStyle = '#2c1b18';
        ctx.fillRect(x, y + TILE - 3, TILE, 3);
        ctx.fillStyle = '#402823';
        ctx.fillRect(x, y + TILE - 5, TILE, 2);
        ctx.fillStyle = '#1c1110';
        ctx.fillRect(x, y + TILE - 2, 2, 2);
        ctx.fillRect(x + TILE - 2, y + TILE - 2, 2, 2);

        // A cracked underside gives the floating ruins character.
        if (PJ.hash2(tx + 4, ty + 1) > 0.58) {
          const vx = x + 4 + Math.floor(PJ.hash2(tx, ty + 4) * 7);
          const vh = 3 + Math.floor(PJ.hash2(tx + 1, ty) * 5);
          ctx.fillStyle = '#39221d';
          ctx.fillRect(vx, y + TILE, 1, vh);
          ctx.fillStyle = '#6d4937';
          ctx.fillRect(vx + 1, y + TILE + 2, 2, 1);
        }
      }

      if (!solidLeft) {
        ctx.fillStyle = '#33201d';
        ctx.fillRect(x, y + 2, 2, TILE - 4);
        ctx.fillStyle = '#a4754e';
        ctx.fillRect(x + 2, y + 3, 1, TILE - 6);
        if (PJ.hash2(tx, ty + 4) > 0.68) {
          ctx.fillStyle = '#59382e';
          ctx.fillRect(x, y + 6, 1, 4);
        }
      }
      if (!solidRight) {
        ctx.fillStyle = '#33201d';
        ctx.fillRect(x + TILE - 2, y + 2, 2, TILE - 4);
        ctx.fillStyle = '#a4754e';
        ctx.fillRect(x + TILE - 3, y + 3, 1, TILE - 6);
        if (PJ.hash2(tx, ty + 7) > 0.68) {
          ctx.fillStyle = '#59382e';
          ctx.fillRect(x + TILE - 1, y + 6, 1, 4);
        }
      }
    }

    _drawSpikes(ctx, tx, ty) {
      const x = tx * TILE;
      const y = ty * TILE;
      ctx.fillStyle = '#2b1914';
      ctx.fillRect(x, y + 13, TILE, 3);
      ctx.fillStyle = '#6b4631';
      ctx.fillRect(x, y + 13, TILE, 1);

      const centers = [x + 4, x + 12];
      for (let i = 0; i < centers.length; i++) {
        const cx = centers[i];
        for (let row = 0; row < 8; row++) {
          const width = 1 + row;
          ctx.fillStyle = row < 3 ? '#fff3d3' : '#d9b482';
          ctx.fillRect(Math.round(cx - width / 2), y + 7 + row, width, 1);
        }
        ctx.fillStyle = '#f0d6a3';
        ctx.fillRect(cx - 1, y + 9, 1, 3);
      }
      ctx.fillStyle = '#8e6247';
      ctx.fillRect(x + 1, y + 15, 14, 1);
    }

    _drawTileShadows(ctx, left, right, top, bottom) {
      if (!this.palette || this.isNight) return;
      const shadow = this.palette.shadow;

      // Shadows are derived from the exact ground tiles that fail the sun
      // raycast. This keeps the contour locked to the real shade instead of
      // guessing from a projected block edge.
      const groundY = this.level.pixelH - 32;
      const groundRow = Math.floor(groundY / TILE);
      const runs = [];
      let runStart = null;

      for (let tx = left; tx <= right + 1; tx++) {
        let shaded = false;
        if (tx <= right && this.level.isSolidAt(tx, groundRow) && !this.level.isSolidAt(tx, groundRow - 1)) {
          const exposure = this._sunExposureAt(tx * TILE + TILE / 2, groundY - 1, TILE - 6);
          shaded = exposure <= 0.6;
        }

        if (shaded) {
          if (runStart === null) runStart = tx;
        } else if (runStart !== null) {
          runs.push({ start: runStart, end: tx - 1 });
          runStart = null;
        }
      }

      ctx.save();
      ctx.fillStyle = shadow;
      ctx.strokeStyle = shadow;
      const sunSlope = this.sun.dirX / Math.max(0.28, Math.abs(this.sun.dirY));

      for (let i = 0; i < runs.length; i++) {
        const run = runs[i];
        const x1 = run.start * TILE;
        const x2 = (run.end + 1) * TILE;
        const width = x2 - x1;
        const capLeft = run.start > left;
        const capRight = run.end < right;

        // Soft halo, dark core, then sparse stipple.
        ctx.globalAlpha = 0.15;
        ctx.fillRect(x1 - 2, groundY - 2, width + 4, 14);
        ctx.globalAlpha = 0.46;
        ctx.fillRect(x1, groundY, width, 8);
        ctx.globalAlpha = 0.15;
        for (let hx = x1 + 3; hx < x2; hx += 8) {
          ctx.fillRect(hx, groundY + 3, 2, 2);
        }

        // Draw a faint solid contour first so the line never vanishes, then
        // the bright dashed contour requested for the shadow path.
        ctx.beginPath();
        ctx.moveTo(x1 + 0.5, groundY + 0.5);
        ctx.lineTo(x2 - 0.5, groundY + 0.5);
        if (capRight) ctx.lineTo(x2 - 0.5, groundY + 8.5);
        ctx.moveTo(x1 + 0.5, groundY + 8.5);
        ctx.lineTo(x2 - 0.5, groundY + 8.5);
        if (capLeft) ctx.lineTo(x1 + 0.5, groundY + 0.5);

        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.34;
        ctx.setLineDash([]);
        ctx.stroke();

        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.94;
        ctx.setLineDash([4, 3]);
        ctx.stroke();

        // Short ticks at the exposed ends suggest the projection direction.
        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.38;
        ctx.setLineDash([2, 3]);
        ctx.beginPath();
        if (capLeft) {
          ctx.moveTo(x1 + 0.5, groundY + 0.5);
          ctx.lineTo(x1 + sunSlope * 8 + 0.5, groundY - 7.5);
        }
        if (capRight) {
          ctx.moveTo(x2 - 0.5, groundY + 0.5);
          ctx.lineTo(x2 + sunSlope * 8 - 0.5, groundY - 7.5);
        }
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Soft contact shadows also slide away from the sun.
      const offsetX = -this.sun.dirX * 11;
      if (this.player.grounded && !this.player.dead) {
        ctx.globalAlpha = 0.12;
        ctx.fillRect(
          Math.round(this.player.centerX - this.player.w / 2 + offsetX) - 2,
          Math.round(this.player.y + this.player.h) - 3,
          this.player.w + 8,
          5
        );
        ctx.globalAlpha = 0.32;
        ctx.fillRect(
          Math.round(this.player.centerX - this.player.w / 2 + offsetX),
          Math.round(this.player.y + this.player.h) - 1,
          this.player.w + 4,
          2
        );
      }
      if (this.ice && !this.ice.arrived && this.ice.grounded) {
        ctx.globalAlpha = 0.12;
        ctx.fillRect(Math.round(this.ice.x + 1 + offsetX), Math.round(this.ice.y + this.ice.h) - 3, this.ice.w + 2, 5);
        ctx.globalAlpha = 0.32;
        ctx.fillRect(Math.round(this.ice.x + 2 + offsetX), Math.round(this.ice.y + this.ice.h) - 1, this.ice.w - 2, 2);
      }
      ctx.globalAlpha = 1;
      ctx.restore();

      this._drawBlockTopShadows(ctx, left, right, top, bottom);
    }

    _drawSlopes(ctx) {
      for (let i = 0; i < this.slopes.length; i++) {
        const slope = this.slopes[i];
        const x1 = slope.x1;
        const x2 = slope.x2;
        const baseY = slope.baseY;
        const y1 = this._slopeSurfaceAt(slope, x1);
        const y2 = this._slopeSurfaceAt(slope, x2);

        ctx.fillStyle = '#35211f';
        ctx.beginPath();
        ctx.moveTo(x1, baseY);
        ctx.lineTo(x2, baseY);
        ctx.lineTo(x2, y2);
        ctx.lineTo(x1, y1);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#76503d';
        ctx.beginPath();
        ctx.moveTo(x1 + 2, baseY - 1);
        ctx.lineTo(x2 - 1, baseY - 1);
        ctx.lineTo(x2 - 1, y2 + 2);
        ctx.lineTo(x1 + 1, y1 + 2);
        ctx.closePath();
        ctx.fill();

        const topY = baseY - slope.rise;
        const highX = slope.down ? x1 : x2;
        ctx.fillStyle = '#4a2d25';
        ctx.fillRect(highX - 1, topY, 2, baseY - topY);

        ctx.strokeStyle = '#c08d5b';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x1 + 1, y1 - 1);
        ctx.lineTo(x2 - 1, y2 - 1);
        ctx.stroke();

        ctx.strokeStyle = 'rgba(58, 34, 29, 0.6)';
        ctx.lineWidth = 1;
        for (let step = 1; step < 5; step++) {
          const t = step / 5;
          const sx = x1 + (x2 - x1) * t;
          const sy = y1 + (y2 - y1) * t;
          ctx.beginPath();
          ctx.moveTo(sx, sy + 2);
          ctx.lineTo(sx + 5, sy + 7);
          ctx.stroke();
        }
      }
    }

    _drawBlockTopShadows(ctx, left, right, top, bottom) {
      if (!this.palette || this.isNight) return;

      // Solid blocks receive the same raycast shade as the ground. Sampling the
      // exposed top strip in four columns keeps a broad shadow from being
      // painted over a lit tile face while still catching soft partial edges.
      const samples = 4;
      const sampleWidth = TILE / samples;
      for (let ty = top; ty <= bottom && ty < 15; ty++) {
        for (let tx = left; tx <= right; tx++) {
          if (!this.level.isSolidAt(tx, ty)) continue;
          if (ty > 0 && this.level.isSolidAt(tx, ty - 1)) continue;

          const x = tx * TILE;
          const y = ty * TILE;
          const shaded = [];
          let shadedColumns = 0;
          for (let i = 0; i < samples; i++) {
            const sx = x + sampleWidth * i + sampleWidth / 2;
            shaded[i] = !this._isSunlitAt(sx, y - 1);
            if (shaded[i]) shadedColumns += 1;
          }
          if (!shadedColumns) continue;

          ctx.save();
          ctx.beginPath();
          ctx.rect(x, y, TILE, 8);
          ctx.clip();

          for (let i = 0; i < samples; i++) {
            if (!shaded[i]) continue;
            const sx = x + sampleWidth * i;
            ctx.fillStyle = 'rgba(48, 31, 43, 0.42)';
            ctx.fillRect(sx, y, sampleWidth, 4);
            ctx.fillStyle = 'rgba(38, 25, 37, 0.24)';
            ctx.fillRect(sx, y + 4, sampleWidth, 4);
          }

          // A darker, slightly offset lip sells the contact between a sunlit
          // face and the shaded top without creating a floating black band.
          if (shadedColumns === samples) {
            ctx.fillStyle = 'rgba(31, 21, 32, 0.24)';
            ctx.fillRect(x + 1, y + 5, TILE - 2, 2);
          }
          ctx.restore();
        }
      }
    }

    _drawHud(ctx) {
      const h = 38;
      const ice = this.ice;
      const integrity = ice ? Math.max(0, Math.ceil(ice.integrity)) : 0;
      const sunlit = !!(ice && ice.sunlit && !ice.arrived);
      const chill = Math.max(0, Math.min(100, Math.ceil(this.chill)));

      ctx.fillStyle = 'rgba(18, 11, 17, 0.88)';
      ctx.fillRect(0, 0, VIEW_W, h);
      ctx.fillStyle = 'rgba(255, 186, 108, 0.18)';
      ctx.fillRect(0, h - 1, VIEW_W, 1);

      if (this.iceIntroduced) {
        // Ice crystal icon and integrity bar.
        const iconX = 10;
        const iceWidths = [2, 4, 6, 8, 8, 6, 4, 2];
        for (let row = 0; row < iceWidths.length; row++) {
          ctx.fillStyle = row < 2 ? '#e9ffff' : sunlit ? '#ffd38d' : '#6ee6f3';
          ctx.fillRect(iconX + 4 - iceWidths[row] / 2, 4 + row, iceWidths[row], 1);
        }
        PixelFont.draw(ctx, 'ICE ' + integrity + '%', 22, 5, '#d8ffff', 1);
        ctx.fillStyle = '#37262c';
        ctx.fillRect(22, 15, 64, 3);
        ctx.fillStyle = integrity > 50 ? '#6ee6f3' : integrity > 20 ? '#ffbf6e' : '#ff7b70';
        ctx.fillRect(22, 15, Math.round((64 * integrity) / 100), 3);

        // Chill icon and meter.
        const chillColor = chill > 70 ? '#ff9b8c' : '#a9e4ff';
        ctx.fillStyle = chillColor;
        ctx.fillRect(13, 20, 1, 9);
        ctx.fillRect(9, 24, 9, 1);
        ctx.fillRect(10, 21, 1, 1);
        ctx.fillRect(17, 21, 1, 1);
        ctx.fillRect(10, 27, 1, 1);
        ctx.fillRect(17, 27, 1, 1);
        PixelFont.draw(ctx, 'CHILL ' + chill + '%', 22, 22, '#c7eaff', 1);
        ctx.fillStyle = '#2b2834';
        ctx.fillRect(22, 32, 64, 3);
        ctx.fillStyle = chillColor;
        ctx.fillRect(22, 32, Math.round((64 * chill) / 100), 3);
      } else {
        PixelFont.draw(ctx, 'FOLLOW THE GUIDES', 10, 9, '#c9bda7', 1);
        ctx.fillStyle = 'rgba(255, 209, 106, 0.4)';
        ctx.fillRect(10, 21, 78, 1);
      }

      if (this.gems.length) {
        const shardColor = this.collected === this.gems.length ? '#ffe39a' : '#7df7ff';
        ctx.fillStyle = shardColor;
        ctx.fillRect(110, 7, 3, 1);
        ctx.fillRect(108, 8, 7, 3);
        ctx.fillRect(110, 11, 3, 1);
        ctx.fillStyle = '#eaffff';
        ctx.fillRect(110, 8, 1, 1);
        PixelFont.draw(ctx, 'SHARDS ' + this.collected + '/' + this.gems.length, 119, 5, shardColor, 1);
      }

      PixelFont.draw(ctx, this.level.label, Math.floor(VIEW_W / 2), 5, '#b9a8b7', 1, 'center');
      let stateLabel;
      let stateColor;
      if (this.state === 'failed') {
        stateLabel = this.failReason === 'cold' ? 'FROZEN' : 'MELTED';
        stateColor = '#ff8b7d';
      } else if (ice && ice.arrived) {
        stateLabel = 'SAFE';
        stateColor = '#d8ffff';
      } else if (this.isNight) {
        stateLabel = 'NIGHT';
        stateColor = '#a9cfff';
      } else {
        stateLabel = sunlit ? 'IN SUN' : 'SHADE';
        stateColor = sunlit ? '#ffd06a' : '#82e9e1';
      }
      PixelFont.draw(ctx, stateLabel, Math.floor(VIEW_W / 2), 15, stateColor, 1, 'center');

      if (this.playerSunlit) {
        PixelFont.draw(ctx, 'WARM', Math.floor(VIEW_W / 2), 26, '#ffd36a', 1, 'center');
      } else if (this.isNight) {
        PixelFont.draw(ctx, 'COLD', Math.floor(VIEW_W / 2), 26, '#a9e4ff', 1, 'center');
      }

      // Sun/moon glyph and clock time.
      const gx = 404;
      const gy = 8;
      if (this.isNight) {
        ctx.fillStyle = '#cfe6ff';
        ctx.fillRect(gx - 1, gy - 3, 5, 7);
        ctx.fillRect(gx - 3, gy - 1, 2, 3);
        ctx.fillRect(gx + 4, gy - 1, 2, 3);
      } else {
        ctx.fillStyle = '#ffd36a';
        ctx.fillRect(gx - 1, gy - 3, 3, 7);
        ctx.fillRect(gx - 3, gy - 1, 1, 3);
        ctx.fillRect(gx + 3, gy - 1, 1, 3);
        ctx.fillRect(gx - 1, gy - 5, 3, 1);
        ctx.fillRect(gx - 1, gy + 4, 3, 1);
      }
      PixelFont.draw(ctx, this.getTimeLabel(), 470, 5, '#ffe4a2', 1, 'right');
      PixelFont.draw(ctx, (this.isNight ? 'MOON ' : 'SUN ') + this.getClockText(), 470, 15, '#c2b5c8', 1, 'right');
      PixelFont.draw(ctx, 'RUN ' + PJ.formatTime(this.runTime), 470, 26, '#8e8492', 1, 'right');

      if (this.toast) {
        const t = clamp(this.toast.time / this.toast.max, 0, 1);
        const alpha = t > 0.8 ? (1 - t) / 0.2 : Math.min(1, t * 6);
        const width = PixelFont.width(this.toast.text, 1) + 18;
        ctx.globalAlpha = Math.max(0, Math.min(0.92, alpha));
        ctx.fillStyle = '#1b1013';
        ctx.fillRect(Math.round(VIEW_W / 2 - width / 2), 46, width, 15);
        ctx.fillStyle = 'rgba(255, 199, 117, 0.38)';
        ctx.fillRect(Math.round(VIEW_W / 2 - width / 2), 46, width, 1);
        ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
        PixelFont.draw(ctx, this.toast.text, VIEW_W / 2, 50, this.toast.color, 1, 'center');
        ctx.globalAlpha = 1;
      }

      if (this.debug) {
        PixelFont.draw(ctx, 'DEBUG', VIEW_W - 8, 46, '#ff7a9c', 1, 'right');
      }
    }

    _drawDebug(ctx, camX, camY) {
      ctx.save();
      ctx.translate(-camX, -camY);
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(255, 87, 125, 0.75)';
      const player = this.player.getRect();
      ctx.strokeRect(Math.floor(player.x) + 0.5, Math.floor(player.y) + 0.5, player.w - 1, player.h - 1);
      this.gems.forEach((gem) => {
        const r = gem.getRect();
        ctx.strokeRect(Math.floor(r.x) + 0.5, Math.floor(r.y) + 0.5, r.w - 1, r.h - 1);
      });
      this.enemies.forEach((enemy) => {
        if (enemy.dead) return;
        const r = enemy.getRect();
        ctx.strokeRect(Math.floor(r.x) + 0.5, Math.floor(r.y) + 0.5, r.w - 1, r.h - 1);
      });
      const goal = this.goal.getRect();
      ctx.strokeStyle = 'rgba(255, 213, 105, 0.75)';
      ctx.strokeRect(Math.floor(goal.x) + 0.5, Math.floor(goal.y) + 0.5, goal.w - 1, goal.h - 1);
      if (this.ice) {
        const ice = this.ice.getRect();
        ctx.strokeStyle = 'rgba(126, 245, 255, 0.8)';
        ctx.strokeRect(Math.floor(ice.x) + 0.5, Math.floor(ice.y) + 0.5, ice.w - 1, ice.h - 1);
      }
      this.npcs.forEach((npc) => {
        const rect = npc.getRect();
        ctx.strokeStyle = 'rgba(255, 211, 106, 0.8)';
        ctx.strokeRect(Math.floor(rect.x) + 0.5, Math.floor(rect.y) + 0.5, rect.w - 1, rect.h - 1);
      });
      this.platforms.forEach((platform) => {
        ctx.strokeStyle = 'rgba(94, 234, 212, 0.85)';
        ctx.strokeRect(Math.floor(platform.x) + 0.5, Math.floor(platform.y) + 0.5, platform.w - 1, platform.h - 1);
      });
      this.jumpPads.forEach((pad) => {
        ctx.strokeStyle = 'rgba(255, 209, 102, 0.9)';
        const r = pad.getRect();
        ctx.strokeRect(Math.floor(r.x) + 0.5, Math.floor(r.y) + 0.5, r.w - 1, r.h - 1);
      });
      this.slopes.forEach((slope) => {
        const y1 = this._slopeSurfaceAt(slope, slope.x1);
        const y2 = this._slopeSurfaceAt(slope, slope.x2);
        const highX = slope.down ? slope.x1 : slope.x2;
        const topY = slope.baseY - slope.rise;

        ctx.strokeStyle = 'rgba(255, 137, 102, 0.9)';
        ctx.beginPath();
        ctx.moveTo(slope.x1, slope.baseY);
        ctx.lineTo(slope.x2, slope.baseY);
        ctx.lineTo(slope.x2, y2);
        ctx.lineTo(slope.x1, y1);
        ctx.closePath();
        ctx.stroke();

        // The high face is a real collider, not just a decorative edge.
        ctx.strokeStyle = 'rgba(255, 92, 92, 0.95)';
        ctx.beginPath();
        ctx.moveTo(highX, topY);
        ctx.lineTo(highX, slope.baseY);
        ctx.stroke();
      });
      ctx.restore();
    }

    _makeSpores() {
      const spores = [];
      for (let i = 0; i < 54; i++) {
        spores.push({
          x: PJ.hash2(i + 1, 3) * VIEW_W,
          y: 12 + Math.floor(PJ.hash2(i + 2, 8) * 186),
          size: PJ.hash2(i + 3, 9) > 0.8 ? 2 : 1,
          phase: PJ.hash2(i + 4, 12) * Math.PI * 2,
          freq: 0.9 + PJ.hash2(i + 5, 13) * 2.2,
          color: i % 7 === 0 ? '#c4ffcf' : i % 5 === 0 ? '#ffe0a0' : '#d9edb0'
        });
      }
      return spores;
    }

    _makeMotes() {
      const motes = [];
      for (let i = 0; i < 32; i++) {
        motes.push({
          x: PJ.hash2(i + 7, 21) * this.level.pixelW,
          y: 140 + PJ.hash2(i + 8, 22) * 115,
          phase: PJ.hash2(i + 9, 23) * Math.PI * 2,
          speed: 0.45 + PJ.hash2(i + 10, 24) * 1.1,
          color: i % 4 === 0 ? '#ffe09a' : '#e6c79a'
        });
      }
      return motes;
    }
  }

  PJ.Game = Game;
})(typeof window !== 'undefined' ? window : globalThis);
