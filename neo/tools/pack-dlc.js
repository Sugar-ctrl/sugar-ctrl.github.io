#!/usr/bin/env node
/*
 * 把 DLC 目录打包成单个 .qdlc 文件（UTF-8 JSON，内含所有资源）
 *
 * 用法：
 *   node tools/pack-dlc.js <dlc目录> [输出.qdlc]
 *
 * 目录里需要有一个 dlc.json（或 manifest.json），格式：
 * {
 *   "id": "world-chess",
 *   "name": "世界象棋",
 *   "icon": "🌍",
 *   "games": [
 *     {"id": "world_shogi", "name": "日本将棋", "icon": "🎴", "sub": "9×9"}
 *   ]
 * }
 *
 * 游戏目录默认取 games[].dir，缺省等于 games[].id；
 * 入口默认 main.js，样式默认 style.css。
 * 目录下所有文件都会被打进包内，文本按 UTF-8 存储，二进制按 base64 存储。
 */
const fs = require('fs');
const path = require('path');

const TEXT_EXT = new Set([
  '.js', '.css', '.html', '.htm', '.json', '.txt', '.md', '.svg',
  '.csv', '.xml', '.yml', '.yaml', '.map'
]);

function norm(p){
  return String(p || '').replace(/\\/g, '/').replace(/^\.?\//, '');
}

function main(){
  const dirArg = process.argv[2];
  if (!dirArg) {
    console.error('用法：node tools/pack-dlc.js <dlc目录> [输出.qdlc]');
    process.exit(1);
  }
  const dir = path.resolve(dirArg);
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
    console.error('目录不存在：' + dir);
    process.exit(1);
  }

  const metaFile = ['dlc.json', 'manifest.json']
    .map(f => path.join(dir, f))
    .find(f => fs.existsSync(f));
  if (!metaFile) {
    console.error('目录里没有 dlc.json 或 manifest.json');
    process.exit(1);
  }

  let meta;
  try {
    meta = JSON.parse(fs.readFileSync(metaFile, 'utf8'));
  } catch (err) {
    console.error('清单解析失败：' + err.message);
    process.exit(1);
  }

  const id = meta.id || path.basename(dir);
  const safeName = String(id).replace(/[\\/:*?"<>|]+/g, '-');
  const out = path.resolve(process.argv[3] || path.join(process.cwd(), safeName + '.qdlc'));

  const files = {};
  let count = 0;
  let bytes = 0;

  function walk(current, rel){
    for (const name of fs.readdirSync(current)) {
      if (name === '.DS_Store') continue;
      const full = path.join(current, name);
      const relPath = rel ? rel + '/' + name : name;
      const st = fs.statSync(full);
      if (st.isDirectory()) {
        walk(full, relPath);
      } else {
        if (full === metaFile || full === out) continue;
        const buf = fs.readFileSync(full);
        const ext = path.extname(name).toLowerCase();
        files[relPath] = TEXT_EXT.has(ext)
          ? buf.toString('utf8')
          : { encoding: 'base64', data: buf.toString('base64') };
        count++;
        bytes += buf.length;
      }
    }
  }
  walk(dir, '');

  const games = (Array.isArray(meta.games) ? meta.games : []).map(g => {
    const dirName = g.dir || g.id;
    return Object.assign({}, g, {
      dir: dirName,
      entry: g.entry || 'main.js',
      style: g.style === undefined ? 'style.css' : g.style
    });
  });

  const pack = {
    format: 'qdlc',
    version: 1,
    id,
    name: meta.name || id,
    icon: meta.icon || '✨',
    games,
    files
  };

  const missing = games.filter(g => !files[norm(g.dir + '/' + g.entry)]);
  if (missing.length) {
    console.warn('警告：以下游戏缺少入口脚本：');
    missing.forEach(g => console.warn('  ' + g.id + ' -> ' + norm(g.dir + '/' + g.entry)));
  }

  fs.writeFileSync(out, JSON.stringify(pack));
  console.log('已打包：' + out);
  console.log('游戏：' + games.length + ' 个，文件：' + count + ' 个，原始大小：' + bytes + ' 字节');
}

main();
