/* chess */
(function(){
  const { drawCrossLines, addAxisLabels, renderLog } = window.GameCommon;

/* ⑨ 国际象棋（5.5 替换为 chess.html 新逻辑，含王车易位攻击检测与强制升变） */
function init(container){
  const ROWS=8,COLS=8;
  let board=[],cur='white',over=false,winner=null,history=[],selected=null,moves=[];
  let promoState=null,log=[];
  let castling={white:{k:true,q:true},black:{k:true,q:true}};
  let enPassantTarget=null;
  let scores={white:0,black:0};
  const WHITE='white',BLACK='black';
  const isWhitePiece=p=>p&&p.color===WHITE;
  const isBlackPiece=p=>p&&p.color===BLACK;
  const PIECE_SCORES = {
    '♙': 1, '♟': 1,
    '♘': 3, '♞': 3,
    '♗': 3, '♝': 3,
    '♖': 5, '♜': 5,
    '♕': 9, '♛': 9
  };

  function initPieces(){
    board=Array.from({length:ROWS},()=>Array(COLS).fill(null));
    const back=['♜','♞','♝','♛','♚','♝','♞','♜'];
    for(let c=0;c<8;c++){
      board[0][c]={p:back[c],color:BLACK,type:'back'};
      board[7][c]={p:back[c],color:WHITE,type:'back'};
    }
    for(let c=0;c<8;c++){
      board[1][c]={p:'♟',color:BLACK,type:'pawn'};
      board[6][c]={p:'♙',color:WHITE,type:'pawn'};
    }
    castling={white:{k:true,q:true},black:{k:true,q:true}};
    enPassantTarget=null;
    scores={white:0,black:0};
  }
  initPieces();

  container.innerHTML=`
  <div class="game-page active">
    <div class="game-head"><div class="game-title">♟️ 国际象棋 · 王车易位·吃过路兵</div></div>
    <div class="game-body">
      <div class="sidebar">
        <div class="panel"><h4>规则</h4><div class="rule-text">白先黑后。支持王车易位与吃过路兵。兵到底部弹出选择升变。吃掉棋子得分：兵1分，马/象3分，车5分，后9分。王被吃游戏结束，同分平局。</div></div>
        <div class="panel"><h4>比分</h4>
          <div class="naval-score">
            <span class="white">白: <span id="chScoreWhite">0</span></span>
            <span class="black">黑: <span id="chScoreBlack">0</span></span>
          </div>
        </div>
        <div class="panel"><h4>状态</h4><div class="status-text" id="chStatus">⚪ 白方走棋</div></div>
        <div class="panel"><h4>日志</h4><div class="naval-log" id="chLog"></div></div>
        <div class="panel"><h4>功能</h4><div class="actions">
          <button class="act" id="chResign">🏳️ 投降</button>
          <button class="act" id="chSettle">📊 结算</button>
          <button class="act" id="chUndo">↩️ 悔棋</button>
          <button class="act" id="chRestart">🔄 重开</button>
        </div></div>
      </div>
      <div class="board-wrap" id="chWrap"></div>
    </div>
  </div>`;
  const wrap=document.getElementById('chWrap'),statusEl=document.getElementById('chStatus');
  const CELL=56;

  function renderLog(){document.getElementById('chLog').innerHTML=log.slice(-15).map(l=>'<div>'+l+'</div>').join('');}

  // 检查该位置是否会被对方攻击（用于王车易位）
  function isAttacked(r, c, byColor) {
    for (let rr = 0; rr < ROWS; rr++) {
      for (let cc = 0; cc < COLS; cc++) {
        const p = board[rr][cc];
        if (p && p.color === byColor) {
          const m = genMoves(rr, cc);
          if (m.some(([mr, mc]) => mr === r && mc === c)) {
            return true;
          }
        }
      }
    }
    return false;
  }

  function render(){
    wrap.innerHTML='';
    const wrapper=document.createElement('div');wrapper.className='chess-wrapper';
    const b=document.createElement('div');b.className='chess-board';
    for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++){
      const cell=document.createElement('div');cell.className='chess-cell '+((r+c)%2===0?'light':'dark');
      const piece=board[r][c];
      if(piece){
        cell.textContent=piece.p;
        if(piece.color===WHITE)cell.classList.add('chess-white-piece');
        else cell.classList.add('chess-black-piece');
      }
      if(selected&&selected[0]===r&&selected[1]===c)cell.classList.add('selected');
      if(moves.some(([mr,mc])=>mr===r&&mc===c)){
        if(board[r][c]||(enPassantTarget&&enPassantTarget[0]===r&&enPassantTarget[1]===c))cell.innerHTML+='<div class="capture-ring"></div>';
        else cell.innerHTML+='<div class="dot"></div>';
      }
      cell.onclick=()=>click(r,c);b.appendChild(cell);
    }
    wrapper.appendChild(b);
    for(let c=0;c<COLS;c++){
      const lbl=document.createElement('div');lbl.className='chess-outer-label top';
      lbl.textContent=c+1;lbl.style.left=(28+c*CELL+CELL/2-8)+'px';wrapper.appendChild(lbl);
    }
    for(let r=0;r<ROWS;r++){
      const lbl=document.createElement('div');lbl.className='chess-outer-label left';
      lbl.textContent=r+1;lbl.style.top=(28+r*CELL+CELL/2-8)+'px';wrapper.appendChild(lbl);
    }
    wrap.appendChild(wrapper);
    if(promoState){
      const panel=document.createElement('div');panel.className='promo-panel';
      panel.innerHTML='<div class="promo-title">选择升变棋子</div>';
      const options=[{p:'♕'},{p:'♖'},{p:'♗'},{p:'♘'}];
      const color=promoState.piece.color;
      options.forEach(opt=>{
        const sym=color===WHITE?opt.p:{'♕':'♛','♖':'♜','♗':'♝','♘':'♞'}[opt.p];
        const btn=document.createElement('div');btn.className='promo-btn';btn.textContent=sym;
        btn.onclick=()=>doPromotion(opt.p);panel.appendChild(btn);
      });
      wrap.appendChild(panel);
    }
    statusEl.textContent=over?('🏆 '+(winner||'结束')):(cur==='white'?'⚪ 白方走棋':'⚫ 黑方走棋');
    document.getElementById('chScoreWhite').textContent = scores.white;
    document.getElementById('chScoreBlack').textContent = scores.black;
    renderLog();
  }

  function click(r,c){
    if(over||promoState)return;
    if(selected){
      if(moves.some(([mr,mc])=>mr===r&&mc===c)){
        history.push({
          board:board.map(row=>row.map(x=>x?{...x}:null)),
          cur,over,winner,selected,moves,log:log.slice(),
          castling:JSON.parse(JSON.stringify(castling)),enPassantTarget,
          scores: {...scores}
        });
        const movingPiece=board[selected[0]][selected[1]];
        let captured=board[r][c];
        const oldEnPassant=enPassantTarget;
        enPassantTarget=null;

        if(movingPiece.p==='♙'||movingPiece.p==='♟'){
          if(oldEnPassant&&oldEnPassant[0]===r&&oldEnPassant[1]===c){
            captured={p:movingPiece.p==='♙'?'♟':'♙',color:movingPiece.color===WHITE?BLACK:WHITE};
            board[r+(movingPiece.color===WHITE?1:-1)][c]=null;
          }
        }

        let castled=false;
        if(movingPiece.p==='♚'||movingPiece.p==='♔'){
          if(Math.abs(c-selected[1])===2){
            castled=true;
            const rookFromC=c>selected[1]?7:0;
            const rookToC=c>selected[1]?5:3;
            board[selected[0]][rookToC]=board[selected[0]][rookFromC];
            board[selected[0]][rookFromC]=null;
          }
        }

        board[r][c]=movingPiece;board[selected[0]][selected[1]]=null;

        let text=`${movingPiece.color===WHITE?'⚪ 白方':'⚫ 黑方'} ${movingPiece.p} (${selected[0]+1},${selected[1]+1})→(${r+1},${c+1})`;
        if(castled) text+=' (王车易位)';
        if(captured){
          const scoreVal = PIECE_SCORES[captured.p] || 0;
          if(scoreVal > 0){
            scores[movingPiece.color] += scoreVal;
            text += ` 吃 ${captured.color===WHITE?'⚪ 白方':'⚫ 黑方'} ${captured.p} +${scoreVal}分`;
          } else {
            text += ` 吃 ${captured.color===WHITE?'⚪ 白方':'⚫ 黑方'} ${captured.p}`;
          }
        }
        log.push(text);

        if(movingPiece.p==='♚'){castling.white.k=false;castling.white.q=false;}
        if(movingPiece.p==='♔'){castling.black.k=false;castling.black.q=false;}
        if(movingPiece.p==='♜'&&selected[0]===7&&selected[1]===7)castling.white.k=false;
        if(movingPiece.p==='♜'&&selected[0]===7&&selected[1]===0)castling.white.q=false;
        if(movingPiece.p==='♜'&&selected[0]===0&&selected[1]===7)castling.black.k=false;
        if(movingPiece.p==='♜'&&selected[0]===0&&selected[1]===0)castling.black.q=false;

        if(movingPiece.p==='♙'&&selected[0]===6&&r===4)enPassantTarget=[5,c];
        if(movingPiece.p==='♟'&&selected[0]===1&&r===3)enPassantTarget=[2,c];

        if(captured&&captured.p==='♚'){
          over=true;winner='白方获胜';log.push('🏆 '+winner);selected=null;moves=[];render();return;
        }
        else if(captured&&captured.p==='♔'){
          over=true;winner='黑方获胜';log.push('🏆 '+winner);selected=null;moves=[];render();return;
        }

        if(movingPiece.p==='♙'&&r===0){promoState={row:r,col:c,piece:movingPiece};selected=null;moves=[];render();return;}
        if(movingPiece.p==='♟'&&r===7){promoState={row:r,col:c,piece:movingPiece};selected=null;moves=[];render();return;}
        cur=cur==='white'?'black':'white';selected=null;moves=[];render();return;
      }
      selected=null;moves=[];render();
    }else{
      const p=board[r][c];
      if(p&&((cur===WHITE&&isWhitePiece(p))||(cur===BLACK&&isBlackPiece(p)))){
        selected=[r,c];moves=genMoves(r,c);render();
      }
    }
  }

  function doPromotion(choice){
    const color=promoState.piece.color;
    const mapping=color===WHITE?{'♕':'♕','♖':'♖','♗':'♗','♘':'♘'}:{'♕':'♛','♖':'♜','♗':'♝','♘':'♞'};
    board[promoState.row][promoState.col]={p:mapping[choice],color:color,type:'promoted'};
    log.push(`${color===WHITE?'⚪ 白方':'⚫ 黑方'} ♙ 升变为 ${mapping[choice]}`);
    promoState=null;cur=cur==='white'?'black':'white';render();
  }

  function genMoves(r,c){
    const p=board[r][c];if(!p)return[];
    const res=[];
    const addSlide=(dr,dc)=>{
      let nr=r+dr,nc=c+dc;
      while(nr>=0&&nr<8&&nc>=0&&nc<8){
        const t=board[nr][nc];
        if(t&&t.color===p.color)break;
        res.push([nr,nc]);if(t)break;
        nr+=dr;nc+=dc;
      }
    };
    switch(p.p){
      case '♜':case '♖':addSlide(1,0);addSlide(-1,0);addSlide(0,1);addSlide(0,-1);break;
      case '♞':case '♘':[[2,1],[2,-1],[-2,1],[-2,-1],[1,2],[1,-2],[-1,2],[-1,-2]].forEach(([dr,dc])=>{const nr=r+dr,nc=c+dc;if(nr>=0&&nr<8&&nc>=0&&nc<8){const t=board[nr][nc];if(!t||t.color!==p.color)res.push([nr,nc]);}});break;
      case '♝':case '♗':addSlide(1,1);addSlide(1,-1);addSlide(-1,1);addSlide(-1,-1);break;
      case '♛':case '♕':addSlide(1,0);addSlide(-1,0);addSlide(0,1);addSlide(0,-1);addSlide(1,1);addSlide(1,-1);addSlide(-1,1);addSlide(-1,-1);break;
      case '♚':case '♔':
        [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]].forEach(([dr,dc])=>{
          const nr=r+dr,nc=c+dc;if(nr>=0&&nr<8&&nc>=0&&nc<8){const t=board[nr][nc];if(!t||t.color!==p.color)res.push([nr,nc]);}
        });
        // 修正王车易位：必须不处于被将军状态，且经过的格子不能受攻击
        if(p.color===WHITE&&r===7&&c===4){
          if(castling.white.k && !board[7][5] && !board[7][6] && board[7][7] && board[7][7].p==='♜'){
            if(!isAttacked(7,4,'black') && !isAttacked(7,5,'black') && !isAttacked(7,6,'black')) {
              res.push([7,6]);
            }
          }
          if(castling.white.q && !board[7][3] && !board[7][2] && !board[7][1] && board[7][0] && board[7][0].p==='♜'){
            if(!isAttacked(7,4,'black') && !isAttacked(7,3,'black') && !isAttacked(7,2,'black')) {
              res.push([7,2]);
            }
          }
        }else if(p.color===BLACK&&r===0&&c===4){
          if(castling.black.k && !board[0][5] && !board[0][6] && board[0][7] && board[0][7].p==='♜'){
            if(!isAttacked(0,4,'white') && !isAttacked(0,5,'white') && !isAttacked(0,6,'white')) {
              res.push([0,6]);
            }
          }
          if(castling.black.q && !board[0][3] && !board[0][2] && !board[0][1] && board[0][0] && board[0][0].p==='♜'){
            if(!isAttacked(0,4,'white') && !isAttacked(0,3,'white') && !isAttacked(0,2,'white')) {
              res.push([0,2]);
            }
          }
        }
        break;
      case '♟':case '♙':
        const dir=p.color===WHITE?-1:1;
        if(!board[r+dir]?.[c]){
          res.push([r+dir,c]);
          const startRow=p.color===WHITE?6:1;
          if(r===startRow&&!board[r+2*dir]?.[c])res.push([r+2*dir,c]);
        }
        [[r+dir,c-1],[r+dir,c+1]].forEach(([nr,nc])=>{
          if(nr>=0&&nr<8&&nc>=0&&nc<8){
            const t=board[nr][nc];
            if((t&&t.color!==p.color)||(enPassantTarget&&enPassantTarget[0]===nr&&enPassantTarget[1]===nc))res.push([nr,nc]);
          }
        });
        break;
    }
    return res;
  }

  document.getElementById('chResign').onclick=()=>{if(over||promoState)return;over=true;winner=cur==='white'?'黑方胜(白投降)':'白方胜(黑投降)';log.push('🏳️ '+winner);render();};
  document.getElementById('chSettle').onclick=()=>{
    if(over||promoState)return;
    over=true;
    if(scores.white > scores.black){
      winner=`白方胜(比分 ${scores.white} vs ${scores.black})`;
    } else if(scores.black > scores.white){
      winner=`黑方胜(比分 ${scores.black} vs ${scores.white})`;
    } else {
      winner=`平局(比分 ${scores.white} vs ${scores.black})`;
    }
    log.push('📊 结算：'+winner);
    render();
  };
  document.getElementById('chUndo').onclick=()=>{
    if(!history.length)return;
    const s=history.pop();
    board=s.board;cur=s.cur;over=s.over;winner=s.winner;selected=s.selected;moves=s.moves||[];
    promoState=null;log=s.log;
    castling=s.castling;enPassantTarget=s.enPassantTarget;
    scores=s.scores||{white:0,black:0};
    render();
  };
  document.getElementById('chRestart').onclick=()=>{initPieces();cur='white';over=false;winner=null;history=[];selected=null;moves=[];promoState=null;log=[];render();};

  const getState =()=>({game:'chess',board,cur,over,winner,log,castling,enPassantTarget,scores});
  const setState =(s)=>{
    board=s.board;cur=s.cur;over=s.over;winner=s.winner;log=s.log||[];
    castling=s.castling;enPassantTarget=s.enPassantTarget;scores=s.scores||{white:0,black:0};
    selected=null;moves=[];promoState=null;history=[];render();
  };

  // 升变时禁止保存
  const canSave = () => !promoState;

  render();
  return { getState, setState, canSave };
}

  window.__games = window.__games || {};
  window.__games['chess'] = { init };
})();
