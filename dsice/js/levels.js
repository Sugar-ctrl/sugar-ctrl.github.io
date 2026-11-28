/* Level data + parser.
   Maps are editable ASCII: # solid, ^ spike, o crystal, S slime,
   C checkpoint, I ice block, P spawn, G goal, N tutorial NPC.
   Every row must be the same width. */
(function (global) {
  'use strict';

  const PJ = global.PJ || (global.PJ = {});
  const TILE = PJ.TILE;
  const EMPTY = PJ.TILE_EMPTY;
  const SOLID = PJ.TILE_SOLID;
  const SPIKE = PJ.TILE_SPIKE;

  const LEVEL_TUTORIAL = {
    id: 'sands-tutorial',
    name: 'SANDS OF THE LAST ICE',
    label: 'TUTORIAL 01',
    subtitle: '烈阳遗迹 · 新手教程',
    theme: 'desert',
    rows: [
      '......................................................................................................................................................',
      '......................................................................................................................................................',
      '......................................................................................................................................................',
      '.............................................................................................................#############............................',
      '......................................................................................................................................................',
      '....................................................................................................................................############......',
      '....................................................................................................................................................G.',
      '..................................................................................................................................................####',
      '....................................................................................................................................C.................',
      '...............................................##.................................................................................########............',
      '...............................................##.....................................................................................................',
      '...............................................##.............................................######..................................................',
      '...............................................##.............................................................#########...............................',
      '...............................................##....................###..............................................................................',
      '..P..N......##................NC...........C...##C......................N.................N.....I.....................................................',
      '##################################^^^^^^^^^###########^^^^^^^^^#######################################################################################',
      '######################################################################################################################################################'
    ],
    platforms: [
      // Mandatory tutorial sequence: ferry over spikes, lift over the wall,
      // then launch onto the long one-way bridge.
      { tx: 34, ty: 13, w: 4, axis: 'x', range: 80, speed: 0.8, phase: 0 },
      { tx: 43, ty: 11, w: 3, axis: 'y', range: 32, speed: 0.9, phase: 0 },
      { tx: 53, ty: 10, w: 10, axis: 'y', range: 0, speed: 0, phase: 0 },
      // Final ice route: one-way landing + ferry across the gap.
      { tx: 114, ty: 9, w: 8, axis: 'y', range: 0, speed: 0, phase: 0 },
      { tx: 122, ty: 9, w: 4, axis: 'x', range: 64, speed: 0.75, phase: 0 }
    ],
    jumpPads: [
      { tx: 53, ty: 14, power: 500 },
      { tx: 116, ty: 11, power: 470 }
    ],
    slopes: [
      { tx: 63, ty: 14, w: 6, h: 2 },
      { tx: 102, ty: 14, w: 8, h: 3 },
      { tx: 138, ty: 8, w: 8, h: 2 }
    ],
    dialogues: [
      {
        name: '潮汐向导 阿澈 / TIDE GUIDE',
        role: 'WALKTHROUGH KEEPER',
        auto: true,
        lines: [
          '旅行者，欢迎来到烈阳遗迹。先熟悉身体：A / D 左右移动，Space 跳跃；长按跳得更高，轻点跳得更低。',
          'R 重新开始，Esc / P 暂停。前方有一块矮石，跳过去，沿着沙路继续。',
          '靠近 NPC 会自动开始对话。现在对话不会冻结时间，你可以边走边听；按 E / Enter 或点击翻页，离得太远会自动结束。',
          '{controls}'
        ]
      },
      {
        name: '机关师 洛柯 / TINKER',
        role: 'RUIN MECHANIC',
        auto: true,
        lines: [
          '前面的路没有平地可绕：先乘横向平台越过尖刺，再乘纵向平台越过石墙；直接跳是跳不过去的。',
          '青色导轨是单向踏板，金色跳板会把你弹上去。第二段尖刺只能靠跳板越过；站在单向桥上按 S 可以主动落下。',
          '最后是斜坡；它能走上去，也能把重物推上去。它们在后半段都会用来运冰。'
        ]
      },
      {
        name: '遗迹记录者 弥拉 / ARCHIVIST',
        role: 'KEEPER OF THE OLD OASIS',
        auto: true,
        lines: [
          '很久以前，这里是一片绿洲。日晷失控后，黄沙吞没了城市，只剩最后一枚冰种能唤醒泉眼。',
          '白天的阳光会融冰，夜晚的寒意会侵蚀你。按 T 循环清晨、正午、黄昏和夜晚，也可以点击顶部日晷任意拨动时间。',
          '阴影能保护冰，却不能温暖你；站到直射阳光里可以回暖。后半段你会同时用到这些规则。'
        ]
      },
      {
        name: '守日人 塞拉 / SUNWARDEN',
        role: 'KEEPER OF THE LAST ICE',
        auto: true,
        lines: [
          '从这里开始就是后半段。把冰块推上坡道，它会自己贴合斜面；继续推到跳板上。',
          '跳板会把冰块弹上半空的单向平台，你也要跟上去。之后借助横向移动平台把冰送过缺口。',
          '目标是把冰完整送到右侧冰之祭坛。别让它在阳光下融化；必要时切换时段，或把它留在阴影里。'
        ]
      }
    ],
    signs: []
  };

  class Level {
    constructor(definition) {
      if (!definition || !Array.isArray(definition.rows) || !definition.rows.length) {
        throw new Error('Level needs a non-empty rows array.');
      }

      this.definition = definition;
      this.id = definition.id;
      this.name = definition.name;
      this.label = definition.label;
      this.subtitle = definition.subtitle;
      this.theme = definition.theme || 'desert';
      this.rows = definition.rows.slice();
      this.cols = this.rows[0].length;
      this.heightTiles = this.rows.length;
      this.pixelW = this.cols * TILE;
      this.pixelH = this.heightTiles * TILE;
      this.signs = (definition.signs || []).slice();
      this.platformSpawns = (definition.platforms || []).slice();
      this.jumpPadSpawns = (definition.jumpPads || []).slice();
      this.slopes = (definition.slopes || []).slice();
      this.dialogues = (definition.dialogues || []).slice();

      this.grid = [];
      this.gems = [];
      this.enemySpawns = [];
      this.checkpointSpawns = [];
      this.npcSpawns = [];
      this.spawn = null;
      this.goal = null;
      this.iceSpawn = null;

      this._parse();

      if (!this.spawn) throw new Error('Level "' + this.id + '" has no spawn point (P).');
      if (!this.goal) throw new Error('Level "' + this.id + '" has no goal (G).');
    }

    _parse() {
      for (let y = 0; y < this.rows.length; y++) {
        const row = this.rows[y];
        if (row.length !== this.cols) {
          throw new Error('Map row ' + y + ' is ' + row.length + ' chars, expected ' + this.cols + '.');
        }

        const tileRow = [];
        for (let x = 0; x < this.cols; x++) {
          const ch = row[x];
          let tile = EMPTY;

          switch (ch) {
            case '#':
              tile = SOLID;
              break;
            case '^':
              tile = SPIKE;
              break;
            case 'P':
              this.spawn = this._spawnAt(x, y);
              break;
            case 'I':
              this.iceSpawn = {
                tx: x,
                ty: y,
                x: x * TILE,
                y: (y + 1) * TILE - 16
              };
              break;
            case 'N':
              this.npcSpawns.push({ tx: x, ty: y });
              break;
            case 'G':
              this.goal = {
                tx: x,
                ty: y,
                x: x * TILE,
                baseY: (y + 1) * TILE
              };
              break;
            case 'C':
              this.checkpointSpawns.push({ tx: x, ty: y });
              break;
            case 'o':
              this.gems.push({ tx: x, ty: y, phase: PJ.hash2(x, y) * Math.PI * 2 });
              break;
            case 'S':
              this.enemySpawns.push({ tx: x, ty: y });
              break;
            default:
              break;
          }

          tileRow.push(tile);
        }
        this.grid.push(tileRow);
      }
    }

    _spawnAt(tx, ty) {
      // Player is 10 x 14, aligned to the bottom of the marker tile.
      return {
        tx: tx,
        ty: ty,
        x: tx * TILE + 3,
        y: (ty + 1) * TILE - 14
      };
    }

    tileAt(tx, ty) {
      if (tx < 0 || tx >= this.cols) return SOLID;
      if (ty < 0 || ty >= this.heightTiles) return EMPTY;
      return this.grid[ty][tx];
    }

    isSolidAt(tx, ty) {
      return this.tileAt(tx, ty) === SOLID;
    }

    isSolidAtPx(px, py) {
      return this.tileAt(Math.floor(px / TILE), Math.floor(py / TILE)) === SOLID;
    }

    spawnPoint() {
      return { x: this.spawn.x, y: this.spawn.y };
    }
  }

  PJ.Level = Level;
  PJ.LEVELS = [LEVEL_TUTORIAL];
})(typeof window !== 'undefined' ? window : globalThis);
