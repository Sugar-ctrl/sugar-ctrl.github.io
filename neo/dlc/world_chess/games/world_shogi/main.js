/* 世界象棋 DLC · 日本将棋 */
(function(){
  const { cloneBoard, renderLog, layout, bindActions, renderCrossBoard, renderGridBoard, makeGridVariant } = window.GameCommon;

  function initShogi(container) {
    const ROWS = 9, COLS = 9;
    const PROMOTE = { '歩':'と', '香':'成香', '桂':'成桂', '銀':'成銀', '角':'馬', '飛':'龍' };
    const PROMOTED = ['と','成香','成桂','成銀','馬','龍'];
    let board, cur, selected, moves, over, winner, log, hand, history;

    function init() {
      board = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
      const back = ['香','桂','銀','金','王','金','銀','桂','香'];
      for (let c = 0; c < 9; c++) {
        board[0][c] = { type: back[c], owner: 'gote' };
        board[8][c] = { type: back[c], owner: 'sente' };
      }
      for (let c = 0; c < 9; c++) {
        board[2][c] = { type: '歩', owner: 'gote' };
        board[6][c] = { type: '歩', owner: 'sente' };
      }
      cur = 'sente'; selected = null; moves = []; over = false; winner = null;
      log = []; hand = { sente: {}, gote: {} }; history = [];
    }
    init();

    const fwd = o => o === 'sente' ? -1 : 1;
    const inBoard = (r,c) => r>=0&&r<ROWS&&c>=0&&c<COLS;

    function getMoves(r,c) {
      const p = board[r][c]; if (!p) return [];
      const { type, owner } = p; const f = fwd(owner); const res = [];
      const add = (nr,nc) => { if (!inBoard(nr,nc)) return; const t = board[nr][nc]; if (!t || t.owner !== owner) res.push([nr,nc]); };
      const slide = (dr,dc) => { let nr=r+dr, nc=c+dc; while (inBoard(nr,nc)) { const t = board[nr][nc]; if (!t) res.push([nr,nc]); else { if (t.owner !== owner) res.push([nr,nc]); break; } nr+=dr; nc+=dc; } };
      switch (type) {
        case '歩': add(r+f,c); break;
        case '香': slide(f,0); break;
        case '桂': add(r+2*f,c-1); add(r+2*f,c+1); break;
        case '銀': add(r+f,c-1); add(r+f,c); add(r+f,c+1); add(r-f,c-1); add(r-f,c+1); break;
        case '金': case 'と': case '成香': case '成桂': case '成銀':
          add(r+f,c-1); add(r+f,c); add(r+f,c+1); add(r,c-1); add(r,c+1); add(r-f,c); break;
        case '角': slide(1,1); slide(1,-1); slide(-1,1); slide(-1,-1); break;
        case '飛': slide(1,0); slide(-1,0); slide(0,1); slide(0,-1); break;
        case '王': for (let dr=-1;dr<=1;dr++) for (let dc=-1;dc<=1;dc++) { if (dr===0&&dc===0) continue; add(r+dr,c+dc); } break;
        case '馬': slide(1,1); slide(1,-1); slide(-1,1); slide(-1,-1); add(r+1,c); add(r-1,c); add(r,c+1); add(r,c-1); break;
        case '龍': slide(1,0); slide(-1,0); slide(0,1); slide(0,-1); add(r+1,c+1); add(r+1,c-1); add(r-1,c+1); add(r-1,c-1); break;
      }
      return res;
    }
    function canPromote(r,c,owner) { return owner==='sente'?r<=2:r>=6; }
    function reversePromote(t) { return { 'と':'歩','成香':'香','成桂':'桂','成銀':'銀','馬':'角','龍':'飛' }[t] || t; }
    function inCheck(owner) {
      let king = null;
      for (let r=0;r<ROWS;r++) for (let c=0;c<COLS;c++) { const p=board[r][c]; if (p&&p.owner===owner&&p.type==='王') { king=[r,c]; break; } }
      if (!king) return false;
      const opp = owner==='sente'?'gote':'sente';
      for (let r=0;r<ROWS;r++) for (let c=0;c<COLS;c++) { const p=board[r][c]; if (p&&p.owner===opp&&getMoves(r,c).some(([mr,mc])=>mr===king[0]&&mc===king[1])) return true; }
      return false;
    }
    function isCheckmateAfterDrop(simBoard, owner) {
      const opp = owner==='sente'?'gote':'sente';
      const saved = board; board = simBoard;
      const checked = inCheck(opp);
      let hasEscape = false;
      if (checked) {
        for (let r=0;r<ROWS&&!hasEscape;r++) for (let c=0;c<COLS&&!hasEscape;c++) {
          const p = simBoard[r][c];
          if (p && p.owner === opp) {
            const ms = getMoves(r,c);
            for (const [mr,mc] of ms) {
              const tmp = simBoard[mr][mc];
              simBoard[mr][mc] = p; simBoard[r][c] = null;
              if (!inCheck(opp)) hasEscape = true;
              simBoard[r][c] = p; simBoard[mr][mc] = tmp;
              if (hasEscape) break;
            }
          }
        }
      }
      board = saved;
      return checked && !hasEscape;
    }
    function getDropMoves(owner, type) {
      const res = [];
      for (let r=0;r<ROWS;r++) for (let c=0;c<COLS;c++) {
        if (board[r][c]) continue;
        if (type==='歩'||type==='香') { if (owner==='sente'&&r===0) continue; if (owner==='gote'&&r===8) continue; }
        if (type==='桂') { if (owner==='sente'&&r<=1) continue; if (owner==='gote'&&r>=7) continue; }
        if (type === '歩') {
          let has = false;
          for (let rr=0; rr<ROWS; rr++) { const p = board[rr][c]; if (p && p.owner === owner && p.type === '歩') { has = true; break; } }
          if (has) continue;
          const simBoard = cloneBoard(board);
          simBoard[r][c] = { type: '歩', owner };
          if (isCheckmateAfterDrop(simBoard, owner)) continue;
        }
        res.push([r,c]);
      }
      return res;
    }

    container.innerHTML = layout(
      '🎴 日本将棋 · 9×9 · 交叉点',
      '先手（下）先走，后手（上）棋子方向相反。<br>进入敌阵自动升变。<br>吃掉对方棋子变为持驹，可打入空格。<br><b>二步禁止</b>：同一列不能有两个己方未升变的步。<br><b>打步诘禁止</b>：打入步直接将死对方属于犯规。<br>被将军时必须应将。',
      'shogiBoard', 'shogiStatus', 'shogiLog', 'shogiActions',
      `<div class="panel"><h4>先手持驹</h4><div id="shogiHandS" class="shogi-hand-wrap sente"></div></div>
       <div class="panel"><h4>后手持驹</h4><div id="shogiHandG" class="shogi-hand-wrap gote"></div></div>`
    );

    const boardEl = container.querySelector('#shogiBoard');
    const statusEl = container.querySelector('#shogiStatus');
    const logEl = container.querySelector('#shogiLog');

    function renderHand() {
      ['sente','gote'].forEach(owner => {
        const el = container.querySelector('#shogiHand' + (owner === 'sente' ? 'S' : 'G'));
        el.innerHTML = '';
        const types = Object.keys(hand[owner]).filter(t => hand[owner][t] > 0);
        if (!types.length) { el.innerHTML = '<span style="color:#aaa;font-size:.8rem;">（无）</span>'; return; }
        types.forEach(t => {
          const d = document.createElement('div');
          d.className = 'shogi-hand-p ' + owner;
          d.textContent = t;
          const cnt = document.createElement('span'); cnt.className = 'shogi-hand-cnt'; cnt.textContent = hand[owner][t]; d.appendChild(cnt);
          if (selected && selected.hand && selected.owner === owner && selected.type === t) d.classList.add('sel');
          d.onclick = () => {
            if (over || cur !== owner) return;
            if (selected && selected.hand && selected.type === t) { selected = null; moves = []; }
            else { selected = { hand: true, owner, type: t }; moves = getDropMoves(owner, t); }
            render();
          };
          el.appendChild(d);
        });
      });
    }

    function render() {
      renderCrossBoard(boardEl, {
        rows: ROWS, cols: COLS, cellSize: 50, pad: 34,
        board, selected, moves, onClick: clickCell,
        pieceClassFn: p => 'shogi-p ' + p.owner + (PROMOTED.includes(p.type) ? ' promoted' : ''),
        pieceContentFn: p => p.type
      });
      renderHand();
      statusEl.textContent = over ? ('🏆 ' + (winner || '结束')) : (cur==='sente'?'⬛ 先手走棋':'⬜ 后手走棋') + (inCheck(cur) ? ' 【王手！】' : '');
      renderLog(logEl, log);
    }

    function clickCell(r,c) {
      if (over) return;
      if (selected && selected.hand) {
        if (moves.some(([mr,mc])=>mr===r&&mc===c)) {
          history.push({ board: cloneBoard(board), cur, over, winner, hand: JSON.parse(JSON.stringify(hand)), log: log.slice() });
          board[r][c] = { type: selected.type, owner: cur };
          hand[cur][selected.type]--; if (hand[cur][selected.type] <= 0) delete hand[cur][selected.type];
          log.push(`${cur==='sente'?'⬛':'⬜'} 打入 ${selected.type} (${r+1},${c+1})`);
          selected = null; moves = []; endTurn(); return;
        }
        selected = null; moves = []; render(); return;
      }
      if (selected && !selected.hand) {
        const [sr,sc] = [selected.r, selected.c];
        if (moves.some(([mr,mc])=>mr===r&&mc===c)) {
          history.push({ board: cloneBoard(board), cur, over, winner, hand: JSON.parse(JSON.stringify(hand)), log: log.slice() });
          const moving = board[sr][sc]; const captured = board[r][c];
          let newType = moving.type;
          if (canPromote(r,c,moving.owner) && !PROMOTED.includes(moving.type)) newType = PROMOTE[moving.type] || moving.type;
          board[r][c] = { type: newType, owner: moving.owner }; board[sr][sc] = null;
          let text = `${moving.owner==='sente'?'⬛':'⬜'} ${moving.type} (${sr+1},${sc+1})→(${r+1},${c+1})`;
          if (newType !== moving.type) text += ` 升变为 ${newType}`;
          if (captured) {
            text += ` 吃 ${captured.type}`;
            const base = reversePromote(captured.type);
            hand[moving.owner][base] = (hand[moving.owner][base] || 0) + 1;
            if (captured.type === '王') { over = true; winner = moving.owner==='sente'?'先手胜':'后手胜'; log.push(text); log.push('🏆 '+winner); render(); return; }
          }
          log.push(text); selected = null; moves = []; endTurn(); return;
        }
        selected = null; moves = []; render();
      }
      const p = board[r][c];
      if (p && p.owner === cur) { selected = { r, c }; moves = getMoves(r,c); render(); }
    }
    function endTurn() {
      if (over) { render(); return; }
      cur = cur==='sente'?'gote':'sente';
      if (inCheck(cur)) log.push(`${cur==='sente'?'⬛':'⬜'} 被王手！`);
      render();
    }

    bindActions(container, 'shogiActions', {
      resign: () => { if (over) return; over = true; winner = cur==='sente'?'后手胜(先手投降)':'先手胜(后手投降)'; log.push('🏳️ '+winner); render(); },
      settle: () => { if (over) return; over = true; winner = '结算：未分胜负'; log.push('📊 结算'); render(); },
      undo: () => { if (!history.length) return; const s = history.pop(); board=s.board; cur=s.cur; over=s.over; winner=s.winner; hand=s.hand; log=s.log; selected=null; moves=[]; render(); },
      restart: () => { init(); render(); }
    });

    render();
    return { canSave: () => false };
  }

  window.__games = window.__games || {};
  window.__games['world_shogi'] = { init: initShogi };
})();
