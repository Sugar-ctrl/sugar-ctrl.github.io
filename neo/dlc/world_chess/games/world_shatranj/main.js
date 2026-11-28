/* 世界象棋 DLC · 波斯象棋 */
(function(){
  const { cloneBoard, renderLog, layout, bindActions, renderCrossBoard, renderGridBoard, makeGridVariant } = window.GameCommon;

  function initShatranj(container) {
    return makeGridVariant(container, {
      gameId: 'shatranj',
      title: '🇮🇷 波斯象棋 · 8×8',
      rule: '<b>王</b>走一格直线（不能斜走）；<b>士</b>斜线一格；<b>象</b>斜线；<b>马</b>走日；<b>车</b>直线；<b>兵</b>直走一格斜吃，<b>无第一步双步</b>，<b>兵升变为「士」</b>。',
      back: ['车','马','象','王','士','象','马','车'],
      pawnType: '兵', pawnDouble: false, kingDiag: false, promoteTo: '士',
      gridClass: 'islamic-grid', cellClass: 'islamic-cell', pieceClass: 'islamic-p'
    });
  }

  window.__games = window.__games || {};
  window.__games['world_shatranj'] = { init: initShatranj };
})();
