/* 预加载 DLC 清单（经典脚本，支持 file://）
 *
 * 一个 DLC 包可以包含多个游戏：
 * QileDLC.registerPack({
 *   id: 'world-chess',
 *   name: '世界象棋',
 *   icon: '🌍',
 *   base: 'dlc/world-chess',   // 目录存在时可直接用；单文件分发请用 .qdlc 导入
 *   games: [
 *     { id: 'world_shogi', name: '日本将棋', icon: '🎴', sub: '9×9', dir: 'world_shogi' },
 *     { id: 'world_xiangqi', name: '世界象棋', icon: '♟️', sub: '8×8', dir: 'world_xiangqi' }
 *   ]
 * });
 *
 * 单个游戏也可以继续用旧接口：
 * QileDLC.register({
 *   id: 'world_shogi',
 *   name: '日本将棋',
 *   icon: '🎴',
 *   sub: '9×9 · 二步/打步诘',
 *   loader: 'init_world_shogi',
 *   script: 'dlc/world-chess.js',
 *   style: 'dlc/world-chess.css'
 * });
 *
 * 不预置也可以在大厅点击“导入 DLC”，选择 .qdlc / .html / .js 文件。
 */
