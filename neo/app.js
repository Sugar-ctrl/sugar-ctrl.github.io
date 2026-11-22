/* 棋乐无穷 5.5 · 壳逻辑（经典脚本，支持 file://） */
(function(){
  const BASE = window.QileRegistry.base;
  const DLC = window.QileDLC;

  const hall = document.getElementById('hall');
  const container = document.getElementById('gameContainer');
  const homeBtn = document.getElementById('homeBtn');
  const saveDropdown = document.getElementById('saveDropdown');
  const loadDropdown = document.getElementById('loadDropdown');
  const entriesBox = document.getElementById('entries');
  const dlcContainer = document.getElementById('dlcContainer');
  const bgmAudio = document.getElementById('bgmAudio');
  const bgmBtn = document.getElementById('bgmBtn');

  let currentRouteId = null;
  let currentInstance = null;
  let loadToken = 0;
  let loading = false;
  let bgmPlaying = false;
  let serverDlcsLoaded = false;
  const loadedScripts = new Set();
  const loadedStyles = new Set();

  /* ---------- 路由 ---------- */
  function getRoute(){ return location.hash.replace('#/','').replace('#','') || ''; }
  function goHome(){ location.hash = ''; }
  function goGame(id){ location.hash = '/' + id; }
  function closeDropdowns(){ saveDropdown.classList.remove('open'); loadDropdown.classList.remove('open'); }

  function findBase(id){ return BASE.find(g => g.id === id) || null; }
  function findDlc(id){ return DLC.find(id); }

  /* ---------- 按需加载 ---------- */
  function loadScript(src){
    if (loadedScripts.has(src)) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = () => { loadedScripts.add(src); resolve(); };
      s.onerror = () => reject(new Error('脚本加载失败：' + src));
      document.head.appendChild(s);
    });
  }

  function loadStyle(href){
    if (loadedStyles.has(href)) return Promise.resolve();
    return new Promise(resolve => {
      const l = document.createElement('link');
      l.rel = 'stylesheet';
      l.href = href;
      l.onload = () => { loadedStyles.add(href); resolve(); };
      l.onerror = () => { loadedStyles.add(href); resolve(); };
      document.head.appendChild(l);
    });
  }

  function runInlineScript(code, key){
    if (loadedScripts.has(key)) return;
    const s = document.createElement('script');
    s.setAttribute('data-dlc', key);
    s.textContent = code;
    document.body.appendChild(s);
    loadedScripts.add(key);
  }

  function scriptPath(g){
    if (g.script) return g.script;
    if (g.dir) return g.dir + '/main.js';
    return null;
  }

  function stylePath(g, isDlc){
    if (g.style) return g.style.indexOf('/') >= 0 ? g.style : (g.dir ? g.dir + '/' + g.style : g.style);
    if (isDlc && g.dir) return g.dir + '/style.css';
    return null;
  }

  function iconHtml(icon){
    if (icon === 'icon-circle-x') return '<div class="icon-circle-x">✕</div>';
    if (icon === 'icon-othello') return '<div class="icon-othello"></div>';
    return icon;
  }

  /* ---------- 大厅渲染 ---------- */
  function renderEntries(){
    entriesBox.innerHTML = '';
    BASE.forEach(g => {
      const d = document.createElement('div');
      d.className = 'entry' + (currentRouteId === g.id ? ' active' : '');
      d.innerHTML = '<div class="ico">' + iconHtml(g.icon) + '</div><div><div class="nm">' + g.name + '</div></div><div class="sub">' + g.sub + '</div>';
      d.onclick = () => goGame(g.id);
      entriesBox.appendChild(d);
    });
  }

  function renderDlcRows(){
    if (!dlcContainer) return;
    dlcContainer.innerHTML = '';
    DLC.rows.forEach(row => {
      const section = document.createElement('div');
      section.className = 'dlc-section';

      const title = document.createElement('div');
      title.className = 'hall-title';
      title.style.marginTop = '6px';
      title.textContent = '✨ ' + row.title;
      section.appendChild(title);

      const rowEl = document.createElement('div');
      rowEl.className = 'dlc-row';

      row.games.forEach(g => {
        const d = document.createElement('div');
        d.className = 'dlc-entry' + (currentRouteId === 'dlc_' + g.id ? ' active' : '');
        d.innerHTML = '<div class="ico">' + iconHtml(g.icon) + '</div><div><div class="nm">' + g.name + '</div></div><div class="sub">' + g.sub + '</div>';
        d.onclick = () => goGame('dlc_' + g.id);
        rowEl.appendChild(d);
      });

      if (row.games.length === 0) {
        const add = document.createElement('div');
        add.className = 'dlc-placeholder';
        add.innerHTML = '<div class="plus-icon">+</div><div class="dlc-hint">导入 DLC</div>';
        add.onclick = () => {
          DLC.currentRow = row;
          document.getElementById('dlcFileInput').click();
        };
        rowEl.appendChild(add);
      }

      section.appendChild(rowEl);
      dlcContainer.appendChild(section);
    });
  }

  function ensureDlcTrailingRow(){
    const rows = DLC.rows;
    while (rows.length > 1 && rows[rows.length - 1].games.length === 0 && rows[rows.length - 2].games.length === 0) {
      rows.pop();
    }
    const last = rows[rows.length - 1];
    if (!last || last.games.length > 0) rows.push({ title: 'DLC 扩展', games: [] });
  }

  /* ---------- 显示/隐藏 ---------- */
  function showHall(){
    loadToken++;
    loading = false;
    currentRouteId = null;
    currentInstance = null;
    hall.style.display = 'flex';
    container.innerHTML = '';
    homeBtn.style.display = 'none';
    saveDropdown.style.display = 'none';
    loadDropdown.style.display = 'inline-block';
    renderEntries();
    renderDlcRows();
    closeDropdowns();
  }

  function showGame(isDlc){
    hall.style.display = 'none';
    homeBtn.style.display = 'inline-block';
    saveDropdown.style.display = isDlc ? 'none' : 'inline-block';
    loadDropdown.style.display = 'none';
    closeDropdowns();
  }

  /* ---------- 游戏加载 ---------- */
  async function loadBaseGame(g){
    const token = ++loadToken;
    loading = true;
    currentRouteId = g.id;
    currentInstance = null;
    container.innerHTML = '';
    renderEntries();
    try {
      const style = stylePath(g, false);
      if (style) await loadStyle(style);
      const script = scriptPath(g);
      if (script) await loadScript(script);
      if (token !== loadToken) return;
      const mod = window.__games && window.__games[g.id];
      if (!mod || typeof mod.init !== 'function') throw new Error('游戏未注册：' + g.id);
      currentInstance = mod.init(container) || null;
    } catch (err) {
      console.error(err);
      container.innerHTML = '<div class="panel">游戏加载失败：' + err.message + '</div>';
    } finally {
      if (token === loadToken) loading = false;
    }
  }

  async function loadDlcGame(g){
    const token = ++loadToken;
    loading = true;
    currentRouteId = 'dlc_' + g.id;
    currentInstance = null;
    container.innerHTML = '';
    renderEntries();
    renderDlcRows();
    try {
      const pack = g.packId ? DLC.getPack(g.packId) : null;
      const packName = pack ? pack.name : 'DLC';

      if (g.styleText != null) {
        const css = DLC.resolveCssUrls(g.packId, g.styleRel, g.styleText);
        injectScopedDlcStyle(css, packName, 'vfs-style:' + g.packId + ':' + g.styleRel);
      } else if (g.styleUrl) {
        await loadStyle(g.styleUrl);
      } else if (!g.noStyle) {
        const style = stylePath(g, true);
        if (style) await loadStyle(style);
      }

      if (g.scriptText != null) {
        runInlineScript(g.scriptText, 'vfs-script:' + g.packId + ':' + g.scriptRel);
      } else if (g.scriptUrl) {
        await loadScript(g.scriptUrl);
      } else {
        const script = scriptPath(g);
        if (script) await loadScript(script);
      }

      if (token !== loadToken) return;
      container.dataset.gameId = g.id;
      container.dataset.packId = g.packId || '';

      const mod = window.__games && window.__games[g.id];
      let inst = null;
      if (mod && typeof mod.init === 'function') inst = mod.init(container);
      else if (g.loader && typeof window[g.loader] === 'function') inst = window[g.loader](container);
      else throw new Error('DLC 初始化函数未找到：' + (g.loader || g.id));
      currentInstance = (inst && typeof inst === 'object') ? inst : null;
    } catch (err) {
      console.error(err);
      container.innerHTML = '<div class="panel">DLC 加载失败：' + err.message + '</div>';
    } finally {
      if (token === loadToken) loading = false;
    }
  }

  async function route(){
    const id = getRoute();

    if (id && id.indexOf('dlc_') === 0) {
      const g = findDlc(id.slice(4));
      if (!g) {
        if (location.protocol !== 'file:' && !serverDlcsLoaded) {
          showHall();
          return;
        }
        goHome();
        return;
      }
      showGame(true);
      await loadDlcGame(g);
      return;
    }

    const g = findBase(id);
    if (!id || !g) { showHall(); return; }
    showGame(false);
    await loadBaseGame(g);
  }

  /* ---------- DLC 导入 ---------- */
  function injectScopedDlcStyle(cssText, name, key){
    if (key && loadedStyles.has(key)) return;
    const st = document.createElement('style');
    st.setAttribute('data-dlc', name);
    st.textContent = cssText;
    document.head.appendChild(st);
    if (key) loadedStyles.add(key);
    try {
      const sheet = st.sheet;
      if (!sheet) return;
      const GLOBAL = /^(html|body|\*|\.app|\.topbar|\.logo|\.btn|\.hall|\.hall-title|\.entries|\.entry|\.icon-circle-x|\.icon-othello|\.game-page|\.game-head|\.game-title|\.game-body|\.sidebar|\.panel|\.rule-text|\.status-text|\.actions|\.act|\.board-wrap|\.naval-log|\.naval-score|\.cross-board|\.cross-point|\.stone|\.axis-label|\.loading-tip|\.dropdown|\.dlc-section|\.dlc-row|\.dlc-entry|\.dlc-placeholder|\.dlc-hint|\.plus-icon)(?![\w-])/;
      for (let i = sheet.cssRules.length - 1; i >= 0; i--) {
        const rule = sheet.cssRules[i];
        if (rule.type === 1) {
          if (GLOBAL.test(rule.selectorText)) sheet.deleteRule(i);
        } else if (rule.type === 4) {
          for (let j = rule.cssRules.length - 1; j >= 0; j--) {
            const inner = rule.cssRules[j];
            if (inner.type === 1 && GLOBAL.test(inner.selectorText)) rule.deleteRule(j);
          }
          if (rule.cssRules.length === 0) sheet.deleteRule(i);
        }
      }
    } catch (err) {
      console.warn('DLC 样式作用域处理失败，已按原样加载', err);
    }
  }

  function injectDlcContent(text, name){
    const styleRe = /<style[^>]*>([\s\S]*?)<\/style>/gi;
    let m;
    while ((m = styleRe.exec(text))) injectScopedDlcStyle(m[1], name);

    const scriptRe = /<script([^>]*)>([\s\S]*?)<\/script>/gi;
    const codes = [];
    while ((m = scriptRe.exec(text))) {
      if (/\bsrc\s*=/.test(m[1])) continue;
      codes.push(m[2]);
    }
    if (!codes.length) codes.push(text);

    codes.forEach(code => {
      const s = document.createElement('script');
      s.setAttribute('data-dlc', name);
      s.textContent = code;
      document.body.appendChild(s);
    });
  }

  function readTextFile(file){
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = ev => resolve(ev.target.result);
      reader.onerror = () => reject(new Error('文件读取失败'));
      reader.readAsText(file);
    });
  }

  const dlcFileInput = document.getElementById('dlcFileInput');
  dlcFileInput.onchange = async function(e){
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (!files.length) { DLC.currentRow = null; return; }

    let firstHtml = true;
    for (const file of files) {
      const isPack = /\.(qdlc|json)$/i.test(file.name);
      let text;
      try {
        text = await readTextFile(file);
      } catch (err) {
        alert('DLC 文件读取失败：' + file.name);
        continue;
      }

      if (isPack) {
        try {
          const data = JSON.parse(text);
          if (data && Array.isArray(data.games)) {
            DLC.currentRow = null;
            DLC.registerPack(data);
          } else if (data && data.id) {
            DLC.register(data);
          } else throw new Error('不是有效的 DLC 包（缺少 games 或 id）');
        } catch (err) {
          alert('DLC 包导入失败（' + file.name + '）：' + err.message);
        }
      } else {
        let row = null;
        if (firstHtml && DLC.currentRow) {
          row = DLC.currentRow;
        } else if (firstHtml) {
          const last = DLC.rows[DLC.rows.length - 1];
          if (last && last.games.length === 0) {
            row = last;
          }
        }
        firstHtml = false;
        if (!row) {
          row = { title: file.name.replace(/\.[^.]+$/, ''), games: [] };
          DLC.rows.push(row);
        }
        row.title = file.name.replace(/\.[^.]+$/, '');
        DLC.currentRow = row;
        try { injectDlcContent(text, file.name); }
        catch (err) { alert('DLC 导入失败（' + file.name + '）：' + err.message); }
        DLC.currentRow = null;
      }

      ensureDlcTrailingRow();
      renderDlcRows();
    }
  };

  /* ---------- 服务器 DLC（HTTP 下直接按目录加载，无需打包） ---------- */
  function routeAfterServerDlcs(){
    const routeId = getRoute();
    if (routeId && routeId.indexOf('dlc_') === 0 && currentRouteId !== routeId) route();
  }

  async function loadServerDlcs(){
    if (location.protocol === 'file:') {
      serverDlcsLoaded = true;
      routeAfterServerDlcs();
      return;
    }
    let index = null;
    try {
      const res = await fetch('dlc/index.json', {cache: 'no-store'});
      if (!res.ok) {
        serverDlcsLoaded = true;
        routeAfterServerDlcs();
        return;
      }
      index = await res.json();
    } catch (err) {
      serverDlcsLoaded = true;
      routeAfterServerDlcs();
      return;
    }
    const packs = Array.isArray(index) ? index : (index && (index.packs || index.dlcs)) || [];
    for (const item of packs) {
      const packId = typeof item === 'string' ? item : (item && item.id);
      if (!packId || DLC.getPack(packId)) continue;
      const base = (item && item.base) ? item.base : 'dlc/' + packId;
      try {
        const res = await fetch(base.replace(/\/+$/, '') + '/dlc.json', {cache: 'no-store'});
        if (!res.ok) continue;
        const meta = await res.json();
        DLC.registerPack(Object.assign({}, meta, {id: meta.id || packId, base}));
      } catch (err) {
        console.warn('DLC 包加载失败：' + packId, err);
      }
    }
    serverDlcsLoaded = true;
    ensureDlcTrailingRow();
    renderDlcRows();
    routeAfterServerDlcs();
  }

  /* ---------- 存档/读档 ---------- */
  function canSaveCurrent(){
    if (!currentInstance || typeof currentInstance.getState !== 'function') return false;
    if (typeof currentInstance.canSave === 'function' && !currentInstance.canSave()) return false;
    return true;
  }

  function currentState(){
    if (!canSaveCurrent()) return null;
    try { return currentInstance.getState(); }
    catch (err) { console.error(err); return null; }
  }

  function waitForRoute(routeId, timeout){
    timeout = timeout || 5000;
    return new Promise((resolve, reject) => {
      const start = Date.now();
      (function tick(){
        if (currentRouteId === routeId && !loading) return resolve();
        if (Date.now() - start > timeout) return reject(new Error('游戏加载超时'));
        setTimeout(tick, 20);
      })();
    });
  }

  async function loadState(state){
    if (!state || !state.game) { alert('无效的棋局文件'); return; }
    const raw = String(state.game).replace(/^dlc_/, '');
    const isDlc = !!findDlc(raw);
    const base = findBase(raw);
    if (!base && !isDlc) { alert('未知的游戏类型：' + state.game); return; }

    const routeId = isDlc ? 'dlc_' + raw : raw;
    if (currentRouteId !== routeId) location.hash = '/' + routeId;
    if (currentRouteId !== routeId || loading) {
      try { await waitForRoute(routeId); }
      catch (err) { alert('无法恢复棋局：' + err.message); return; }
    }
    if (!currentInstance || typeof currentInstance.setState !== 'function') {
      alert('该游戏不支持恢复棋局');
      return;
    }
    currentInstance.setState(state);
  }

  document.getElementById('saveBtn').onclick = (e) => {
    e.stopPropagation();
    if (currentInstance && typeof currentInstance.canSave === 'function' && !currentInstance.canSave()) {
      alert('当前状态无法保存（如升变中），请先完成升变');
      saveDropdown.classList.remove('open');
      return;
    }
    saveDropdown.classList.toggle('open');
    loadDropdown.classList.remove('open');
  };

  document.getElementById('loadBtn').onclick = (e) => {
    e.stopPropagation();
    loadDropdown.classList.toggle('open');
    saveDropdown.classList.remove('open');
  };

  document.addEventListener('click', () => closeDropdowns());

  document.getElementById('saveLocal').onclick = () => {
    const state = currentState();
    if (!state) {
      alert(currentInstance ? '当前状态无法保存（如升变中）' : '当前没有正在进行的棋局');
      return;
    }
    const blob = new Blob([JSON.stringify(state, null, 2)], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = '棋局_' + state.game + '_' + new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-') + '.json';
    a.click();
    URL.revokeObjectURL(url);
    saveDropdown.classList.remove('open');
  };

  document.getElementById('saveBrowser').onclick = () => {
    const state = currentState();
    if (!state) {
      alert(currentInstance ? '当前状态无法保存（如升变中）' : '当前没有正在进行的棋局');
      return;
    }
    try {
      localStorage.setItem('qile_saved_game', JSON.stringify(state));
      alert('已保存到浏览器缓存');
    } catch (err) {
      alert('浏览器缓存不可用：' + err.message);
    }
    saveDropdown.classList.remove('open');
  };

  document.getElementById('loadLocal').onclick = () => {
    document.getElementById('fileInput').click();
    loadDropdown.classList.remove('open');
  };

  document.getElementById('fileInput').onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try { loadState(JSON.parse(ev.target.result)); }
      catch (err) { alert('文件解析失败：' + err.message); }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  document.getElementById('loadBrowser').onclick = () => {
    let raw = null;
    try { raw = localStorage.getItem('qile_saved_game'); }
    catch (err) { alert('浏览器缓存不可用：' + err.message); return; }
    if (!raw) { alert('浏览器中没有保存的棋局'); return; }
    try { loadState(JSON.parse(raw)); }
    catch (err) { alert('读取失败：' + err.message); }
    loadDropdown.classList.remove('open');
  };

  /* ---------- BGM ---------- */
  bgmBtn.onclick = function(){
    if (bgmPlaying) {
      bgmAudio.pause();
      bgmBtn.textContent = '🎵 BGM 关';
      bgmPlaying = false;
    } else {
      bgmAudio.play().then(() => {
        bgmBtn.textContent = '🎵 BGM 开';
        bgmPlaying = true;
      }).catch(() => {
        bgmBtn.textContent = '🎵 BGM 关';
        bgmPlaying = false;
      });
    }
  };

  /* ---------- 启动 ---------- */
  window.addEventListener('hashchange', route);
  homeBtn.onclick = goHome;
  DLC.onChange = function(){ ensureDlcTrailingRow(); renderDlcRows(); };

  ensureDlcTrailingRow();
  renderEntries();
  renderDlcRows();
  route();
  loadServerDlcs();
})();
