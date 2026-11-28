/* 世界象棋 DLC · 埃塞俄比亚象棋 */
(function(){
  const { cloneBoard, renderLog, layout, bindActions, renderCrossBoard, renderGridBoard, makeGridVariant } = window.GameCommon;

  function initSenterej(container) {
    const ROWS = 8, COLS = 8;
    let board, cur, selected, moves, over, winner, log, history;
    let phase = 'move';
    let moveCount = { p1: 0, p2: 0 };
    let movePhaseTurn = 'p1';

    function init() {
      board = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
      const back = ['车','马','象','王','士','象','马','车'];
      for (let c = 0; c < 8; c++) { board[0][c] = { type: back[c], owner: 'p2' }; board[7][c] = { type: back[c], owner: 'p1' }; }
      for (let c = 0; c < 8; c++) { board[1][c] = { type: '兵', owner: 'p2' }; board[6][c] = { type: '兵', owner: 'p1' }; }
      cur = 'p1'; selected = null; moves = []; over = false; winner = null; log = []; history = [];
      phase = 'move'; moveCount = { p1: 0, p2: 0 }; movePhaseTurn = 'p1';
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
        case '马': [[2,1],[2,-1],[-2,1],[-2,-1],[1,2],[1,-2],[-1,2],[-1,-2]].forEach(([dr,dc])=>add(r+dr,c+dc)); break;
        case '象': slide(1,1); slide(1,-1); slide(-1,1); slide(-1,-1); break;
        case '王': [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]].forEach(([dr,dc])=>add(r+dr,c+dc)); break;
        case '士': [[1,1],[1,-1],[-1,1],[-1,-1]].forEach(([dr,dc])=>add(r+dr,c+dc)); break;
        case '兵':
          if (!board[r+f]?.[c]) { add(r+f,c); if (r === (owner==='p1'?6:1) && !board[r+2*f]?.[c]) add(r+2*f,c); }
          [[r+f,c-1],[r+f,c+1]].forEach(([nr,nc]) => { if (inBoard(nr,nc) && board[nr][nc] && board[nr][nc].owner !== owner) res.push([nr,nc]); });
          break;
      }
      return res;
    }

    container.innerHTML = layout(
      '🇪🇹 埃塞俄比亚象棋 · 8×8',
      '<b>移动阶段</b>：开局后，先手连续走 2 步，然后后手连续走 2 步，之后进入正常轮换。<br><b>王</b>走一格任意方向；<b>士</b>斜线；<b>象</b>斜线；<b>马</b>走日；<b>车</b>直线；<b>兵</b>直走斜吃。',
      'senterejBoard', 'senterejStatus', 'senterejLog', 'senterejActions', null
    );

    const boardEl = container.querySelector('#senterejBoard');
    const statusEl = container.querySelector('#senterejStatus');
    const logEl = container.querySelector('#senterejLog');

    function render() {
      renderGridBoard(boardEl, {
        board, rows: ROWS, cols: COLS, cellSize: 52, selected, moves, onClick: clickCell,
        gridClass: 'islamic-grid', cellClassFn: (r,c) => 'islamic-cell' + ((r+c)%2===1 ? ' dark' : ''),
        pieceClassFn: p => 'islamic-p ' + p.owner, pieceContentFn: p => p.type
      });
      let phaseText = '';
      if (phase === 'move') {
        phaseText = `移动阶段：${movePhaseTurn==='p1'?'白方':'黑方'}（已走${moveCount[movePhaseTurn]}/2步）`;
      } else {
        phaseText = cur==='p1'?'⚪ 白方走棋':'⚫ 黑方走棋';
      }
      statusEl.textContent = over ? ('🏆 ' + (winner || '结束')) : phaseText;
      renderLog(logEl, log);
    }

    function clickCell(r,c) {
      if (over) return;
      if (selected) {
        const [sr,sc] = [selected.r, selected.c];
        if (moves.some(([mr,mc])=>mr===r&&mc===c)) {
          history.push({ board: cloneBoard(board), cur, over, winner, log: log.slice(), phase, moveCount: {...moveCount}, movePhaseTurn });
          const moving = board[sr][sc]; const captured = board[r][c];
          board[r][c] = moving; board[sr][sc] = null;
          let text = `${moving.owner==='p1'?'⚪':'⚫'} ${moving.type} (${sr+1},${sc+1})→(${r+1},${c+1})`;
          if (captured) { text += ` 吃 ${captured.type}`; if (captured.type==='王') { over = true; winner = moving.owner==='p1'?'白方胜':'黑方胜'; } }
          log.push(text); selected = null; moves = [];
          if (over) { render(); return; }

          if (phase === 'move') {
            moveCount[moving.owner]++;
            if (moveCount[moving.owner] >= 2) {
              if (movePhaseTurn === 'p1') { movePhaseTurn = 'p2'; }
              else { phase = 'play'; log.push('移动阶段结束，进入正常对局！'); }
            }
            cur = movePhaseTurn;
          } else {
            cur = cur==='p1'?'p2':'p1';
          }
          render(); return;
        }
        selected = null; moves = []; render();
      }
      const p = board[r][c];
      if (p && p.owner === cur) { selected = { r, c }; moves = getMoves(r,c); render(); }
    }

    bindActions(container, 'senterejActions', {
      resign: () => { if (over) return; over = true; winner = cur==='p1'?'黑方胜(白投降)':'白方胜(黑投降)'; log.push('🏳️ '+winner); render(); },
      settle: () => { if (over) return; over = true; winner = '结算：未分胜负'; log.push('📊 结算'); render(); },
      undo: () => { if (!history.length) return; const s = history.pop(); board=s.board; cur=s.cur; over=s.over; winner=s.winner; log=s.log; phase=s.phase; moveCount=s.moveCount; movePhaseTurn=s.movePhaseTurn; selected=null; moves=[]; render(); },
      restart: () => { init(); render(); }
    });

    render();
    return { canSave: () => false };
  }

  window.__games = window.__games || {};
  window.__games['world_senterej'] = { init: initSenterej };
})();
