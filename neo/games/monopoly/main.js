/* monopoly */
(function(){
  const { drawCrossLines, addAxisLabels, renderLog } = window.GameCommon;

/* ⑭ 大富翁（5.5 新版逻辑） */
function init(container){
  const PORTALS = [0, 60];
  const JAILS = [14];
  const HOSPITALS = [42];
  const BANKS = [28, 68];
  const CHANCES = [5, 9, 19, 23, 33, 37, 47, 51, 64, 72];

  let totalPlayers = 2;
  let players = [];
  let curPlayer = 0;
  let over = false;
  let winner = null;
  let log = [];
  let round = 1;
  let turnCount = 0;
  let bankOpen = false;
  let properties = [];

  function initGame() {
    players = [];
    for (let i = 0; i < totalPlayers; i++) {
      players.push({
        id: i, name: '玩家' + (i + 1),
        color: ['#e74c3c', '#3498db', '#27ae60', '#f1c40f', '#9b59b6', '#e67e22', '#1abc9c', '#34495e', '#e84393', '#8B4513'][i],
        money: 1000, bank: 0, pos: Math.floor(Math.random() * 80),
        jailTurns: 0, hospitalTurns: 0, skipTurns: 0,
        discount: false, bankrupt: false
      });
    }
    players.forEach(p => {
      while ([0, 14, 28, 42, 60, 68, 56, 57, 58, 59, 76, 77, 78, 79].includes(p.pos)) {
        p.pos = Math.floor(Math.random() * 80);
      }
    });
    curPlayer = 0; over = false; winner = null; log = []; round = 1; turnCount = 0; bankOpen = false;
    properties = Array.from({ length: 80 }, () => ({ owner: null, level: 0, rent: 0 }));
  }

  function getCellPos(i) {
    const W = 100 / 15;
    const INNER_W = 60 / 5;
    if (i < 60) {
      if (i < 15) { return { left: i * W, top: 0, w: W, h: W }; }
      else if (i < 29) { return { left: 100 - W, top: (i - 14) * W, w: W, h: W }; }
      else if (i < 43) { return { left: 100 - W - (i - 28) * W, top: 100 - W, w: W, h: W }; }
      else { return { left: 0, top: 100 - W - (i - 42) * W, w: W, h: W }; }
    } else {
      const j = i - 60;
      if (j === 0) return { left: 20, top: 20, w: INNER_W, h: INNER_W };
      else if (j < 5) return { left: 20 + j * INNER_W, top: 20, w: INNER_W, h: INNER_W };
      else if (j === 5) return { left: 80 - INNER_W, top: 20 + INNER_W, w: INNER_W, h: INNER_W };
      else if (j < 9) return { left: 80 - INNER_W, top: 20 + (j - 4) * INNER_W, w: INNER_W, h: INNER_W };
      else if (j === 9) return { left: 80 - 2 * INNER_W, top: 80 - INNER_W, w: INNER_W, h: INNER_W };
      else if (j < 13) return { left: Math.max(20, 80 - INNER_W - (j - 8) * INNER_W), top: 80 - INNER_W, w: INNER_W, h: INNER_W };
      else if (j === 13) return { left: 20, top: 80 - 2 * INNER_W, w: INNER_W, h: INNER_W };
      else return { left: 20, top: Math.max(20, 80 - INNER_W - (j - 12) * INNER_W), w: INNER_W, h: INNER_W };
    }
  }

  function rentOf(prop) {
    if (!prop || prop.owner === null || prop.rent === 0) return 0;
    let mult = 1;
    if (round >= 6) mult = Math.pow(2, round - 5);
    return prop.rent * mult;
  }

  container.innerHTML = `
  <div class="game-page active">
    <div class="game-head"><div class="game-title">🏠 大富翁 · 外56格 + 内16格 · 传送门</div></div>
    <div class="game-body">
      <div class="sidebar">
        <div class="panel"><h4>设置人数 (2-10人)</h4><div class="mono-setup" id="monoSetup"></div></div>
        <div class="panel"><h4>规则</h4><div class="rule-text">
          每人开局 1000 元，资金 ≤ 0 时强制卖出所有房产并取出存款，总额 ≥ 1000 复活，否则淘汰。<br>
          空地购买 100，别人踩上付 10。<br>
          升级一次 200，租金 20；升级两次 500，租金 50。<br>
          从第 6 轮开始，租金每过 1 轮翻一倍。<br>
          所有玩家各走完一次 = 1 轮。<br>
          银行第 1 轮不开，之后每轮开放；开放时存款产生 20% 利息（<b>利息直接加到资金里，存款不变</b>）。<br>
          踩到银行格存 20% 资金。<br>
          进监狱/医院/抽中跳过，会强制跳过下个回合。<br>
          掷出 6 或 12 可再投一次。<br>
          经过起点获 200 元。外圈 0 传内圈 60，内圈 60 传外圈 0。<br>
          <b>新增：</b>机会有概率抽中“百万英镑”，直接存入银行存款。<br>
          <b>斩杀线：</b>当资金 ≤ 0 时，会先扣除 1000 斩杀线，如果卖完所有资产仍不够复活，直接破产。
        </div></div>
        <div class="panel"><h4>状态</h4><div class="status-text" id="monoStatus">玩家1 掷骰</div></div>
        <div class="panel"><h4>日志</h4><div class="naval-log" id="monoLog"></div></div>
        <div class="panel"><h4>功能</h4><div class="actions">
          <button class="act" id="monoResign">🏳️ 投降</button>
          <button class="act" id="monoSettle">📊 结算</button>
          <button class="act" id="monoRestart">🔄 重开</button>
        </div></div>
      </div>
      <div class="board-wrap" id="monoWrap"></div>
    </div>
  </div>`;

  const wrap = document.getElementById('monoWrap');
  const statusEl = document.getElementById('monoStatus');
  const logEl = document.getElementById('monoLog');
  const setupBox = document.getElementById('monoSetup');
  const tooltip = document.getElementById('cellTooltip');

  function render() {
    wrap.innerHTML = '';
    const d = document.createElement('div');
    d.className = 'monopoly-wrap';
    const board = document.createElement('div');
    board.className = 'mono-board';

    for (let i = 0; i < 80; i++) {
      const pos = getCellPos(i);
      const cellDiv = document.createElement('div');
      cellDiv.className = 'mono-cell';
      cellDiv.style.left = pos.left + '%';
      cellDiv.style.top = pos.top + '%';
      cellDiv.style.width = pos.w + '%';
      cellDiv.style.height = pos.h + '%';

      const numDiv = document.createElement('div');
      numDiv.className = 'cell-num';
      numDiv.textContent = i;
      cellDiv.appendChild(numDiv);

      if (PORTALS.includes(i)) {
        cellDiv.classList.add('portal');
        cellDiv.innerHTML += '<div class="name">传送门</div>';
        cellDiv.style.zIndex = '15';
      } else if (JAILS.includes(i)) {
        cellDiv.classList.add('jail');
        cellDiv.innerHTML += '<div class="name">监狱</div>';
      } else if (HOSPITALS.includes(i)) {
        cellDiv.classList.add('hospital');
        cellDiv.innerHTML += '<div class="name">医院</div>';
      } else if (BANKS.includes(i)) {
        cellDiv.classList.add('bank');
        cellDiv.innerHTML += '<div class="name">银行</div>';
      } else if (CHANCES.includes(i)) {
        cellDiv.classList.add('chance');
        cellDiv.innerHTML += '<div class="name">机会</div>';
      } else {
        cellDiv.innerHTML += '<div class="name">空地</div><div class="price">$100</div>';
        const prop = properties[i];
        if (prop.owner !== null) {
          const bar = document.createElement('div');
          bar.className = 'mono-owner-bar';
          bar.style.background = players[prop.owner].color;
          cellDiv.appendChild(bar);
          const house = document.createElement('div');
          house.className = 'mono-house';
          if (prop.level === 1) house.textContent = '🏠';
          else if (prop.level === 2) house.textContent = '🏡';
          else if (prop.level === 3) house.textContent = '🏢';
          cellDiv.appendChild(house);
        }
      }

      cellDiv.onmouseenter = (e) => {
        let info = `<strong>[${i}] 号格</strong><br>`;
        if (PORTALS.includes(i)) info += "功能：传送门<br>暂无信息";
        else if (JAILS.includes(i)) info += "功能：监狱<br>暂无信息";
        else if (HOSPITALS.includes(i)) info += "功能：医院<br>暂无信息";
        else if (BANKS.includes(i)) info += "功能：银行<br>暂无信息";
        else if (CHANCES.includes(i)) info += "功能：机会<br>暂无信息";
        else {
          const prop = properties[i];
          if (prop.owner === null) info += "空地<br>暂无信息";
          else {
            const ownerName = players[prop.owner].name;
            const basePrice = prop.level === 1 ? 100 : (prop.level === 2 ? 300 : 800);
            const currentRent = rentOf(prop);
            info += `所有者：<span style="color:${players[prop.owner].color}">${ownerName}</span><br>`;
            info += `价值：$${basePrice}<br>当前租金：$${currentRent}`;
          }
        }
        tooltip.innerHTML = info;
        tooltip.style.display = 'block';
        tooltip.style.left = (e.clientX + 15) + 'px';
        tooltip.style.top = (e.clientY + 15) + 'px';
      };
      cellDiv.onmouseleave = () => { tooltip.style.display = 'none'; };

      board.appendChild(cellDiv);
    }

    players.forEach(p => {
      if (p.bankrupt) return;
      const pos = getCellPos(p.pos);
      const centerLeft = pos.left + pos.w / 2;
      const centerTop = pos.top + pos.h / 2;
      const piece = document.createElement('div');
      piece.className = 'mono-piece';
      piece.style.background = p.color;
      piece.style.left = centerLeft + '%';
      piece.style.top = centerTop + '%';
      piece.style.transform = 'translate(-50%, -50%)';
      piece.style.marginLeft = (p.id * 4 - (totalPlayers - 1) * 2) + 'px';
      board.appendChild(piece);
    });

    d.appendChild(board);

    const panel = document.createElement('div');
    panel.className = 'mono-panel';
    players.forEach((p, i) => {
      const card = document.createElement('div');
      card.className = 'mono-player-card' + (i === curPlayer && !over && !p.bankrupt ? ' active' : '') + (p.bankrupt ? ' bankrupt' : '');
      let status = '';
      if (p.jailTurns > 0) status = ' (🚔监狱)';
      else if (p.hospitalTurns > 0) status = ' (🏥医院)';
      else if (p.skipTurns > 0) status = ' (💤跳过)';
      let html = `<div style="color:${p.color}">${p.name}${status}${p.bankrupt ? ' 💀' : ''}</div>`;
      if (p.bankrupt) html += `<div class="mono-bankrupt-label">破产</div>`;
      else {
        html += `<div class="mono-money">$${p.money}</div>`;
        if (p.bank > 0) html += `<div class="mono-bank">($${p.bank})</div>`;
      }
      card.innerHTML = html;
      panel.appendChild(card);
    });
    d.appendChild(panel);

    if (!over) {
      const rollBtn = document.createElement('button');
      rollBtn.className = 'btn primary';
      const p = players[curPlayer];
      let btnText = `🎲 ${p.name} 掷骰子 (第${round}轮${bankOpen ? ' · 银行开' : ' · 银行关'})`;
      if (p.jailTurns > 0) btnText = `🚔 ${p.name} 在监狱中 (点击消耗回合)`;
      if (p.hospitalTurns > 0) btnText = `🏥 ${p.name} 在医院中 (点击消耗回合)`;
      if (p.skipTurns > 0) btnText = `💤 ${p.name} 被跳过 (点击消耗回合)`;
      rollBtn.textContent = btnText;
      rollBtn.style.marginTop = '12px';
      rollBtn.onclick = rollDice;
      if (p.bankrupt) rollBtn.disabled = true;
      d.appendChild(rollBtn);
    }

    wrap.appendChild(d);

    const p = players[curPlayer];
    let statusText = `${p.name} 的回合 · 第 ${round} 轮`;
    if (p.jailTurns > 0) statusText += ` (🚔监狱剩余${p.jailTurns}轮)`;
    if (p.hospitalTurns > 0) statusText += ` (🏥医院剩余${p.hospitalTurns}轮)`;
    if (p.skipTurns > 0) statusText += ` (💤跳过剩余${p.skipTurns}轮)`;
    statusEl.textContent = over ? ('🏆 ' + (winner || '结束')) : statusText;
    logEl.innerHTML = log.slice(-15).map(l => `<div>${l}</div>`).join('');
    logEl.scrollTop = logEl.scrollHeight;

    buildSetup();
  }

  function buildSetup() {
    if (!setupBox) return;
    setupBox.innerHTML = '';
    for (let i = 2; i <= 10; i++) {
      const b = document.createElement('button');
      b.className = 'act';
      b.textContent = i + '人';
      if (totalPlayers === i) b.style.background = '#e8dcc0';
      b.onclick = () => {
        totalPlayers = i;
        initGame();
        render();
      };
      setupBox.appendChild(b);
    }
  }

  function nextTurn() {
    let next = (curPlayer + 1) % players.length;
    let guard = 0;
    while ((players[next].bankrupt || players[next].money <= 0) && guard < players.length) {
      next = (next + 1) % players.length;
      guard++;
    }
    curPlayer = next;
    turnCount++;
    const aliveCount = players.filter(p => !p.bankrupt).length;
    if (turnCount >= aliveCount) {
      turnCount = 0;
      round++;
      bankOpen = (round > 1);
      if (bankOpen) {
        players.forEach(p => {
          if (!p.bankrupt && p.bank > 0) {
            const interest = Math.floor(p.bank * 0.2);
            p.money += interest; // 利息加到手头资金，存款不变
            log.push(`🏦 ${p.name} 存款利息 +$${interest}（加到资金，银行开放）`);
          }
        });
      }
      log.push(`📅 进入第 ${round} 轮，银行${bankOpen ? '开放' : '关闭'}`);
    }
  }

  function rollDice() {
    if (over) return;
    const p = players[curPlayer];
    if (p.bankrupt) return;

    if (p.jailTurns > 0) {
      p.jailTurns--;
      if (p.jailTurns > 0) log.push(`🚔 ${p.name} 在监狱中，消耗回合并跳过（剩余 ${p.jailTurns} 轮）`);
      else log.push(`🚔 ${p.name} 刑满释放，下回合正常行动`);
      nextTurn(); render(); return;
    }
    if (p.hospitalTurns > 0) {
      p.hospitalTurns--;
      if (p.hospitalTurns > 0) log.push(`🏥 ${p.name} 在医院中，消耗回合并跳过（剩余 ${p.hospitalTurns} 轮）`);
      else log.push(`🏥 ${p.name} 康复出院，下回合正常行动`);
      nextTurn(); render(); return;
    }
    if (p.skipTurns > 0) {
      p.skipTurns--;
      if (p.skipTurns > 0) log.push(`💤 ${p.name} 被罚跳过，消耗回合并跳过（剩余 ${p.skipTurns} 轮）`);
      else log.push(`💤 ${p.name} 跳过结束，下回合正常行动`);
      nextTurn(); render(); return;
    }

    const d1 = Math.floor(Math.random() * 6) + 1;
    const d2 = Math.floor(Math.random() * 6) + 1;
    const steps = d1 + d2;
    const oldPos = p.pos;
    log.push(`🎲 ${p.name} 掷出 ${d1}+${d2}=${steps}`);

    let newPos = oldPos;
    let crossedStart = false;
    if (oldPos < 60) {
      let current = oldPos;
      for (let i = 0; i < steps; i++) {
        current++;
        if (current > 55) { current = 0; crossedStart = true; }
      }
      newPos = current;
    } else {
      let current = oldPos;
      for (let i = 0; i < steps; i++) {
        current++;
        if (current > 75) { current = 60; crossedStart = true; }
      }
      newPos = current;
    }

    if (crossedStart) {
      p.money += 200;
      log.push(`💰 ${p.name} 经过起点，获得 $200`);
    }

    if (newPos === 0) {
      newPos = 60;
      log.push(`🌀 ${p.name} 落在传送门 [0号格]，切换到内圈 [60号格]`);
    } else if (newPos === 60) {
      newPos = 0;
      log.push(`🌀 ${p.name} 落在传送门 [60号格]，切换到外圈 [0号格]`);
    }

    log.push(`🚶 ${p.name} 从 [${oldPos}号格] 移动到 [${newPos}号格]`);
    p.pos = newPos;
    render();

    setTimeout(() => handleCell(p, () => {
      if (p.bankrupt) {
        nextTurn();
        render();
        return;
      }
      if (d1 === 6 || steps === 12) {
        log.push(`🎉 ${p.name} 掷出 ${steps === 12 ? '双六' : '6点'}，再投一次！`);
        render();
      } else {
        nextTurn();
        render();
      }
    }), 300);
  }

  function handleCell(p, callback) {
    const pos = p.pos;
    if (PORTALS.includes(pos)) { if (!over) callback(); return; }
    if (JAILS.includes(pos)) {
      p.jailTurns = 1; log.push(`🚔 ${p.name} 进了监狱1轮`);
      render(); if (!over) callback(); return;
    }
    if (HOSPITALS.includes(pos)) {
      p.hospitalTurns = 1; log.push(`🏥 ${p.name} 进了医院1轮`);
      render(); if (!over) callback(); return;
    }
    if (BANKS.includes(pos)) {
      const deposit = Math.floor(p.money * 0.2);
      p.money -= deposit; p.bank += deposit;
      log.push(`🏦 ${p.name} 在银行存入 $${deposit}，当前存款 $${p.bank}`);
      render(); if (!over) callback(); return;
    }
    if (CHANCES.includes(pos)) {
      const card = Math.floor(Math.random() * 7);
      if (card === 0) { p.pos = 14; p.jailTurns = 2; log.push(`🚔 抽到卡：进监狱2轮 (移动到 14号格)`); }
      else if (card === 1) { p.pos = 42; p.hospitalTurns = 2; log.push(`🏥 抽到卡：进医院2轮 (移动到 42号格)`); }
      else if (card === 2) { p.discount = true; log.push(`🎟️ 抽到卡：下次买楼半价`); }
      else if (card === 3) { p.money += 100; log.push(`💰 抽到卡：获得 $100`); }
      else if (card === 4) { p.money -= 50; log.push(`💸 抽到卡：扣除 $50`); }
      else if (card === 5) { p.skipTurns = 1; log.push(`💤 抽到卡：跳过一轮`); }
      else { p.bank += 1000000; log.push(`💷 抽到卡：百万英镑！银行存款增加 $1,000,000！`); }
      render(); if (!over) callback(); return;
    }

    const prop = properties[pos];
    if (prop.owner === null) {
      let buyPrice = 100;
      if (p.discount) { buyPrice = 50; p.discount = false; log.push('🎟️ 使用低价买楼权！'); }
      if (p.money >= buyPrice) {
        prop.owner = p.id; prop.level = 1; prop.rent = 10; p.money -= buyPrice;
        log.push(`✅ ${p.name} 购买了地皮，花费 $${buyPrice}`);
      } else {
        log.push(`❌ ${p.name} 资金不足，无法购买`);
      }
    } else if (prop.owner !== p.id) {
      const rent = rentOf(prop);
      p.money -= rent;
      players[prop.owner].money += rent;
      log.push(`💸 ${p.name} 向 ${players[prop.owner].name} 支付租金 $${rent}（第${round}轮，翻倍×${round >= 6 ? Math.pow(2, round - 5) : 1}）`);
    } else {
      if (prop.level === 1 && p.money >= 200) {
        prop.level = 2; prop.rent = 20; p.money -= 200;
        log.push(`⬆️ ${p.name} 升级到 🏡 2级，花费 $200`);
      } else if (prop.level === 2 && p.money >= 500) {
        prop.level = 3; prop.rent = 50; p.money -= 500;
        log.push(`⬆️ ${p.name} 升级到 🏢 3级，花费 $500`);
      } else {
        log.push(`🏠 ${p.name} 停留在自己的地产上`);
      }
    }

    if (p.money <= 0) {
      log.push(`💀 ${p.name} 资金见底，开始变卖所有房产并取出存款...`);
      let totalCash = 0;
      properties.forEach((c, idx) => {
        if (c.owner === p.id) {
          let val = 100;
          if (c.level === 2) val = 300;
          else if (c.level === 3) val = 800;
          totalCash += val;
          log.push(`🏠 卖出 (${idx + 1}号格) 房产，回收 $${val}`);
          c.owner = null; c.level = 0; c.rent = 0;
        }
      });
      if (p.bank > 0) {
        log.push(`🏦 取出存款 $${p.bank}`);
        totalCash += p.bank; p.bank = 0;
      }
      p.money = totalCash;
      log.push(`💰 ${p.name} 变卖后共有 $${totalCash}，扣除 1000 斩杀线...`);
      if (p.money >= 1000) {
        p.money -= 1000;
        log.push(`✨ ${p.name} 资产达标，扣除 1000 斩杀线后余 $${p.money}，成功复活！`);
      } else {
        p.bankrupt = true;
        p.money = 0;
        log.push(`💀 ${p.name} 资产不足 $1000，无法跨过斩杀线，宣告破产淘汰`);
      }
    }

    checkWin();
    render();
    if (!over) callback();
  }

  function checkWin() {
    const alive = players.filter(p => !p.bankrupt && p.money > 0);
    if (alive.length <= 1) {
      over = true;
      winner = alive.length === 1 ? alive[0].name + ' 获胜' : '平局';
      log.push(`🏆 ${winner}`);
    }
  }

  document.getElementById('monoResign').onclick = () => {
    if (over) return;
    const p = players[curPlayer];
    if (p.bankrupt) return;
    p.bankrupt = true; p.money = 0;
    log.push(`🏳️ ${p.name} 投降，破产淘汰`);
    checkWin();
    if (!over) nextTurn();
    render();
  };

  document.getElementById('monoSettle').onclick = () => {
    if (over) return;
    over = true;
    const alive = players.filter(p => !p.bankrupt);
    if (alive.length === 0) {
      winner = '平局';
      log.push('📊 结算：全员破产，平局');
    } else {
      let maxAssets = -1;
      alive.forEach(p => {
        const total = p.money + p.bank;
        if (total > maxAssets) maxAssets = total;
      });
      const winners = alive.filter(p => (p.money + p.bank) === maxAssets);
      if (winners.length === 1) {
        winner = winners[0].name + ' 获胜';
        log.push(`📊 结算：${winners[0].name} 获胜（总资产 $${maxAssets}）`);
      } else {
        winner = winners.map(p => p.name).join('、') + ' 并列获胜';
        log.push(`📊 结算：${winner}（总资产 $${maxAssets}）`);
      }
    }
    render();
  };

  document.getElementById('monoRestart').onclick = () => {
    initGame();
    render();
  };

  const getState = () => ({
    game: 'monopoly',
    totalPlayers, players, curPlayer, over, winner, log, round, turnCount, bankOpen, properties
  });
  const setState = (s) => {
    totalPlayers = s.totalPlayers;
    players = s.players;
    curPlayer = s.curPlayer;
    over = s.over;
    winner = s.winner;
    log = s.log || [];
    round = s.round;
    turnCount = s.turnCount;
    bankOpen = s.bankOpen;
    properties = s.properties;
    render();
  };

  initGame();
  buildSetup();
  render();
  return { getState, setState };
}

  window.__games = window.__games || {};
  window.__games['monopoly'] = { init };
})();
