/* naval */
(function(){
  const { drawCrossLines, addAxisLabels, renderLog } = window.GameCommon;

/* ⑩ 海战棋 */
function init(container){
  const SIZE=10;
  const SHIP_TYPES=[
    {name:'潜艇',rows:1,cols:1,count:3,score:1},
    {name:'护卫舰',rows:1,cols:2,count:2,score:2},
    {name:'驱逐舰',rows:1,cols:3,count:2,score:3},
    {name:'巡洋舰',rows:2,cols:3,count:1,score:5},
    {name:'战列舰',rows:2,cols:4,count:1,score:8},
    {name:'航空母舰',rows:2,cols:5,count:1,score:12}
  ];
  let boards={red:Array.from({length:SIZE},()=>Array(SIZE).fill(-1)),
              blue:Array.from({length:SIZE},()=>Array(SIZE).fill(-1))};
  let shipCells={red:[],blue:[]};
  let hits={red:Array.from({length:SIZE},()=>Array(SIZE).fill(false)),
            blue:Array.from({length:SIZE},()=>Array(SIZE).fill(false))};
  let phase='place-red';
  let selectedShip=null;
  let previewCells=[];
  let battleView='blue';
  let curPlayer='red';
  let scores={red:0,blue:0};
  let over=false,winner=null;
  let log=[];
  container.innerHTML=`
  <div class="game-page active">
    <div class="game-head"><div class="game-title">🚢 海战棋</div></div>
    <div class="game-body">
      <div class="sidebar">
        <div class="panel"><h4>状态</h4><div class="status-text" id="navalStatus">红方布置</div></div>
        <div class="panel"><h4>分数</h4>
          <div class="naval-score">
            <span class="red">红: <span id="scoreRed">0</span></span>
            <span class="blue">蓝: <span id="scoreBlue">0</span></span>
          </div>
        </div>
        <div class="panel"><h4>日志</h4><div class="naval-log" id="navalLog"></div></div>
        <div class="panel"><h4>功能</h4><div class="actions">
          <button class="act" id="navalRotate">🔄 旋转</button>
          <button class="act" id="navalConfirm">✅ 确定</button>
          <button class="act" id="navalSettle">📊 结算</button>
          <button class="act" id="navalRestart">🔄 重开</button>
        </div></div>
      </div>
      <div class="board-wrap" id="navalWrap"></div>
    </div>
  </div>`;
  const wrap=document.getElementById('navalWrap');
  const statusEl=document.getElementById('navalStatus');
  const logEl=document.getElementById('navalLog');
  const scoreRedEl=document.getElementById('scoreRed');
  const scoreBlueEl=document.getElementById('scoreBlue');
  function getPlacedCount(color,typeIdx){return shipCells[color].filter(s=>s.typeIdx===typeIdx).length;}
  function allPlaced(color){for(let i=0;i<SHIP_TYPES.length;i++){if(getPlacedCount(color,i)<SHIP_TYPES[i].count)return false;}return true;}
  function isPlaced(color,typeIdx,countIdx){return getPlacedCount(color,typeIdx) > countIdx;}
  function isSunk(color,ship){let hit=0;for(const[r,c]of ship.cells){if(hits[color][r][c])hit++;}return hit/ship.cells.length >= 0.5;}
  function allSunk(color){const ships=shipCells[color];if(ships.length===0)return false;return ships.every(s=>isSunk(color,s));}
  function findShipAt(color,r,c){return shipCells[color].find(s=>s.cells.some(([sr,sc])=>sr===r&&sc===c));}
  function render(){
    wrap.innerHTML='';
    const wrapper=document.createElement('div');wrapper.className='naval-wrapper';
    if(phase==='place-red'||phase==='place-blue')wrapper.appendChild(renderPlacePhase(phase==='place-red'?'red':'blue'));
    else wrapper.appendChild(renderBattlePhase());
    wrap.appendChild(wrapper);
    statusEl.textContent=over?('🏆 '+(winner||'结束')):
      (phase==='place-red'?'红方布置':phase==='place-blue'?'蓝方布置':
        (curPlayer==='red'?'红方攻击 (查看蓝方棋盘)':'蓝方攻击 (查看红方棋盘)'));
    scoreRedEl.textContent=scores.red;
    scoreBlueEl.textContent=scores.blue;
    logEl.innerHTML=log.slice(-15).map(l=>`<div>${l}</div>`).join('');
  }
  function renderPlacePhase(color){
    const div=document.createElement('div');
    div.style.display='flex';div.style.flexDirection='column';div.style.gap='12px';div.style.alignItems='center';
    const title=document.createElement('div');title.className='naval-phase';
    title.textContent=`${color==='red'?'红方':'蓝方'}布置 — 点击军舰再点棋盘放置, 可旋转`;
    div.appendChild(title);
    const shipsDiv=document.createElement('div');shipsDiv.className='naval-ships';
    SHIP_TYPES.forEach((t,ti)=>{
      for(let ci=0;ci<t.count;ci++){
        const isP=isPlaced(color,ti,ci);
        const item=document.createElement('div');
        item.className='naval-ship-item '+(color==='blue'?'blue':'')+(isP?' placed':'');
        const preview=document.createElement('div');preview.className='ship-preview';
        preview.style.gridTemplateColumns=`repeat(${t.cols},12px)`;
        for(let i=0;i<t.rows*t.cols;i++){const mini=document.createElement('div');mini.className='cell-mini';preview.appendChild(mini);}
        item.appendChild(preview);
        item.appendChild(document.createTextNode(`${t.name}(${t.rows}×${t.cols})${isP?'✓':''}`));
        if(!isP)item.onclick=()=>{selectedShip={color,typeIdx:ti,countIdx:ci,rotated:false};previewCells=[];render();};
        if(selectedShip&&selectedShip.color===color&&selectedShip.typeIdx===ti&&selectedShip.countIdx===ci){item.style.background='#fffbe8';item.style.borderColor='#f1c40f';}
        shipsDiv.appendChild(item);
      }
    });
    div.appendChild(shipsDiv);
    const boardDiv=document.createElement('div');boardDiv.className='naval-board';
    for(let r=0;r<SIZE;r++)for(let c=0;c<SIZE;c++){
      const cell=document.createElement('div');cell.className='naval-cell';
      if(boards[color][r][c]>=0)cell.classList.add('ship-'+color);
      if(previewCells.some(([pr,pc])=>pr===r&&pc===c))cell.classList.add('preview-valid');
      cell.onmouseenter=()=>{if(!selectedShip||selectedShip.color!==color)return;updatePreview(r,c);};
      cell.onmouseleave=()=>{previewCells=[];document.querySelectorAll('.naval-cell.preview-valid').forEach(el=>el.classList.remove('preview-valid'));};
      cell.onclick=()=>placeShip(r,c,color);
      boardDiv.appendChild(cell);
    }
    div.appendChild(boardDiv);
    return div;
  }
  function updatePreview(r,c){
    if(!selectedShip)return;
    const color=selectedShip.color;
    const t=SHIP_TYPES[selectedShip.typeIdx];
    const rows=selectedShip.rotated?t.cols:t.rows;
    const cols=selectedShip.rotated?t.rows:t.cols;
    const cells=[];
    let valid=true;
    for(let i=0;i<rows;i++)for(let j=0;j<cols;j++){
      const nr=r+i,nc=c+j;
      if(nr>=SIZE||nc>=SIZE){valid=false;break;}
      if(boards[color][nr][nc]!==-1){valid=false;break;}
      cells.push([nr,nc]);
    }
    if(!valid)cells.length=0;
    previewCells=cells;
    const boardDiv=document.querySelector('.naval-board');
    if(boardDiv){
      const allCells=boardDiv.children;
      document.querySelectorAll('.naval-cell.preview-valid').forEach(el=>el.classList.remove('preview-valid'));
      cells.forEach(([rr,cc])=>{const idx=rr*SIZE+cc;if(allCells[idx])allCells[idx].classList.add('preview-valid');});
    }
  }
  function placeShip(r,c,color){
    if(!selectedShip||selectedShip.color!==color)return;
    const t=SHIP_TYPES[selectedShip.typeIdx];
    const rows=selectedShip.rotated?t.cols:t.rows;
    const cols=selectedShip.rotated?t.rows:t.cols;
    const cells=[];
    for(let i=0;i<rows;i++)for(let j=0;j<cols;j++){
      const nr=r+i,nc=c+j;
      if(nr>=SIZE||nc>=SIZE)return;
      if(boards[color][nr][nc]!==-1)return;
      cells.push([nr,nc]);
    }
    const placeIdx=shipCells[color].length;
    cells.forEach(([rr,cc])=>{boards[color][rr][cc]=placeIdx;});
    shipCells[color].push({typeIdx:selectedShip.typeIdx,cells});
    log.push(`${color==='red'?'🔴 红方':'🔵 蓝方'} 放置了 ${t.name}`);
    selectedShip=null;previewCells=[];
    render();
  }
  function renderBattlePhase(){
    const div=document.createElement('div');
    div.style.display='flex';div.style.flexDirection='column';div.style.gap='12px';div.style.alignItems='center';
    const title=document.createElement('div');title.className='naval-phase';
    title.textContent=`${curPlayer==='red'?'红方':'蓝方'}攻击 — 这是${battleView==='red'?'红方':'蓝方'}的棋盘, 点击🌊揭开`;
    div.appendChild(title);
    const boardDiv=document.createElement('div');boardDiv.className='naval-board';
    for(let r=0;r<SIZE;r++)for(let c=0;c<SIZE;c++){
      const cell=document.createElement('div');cell.className='naval-cell';
      const v=boards[battleView][r][c];
      const isHit=hits[battleView][r][c];
      if(v>=0){
        const ship=findShipAt(battleView,r,c);
        if(ship&&isSunk(battleView,ship))cell.classList.add('sunk');
        else if(isHit)cell.classList.add('hit');
        else{cell.classList.add('wave');cell.onclick=()=>attack(r,c);}
      }else{
        if(isHit)cell.classList.add('miss');
        else{cell.classList.add('wave');cell.onclick=()=>attack(r,c);}
      }
      boardDiv.appendChild(cell);
    }
    div.appendChild(boardDiv);
    return div;
  }
  function attack(r,c){
    if(over||phase!=='battle')return;
    const viewColor=battleView;
    if(hits[viewColor][r][c])return;
    hits[viewColor][r][c]=true;
    const v=boards[viewColor][r][c];
    let ship=null;
    if(v>=0)ship=findShipAt(viewColor,r,c);
    const attacker=curPlayer;
    const viewName=viewColor==='red'?'红方':'蓝方';
    if(v>=0&&ship){
      if(isSunk(viewColor,ship)){const score=SHIP_TYPES[ship.typeIdx].score;scores[attacker]+=score;log.push(`${attacker==='red'?'🔴 红方':'🔵 蓝方'} 攻击 (${r+1},${c+1}) 击毁 ${viewName} ${SHIP_TYPES[ship.typeIdx].name} +${score}分`);}
      else log.push(`${attacker==='red'?'🔴 红方':'🔵 蓝方'} 攻击 (${r+1},${c+1}) 命中 ${viewName} ${SHIP_TYPES[ship.typeIdx].name}`);
    }else log.push(`${attacker==='red'?'🔴 红方':'🔵 蓝方'} 攻击 (${r+1},${c+1}) 未命中`);
    if(allSunk(viewColor)){over=true;winner=(attacker==='red'?'红方':'蓝方')+'获胜 (击毁对方全部军舰)';log.push('🏆 '+winner);render();return;}
    curPlayer=curPlayer==='red'?'blue':'red';
    battleView=battleView==='red'?'blue':'red';
    render();
  }
  document.getElementById('navalRotate').onclick=()=>{if(selectedShip){selectedShip.rotated=!selectedShip.rotated;previewCells=[];render();}};
  document.getElementById('navalConfirm').onclick=()=>{
    if(phase==='place-red'){
      if(!allPlaced('red')){alert('红方还有军舰未放置!');return;}
      phase='place-blue';selectedShip=null;previewCells=[];log.push('红方布置完成, 轮到蓝方');render();
    }else if(phase==='place-blue'){
      if(!allPlaced('blue')){alert('蓝方还有军舰未放置!');return;}
      phase='battle';curPlayer='red';battleView='blue';selectedShip=null;previewCells=[];log.push('双方布置完成, 开始对战! 红方先攻');render();
    }
  };
  document.getElementById('navalSettle').onclick=()=>{if(over)return;over=true;if(scores.red>scores.blue)winner=`红方获胜(分数 ${scores.red} vs ${scores.blue})`;else if(scores.blue>scores.red)winner=`蓝方获胜(分数 ${scores.red} vs ${scores.blue})`;else winner=`平局(双方分数 ${scores.red})`;log.push('📊 '+winner);render();};
  document.getElementById('navalRestart').onclick=()=>{
    phase='place-red';
    boards={red:Array.from({length:SIZE},()=>Array(SIZE).fill(-1)),blue:Array.from({length:SIZE},()=>Array(SIZE).fill(-1))};
    hits={red:Array.from({length:SIZE},()=>Array(SIZE).fill(false)),blue:Array.from({length:SIZE},()=>Array(SIZE).fill(false))};
    shipCells={red:[],blue:[]};selectedShip=null;previewCells=[];
    battleView='blue';curPlayer='red';scores={red:0,blue:0};over=false;winner=null;log=[];
    render();
  };
  const getState =()=>({game:'naval',boards,shipCells,hits,phase,battleView,curPlayer,scores,over,winner,log});
  const setState =(s)=>{
    boards=s.boards;shipCells=s.shipCells;hits=s.hits;phase=s.phase;battleView=s.battleView;
    curPlayer=s.curPlayer;scores=s.scores;over=s.over;winner=s.winner;log=s.log||[];
    selectedShip=null;previewCells=[];render();
  };
  render();
  return { getState, setState };
}

  window.__games = window.__games || {};
  window.__games['naval'] = { init };
})();
