/* 世界象棋 DLC · 缅甸象棋 */
(function(){
  const { cloneBoard, renderLog, layout, bindActions, renderCrossBoard, renderGridBoard, makeGridVariant } = window.GameCommon;

  function initMyanmar(container) {
    return makeGridVariant(container, {
      gameId: 'myanmar',
      title: '🇲🇲 缅甸象棋 · 8×8',
      rule: '<b>布阵阶段</b>：开局前先手可自由摆放己方棋子，再后手摆放。<br><b>士</b>斜线一格；<b>象</b>斜线；<b>王</b>走一格任意方向；<b>马</b>走日；<b>车</b>直线；<b>兵</b>直走斜吃。',
      back: ['车','马','象','王','士','象','马','车'],
      pawnType: '兵',
      gridClass: 'tropical-grid', cellClass: 'tropical-cell', pieceClass: 'tropical-p',
      setupPhase: true
    });
  }

  window.__games = window.__games || {};
  window.__games['world_myanmar'] = { init: initMyanmar };
})();
