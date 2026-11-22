/* 各游戏共用的小工具（经典脚本，挂在 window.GameCommon） */
(function(){
  function drawCrossLines(boardEl, rows, cols, cellSize, pad){
    const w = (cols - 1) * cellSize, h = (rows - 1) * cellSize;
    for (let r = 0; r < rows; r++){
      const line = document.createElement('div'); line.className = 'line';
      line.style.left = pad + 'px'; line.style.top = (pad + r * cellSize) + 'px';
      line.style.width = w + 'px'; line.style.height = '2px';
      boardEl.appendChild(line);
    }
    for (let c = 0; c < cols; c++){
      const line = document.createElement('div'); line.className = 'line';
      line.style.left = (pad + c * cellSize) + 'px'; line.style.top = pad + 'px';
      line.style.width = '2px'; line.style.height = h + 'px';
      boardEl.appendChild(line);
    }
  }

  function addAxisLabels(boardEl, rows, cols, cellSize, pad){
    for (let c = 0; c < cols; c++){
      const lbl = document.createElement('div'); lbl.className = 'axis-label';
      lbl.textContent = c + 1;
      lbl.style.left = (pad + c * cellSize - 10) + 'px'; lbl.style.top = (pad - 22) + 'px';
      lbl.style.width = '20px'; lbl.style.textAlign = 'center'; boardEl.appendChild(lbl);
    }
    for (let r = 0; r < rows; r++){
      const lbl = document.createElement('div'); lbl.className = 'axis-label';
      lbl.textContent = r + 1;
      lbl.style.left = (pad - 24) + 'px'; lbl.style.top = (pad + r * cellSize - 8) + 'px';
      lbl.style.width = '18px'; lbl.style.textAlign = 'right'; boardEl.appendChild(lbl);
    }
  }

  function renderLog(id, log){
    const el = document.getElementById(id);
    if (el) el.innerHTML = log.slice(-15).map(l => '<div>' + l + '</div>').join('');
  }

  window.GameCommon = { drawCrossLines, addAxisLabels, renderLog };
})();
