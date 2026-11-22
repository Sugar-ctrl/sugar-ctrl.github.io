#!/usr/bin/env node
/*
 * 解包 .qdlc 到目录，方便查看 / 修改后再打包
 *
 * 用法：
 *   node tools/unpack-dlc.js <文件.qdlc> [输出目录]
 */
const fs = require('fs');
const path = require('path');

function safeJoin(root, rel){
  const target = path.resolve(root, rel);
  const base = path.resolve(root) + path.sep;
  if (target !== path.resolve(root) && !target.startsWith(base)) {
    throw new Error('非法路径：' + rel);
  }
  return target;
}

function main(){
  const file = process.argv[2];
  if (!file) {
    console.error('用法：node tools/unpack-dlc.js <文件.qdlc> [输出目录]');
    process.exit(1);
  }
  const src = path.resolve(file);
  if (!fs.existsSync(src)) {
    console.error('文件不存在：' + src);
    process.exit(1);
  }

  let pack;
  try {
    pack = JSON.parse(fs.readFileSync(src, 'utf8'));
  } catch (err) {
    console.error('文件解析失败：' + err.message);
    process.exit(1);
  }
  if (!pack || !pack.games || !pack.files) {
    console.error('不是有效的 .qdlc 文件');
    process.exit(1);
  }

  const id = pack.id || path.basename(src, path.extname(src));
  const safeName = String(id).replace(/[\\/:*?"<>|]+/g, '-');
  const outDir = path.resolve(process.argv[3] || path.join(process.cwd(), safeName));
  fs.mkdirSync(outDir, {recursive: true});

  const meta = {
    id: pack.id || id,
    name: pack.name || id,
    icon: pack.icon || '✨',
    games: pack.games
  };
  fs.writeFileSync(path.join(outDir, 'dlc.json'), JSON.stringify(meta, null, 2) + '\n');

  let count = 0;
  for (const rel of Object.keys(pack.files)) {
    const target = safeJoin(outDir, rel);
    fs.mkdirSync(path.dirname(target), {recursive: true});
    const f = pack.files[rel];
    if (typeof f === 'string') {
      fs.writeFileSync(target, f);
    } else if (f && f.encoding === 'base64') {
      fs.writeFileSync(target, Buffer.from(f.data, 'base64'));
    } else {
      console.warn('跳过未知文件：' + rel);
      continue;
    }
    count++;
  }

  console.log('已解包到：' + outDir);
  console.log('游戏：' + pack.games.length + ' 个，文件：' + count + ' 个');
}

main();
