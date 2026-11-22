/* othello */
(function(){
  const { drawCrossLines, addAxisLabels, renderLog } = window.GameCommon;

/* ⑤ 黑白棋 */
function init(container){
  const SIZE=8;
  let board=Array.from({length:SIZE},()=>Array(SIZE).fill(null));
  board[3][3]='white';board[3][4]='black';
  board[4][3]='black';board[4][4]='white';
  let cur='black',over=false,winner=null,history=[];
  let log=[];
  container.innerHTML=`
  <div class="game-page active">
    <div class="game-head"><div class="game-title">⚫ 黑白棋 · 8×8 翻转</div></div>
    <div class="game-body">
      <div class="sidebar">
        <div class="panel"><h4>规则</h4><div class="rule-text">黑先白后。落子后, 在任意方向上夹住对方棋子(两端为己方), 被夹住的对方棋子翻转为己方。无子可下时跳过。棋盘下满或双方都无子可下时, 棋子多者获胜。</div></div>
        <div class="panel"><h4>状态</h4><div class="status-text" id="otStatus">⚫ 黑方走棋</div></div>
        <div class="panel"><h4>日志</h4><div class="naval-log" id="otLog"></div></div>
        <div class="panel"><h4>功能</h4><div class="actions">
          <button class="act" id="otResign">🏳️ 投降</button>
          <button class="act" id="otSettle">📊 结算</button>
          <button class="act" id="otUndo">↩️ 悔棋</button>
          <button class="act" id="otRestart">🔄 重开</button>
        </div></div>
      </div>
      <div class="board-wrap" id="otWrap"></div>
    </div>
  </div>`;
  const wrap=document.getElementById('otWrap'),statusEl=document.getElementById('otStatus');
  const DIRS=[[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
  function getFlips(r,c,color){
    if(board[r][c])return[];
    const opp=color==='black'?'white':'black';
    const flips=[];
    for(const[dr,dc]of DIRS){
      const line=[];
      let nr=r+dr,nc=c+dc;
      while(nr>=0&&nr<SIZE&&nc>=0&&nc<SIZE&&board[nr][nc]===opp){
        line.push([nr,nc]);nr+=dr;nc+=dc;
      }
      if(line.length>0&&nr>=0&&nr<SIZE&&nc>=0&&nc<SIZE&&board[nr][nc]===color)flips.push(...line);
    }
    return flips;
  }
  function validMoves(color){
    const moves=[];
    for(let r=0;r<SIZE;r++)for(let c=0;c<SIZE;c++){
      if(getFlips(r,c,color).length>0)moves.push([r,c]);
    }
    return moves;
  }
  function render(){
    const b=document.createElement('div');b.className='othello-board';
    const valids=validMoves(cur);
    for(let r=0;r<SIZE;r++)for(let c=0;c<SIZE;c++){
      const cell=document.createElement('div');cell.className='othello-cell';
      if(valids.some(([vr,vc])=>vr===r&&vc===c))cell.classList.add('valid');
      const v=board[r][c];
      if(v){const disc=document.createElement('div');disc.className='othello-disc '+v;cell.appendChild(disc);}
      cell.onclick=()=>place(r,c);
      b.appendChild(cell);
    }
    wrap.innerHTML='';wrap.appendChild(b);
    let blackCount=0,whiteCount=0;
    for(let r=0;r<SIZE;r++)for(let c=0;c<SIZE;c++){
      if(board[r][c]==='black')blackCount++;else if(board[r][c]==='white')whiteCount++;
    }
    if(over)statusEl.textContent='🏆 '+(winner||'结束');
    else statusEl.textContent=(cur==='black'?'⚫ 黑方走棋':'⚪ 白方走棋')+` (黑${blackCount} 白${whiteCount})`;
    renderLog('otLog',log);
  }
  function place(r,c){
    if(over)return;
    const flips=getFlips(r,c,cur);
    if(flips.length===0)return;
    history.push({board:board.map(row=>row.slice()),cur,over,winner,log:log.slice()});
    board[r][c]=cur;
    for(const[fr,fc]of flips)board[fr][fc]=cur;
    log.push(`${cur==='black'?'⚫ 黑方':'⚪ 白方'} (${r+1},${c+1}) 翻${flips.length}子`);
    const nextColor=cur==='black'?'white':'black';
    if(validMoves(nextColor).length===0){
      if(validMoves(cur).length===0){
        over=true;
        let bc=0,wc=0;
        for(let rr=0;rr<SIZE;rr++)for(let cc=0;cc<SIZE;cc++){
          if(board[rr][cc]==='black')bc++;else if(board[rr][cc]==='white')wc++;
        }
        if(bc>wc)winner=`黑方获胜(黑${bc} vs 白${wc})`;
        else if(wc>bc)winner=`白方获胜(黑${bc} vs 白${wc})`;
        else winner=`平局(双方各${bc})`;
        log.push('🏆 '+winner);
        render();return;
      }
      log.push(`${nextColor==='black'?'⚫ 黑方':'⚪ 白方'} 无子可下, 跳过`);
      render();return;
    }
    cur=nextColor;
    render();
  }
  document.getElementById('otResign').onclick=()=>{if(over)return;over=true;winner=cur==='black'?'白方胜(黑投降)':'黑方胜(白投降)';log.push('🏳️ '+winner);render();};
  document.getElementById('otSettle').onclick=()=>{
    if(over)return;
    let bc=0,wc=0;
    for(let r=0;r<SIZE;r++)for(let c=0;c<SIZE;c++){
      if(board[r][c]==='black')bc++;else if(board[r][c]==='white')wc++;
    }
    over=true;
    if(bc>wc)winner=`黑方获胜(黑${bc} vs 白${wc})`;
    else if(wc>bc)winner=`白方获胜(黑${bc} vs 白${wc})`;
    else winner=`平局(双方各${bc})`;
    log.push('📊 '+winner);render();
  };
  document.getElementById('otUndo').onclick=()=>{if(!history.length)return;const s=history.pop();board=s.board;cur=s.cur;over=s.over;winner=s.winner;log=s.log;render();};
  document.getElementById('otRestart').onclick=()=>{
    board=Array.from({length:SIZE},()=>Array(SIZE).fill(null));
    board[3][3]='white';board[3][4]='black';
    board[4][3]='black';board[4][4]='white';
    cur='black';over=false;winner=null;history=[];log=[];
    render();
  };
  const getState =()=>({game:'othello',board,cur,over,winner,log});
  const setState =(s)=>{board=s.board;cur=s.cur;over=s.over;winner=s.winner;log=s.log||[];history=[];render();};
  render();
  return { getState, setState };
}

  window.__games = window.__games || {};
  window.__games['othello'] = { init };
})();
