'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

require(path.join(__dirname, '..', 'js', 'core.js'));
require(path.join(__dirname, '..', 'js', 'levels.js'));
require(path.join(__dirname, '..', 'js', 'entities.js'));

const PJ = globalThis.PJ;

test('the tutorial level carries every mechanism fixture', () => {
  const level = new PJ.Level(PJ.LEVELS[0]);

  assert.equal(level.id, 'sands-tutorial');
  assert.equal(level.cols, 150);
  assert.equal(level.heightTiles, 17);
  assert.equal(level.platformSpawns.length, 5, 'tutorial and final platforms');
  assert.equal(level.jumpPadSpawns.length, 2, 'tutorial and final jump pads');
  assert.equal(level.slopes.length, 3, 'tutorial, ice and high-altar slopes');
  assert.ok(level.spawn && level.iceSpawn && level.goal);
  assert.equal(level.tileAt(level.iceSpawn.tx, level.iceSpawn.ty + 1), PJ.TILE_SOLID);
  assert.equal(level.tileAt(level.goal.tx, level.goal.ty + 1), PJ.TILE_SOLID);
});

test('moving platforms oscillate within their configured range', () => {
  const platform = new PJ.MovingPlatform({
    tx: 16, ty: 11, w: 3, axis: 'y', range: 48, speed: 1.1, phase: 0
  });
  const startY = platform.y;
  let minY = startY;
  let maxY = startY;
  for (let i = 0; i < 240; i++) {
    platform.update(1 / 60);
    minY = Math.min(minY, platform.y);
    maxY = Math.max(maxY, platform.y);
  }
  assert.ok(maxY - minY > 40, 'platform should travel through most of its range');
  assert.ok(minY >= platform.baseY - platform.range - 0.1);
  assert.ok(maxY <= platform.baseY + platform.range + 0.1);

  const horizontal = new PJ.MovingPlatform({
    tx: 8, ty: 12, w: 4, axis: 'x', range: 48, speed: 0.9, phase: 0
  });
  const startX2 = horizontal.x;
  const startY2 = horizontal.y;
  for (let i = 0; i < 30; i++) horizontal.update(1 / 60);
  assert.ok(horizontal.x !== startX2, 'horizontal platform should move on x');
  assert.equal(horizontal.y, startY2, 'horizontal platform should keep its y');
});

test('ice tilts smoothly toward a slope angle and can return upright', () => {
  const level = new PJ.Level(PJ.LEVELS[0]);
  const ice = new PJ.IceBlock(level.iceSpawn);
  ice.tiltTarget = -0.46;
  for (let i = 0; i < 60; i++) ice.update(1 / 120, level);
  assert.ok(ice.tilt < -0.35, 'ice should rotate toward the slope: ' + ice.tilt);

  ice.tiltTarget = 0;
  for (let i = 0; i < 60; i++) ice.update(1 / 120, level);
  assert.ok(Math.abs(ice.tilt) < 0.02, 'ice should settle upright off the slope');
});

test('a rising player resolves an ice head bump vertically', () => {
  const game = Object.create(PJ.Game.prototype);
  game.ice = new PJ.IceBlock({ x: 400, y: 176, tx: 25, ty: 11 });
  game.player = new PJ.Player({ x: 400, y: 189 });
  game.player.vy = -320;

  const hit = game._resolveIceHeadBump();

  assert.equal(hit, true);
  assert.equal(game.player.x, 400, 'head bump must not squeeze the player sideways');
  assert.equal(game.player.y, 192, 'player is placed under the ice');
  assert.equal(game.player.vy, 0);
  assert.equal(game.player.hitCeiling, true);
});

test('a jump while pushing beside the ice is not treated as a head bump', () => {
  const game = Object.create(PJ.Game.prototype);
  game.ice = new PJ.IceBlock({ x: 400, y: 176, tx: 25, ty: 11 });
  game.player = new PJ.Player({ x: 390, y: 189 });
  game.player.vy = -320;
  game.player.vx = 60;

  const hit = game._resolveIceHeadBump();

  assert.equal(hit, false);
  assert.equal(game.player.vy, -320);
  assert.equal(game.player.vx, 60);
});

test('pressing down drops through a one-way platform', () => {
  const game = Object.create(PJ.Game.prototype);
  game.player = new PJ.Player({ x: 100, y: 100 });
  game.playerPlatform = { x: 80, y: 114 };
  game.input = { isDown: (action) => action === 'down' };
  game._dust = () => {};
  const y = game.player.y;

  const dropped = game._tryDropThroughPlatform();

  assert.equal(dropped, true);
  assert.equal(game.playerPlatform, null);
  assert.equal(game.player.y, y + 4);
  assert.ok(game.player.dropTimer > 0);
  assert.equal(game.player.grounded, false);
});

test('jump pads expose a usable upward impulse', () => {
  const pad = new PJ.JumpPad({ tx: 26, ty: 14, power: 500 });
  assert.equal(pad.power, 500);
  assert.equal(pad.getRect().w, 14);
  pad.pulse = 1;
  pad.update(1 / 60);
  assert.ok(pad.pulse < 1 && pad.pulse > 0, 'pulse animates');
});
