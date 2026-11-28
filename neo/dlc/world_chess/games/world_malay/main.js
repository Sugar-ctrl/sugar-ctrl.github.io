/* 世界象棋 DLC · 马来象棋 */
(function(){
  const { cloneBoard, renderLog, layout, bindActions, renderCrossBoard, renderGridBoard, makeGridVariant } = window.GameCommon;

  function initMalay(container) {
    return makeGridVariant(container, {
      gameId: 'malay',
      title: '🇲🇾 马来象棋 · 8×8',
      rule: '<b>无象</b>（以「士」代替）；<b>士</b>斜线一格；<b>王</b>走一格任意方向；<b>马</b>走日；<b>车</b>直线；<b>兵</b>直走斜吃，<b>兵升变为「士」</b>。',
      back: ['车','马','士','王','士','士','马','车'],
      pawnType: '兵', promoteTo: '士',
      gridClass: 'islamic-grid', cellClass: 'islamic-cell', pieceClass: 'islamic-p'
    });
  }

  window.__games = window.__games || {};
  window.__games['world_malay'] = { init: initMalay };
})();
