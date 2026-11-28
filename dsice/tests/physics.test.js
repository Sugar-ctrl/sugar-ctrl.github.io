'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

require(path.join(__dirname, '..', 'js', 'core.js'));
require(path.join(__dirname, '..', 'js', 'levels.js'));
require(path.join(__dirname, '..', 'js', 'entities.js'));

const PJ = globalThis.PJ;

function collisionLevel() {
  return new PJ.Level({
    id: 'collision-fixture',
    name: 'COLLISION',
    label: 'TEST',
    rows: [
      '............',
      '............',
      '############',
      '............',
      '.....#......',
      '.....#......',
      '.....#......',
      '.....#......',
      'P....#.....G',
      '############'
    ]
  });
}

function flatLevel() {
  const width = 48;
  const rows = [];
  for (let y = 0; y < 10; y++) rows.push('.'.repeat(width));
  rows.push('P' + '.'.repeat(width - 2) + 'G');
  rows.push('#'.repeat(width));
  return new PJ.Level({
    id: 'turn-fixture',
    name: 'TURN',
    label: 'TEST',
    rows: rows
  });
}

function fakeInput(state) {
  return {
    isDown: (action) => !!(state.down && state.down[action]),
    wasPressed: (action) => !!(state.pressed && state.pressed[action])
  };
}

function settle(player, level) {
  const input = fakeInput({ down: {}, pressed: {} });
  for (let i = 0; i < 8; i++) player.update(1 / 120, level, input);
}

test('horizontal collision snaps against a wall', () => {
  const level = collisionLevel();
  const body = { x: 60, y: 100, w: 10, h: 14 };

  const hit = PJ.moveBodyX(body, 30, level);

  assert.equal(hit, true);
  assert.equal(body.x, 70);
});

test('leftward collision snaps against the other side of the wall', () => {
  const level = collisionLevel();
  const body = { x: 100, y: 100, w: 10, h: 14 };

  const hit = PJ.moveBodyX(body, -50, level);

  assert.equal(hit, true);
  assert.equal(body.x, 96);
});

test('fast horizontal movement cannot tunnel through a tile', () => {
  const level = collisionLevel();
  const body = { x: 20, y: 100, w: 10, h: 14 };

  PJ.moveBodyX(body, 100, level);

  assert.equal(body.x, 70);
});

test('vertical collision lands on the floor and bumps the ceiling', () => {
  const level = collisionLevel();

  const falling = { x: 16, y: 80, w: 10, h: 14 };
  const landed = PJ.moveBodyY(falling, 100, level);
  assert.equal(landed.grounded, true);
  assert.equal(falling.y, 130);

  const rising = { x: 16, y: 70, w: 10, h: 14 };
  const bumped = PJ.moveBodyY(rising, -50, level);
  assert.equal(bumped.ceiling, true);
  assert.equal(rising.y, 48);
});

test('a rising player stops at a solid ceiling instead of sliding sideways', () => {
  const level = collisionLevel();
  const player = new PJ.Player(level.spawnPoint());
  player.x = 16;
  player.y = 50;
  player.vy = -300;
  player.grounded = false;
  const input = fakeInput({ down: {}, pressed: {} });

  player.update(1 / 120, level, input);

  assert.equal(player.y, 48);
  assert.equal(player.hitCeiling, true);
  assert.equal(player.vy, 0);
  assert.equal(player.grounded, false);
});

test('player reaches a sensible jump height at 120 Hz', () => {
  const level = collisionLevel();
  const player = new PJ.Player(level.spawnPoint());
  settle(player, level);

  const state = { down: { jump: true }, pressed: { jump: true } };
  const input = fakeInput(state);
  let minY = player.y;
  let jumped = false;

  for (let i = 0; i < 140; i++) {
    player.update(1 / 120, level, input);
    state.pressed.jump = false;
    if (player.justJumped) jumped = true;
    minY = Math.min(minY, player.y);
  }

  const height = 130 - minY;
  assert.equal(jumped, true);
  assert.ok(height > 42 && height < 65, 'jump height was ' + height);
  assert.equal(player.grounded, true, 'player should land again');
});

test('releasing jump early produces a shorter jump', () => {
  const level = collisionLevel();

  function runJump(holdJump) {
    const player = new PJ.Player(level.spawnPoint());
    settle(player, level);
    const state = { down: { jump: holdJump }, pressed: { jump: true } };
    const input = fakeInput(state);
    let minY = player.y;
    for (let i = 0; i < 120; i++) {
      player.update(1 / 120, level, input);
      state.pressed.jump = false;
      minY = Math.min(minY, player.y);
    }
    return 130 - minY;
  }

  const full = runJump(true);
  const tap = runJump(false);
  assert.ok(full - tap > 12, 'full=' + full + ' tap=' + tap);
});

test('running player stops at the test wall', () => {
  const level = collisionLevel();
  const player = new PJ.Player(level.spawnPoint());
  settle(player, level);

  const state = { down: { right: true }, pressed: {} };
  const input = fakeInput(state);
  for (let i = 0; i < 360; i++) player.update(1 / 120, level, input);

  assert.ok(player.x <= 70.01, 'should not enter the wall');
  assert.ok(player.x > 60, 'should reach the wall');
});

test('turning waits for the skid and then flips with a short squash', () => {
  const level = flatLevel();
  const player = new PJ.Player(level.spawnPoint());
  settle(player, level);

  const state = { down: { right: true }, pressed: {} };
  const input = fakeInput(state);
  for (let i = 0; i < 70; i++) player.update(1 / 120, level, input);

  assert.equal(player.facing, 1);
  assert.equal(player.visualFacing, 1);
  assert.ok(player.spriteBlend > 0.9, 'side sprite should be active while running');

  state.down.right = false;
  state.down.left = true;
  for (let i = 0; i < 5; i++) player.update(1 / 120, level, input);

  assert.equal(player.facing, -1);
  assert.equal(player.visualFacing, 1, 'visual facing should stay through the skid');
  assert.ok(player.vx > 18, 'player should still be sliding right');

  let flipped = false;
  for (let i = 0; i < 80; i++) {
    player.update(1 / 120, level, input);
    if (player.justTurned) flipped = true;
  }

  assert.equal(player.visualFacing, -1);
  assert.equal(flipped, true, 'turn event should fire once');
  assert.ok(player.spriteBlend > 0.9);

  state.down.left = false;
  for (let i = 0; i < 80; i++) player.update(1 / 120, level, input);
  assert.ok(player.spriteBlend < 0.2, 'idle should ease back to the front sprite');
});

test('jump-pad launches keep full height without holding jump', () => {
  const level = flatLevel();
  const player = new PJ.Player(level.spawn);
  player.vy = -330;
  player.padLaunch = true;
  player.grounded = false;
  const input = fakeInput({ down: {}, pressed: {} });
  const startY = player.y;
  let minY = startY;

  for (let i = 0; i < 80; i++) {
    player.update(1 / 120, level, input);
    minY = Math.min(minY, player.y);
  }

  assert.ok(startY - minY > 40, 'pad boost must not use jump-cut gravity');
});

test('ice block settles on the floor and slides when pushed', () => {
  const level = new PJ.Level(PJ.LEVELS[0]);
  const ice = new PJ.IceBlock(level.iceSpawn);

  for (let i = 0; i < 30; i++) ice.update(1 / 120, level);
  assert.equal(ice.grounded, true);
  assert.ok(Math.abs(ice.y + ice.h - 240) < 0.5, 'ice should rest on the sand');

  const startX = ice.x;
  ice.beingPushed = true;
  ice.pushVx = 62;
  for (let i = 0; i < 40; i++) ice.update(1 / 120, level);
  assert.ok(ice.vx > 30, 'heavy ice should build momentum while pushed');

  assert.ok(ice.x > startX + 12, 'pushed ice should move forward');
  assert.ok(ice.x < level.goal.x, 'ice should remain in the play field');

  const releasedVx = ice.vx;
  const releasedX = ice.x;
  ice.beingPushed = false;
  ice.pushVx = 0;
  ice.update(1 / 120, level);
  assert.ok(ice.vx > 0 && ice.vx < releasedVx, 'released ice should keep sliding and lose speed');
  for (let i = 0; i < 120; i++) ice.update(1 / 120, level);
  assert.ok(ice.x > releasedX + 2, 'friction should bleed off the remaining slide');
});
