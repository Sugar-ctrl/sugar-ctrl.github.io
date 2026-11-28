# 添加新游戏

> 本文档中的路径均相对于 `neo/` 目录。

平台是纯经典脚本结构，`file://` 直接打开也能跑。基础游戏不需要打包；DLC 单文件分发时用 `tools/pack-dlc.js`。

## 目录结构

```
index.html              壳
app.js                  路由 / 按需加载 / 存档 / DLC
styles/base.css         壳样式 + 公共棋盘样式
games/
  manifest.js           基础游戏清单
  registry.js           QileRegistry / QileDLC 注册表
  common.js             公共工具 window.GameCommon
  <id>/
    main.js             游戏主逻辑（必需）
    style.css           游戏专属样式（可选）
dlc/
  index.json            服务器 DLC 列表（HTTP 下自动加载）
  manifest.js           预置 DLC 清单（可选）
  README.md             DLC 包格式 / 打包 / 服务器加载说明
tools/
  pack-dlc.js           把 DLC 目录打包成 .qdlc
  unpack-dlc.js         解开 .qdlc
```

## 第一步：新建游戏目录

```
games/mygame/
  main.js
  style.css      # 可选
```

## 第二步：写 `main.js`

每个游戏是一个 IIFE，最后挂到 `window.__games[<id>]`。`init` 必须返回存档接口。

```js
(function(){
  // 可选：公共工具
  const { renderLog } = window.GameCommon;

  function init(container){
    let state = { count: 0 };

    container.innerHTML = `
      <div class="game-page active">
        <div class="game-head"><div class="game-title">🎮 我的游戏</div></div>
        <div class="game-body">
          <div class="sidebar">
            <div class="panel"><h4>状态</h4><div class="status-text" id="myStatus">0</div></div>
            <div class="panel"><h4>功能</h4><div class="actions">
              <button class="act" id="myAdd">+1</button>
              <button class="act" id="myReset">重开</button>
            </div></div>
          </div>
          <div class="board-wrap" id="myBoard"></div>
        </div>
      </div>`;

    function render(){
      document.getElementById('myStatus').textContent = state.count;
      document.getElementById('myBoard').textContent = 'count = ' + state.count;
    }

    document.getElementById('myAdd').onclick = () => { state.count++; render(); };
    document.getElementById('myReset').onclick = () => { state = { count: 0 }; render(); };

    render();

    // 存档接口
    return {
      getState: () => ({ game: 'mygame', count: state.count }),
      setState: (s) => { state = { count: s.count || 0 }; render(); },
      // canSave: () => true   // 可选：返回 false 时禁止保存
    };
  }

  window.__games = window.__games || {};
  window.__games['mygame'] = { init };
})();
```

约定：

- `getState()` 返回的对象里 `game` 字段必须是游戏 id，读档时靠它找游戏。
- `setState(state)` 负责恢复状态并重新渲染。
- `canSave()` 可选，例如国际象棋升变中返回 `false`。
- 游戏内部逻辑不要依赖全局变量，状态放在 `init` 的闭包里。
- 公共工具在 `window.GameCommon`：`drawCrossLines`、`addAxisLabels`、`renderLog`。

## 第三步：写 `style.css`（可选）

只放这个游戏自己的样式。壳的布局、`.panel`、`.sidebar`、`.board-wrap`、`.act` 等已经在 `styles/base.css` 里。

```css
.my-board {
  display: grid;
  grid-template-columns: repeat(3, 80px);
}
```

## 第四步：登记到清单

编辑 `games/manifest.js`，加一项：

```js
{id:'mygame', name:'我的游戏', icon:'🎮', sub:'示例游戏', dir:'games/mygame', style:'style.css'}
```

- `dir` 必填，默认加载 `games/mygame/main.js`。
- `style` 可选，有样式文件就写 `'style.css'`。

刷新页面，大厅里就会出现新游戏，点击后才会加载它的 `main.js` 和 `style.css`。

## 添加 DLC

平台支持多个 DLC，每个 DLC 里可以有多个游戏。详细格式、目录结构、打包工具和服务器加载方式见 [`dlc/README.md`](../dlc/README.md)。

简单说：

- `file://` 下：把 DLC 目录用 `node tools/pack-dlc.js <目录>` 打成 `.qdlc`，在大厅“导入 DLC”。
- HTTP 下：把 DLC 目录放进 `dlc/`，在 `dlc/index.json` 登记，刷新即可，不需要打包。
- 也可以预置到 `dlc/manifest.js`，调用 `QileDLC.registerPack({...})`。

单个游戏的旧接口仍然可用：

```js
window.QileDLC.register({
  id: 'my_dlc_game',
  name: 'DLC 游戏',
  icon: '✨',
  sub: 'DLC 扩展',
  loader: 'init_my_dlc_game'
});

window.init_my_dlc_game = function(container){
  container.innerHTML = '<div class="game-page active">DLC 游戏</div>';
};
```

DLC 路由会自动加前缀 `dlc_`，例如 `#/dlc_my_dlc_game`。

## 注意

- 全部用经典脚本，不要写 `import` / `export`，也不要依赖 `fetch`，否则 `file://` 下会失败。
- 每个游戏目录只加载自己的 `main.js`；`main.js` 被缓存，重复进入会重新执行 `init`。
- 不要修改 `export.*` 和 `qlwq-slop/`。
