/* 世界象棋 DLC · 朝鲜将棋 */
(function(){
  const { cloneBoard, renderLog, layout, bindActions, renderCrossBoard, renderGridBoard, makeGridVariant } = window.GameCommon;

  function initJanggi(container) {
    const ROWS = 10, COLS = 9;
    let board, cur, selected, moves, over, winner, log, history;
    let phase = 'setup';
    let swapSel = null;

    function init() {
      board = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
      board[9][0] = { type: '车', owner: 'p1' };
      board[9][1] = { type: '马', owner: 'p1' };
      board[9][2] = { type: '象', owner: 'p1' };
      board[9][3] = { type: '士', owner: 'p1' };
      board[9][5] = { type: '士', owner: 'p1' };
      board[9][6] = { type: '象', owner: 'p1' };
      board[9][7] = { type: '马', owner: 'p1' };
      board[9][8] = { type: '车', owner: 'p1' };
      board[9][4] = { type: '汉', owner: 'p1' };
      board[7][1] = { type: '包', owner: 'p1' };
      board[7][7] = { type: '包', owner: 'p1' };
      for (let c = 0; c < 9; c += 2) board[6][c] = { type: '兵', owner: 'p1' };
      board[0][0] = { type: '车', owner: 'p2' };
      board[0][1] = { type: '马', owner: 'p2' };
      board[0][2] = { type: '象', owner: 'p2' };
      board[0][3] = { type: '士', owner: 'p2' };
      board[0][5] = { type: '士', owner: 'p2' };
      board[0][6] = { type: '象', owner: 'p2' };
      board[0][7] = { type: '马', owner: 'p2' };
      board[0][8] = { type: '车', owner: 'p2' };
      board[0][4] = { type: '楚', owner: 'p2' };
      board[2][1] = { type: '包', owner: 'p2' };
      board[2][7] = { type: '包', owner: 'p2' };
      for (let c = 0; c < 9; c += 2) board[3][c] = { type: '卒', owner: 'p2' };
      cur = 'p1'; selected = null; moves = []; over = false; winner = null; log = []; history = [];
      phase = 'setup'; swapSel = null;
    }
    init();

    const fwd = o => o === 'p1' ? -1 : 1;
    const inBoard = (r,c) => r>=0&&r<ROWS&&c>=0&&c<COLS;
    const inPalace = (r,c,owner) => owner==='p1' ? (r>=7&&r<=9&&c>=3&&c<=5) : (r>=0&&r<=2&&c>=3&&c<=5);

    function getMoves(r,c) {
      const p = board[r][c]; if (!p) return [];
      const { type, owner } = p; const f = fwd(owner); const res = [];
      const add = (nr,nc) => { if (!inBoard(nr,nc)) return; const t = board[nr][nc]; if (!t || t.owner !== owner) res.push([nr,nc]); };
      const slide = (dr,dc) => { let nr=r+dr, nc=c+dc; while (inBoard(nr,nc)) { const t = board[nr][nc]; if (!t) res.push([nr,nc]); else { if (t.owner !== owner) res.push([nr,nc]); break; } nr+=dr; nc+=dc; } };
      switch (type) {
        case '车': slide(1,0); slide(-1,0); slide(0,1); slide(0,-1); break;
        case '马':
          [[2,1,1,0],[2,-1,1,0],[-2,1,-1,0],[-2,-1,-1,0],[1,2,0,1],[1,-2,0,1],[-1,2,0,1],[-1,-2,0,1]].forEach(([dr,dc,br,bc]) => {
            if (inBoard(r+dr,c+dc) && !board[r+br]?.[c+bc]) add(r+dr,c+dc);
          });
          break;
        case '象':
          [[2,2,1,1],[2,-2,1,-1],[-2,2,-1,1],[-2,-2,-1,-1]].forEach(([dr,dc,br,bc]) => {
            const nr=r+dr, nc=c+dc;
            if (inBoard(nr,nc) && !board[r+br][c+bc]) {
              if (owner==='p1' && nr<5) return;
              if (owner==='p2' && nr>4) return;
              add(nr,nc);
            }
          });
          break;
        case '士':
          [[1,1],[1,-1],[-1,1],[-1,-1],[1,0],[-1,0],[0,1],[0,-1]].forEach(([dr,dc]) => {
            const nr=r+dr, nc=c+dc;
            if (inBoard(nr,nc) && inPalace(nr,nc,owner)) add(nr,nc);
          }); break;
        case '汉': case '楚':
          [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]].forEach(([dr,dc]) => {
            const nr=r+dr, nc=c+dc;
            if (inBoard(nr,nc) && inPalace(nr,nc,owner)) add(nr,nc);
          });
          break;
        case '包':
          [[1,0],[-1,0],[0,1],[0,-1]].forEach(([dr,dc]) => {
            let nr=r+dr, nc=c+dc, jumped=false, jumpType=null;
            while (inBoard(nr,nc)) {
              const t = board[nr][nc];
              if (!jumped) { if (!t) res.push([nr,nc]); else { jumped = true; jumpType = t.type; } }
              else { if (t) { if (t.owner !== owner && jumpType !== '包' && t.type !== '包') res.push([nr,nc]); break; } }
              nr+=dr; nc+=dc;
            }
          });
          break;
        case '兵': case '卒':
          add(r+f,c);
          add(r,c-1); add(r,c+1);
          if (inPalace(r,c,owner)) {
            if (inPalace(r+f,c-1,owner)) add(r+f,c-1);
            if (inPalace(r+f,c+1,owner)) add(r+f,c+1);
          }
          break;
      }
      return res;
    }

    container.innerHTML = layout(
      '🇰🇷 朝鲜将棋 · 10×9 · 交叉点',
      '<b>摆位阶段</b>：点击己方马或象选中，再点击<b>同一侧</b>的另一个马/象互换。<br><b>汉/楚</b>：九宫内走直线或斜线。<br><b>士</b>：九宫内走直线或斜线。<br><b>象</b>：走"用"字（斜二直一），不过河。<br><b>马</b>：走日，蹩马腿。<br><b>包</b>：必须隔子走/吃，不能隔包，不能吃包。<br><b>兵/卒</b>：可前进或横走，九宫内可斜走。<br>将帅不能照面。',
      'janggiBoard', 'janggiStatus', 'janggiLog', 'janggiActions',
      `<div class="panel" id="janggiSetupPanel"><h4>摆位阶段</h4><div style="font-size:.8rem;color:#6b5636;line-height:1.6;">
        点击己方<b>马</b>或<b>象</b>选中（高亮），再点击<b>同一侧</b>的另一个<b>马</b>或<b>象</b>互换。<br>
        红方（下方）：左马↔左象，右象↔右马。<br>
        黑方（上方）：左马↔左象，右象↔右马。
      </div><div class="actions" style="margin-top:8px;"><button class="act" id="janggiStartBtn">✅ 开始对局</button></div></div>`
    );

    const boardEl = container.querySelector('#janggiBoard');
    const statusEl = container.querySelector('#janggiStatus');
    const logEl = container.querySelector('#janggiLog');

    function canSwap(r1, c1, r2, c2) {
      if (r1 === r2 && c1 === c2) return false;
      const p1 = board[r1][c1], p2 = board[r2][c2];
      if (!p1 || !p2) return false;
      if (p1.owner !== p2.owner || p1.owner !== cur) return false;
      if (!['马','象'].includes(p1.type) || !['马','象'].includes(p2.type)) return false;
      if (p1.type === p2.type) return false;
      if (r1 !== r2) return false;
      const left1 = c1 < 4, left2 = c2 < 4;
      if (left1 !== left2) return false;
      return Math.abs(c1 - c2) === 1;
    }

    function render() {
      renderCrossBoard(boardEl, {
        rows: ROWS, cols: COLS, cellSize: 44, pad: 32,
        board,
        selected: phase === 'setup' ? swapSel : (selected ? [selected.r, selected.c] : null),
        moves: phase === 'setup' ? [] : moves,
        onClick: phase === 'setup' ? clickSetup : clickCell,
        palaceLines: [[7,3,9,5],[7,5,9,3],[0,3,2,5],[0,5,2,3]],
        pieceClassFn: p => 'janggi-p ' + p.owner,
        pieceContentFn: p => p.type,
        extraCellClassFn: (pt, r, c) => {
          if (phase === 'setup' && swapSel) {
            if (r === swapSel[0] && c === swapSel[1]) pt.classList.add('janggi-swap');
            else {
              const p = board[r][c];
              if (p && p.owner === cur && (p.type === '马' || p.type === '象') && canSwap(swapSel[0], swapSel[1], r, c)) pt.classList.add('janggi-swap');
            }
          }
        }
      });
      statusEl.textContent = over ? ('🏆 ' + (winner || '结束')) :
        phase === 'setup' ? `摆位阶段：${cur==='p1'?'红方':'黑方'}（点击马/象互换）` :
        (cur==='p1'?'🔴 红方走棋':'⚫ 黑方走棋');
      renderLog(logEl, log);
    }

    function clickSetup(r,c) {
      const p = board[r][c];
      if (!swapSel) {
        if (p && p.owner === cur && (p.type === '马' || p.type === '象')) {
          swapSel = [r, c];
          render();
        }
        return;
      }
      if (r === swapSel[0] && c === swapSel[1]) {
        swapSel = null;
        render();
        return;
      }
      if (p && p.owner === cur && (p.type === '马' || p.type === '象') && canSwap(swapSel[0], swapSel[1], r, c)) {
        const tmp = board[swapSel[0]][swapSel[1]];
        board[swapSel[0]][swapSel[1]] = board[r][c];
        board[r][c] = tmp;
        log.push(`${cur==='p1'?'🔴':'⚫'} 马象互换 (${swapSel[0]+1},${swapSel[1]+1}) ↔ (${r+1},${c+1})`);
        swapSel = null;
        render();
        return;
      }
      if (p && p.owner === cur && (p.type === '马' || p.type === '象')) {
        swapSel = [r, c];
        render();
        return;
      }
      swapSel = null;
      render();
    }

    document.getElementById('janggiStartBtn').onclick = () => {
      phase = 'play';
      document.getElementById('janggiSetupPanel').style.display = 'none';
      log.push('摆位完成，开始对局！');
      render();
    };

    function clickCell(r,c) {
      if (over) return;
      if (selected) {
        const [sr,sc] = [selected.r, selected.c];
        if (moves.some(([mr,mc])=>mr===r&&mc===c)) {
          history.push({ board: cloneBoard(board), cur, over, winner, log: log.slice() });
          const moving = board[sr][sc]; const captured = board[r][c];
          board[r][c] = moving; board[sr][sc] = null;
          let text = `${moving.owner==='p1'?'🔴':'⚫'} ${moving.type} (${sr+1},${sc+1})→(${r+1},${c+1})`;
          if (captured) { text += ` 吃 ${captured.type}`; if (captured.type==='汉'||captured.type==='楚') { over = true; winner = moving.owner==='p1'?'红方胜':'黑方胜'; } }
          log.push(text); selected = null; moves = [];
          if (!over) cur = cur==='p1'?'p2':'p1';
          render(); return;
        }
        selected = null; moves = []; render();
      }
      const p = board[r][c];
      if (p && p.owner === cur) { selected = { r, c }; moves = getMoves(r,c); render(); }
    }

    bindActions(container, 'janggiActions', {
      resign: () => { if (over) return; over = true; winner = cur==='p1'?'黑方胜(红投降)':'红方胜(黑投降)'; log.push('🏳️ '+winner); render(); },
      settle: () => { if (over) return; over = true; winner = '结算：未分胜负'; log.push('📊 结算'); render(); },
      undo: () => { if (!history.length) return; const s = history.pop(); board=s.board; cur=s.cur; over=s.over; winner=s.winner; log=s.log; selected=null; moves=[]; render(); },
      restart: () => { init(); document.getElementById('janggiSetupPanel').style.display = ''; render(); }
    });

    render();
    return { canSave: () => false };
  }

  window.__games = window.__games || {};
  window.__games['world_janggi'] = { init: initJanggi };
})();
