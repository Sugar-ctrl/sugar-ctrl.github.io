/* 基础游戏清单：dir 指向游戏目录，style 为可选样式文件名 */
QileRegistry.registerBase([
  {id:'gomoku',    name:'五子棋',   icon:'⚫',        sub:'15×15 交叉点',          dir:'games/gomoku'},
  {id:'go',        name:'围棋',     icon:'⚪',        sub:'吃子·劫争·天元',        dir:'games/go'},
  {id:'tictactoe', name:'井字棋',   icon:'❌',        sub:'3×3 格子',              dir:'games/tictactoe', style:'style.css'},
  {id:'checkers',  name:'跳棋',     icon:'icon-circle-x', sub:'8×8 斜走连跳',      dir:'games/checkers',  style:'style.css'},
  {id:'othello',   name:'黑白棋',   icon:'icon-othello',  sub:'8×8 翻转',          dir:'games/othello',   style:'style.css'},
  {id:'ludo',      name:'飞行棋',   icon:'✈️',        sub:'田字十字棋盘',          dir:'games/ludo',      style:'style.css'},
  {id:'animal',    name:'斗兽棋',   icon:'🦁',        sub:'6×6 拆包对战',          dir:'games/animal',    style:'style.css'},
  {id:'xiangqi',   name:'象棋',     icon:'🀄',        sub:'楚河汉界·将帅对脸',     dir:'games/xiangqi',   style:'style.css'},
  {id:'chess',     name:'国际象棋', icon:'♟️',        sub:'王车易位·吃过路兵',     dir:'games/chess',     style:'style.css'},
  {id:'naval',     name:'海战棋',   icon:'🚢',        sub:'10×10 布阵对战',        dir:'games/naval',     style:'style.css'},
  {id:'air',       name:'空战棋',   icon:'🛩️',        sub:'15×15 云朵空战',        dir:'games/air',       style:'style.css'},
  {id:'junqi',     name:'军棋',     icon:'🎖️',        sub:'暗棋布阵·暗棋对战',     dir:'games/junqi',     style:'style.css'},
  {id:'backgammon',name:'双陆棋',   icon:'🎲',        sub:'西洋双陆棋',            dir:'games/backgammon',style:'style.css'},
  {id:'monopoly',  name:'大富翁',   icon:'🏠',        sub:'外56格·内16格·传送门',  dir:'games/monopoly',  style:'style.css'}
]);
