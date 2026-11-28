/* Player, enemies, pickups and particles. No DOM access here, which keeps the
   simulation unit-testable under Node. */
(function (global) {
  'use strict';

  const PJ = global.PJ || (global.PJ = {});
  const TILE = PJ.TILE;
  const clamp = PJ.clamp;
  const approach = PJ.approach;

  const PHYSICS = Object.freeze({
    runSpeed: 118,
    groundAccel: 1400,
    airAccel: 950,
    groundFriction: 1900,
    airFriction: 480,
    gravity: 1120,
    jumpCutGravity: 2350,
    jumpSpeed: -340,
    maxFall: 440,
    coyoteTime: 0.1,
    jumpBufferTime: 0.13
  });

  const TURN_TIME = 0.16;

  class Player {
    constructor(spawn) {
      this.w = 10;
      this.h = 14;
      this.reset(spawn);
    }

    reset(spawn) {
      this.x = spawn.x;
      this.y = spawn.y;
      this.vx = 0;
      this.vy = 0;
      this.grounded = false;
      this.coyote = 0;
      this.jumpBuffer = 0;
      this.facing = 1;
      this.visualFacing = 1;
      this.spriteBlend = 0;
      this.turnTimer = 0;
      this.turnTarget = 1;
      this.turnFromFacing = 1;
      this.turnWasMoving = false;
      this.animTime = 0;
      this.invuln = 0;
      this.justJumped = false;
      this.justTurned = false;
      this.landedVelocity = 0;
      this.wasGrounded = false;
      this.hitWall = false;
      this.hitCeiling = false;
      this.padLaunch = false;
      this.dropTimer = 0;
      this.stepDustTimer = 0;
      this.dead = false;
      this.deadTimer = 0;
    }

    getRect() {
      return { x: this.x, y: this.y, w: this.w, h: this.h };
    }

    get centerX() {
      return this.x + this.w / 2;
    }

    get centerY() {
      return this.y + this.h / 2;
    }

    update(dt, level, input) {
      this.justJumped = false;
      this.justTurned = false;
      this.landedVelocity = 0;
      this.hitWall = false;
      this.hitCeiling = false;
      this.wasGrounded = this.grounded;
      this.animTime += dt;
      if (this.invuln > 0) this.invuln = Math.max(0, this.invuln - dt);
      if (this.dropTimer > 0) this.dropTimer = Math.max(0, this.dropTimer - dt);

      const left = input.isDown('left');
      const right = input.isDown('right');
      const direction = (right ? 1 : 0) - (left ? 1 : 0);

      if (direction !== 0) this.facing = direction;

      if (this.grounded) {
        this.coyote = PHYSICS.coyoteTime;
      } else {
        this.coyote = Math.max(0, this.coyote - dt);
      }

      if (input.wasPressed('jump')) {
        this.jumpBuffer = PHYSICS.jumpBufferTime;
      } else {
        this.jumpBuffer = Math.max(0, this.jumpBuffer - dt);
      }

      if (this.jumpBuffer > 0 && this.coyote > 0) {
        this.vy = -PJ.TUNING.jumpSpeed;
        this.grounded = false;
        this.coyote = 0;
        this.jumpBuffer = 0;
        this.justJumped = true;
      }

      if (direction !== 0) {
        const accel = this.grounded ? PHYSICS.groundAccel : PHYSICS.airAccel;
        this.vx = approach(this.vx, direction * PJ.TUNING.runSpeed, accel * dt);
      } else {
        const friction = this.grounded ? PHYSICS.groundFriction : PHYSICS.airFriction;
        this.vx = approach(this.vx, 0, friction * dt);
      }

      const holdingJump = input.isDown('jump');
      const jumpCut = this.vy < 0 && !holdingJump && !this.padLaunch;
      const gravity = jumpCut ? PHYSICS.jumpCutGravity : PJ.TUNING.gravity;
      this.vy = Math.min(this.vy + gravity * dt, PHYSICS.maxFall);

      this.hitWall = PJ.moveBodyX(this, this.vx * dt, level);

      const preLandVelocity = this.vy;
      const vertical = PJ.moveBodyY(this, this.vy * dt, level);

      if (vertical.grounded) {
        if (!this.wasGrounded && preLandVelocity > 90) {
          this.landedVelocity = preLandVelocity;
        }
        this.vy = 0;
        this.grounded = true;
      } else {
        this.grounded = false;
      }

      if (vertical.ceiling) {
        // Head bump: kill upward velocity immediately so the character falls
        // straight back down instead of sliding sideways under the obstacle.
        this.vy = 0;
        this.grounded = false;
        this.hitCeiling = true;
      }

      if (this.grounded || this.vy >= 0) this.padLaunch = false;
      if (this.hitWall) this.vx = 0;

      if (this.grounded && Math.abs(this.vx) > 30) {
        this.stepDustTimer += dt;
      } else {
        this.stepDustTimer = 0;
      }

      // Smooth front/side sprite changes and delay direction flips until the
      // character has actually stopped sliding the old way. The flip happens
      // halfway through a tiny squash so the silhouette never pops.
      const targetBlend = Math.abs(this.vx) > 8 ? 1 : 0;
      this.spriteBlend += (targetBlend - this.spriteBlend) * (1 - Math.exp(-18 * dt));
      if (targetBlend === 0 && this.spriteBlend < 0.015) this.spriteBlend = 0;
      if (targetBlend === 1 && this.spriteBlend > 0.985) this.spriteBlend = 1;

      const facingMatchesMotion = Math.abs(this.vx) < 18 || Math.sign(this.vx) === this.facing;
      const desiredVisualFacing = facingMatchesMotion ? this.facing : this.visualFacing;

      if (this.turnTimer > 0) {
        this.turnTimer = Math.max(0, this.turnTimer - dt);
        if (this.turnTimer <= TURN_TIME * 0.5 && this.visualFacing !== this.turnTarget) {
          this.visualFacing = this.turnTarget;
          this.justTurned = true;
        }
        if (this.turnTimer === 0) this.turnTarget = this.visualFacing;
      } else if (desiredVisualFacing !== this.visualFacing) {
        this.turnFromFacing = this.visualFacing;
        this.turnTarget = desiredVisualFacing;
        this.turnTimer = TURN_TIME;
        this.turnWasMoving = this.spriteBlend > 0.35;
      }

      return this;
    }

    draw(ctx, time) {
      const speed = Math.abs(this.vx);
      const airborne = !this.grounded;
      const moving = speed > 8;
      const art = PJ.CharacterArt;
      const front = art ? art.front : null;
      const side = art ? art.side : null;

      if (!front || !front.complete || !front.naturalWidth || !side || !side.complete) {
        this._drawFallbackSprite(ctx);
        return;
      }

      // 66 x 78 source sprites draw at 22 x 26 stage pixels, exactly one source
      // pixel per backing pixel on the 3x canvas.
      const drawW = front.width / 3;
      const drawH = front.height / 3;
      const frame = Math.floor(this.animTime * 10) % 4;
      let bobPixels = 0;

      if (!airborne) {
        if (moving) {
          bobPixels = [0, 1, 2, 1][frame];
        } else {
          bobPixels = Math.sin(this.animTime * 2.4) > 0.55 ? 1 : 0;
        }
      }

      const centerX = this.x + this.w / 2;
      const feetY = this.y + this.h;
      const x = Math.round((centerX - drawW / 2) * 3) / 3;
      const y = Math.round((feetY - drawH) * 3) / 3 - bobPixels / 3;
      const blend = Math.max(0, Math.min(1, this.spriteBlend));
      const sideFlip = this.visualFacing > 0;

      const paint = (image, flip, alpha) => {
        if (alpha <= 0.003) return;
        ctx.globalAlpha = alpha;
        if (flip) {
          ctx.save();
          ctx.translate(x + drawW, y);
          ctx.scale(-1, 1);
          ctx.drawImage(image, 0, 0, drawW, drawH);
          ctx.restore();
        } else {
          ctx.drawImage(image, x, y, drawW, drawH);
        }
      };

      ctx.imageSmoothingEnabled = false;
      ctx.save();

      if (this.turnTimer > 0 && this.turnWasMoving) {
        // A three-frame turn: old side → front-facing transition → new side.
        // The alpha triangle keeps the sequence to a handful of crisp frames.
        const turnProgress = 1 - this.turnTimer / TURN_TIME;
        const squash = 1 - 0.2 * Math.sin(Math.PI * turnProgress);
        ctx.translate(centerX, feetY);
        ctx.scale(squash, 1);
        ctx.translate(-centerX, -feetY);

        const oldAlpha = Math.max(0, 1 - turnProgress * 2);
        const frontAlpha = Math.max(0, 1 - Math.abs(turnProgress - 0.5) * 2);
        const newAlpha = Math.max(0, turnProgress * 2 - 1);

        paint(side, this.turnFromFacing > 0, oldAlpha);
        paint(front, false, frontAlpha);
        paint(side, this.turnTarget > 0, newAlpha);
      } else {
        paint(front, false, 1 - blend);
        paint(side, sideFlip, blend);
      }

      ctx.globalAlpha = 1;
      ctx.restore();
    }

    _drawFallbackSprite(ctx) {
      // Used in headless tests or for the split second before the embedded
      // images finish decoding.
      ctx.fillStyle = '#16275a';
      ctx.fillRect(Math.round(this.x) + 1, Math.round(this.y) + 1, 8, 9);
      ctx.fillStyle = '#2f58b4';
      ctx.fillRect(Math.round(this.x) + 2, Math.round(this.y) + 2, 6, 5);
      ctx.fillStyle = '#f6f8ff';
      ctx.fillRect(Math.round(this.x) + 3, Math.round(this.y) + 10, 5, 3);
      ctx.fillStyle = '#0e1835';
      ctx.fillRect(Math.round(this.x) + 2, Math.round(this.y) + 13, 3, 1);
      ctx.fillRect(Math.round(this.x) + 6, Math.round(this.y) + 13, 3, 1);
    }
  }

  class Slime {
    constructor(spawn) {
      this.w = 12;
      this.h = 10;
      this.x = spawn.tx * TILE + 2;
      this.y = (spawn.ty + 1) * TILE - this.h;
      this.vx = 0;
      this.dir = PJ.hash2(spawn.tx, spawn.ty) > 0.5 ? 1 : -1;
      this.speed = 26;
      this.phase = PJ.hash2(spawn.tx + 3, spawn.ty) * Math.PI * 2;
      this.time = 0;
      this.dead = false;
      this.kind = 'slime';
    }

    getRect() {
      return { x: this.x + 1, y: this.y + 1, w: this.w - 2, h: this.h - 1 };
    }

    update(dt, level) {
      if (this.dead) return;
      this.time += dt;

      const lookX = this.dir > 0 ? this.x + this.w + 1 : this.x - 1;
      const wallAhead = level.isSolidAtPx(lookX, this.y + this.h - 3);
      const floorAhead = level.isSolidAtPx(lookX + this.dir * 2, this.y + this.h + 2);
      if (wallAhead || !floorAhead) this.dir *= -1;

      this.x += this.dir * this.speed * dt;
    }

    draw(ctx, time) {
      if (this.dead) return;
      const x = Math.round(this.x) - 1;
      const groundY = Math.round(this.y + this.h);
      const squash = Math.sin(this.time * 5 + this.phase);
      const bob = Math.round(squash * 0.5);
      const y = Math.round(this.y) - 1 + bob;

      // Contact shadow.
      ctx.fillStyle = 'rgba(4, 8, 16, 0.45)';
      ctx.fillRect(x + 2, groundY, 10, 1);

      const outline = '#243d33';
      const body = '#7fcf62';
      const light = '#b8ed82';
      const dark = '#4b9c50';
      const eyeWhite = '#f5ffe8';
      const pupil = '#1c2b28';

      ctx.fillStyle = outline;
      ctx.fillRect(x + 3, y, 8, 1);
      ctx.fillRect(x + 1, y + 1, 12, 1);
      ctx.fillRect(x, y + 2, 14, 6);
      ctx.fillRect(x + 1, y + 8, 12, 2);

      ctx.fillStyle = body;
      ctx.fillRect(x + 3, y + 1, 8, 1);
      ctx.fillRect(x + 2, y + 2, 10, 1);
      ctx.fillRect(x + 1, y + 3, 12, 4);
      ctx.fillRect(x + 2, y + 7, 10, 2);

      ctx.fillStyle = light;
      ctx.fillRect(x + 3, y + 2, 5, 2);
      ctx.fillRect(x + 2, y + 3, 3, 2);
      ctx.fillStyle = dark;
      ctx.fillRect(x + 1, y + 7, 12, 1);
      ctx.fillRect(x + 2, y + 8, 10, 1);

      // Eyes follow the direction of travel.
      const eyeShift = this.dir > 0 ? 1 : 0;
      ctx.fillStyle = eyeWhite;
      ctx.fillRect(x + 4 + eyeShift, y + 4, 2, 2);
      ctx.fillRect(x + 9 + eyeShift, y + 4, 2, 2);
      ctx.fillStyle = pupil;
      ctx.fillRect(x + 5 + eyeShift, y + 5, 1, 1);
      ctx.fillRect(x + 10 + eyeShift, y + 5, 1, 1);

      // Mouth.
      ctx.fillStyle = '#315b37';
      ctx.fillRect(x + 7, y + 7, 2, 1);

      // A highlight glint.
      if (Math.sin(time * 3 + this.phase) > 0.7) {
        ctx.fillStyle = '#efffd9';
        ctx.fillRect(x + 5, y + 2, 1, 1);
      }
    }
  }

  class Gem {
    constructor(spawn) {
      this.tx = spawn.tx;
      this.ty = spawn.ty;
      this.baseX = spawn.tx * TILE + 3;
      this.baseY = spawn.ty * TILE + 3;
      this.phase = spawn.phase || 0;
      this.collected = false;
      this.kind = 'gem';
    }

    getRect() {
      return { x: this.baseX + 1, y: this.baseY + 1, w: 8, h: 9 };
    }

    draw(ctx, time) {
      if (this.collected) return;
      const bob = Math.round(Math.sin(time * 2.6 + this.phase) * 1.5);
      const x = this.baseX;
      const y = this.baseY + bob;
      const pulse = (Math.sin(time * 4 + this.phase) + 1) / 2;

      // Halo is intentionally blocky, made from a few translucent rectangles.
      ctx.fillStyle = 'rgba(88, 241, 255, 0.08)';
      ctx.fillRect(x - 2, y + 1, 12, 7);
      ctx.fillStyle = 'rgba(88, 241, 255, 0.12)';
      ctx.fillRect(x, y + 2, 8, 5);

      const widths = [2, 4, 6, 8, 8, 8, 6, 4, 2];
      for (let row = 0; row < widths.length; row++) {
        const w = widths[row];
        ctx.fillStyle = '#0a3f59';
        ctx.fillRect(x + 4 - w / 2, y + row, w, 1);
      }

      const inner = [0, 2, 4, 6, 6, 6, 4, 2, 0];
      for (let row = 0; row < inner.length; row++) {
        const w = inner[row];
        if (!w) continue;
        ctx.fillStyle = row < 3 ? '#b8ffff' : '#52e0f2';
        ctx.fillRect(x + 4 - w / 2, y + row, w, 1);
      }

      ctx.fillStyle = '#eaffff';
      ctx.fillRect(x + 2, y + 2, 2, 2);
      ctx.fillStyle = '#1aa6c7';
      ctx.fillRect(x + 5, y + 5, 2, 2);

      if (pulse > 0.72) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x + 8, y - 1, 1, 2);
        ctx.fillRect(x + 7, y, 3, 1);
      }
    }
  }

  class Checkpoint {
    constructor(spawn) {
      this.tx = spawn.tx;
      this.ty = spawn.ty;
      this.x = spawn.tx * TILE;
      this.baseY = (spawn.ty + 1) * TILE;
      this.active = false;
      this.phase = PJ.hash2(spawn.tx, spawn.ty) * Math.PI;
      this.time = 0;
      this.kind = 'checkpoint';
    }

    getRect() {
      return { x: this.x - 2, y: this.baseY - 34, w: 24, h: 34 };
    }

    update(dt) {
      this.time += dt;
    }

    draw(ctx, time) {
      const x = this.x;
      const base = this.baseY;
      const poleX = x + 7;
      const top = base - 27;

      // Base stones.
      ctx.fillStyle = '#151c2f';
      ctx.fillRect(x + 3, base - 2, 12, 2);
      ctx.fillStyle = '#4b516e';
      ctx.fillRect(x + 4, base - 3, 10, 1);

      // Pole.
      ctx.fillStyle = '#0b1424';
      ctx.fillRect(poleX, top, 3, 27);
      ctx.fillStyle = this.active ? '#d4fff2' : '#6d7899';
      ctx.fillRect(poleX + 1, top + 1, 1, 25);

      // Waving pennant.
      const wave = Math.sin(time * 5 + this.phase) * 1.2;
      const flagColor = this.active ? '#57f0c4' : '#3b4461';
      const flagLight = this.active ? '#c2ffe8' : '#59627e';
      const flagDark = this.active ? '#1c9e91' : '#2a3148';
      for (let seg = 0; seg < 6; seg++) {
        const sx = poleX + 2 + seg * 2;
        const sy = top + 2 + Math.round(Math.sin(seg * 0.8 + time * 5) * 1);
        ctx.fillStyle = flagColor;
        ctx.fillRect(sx, sy, 2, 7 - Math.floor(seg / 2));
        ctx.fillStyle = seg < 2 ? flagLight : flagDark;
        ctx.fillRect(sx, sy + 5 - Math.floor(seg / 2), 2, 2);
      }
      ctx.fillStyle = flagDark;
      ctx.fillRect(poleX + 2, top + 9 + Math.round(wave), 5, 1);

      if (this.active) {
        const glow = Math.sin(time * 4 + this.phase) > 0;
        ctx.fillStyle = glow ? 'rgba(87, 240, 196, 0.5)' : 'rgba(87, 240, 196, 0.25)';
        ctx.fillRect(poleX + 2, top - 3, 2, 2);
        ctx.fillRect(x + 1, base - 18, 2, 2);
      }
    }
  }

  class Npc {
    constructor(spawn) {
      this.w = 12;
      this.h = 22;
      this.x = spawn.tx * TILE + 2;
      this.y = (spawn.ty + 1) * TILE - this.h;
      this.time = 0;
      this.kind = 'npc';
    }

    getRect() {
      return { x: this.x - 4, y: this.y - 2, w: this.w + 8, h: this.h + 2 };
    }

    update(dt) {
      this.time += dt;
    }

    draw(ctx, time) {
      const x = Math.round(this.x);
      const base = Math.round(this.y + this.h);
      const bob = Math.sin(time * 1.8) > 0.7 ? 1 : 0;
      const top = base - this.h + bob;

      // Staff and sun disk.
      const staffX = x + 13;
      ctx.fillStyle = '#31211b';
      ctx.fillRect(staffX, top + 2, 2, this.h - 2);
      ctx.fillStyle = '#8b6744';
      ctx.fillRect(staffX + 1, top + 3, 1, this.h - 4);
      ctx.fillStyle = '#ffd36a';
      ctx.fillRect(staffX - 1, top - 1, 5, 4);
      ctx.fillRect(staffX, top - 3, 3, 2);
      ctx.fillStyle = '#fff1bd';
      ctx.fillRect(staffX + 1, top - 1, 1, 1);

      // Long sand-colored robe.
      ctx.fillStyle = '#3b2923';
      ctx.fillRect(x + 1, top + 9, 10, 12);
      ctx.fillStyle = '#8b6d4f';
      ctx.fillRect(x + 2, top + 9, 8, 11);
      ctx.fillStyle = '#b08b5d';
      ctx.fillRect(x + 3, top + 10, 3, 7);
      ctx.fillStyle = '#59412f';
      ctx.fillRect(x, base - 2, 14, 2);
      ctx.fillStyle = '#2f211c';
      ctx.fillRect(x + 2, base - 1, 4, 1);
      ctx.fillRect(x + 8, base - 1, 4, 1);

      // Arms and sash.
      ctx.fillStyle = '#6f533a';
      ctx.fillRect(x + 1, top + 11, 2, 6);
      ctx.fillRect(x + 10, top + 10, 2, 7);
      ctx.fillStyle = '#d7b06e';
      ctx.fillRect(x + 2, top + 13, 8, 1);
      ctx.fillStyle = '#5c8f86';
      ctx.fillRect(x + 4, top + 15, 4, 3);

      // Hood and face.
      ctx.fillStyle = '#203d3b';
      ctx.fillRect(x + 2, top + 2, 8, 8);
      ctx.fillStyle = '#35645b';
      ctx.fillRect(x + 1, top + 3, 2, 7);
      ctx.fillRect(x + 9, top + 3, 2, 7);
      ctx.fillRect(x + 3, top + 1, 6, 2);
      ctx.fillStyle = '#d5aa7c';
      ctx.fillRect(x + 4, top + 4, 5, 5);
      ctx.fillStyle = '#f1d2a2';
      ctx.fillRect(x + 4, top + 5, 1, 2);
      ctx.fillStyle = '#203d3b';
      ctx.fillRect(x + 5, top + 6, 1, 1);
      ctx.fillRect(x + 8, top + 6, 1, 1);
      ctx.fillStyle = '#eee4c8';
      ctx.fillRect(x + 4, top + 9, 5, 2);
      ctx.fillRect(x + 5, top + 11, 4, 1);

      // A few sun-bleached trim pixels.
      ctx.fillStyle = '#e8c786';
      ctx.fillRect(x + 2, top + 9, 1, 1);
      ctx.fillRect(x + 11, top + 12, 1, 2);
    }
  }

  class MovingPlatform {
    constructor(def) {
      this.w = Math.max(1, def.w || 3) * TILE;
      this.h = 6;
      this.baseX = def.tx * TILE;
      this.baseY = def.ty * TILE;
      this.axis = def.axis === 'x' ? 'x' : 'y';
      this.range = def.range == null ? 48 : def.range;
      this.speed = def.speed == null ? 1.1 : def.speed;
      this.phase = def.phase || 0;
      this.time = 0;
      this.x = this.baseX;
      this.y = this.baseY;
      this.prevX = this.x;
      this.prevY = this.y;
      this.dx = 0;
      this.dy = 0;
      this.kind = 'platform';
      this.reset();
    }

    reset() {
      this.time = 0;
      const offset = Math.sin(this.phase) * this.range;
      this.x = this.baseX + (this.axis === 'x' ? offset : 0);
      this.y = this.baseY + (this.axis === 'y' ? offset : 0);
      this.prevX = this.x;
      this.prevY = this.y;
      this.dx = 0;
      this.dy = 0;
    }

    update(dt) {
      this.prevX = this.x;
      this.prevY = this.y;
      this.time += dt;
      const offset = Math.sin(this.time * this.speed + this.phase) * this.range;
      this.x = this.baseX + (this.axis === 'x' ? offset : 0);
      this.y = this.baseY + (this.axis === 'y' ? offset : 0);
      this.dx = this.x - this.prevX;
      this.dy = this.y - this.prevY;
    }

    getRect() {
      return { x: this.x, y: this.y, w: this.w, h: this.h };
    }

    draw(ctx) {
      const x = Math.round(this.x);
      const y = Math.round(this.y);
      const w = this.w;

      // A shallow metal runner: distinctly flatter and cleaner than the
      // square sandstone/ice blocks. No dangling chains or floating pixels.
      ctx.fillStyle = 'rgba(34, 21, 24, 0.8)';
      ctx.fillRect(x + 1, y + 3, w - 2, 4);
      ctx.fillStyle = '#3b2524';
      ctx.fillRect(x, y, w, 6);
      ctx.fillStyle = '#6c4a38';
      ctx.fillRect(x, y, w, 4);
      ctx.fillStyle = '#a97950';
      ctx.fillRect(x + 1, y, w - 2, 2);
      ctx.fillStyle = '#d6a56a';
      ctx.fillRect(x + 2, y, w - 4, 1);

      // Dark end caps and a thin turquoise guide rail separate it from blocks.
      ctx.fillStyle = '#2a191b';
      ctx.fillRect(x, y + 2, 2, 4);
      ctx.fillRect(x + w - 2, y + 2, 2, 4);
      ctx.fillStyle = '#71c9bd';
      ctx.fillRect(x + 5, y + 2, w - 10, 1);
      ctx.fillStyle = '#2f8f89';
      ctx.fillRect(x + 5, y + 3, w - 10, 1);

      ctx.fillStyle = '#2c1b1a';
      for (let bx = x + 5; bx < x + w - 3; bx += 10) {
        ctx.fillRect(bx, y + 4, 2, 1);
      }
    }
  }

  class JumpPad {
    constructor(spawn) {
      this.w = TILE;
      this.h = 6;
      this.x = spawn.tx * TILE;
      this.y = (spawn.ty + 1) * TILE - this.h;
      this.power = spawn.power || 500;
      this.pulse = 0;
      this.time = 0;
      this.kind = 'jumpPad';
    }

    update(dt) {
      this.time += dt;
      this.pulse = Math.max(0, this.pulse - dt * 3.5);
    }

    getRect() {
      return { x: this.x + 1, y: this.y, w: this.w - 2, h: this.h };
    }

    draw(ctx, time) {
      const x = Math.round(this.x);
      const y = Math.round(this.y);
      const lift = Math.round(this.pulse * 3);
      ctx.fillStyle = '#392528';
      ctx.fillRect(x, y + 2, this.w, 4);
      ctx.fillStyle = '#79523a';
      ctx.fillRect(x + 1, y + 2, this.w - 2, 2);
      ctx.fillStyle = this.pulse > 0 ? '#fff2b3' : '#ffd36a';
      ctx.fillRect(x + 3, y - 1 - lift, this.w - 6, 2);
      ctx.fillRect(x + 5, y + 1 - lift, this.w - 10, 2);
      ctx.fillStyle = 'rgba(255, 209, 102, 0.22)';
      ctx.fillRect(x - 1, y - 3 - lift, this.w + 2, 2);
      ctx.fillStyle = '#5ec6bb';
      ctx.fillRect(x + 2, y + 4, 2, 1);
      ctx.fillRect(x + this.w - 4, y + 4, 2, 1);
    }
  }

  class Goal {
    constructor(spawn) {
      this.x = spawn.x;
      this.baseY = spawn.baseY;
      this.time = 0;
      this.active = false;
      this.kind = 'goal';
    }

    getRect() {
      return { x: this.x - 6, y: this.baseY - 40, w: 36, h: 40 };
    }

    update(dt) {
      this.time += dt;
    }

    draw(ctx, time) {
      const x = this.x;
      const base = this.baseY;
      const glow = this.active
        ? 'rgba(135, 247, 255, 0.24)'
        : 'rgba(116, 235, 255, 0.075)';

      // The altar is the destination for the ice block.
      ctx.fillStyle = glow;
      ctx.fillRect(x - 4, base - 78, 34, 78);
      ctx.fillRect(x + 2, base - 42, 22, 42);

      // Broad stone base.
      ctx.fillStyle = '#31211e';
      ctx.fillRect(x - 6, base - 5, 30, 5);
      ctx.fillStyle = '#8b5f43';
      ctx.fillRect(x - 5, base - 5, 28, 2);
      ctx.fillStyle = '#5d3b31';
      ctx.fillRect(x - 3, base - 3, 24, 2);

      // Two weathered pillars and the lintel.
      ctx.fillStyle = '#2b1c1b';
      ctx.fillRect(x - 3, base - 31, 5, 27);
      ctx.fillRect(x + 17, base - 31, 5, 27);
      ctx.fillStyle = '#a27452';
      ctx.fillRect(x - 2, base - 30, 2, 24);
      ctx.fillRect(x + 18, base - 30, 2, 24);
      ctx.fillStyle = '#3a2520';
      ctx.fillRect(x - 6, base - 34, 32, 5);
      ctx.fillStyle = '#b1815c';
      ctx.fillRect(x - 5, base - 34, 30, 2);
      ctx.fillStyle = '#e2b87b';
      ctx.fillRect(x + 1, base - 35, 18, 1);

      // Sun disk carved into the lintel.
      ctx.fillStyle = '#ffd27e';
      ctx.fillRect(x + 7, base - 33, 6, 2);
      ctx.fillRect(x + 6, base - 32, 8, 1);
      ctx.fillStyle = '#8e5b35';
      ctx.fillRect(x + 8, base - 32, 4, 1);

      // Pedestal and icy basin.
      ctx.fillStyle = '#35231e';
      ctx.fillRect(x + 6, base - 11, 11, 7);
      ctx.fillStyle = '#c09365';
      ctx.fillRect(x + 7, base - 10, 9, 2);
      ctx.fillStyle = '#4b3130';
      ctx.fillRect(x + 8, base - 8, 7, 3);
      ctx.fillStyle = this.active ? '#c8ffff' : '#68d8ed';
      ctx.fillRect(x + 7, base - 13, 9, 2);
      ctx.fillRect(x + 8, base - 14, 7, 1);
      ctx.fillStyle = '#e9ffff';
      ctx.fillRect(x + 9, base - 13, 3, 1);

      // A floating shard marks the altar from a distance.
      const bob = Math.round(Math.sin(time * 2.2) * 2);
      ctx.fillStyle = this.active ? '#e8ffff' : '#8ff2ff';
      ctx.fillRect(x + 11, base - 25 + bob, 3, 2);
      ctx.fillRect(x + 10, base - 23 + bob, 5, 5);
      ctx.fillRect(x + 11, base - 18 + bob, 3, 2);
      ctx.fillStyle = '#31b6ce';
      ctx.fillRect(x + 11, base - 21 + bob, 3, 2);
      ctx.fillStyle = 'rgba(119, 238, 255, 0.07)';
      ctx.fillRect(x + 8, base - 41, 9, 18);

      // Small ritual banners.
      const wave = Math.round(Math.sin(time * 3.5) * 1);
      ctx.fillStyle = '#b7503f';
      ctx.fillRect(x - 1, base - 30, 3, 9 + wave);
      ctx.fillRect(x + 18, base - 30, 3, 9 - wave);
      ctx.fillStyle = '#f2c06e';
      ctx.fillRect(x - 1, base - 24, 3, 1);
      ctx.fillRect(x + 18, base - 24, 3, 1);

      if (this.active || Math.sin(time * 3) > 0.55) {
        ctx.fillStyle = this.active ? '#d8ffff' : '#ffd27e';
        ctx.fillRect(x + 3, base - 20, 1, 2);
        ctx.fillRect(x + 22, base - 27, 1, 1);
        ctx.fillRect(x + 12, base - 18, 1, 1);
      }
    }
  }

  class IceBlock {
    constructor(spawn) {
      this.w = 16;
      this.h = 16;
      this.spawnX = spawn.x;
      this.spawnY = spawn.y;
      this.x = spawn.x;
      this.y = spawn.y;
      this.vx = 0;
      this.vy = 0;
      this.grounded = false;
      this.integrity = 100;
      this.maxIntegrity = 100;
      this.sunlit = false;
      this.arrived = false;
      this.beingPushed = false;
      this.pushVx = 0;
      this.pushAccel = 420;
      this.friction = 220;
      this.airDrag = 30;
      this.maxSpeed = 60;
      this.carryDx = 0;
      this.carryDy = 0;
      this.tilt = 0;
      this.tiltTarget = 0;
      this.meltTime = 0;
      this.phase = PJ.hash2(spawn.tx, spawn.ty) * Math.PI * 2;
      this.kind = 'ice';
    }

    reset() {
      this.x = this.spawnX;
      this.y = this.spawnY;
      this.vx = 0;
      this.vy = 0;
      this.grounded = false;
      this.integrity = this.maxIntegrity;
      this.sunlit = false;
      this.arrived = false;
      this.beingPushed = false;
      this.pushVx = 0;
      this.carryDx = 0;
      this.carryDy = 0;
      this.tilt = 0;
      this.tiltTarget = 0;
      this.meltTime = 0;
    }

    getRect() {
      return { x: this.x + 1, y: this.y + 1, w: this.w - 2, h: this.h - 1 };
    }

    get centerX() {
      return this.x + this.w / 2;
    }

    update(dt, level) {
      if (this.arrived) return;
      this.vy = Math.min(this.vy + 1100 * dt, 430);

      // Ice is heavy: it accelerates toward a push target instead of snapping
      // to the player's speed, and keeps a little momentum when released.
      const maxSpeed = PJ.TUNING.iceMaxSpeed;
      const target = this.beingPushed
        ? clamp(this.pushVx, -maxSpeed, maxSpeed)
        : 0;
      const rate = this.beingPushed
        ? PJ.TUNING.icePushAccel
        : this.grounded ? PJ.TUNING.iceFriction : this.airDrag;
      this.vx = approach(this.vx, target, rate * dt);
      this.tilt += (this.tiltTarget - this.tilt) * (1 - Math.exp(-14 * dt));
      if (Math.abs(this.tilt - this.tiltTarget) < 0.002) this.tilt = this.tiltTarget;

      if (PJ.moveBodyX(this, this.vx * dt, level)) this.vx = 0;
      const vertical = PJ.moveBodyY(this, this.vy * dt, level);

      if (vertical.grounded) {
        this.vy = 0;
        this.grounded = true;
      } else {
        this.grounded = false;
      }
    }

    draw(ctx, time) {
      const ratio = clamp(this.integrity / this.maxIntegrity, 0, 1);
      const size = Math.max(10, Math.round(16 * (0.68 + 0.32 * ratio)));
      const ox = this.x + Math.round((16 - size) / 2);
      const oy = this.y + (16 - size);
      const sunlit = this.sunlit;
      const glint = Math.sin(time * 5 + this.phase) > 0.35;

      // Rotate the block around its bottom centre so its underside follows
      // the slope. The collision footprint stays upright for stable pushes.
      ctx.save();
      const pivotX = this.x + this.w / 2;
      const pivotY = this.y + this.h;
      ctx.translate(pivotX, pivotY);
      ctx.rotate(this.tilt);
      ctx.translate(-pivotX, -pivotY);

      // Meltwater puddle.
      if (ratio < 0.98) {
        const puddle = Math.round(5 + (1 - ratio) * 11);
        ctx.fillStyle = 'rgba(70, 179, 210, 0.32)';
        ctx.fillRect(this.x + 8 - Math.floor(puddle / 2), this.y + 15, puddle, 2);
        ctx.fillStyle = 'rgba(181, 244, 255, 0.7)';
        ctx.fillRect(this.x + 7 - Math.floor(puddle / 4), this.y + 15, Math.max(2, Math.floor(puddle / 2)), 1);
      }

      // Chunk of ice with a chiselled silhouette.
      ctx.fillStyle = '#143d56';
      ctx.fillRect(ox + 1, oy, size - 2, 1);
      ctx.fillRect(ox, oy + 1, size, size - 2);
      ctx.fillRect(ox + 1, oy + size - 1, size - 2, 1);
      ctx.fillStyle = sunlit ? '#83ecff' : '#67cfe8';
      ctx.fillRect(ox + 1, oy + 1, size - 2, size - 2);
      ctx.fillStyle = sunlit ? '#d6ffff' : '#a9f2ff';
      ctx.fillRect(ox + 2, oy + 2, Math.max(2, size - 6), 2);
      ctx.fillRect(ox + 1, oy + 3, 2, Math.max(2, size - 7));
      ctx.fillStyle = '#3ea9cd';
      ctx.fillRect(ox + size - 3, oy + 4, 2, size - 6);
      ctx.fillRect(ox + 3, oy + size - 3, size - 5, 1);
      ctx.fillStyle = '#f3ffff';
      ctx.fillRect(ox + 3, oy + 2, 2, 2);

      // Cracks appear as the block loses integrity.
      if (ratio < 0.72) {
        ctx.fillStyle = '#2a7896';
        ctx.fillRect(ox + size - 4, oy + 3, 1, Math.max(2, Math.floor(size * 0.3)));
        ctx.fillRect(ox + size - 5, oy + 5, 2, 1);
      }
      if (ratio < 0.4) {
        ctx.fillStyle = '#1f6586';
        ctx.fillRect(ox + 3, oy + 4, 1, 4);
        ctx.fillRect(ox + 4, oy + 7, 2, 1);
        ctx.fillRect(ox + 5, oy + 8, 1, 2);
      }

      if (glint) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(ox + size - 5, oy + 3, 1, 1);
        ctx.fillRect(ox + 3, oy + size - 5, 1, 1);
      }
      ctx.restore();

      // Sun / shade indicator over the ice.
      const ix = this.x + 8;
      const iy = this.y - 10;
      if (sunlit) {
        ctx.fillStyle = '#ffd36a';
        ctx.fillRect(ix - 1, iy - 2, 3, 4);
        ctx.fillRect(ix - 3, iy - 1, 1, 2);
        ctx.fillRect(ix + 3, iy - 1, 1, 2);
        ctx.fillRect(ix - 1, iy - 4, 3, 1);
        ctx.fillRect(ix - 1, iy + 3, 3, 1);
      } else {
        ctx.fillStyle = '#b8ffff';
        ctx.fillRect(ix - 2, iy - 2, 1, 1);
        ctx.fillRect(ix + 2, iy - 2, 1, 1);
        ctx.fillRect(ix - 2, iy + 2, 1, 1);
        ctx.fillRect(ix + 2, iy + 2, 1, 1);
        ctx.fillRect(ix - 1, iy - 1, 1, 1);
        ctx.fillRect(ix, iy, 1, 1);
        ctx.fillRect(ix + 1, iy + 1, 1, 1);
      }
    }
  }

  class Particle {
    constructor(x, y, options) {
      const opts = options || {};
      this.x = x;
      this.y = y;
      this.vx = opts.vx || 0;
      this.vy = opts.vy || 0;
      this.gravity = opts.gravity || 0;
      this.drag = opts.drag == null ? 0.85 : opts.drag;
      this.life = opts.life || 0.5;
      this.maxLife = this.life;
      this.color = opts.color || '#ffffff';
      this.size = opts.size || 1;
      this.glow = !!opts.glow;
    }

    update(dt) {
      this.life -= dt;
      if (this.life <= 0) return;
      this.vy += this.gravity * dt;
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      const drag = Math.pow(this.drag, dt * 60);
      this.vx *= drag;
      this.vy *= drag;
    }

    draw(ctx) {
      if (this.life <= 0) return;
      const t = clamp(this.life / this.maxLife, 0, 1);
      const alpha = Math.ceil(t * 4) / 4;
      ctx.globalAlpha = alpha;
      if (this.glow) {
        ctx.fillStyle = this.color;
        ctx.fillRect(Math.round(this.x) - 1, Math.round(this.y), this.size + 2, 1);
        ctx.fillRect(Math.round(this.x), Math.round(this.y) - 1, 1, this.size + 2);
      }
      ctx.fillStyle = this.color;
      ctx.fillRect(Math.round(this.x), Math.round(this.y), this.size, this.size);
      ctx.globalAlpha = 1;
    }
  }

  PJ.PHYSICS = PHYSICS;
  PJ.Player = Player;
  PJ.Slime = Slime;
  PJ.Gem = Gem;
  PJ.Checkpoint = Checkpoint;
  PJ.Npc = Npc;
  PJ.MovingPlatform = MovingPlatform;
  PJ.JumpPad = JumpPad;
  PJ.Goal = Goal;
  PJ.IceBlock = IceBlock;
  PJ.Particle = Particle;
})(typeof window !== 'undefined' ? window : globalThis);
