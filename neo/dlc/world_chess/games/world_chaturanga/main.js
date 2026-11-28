/* 世界象棋 DLC · 印度象棋 */
(function(){
  const { cloneBoard, renderLog, layout, bindActions, renderCrossBoard, renderGridBoard, makeGridVariant } = window.GameCommon;

  function initChaturanga(container) {
    return makeGridVariant(container, {
      gameId: 'chaturanga',
      title: '🇮🇳 印度象棋 · 8×8',
      rule: '<b>象</b>走斜线两格（可跳，不塞象眼）；<b>士</b>走斜线一格；<b>王</b>走一格任意方向；<b>马</b>走日；<b>车</b>直线；<b>兵</b>直走斜吃。',
      back: ['车','马','象','王','士','象','马','车'],
      pawnType: '兵',
      gridClass: 'indian-grid', cellClass: 'indian-cell', pieceClass: 'indian-p',
      specialMoves: (board, r, c, p, add) => {
        if (p.type === '象') { [[2,2],[2,-2],[-2,2],[-2,-2]].forEach(([dr,dc])=>add(r+dr,c+dc)); }
      }
    });
  }

  window.__games = window.__games || {};
  window.__games['world_chaturanga'] = { init: initChaturanga };
})();
