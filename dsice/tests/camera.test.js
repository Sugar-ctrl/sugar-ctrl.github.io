'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

require(path.join(__dirname, '..', 'js', 'core.js'));
require(path.join(__dirname, '..', 'js', 'levels.js'));
require(path.join(__dirname, '..', 'js', 'entities.js'));
require(path.join(__dirname, '..', 'js', 'game.js'));

const PJ = globalThis.PJ;
const { fakeContext } = require('./helpers.js');

function flatLevel() {
  const width = 60;
  const rows = [];
  for (let y = 0; y < 10; y++) rows.push('.'.repeat(width));
  const playRow = ('P' + '.'.repeat(width - 2) + 'G').split('');
  rows.push(playRow.join(''));
  rows.push('#'.repeat(width));
  return new PJ.Level({ id: 'camera-fixture', name: 'CAMERA', label: 'TEST', rows: rows });
}

test('camera keeps small, smooth steps when running and reversing', () => {
  const canvas = { width: 480, height: 270, getContext: () => fakeContext() };
  const input = {
    down: { right: true, left: false },
    isDown(action) {
      return !!input.down[action];
    },
    wasPressed() {
      return false;
    }
  };
  const game = new PJ.Game({
    canvas: canvas,
    level: flatLevel(),
    input: input,
    sfx: {
      jump() {}, land() {}, gem() {}, stomp() {}, hurt() {}, checkpoint() {}, win() {}, pause() {}, click() {}
    }
  });

  game.startRun();
  const samples = [];
  let previousCameraX = game.camera.x;

  for (let i = 0; i < 840; i++) {
    if (i === 360) {
      input.down.right = false;
      input.down.left = true;
    }
    game.update(1 / 120);
    const delta = Math.abs(game.camera.x - previousCameraX);
    previousCameraX = game.camera.x;
    if (i > 30) samples.push(delta);
  }

  const maxDelta = Math.max.apply(null, samples);
  assert.ok(maxDelta < 1.5, 'largest camera step was ' + maxDelta.toFixed(3) + 'px');
  assert.equal(game.state, 'playing');
  assert.ok(game.camera.x > 0, 'camera should have followed the player');
  const playerScreenX = game.player.centerX - game.camera.x;
  assert.ok(playerScreenX >= 0 && playerScreenX <= 480, 'player should remain on screen');
});
