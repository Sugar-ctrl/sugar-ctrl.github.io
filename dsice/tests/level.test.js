'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

require(path.join(__dirname, '..', 'js', 'core.js'));
require(path.join(__dirname, '..', 'js', 'levels.js'));

const PJ = globalThis.PJ;

test('the single tutorial level parses all story props', () => {
  const level = new PJ.Level(PJ.LEVELS[0]);

  assert.equal(level.cols, 150);
  assert.equal(level.heightTiles, 17);
  assert.equal(level.pixelW, 2400);
  assert.equal(level.pixelH, 272);
  assert.equal(level.theme, 'desert');
  assert.equal(level.label, 'TUTORIAL 01');
  assert.ok(level.spawn, 'spawn exists');
  assert.ok(level.goal, 'goal exists');
  assert.ok(level.iceSpawn, 'ice block exists');
  assert.equal(level.npcSpawns.length, 4, 'four tutorial guides');
  assert.equal(level.dialogues.length, 4, 'one dialogue per guide');
  assert.equal(level.gems.length, 0, 'tutorial has no side collectibles');
  assert.equal(level.checkpointSpawns.length, 4, 'mechanism + mid-route checkpoints');
});

test('the tutorial map uses only supported symbols and stays rectangular', () => {
  const level = new PJ.Level(PJ.LEVELS[0]);
  const supported = new Set(['.', '#', '^', 'o', 'S', 'C', 'I', 'N', 'P', 'G']);

  for (let y = 0; y < level.rows.length; y++) {
    assert.equal(level.rows[y].length, level.cols, 'row ' + y + ' width');
    for (let x = 0; x < level.rows[y].length; x++) {
      assert.ok(supported.has(level.rows[y][x]), 'unsupported symbol at ' + x + ',' + y);
    }
  }
});

test('spawn, ice, guides and goal have solid footing', () => {
  const level = new PJ.Level(PJ.LEVELS[0]);

  assert.equal(level.tileAt(level.spawn.tx, level.spawn.ty + 1), PJ.TILE_SOLID);
  assert.equal(level.tileAt(level.iceSpawn.tx, level.iceSpawn.ty + 1), PJ.TILE_SOLID);
  level.npcSpawns.forEach((npc) => {
    assert.equal(level.tileAt(npc.tx, npc.ty + 1), PJ.TILE_SOLID, 'guide footing');
  });
  level.checkpointSpawns.forEach((cp) => {
    assert.equal(level.tileAt(cp.tx, cp.ty + 1), PJ.TILE_SOLID, 'checkpoint footing');
  });
  assert.equal(level.tileAt(level.goal.tx, level.goal.ty + 1), PJ.TILE_SOLID);
});

test('the first half is split into controls, mechanisms and story guides', () => {
  const level = new PJ.Level(PJ.LEVELS[0]);
  const xs = level.npcSpawns.map((npc) => npc.tx);

  assert.deepEqual(xs, [5, 30, 72, 90]);
  assert.ok(xs[0] < level.iceSpawn.tx, 'controls guide is before the ice');
  assert.ok(xs[1] < level.iceSpawn.tx, 'mechanism guide is before the ice');
  assert.ok(xs[2] < level.iceSpawn.tx, 'story guide is before the ice');
  assert.equal(xs[3], 90, 'sunwarden guards the second-half threshold');
  assert.ok(level.iceSpawn.tx < level.goal.tx, 'ice starts before the altar');

  level.dialogues.forEach((dialogue) => {
    assert.equal(dialogue.auto, true, 'every tutorial beat starts in the world');
    assert.ok(dialogue.name && dialogue.name.length, 'guide has a name');
    assert.ok(dialogue.lines.length >= 3, 'guide has a real tutorial script');
  });

  // The controls pebble must be solid at foot level, not a ceiling to crawl under.
  assert.equal(level.tileAt(12, 14), PJ.TILE_SOLID);
  assert.equal(level.tileAt(12, 13), PJ.TILE_EMPTY);
});

test('mechanism lessons are physically required to advance', () => {
  const level = new PJ.Level(PJ.LEVELS[0]);

  // Horizontal ferry crosses a spike pit with no walkable floor.
  assert.equal(level.platformSpawns[0].axis, 'x');
  assert.equal(level.platformSpawns[0].tx, 34);
  assert.equal(level.platformSpawns[0].range, 80);
  for (let x = 34; x <= 42; x++) {
    assert.equal(level.tileAt(x, 15), PJ.TILE_SPIKE, 'spike gap at ' + x);
    assert.notEqual(level.tileAt(x, 15), PJ.TILE_SOLID);
  }

  // The wall is too tall to jump; the vertical lift tops out at its height.
  assert.equal(level.platformSpawns[1].axis, 'y');
  assert.equal(level.tileAt(47, 9), PJ.TILE_SOLID);
  assert.equal(level.tileAt(47, 14), PJ.TILE_SOLID);
  assert.equal(level.platformSpawns[1].ty * 16 - level.platformSpawns[1].range, 9 * 16);

  // The jump pad launches onto the long one-way bridge over the second pit.
  assert.equal(level.jumpPadSpawns[0].tx, 53);
  assert.equal(level.platformSpawns[2].tx, 53);
  assert.equal(level.platformSpawns[2].w, 10);
  for (let x = 54; x <= 62; x++) {
    assert.equal(level.tileAt(x, 15), PJ.TILE_SPIKE, 'second spike gap at ' + x);
  }

  // Slope lesson still leads onto its shelf before the story guide.
  assert.equal(level.slopes[0].tx, 63);
  assert.equal(level.tileAt(69, 13), PJ.TILE_SOLID);
});

test('the second half connects two slopes, jump pad, ferry and high altar', () => {
  const level = new PJ.Level(PJ.LEVELS[0]);

  assert.equal(level.platformSpawns.length, 5);
  assert.equal(level.jumpPadSpawns.length, 2);
  assert.equal(level.slopes.length, 3);

  const slope = level.slopes[1];
  assert.equal(slope.tx, 102);
  assert.equal(slope.ty, 14);
  assert.equal(slope.w, 8);
  assert.equal(slope.h, 3);
  assert.equal(level.tileAt(110, 12), PJ.TILE_SOLID, 'slope reaches the raised ice platform');
  assert.equal(level.tileAt(118, 12), PJ.TILE_SOLID);

  const landing = level.platformSpawns[3];
  assert.equal(landing.tx, 114);
  assert.equal(landing.ty, 9);
  assert.equal(landing.w, 8);
  assert.equal(landing.range, 0, 'landing platform is stationary');

  const ferry = level.platformSpawns[4];
  assert.equal(ferry.axis, 'x');
  assert.equal(ferry.tx, 122);
  assert.equal(ferry.w, 4);
  assert.equal(ferry.range, 64);
  assert.equal(ferry.tx * 16 + ferry.range + ferry.w * 16, 130 * 16,
    'ferry reaches the mid platform at full extension');
  assert.equal(level.tileAt(130, 9), PJ.TILE_SOLID, 'mid platform above the gap');

  const highSlope = level.slopes[2];
  assert.equal(highSlope.tx, 138);
  assert.equal(highSlope.ty, 8);
  assert.equal(highSlope.w, 8);
  assert.equal(highSlope.h, 2);
  assert.equal(level.tileAt(146, 7), PJ.TILE_SOLID, 'second slope reaches the high altar platform');
  assert.equal(level.tileAt(148, 7), PJ.TILE_SOLID);
  assert.equal(level.tileAt(132, 5), PJ.TILE_SOLID, 'high shade canopy over the mid route');
  assert.equal(level.tileAt(143, 5), PJ.TILE_SOLID);

  const finalPad = level.jumpPadSpawns[1];
  assert.equal(finalPad.tx, 116);
  assert.equal(level.tileAt(116, 12), PJ.TILE_SOLID, 'final pad stands on the raised platform');
  assert.equal(level.tileAt(109, 3), PJ.TILE_SOLID, 'shade roof starts above the pad platform');
  assert.equal(level.tileAt(115, 3), PJ.TILE_SOLID, 'shade roof covers the jump pad');
  assert.equal(level.tileAt(121, 3), PJ.TILE_SOLID, 'shade roof covers the landing bridge');
  assert.equal(level.tileAt(level.goal.tx, level.goal.ty + 1), PJ.TILE_SOLID);
  assert.equal(level.goal.tx, 148);
  assert.equal(level.goal.ty, 6);
});

test('map boundaries behave as walls horizontally and void vertically', () => {
  const level = new PJ.Level(PJ.LEVELS[0]);
  assert.equal(level.tileAt(-1, 10), PJ.TILE_SOLID);
  assert.equal(level.tileAt(level.cols, 10), PJ.TILE_SOLID);
  assert.equal(level.tileAt(4, -1), PJ.TILE_EMPTY);
  assert.equal(level.tileAt(4, level.heightTiles), PJ.TILE_EMPTY);
});
