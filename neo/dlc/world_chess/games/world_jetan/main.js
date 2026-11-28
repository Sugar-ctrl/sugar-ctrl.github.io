/* 世界象棋 DLC · 西藏象棋 */
(function(){
  const { cloneBoard, renderLog, layout, bindActions, renderCrossBoard, renderGridBoard, makeGridVariant } = window.GameCommon;

  function initJetan(container) {
    const ROWS = 10, COLS = 10;
    let board, cur, selected, moves, over, winner, log, history;
    function init() {
      board = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
      const back = ['车','马','象','王','将','象','马','车'];
      for (let c = 0; c < 8; c++) { board[0][c+1] = { type: back[c], owner: 'p2' }; board[9][c+1] = { type: back[c], owner: 'p1' }; }
      board[0][0] = { type: '狮', owner: 'p2' }; board[0][9] = { type: '虎', owner: 'p2' };
      board[9][0] = { type: '狮', owner: 'p1' }; board[9][9] = { type: '虎', owner: 'p1' };
      for (let c = 0; c < 10; c++) { board[3][c] = { type: '兵', owner: 'p2' }; board[6][c] = { type: '兵', owner: 'p1' }; }
      cur = 'p1'; selected = null; moves = []; over = false; winner = null; log = []; history = [];
    }
    init();
    const fwd = o => o === 'p1' ? -1 : 1;
    const inBoard = (r,c) => r>=0&&r<ROWS&&c>=0&&c<COLS;
    function getMoves(r,c) {
      const p = board[r][c]; if (!p) return [];
      const { type, owner } = p; const f = fwd(owner); const res = [];
      const add = (nr,nc) => { if (!inBoard(nr,nc)) return; const t = board[nr][nc]; if (!t || t.owner !== owner) res.push([nr,nc]); };
      const slide = (dr,dc) => { let nr=r+dr, nc=c+dc; while (inBoard(nr,nc)) { const t = board[nr][nc]; if (!t) res.push([nr,nc]); else { if (t.owner !== owner) res.push([nr,nc]); break; } nr+=dr; nc+=dc; } };
      switch (type) {
        case '车': slide(1,0); slide(-1,0); slide(0,1); slide(0,-1); break;
        case '马': case '狮': case '虎': [[2,1],[2,-1],[-2,1],[-2,-1],[1,2],[1,-2],[-1,2],[-1,-2]].forEach(([dr,dc])=>add(r+dr,c+dc)); break;
        case '象': slide(1,1); slide(1,-1); slide(-1,1); slide(-1,-1); break;
        case '王': [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]].forEach(([dr,dc])=>add(r+dr,c+dc)); break;
        case '将': slide(1,0); slide(-1,0); slide(0,1); slide(0,-1); slide(1,1); slide(1,-1); slide(-1,1); slide(-1,-1); break;
        case '兵': add(r+f,c); add(r+f,c-1); add(r+f,c+1); break;
      }
      return res;
    }
    container.innerHTML = layout('🏔️ 西藏象棋 · 10×10', '<b>狮/虎</b>走法同马；<b>将</b>走法同后；<b>象</b>斜线；<b>王</b>走一格任意方向；<b>兵</b>直走斜吃。', 'jetanBoard', 'jetanStatus', 'jetanLog', 'jetanActions', null);
    const boardEl = container.querySelector('#jetanBoard');
    const statusEl = container.querySelector('#jetanStatus');
    const logEl = container.querySelector('#jetanLog');
    function render() {
      renderGridBoard(boardEl, { board, rows: ROWS, cols: COLS, cellSize: 44, selected, moves, onClick: clickCell,
        gridClass: 'steppe-grid', cellClassFn: (r,c) => 'steppe-cell' + ((r+c)%2===1 ? ' dark' : ''),
        pieceClassFn: p => 'steppe-p ' + p.owner, pieceContentFn: p => p.type });
      statusEl.textContent = over ? ('🏆 ' + (winner || '结束')) : (cur==='p1'?'⚪ 白方走棋':'⚫ 黑方走棋');
      renderLog(logEl, log);
    }
    function clickCell(r,c) {
      if (over) return;
      if (selected) {
        const [sr,sc] = [selected.r, selected.c];
        if (moves.some(([mr,mc])=>mr===r&&mc===c)) {
          history.push({ board: cloneBoard(board), cur, over, winner, log: log.slice() });
          const moving = board[sr][sc]; const captured = board[r][c];
          board[r][c] = moving; board[sr][sc] = null;
          let text = `${moving.owner==='p1'?'⚪':'⚫'} ${moving.type} (${sr+1},${sc+1})→(${r+1},${c+1})`;
          if (captured) { text += ` 吃 ${captured.type}`; if (captured.type==='王') { over=true; winner=moving.owner==='p1'?'白方胜':'黑方胜'; } }
          log.push(text); selected = null; moves = [];
          if (!over) cur = cur==='p1'?'p2':'p1';
          render(); return;
        }
        selected = null; moves = []; render();
      }
      const p = board[r][c];
      if (p && p.owner === cur) { selected = { r, c }; moves = getMoves(r,c); render(); }
    }
    bindActions(container, 'jetanActions', {
      resign: () => { if (over) return; over = true; winner = cur==='p1'?'黑方胜(白投降)':'白方胜(黑投降)'; log.push('🏳️ '+winner); render(); },
      settle: () => { if (over) return; over = true; winner = '结算：未分胜负'; log.push('📊 结算'); render(); },
      undo: () => { if (!history.length) return; const s = history.pop(); board=s.board; cur=s.cur; over=s.over; winner=s.winner; log=s.log; selected=null; moves=[]; render(); },
      restart: () => { init(); render(); }
    });
    render();
    return { canSave: () => false };
  }

  window.__games = window.__games || {};
  window.__games['world_jetan'] = { init: initJetan };
})();
