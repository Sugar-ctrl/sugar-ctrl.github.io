/* 世界象棋 DLC · 爪哇象棋 */
(function(){
  const { cloneBoard, renderLog, layout, bindActions, renderCrossBoard, renderGridBoard, makeGridVariant } = window.GameCommon;

  function initJava(container) {
    return makeGridVariant(container, {
      gameId: 'java',
      title: '🇮🇩 爪哇象棋 · 8×8',
      rule: '<b>士</b>斜线一格；<b>象</b>斜线；<b>王</b>走一格任意方向；<b>马</b>走日；<b>车</b>直线；<b>兵</b>直走斜吃，<b>兵升变为「后」</b>。',
      back: ['车','马','象','王','士','象','马','车'],
      pawnType: '兵', promoteTo: '后',
      gridClass: 'islamic-grid', cellClass: 'islamic-cell', pieceClass: 'islamic-p'
    });
  }

  window.__games = window.__games || {};
  window.__games['world_java'] = { init: initJava };
})();
