/* 世界象棋 DLC · 土耳其象棋 */
(function(){
  const { cloneBoard, renderLog, layout, bindActions, renderCrossBoard, renderGridBoard, makeGridVariant } = window.GameCommon;

  function initTurkish(container) {
    return makeGridVariant(container, {
      gameId: 'turkish',
      title: '🇹🇷 土耳其象棋 · 8×8',
      rule: '<b>王</b>走一格任意方向；<b>士</b>斜线一格；<b>象</b>斜线；<b>马</b>走日；<b>车</b>直线；<b>兵</b>直走斜吃，<b>兵无升变</b>（到底线仍为兵）。',
      back: ['车','马','象','王','士','象','马','车'],
      pawnType: '兵',
      gridClass: 'islamic-grid', cellClass: 'islamic-cell', pieceClass: 'islamic-p'
    });
  }

  window.__games = window.__games || {};
  window.__games['world_turkish'] = { init: initTurkish };
})();
