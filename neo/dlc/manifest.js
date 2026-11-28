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

QileDLC.registerPack({
  id: 'world_chess',
  name: '世界象棋',
  icon: '🌍',
  base: 'dlc/world_chess',
  games: [
    { id: 'world_shogi', name: '日本将棋', icon: '🎴', sub: '9×9 · 二步/打步诘', dir: 'games/world_shogi', entry: 'main.js', style: 'shared/style.css' },
    { id: 'world_janggi', name: '朝鲜将棋', icon: '🇰🇷', sub: '10×9 · 马象互换', dir: 'games/world_janggi', entry: 'main.js', style: 'shared/style.css' },
    { id: 'world_chaturanga', name: '印度象棋', icon: '🇮🇳', sub: '8×8 · 跳象', dir: 'games/world_chaturanga', entry: 'main.js', style: 'shared/style.css' },
    { id: 'world_myanmar', name: '缅甸象棋', icon: '🇲🇲', sub: '8×8 · 布阵', dir: 'games/world_myanmar', entry: 'main.js', style: 'shared/style.css' },
    { id: 'world_thailand', name: '泰国象棋', icon: '🇹🇭', sub: '8×8 · 升变/王不照面', dir: 'games/world_thailand', entry: 'main.js', style: 'shared/style.css' },
    { id: 'world_cambodia', name: '柬埔寨象棋', icon: '🇰🇭', sub: '8×8 · 兵双步升变', dir: 'games/world_cambodia', entry: 'main.js', style: 'shared/style.css' },
    { id: 'world_senterej', name: '埃塞俄比亚象棋', icon: '🇪🇹', sub: '8×8 · 移动阶段', dir: 'games/world_senterej', entry: 'main.js', style: 'shared/style.css' },
    { id: 'world_shatar', name: '蒙古象棋', icon: '🇲🇳', sub: '8×8 · 狮驼', dir: 'games/world_shatar', entry: 'main.js', style: 'shared/style.css' },
    { id: 'world_jetan', name: '西藏象棋', icon: '🏔️', sub: '10×10', dir: 'games/world_jetan', entry: 'main.js', style: 'shared/style.css' },
    { id: 'world_malay', name: '马来象棋', icon: '🇲🇾', sub: '8×8 · 无象', dir: 'games/world_malay', entry: 'main.js', style: 'shared/style.css' },
    { id: 'world_java', name: '爪哇象棋', icon: '🇮🇩', sub: '8×8 · 兵升后', dir: 'games/world_java', entry: 'main.js', style: 'shared/style.css' },
    { id: 'world_arabic', name: '阿拉伯象棋', icon: '🇸🇦', sub: '8×8 · 王直线', dir: 'games/world_arabic', entry: 'main.js', style: 'shared/style.css' },
    { id: 'world_turkish', name: '土耳其象棋', icon: '🇹🇷', sub: '8×8 · 兵无升变', dir: 'games/world_turkish', entry: 'main.js', style: 'shared/style.css' },
    { id: 'world_shatranj', name: '波斯象棋', icon: '🇮🇷', sub: '8×8 · 兵升士', dir: 'games/world_shatranj', entry: 'main.js', style: 'shared/style.css' }
  ]
});
