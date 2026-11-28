'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

require(path.join(__dirname, '..', 'js', 'core.js'));
require(path.join(__dirname, '..', 'js', 'audio.js'));
require(path.join(__dirname, '..', 'js', 'levels.js'));
require(path.join(__dirname, '..', 'js', 'entities.js'));

const PJ = globalThis.PJ;

test('custom bindings remap input actions and can be reset', () => {
  const input = new PJ.Input();
  input.setBindings({
    left: ['KeyQ'],
    right: ['KeyE'],
    jump: ['KeyF'],
    pause: ['KeyP'],
    restart: ['KeyG'],
    time: ['KeyY'],
    talk: ['KeyH']
  });

  assert.equal(input.matches('left', 'KeyQ'), true);
  assert.equal(input.matches('left', 'ArrowLeft'), false);
  assert.equal(input.matches('talk', 'KeyH'), true);

  input._onKeyDown({ code: 'KeyQ', repeat: false, preventDefault() {} });
  assert.equal(input.isDown('left'), true);
  input._onKeyUp({ code: 'KeyQ', preventDefault() {} });
  assert.equal(input.isDown('left'), false);

  input.setBindings(PJ.DEFAULT_BINDINGS);
  assert.equal(input.matches('left', 'ArrowLeft'), true);
  assert.equal(input.matches('right', 'KeyD'), true);
  assert.equal(input.matches('talk', 'KeyE'), true);
  assert.equal(PJ.DEFAULT_TUNING.iceFriction, 88, 'default ice friction should be 40% of 220');
});

test('music and sfx volumes are independent and clamp safely', () => {
  const sfx = new PJ.Sfx();
  sfx.setVolume(0.8);
  sfx.setMusicVolume(0.25);

  assert.equal(sfx.globalGain, 3);
  assert.ok(Math.abs(sfx._targetGain() - 0.576) < 1e-9, 'sfx bus gets the 3x ceiling');
  assert.ok(Math.abs(sfx._musicTargetGain() - 0.75) < 1e-9, 'music bus gets the 3x ceiling');
  assert.equal(sfx.getVolume(), 0.8);
  assert.equal(sfx.getMusicVolume(), 0.25);
  assert.equal(sfx.setMusicVolume(1.5), 1);
  assert.equal(sfx.setMusicVolume(-0.4), 0);
  assert.equal(sfx.setVolume(2), 1);

  sfx.setMusicVolume(0.4);
  sfx.setMuted(true);
  assert.equal(sfx.muted, true);
  sfx.setMuted(false);
  assert.equal(sfx.muted, false);
  assert.equal(sfx.getMusicVolume(), 0.4);
});

test('developer tuning changes player speed and ice acceleration live', () => {
  const saved = Object.assign({}, PJ.TUNING);
  try {
    const level = new PJ.Level(PJ.LEVELS[0]);
    const inputRight = {
      isDown: (action) => action === 'right',
      wasPressed: () => false
    };

    const run = (speed) => {
      PJ.TUNING.runSpeed = speed;
      const player = new PJ.Player(level.spawn);
      for (let i = 0; i < 24; i++) player.update(1 / 120, level, inputRight);
      return player.vx;
    };

    const slow = run(100);
    const fast = run(200);
    assert.ok(fast > slow + 50, 'higher run speed should produce a faster run');

    const ice = new PJ.IceBlock(level.iceSpawn);
    for (let i = 0; i < 30; i++) ice.update(1 / 120, level);
    ice.beingPushed = true;
    ice.pushVx = 60;

    PJ.TUNING.icePushAccel = 180;
    ice.vx = 0;
    ice.update(1 / 120, level);
    const gentle = ice.vx;

    PJ.TUNING.icePushAccel = 900;
    ice.vx = 0;
    ice.update(1 / 120, level);
    const strong = ice.vx;

    assert.ok(strong > gentle * 2, 'higher push acceleration should move the ice faster');
  } finally {
    Object.assign(PJ.TUNING, saved);
  }
});
