/* 平台注册表：基础游戏清单 + DLC 包注册接口（经典脚本，支持 file://） */
(function(){
  const MIME = {
    '.js':'text/javascript', '.css':'text/css', '.html':'text/html', '.htm':'text/html',
    '.json':'application/json', '.txt':'text/plain', '.md':'text/markdown',
    '.svg':'image/svg+xml', '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg',
    '.gif':'image/gif', '.webp':'image/webp', '.ico':'image/x-icon',
    '.mp3':'audio/mpeg', '.wav':'audio/wav', '.ogg':'audio/ogg',
    '.woff':'font/woff', '.woff2':'font/woff2', '.ttf':'font/ttf', '.otf':'font/otf'
  };

  function normalizeRel(p){
    const parts = [];
    String(p == null ? '' : p).replace(/\\/g, '/').split('/').forEach(seg => {
      if (!seg || seg === '.') return;
      if (seg === '..') parts.pop();
      else parts.push(seg);
    });
    return parts.join('/');
  }

  function joinUrl(base, rel){
    return String(base).replace(/\/+$/, '') + '/' + String(rel).replace(/^\/+/, '');
  }

  function isAbsoluteUrl(p){
    return /^(?:[a-z][a-z0-9+.-]*:|\/\/|\/)/i.test(String(p || ''));
  }

  function mimeByExt(p){
    const m = /\.([a-z0-9]+)$/i.exec(p || '');
    return (m && MIME['.' + m[1].toLowerCase()]) || 'application/octet-stream';
  }

  function b64ToBytes(b64){
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }

  function fileText(pack, path){
    if (!pack || !pack.files) return null;
    const f = pack.files[normalizeRel(path)];
    if (f == null) return null;
    if (typeof f === 'string') return f;
    if (f.encoding === 'base64') {
      try { return new TextDecoder('utf-8').decode(b64ToBytes(f.data)); }
      catch (e) { return atob(f.data); }
    }
    return null;
  }

  window.QileRegistry = {
    base: [],
    registerBase(list){ this.base.push.apply(this.base, list); }
  };

  window.QileDLC = {
    rows: [{ title: 'DLC 扩展', games: [] }],
    packs: [],
    list: [],
    currentRow: null,
    onChange: null,

    /* 单个游戏注册（兼容旧 DLC 文件 / HTML 导入） */
    register(meta){
      if (!meta || !meta.id) { console.warn('DLC 格式错误：缺少 id'); return; }
      if (Array.isArray(meta.games)) return this.registerPack(meta);
      if (this.list.some(g => g.id === meta.id)) {
        console.warn('DLC 已加载，跳过：' + (meta.name || meta.id));
        return;
      }
      const row = this.currentRow || this.rows[0];
      const entry = {
        id: meta.id,
        name: meta.name || meta.id,
        icon: meta.icon || '🎮',
        sub: meta.sub || 'DLC 扩展',
        loader: meta.loader || null,
        script: meta.script || null,
        style: meta.style || null,
        dir: meta.dir || null,
        packId: row.packId || null
      };
      this.list.push(entry);
      row.games.push(entry);
      if (this.onChange) this.onChange();
    },

    /* 一个 DLC 包，包含多个游戏和可选的内嵌文件 */
    registerPack(meta){
      if (!meta || !meta.id) { console.warn('DLC 包格式错误：缺少 id'); return null; }
      const old = this.packs.find(p => p.id === meta.id);
      if (old) { console.warn('DLC 包已加载，跳过：' + meta.id); return old; }

      const pack = {
        id: meta.id,
        name: meta.name || meta.id,
        icon: meta.icon || '✨',
        base: meta.base || null,
        files: meta.files || null,
        games: [],
        assetUrls: {},
        blobUrls: []
      };
      this.packs.push(pack);

      const games = Array.isArray(meta.games) ? meta.games : [];
      games.forEach(g => {
        if (!g || !g.id) return;
        if (this.list.some(x => x.id === g.id)) {
          console.warn('DLC 游戏已存在，跳过：' + g.id);
          return;
        }
        const dir = normalizeRel(g.dir || g.id);
        const entry = g.entry || 'main.js';
        const style = g.style === undefined ? 'style.css' : g.style;
        const rawScript = g.script || (dir ? dir + '/' + entry : entry);
        const rawStyle = style ? (style.indexOf('/') >= 0 ? style : (dir ? dir + '/' + style : style)) : null;
        const scriptRel = rawScript ? normalizeRel(rawScript) : null;
        const styleRel = rawStyle ? normalizeRel(rawStyle) : null;
        const scriptAbsolute = isAbsoluteUrl(rawScript);
        const styleAbsolute = isAbsoluteUrl(rawStyle);

        const game = {
          id: g.id,
          name: g.name || g.id,
          icon: g.icon || '🎮',
          sub: g.sub || pack.name,
          packId: pack.id,
          dir, entry, style,
          scriptRel, styleRel,
          loader: g.loader || null,
          script: g.script || null,
          noStyle: style === null || style === false || style === '',
          scriptUrl: null,
          styleUrl: null,
          scriptText: null,
          styleText: null
        };

        if (pack.files) {
          if (scriptRel) game.scriptText = fileText(pack, scriptRel);
          if (styleRel) game.styleText = fileText(pack, styleRel);
        }
        if (pack.base) {
          if (scriptRel) game.scriptUrl = scriptAbsolute ? rawScript : joinUrl(pack.base, scriptRel);
          if (styleRel) game.styleUrl = styleAbsolute ? rawStyle : joinUrl(pack.base, styleRel);
        } else {
          if (scriptAbsolute) game.scriptUrl = rawScript;
          if (styleAbsolute) game.styleUrl = rawStyle;
        }
        if (pack.files && styleRel && game.styleText == null && !game.styleUrl) game.noStyle = true;
        if (!game.scriptText && !game.scriptUrl && g.script && g.script.indexOf('/') >= 0) {
          game.scriptUrl = g.script;
        }
        if (!game.styleText && !game.styleUrl && g.style && g.style.indexOf('/') >= 0) {
          game.styleUrl = g.style;
        }

        pack.games.push(game);
        this.list.push(game);
      });

      for (let i = this.rows.length - 1; i >= 0; i--) {
        if (this.rows[i].games.length === 0) {
          const removed = this.rows.splice(i, 1)[0];
          if (this.currentRow === removed) this.currentRow = null;
        }
      }
      this.rows.push({ title: pack.name, packId: pack.id, games: pack.games });
      if (this.onChange) this.onChange();
      return pack;
    },

    find(id){ return this.list.find(g => g.id === id) || null; },
    getPack(id){ return this.packs.find(p => p.id === id) || null; },

    /* 获取 DLC 包内资源 URL：内嵌包生成 blob:，服务器包拼接 base */
    asset(packId, path){
      const pack = this.getPack(packId);
      if (!pack) return null;
      const rel = normalizeRel(path);
      if (pack.files) {
        if (pack.assetUrls[rel]) return pack.assetUrls[rel];
        const f = pack.files[rel];
        if (f == null) return null;
        let blob;
        if (typeof f === 'string') {
          blob = new Blob([f], { type: mimeByExt(rel) });
        } else if (f && f.encoding === 'base64') {
          blob = new Blob([b64ToBytes(f.data)], { type: mimeByExt(rel) });
        } else {
          return null;
        }
        const url = URL.createObjectURL(blob);
        pack.assetUrls[rel] = url;
        pack.blobUrls.push(url);
        return url;
      }
      if (pack.base) return joinUrl(pack.base, rel);
      return null;
    },

    /* 把 CSS 里的相对 url(...) 解析成包内资源 */
    resolveCssUrls(packId, cssPath, cssText){
      const pack = this.getPack(packId);
      if (!pack || !pack.files) return cssText;
      const baseDir = cssPath && cssPath.indexOf('/') >= 0 ? cssPath.slice(0, cssPath.lastIndexOf('/')) : '';
      return String(cssText).replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/gi, (m, q, u) => {
        if (/^(data:|blob:|https?:|\/\/|\/)/i.test(u)) return m;
        const resolved = normalizeRel(baseDir ? baseDir + '/' + u : u);
        const url = this.asset(packId, resolved);
        return url ? 'url("' + url + '")' : m;
      });
    }
  };
})();
