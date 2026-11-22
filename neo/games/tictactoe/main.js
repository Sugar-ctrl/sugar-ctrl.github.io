/* tictactoe */
(function(){
  const { drawCrossLines, addAxisLabels, renderLog } = window.GameCommon;

/* ③ 井字棋 */
function init(container){
  let board=Array.from({length:3},()=>Array(3).fill(null));
  let cur='X',over=false,winner=null,history=[],winLine=[];
  let log=[];
  container.innerHTML=`
  <div class="game-page active">
    <div class="game-head"><div class="game-title">❌ 井字棋 · 3×3 格子</div></div>
    <div class="game-body">
      <div class="sidebar">
        <div class="panel"><h4>规则</h4><div class="rule-text">X先O后，在格子里落子。横竖斜连成三子获胜。</div></div>
        <div class="panel"><h4>状态</h4><div class="status-text" id="tttStatus">❌ X 走棋</div></div>
        <div class="panel"><h4>日志</h4><div class="naval-log" id="tttLog"></div></div>
        <div class="panel"><h4>功能</h4><div class="actions">
          <button class="act" id="tttResign">🏳️ 投降</button>
          <button class="act" id="tttSettle">📊 结算</button>
          <button class="act" id="tttUndo">↩️ 悔棋</button>
          <button class="act" id="tttRestart">🔄 重开</button>
        </div></div>
      </div>
      <div class="board-wrap" id="tttWrap"></div>
    </div>
  </div>`;
  const wrap=document.getElementById('tttWrap'),statusEl=document.getElementById('tttStatus');
  function render(){
    const b=document.createElement('div');b.className='ttt-board';
    for(let r=0;r<3;r++)for(let c=0;c<3;c++){
      const cell=document.createElement('div');cell.className='ttt-cell';
      if(board[r][c]==='X'){cell.textContent='❌';cell.classList.add('x');}
      else if(board[r][c]==='O'){cell.textContent='⭕';cell.classList.add('o');}
      if(winLine.some(([wr,wc])=>wr===r&&wc===c))cell.classList.add('win');
      cell.onclick=()=>place(r,c);b.appendChild(cell);
    }
    wrap.innerHTML='';wrap.appendChild(b);
    statusEl.textContent=over?('🏆 '+(winner||'结束')):(cur==='X'?'❌ X 走棋':'⭕ O 走棋');
    renderLog('tttLog',log);
  }
  function place(r,c){
    if(over||board[r][c])return;
    history.push({board:board.map(x=>x.slice()),cur,over,winner,winLine:[...winLine],log:log.slice()});
    board[r][c]=cur;
    log.push(`${cur==='X'?'❌ X':'⭕ O'} (${r+1},${c+1})`);
    const line=check();
    if(line.length){over=true;winner=cur==='X'?'X 获胜':'O 获胜';winLine=line;log.push('🏆 '+winner);}
    else if(board.flat().every(v=>v)){over=true;winner='平局';log.push('平局');}
    else cur=cur==='X'?'O':'X';
    render();
  }
  function check(){
    for(let i=0;i<3;i++){
      if(board[i][0]&&board[i][0]===board[i][1]&&board[i][1]===board[i][2])return[[i,0],[i,1],[i,2]];
      if(board[0][i]&&board[0][i]===board[1][i]&&board[1][i]===board[2][i])return[[0,i],[1,i],[2,i]];
    }
    if(board[0][0]&&board[0][0]===board[1][1]&&board[1][1]===board[2][2])return[[0,0],[1,1],[2,2]];
    if(board[0][2]&&board[0][2]===board[1][1]&&board[1][1]===board[2][0])return[[0,2],[1,1],[2,0]];
    return[];
  }
  document.getElementById('tttResign').onclick=()=>{if(over)return;over=true;winner=cur==='X'?'O 胜(X投降)':'X 胜(O投降)';log.push('🏳️ '+winner);render();};
  document.getElementById('tttSettle').onclick=()=>{if(over)return;over=true;winner='结算：未分胜负';log.push('📊 结算');render();};
  document.getElementById('tttUndo').onclick=()=>{if(!history.length)return;const s=history.pop();board=s.board;cur=s.cur;over=s.over;winner=s.winner;winLine=s.winLine;log=s.log;render();};
  document.getElementById('tttRestart').onclick=()=>{board=Array.from({length:3},()=>Array(3).fill(null));cur='X';over=false;winner=null;winLine=[];history=[];log=[];render();};
  const getState =()=>({game:'tictactoe',board,cur,over,winner,winLine,log});
  const setState =(s)=>{board=s.board;cur=s.cur;over=s.over;winner=s.winner;winLine=s.winLine||[];log=s.log||[];history=[];render();};
  render();
  return { getState, setState };
}

  window.__games = window.__games || {};
  window.__games['tictactoe'] = { init };
})();
