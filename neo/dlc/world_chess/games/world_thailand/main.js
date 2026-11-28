/* 世界象棋 DLC · 泰国象棋 */
(function(){
  const { cloneBoard, renderLog, layout, bindActions, renderCrossBoard, renderGridBoard, makeGridVariant } = window.GameCommon;

  function initThailand(container) {
    return makeGridVariant(container, {
      gameId: 'thailand',
      title: '🇹🇭 泰国象棋 · 8×8',
      rule: '<b>士</b>斜线一格；<b>象</b>斜线；<b>王</b>走一格任意方向；<b>马</b>走日；<b>车</b>直线；<b>兵</b>直走斜吃。<br><b>特色升变</b>：兵到达第 6 线（先手第 3 行 / 后手第 4 行）自动升变为「士」（Met）。<br><b>王不能照面</b>：双方王在同一列且中间无子时，走成照面属违规（本实现直接禁止）。',
      back: ['车','马','象','王','士','象','马','车'],
      pawnType: '兵', makrukPromote: true,
      gridClass: 'tropical-grid', cellClass: 'tropical-cell', pieceClass: 'tropical-p'
    });
  }

  window.__games = window.__games || {};
  window.__games['world_thailand'] = { init: initThailand };
})();
