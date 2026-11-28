/* 世界象棋 DLC · 柬埔寨象棋 */
(function(){
  const { cloneBoard, renderLog, layout, bindActions, renderCrossBoard, renderGridBoard, makeGridVariant } = window.GameCommon;

  function initCambodia(container) {
    return makeGridVariant(container, {
      gameId: 'cambodia',
      title: '🇰🇭 柬埔寨象棋 · 8×8',
      rule: '<b>士</b>斜线一格；<b>象</b>斜线；<b>王</b>走一格任意方向；<b>马</b>走日；<b>车</b>直线；<b>兵</b>第一步可走两格，直走斜吃，<b>兵升变为「士」</b>。',
      back: ['车','马','象','王','士','象','马','车'],
      pawnType: '兵', pawnDouble: true, promoteTo: '士',
      gridClass: 'tropical-grid', cellClass: 'tropical-cell', pieceClass: 'tropical-p'
    });
  }

  window.__games = window.__games || {};
  window.__games['world_cambodia'] = { init: initCambodia };
})();
