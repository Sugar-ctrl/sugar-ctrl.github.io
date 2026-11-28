'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

require(path.join(__dirname, '..', 'js', 'core.js'));
require(path.join(__dirname, '..', 'js', 'character-art.js'));
require(path.join(__dirname, '..', 'js', 'levels.js'));
require(path.join(__dirname, '..', 'js', 'entities.js'));
require(path.join(__dirname, '..', 'js', 'game.js'));

const PJ = globalThis.PJ;
const { fakeCanvas, fakeSfx } = require('./helpers.js');

function fakeGame() {
  const input = {
    isDown() {
      return false;
    },
    wasPressed() {
      return false;
    }
  };
  const game = new PJ.Game({
    canvas: fakeCanvas(),
    level: PJ.LEVELS[0],
    input: input,
    sfx: fakeSfx()
  });
  // Simulation tests opt out of auto tutorials; the dialogue test resets this.
  const startRun = game.startRun.bind(game);
  game.startRun = () => {
    startRun();
    game.npcs.forEach((npc) => {
      npc.talked = true;
    });
    game.iceIntroduced = true;
  };
  return game;
}

test('game simulates and renders a full frame path without a browser', () => {
  const canvas = fakeCanvas();

  const state = {
    down: { right: true },
    pressed: new Set(),
    isDown(action) {
      return !!state.down[action];
    },
    wasPressed(action) {
      return state.pressed.has(action);
    }
  };

  const transitions = [];
  const game = new PJ.Game({
    canvas: canvas,
    level: PJ.LEVELS[0],
    input: state,
    sfx: fakeSfx(),
    onStateChange: (next) => transitions.push(next)
  });

  game.render();
  game.startRun();
  game.npcs.forEach((npc) => {
    npc.talked = true;
  });
  game.iceIntroduced = true;
  assert.equal(game.state, 'playing');

  for (let i = 0; i < 600; i++) {
    if (i % 90 === 0) state.pressed.add('jump');
    game.update(1 / 120);
    state.pressed.clear();
    if (i % 40 === 0) game.render();
  }

  game.render();
  game.toggleDebug();
  game.render();
  game.pause();
  assert.equal(game.state, 'paused');
  game.render();
  game.resume();
  assert.equal(game.state, 'playing');
  game.toTitle();
  assert.equal(game.state, 'title');
  game.render();

  assert.ok(transitions.includes('playing'));
  assert.ok(transitions.includes('paused'));
  assert.ok(transitions.includes('title'));
  assert.ok(game.player.x >= 0);
  assert.ok(game.camera.x >= 0);
});

test('time of day changes ice exposure and melting', () => {
  const game = fakeGame();
  game.startRun();
  const ice = game.ice;
  assert.ok(ice, 'desert run has an ice block');

  game.setTime(1);
  game._updateTime(0, true);
  assert.equal(game.getTimeLabel(), 'NOON');
  assert.equal(game._isSunlitAt(ice.x + 8, ice.y + 1), false, 'starting arch shades the ice at noon');
  assert.equal(game._isSunlitAt(116 * 16 + 8, 12 * 16 - 1), false,
    'new high canopy shades the jump-pad platform at noon');

  game.cycleTime();
  game._updateTime(0, true);
  assert.equal(game.getTimeLabel(), 'DUSK');
  // Move the ice to the open story stretch so the low sun can find it.
  ice.x = 80 * 16;
  assert.equal(game._isSunlitAt(ice.x + 8, ice.y + 1), true, 'low dusk sun finds open ice');

  ice.integrity = 100;
  for (let i = 0; i < 60; i++) game._updateIceSun(1 / 120);
  assert.ok(ice.integrity < 100, 'ice melts in direct sun');

  game.setTime(1);
  game._updateTime(0, true);
  ice.x = 96 * 16;
  ice.integrity = 100;
  for (let i = 0; i < 60; i++) game._updateIceSun(1 / 120);
  assert.equal(ice.integrity, 100, 'shade stops the melt');
});

test('player and ice collisions preserve pushing and carry riders', () => {
  const game = fakeGame();
  game.startRun();
  game.closeDialogue();
  const player = game.player;
  const ice = game.ice;

  player.x = ice.x - player.w + 2;
  player.y = ice.y;
  player.vx = 60;
  ice.vx = 10;
  game._resolvePlayerIce(1 / 120, 1);
  assert.equal(player.x, ice.x - player.w, 'side contact should resolve to the ice face');
  assert.equal(player.vx, 60, 'active pushing should keep contact pressure');

  player.x = ice.x + 2;
  player.y = ice.y - player.h + 2;
  player.vx = 0;
  player.vy = 0;
  ice.vx = 60;
  const before = player.x;
  game._resolvePlayerIce(1 / 120, 0);
  assert.equal(player.grounded, true);
  assert.ok(player.x > before, 'a rider should move with a sliding block');
});

test('a player standing on the ice block rides smoothly without jitter', () => {
  const game = fakeGame();
  game.startRun();
  game.closeDialogue();
  const player = game.player;
  const ice = game.ice;

  for (let i = 0; i < 40; i++) game.update(1 / 120);
  player.x = ice.x + 3;
  player.y = ice.y - player.h;
  player.vx = 0;
  player.vy = 0;
  player.grounded = true;

  let minY = Infinity;
  let maxY = -Infinity;
  let minRel = Infinity;
  let maxRel = -Infinity;
  for (let i = 0; i < 90; i++) {
    game.update(1 / 120);
    minY = Math.min(minY, player.y);
    maxY = Math.max(maxY, player.y);
    const rel = player.x - ice.x;
    minRel = Math.min(minRel, rel);
    maxRel = Math.max(maxRel, rel);
  }

  assert.ok(maxY - minY < 0.05, 'standing player should not bob vertically: ' + (maxY - minY));
  assert.ok(maxRel - minRel < 0.2, 'standing player should keep a stable ice offset: ' + (maxRel - minRel));
});

test('tutorial dialogue keeps play moving and ends when the player leaves', () => {
  const game = fakeGame();
  game.startRun();
  game.npcs.forEach((npc) => {
    npc.talked = false;
  });
  assert.equal(game.isNpcNear(), true, 'spawn should be close to the first guide');
  assert.equal(game.startDialogue(), true);
  assert.equal(game.dialogueActive, true);
  assert.equal(game.getDialoguePage().total, 4);
  assert.match(game.getDialoguePage().name, /TIDE GUIDE/);
  assert.equal(game.getDialoguePage().role, 'WALKTHROUGH KEEPER');

  const x = game.player.x;
  game.player.vx = 60;
  game.update(1 / 60);
  assert.ok(game.player.x > x, 'player physics should keep running during dialogue');
  assert.ok(game.runTime > 0, 'dialogue should not stop the run timer');

  for (let i = 0; i < 3; i++) game.advanceDialogue();
  assert.equal(game.dialogueActive, true, 'last page should still be visible');
  assert.equal(game.getDialoguePage().last, true);
  game.advanceDialogue();
  assert.equal(game.dialogueActive, false, 'advancing past the last page closes dialogue');
  assert.equal(game.tryTalkNpc(), true, 'the guide can be talked to again');
  game.closeDialogue();

  game.npcs[0].talked = false;
  assert.equal(game._checkTutorialDialogue(), true, 'proximity starts the guide automatically');
  game.player.x += 200;
  game.update(1 / 60);
  assert.equal(game.dialogueActive, false, 'walking too far should close the dialogue');
});

test('partial and overlapping shade cannot report the ice as sunlit', () => {
  const game = fakeGame();
  game.startRun();
  game.setTimeValue(0.4);
  game._updateTime(0, true);

  const ice = game.ice;
  ice.x = 17 * 16;
  ice.y = 224;
  ice.integrity = 100;

  // Make only a narrow center column sunlit. The old single-ray check would
  // call this block sunny even though almost all of its surface is shaded.
  const sunlitAt = game._isSunlitAt;
  game._isSunlitAt = (x) => Math.abs(x - (ice.x + ice.w / 2)) < 0.75;
  const centerSun = game._isSunlitAt(ice.x + 8, ice.y + 1);
  const exposure = game._sunExposureAt(ice.x + 8, ice.y + 1, 12, 9);
  game._updateIceSun(1 / 60);
  game._isSunlitAt = sunlitAt;

  assert.equal(centerSun, true, 'the center ray alone sees the sun');
  assert.ok(exposure <= 0.6, 'most of the block is shaded');
  assert.equal(ice.sunlit, false, 'the block should be treated as shaded');
  assert.equal(ice.integrity, 100, 'no melt while shaded');
});

test('low sun shades a wall base while open tops stay sunlit', () => {
  const game = fakeGame();
  game.startRun();
  game.setTimeValue(2);
  game._updateTime(0, true);

  // The first low jump block shadows the ground directly behind it.
  assert.equal(game._isSunlitAt(12 * 16 + 2, 15 * 16 - 1), false,
    'shaded ground should be blocked by the tutorial block');
  // The altar platform is open to the sky; rays leaving the level must not be
  // treated as a solid boundary wall.
  assert.equal(game._isSunlitAt(146 * 16 + 2, 7 * 16 - 1), true,
    'open high-altar top should stay sunlit');
});

test('the day clock can be dragged to a fine time between presets', () => {
  const game = fakeGame();
  game.startRun();

  game.setTimeValue(0.5);
  assert.equal(game.getClockText(), '09:00');
  assert.equal(game.getTimeLabel(), 'MORNING');
  assert.ok(game.timeValue > 0 && game.timeValue < 1);

  game.setTimeValue(1.5);
  assert.equal(game.getClockText(), '15:00');
  assert.equal(game.getTimeLabel(), 'AFTERNOON');

  game.setTimeValue(2.4);
  assert.equal(game.timeValue, 2.4);
  assert.equal(game.getClockText(), '20:24');

  game.setTimeValue(4.8);
  assert.equal(game.timeValue, 0, 'the 24h dial wraps dawn back to the start');
  assert.equal(game.getClockText(), '06:00');
});

test('night builds chill and direct daylight warms the player', () => {
  const game = fakeGame();
  game.startRun();

  game.setTimeValue(3);
  game._updateTime(0, true);
  assert.equal(game.isNight, true);
  assert.equal(game.getTimeLabel(), 'NIGHT');
  assert.equal(game.getClockText(), '00:00');

  game.ice.integrity = 100;
  game._updateIceSun(1 / 60);
  assert.equal(game.ice.sunlit, false, 'night has no direct sunlight');
  assert.equal(game.ice.integrity, 100, 'ice stops melting at night');

  game.chill = 0;
  for (let i = 0; i < 120; i++) game._updateChill(1 / 120);
  assert.ok(game.chill > 8, 'night should build chill quickly');

  game.setTimeValue(1);
  game._updateTime(0, true);
  game.player.x = 20 * 16 + 3;
  game.player.y = 226;
  game.player.grounded = true;
  game.chill = 60;
  for (let i = 0; i < 120; i++) game._updateChill(1 / 120);
  assert.ok(game.chill < 60, 'standing in direct daylight should warm the player');

  game.setTimeValue(3);
  game._updateTime(0, true);
  game.cycleTime();
  assert.equal(game.timeTarget, 4, 'night should roll forward into the next dawn');
  game.timeValue = 3.999;
  game._updateTime(1 / 120);
  assert.equal(game.timeValue, 0);
  assert.equal(game.getClockText(), '06:00');

  game.setTimeValue(3);
  game._updateTime(0, true);
  game.chill = 99.8;
  for (let i = 0; i < 4; i++) game._updateChill(1 / 60);
  assert.equal(game.state, 'failed');
  assert.equal(game.failReason, 'cold');
  assert.equal(game.chill, 100);
});
