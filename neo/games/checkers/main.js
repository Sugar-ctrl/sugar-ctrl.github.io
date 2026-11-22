/* checkers */
(function(){
  const { drawCrossLines, addAxisLabels, renderLog } = window.GameCommon;

/* ④ 跳棋 */
function init(container){
  const SIZE=8;
  let board=[];
  let cur='red',over=false,winner=null,history=[];
  let selected=null;
  let moves=[];
  let log=[];
  function resetBoard(){
    board=Array.from({length:SIZE},()=>Array(SIZE).fill(null));
    for(let r=0;r<SIZE;r++)for(let c=0;c<SIZE;c++){
      if((r+c)%2===1){
        if(r<3)board[r][c]={color:'black',king:false};
        else if(r>4)board[r][c]={color:'red',king:false};
      }
    }
    selected=null;moves=[];
  }
  resetBoard();
  container.innerHTML=`
  <div class="game-page active">
    <div class="game-head"><div class="game-title">🔴 跳棋 · 8×8 斜走连跳</div></div>
    <div class="game-body">
      <div class="sidebar">
        <div class="panel"><h4>规则</h4><div class="rule-text">红先黑后, 棋子只能在深色格斜走一格。跳吃: 斜前方有对方棋子且后方为空可跳过吃掉。连跳: 跳吃后还能继续跳则必须继续(可选)。兵到底线升为王(可后退)。吃掉对方全部棋子或对方无子可动获胜。</div></div>
        <div class="panel"><h4>状态</h4><div class="status-text" id="ckStatus">🔴 红方走棋</div></div>
        <div class="panel"><h4>日志</h4><div class="naval-log" id="ckLog"></div></div>
        <div class="panel"><h4>功能</h4><div class="actions">
          <button class="act" id="ckResign">🏳️ 投降</button>
          <button class="act" id="ckSettle">📊 结算</button>
          <button class="act" id="ckUndo">↩️ 悔棋</button>
          <button class="act" id="ckRestart">🔄 重开</button>
        </div></div>
      </div>
      <div class="board-wrap" id="ckWrap"></div>
    </div>
  </div>`;
  const wrap=document.getElementById('ckWrap'),statusEl=document.getElementById('ckStatus');
  function render(){
    const b=document.createElement('div');b.className='checkers-board';
    for(let r=0;r<SIZE;r++)for(let c=0;c<SIZE;c++){
      const cell=document.createElement('div');
      cell.className='checkers-cell '+((r+c)%2===1?'dark':'light');
      if(selected&&selected[0]===r&&selected[1]===c)cell.classList.add('highlight');
      const p=board[r][c];
      if(p){
        const piece=document.createElement('div');
        piece.className='checkers-piece '+p.color+(p.king?' king':'');
        if(selected&&selected[0]===r&&selected[1]===c)piece.classList.add('selected');
        cell.appendChild(piece);
      }
      if(moves.some(([mr,mc])=>mr===r&&mc===c))cell.style.boxShadow='inset 0 0 0 4px rgba(80,200,80,.8)';
      cell.onclick=()=>click(r,c);
      b.appendChild(cell);
    }
    wrap.innerHTML='';wrap.appendChild(b);
    let redCount=0,blackCount=0;
    for(let r=0;r<SIZE;r++)for(let c=0;c<SIZE;c++){
      if(board[r][c]){
        if(board[r][c].color==='red')redCount++;
        else blackCount++;
      }
    }
    if(over)statusEl.textContent='🏆 '+(winner||'结束');
    else statusEl.textContent=(cur==='red'?'🔴 红方走棋':'⚫ 黑方走棋')+` (红${redCount} 黑${blackCount})`;
    renderLog('ckLog',log);
  }
  function getMoves(r,c){
    const p=board[r][c];
    if(!p)return{steps:[],jumps:[]};
    const steps=[];const jumps=[];
    const dirs=[];
    if(p.color==='red'||p.king)dirs.push([-1,-1],[-1,1]);
    if(p.color==='black'||p.king)dirs.push([1,-1],[1,1]);
    for(const[dr,dc]of dirs){
      const nr=r+dr,nc=c+dc;
      if(nr>=0&&nr<SIZE&&nc>=0&&nc<SIZE&&!board[nr][nc])steps.push([nr,nc]);
    }
    for(const[dr,dc]of dirs){
      const mr=r+dr,mc=c+dc;
      const nr=r+2*dr,nc=c+2*dc;
      if(nr>=0&&nr<SIZE&&nc>=0&&nc<SIZE&&!board[nr][nc]&&board[mr][mc]&&board[mr][mc].color!==p.color)jumps.push([nr,nc,mr,mc]);
    }
    return{steps,jumps};
  }
  function click(r,c){
    if(over)return;
    const p=board[r][c];
    if(selected){
      const mv=moves.find(([mr,mc])=>mr===r&&mc===c);
      if(mv){
        history.push({board:board.map(row=>row.map(x=>x?{...x}:null)),cur,over,winner,selected:null,moves:[],log:log.slice()});
        const[sr,sc]=selected;
        const piece=board[sr][sc];
        board[r][c]=piece;board[sr][sc]=null;
        let text=`${piece.color==='red'?'🔴 红方':'⚫ 黑方'} (${sr+1},${sc+1})→(${r+1},${c+1})`;
        if(Math.abs(r-sr)===2){
          const mr=(r+sr)/2,mc=(c+sc)/2;
          board[mr][mc]=null;
          text += ` 吃 ${piece.color==='red'?'⚫ 黑方':'🔴 红方'} 1子`;
        }
        log.push(text);
        if(piece.color==='red'&&r===0){piece.king=true;log.push('🔴 红方 升王');}
        if(piece.color==='black'&&r===SIZE-1){piece.king=true;log.push('⚫ 黑方 升王');}
        const nextMoves=getMoves(r,c);
        if(nextMoves.jumps.length>0){
          selected=[r,c];moves=nextMoves.jumps.map(j=>[j[0],j[1]]);render();return;
        }
        selected=null;moves=[];
        cur=cur==='red'?'black':'red';
        checkEnd();render();return;
      }
      selected=null;moves=[];render();
    }
    if(p&&p.color===cur){
      selected=[r,c];
      const m=getMoves(r,c);
      moves=[...m.steps,...m.jumps.map(j=>[j[0],j[1]])];
      render();
    }
  }
  function checkEnd(){
    let redCount=0,blackCount=0;
    for(let r=0;r<SIZE;r++)for(let c=0;c<SIZE;c++){
      if(board[r][c]){
        if(board[r][c].color==='red')redCount++;else blackCount++;
      }
    }
    if(redCount===0){over=true;winner='黑方获胜';log.push('🏆 '+winner);}
    else if(blackCount===0){over=true;winner='红方获胜';log.push('🏆 '+winner);}
    else{
      let hasMove=false;
      for(let r=0;r<SIZE&&!hasMove;r++)for(let c=0;c<SIZE&&!hasMove;c++){
        if(board[r][c]&&board[r][c].color===cur){
          const m=getMoves(r,c);
          if(m.steps.length>0||m.jumps.length>0)hasMove=true;
        }
      }
      if(!hasMove){over=true;winner=(cur==='red'?'黑方':'红方')+'获胜(对方无子可动)';log.push('🏆 '+winner);}
    }
  }
  document.getElementById('ckResign').onclick=()=>{if(over)return;over=true;winner=cur==='red'?'黑方胜(红投降)':'红方胜(黑投降)';log.push('🏳️ '+winner);render();};
  document.getElementById('ckSettle').onclick=()=>{
    if(over)return;
    let redCount=0,blackCount=0;
    for(let r=0;r<SIZE;r++)for(let c=0;c<SIZE;c++){
      if(board[r][c]){
        if(board[r][c].color==='red')redCount++;else blackCount++;
      }
    }
    over=true;
    if(redCount>blackCount)winner=`红方获胜(红${redCount} vs 黑${blackCount})`;
    else if(blackCount>redCount)winner=`黑方获胜(红${redCount} vs 黑${blackCount})`;
    else winner=`平局(双方各${redCount})`;
    log.push('📊 '+winner);render();
  };
  document.getElementById('ckUndo').onclick=()=>{if(!history.length)return;const s=history.pop();board=s.board;cur=s.cur;over=s.over;winner=s.winner;selected=s.selected;moves=s.moves||[];log=s.log;render();};
  document.getElementById('ckRestart').onclick=()=>{resetBoard();cur='red';over=false;winner=null;history=[];log=[];render();};
  const getState =()=>({game:'checkers',board,cur,over,winner,log});
  const setState =(s)=>{board=s.board;cur=s.cur;over=s.over;winner=s.winner;selected=null;moves=[];log=s.log||[];history=[];render();};
  render();
  return { getState, setState };
}

  window.__games = window.__games || {};
  window.__games['checkers'] = { init };
})();
