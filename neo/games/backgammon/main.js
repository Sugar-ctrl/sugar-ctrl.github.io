/* backgammon */
(function(){
  const { drawCrossLines, addAxisLabels, renderLog } = window.GameCommon;

/* ⑬ 双陆棋 */
function init(container){
  let points=Array.from({length:24},()=>[]);
  points[23]=Array(5).fill('white');
  points[18]=Array(3).fill('white');
  points[12]=Array(5).fill('white');
  points[1]=Array(2).fill('white');
  points[0]=Array(5).fill('black');
  points[5]=Array(3).fill('black');
  points[16]=Array(5).fill('black');
  points[11]=Array(2).fill('black');
  let whiteOut=0, blackOut=0;
  let cur='white',over=false,winner=null;
  let dice=[],usedDice=[];
  let phase='roll';
  let selectedPoint=null;
  let log=[];
  container.innerHTML=`
  <div class="game-page active">
    <div class="game-head"><div class="game-title">🎲 双陆棋 · 西洋双陆</div></div>
    <div class="game-body">
      <div class="sidebar">
        <div class="panel"><h4>规则</h4><div class="rule-text">
          白先黑后。掷两枚骰子, 按点数移动棋子。<br>
          白方从23往0方向移动, 黑方从0往23方向移动。<br>
          目标: 将全部15枚棋子移出棋盘。若点数被对方单子占住, 则不能停在该点。
        </div></div>
        <div class="panel"><h4>状态</h4><div class="status-text" id="bgStatus">⚪ 白方掷骰</div></div>
        <div class="panel"><h4>棋盘信息</h4><div class="backgammon-info" id="bgInfo">白出: 0 / 黑出: 0</div></div>
        <div class="panel"><h4>日志</h4><div class="naval-log" id="bgLog"></div></div>
        <div class="panel"><h4>功能</h4><div class="actions">
          <button class="act" id="bgResign">🏳️ 投降</button>
          <button class="act" id="bgSettle">📊 结算</button>
          <button class="act" id="bgRestart">🔄 重开</button>
        </div></div>
      </div>
      <div class="board-wrap" id="bgWrap"></div>
    </div>
  </div>`;
  const wrap=document.getElementById('bgWrap'),statusEl=document.getElementById('bgStatus'),infoEl=document.getElementById('bgInfo');
  function render(){
    wrap.innerHTML='';
    const d=document.createElement('div');d.className='backgammon-board';
    const half1=document.createElement('div');half1.className='backgammon-half';
    const half2=document.createElement('div');half2.className='backgammon-half';
    function makePoint(idx,isBottom){
      const p=document.createElement('div');
      p.className='backgammon-point '+(idx%2===0?'dark-tri':'light-tri')+(isBottom?' bottom':'');
      p.dataset.idx=idx;
      if(selectedPoint===idx)p.classList.add('highlight');
      const arr=points[idx];
      const maxShow=5;
      arr.slice(0,maxShow).forEach(color=>{
        const c=document.createElement('div');c.className='checker '+color;
        c.textContent=color==='white'?'○':'●';
        p.appendChild(c);
      });
      if(arr.length>maxShow){
        const more=document.createElement('div');more.style.fontSize='.7rem';more.textContent='+'+(arr.length-maxShow);p.appendChild(more);
      }
      p.onclick=()=>clickPoint(idx);
      return p;
    }
    for(let i=0;i<6;i++)half1.appendChild(makePoint(12+i,false));
    for(let i=0;i<6;i++)half1.appendChild(makePoint(6+i,true));
    for(let i=0;i<6;i++)half2.appendChild(makePoint(18+i,false));
    for(let i=0;i<6;i++)half2.appendChild(makePoint(0+i,true));
    d.appendChild(half1);
    const bar=document.createElement('div');bar.className='backgammon-bar';
    for(let i=0;i<Math.min(3,whiteOut);i++){const c=document.createElement('div');c.className='checker white';bar.appendChild(c);}
    for(let i=0;i<Math.min(3,blackOut);i++){const c=document.createElement('div');c.className='checker black';bar.appendChild(c);}
    d.appendChild(bar);
    d.appendChild(half2);
    wrap.appendChild(d);
    const diceArea=document.createElement('div');diceArea.className='backgammon-dice';
    dice.forEach((v,i)=>{
      const die=document.createElement('div');die.className='backgammon-die'+(usedDice.includes(i)?' used':'');
      const symbols=['','⚀','⚁','⚂','⚃','⚄','⚅'];
      die.textContent=symbols[v];
      if(!usedDice.includes(i)&&phase==='move')die.onclick=()=>useDie(i);
      diceArea.appendChild(die);
    });
    wrap.appendChild(diceArea);
    if(phase==='roll'&&!over){
      const rollBtn=document.createElement('button');rollBtn.className='btn primary';rollBtn.textContent='🎲 掷骰子';
      rollBtn.style.marginTop='12px';
      rollBtn.onclick=rollDice;
      wrap.appendChild(rollBtn);
    }
    statusEl.textContent=over?('🏆 '+(winner||'结束')):(cur==='white'?'⚪ 白方':'⚫ 黑方')+(phase==='roll'?' 掷骰':' 走棋');
    infoEl.textContent=`白出: ${whiteOut}/15 · 黑出: ${blackOut}/15`;
    renderLog('bgLog',log);
  }
  function rollDice(){
    if(over||phase!=='roll')return;
    const d1=Math.floor(Math.random()*6)+1;
    const d2=Math.floor(Math.random()*6)+1;
    dice=[d1,d2];
    usedDice=[];
    phase='move';
    log.push(`🎲 ${cur==='white'?'⚪ 白方':'⚫ 黑方'} 掷出 ${d1}, ${d2}`);
    render();
  }
  function useDie(i){
    if(phase!=='move'||over)return;
    const steps=dice[i];
    if(selectedPoint!==null){
      if(!moveFrom(selectedPoint,steps)){
        selectedPoint=null;
        usedDice.push(i);
        render();
        return;
      }
      usedDice.push(i);
      selectedPoint=null;
      if(usedDice.length>=dice.length) nextTurn();
      render();
    }else{
      alert('请先点击要移动的棋子');
    }
  }
  function clickPoint(idx){
    if(over||phase!=='move')return;
    const arr=points[idx];
    if(selectedPoint===null){
      if(arr.length>0&&arr[0]===cur){
        selectedPoint=idx;
        render();
      }
    }else{
      const unusedIdx=dice.map((v,i)=>usedDice.includes(i)?-1:i).filter(i=>i>=0);
      if(unusedIdx.length===0){selectedPoint=null;render();return;}
      let moved=false;
      for(const ui of unusedIdx){
        const steps=dice[ui];
        if(moveFrom(selectedPoint,steps)){
          usedDice.push(ui);
          moved=true;
          break;
        }
      }
      if(moved){
        selectedPoint=null;
        if(usedDice.length>=dice.length)nextTurn();
      }else{
        if(arr.length>0&&arr[0]===cur)selectedPoint=idx;
        else selectedPoint=null;
      }
      render();
    }
  }
  function moveFrom(from,steps){
    const dir=cur==='white'?-1:1;
    const target=from+dir*steps;
    if(cur==='white'&&target<0){
      let allHome=true;
      for(let i=6;i<24;i++)if(points[i].some(c=>c==='white'))allHome=false;
      if(!allHome)return false;
      points[from].pop();
      whiteOut++;
      log.push(`⚪ 白方 ${from+1}→出棋`);
      if(whiteOut>=15){over=true;winner='白方获胜';log.push('🏆 '+winner);}
      return true;
    }
    if(cur==='black'&&target>23){
      let allHome=true;
      for(let i=0;i<18;i++)if(points[i].some(c=>c==='black'))allHome=false;
      if(!allHome)return false;
      points[from].pop();
      blackOut++;
      log.push(`⚫ 黑方 ${from+1}→出棋`);
      if(blackOut>=15){over=true;winner='黑方获胜';log.push('🏆 '+winner);}
      return true;
    }
    if(target<0||target>23)return false;
    const t=points[target];
    if(t.length>0&&t[0]!==cur){
      if(t.length>=2)return false;
      t.pop();
      log.push(`${cur==='white'?'⚪ 白方':'⚫ 黑方'} ${from+1}→${target+1} 吃子`);
    } else {
      log.push(`${cur==='white'?'⚪ 白方':'⚫ 黑方'} ${from+1}→${target+1}`);
    }
    points[from].pop();
    points[target].push(cur);
    return true;
  }
  function nextTurn(){
    cur=cur==='white'?'black':'white';
    dice=[];
    usedDice=[];
    phase='roll';
    selectedPoint=null;
  }
  document.getElementById('bgResign').onclick=()=>{if(over)return;over=true;winner=cur==='white'?'黑方胜(白投降)':'白方胜(黑投降)';log.push('🏳️ '+winner);render();};
  document.getElementById('bgSettle').onclick=()=>{
    if(over)return;
    over=true;
    if(whiteOut>blackOut)winner=`白方获胜(白出${whiteOut} vs 黑出${blackOut})`;
    else if(blackOut>whiteOut)winner=`黑方获胜(白出${whiteOut} vs 黑出${blackOut})`;
    else winner=`平局(白出${whiteOut} 黑出${blackOut})`;
    log.push('📊 '+winner);render();
  };
  document.getElementById('bgRestart').onclick=()=>{
    points=Array.from({length:24},()=>[]);
    points[23]=Array(5).fill('white');
    points[18]=Array(3).fill('white');
    points[12]=Array(5).fill('white');
    points[1]=Array(2).fill('white');
    points[0]=Array(5).fill('black');
    points[5]=Array(3).fill('black');
    points[16]=Array(5).fill('black');
    points[11]=Array(2).fill('black');
    whiteOut=0;blackOut=0;
    cur='white';over=false;winner=null;dice=[];usedDice=[];phase='roll';selectedPoint=null;log=[];
    render();
  };
  const getState =()=>({game:'backgammon',points,whiteOut,blackOut,cur,over,winner,dice,usedDice,phase,log});
  const setState =(s)=>{
    points=s.points;whiteOut=s.whiteOut;blackOut=s.blackOut;cur=s.cur;over=s.over;winner=s.winner;
    dice=s.dice||[];usedDice=s.usedDice||[];phase=s.phase;log=s.log||[];selectedPoint=null;render();
  };
  render();
  return { getState, setState };
}

  window.__games = window.__games || {};
  window.__games['backgammon'] = { init };
})();
