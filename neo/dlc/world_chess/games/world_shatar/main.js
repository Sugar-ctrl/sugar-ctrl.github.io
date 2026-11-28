/* 世界象棋 DLC · 蒙古象棋 */
(function(){
  const { cloneBoard, renderLog, layout, bindActions, renderCrossBoard, renderGridBoard, makeGridVariant } = window.GameCommon;

  function initShatar(container) {
    return makeGridVariant(container, {
      gameId: 'shatar',
      title: '🇲🇳 蒙古象棋 · 8×8',
      rule: '<b>狮</b>（代替后）走直线和斜线；<b>驼</b>（象）走斜线；<b>王</b>走一格任意方向；<b>马</b>走日；<b>车</b>直线；<b>兵</b>直走斜吃，无兵双步，<b>无王车易位</b>。',
      back: ['车','马','驼','王','狮','驼','马','车'],
      pawnType: '兵', pawnDouble: false,
      gridClass: 'steppe-grid', cellClass: 'steppe-cell', pieceClass: 'steppe-p'
    });
  }

  window.__games = window.__games || {};
  window.__games['world_shatar'] = { init: initShatar };
})();
