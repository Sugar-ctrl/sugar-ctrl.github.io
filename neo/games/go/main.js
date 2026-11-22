/* go */
(function(){
  const { drawCrossLines, addAxisLabels, renderLog } = window.GameCommon;

/* ② 围棋 */
function init(container){
  let size=9;
  let board=Array.from({length:size},()=>Array(size).fill(null));
  let cur='black',over=false,winner=null;
  let passes={black:0,white:0};let history=[];
  let positionHistory=[];
  let log=[];
  container.innerHTML=`
  <div class="game-page active">
    <div class="game-head"><div class="game-title">⚪ 围棋 · 提劫</div></div>
    <div class="game-body">
      <div class="sidebar">
        <div class="panel"><h4>棋盘大小</h4><div class="actions" id="goSizes"></div></div>
        <div class="panel"><h4>规则</h4><div class="rule-text">黑先白后, 棋子落在交叉点。无气棋子被吃。禁全同(提劫): 局面重复禁止落子。13路及以上黑贴7.5目。双方各限停一手3次。</div></div>
        <div class="panel"><h4>状态</h4><div class="status-text" id="goStatus">⚫ 黑方走棋</div></div>
        <div class="panel"><h4>日志</h4><div class="naval-log" id="goLog"></div></div>
        <div class="panel"><h4>功能</h4><div class="actions">
          <button class="act" id="goResign">🏳️ 投降</button>
          <button class="act" id="goSettle">📊 结算</button>
          <button class="act" id="goUndo">↩️ 悔棋</button>
          <button class="act" id="goRestart">🔄 重开</button>
          <button class="act" id="goPass">⏸️ 停一手</button>
        </div></div>
      </div>
      <div class="board-wrap" id="goWrap"></div>
    </div>
  </div>`;
  const wrap=document.getElementById('goWrap'),statusEl=document.getElementById('goStatus'),sizesBox=document.getElementById('goSizes');
  function starPoints(s){
    if(s===9)return[[4,4]];
    if(s===13)return[[6,6],[3,3],[3,9],[9,3],[9,9]];
    if(s===19)return[[9,9],[3,3],[3,15],[15,3],[15,15]];
    if(s===21)return[[10,10],[3,3],[3,17],[17,3],[17,17]];
    if(s===5)return[[2,2]];
    return[];
  }
  function boardKey(b){return b.map(row=>row.map(v=>v==='black'?'B':(v==='white'?'W':'.')).join('')).join('/');}
  function buildSizes(){
    sizesBox.innerHTML='';
    [3,5,9,13,19,21].forEach(s=>{
      const b=document.createElement('button');b.className='act';b.textContent=s+'路';b.style.flex='0 0 52px';
      if(s===size)b.style.background='#e8dcc0';
      b.onclick=()=>{size=s;board=Array.from({length:size},()=>Array(size).fill(null));cur='black';over=false;winner=null;passes={black:0,white:0};history=[];positionHistory=[boardKey(board)];log=[];buildSizes();render();};
      sizesBox.appendChild(b);
    });
  }
  function render(){
    const CELL=size<=9?40:(size<=13?34:28);const PAD=CELL+8;
    const b=document.createElement('div');b.className='cross-board';
    b.style.width=((size-1)*CELL+PAD*2)+'px';b.style.height=((size-1)*CELL+PAD*2)+'px';
    b.style.position='relative';
    drawCrossLines(b,size,size,CELL,PAD);addAxisLabels(b,size,size,CELL,PAD);
    const stars=starPoints(size);
    for(let r=0;r<size;r++)for(let c=0;c<size;c++){
      const pt=document.createElement('div');pt.className='cross-point';
      pt.style.width=CELL+'px';pt.style.height=CELL+'px';
      pt.style.left=(PAD+c*CELL-CELL/2)+'px';pt.style.top=(PAD+r*CELL-CELL/2)+'px';
      const v=board[r][c];
      if(v)pt.innerHTML=`<div class="stone ${v}" style="width:${CELL*.8}px;height:${CELL*.8}px"></div>`;
      else if(stars.some(([sr,sc])=>sr===r&&sc===c))pt.innerHTML='<div class="star"></div>';
      pt.onclick=()=>place(r,c);b.appendChild(pt);
    }
    wrap.innerHTML='';wrap.appendChild(b);
    if(over)statusEl.textContent='🏆 '+(winner||'结束');
    else statusEl.textContent=(cur==='black'?'⚫ 黑方走棋':'⚪ 白方走棋')+` (停${passes.black}/3,${passes.white}/3)`;
    renderLog('goLog',log);
  }
  function getGroupOf(b,r,c,s){
    const color=b[r][c];if(!color)return{stones:[],liberties:new Set()};
    const stones=[];const visited=new Set();const liberties=new Set();
    const stack=[[r,c]];visited.add(r+','+c);
    while(stack.length){
      const[x,y]=stack.pop();stones.push([x,y]);
      for(const[dx,dy]of[[1,0],[-1,0],[0,1],[0,-1]]){
        const nx=x+dx,ny=y+dy;
        if(nx<0||nx>=s||ny<0||ny>=s)continue;
        if(b[nx][ny]===null)liberties.add(nx+','+ny);
        else if(b[nx][ny]===color&&!visited.has(nx+','+ny)){visited.add(nx+','+ny);stack.push([nx,ny]);}
      }
    }
    return{stones,liberties};
  }
  function place(r,c){
    if(over||board[r][c])return;
    const snapshot={board:board.map(x=>x.slice()),cur,over,winner,passes:{...passes},positionHistory:positionHistory.slice(),log:log.slice()};
    const simBoard=board.map(x=>x.slice());
    simBoard[r][c]=cur;
    const opp=cur==='black'?'white':'black';
    let captured=0;
    for(const[dx,dy]of[[1,0],[-1,0],[0,1],[0,-1]]){
      const nr=r+dx,nc=c+dy;
      if(nr<0||nr>=size||nc<0||nc>=size)continue;
      if(simBoard[nr][nc]===opp){
        const g=getGroupOf(simBoard,nr,nc,size);
        if(g.liberties.size===0){g.stones.forEach(([sr,sc])=>simBoard[sr][sc]=null);captured+=g.stones.length;}
      }
    }
    const self=getGroupOf(simBoard,r,c,size);
    if(self.liberties.size===0)return;
    const key=boardKey(simBoard);
    if(positionHistory.includes(key)){alert('禁全同(提劫): 该局面已出现过, 不能落子!');return;}
    history.push(snapshot);board=simBoard;positionHistory.push(key);
    log.push(`${cur==='black'?'⚫ 黑方':'⚪ 白方'} (${r+1},${c+1})`+(captured>0?` 提${captured}子`:''));
    cur=opp;render();
  }
  function settle(){
    if(over)return;
    let bl=0,wh=0;
    for(let r=0;r<size;r++)for(let c=0;c<size;c++){if(board[r][c]==='black')bl++;else if(board[r][c]==='white')wh++;}
    const komi=size>=13?7.5:0;const bs=bl-komi;
    over=true;winner=bs>wh?`黑方胜(黑${bl}-${komi}=${bs} vs 白${wh})`:`白方胜(黑${bl}-${komi}=${bs} vs 白${wh})`;
    log.push('📊 '+winner);render();
  }
  document.getElementById('goResign').onclick=()=>{if(over)return;over=true;winner=cur==='black'?'白方胜(黑投降)':'黑方胜(白投降)';log.push('🏳️ '+winner);render();};
  document.getElementById('goSettle').onclick=settle;
  document.getElementById('goUndo').onclick=()=>{if(!history.length)return;const s=history.pop();board=s.board;cur=s.cur;over=s.over;winner=s.winner;passes=s.passes;positionHistory=s.positionHistory;log=s.log;render();};
  document.getElementById('goRestart').onclick=()=>{board=Array.from({length:size},()=>Array(size).fill(null));cur='black';over=false;winner=null;passes={black:0,white:0};history=[];positionHistory=[boardKey(board)];log=[];render();};
  document.getElementById('goPass').onclick=()=>{if(over)return;if(passes[cur]>=3){alert('停一手次数已用完');return;}passes[cur]++;log.push(`${cur==='black'?'⚫ 黑方':'⚪ 白方'} 停一手 (${passes[cur]}/3)`);cur=cur==='black'?'white':'black';render();};
  buildSizes();positionHistory=[boardKey(board)];render();
  const getState =()=>({game:'go',size,board,cur,over,winner,passes,positionHistory,log});
  const setState =(s)=>{size=s.size;board=s.board;cur=s.cur;over=s.over;winner=s.winner;passes=s.passes||{black:0,white:0};positionHistory=s.positionHistory||[boardKey(board)];log=s.log||[];history=[];buildSizes();render();};
  return { getState, setState };
}

  window.__games = window.__games || {};
  window.__games['go'] = { init };
})();
