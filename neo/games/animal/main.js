/* animal */
(function(){
  const { drawCrossLines, addAxisLabels, renderLog } = window.GameCommon;

/* ⑦ 斗兽棋 */
function init(container){
  const SIZE=6;
  const ANIMALS=[
    {name:'鼠',emoji:'🐭',rank:1},{name:'猫',emoji:'🐱',rank:2},
    {name:'狗',emoji:'🐶',rank:3},{name:'狼',emoji:'🐺',rank:4},
    {name:'豹',emoji:'🐆',rank:5},{name:'虎',emoji:'🐯',rank:6},
    {name:'狮',emoji:'🦁',rank:7},{name:'象',emoji:'🐘',rank:8}
  ];
  let board=[];
  let cur='red',over=false,winner=null,history=[];
  let selected=null;
  let log=[];
  function getPackagePositions(){
    const positions=[];
    for(let r=0;r<SIZE;r++){
      const startCol=r%2;
      for(let c=startCol;c<SIZE;c+=2)positions.push([r,c]);
    }
    return positions;
  }
  function resetBoard(){
    board=Array.from({length:SIZE},()=>Array(SIZE).fill(null).map(()=>({type:'empty'})));
    const positions=getPackagePositions();
    const redPool=[ANIMALS[0],ANIMALS[0],...ANIMALS.slice(1)];
    const bluePool=[ANIMALS[0],ANIMALS[0],...ANIMALS.slice(1)];
    redPool.sort(()=>Math.random()-.5);bluePool.sort(()=>Math.random()-.5);
    positions.forEach((pos,i)=>{
      const isRed=i%2===0;
      const pool=isRed?redPool:bluePool;
      const poolIdx=Math.floor(i/2);
      const animal=pool[poolIdx];
      board[pos[0]][pos[1]]={type:'animal',animal,owner:isRed?'red':'blue',revealed:false};
    });
    selected=null;
  }
  resetBoard();
  container.innerHTML=`
  <div class="game-page active">
    <div class="game-head"><div class="game-title">🦁 斗兽棋 · 6×6 拆包对战</div></div>
    <div class="game-body">
      <div class="sidebar">
        <div class="panel"><h4>规则</h4><div class="rule-text">6×6格子, 18个包裹, 双方各9只动物(鼠×2+其他7种各1)。点击包裹拆开消耗一个回合。点击己方已揭开的动物选中, 再点击相邻空格/敌方移动/吃子。吃子: 大吃小, 鼠可吃象, 象不能吃鼠。对方棋子全被吃完则获胜。</div></div>
        <div class="panel"><h4>状态</h4><div class="status-text" id="anStatus">🔴 红方走棋</div></div>
        <div class="panel"><h4>日志</h4><div class="naval-log" id="anLog"></div></div>
        <div class="panel"><h4>功能</h4><div class="actions">
          <button class="act" id="anResign">🏳️ 投降</button>
          <button class="act" id="anSettle">📊 结算</button>
          <button class="act" id="anUndo">↩️ 悔棋</button>
          <button class="act" id="anRestart">🔄 重开</button>
        </div></div>
      </div>
      <div class="board-wrap" id="anWrap"></div>
    </div>
  </div>`;
  const wrap=document.getElementById('anWrap'),statusEl=document.getElementById('anStatus');
  function isAdjacent(sr,sc,tr,tc){return Math.abs(sr-tr)+Math.abs(sc-tc)===1;}
  function countAllAnimals(owner){
    let n=0;
    for(let r=0;r<SIZE;r++)for(let c=0;c<SIZE;c++){
      const o=board[r][c];
      if(o.type==='animal'&&o.owner===owner)n++;
    }
    return n;
  }
  function countPackages(){
    let n=0;
    for(let r=0;r<SIZE;r++)for(let c=0;c<SIZE;c++){
      const o=board[r][c];
      if(o.type==='animal'&&!o.revealed)n++;
    }
    return n;
  }
  function render(){
    const b=document.createElement('div');b.className='animal-board';
    for(let r=0;r<SIZE;r++)for(let c=0;c<SIZE;c++){
      const cell=document.createElement('div');cell.className='animal-cell';
      const obj=board[r][c];
      if(obj.type==='empty'){cell.classList.add('empty');}
      else if(!obj.revealed){cell.classList.add('package');cell.textContent='📦';}
      else{
        cell.classList.add('revealed');
        cell.textContent=obj.animal.emoji;
        if(obj.owner==='red'){cell.classList.add('owner-red');cell.innerHTML+=`<span class="label red">${obj.animal.name}</span>`;}
        else if(obj.owner==='blue'){cell.classList.add('owner-blue');cell.innerHTML+=`<span class="label blue">${obj.animal.name}</span>`;}
      }
      if(selected&&selected[0]===r&&selected[1]===c)cell.classList.add('selected');
      if(selected&&isAdjacent(selected[0],selected[1],r,c)){
        const from=board[selected[0]][selected[1]];
        if(from&&from.type==='animal'&&from.revealed&&from.owner===cur){
          if(obj.type==='empty')cell.classList.add('movable-hint');
          else if(obj.type==='animal'&&obj.revealed&&obj.owner!==cur&&canEat(from.animal,obj.animal))cell.classList.add('movable-hint');
        }
      }
      cell.onclick=()=>click(r,c);b.appendChild(cell);
    }
    wrap.innerHTML='';wrap.appendChild(b);
    const pkgCount=countPackages();
    const redCount=countAllAnimals('red');
    const blueCount=countAllAnimals('blue');
    if(over)statusEl.textContent='🏆 '+(winner||'结束');
    else statusEl.textContent=(cur==='red'?'🔴 红方走棋':'🔵 蓝方走棋')+` (待拆${pkgCount} 红${redCount}蓝${blueCount})`;
    renderLog('anLog',log);
  }
  function click(r,c){
    if(over)return;
    const obj=board[r][c];
    if(selected){
      const[sr,sc]=selected;
      const from=board[sr][sc];
      if(isAdjacent(sr,sc,r,c)){
        if(obj.type==='empty'){
          history.push({board:JSON.parse(JSON.stringify(board)),cur,over,winner,selected:null,log:log.slice()});
          board[r][c]=from;board[sr][sc]={type:'empty'};
          log.push(`${from.owner==='red'?'🔴 红方':'🔵 蓝方'} ${from.animal.emoji}${from.animal.name} (${sr+1},${sc+1})→(${r+1},${c+1})`);
          selected=null;afterMove();return;
        }
        if(obj.type==='animal'&&obj.revealed&&obj.owner!==from.owner&&canEat(from.animal,obj.animal)){
          history.push({board:JSON.parse(JSON.stringify(board)),cur,over,winner,selected:null,log:log.slice()});
          log.push(`${from.owner==='red'?'🔴 红方':'🔵 蓝方'} ${from.animal.emoji}${from.animal.name} (${sr+1},${sc+1})→(${r+1},${c+1}) 吃 ${obj.owner==='red'?'🔴 红方':'🔵 蓝方'} ${obj.animal.emoji}${obj.animal.name}`);
          board[r][c]={...from,revealed:true};board[sr][sc]={type:'empty'};
          selected=null;afterMove();return;
        }
      }
      selected=null;render();return;
    }
    if(obj.type==='animal'&&!obj.revealed){
      history.push({board:JSON.parse(JSON.stringify(board)),cur,over,winner,selected:null,log:log.slice()});
      board[r][c]={...obj,revealed:true};
      log.push(`${cur==='red'?'🔴 红方':'🔵 蓝方'} 拆开 (${r+1},${c+1}) 得到 ${obj.animal.emoji}${obj.animal.name} (${obj.owner==='red'?'红方':'蓝方'})`);
      afterReveal();return;
    }
    if(obj.type==='animal'&&obj.revealed&&obj.owner===cur){selected=[r,c];render();return;}
  }
  function afterReveal(){cur=cur==='red'?'blue':'red';render();}
  function afterMove(){
    cur=cur==='red'?'blue':'red';render();
    const redAll=countAllAnimals('red');
    const blueAll=countAllAnimals('blue');
    if(redAll===0&&blueAll>0){over=true;winner='蓝方获胜';log.push('🏆 '+winner);render();return;}
    if(blueAll===0&&redAll>0){over=true;winner='红方获胜';log.push('🏆 '+winner);render();return;}
    if(redAll===0&&blueAll===0){over=true;winner='平局';log.push('平局');render();return;}
  }
  function canEat(a,b){
    if(a.name==='鼠'&&b.name==='象')return true;
    if(a.name==='象'&&b.name==='鼠')return false;
    return a.rank>=b.rank;
  }
  document.getElementById('anResign').onclick=()=>{if(over)return;over=true;winner=cur==='red'?'蓝方胜(红投降)':'红方胜(蓝投降)';log.push('🏳️ '+winner);render();};
  document.getElementById('anSettle').onclick=()=>{
    if(over)return;
    const redCount=countAllAnimals('red');
    const blueCount=countAllAnimals('blue');
    over=true;
    if(redCount>blueCount)winner=`红方获胜(红${redCount}只 vs 蓝${blueCount}只)`;
    else if(blueCount>redCount)winner=`蓝方获胜(红${redCount}只 vs 蓝${blueCount}只)`;
    else winner=`平局(双方各${redCount}只)`;
    log.push('📊 '+winner);render();
  };
  document.getElementById('anUndo').onclick=()=>{if(!history.length)return;const s=history.pop();board=s.board;cur=s.cur;over=s.over;winner=s.winner;selected=s.selected;log=s.log;render();};
  document.getElementById('anRestart').onclick=()=>{resetBoard();cur='red';over=false;winner=null;history=[];log=[];render();};
  const getState =()=>({game:'animal',board,cur,over,winner,log});
  const setState =(s)=>{board=s.board;cur=s.cur;over=s.over;winner=s.winner;selected=null;log=s.log||[];history=[];render();};
  render();
  return { getState, setState };
}

  window.__games = window.__games || {};
  window.__games['animal'] = { init };
})();
