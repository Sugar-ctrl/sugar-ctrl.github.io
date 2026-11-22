/* gomoku */
(function(){
  const { drawCrossLines, addAxisLabels, renderLog } = window.GameCommon;

/* ① 五子棋 */
function init(container){
  const SIZE=15,CELL=36,PAD=36;
  let board=Array.from({length:SIZE},()=>Array(SIZE).fill(null));
  let cur='black',over=false,winner=null,history=[];
  let log=[];
  container.innerHTML=`
  <div class="game-page active">
    <div class="game-head"><div class="game-title">⚫ 五子棋 · 15×15 交叉点</div></div>
    <div class="game-body">
      <div class="sidebar">
        <div class="panel"><h4>规则</h4><div class="rule-text">黑先白后，棋子落在交叉点上。横竖斜任意方向连成五子获胜。</div></div>
        <div class="panel"><h4>状态</h4><div class="status-text" id="gmStatus">⚫ 黑方走棋</div></div>
        <div class="panel"><h4>日志</h4><div class="naval-log" id="gmLog"></div></div>
        <div class="panel"><h4>功能</h4><div class="actions">
          <button class="act" id="gmResign">🏳️ 投降</button>
          <button class="act" id="gmSettle">📊 结算</button>
          <button class="act" id="gmUndo">↩️ 悔棋</button>
          <button class="act" id="gmRestart">🔄 重开</button>
        </div></div>
      </div>
      <div class="board-wrap" id="gmWrap"></div>
    </div>
  </div>`;
  const wrap=document.getElementById('gmWrap'),statusEl=document.getElementById('gmStatus');
  function render(){
    const b=document.createElement('div');b.className='cross-board';
    b.style.width=((SIZE-1)*CELL+PAD*2)+'px';b.style.height=((SIZE-1)*CELL+PAD*2)+'px';
    b.style.position='relative';
    drawCrossLines(b,SIZE,SIZE,CELL,PAD);addAxisLabels(b,SIZE,SIZE,CELL,PAD);
    for(let r=0;r<SIZE;r++)for(let c=0;c<SIZE;c++){
      const pt=document.createElement('div');pt.className='cross-point';
      pt.style.width=CELL+'px';pt.style.height=CELL+'px';
      pt.style.left=(PAD+c*CELL-CELL/2)+'px';pt.style.top=(PAD+r*CELL-CELL/2)+'px';
      const v=board[r][c];
      if(v)pt.innerHTML=`<div class="stone ${v}"></div>`;
      pt.onclick=()=>place(r,c);b.appendChild(pt);
    }
    wrap.innerHTML='';wrap.appendChild(b);
    statusEl.textContent=over?('🏆 '+(winner||'结束')):(cur==='black'?'⚫ 黑方走棋':'⚪ 白方走棋');
    renderLog('gmLog',log);
  }
  function place(r,c){
    if(over||board[r][c])return;
    history.push({board:board.map(x=>x.slice()),cur,over,winner,log:log.slice()});
    board[r][c]=cur;
    log.push(`${cur==='black'?'⚫ 黑方':'⚪ 白方'} (${r+1},${c+1})`);
    if(check(r,c,cur)){over=true;winner=cur==='black'?'黑方获胜':'白方获胜';log.push('🏆 '+winner);}
    else cur=cur==='black'?'white':'black';
    render();
  }
  function check(r,c,p){
    const dirs=[[1,0],[0,1],[1,1],[1,-1]];
    for(const[dx,dy]of dirs){let n=1;
      for(let i=1;i<5;i++){const nr=r+dx*i,nc=c+dy*i;if(nr<0||nr>=SIZE||nc<0||nc>=SIZE||board[nr][nc]!==p)break;n++;}
      for(let i=1;i<5;i++){const nr=r-dx*i,nc=c-dy*i;if(nr<0||nr>=SIZE||nc<0||nc>=SIZE||board[nr][nc]!==p)break;n++;}
      if(n>=5)return true;
    }return false;
  }
  document.getElementById('gmResign').onclick=()=>{if(over)return;over=true;winner=cur==='black'?'白方胜(黑投降)':'黑方胜(白投降)';log.push('🏳️ '+winner);render();};
  document.getElementById('gmSettle').onclick=()=>{if(over)return;over=true;winner='结算：未分胜负';log.push('📊 结算');render();};
  document.getElementById('gmUndo').onclick=()=>{if(!history.length)return;const s=history.pop();board=s.board;cur=s.cur;over=s.over;winner=s.winner;log=s.log;render();};
  document.getElementById('gmRestart').onclick=()=>{board=Array.from({length:SIZE},()=>Array(SIZE).fill(null));cur='black';over=false;winner=null;history=[];log=[];render();};
  const getState =()=>({game:'gomoku',board,cur,over,winner,log});
  const setState =(s)=>{board=s.board;cur=s.cur;over=s.over;winner=s.winner;log=s.log||[];history=[];render();};
  render();
  return { getState, setState };
}

  window.__games = window.__games || {};
  window.__games['gomoku'] = { init };
})();
