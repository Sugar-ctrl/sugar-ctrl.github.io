/* air */
(function(){
  const { drawCrossLines, addAxisLabels, renderLog } = window.GameCommon;

/* ⑪ 空战棋 */
function init(container){
  const SIZE=15;
  function makePlane(wingCols, bodyLen, tailCols){
    const rows=bodyLen+3;
    const cols=Math.max(wingCols,tailCols);
    const m=Array.from({length:rows},()=>Array(cols).fill(0));
    const midC=Math.floor(cols/2);
    m[0][midC]=1;
    const wingStart=Math.floor((cols-wingCols)/2);
    for(let c=0;c<wingCols;c++){if(wingStart+c<cols)m[1][wingStart+c]=1;}
    for(let r=2;r<=1+bodyLen;r++){if(r<rows)m[r][midC]=1;}
    const lastR=rows-1;
    const tailStart=Math.floor((cols-tailCols)/2);
    for(let c=0;c<tailCols;c++){if(tailStart+c<cols)m[lastR][tailStart+c]=1;}
    return m;
  }
  const PLANE_DEFS=[
    {name:'战斗机',shape:[[1]],count:3,score:1},
    {name:'侦察机',shape:makePlane(3,0,0),count:2,score:2},
    {name:'运输机',shape:makePlane(5,2,3),count:2,score:3},
    {name:'战术轰炸机',shape:makePlane(5,3,3),count:1,score:5},
    {name:'战略轰炸机',shape:makePlane(7,3,5),count:1,score:8}
  ];
  PLANE_DEFS.forEach(p=>{
    p.rows=p.shape.length;
    p.cols=p.shape[0].length;
    p.cellCount=0;
    p.shape.forEach(row=>row.forEach(v=>{if(v)p.cellCount++;}));
  });
  let boards={red:Array.from({length:SIZE},()=>Array(SIZE).fill(-1)),
              blue:Array.from({length:SIZE},()=>Array(SIZE).fill(-1))};
  let planeCells={red:[],blue:[]};
  let hits={red:Array.from({length:SIZE},()=>Array(SIZE).fill(false)),
            blue:Array.from({length:SIZE},()=>Array(SIZE).fill(false))};
  let phase='place-red';
  let selectedPlane=null;
  let previewCells=[];
  let battleView='blue';
  let curPlayer='red';
  let scores={red:0,blue:0};
  let over=false,winner=null;
  let log=[];
  container.innerHTML=`
  <div class="game-page active">
    <div class="game-head"><div class="game-title">🛩️ 空战棋 · 15×15 云朵之上</div></div>
    <div class="game-body">
      <div class="sidebar">
        <div class="panel"><h4>状态</h4><div class="status-text" id="airStatus">红方布置</div></div>
        <div class="panel"><h4>分数</h4>
          <div class="naval-score">
            <span class="red">红: <span id="airScoreRed">0</span></span>
            <span class="blue">蓝: <span id="airScoreBlue">0</span></span>
          </div>
        </div>
        <div class="panel"><h4>日志</h4><div class="naval-log" id="airLog"></div></div>
        <div class="panel"><h4>功能</h4><div class="actions">
          <button class="act" id="airRotate">🔄 旋转</button>
          <button class="act" id="airConfirm">✅ 确定</button>
          <button class="act" id="airSettle">📊 结算</button>
          <button class="act" id="airRestart">🔄 重开</button>
        </div></div>
      </div>
      <div class="board-wrap" id="airWrap"></div>
    </div>
  </div>`;
  const wrap=document.getElementById('airWrap');
  const statusEl=document.getElementById('airStatus');
  const logEl=document.getElementById('airLog');
  const scoreRedEl=document.getElementById('airScoreRed');
  const scoreBlueEl=document.getElementById('airScoreBlue');
  function getPlacedCount(color,typeIdx){return planeCells[color].filter(s=>s.typeIdx===typeIdx).length;}
  function allPlaced(color){for(let i=0;i<PLANE_DEFS.length;i++){if(getPlacedCount(color,i)<PLANE_DEFS[i].count)return false;}return true;}
  function isPlaced(color,typeIdx,countIdx){return getPlacedCount(color,typeIdx) > countIdx;}
  function isDown(color,plane){let hit=0;for(const[r,c]of plane.cells){if(hits[color][r][c])hit++;}return hit/plane.cells.length >= 0.5;}
  function allDown(color){const planes=planeCells[color];if(planes.length===0)return false;return planes.every(s=>isDown(color,s));}
  function findPlaneAt(color,r,c){return planeCells[color].find(s=>s.cells.some(([sr,sc])=>sr===r&&sc===c));}
  function render(){
    wrap.innerHTML='';
    const wrapper=document.createElement('div');wrapper.className='air-wrapper';
    if(phase==='place-red'||phase==='place-blue')wrapper.appendChild(renderPlacePhase(phase==='place-red'?'red':'blue'));
    else wrapper.appendChild(renderBattlePhase());
    wrap.appendChild(wrapper);
    statusEl.textContent=over?('🏆 '+(winner||'结束')):
      (phase==='place-red'?'红方布置':phase==='place-blue'?'蓝方布置':
        (curPlayer==='red'?'红方侦察 (查看蓝方空域)':'蓝方侦察 (查看红方空域)'));
    scoreRedEl.textContent=scores.red;
    scoreBlueEl.textContent=scores.blue;
    logEl.innerHTML=log.slice(-15).map(l=>`<div>${l}</div>`).join('');
  }
  function planeMiniGrid(def){
    const rows=def.rows,cols=def.cols;
    let html='<div class="mini-grid" style="grid-template-columns:repeat('+cols+',12px)">';
    for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){
      const v=def.shape[r][c];
      html+=v?`<div class="mini-cell"></div>`:`<div class="mini-cell empty"></div>`;
    }
    html+='</div>';
    return html;
  }
  function renderPlacePhase(color){
    const div=document.createElement('div');
    div.style.display='flex';div.style.flexDirection='column';div.style.gap='12px';div.style.alignItems='center';
    const title=document.createElement('div');title.className='naval-phase';
    title.textContent=`${color==='red'?'红方':'蓝方'}布置 — 点击飞机再点空域放置, 可旋转`;
    div.appendChild(title);
    const planesDiv=document.createElement('div');planesDiv.className='air-ships';
    PLANE_DEFS.forEach((t,ti)=>{
      for(let ci=0;ci<t.count;ci++){
        const isP=isPlaced(color,ti,ci);
        const item=document.createElement('div');
        item.className='air-ship-item '+(color==='blue'?'blue':'red')+(isP?' placed':'');
        item.innerHTML=planeMiniGrid(t);
        const nameDiv=document.createElement('div');
        nameDiv.textContent=`${t.name}(${t.cols}×${t.rows})${isP?'✓':''}`;
        nameDiv.style.marginTop='2px';
        item.appendChild(nameDiv);
        if(!isP)item.onclick=()=>{selectedPlane={color,typeIdx:ti,countIdx:ci,rotated:false};previewCells=[];render();};
        if(selectedPlane&&selectedPlane.color===color&&selectedPlane.typeIdx===ti&&selectedPlane.countIdx===ci){item.style.background='#fffbe8';item.style.borderColor='#f1c40f';}
        planesDiv.appendChild(item);
      }
    });
    div.appendChild(planesDiv);
    const boardDiv=document.createElement('div');boardDiv.className='air-board';
    for(let r=0;r<SIZE;r++)for(let c=0;c<SIZE;c++){
      const cell=document.createElement('div');cell.className='air-cell';
      const v=boards[color][r][c];
      if(v>=0){cell.classList.add(color+'-plane');cell.innerHTML='<div class="plane-cell">■</div>';}
      if(previewCells.some(([pr,pc])=>pr===r&&pc===c))cell.classList.add('preview-valid');
      cell.onmouseenter=()=>{if(!selectedPlane||selectedPlane.color!==color)return;updatePreview(r,c);};
      cell.onmouseleave=()=>{previewCells=[];document.querySelectorAll('.air-cell.preview-valid').forEach(el=>el.classList.remove('preview-valid'));};
      cell.onclick=()=>placePlane(r,c,color);
      boardDiv.appendChild(cell);
    }
    div.appendChild(boardDiv);
    return div;
  }
  function getPlaneCells(typeIdx,r,c,rotated){
    const def=PLANE_DEFS[typeIdx];
    const rows=def.rows,cols=def.cols;
    const cells=[];
    for(let i=0;i<rows;i++)for(let j=0;j<cols;j++){
      if(!def.shape[i][j])continue;
      let nr,nc;
      if(!rotated){nr=r+i;nc=c+j;}
      else{nr=r+j;nc=c+(cols-1-i);}
      cells.push([nr,nc]);
    }
    return cells;
  }
  function updatePreview(r,c){
    if(!selectedPlane)return;
    const color=selectedPlane.color;
    const cells=getPlaneCells(selectedPlane.typeIdx,r,c,selectedPlane.rotated);
    let valid=true;
    for(const[nr,nc]of cells){
      if(nr<0||nr>=SIZE||nc<0||nc>=SIZE){valid=false;break;}
      if(boards[color][nr][nc]!==-1){valid=false;break;}
    }
    if(!valid)cells.length=0;
    previewCells=cells;
    const boardDiv=document.querySelector('.air-board');
    if(boardDiv){
      const allCells=boardDiv.children;
      document.querySelectorAll('.air-cell.preview-valid').forEach(el=>el.classList.remove('preview-valid'));
      cells.forEach(([rr,cc])=>{const idx=rr*SIZE+cc;if(allCells[idx])allCells[idx].classList.add('preview-valid');});
    }
  }
  function placePlane(r,c,color){
    if(!selectedPlane||selectedPlane.color!==color)return;
    const cells=getPlaneCells(selectedPlane.typeIdx,r,c,selectedPlane.rotated);
    for(const[nr,nc]of cells){
      if(nr<0||nr>=SIZE||nc<0||nc>=SIZE)return;
      if(boards[color][nr][nc]!==-1)return;
    }
    const placeIdx=planeCells[color].length;
    cells.forEach(([rr,cc])=>{boards[color][rr][cc]=placeIdx;});
    planeCells[color].push({typeIdx:selectedPlane.typeIdx,cells});
    log.push(`${color==='red'?'🔴 红方':'🔵 蓝方'} 放置了 ${PLANE_DEFS[selectedPlane.typeIdx].name}`);
    selectedPlane=null;previewCells=[];
    render();
  }
  function renderBattlePhase(){
    const div=document.createElement('div');
    div.style.display='flex';div.style.flexDirection='column';div.style.gap='12px';div.style.alignItems='center';
    const title=document.createElement('div');title.className='naval-phase';
    title.textContent=`${curPlayer==='red'?'红方':'蓝方'}侦察 — 这是${battleView==='red'?'红方':'蓝方'}空域, 点击☁️揭开`;
    div.appendChild(title);
    const boardDiv=document.createElement('div');boardDiv.className='air-board';
    for(let r=0;r<SIZE;r++)for(let c=0;c<SIZE;c++){
      const cell=document.createElement('div');cell.className='air-cell';
      const v=boards[battleView][r][c];
      const isHit=hits[battleView][r][c];
      if(v>=0){
        const plane=findPlaneAt(battleView,r,c);
        if(plane&&isDown(battleView,plane))cell.classList.add('sunk');
        else if(isHit)cell.classList.add('hit');
        else{cell.classList.add('cloud');cell.onclick=()=>attack(r,c);}
      }else{
        if(isHit)cell.classList.add('miss');
        else{cell.classList.add('cloud');cell.onclick=()=>attack(r,c);}
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
    let plane=null;
    if(v>=0)plane=findPlaneAt(viewColor,r,c);
    const attacker=curPlayer;
    const viewName=viewColor==='red'?'红方':'蓝方';
    if(v>=0&&plane){
      if(isDown(viewColor,plane)){const score=PLANE_DEFS[plane.typeIdx].score;scores[attacker]+=score;log.push(`${attacker==='red'?'🔴 红方':'🔵 蓝方'} 侦察 (${r+1},${c+1}) 击落 ${viewName} ${PLANE_DEFS[plane.typeIdx].name} +${score}分`);}
      else log.push(`${attacker==='red'?'🔴 红方':'🔵 蓝方'} 侦察 (${r+1},${c+1}) 命中 ${viewName} ${PLANE_DEFS[plane.typeIdx].name}`);
    }else log.push(`${attacker==='red'?'🔴 红方':'🔵 蓝方'} 侦察 (${r+1},${c+1}) 未命中`);
    if(allDown(viewColor)){over=true;winner=(attacker==='red'?'红方':'蓝方')+'获胜 (击落对方全部飞机)';log.push('🏆 '+winner);render();return;}
    curPlayer=curPlayer==='red'?'blue':'red';
    battleView=battleView==='red'?'blue':'red';
    render();
  }
  document.getElementById('airRotate').onclick=()=>{if(selectedPlane){selectedPlane.rotated=!selectedPlane.rotated;previewCells=[];render();}};
  document.getElementById('airConfirm').onclick=()=>{
    if(phase==='place-red'){
      if(!allPlaced('red')){alert('红方还有飞机未放置!');return;}
      phase='place-blue';selectedPlane=null;previewCells=[];log.push('红方布置完成, 轮到蓝方');render();
    }else if(phase==='place-blue'){
      if(!allPlaced('blue')){alert('蓝方还有飞机未放置!');return;}
      phase='battle';curPlayer='red';battleView='blue';selectedPlane=null;previewCells=[];log.push('双方布置完成, 开始对战! 红方先攻');render();
    }
  };
  document.getElementById('airSettle').onclick=()=>{if(over)return;over=true;if(scores.red>scores.blue)winner=`红方获胜(分数 ${scores.red} vs ${scores.blue})`;else if(scores.blue>scores.red)winner=`蓝方获胜(分数 ${scores.red} vs ${scores.blue})`;else winner=`平局(双方分数 ${scores.red})`;log.push('📊 '+winner);render();};
  document.getElementById('airRestart').onclick=()=>{
    phase='place-red';
    boards={red:Array.from({length:SIZE},()=>Array(SIZE).fill(-1)),blue:Array.from({length:SIZE},()=>Array(SIZE).fill(-1))};
    hits={red:Array.from({length:SIZE},()=>Array(SIZE).fill(false)),blue:Array.from({length:SIZE},()=>Array(SIZE).fill(false))};
    planeCells={red:[],blue:[]};selectedPlane=null;previewCells=[];
    battleView='blue';curPlayer='red';scores={red:0,blue:0};over=false;winner=null;log=[];
    render();
  };
  const getState =()=>({game:'air',boards,planeCells,hits,phase,battleView,curPlayer,scores,over,winner,log});
  const setState =(s)=>{
    boards=s.boards;planeCells=s.planeCells;hits=s.hits;phase=s.phase;battleView=s.battleView;
    curPlayer=s.curPlayer;scores=s.scores;over=s.over;winner=s.winner;log=s.log||[];
    selectedPlane=null;previewCells=[];render();
  };
  render();
  return { getState, setState };
}

  window.__games = window.__games || {};
  window.__games['air'] = { init };
})();
