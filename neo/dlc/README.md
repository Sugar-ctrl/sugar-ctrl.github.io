# DLC 包格式

平台支持**多个 DLC**，每个 DLC 里可以有**多个游戏**。DLC 有两种分发方式：

| 场景 | 方式 | 是否需要打包 |
| --- | --- | --- |
| 直接双击 `index.html`（`file://`） | 导入单个 `.qdlc` 文件 | 需要，用 `tools/pack-dlc.js` |
| 部署到 HTTP 服务器 | 把 DLC 目录放进 `dlc/`，在 `dlc/index.json` 登记 | 不需要 |

两种方式共用同一份目录结构和 `dlc.json`，所以可以先在服务器上调试，最后再打包给 `file://` 用户。

## 目录结构

```
dlc/
  index.json             服务器模式：列出要加载的 DLC 包
  manifest.js            预置 DLC 清单（经典脚本，可选）
  my-pack/
    dlc.json             包元信息 + 游戏列表
    game-a/
      main.js
      style.css
      assets/...
    game-b/
      main.js
      style.css
```

`dlc.json` 示例：

```json
{
  "id": "my-pack",
  "name": "我的 DLC",
  "icon": "🧩",
  "games": [
    {
      "id": "game_a",
      "name": "游戏 A",
      "icon": "🅰️",
      "sub": "第一个游戏",
      "dir": "game-a",
      "entry": "main.js",
      "style": "style.css"
    },
    {
      "id": "game_b",
      "name": "游戏 B",
      "icon": "🅱️",
      "sub": "第二个游戏",
      "dir": "game-b",
      "entry": "main.js",
      "style": "style.css"
    }
  ]
}
```

字段说明：

- `id`：DLC 包 id，必须唯一。
- `games[].id`：游戏 id，全平台必须唯一，路由是 `#/dlc_<id>`。
- `dir`：游戏目录，相对 DLC 包根目录；缺省等于游戏 `id`。
- `entry`：入口脚本，默认 `main.js`。
- `style`：样式文件，默认 `style.css`；设为 `null` 表示不要样式。
- `loader`：可选。如果脚本不挂 `window.__games[id]`，而是提供全局初始化函数，就写函数名。

游戏入口脚本和基础游戏写法一致，最后挂到 `window.__games[<id>]`：

```js
(function(){
  function init(container){
    container.innerHTML = '<div class="game-page active">游戏 A</div>';
    return {
      getState: () => ({ game: 'game_a' }),
      setState: () => {}
    };
  }
  window.__games = window.__games || {};
  window.__games['game_a'] = { init };
})();
```

## 方式一：服务器加载（HTTP，无需打包）

1. 把 DLC 目录放到 `dlc/my-pack/`。
2. 编辑 `dlc/index.json`：

```json
{
  "packs": ["my-pack"]
}
```

也可以写对象形式，自定义路径：

```json
{
  "packs": [
    { "id": "my-pack", "base": "dlc/my-pack" }
  ]
}
```

3. 用 HTTP 打开页面。平台会 `fetch('dlc/index.json')`，再逐个加载 `dlc/<id>/dlc.json` 和游戏脚本/样式。

服务器模式下，游戏脚本里的相对资源路径会按**页面地址**解析，不是按脚本地址。需要引用包内资源时用：

```js
const url = QileDLC.asset(container.dataset.packId, 'assets/icon.png');
```

`container.dataset.packId` 由平台在初始化前写入。

## 方式二：打包成 `.qdlc`（file://）

`.qdlc` 是一个 UTF-8 JSON 文件，里面包含包元信息、游戏列表和所有资源。文本文件按字符串存，二进制按 base64 存。

打包：

```bash
node tools/pack-dlc.js dlc/my-pack
# 或指定输出
node tools/pack-dlc.js dlc/my-pack dist/my-pack.qdlc
```

解包（方便检查/修改）：

```bash
node tools/unpack-dlc.js dist/my-pack.qdlc
```

打包后在大厅底部点击“导入 DLC”，选择 `.qdlc` 文件即可。可以一次选择多个 `.qdlc`，也可以混合选择 `.html` / `.js`。每次导入一个包，包内所有游戏会出现在同一个标题下；再导入其他包会继续增加新的 DLC 区块。

### 内嵌资源

- 游戏 JS/CSS 直接内嵌执行/注入。
- CSS 里的相对 `url(...)` 会自动解析成包内资源的 `blob:` 地址；包内 CSS 请直接用 `url(...)`，不要用 `@import`。
- JS 里用 `QileDLC.asset(container.dataset.packId, 'assets/icon.png')` 获取资源 URL。
- 平台会过滤 DLC CSS 中可能污染壳的全局选择器（`body`、`.entry`、`.panel` 等）。

## 预置 DLC（可选）

如果不想让用户手动导入，也可以在 `dlc/manifest.js` 里直接登记。它会在页面启动时执行，适合 `file://` 和 HTTP 两种场景：

```js
QileDLC.registerPack({
  id: 'my-pack',
  name: '我的 DLC',
  icon: '🧩',
  base: 'dlc/my-pack',   // 目录存在时可直接用；单文件分发用 .qdlc
  games: [
    { id: 'game_a', name: '游戏 A', dir: 'game-a' }
  ]
});
```

旧的单游戏登记接口仍然可用：

```js
QileDLC.register({
  id: 'my_dlc_game',
  name: 'DLC 游戏',
  icon: '✨',
  loader: 'init_my_dlc_game',
  script: 'dlc/mygame.js',
  style: 'dlc/mygame.css'
});
```

## 注意

- 游戏代码继续用经典脚本，不要写 `import` / `export`；不要在 `file://` 下依赖 `fetch`。
- 每个包、每个游戏的 `id` 都要唯一；重复 id 会被跳过并在控制台提示。
- `main.js` 只会执行一次，重复进入游戏会重新调用 `init`。
- 不要修改 `export.*` 和 `qlwq-slop/`。
