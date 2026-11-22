/* junqi */
(function(){
  const { drawCrossLines, addAxisLabels, renderLog } = window.GameCommon;

/* ⑫ 军棋 */
function init(container){
  const COLS=5,ROWS=12;
  const PIECE_DEFS=[
    {name:'司令',rank:10,count:1},{name:'军长',rank:9,count:1},
    {name:'师长',rank:8,count:2},{name:'旅长',rank:7,count:2},
    {name:'团长',rank:6,count:2},{name:'营长',rank:5,count:2},
    {name:'连长',rank:4,count:3},{name:'排长',rank:3,count:3},
    {name:'工兵',rank:2,count:3},{name:'地雷',rank:1,count:3},
    {name:'炸弹',rank:0,count:2},{name:'军旗',rank:-1,count:1}
  ];
  let board=Array.from({length:ROWS},()=>Array(COLS).fill(null));
  let phase='place-red';
  let placedPieces={red:[],blue:[]};
  let selectedPool=null;
  let curPlayer='red',over=false,winner=null;
  let selected=null;
  let log=[];
  let redReady=false,blueReady=false;
  container.innerHTML=`
  <div class="game-page active">
    <div class="game-head"><div class="game-title">🎖️ 军棋 · 纯暗棋对战</div></div>
    <div class="game-body">
      <div class="sidebar">
        <div class="panel"><h4>状态</h4><div class="status-text" id="jqStatus">红方布阵</div></div>
        <div class="panel"><h4>日志</h4><div class="naval-log" id="jqLog"></div></div>
        <div class="panel"><h4>规则</h4><div class="rule-text">
          5×12棋盘, 每方25枚棋子。布阵时可见, 点确定后完全隐藏(不能翻开)。双方都确定后开战: 点击己方棋子选中, 再点击相邻格子移动/攻击。攻击对方棋子直接结算: 按军衔大小吃子。<b>司令>军长>师长>旅长>团长>营长>连长>排长>工兵</b>。工兵可挖地雷, 炸弹与任何棋子同归于尽。军旗被吃则负。地雷不能移动。铁路可多步走。游戏结束后才能看到布局。
        </div></div>
        <div class="panel"><h4>功能</h4><div class="actions">
          <button class="act" id="jqConfirm">✅ 确定</button>
          <button class="act" id="jqSettle">📊 结算</button>
          <button class="act" id="jqRestart">🔄 重开</button>
        </div></div>
      </div>
      <div class="board-wrap" id="jqWrap"></div>
    </div>
  </div>`;
  const wrap=document.getElementById('jqWrap');
  const statusEl=document.getElementById('jqStatus');
  const logEl=document.getElementById('jqLog');
  function makeInitialPieces(){const arr=[];PIECE_DEFS.forEach(d=>{for(let i=0;i<d.count;i++)arr.push(d.name);});return arr;}
  function isCamp(r,c){return (r===2&&(c===0||c===4))||(r===4&&c===2)||(r===9&&(c===0||c===4))||(r===7&&c===2);}
  function isBase(r,c){return (r===5&&c===2)||(r===6&&c===2);}
  function isRailroad(r,c){return r===1||r===10;}
  function render(){
    wrap.innerHTML='';
    if(phase==='place-red'||phase==='place-blue')wrap.appendChild(renderPlacePhase(phase==='place-red'?'red':'blue'));
    else wrap.appendChild(renderBattlePhase());
    statusEl.textContent=over?('🏆 '+(winner||'结束')):
      (phase==='place-red'?'红方布阵':phase==='place-blue'?'蓝方布阵':
        (curPlayer==='red'?'红方走棋':'蓝方走棋'));
    logEl.innerHTML=log.slice(-15).map(l=>`<div>${l}</div>`).join('');
  }
  function renderPlacePhase(color){
    const div=document.createElement('div');div.className='junqi-place-wrap';
    const boardDiv=document.createElement('div');boardDiv.className='junqi-board';
    const myHalf=color==='red'?[6,11]:[0,5];
    const myReady=color==='red'?redReady:blueReady;
    const oppReady=color==='red'?blueReady:redReady;
    for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++){
      const cell=document.createElement('div');cell.className='junqi-cell';
      if(isCamp(r,c))cell.classList.add('camp');
      else if(isBase(r,c))cell.classList.add('base');
      else if(isRailroad(r,c))cell.classList.add('railroad');
      const p=board[r][c];
      if(p){
        const isMyPiece=p.color===color;
        if((isMyPiece&&myReady)||(!isMyPiece&&oppReady)){
          cell.classList.add('unknown-'+p.color);cell.textContent='?';
        }else{
          cell.classList.add(p.color+'-piece');cell.textContent=p.name;
        }
      }else if(r>=myHalf[0]&&r<=myHalf[1]&&!myReady){
        cell.classList.add('empty');cell.style.cursor='pointer';cell.style.background='#fffbe8';
        cell.onclick=()=>placePiece(r,c,color);
      }else cell.classList.add('empty');
      boardDiv.appendChild(cell);
    }
    div.appendChild(boardDiv);
    if(!myReady){
      const pool=document.createElement('div');pool.className='junqi-piece-pool';
      const initial=makeInitialPieces();
      const counts={};initial.forEach(n=>counts[n]=(counts[n]||0)+1);
      placedPieces[color].forEach(n=>counts[n]--);
      Object.keys(counts).forEach(name=>{
        if(counts[name]<=0)return;
        const item=document.createElement('div');item.className='pool-item '+color;
        item.textContent=`${name} ×${counts[name]}`;
        item.onclick=()=>{selectedPool=name;render();};
        if(selectedPool===name)item.style.background='#fffbe8';
        pool.appendChild(item);
      });
      div.appendChild(pool);
    }
    return div;
  }
  function placePiece(r,c,color){
    if(!selectedPool)return;
    if(board[r][c])return;
    const myHalf=color==='red'?[6,11]:[0,5];
    if(r<myHalf[0]||r>myHalf[1])return;
    board[r][c]={color,name:selectedPool,revealed:true};
    placedPieces[color].push(selectedPool);
    selectedPool=null;
    render();
  }
  function renderBattlePhase(){
    const div=document.createElement('div');div.style.display='flex';div.style.flexDirection='column';div.style.alignItems='center';
    const boardDiv=document.createElement('div');boardDiv.className='junqi-board';
    for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++){
      const cell=document.createElement('div');cell.className='junqi-cell';
      if(isCamp(r,c))cell.classList.add('camp');
      else if(isBase(r,c))cell.classList.add('base');
      else if(isRailroad(r,c))cell.classList.add('railroad');
      const p=board[r][c];
      if(p){
        if(over){cell.classList.add(p.color+'-piece');cell.textContent=p.name;}
        else{cell.classList.add('unknown-'+p.color);cell.textContent='?';}
      }else cell.classList.add('empty');
      if(selected&&selected[0]===r&&selected[1]===c)cell.classList.add('selected');
      if(selected){const[sr,sc]=selected;if(canMove(sr,sc,r,c))cell.classList.add('movable-hint');}
      cell.onclick=()=>clickBattle(r,c);
      boardDiv.appendChild(cell);
    }
    div.appendChild(boardDiv);
    return div;
  }
  function clickBattle(r,c){
    if(over||phase!=='battle')return;
    const p=board[r][c];
    if(selected){
      const[sr,sc]=selected;
      const from=board[sr][sc];
      if(canMove(sr,sc,r,c)){
        const target=board[r][c];
        let text=`${from.color==='red'?'🔴 红方':'🔵 蓝方'} (${sr+1},${sc+1})→(${r+1},${c+1})`;
        if(target){
          const result=judge(from,target);
          if(result==='win'){
            text += ` 吃 ${target.color==='red'?'🔴 红方':'🔵 蓝方'} ${target.name}`;
            board[r][c]=from;board[sr][sc]=null;
            if(target.name==='军旗'){over=true;winner=(from.color==='red'?'红方':'蓝方')+'获胜(夺旗)';log.push(text);log.push('🏆 '+winner);render();return;}
          }else if(result==='lose'){
            text += ` 被 ${target.color==='red'?'🔴 红方':'🔵 蓝方'} ${target.name} 吃掉`;
            board[sr][sc]=null;
          }else{
            text += ` 与 ${target.color==='red'?'🔴 红方':'🔵 蓝方'} ${target.name} 同归于尽`;
            board[r][c]=null;board[sr][sc]=null;
          }
        }else{board[r][c]=from;board[sr][sc]=null;}
        log.push(text);
        selected=null;
        if(!over)switchTurn();
        render();return;
      }
      selected=null;render();return;
    }
    if(p&&p.color===curPlayer){selected=[r,c];render();return;}
  }
  function canMove(sr,sc,tr,tc){
    if(sr===tr&&sc===tc)return false;
    const p=board[sr][sc];if(!p)return false;
    if(p.name==='地雷'||p.name==='军旗')return false;
    const target=board[tr][tc];
    if(target&&target.color===p.color)return false;
    const dr=tr-sr,dc=tc-sc;
    if(isRailroad(sr,sc)&&isRailroad(tr,tc)){
      if(dr===0){const step=Math.sign(dc);for(let c=sc+step;c!==tc;c+=step)if(board[sr][c])return false;return true;}
      if(dc===0){const step=Math.sign(dr);for(let r=sr+step;r!==tr;r+=step)if(board[r][sc])return false;return true;}
    }
    if(Math.abs(dr)+Math.abs(dc)===1)return true;
    return false;
  }
  function judge(attacker,defender){
    if(attacker.name==='炸弹'||defender.name==='炸弹')return 'draw';
    if(defender.name==='地雷'){if(attacker.name==='工兵')return 'win';return 'draw';}
    if(defender.name==='军旗')return 'win';
    const ar=getRank(attacker.name),dr=getRank(defender.name);
    if(ar>dr)return 'win';
    if(ar<dr)return 'lose';
    return 'draw';
  }
  function getRank(name){const d=PIECE_DEFS.find(x=>x.name===name);return d?d.rank:-999;}
  function switchTurn(){
    curPlayer=curPlayer==='red'?'blue':'red';
    let redFlag=false,blueFlag=false;
    for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++){
      const p=board[r][c];
      if(p&&p.name==='军旗'){if(p.color==='red')redFlag=true;else blueFlag=true;}
    }
    if(!redFlag&&!blueFlag){over=true;winner='平局(双方军旗均已失)';log.push('🏆 '+winner);}
    else if(!redFlag){over=true;winner='蓝方获胜(夺旗)';log.push('🏆 '+winner);}
    else if(!blueFlag){over=true;winner='红方获胜(夺旗)';log.push('🏆 '+winner);}
  }
  document.getElementById('jqConfirm').onclick=()=>{
    if(phase==='place-red'){
      if(placedPieces.red.length<25){alert(`红方还有${25-placedPieces.red.length}枚棋子未放置!`);return;}
      redReady=true;phase='place-blue';selectedPool=null;
      log.push('红方布阵完成并隐藏, 轮到蓝方');render();
    }else if(phase==='place-blue'){
      if(placedPieces.blue.length<25){alert(`蓝方还有${25-placedPieces.blue.length}枚棋子未放置!`);return;}
      blueReady=true;phase='battle';curPlayer='red';selectedPool=null;
      log.push('双方布阵完成, 开始对战! 红方先手');render();
    }
  };
  document.getElementById('jqSettle').onclick=()=>{
    if(over)return;over=true;
    let redCount=0,blueCount=0;
    for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++){
      const p=board[r][c];
      if(p){if(p.color==='red')redCount++;else blueCount++;}
    }
    if(redCount>blueCount)winner=`红方获胜(红${redCount} vs 蓝${blueCount})`;
    else if(blueCount>redCount)winner=`蓝方获胜(红${redCount} vs 蓝${blueCount})`;
    else winner=`平局(双方各${redCount})`;
    log.push('📊 '+winner);render();
  };
  document.getElementById('jqRestart').onclick=()=>{
    board=Array.from({length:ROWS},()=>Array(COLS).fill(null));
    phase='place-red';placedPieces={red:[],blue:[]};selectedPool=null;
    curPlayer='red';over=false;winner=null;selected=null;log=[];
    redReady=false;blueReady=false;
    render();
  };
  const getState =()=>({game:'junqi',board,phase,placedPieces,curPlayer,over,winner,log,redReady,blueReady});
  const setState =(s)=>{
    board=s.board;phase=s.phase;placedPieces=s.placedPieces;curPlayer=s.curPlayer;
    over=s.over;winner=s.winner;log=s.log||[];redReady=s.redReady;blueReady=s.blueReady;
    selectedPool=null;selected=null;render();
  };
  render();
  return { getState, setState };
}

  window.__games = window.__games || {};
  window.__games['junqi'] = { init };
})();
