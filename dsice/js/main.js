/* Bootstraps the game, DOM overlays, responsive cabinet size and touch input. */
(function () {
  'use strict';

  const PJ = window.PJ;

  const $ = (id) => document.getElementById(id);

  const canvas = $('game');
  const screen = $('screen');
  const screenFrame = $('screenFrame');
  const shell = $('shell');
  const overlay = $('overlay');
  const titleCard = $('titleCard');
  const pauseCard = $('pauseCard');
  const completeCard = $('completeCard');
  const failCard = $('failCard');
  const startBtn = $('startBtn');
  const resumeBtn = $('resumeBtn');
  const restartBtn = $('restartBtn');
  const againBtn = $('againBtn');
  const titleBtn = $('titleBtn');
  const failRetryBtn = $('failRetryBtn');
  const failTitleBtn = $('failTitleBtn');
  const pauseBtn = $('pauseBtn');
  const pauseGlyph = $('pauseGlyph');
  const muteBtn = $('muteBtn');
  const muteLabel = $('muteLabel');
  const timeBtn = $('timeBtn');
  const timeLabel = $('timeLabel');
  const sundialHand = $('sundialHand');
  const sundialOrb = $('sundialOrb');
  const sundialPhase = $('sundialPhase');
  const clockPanel = $('clockPanel');
  const clockDragHandle = $('clockDragHandle');
  const clockResize = $('clockResize');
  const clockCloseBtn = $('clockCloseBtn');
  const clockDial = $('clockDial');
  const clockHand = $('clockHand');
  const clockSun = $('clockSun');
  const clockTime = $('clockTime');
  const clockPhase = $('clockPhase');
  const clockTicks = $('clockTicks');
  const clockPresetButtons = Array.from(document.querySelectorAll('[data-clock-preset]'));
  const titleBest = $('titleBest');
  const clearTime = $('clearTime');
  const clearIce = $('clearIce');
  const clearDeaths = $('clearDeaths');
  const clearShards = $('clearShards');
  const clearBest = $('clearBest');
  const newBest = $('newBest');
  const failTime = $('failTime');
  const failDeaths = $('failDeaths');
  const failEyebrow = $('failEyebrow');
  const failTitle = $('failTitle');
  const failCopy = $('failCopy');
  const failStatLabel = $('failStatLabel');
  const failStatValue = $('failStatValue');
  const dialogueLayer = $('dialogue');
  const dialogueName = $('dialogueName');
  const dialogueRole = $('dialogueRole');
  const dialogueText = $('dialogueText');
  const dialogueCount = $('dialogueCount');
  const dialogueNext = $('dialogueNext');
  const settingsBtn = $('settingsBtn');
  const settingsModal = $('settingsModal');
  const settingsCloseBtn = $('settingsCloseBtn');
  const settingsDoneBtn = $('settingsDoneBtn');
  const settingsTabButtons = Array.from(document.querySelectorAll('[data-settings-tab]'));
  const settingsPanels = Array.from(document.querySelectorAll('[data-settings-panel]'));
  const volumeRange = $('volumeRange');
  const volumeValue = $('volumeValue');
  const musicVolumeRange = $('musicVolumeRange');
  const musicVolumeValue = $('musicVolumeValue');
  const settingsMuteBtn = $('settingsMuteBtn');
  const bindList = $('bindList');
  const resetBindingsBtn = $('resetBindingsBtn');
  const bindStatus = $('bindStatus');
  const guideList = $('guideList');
  const devToggle = $('devToggle');
  const devSliders = $('devSliders');
  const devResetBtn = $('devResetBtn');
  const devStatus = $('devStatus');
  const stageLabel = $('stageLabel');
  const statusLive = $('statusLive');
  const fpsLabel = $('fpsLabel');
  const zoomChip = $('zoomChip');
  const zoomValue = $('zoomValue');
  const errorPanel = $('errorPanel');
  const errorText = $('errorText');
  const reloadBtn = $('reloadBtn');
  const touchButtons = Array.from(document.querySelectorAll('.touch-btn'));

  const BEST_KEY = 'pixel-runner-best-ice-v2';
  const SETTINGS_KEY = 'pixel-runner-settings-v1';
  const query = new URLSearchParams(window.location.search);
  const ZOOM_MIN = 0.65;
  const ZOOM_MAX = 2.2;
  let bestRun = readBest();
  let fittedOnce = false;
  let zoomLevel = 1;
  let zoomChipTimer = 0;
  let settingsOpen = false;
  let bindingAction = null;

  const DEFAULT_SETTINGS = {
    volume: 1,
    musicVolume: 0.55,
    developer: false,
    lastTab: 'audio',
    clockBox: null,
    bindings: PJ.cloneBindings(PJ.DEFAULT_BINDINGS),
    tuning: Object.assign({}, PJ.DEFAULT_TUNING)
  };
  let settings = readSettings();

  const sfx = new PJ.Sfx();
  sfx.setVolume(settings.volume);
  sfx.setMusicVolume(settings.musicVolume);
  const input = new PJ.Input();
  input.setBindings(settings.bindings);
  applyDeveloperTuning();

  function readBest() {
    try {
      const raw = window.localStorage.getItem(BEST_KEY);
      if (raw == null) return null;
      const value = JSON.parse(raw);
      if (!value || !Number.isFinite(value.integrity) || !Number.isFinite(value.time)) return null;
      return {
        integrity: Math.max(0, Math.min(100, Math.round(value.integrity))),
        time: Math.max(0, value.time)
      };
    } catch (error) {
      return null;
    }
  }

  function writeBest(stats) {
    bestRun = { integrity: stats.integrity, time: stats.time };
    try {
      window.localStorage.setItem(BEST_KEY, JSON.stringify(bestRun));
    } catch (error) {
      /* Best run falls back to this session only. */
    }
  }

  function refreshBestLine() {
    if (bestRun == null) {
      titleBest.hidden = true;
      titleBest.textContent = '';
      return;
    }
    titleBest.hidden = false;
    titleBest.textContent = 'BEST ICE ' + bestRun.integrity + '% · ' + PJ.formatTime(bestRun.time);
  }

  function readSettings() {
    let raw = null;
    try {
      raw = window.localStorage.getItem(SETTINGS_KEY);
    } catch (error) {
      raw = null;
    }
    let parsed = null;
    try {
      parsed = raw ? JSON.parse(raw) : null;
    } catch (error) {
      parsed = null;
    }
    const tuning = {};
    Object.keys(PJ.DEFAULT_TUNING).forEach((key) => {
      const value = parsed && parsed.tuning ? Number(parsed.tuning[key]) : NaN;
      tuning[key] = Number.isFinite(value)
        ? Math.max(0, Math.min(10000, value))
        : PJ.DEFAULT_TUNING[key];
    });
    const volume = parsed && Number.isFinite(Number(parsed.volume))
      ? Math.max(0, Math.min(1, Number(parsed.volume)))
      : DEFAULT_SETTINGS.volume;
    const musicVolume = parsed && Number.isFinite(Number(parsed.musicVolume))
      ? Math.max(0, Math.min(1, Number(parsed.musicVolume)))
      : DEFAULT_SETTINGS.musicVolume;
    const validTabs = ['audio', 'controls', 'dev'];
    const lastTab = parsed && validTabs.indexOf(parsed.lastTab) !== -1
      ? parsed.lastTab
      : DEFAULT_SETTINGS.lastTab;
    let clockBox = null;
    if (parsed && parsed.clockBox) {
      const box = parsed.clockBox;
      if ([box.x, box.y, box.w, box.h].every((value) => Number.isFinite(Number(value)))) {
        clockBox = {
          x: Number(box.x),
          y: Number(box.y),
          w: Number(box.w),
          h: Number(box.h)
        };
      }
    }
    return {
      volume: volume,
      musicVolume: musicVolume,
      developer: !!(parsed && parsed.developer),
      lastTab: lastTab,
      clockBox: clockBox,
      bindings: PJ.cloneBindings(parsed && parsed.bindings),
      tuning: tuning
    };
  }

  function writeSettings() {
    try {
      window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch (error) {
      /* Settings fall back to this session only. */
    }
  }

  function applyDeveloperTuning() {
    const source = settings.developer ? settings.tuning : PJ.DEFAULT_TUNING;
    Object.keys(PJ.DEFAULT_TUNING).forEach((key) => {
      const value = Number(source[key]);
      PJ.TUNING[key] = Number.isFinite(value) ? value : PJ.DEFAULT_TUNING[key];
    });
  }

  const CLOCK_CX = 110;
  const CLOCK_CY = 110;
  const CLOCK_ARC = 82;
  const CLOCK_HAND = 74;
  const CLOCK_MIN_W = 240;
  const CLOCK_MIN_H = 300;
  const CLOCK_MARGIN = 8;
  let clockGesture = null;

  function clockPoint(value) {
    const angle = Math.PI - (clamp01(value / 4) * Math.PI * 2);
    return {
      x: CLOCK_CX + Math.cos(angle) * CLOCK_HAND,
      y: CLOCK_CY - Math.sin(angle) * CLOCK_HAND
    };
  }

  function clamp01(value) {
    return Math.max(0, Math.min(1, value));
  }

  function buildClockTicks() {
    for (let hour = 0; hour < 24; hour++) {
      const t = ((hour - 6 + 24) % 24) / 6;
      const angle = Math.PI - (t / 4) * Math.PI * 2;
      const major = hour % 6 === 0;
      const inner = CLOCK_ARC - (major ? 8 : 4);
      const outer = CLOCK_ARC;
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', String(CLOCK_CX + Math.cos(angle) * inner));
      line.setAttribute('y1', String(CLOCK_CY - Math.sin(angle) * inner));
      line.setAttribute('x2', String(CLOCK_CX + Math.cos(angle) * outer));
      line.setAttribute('y2', String(CLOCK_CY - Math.sin(angle) * outer));
      line.setAttribute('class', major ? 'clock-tick major' : 'clock-tick');
      clockTicks.appendChild(line);

      if (major) {
        const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        label.setAttribute('x', String(CLOCK_CX + Math.cos(angle) * (CLOCK_ARC + 13)));
        label.setAttribute('y', String(CLOCK_CY - Math.sin(angle) * (CLOCK_ARC + 13) + 3));
        label.setAttribute('class', 'clock-tick-label');
        label.textContent = hour < 10 ? '0' + hour : String(hour);
        clockTicks.appendChild(label);
      }
    }
  }

  function updateClockUI() {
    if (!game) return;
    const value = game.timeValue;
    const point = clockPoint(value);
    clockHand.setAttribute('x2', point.x.toFixed(2));
    clockHand.setAttribute('y2', point.y.toFixed(2));
    clockSun.setAttribute('cx', point.x.toFixed(2));
    clockSun.setAttribute('cy', point.y.toFixed(2));
    clockTime.textContent = game.getClockText();
    clockPhase.textContent = game.getTimeLabel();
    timeLabel.textContent = game.getClockText();
    sundialPhase.textContent = game.getTimeLabel();

    const dialAngle = Math.PI - (value / 4) * Math.PI * 2;
    const dialX = 50 + Math.cos(dialAngle) * 34;
    const dialY = 50 - Math.sin(dialAngle) * 34;
    sundialHand.setAttribute('x2', dialX.toFixed(2));
    sundialHand.setAttribute('y2', dialY.toFixed(2));
    sundialOrb.setAttribute('cx', dialX.toFixed(2));
    sundialOrb.setAttribute('cy', dialY.toFixed(2));

    clockDial.setAttribute('aria-valuenow', value.toFixed(2));
    clockDial.setAttribute('aria-valuetext', game.getClockText() + '，' + game.getTimeLabel());

    clockPresetButtons.forEach((button) => {
      const index = Number(button.getAttribute('data-clock-preset'));
      button.classList.toggle('is-active', Math.abs(value - index) < 0.06);
    });
  }

  function syncTimeUI() {
    if (!game) return;
    updateClockUI();
    timeBtn.setAttribute(
      'aria-label',
      '打开日晷微调时间。当前 ' + game.getClockText() + '，' + game.getTimeLabel() + '。快捷键 T 或数字 1 2 3'
    );
    timeBtn.dataset.time = game.getTimeLabel().toLowerCase();
  }

  function changeTime(index) {
    if (game.state !== 'playing' || game.dialogueActive) return;
    unlockAudio();
    if (index == null) game.cycleTime();
    else game.setTime(index);
    syncTimeUI();
    statusLive.textContent = '时间切换为 ' + game.getClockText() + '，' + game.getTimeLabel() + '。';
    if (timeBtn.blur) timeBtn.blur();
  }

  function syncDialogue() {
    const active = !!(game && game.state === 'playing' && game.dialogueActive);
    dialogueLayer.hidden = !active;
    if (game) timeBtn.disabled = game.state !== 'playing' || active;
    if (!active) return;

    const page = game.getDialoguePage();
    dialogueName.textContent = page.name;
    if (dialogueRole) dialogueRole.textContent = page.role || 'GUIDE OF THE SANDS';
    dialogueText.textContent = page.text;
    dialogueCount.textContent = (page.index + 1) + ' / ' + page.total;
    const label = dialogueNext.querySelector('span');
    const small = dialogueNext.querySelector('small');
    if (label) label.textContent = page.last ? '开始探索' : '继续';
    if (small) small.textContent = page.last ? 'BEGIN' : 'NEXT';
  }

  function advanceDialogue() {
    if (!game || !game.dialogueActive) return;
    unlockAudio();
    sfx.click();
    game.advanceDialogue();
    syncDialogue();
  }

  function talkToNpc() {
    if (!game || game.state !== 'playing' || game.dialogueActive) return false;
    if (!game.tryTalkNpc()) return false;
    syncDialogue();
    return true;
  }

  const BIND_ACTIONS = [
    { action: 'left', label: '向左移动' },
    { action: 'right', label: '向右移动' },
    { action: 'jump', label: '跳跃' },
    { action: 'down', label: '从平台下落' },
    { action: 'time', label: '循环时间' },
    { action: 'talk', label: '与向导交谈' },
    { action: 'pause', label: '暂停 / 继续' },
    { action: 'restart', label: '重新开始' }
  ];

  const DEV_FIELDS = [
    { key: 'runSpeed', label: '角色移动速度', min: 60, max: 220, step: 1, unit: ' px/s' },
    { key: 'jumpSpeed', label: '跳跃力度', min: 220, max: 500, step: 5, unit: '' },
    { key: 'gravity', label: '重力', min: 600, max: 1900, step: 20, unit: '' },
    { key: 'icePushAccel', label: '冰块推动加速度', min: 100, max: 900, step: 20, unit: '' },
    { key: 'iceFriction', label: '冰块摩擦', min: 40, max: 600, step: 1, unit: '' },
    { key: 'iceMaxSpeed', label: '冰块最大速度', min: 20, max: 120, step: 2, unit: ' px/s' },
    { key: 'meltScale', label: '冰块融化倍率', min: 0, max: 2, step: 0.05, unit: 'x' },
    { key: 'nightChill', label: '夜晚寒意 / 秒', min: 0, max: 30, step: 1, unit: '%/s' },
    { key: 'sunWarmth', label: '阳光回暖 / 秒', min: 0, max: 40, step: 1, unit: '%/s' },
    { key: 'timeEase', label: '时段切换速度', min: 1, max: 10, step: 0.2, unit: '' }
  ];

  const RESERVED_CODES = new Set([
    'Escape', 'Enter', 'NumpadEnter', 'Tab',
    'F3', 'KeyM',
    'Digit1', 'Digit2', 'Digit3', 'Digit4',
    'Numpad1', 'Numpad2', 'Numpad3', 'Numpad4'
  ]);

  const KEY_LABELS = {
    ArrowLeft: '←',
    ArrowRight: '→',
    ArrowUp: '↑',
    ArrowDown: '↓',
    Space: 'SPACE',
    Enter: 'ENTER',
    Escape: 'ESC',
    Tab: 'TAB',
    ShiftLeft: 'L-SHIFT',
    ShiftRight: 'R-SHIFT',
    ControlLeft: 'L-CTRL',
    ControlRight: 'R-CTRL',
    AltLeft: 'L-ALT',
    AltRight: 'R-ALT',
    Backspace: 'BKSP',
    Delete: 'DEL',
    Home: 'HOME',
    End: 'END',
    PageUp: 'PGUP',
    PageDown: 'PGDN'
  };

  function keyLabel(code) {
    if (KEY_LABELS[code]) return KEY_LABELS[code];
    if (code.indexOf('Key') === 0) return code.slice(3);
    if (code.indexOf('Digit') === 0) return code.slice(5);
    if (code.indexOf('Numpad') === 0) return 'NUM' + code.slice(6);
    return code;
  }

  function bindingText(action) {
    return (settings.bindings[action] || []).map(keyLabel).join(' / ');
  }

  function bindingMarkup(action) {
    return (settings.bindings[action] || []).map((code) => '<kbd>' + keyLabel(code) + '</kbd>').join(' ');
  }

  function setSettingsStatus(text, target) {
    const node = target || bindStatus;
    if (!node) return;
    node.textContent = text || '';
  }

  function renderBindings() {
    if (!bindList) return;
    bindList.innerHTML = '';
    BIND_ACTIONS.forEach((definition) => {
      const row = document.createElement('div');
      row.className = 'bind-row';
      const label = document.createElement('span');
      label.textContent = definition.label;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'bind-key';
      button.dataset.bindAction = definition.action;
      button.textContent = bindingAction === definition.action
        ? '按一个键…'
        : bindingText(definition.action);
      button.addEventListener('click', () => beginBinding(definition.action));
      row.appendChild(label);
      row.appendChild(button);
      bindList.appendChild(row);
    });
  }

  function renderGuide() {
    if (!guideList) return;
    const items = [
      [bindingMarkup('left') + ' / ' + bindingMarkup('right'), '移动；贴着冰块行走即可推动'],
      [bindingMarkup('jump'), '跳跃；对话期间仍可自由移动'],
      [bindingMarkup('down'), '从单向平台向下穿过'],
      [bindingMarkup('time'), '循环清晨 → 正午 → 黄昏 → 夜晚'],
      ['<kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd> <kbd>4</kbd>', '直接选择清晨 / 正午 / 黄昏 / 夜晚'],
      ['点击顶部时间', '打开 24 小时日晷，拖动太阳或月亮微调'],
      [bindingMarkup('talk'), '与向导交谈，重看操作与故事'],
      [bindingMarkup('pause'), '暂停 / 继续；Esc 也可以关闭菜单'],
      [bindingMarkup('restart'), '重新开始关卡'],
      ['滚轮 / 双击画面', '缩放界面 / 重置为 100%']
    ];
    guideList.innerHTML = items.map((item) => (
      '<li><span>' + item[0] + '</span><span>' + item[1] + '</span></li>'
    )).join('');
  }

  function syncControlTexts() {
    if (game) {
      const summary = bindingText('left') + ' / ' + bindingText('right') + ' 移动，' +
        bindingText('jump') + ' 跳跃，' + bindingText('down') + ' 从单向平台下落；贴着冰块走就能推动。' +
        bindingText('time') + ' 循环时间，1 / 2 / 3 / 4 直接选择时段；点击顶部时间可以拨动完整日晷。' +
        bindingText('talk') + ' 与向导交谈，' + bindingText('restart') + ' 重开。';
      game.setControlSummary(summary);
    }

    const footerHint = document.querySelector('.desktop-hint');
    if (footerHint) {
      const first = (action) => {
        const codes = settings.bindings[action] || [''];
        return keyLabel(codes.find((code) => code.indexOf('Key') === 0) || codes[0]);
      };
      footerHint.innerHTML =
        '<kbd>' + first('left') + '</kbd> / <kbd>' + first('right') + '</kbd> 移动' +
        ' <span class="dot-sep">·</span> <kbd>' + first('jump') + '</kbd> 跳跃' +
        ' <span class="dot-sep">·</span> <kbd>' + first('down') + '</kbd> 下平台' +
        ' <span class="dot-sep">·</span> <kbd>' + first('time') + '</kbd> 时间' +
        ' <span class="dot-sep">·</span> <kbd>' + first('restart') + '</kbd> 重开' +
        ' <span class="dot-sep">·</span> <kbd>' + first('talk') + '</kbd> 交谈';
    }
    renderGuide();
  }

  function beginBinding(action) {
    bindingAction = action;
    setSettingsStatus('按一个新键，Esc 取消。');
    renderBindings();
    if (input.clearAll) input.clearAll();
  }

  function cancelBinding() {
    if (!bindingAction) return;
    bindingAction = null;
    setSettingsStatus('已取消。');
    renderBindings();
  }

  function handleBindingKey(event) {
    if (!bindingAction) return false;
    event.preventDefault();
    event.stopPropagation();
    const code = event.code;
    if (code === 'Escape') {
      cancelBinding();
      return true;
    }
    if (/^(Shift|Control|Alt|Meta)/.test(code)) {
      setSettingsStatus('请按一个非修饰键。');
      return true;
    }
    if (RESERVED_CODES.has(code)) {
      setSettingsStatus('该键已被系统操作占用。');
      return true;
    }
    const conflict = BIND_ACTIONS.find((definition) => (
      definition.action !== bindingAction &&
      (settings.bindings[definition.action] || []).indexOf(code) !== -1
    ));
    if (conflict) {
      setSettingsStatus('该键已用于：' + conflict.label);
      return true;
    }

    settings.bindings[bindingAction] = [code];
    input.setBindings(settings.bindings);
    writeSettings();
    bindingAction = null;
    setSettingsStatus('按键已更新。');
    renderBindings();
    syncControlTexts();
    return true;
  }

  function renderDevSliders() {
    if (!devSliders) return;
    devSliders.innerHTML = '';
    DEV_FIELDS.forEach((field) => {
      const row = document.createElement('label');
      row.className = 'dev-slider';
      const label = document.createElement('span');
      label.textContent = field.label;
      const output = document.createElement('output');
      const inputEl = document.createElement('input');
      inputEl.type = 'range';
      inputEl.min = String(field.min);
      inputEl.max = String(field.max);
      inputEl.step = String(field.step);
      inputEl.value = String(settings.tuning[field.key]);
      inputEl.disabled = !settings.developer;
      output.textContent = settings.tuning[field.key] + field.unit;
      inputEl.addEventListener('input', () => {
        const value = Number(inputEl.value);
        settings.tuning[field.key] = value;
        output.textContent = value + field.unit;
        if (settings.developer) applyDeveloperTuning();
        writeSettings();
        setSettingsStatus('参数已应用。', devStatus);
      });
      row.appendChild(label);
      row.appendChild(output);
      row.appendChild(inputEl);
      devSliders.appendChild(row);
    });
    devSliders.classList.toggle('is-disabled', !settings.developer);
  }

  function syncDevUI() {
    if (devToggle) devToggle.checked = settings.developer;
    if (devSliders) {
      devSliders.classList.toggle('is-disabled', !settings.developer);
      Array.from(devSliders.querySelectorAll('input')).forEach((inputEl) => {
        inputEl.disabled = !settings.developer;
      });
    }
  }

  function syncVolumeUI() {
    const sfxPercent = Math.round(settings.volume * 100);
    const musicPercent = Math.round(settings.musicVolume * 100);
    if (volumeRange) volumeRange.value = String(sfxPercent);
    if (volumeValue) volumeValue.textContent = sfxPercent + '%';
    if (musicVolumeRange) musicVolumeRange.value = String(musicPercent);
    if (musicVolumeValue) musicVolumeValue.textContent = musicPercent + '%';
  }

  function syncSettingsMute() {
    if (!settingsMuteBtn) return;
    settingsMuteBtn.textContent = sfx.muted ? 'AUDIO OFF' : 'AUDIO ON';
    settingsMuteBtn.setAttribute('aria-pressed', sfx.muted ? 'true' : 'false');
  }

  function showSettingsTab(name, save) {
    if (['audio', 'controls', 'dev'].indexOf(name) === -1) name = 'audio';
    if (bindingAction) {
      bindingAction = null;
      renderBindings();
    }
    settingsTabButtons.forEach((button) => {
      button.classList.toggle('is-active', button.getAttribute('data-settings-tab') === name);
    });
    settingsPanels.forEach((panel) => {
      panel.hidden = panel.getAttribute('data-settings-panel') !== name;
    });
    const body = settingsModal.querySelector('.settings-body');
    if (body) body.scrollTop = 0;
    if (save) {
      settings.lastTab = name;
      writeSettings();
    }
  }

  function openSettings() {
    if (settingsOpen) return;
    settingsOpen = true;
    bindingAction = null;
    if (game) {
      if (game.state === 'playing') {
        game.closeDialogue();
        closeClock();
        input.clearAll();
      }
      game.settingsOpen = true;
    }
    settingsModal.hidden = false;
    document.body.classList.add('settings-open');
    input.setSuspended(true);
    syncVolumeUI();
    syncSettingsMute();
    renderBindings();
    renderGuide();
    renderDevSliders();
    syncDevUI();
    showSettingsTab(settings.lastTab, false);
    setSettingsStatus('');
    setSettingsStatus('', devStatus);
    if (settingsCloseBtn && settingsCloseBtn.focus) settingsCloseBtn.focus({ preventScroll: true });
  }

  function closeSettings() {
    if (!settingsOpen) return;
    bindingAction = null;
    settingsOpen = false;
    settingsModal.hidden = true;
    document.body.classList.remove('settings-open');
    if (game) game.settingsOpen = false;
    input.setSuspended(false);
    input.clearAll();
    syncControlTexts();
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  }

  function clockLimits() {
    const maxW = Math.max(200, window.innerWidth - CLOCK_MARGIN * 2);
    const maxH = Math.max(220, window.innerHeight - CLOCK_MARGIN * 2);
    return {
      minW: Math.min(CLOCK_MIN_W, maxW),
      minH: Math.min(CLOCK_MIN_H, maxH),
      maxW: maxW,
      maxH: maxH
    };
  }

  function applyClockBox(box) {
    const limits = clockLimits();
    const w = Math.max(limits.minW, Math.min(limits.maxW, Number(box.w) || 282));
    const h = Math.max(limits.minH, Math.min(limits.maxH, Number(box.h) || 380));
    const x = Math.max(CLOCK_MARGIN, Math.min(window.innerWidth - w - CLOCK_MARGIN, Number(box.x) || 0));
    const y = Math.max(CLOCK_MARGIN, Math.min(window.innerHeight - h - CLOCK_MARGIN, Number(box.y) || 0));
    clockPanel.style.left = Math.round(x) + 'px';
    clockPanel.style.top = Math.round(y) + 'px';
    clockPanel.style.width = Math.round(w) + 'px';
    clockPanel.style.height = Math.round(h) + 'px';
  }

  function defaultClockBox() {
    const limits = clockLimits();
    const sundial = timeBtn.getBoundingClientRect();
    const w = Math.min(282, limits.maxW);
    clockPanel.style.width = Math.round(w) + 'px';
    clockPanel.style.height = 'auto';
    const measured = clockPanel.offsetHeight || 380;
    const h = Math.max(limits.minH, Math.min(limits.maxH, measured));
    return {
      w: w,
      h: h,
      x: sundial.left + sundial.width / 2 - w / 2,
      y: sundial.bottom + 4
    };
  }

  function positionClock() {
    applyClockBox(settings.clockBox || defaultClockBox());
  }

  function saveClockBox() {
    if (clockPanel.hidden) return;
    const rect = clockPanel.getBoundingClientRect();
    settings.clockBox = {
      x: Math.round(rect.left),
      y: Math.round(rect.top),
      w: Math.round(rect.width),
      h: Math.round(rect.height)
    };
    writeSettings();
  }

  function endClockGesture(event) {
    if (!clockGesture) return;
    if (event && event.pointerId != null && event.pointerId !== clockGesture.id) return;
    clockGesture = null;
    clockPanel.classList.remove('is-moving', 'is-resizing');
    window.removeEventListener('pointermove', moveClockGesture);
    window.removeEventListener('pointerup', endClockGesture);
    window.removeEventListener('pointercancel', endClockGesture);
    saveClockBox();
  }

  function moveClockGesture(event) {
    if (!clockGesture || event.pointerId !== clockGesture.id) return;
    event.preventDefault();
    const dx = event.clientX - clockGesture.startX;
    const dy = event.clientY - clockGesture.startY;
    const box = Object.assign({}, clockGesture.box);
    if (clockGesture.mode === 'move') {
      box.x = clockGesture.box.x + dx;
      box.y = clockGesture.box.y + dy;
    } else {
      box.w = clockGesture.box.w + dx;
      box.h = clockGesture.box.h + dy;
    }
    applyClockBox(box);
  }

  function beginClockGesture(mode, event) {
    if (event.button != null && event.button !== 0) return;
    if (mode === 'move' && event.target.closest && event.target.closest('.clock-close')) return;
    event.preventDefault();
    event.stopPropagation();
    const rect = clockPanel.getBoundingClientRect();
    clockGesture = {
      mode: mode,
      id: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      box: { x: rect.left, y: rect.top, w: rect.width, h: rect.height }
    };
    clockPanel.classList.add(mode === 'move' ? 'is-moving' : 'is-resizing');
    unlockAudio();
    window.addEventListener('pointermove', moveClockGesture, { passive: false });
    window.addEventListener('pointerup', endClockGesture);
    window.addEventListener('pointercancel', endClockGesture);
  }

  clockDragHandle.addEventListener('pointerdown', (event) => beginClockGesture('move', event));
  clockResize.addEventListener('pointerdown', (event) => beginClockGesture('resize', event));

  window.addEventListener('resize', () => {
    if (clockPanel.hidden) return;
    const rect = clockPanel.getBoundingClientRect();
    applyClockBox({ x: rect.left, y: rect.top, w: rect.width, h: rect.height });
  });

  function openClock() {
    if (game.state !== 'playing' || game.dialogueActive) return;
    clockPanel.hidden = false;
    timeBtn.setAttribute('aria-expanded', 'true');
    positionClock();
    updateClockUI();
    if (clockDial.focus) clockDial.focus({ preventScroll: true });
  }

  function closeClock() {
    if (clockPanel.hidden) return;
    saveClockBox();
    clockPanel.hidden = true;
    timeBtn.setAttribute('aria-expanded', 'false');
    clockDial.classList.remove('is-dragging');
    if (document.activeElement === clockDial && clockDial.blur) clockDial.blur();
  }

  function toggleClock() {
    if (clockPanel.hidden) openClock();
    else closeClock();
  }

  function setTimeFromPointer(event) {
    if (game.state !== 'playing') return;
    const rect = clockDial.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const x = ((event.clientX - rect.left) / rect.width) * 220;
    const y = ((event.clientY - rect.top) / rect.height) * 220;
    const angle = Math.atan2(CLOCK_CY - y, x - CLOCK_CX);
    let ratio = (Math.PI - angle) / (Math.PI * 2);
    if (ratio < 0) ratio += 1;
    if (ratio >= 1) ratio = 0;
    game.setTimeValue(ratio * 4);
    syncTimeUI();
  }

  function unlockAudio() {
    sfx.init();
    sfx.resume();
  }

  document.addEventListener('pointerdown', unlockAudio, { capture: true, passive: true });
  window.addEventListener('keydown', unlockAudio, { capture: true });

  function syncMuteUI() {
    const muted = sfx.muted;
    document.body.classList.toggle('is-muted', muted);
    muteBtn.setAttribute('aria-pressed', muted ? 'true' : 'false');
    muteBtn.setAttribute('aria-label', muted ? '全部声音已静音，点击开启' : '全部声音已开启，点击静音');
    muteLabel.textContent = muted ? 'AUDIO OFF' : 'AUDIO ON';
    syncSettingsMute();
  }

  function toggleMute() {
    unlockAudio();
    const muted = sfx.toggleMute();
    syncMuteUI();
    if (!muted) sfx.click();
    statusLive.textContent = muted ? '声音已关闭。' : '声音已开启。';
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  }

  function clearTouchState() {
    touchButtons.forEach((button) => button.classList.remove('is-down'));
  }

  function handleState(state, payload) {
    overlay.hidden = state === 'playing';
    titleCard.hidden = state !== 'title';
    pauseCard.hidden = state !== 'paused';
    completeCard.hidden = state !== 'complete';
    failCard.hidden = state !== 'failed';
    document.body.dataset.state = state;

    const canPause = state === 'playing' || state === 'paused';
    pauseBtn.disabled = !canPause;
    timeBtn.disabled = state !== 'playing';
    if (state !== 'playing') closeClock();
    pauseBtn.setAttribute('aria-label', state === 'paused' ? '继续游戏' : '暂停游戏');
    pauseGlyph.textContent = state === 'paused' ? '▶' : 'II';
    syncTimeUI();
    syncDialogue();

    if (state !== 'playing') {
      input.clearAll();
      clearTouchState();
    }

    if (state === 'playing') {
      if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
      syncTimeUI();
      statusLive.textContent = '游戏开始。按 T 切换时间，把冰块推到祭坛。';
      refreshBestLine();
    } else if (state === 'paused') {
      statusLive.textContent = '游戏已暂停。';
    } else if (state === 'complete' && payload) {
      showResults(payload);
      statusLive.textContent = '冰块送达。剩余完整度 ' + payload.integrity + '%，用时 ' + PJ.formatTime(payload.time) + '。';
    } else if (state === 'failed' && payload) {
      showFail(payload);
      statusLive.textContent = payload.reason === 'cold'
        ? '寒意满溢。按 R 或按钮重试。'
        : '冰块融化了。按 R 或按钮重试。';
    } else if (state === 'title') {
      syncTimeUI();
      refreshBestLine();
      statusLive.textContent = '游戏准备就绪。按空格或回车开始。';
    }
  }

  function showResults(stats) {
    clearTime.textContent = PJ.formatTime(stats.time);
    clearIce.textContent = stats.integrity + '%';
    clearDeaths.textContent = String(stats.deaths);
    clearShards.textContent = stats.shardsTotal
      ? 'SHARDS  ' + stats.shards + ' / ' + stats.shardsTotal
      : '';

    const isNewBest =
      bestRun == null ||
      stats.integrity > bestRun.integrity ||
      (stats.integrity === bestRun.integrity && stats.time < bestRun.time);
    if (isNewBest) writeBest(stats);
    newBest.hidden = !isNewBest;
    clearBest.textContent = bestRun == null
      ? ''
      : 'BEST ICE ' + bestRun.integrity + '% · ' + PJ.formatTime(bestRun.time);
    refreshBestLine();
  }

  function showFail(stats) {
    failTime.textContent = PJ.formatTime(stats.time);
    failDeaths.textContent = String(stats.deaths);

    if (stats.reason === 'cold') {
      failCard.dataset.reason = 'cold';
      failEyebrow.textContent = 'HYPOTHERMIA';
      failTitle.textContent = '寒意满溢';
      failCopy.textContent = '夜晚的寒气迅速侵入身体。切换到白昼，站到没有被遮住的阳光下取暖，然后再继续运冰。';
      failStatLabel.textContent = 'CHILL';
      failStatValue.textContent = '100%';
    } else {
      failCard.dataset.reason = 'melt';
      failEyebrow.textContent = 'ICE LOST';
      failTitle.textContent = '冰块融化了';
      failCopy.textContent = '直射阳光会持续削减冰块。让高处的石块挡住阳光，或在夜晚停止融化，再用白昼的阴影继续推进。';
      failStatLabel.textContent = 'ICE LEFT';
      failStatValue.textContent = '0%';
    }
  }

  const game = new PJ.Game({
    canvas: canvas,
    level: PJ.LEVELS[0],
    input: input,
    sfx: sfx,
    onStateChange: handleState
  });
  if (stageLabel) stageLabel.textContent = game.level.label;

  function beginGame(options) {
    if (game.state !== 'title') return;
    const silent = options && options.silent;
    if (!silent) {
      unlockAudio();
      sfx.click();
    }
    game.startRun();
    input.clearAll();
    syncTimeUI();
  }

  function restartGame() {
    if (game.state === 'title') {
      beginGame();
      return;
    }
    unlockAudio();
    sfx.click();
    game.restartRun();
    input.clearAll();
    syncTimeUI();
    syncDialogue();
  }

  function backToTitle() {
    unlockAudio();
    sfx.click();
    game.toTitle();
    input.clearAll();
    if (startBtn && startBtn.focus) startBtn.focus({ preventScroll: true });
  }

  function togglePause() {
    if (game.state !== 'playing' && game.state !== 'paused') return;
    unlockAudio();
    game.togglePause();
    input.clearAll();
  }

  /* ------------------------------------------------------------------ */
  /* Buttons + keyboard                                                 */
  /* ------------------------------------------------------------------ */

  startBtn.addEventListener('click', () => beginGame());
  dialogueNext.addEventListener('click', (event) => {
    event.stopPropagation();
    advanceDialogue();
  });
  dialogueLayer.addEventListener('pointerdown', (event) => {
    event.stopPropagation();
  });
  dialogueLayer.addEventListener('click', (event) => {
    if (event.target === dialogueNext || dialogueNext.contains(event.target)) return;
    event.stopPropagation();
    advanceDialogue();
  });
  timeBtn.addEventListener('click', () => toggleClock());
  clockCloseBtn.addEventListener('click', () => closeClock());
  clockPresetButtons.forEach((button) => {
    button.addEventListener('click', () => {
      changeTime(Number(button.getAttribute('data-clock-preset')));
      updateClockUI();
    });
  });

  let clockPointer = null;
  clockDial.addEventListener('pointerdown', (event) => {
    if (game.state !== 'playing') return;
    event.preventDefault();
    event.stopPropagation();
    unlockAudio();
    clockPointer = event.pointerId;
    clockDial.classList.add('is-dragging');
    try {
      clockDial.setPointerCapture(event.pointerId);
    } catch (error) {
      /* Pointer capture is a nice-to-have for touch drags. */
    }
    setTimeFromPointer(event);
  });
  clockDial.addEventListener('pointermove', (event) => {
    if (clockPointer == null || event.pointerId !== clockPointer) return;
    event.preventDefault();
    setTimeFromPointer(event);
  });
  const endClockDrag = (event) => {
    if (clockPointer == null || event.pointerId !== clockPointer) return;
    clockPointer = null;
    clockDial.classList.remove('is-dragging');
    try {
      clockDial.releasePointerCapture(event.pointerId);
    } catch (error) {
      /* The pointer may already be released. */
    }
  };
  clockDial.addEventListener('pointerup', endClockDrag);
  clockDial.addEventListener('pointercancel', endClockDrag);
  clockDial.addEventListener('lostpointercapture', endClockDrag);

  clockDial.addEventListener('keydown', (event) => {
    if (game.state !== 'playing') return;
    let delta = 0;
    const minute = 1 / 360;
    if (event.code === 'ArrowLeft' || event.code === 'ArrowDown') delta = -minute;
    else if (event.code === 'ArrowRight' || event.code === 'ArrowUp') delta = minute;
    else if (event.code === 'Home') game.setTimeValue(0);
    else if (event.code === 'End') game.setTimeValue(3);
    else return;
    event.preventDefault();
    event.stopPropagation();
    if (delta) game.setTimeValue(game.timeValue + delta);
    syncTimeUI();
  });

  document.addEventListener('pointerdown', (event) => {
    if (clockPanel.hidden) return;
    if (clockPanel.contains(event.target) || timeBtn.contains(event.target)) return;
    closeClock();
  });

  buildClockTicks();
  failRetryBtn.addEventListener('click', () => {
    unlockAudio();
    sfx.click();
    game.restartRun();
    input.clearAll();
    syncTimeUI();
  });
  failTitleBtn.addEventListener('click', backToTitle);
  resumeBtn.addEventListener('click', () => {
    unlockAudio();
    game.resume();
    input.clearAll();
    if (resumeBtn.blur) resumeBtn.blur();
  });
  restartBtn.addEventListener('click', () => {
    unlockAudio();
    sfx.click();
    game.restartRun();
    input.clearAll();
    syncTimeUI();
  });
  againBtn.addEventListener('click', () => {
    unlockAudio();
    sfx.click();
    game.restartRun();
    input.clearAll();
    syncTimeUI();
  });
  titleBtn.addEventListener('click', backToTitle);
  muteBtn.addEventListener('click', toggleMute);
  settingsBtn.addEventListener('click', openSettings);
  settingsCloseBtn.addEventListener('click', closeSettings);
  settingsDoneBtn.addEventListener('click', closeSettings);
  settingsModal.addEventListener('click', (event) => {
    if (event.target === settingsModal) closeSettings();
  });

  settingsTabButtons.forEach((button) => {
    button.addEventListener('click', () => showSettingsTab(button.getAttribute('data-settings-tab'), true));
  });

  volumeRange.addEventListener('input', () => {
    settings.volume = Math.max(0, Math.min(1, Number(volumeRange.value) / 100));
    sfx.setVolume(settings.volume);
    syncVolumeUI();
    writeSettings();
  });
  volumeRange.addEventListener('change', () => {
    unlockAudio();
    sfx.click();
  });

  musicVolumeRange.addEventListener('input', () => {
    settings.musicVolume = Math.max(0, Math.min(1, Number(musicVolumeRange.value) / 100));
    sfx.setMusicVolume(settings.musicVolume);
    syncVolumeUI();
    writeSettings();
  });

  settingsMuteBtn.addEventListener('click', () => {
    toggleMute();
    syncSettingsMute();
  });

  resetBindingsBtn.addEventListener('click', () => {
    bindingAction = null;
    settings.bindings = PJ.cloneBindings(PJ.DEFAULT_BINDINGS);
    input.setBindings(settings.bindings);
    writeSettings();
    renderBindings();
    syncControlTexts();
    setSettingsStatus('已恢复默认按键。');
    if (input.clearAll) input.clearAll();
  });

  devToggle.addEventListener('change', () => {
    settings.developer = devToggle.checked;
    applyDeveloperTuning();
    writeSettings();
    syncDevUI();
    renderDevSliders();
    setSettingsStatus(settings.developer ? '开发者参数已启用。' : '已恢复默认参数。', devStatus);
  });

  devResetBtn.addEventListener('click', () => {
    settings.tuning = Object.assign({}, PJ.DEFAULT_TUNING);
    if (settings.developer) applyDeveloperTuning();
    writeSettings();
    renderDevSliders();
    syncDevUI();
    setSettingsStatus('参数已恢复默认。', devStatus);
  });

  pauseBtn.addEventListener('click', () => {
    togglePause();
    if (pauseBtn.blur) pauseBtn.blur();
  });

  screen.addEventListener('click', (event) => {
    if (game.state !== 'playing' || game.dialogueActive) return;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const wx = ((event.clientX - rect.left) / rect.width) * PJ.VIEW_W + game.camera.x;
    const wy = ((event.clientY - rect.top) / rect.height) * PJ.VIEW_H + game.camera.y;
    if (!game.npcContains(wx, wy)) return;
    if (game.startDialogue()) {
      input.clearAll();
      syncDialogue();
    }
  });

  window.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    const code = event.code;

    if (handleBindingKey(event)) return;

    if (settingsOpen) {
      if (code === 'Escape') {
        event.preventDefault();
        closeSettings();
      }
      return;
    }

    if (game.dialogueActive) {
      const advance = code === 'Enter' || code === 'NumpadEnter' || input.matches('talk', code);
      if (advance) {
        event.preventDefault();
        advanceDialogue();
        return;
      }
      if (code === 'Escape') {
        event.preventDefault();
        game.closeDialogue();
        syncDialogue();
        return;
      }
      // Other controls (time, pause, restart, F3) stay live while talking.
    }

    if (input.matches('talk', code) && game.state === 'playing' && talkToNpc()) {
      event.preventDefault();
      return;
    }

    if (code === 'F3') {
      event.preventDefault();
      game.toggleDebug();
      return;
    }

    if (code === 'KeyM') {
      event.preventDefault();
      toggleMute();
      return;
    }

    if (game.state === 'title' && (code === 'Enter' || code === 'NumpadEnter' || code === 'Space')) {
      event.preventDefault();
      beginGame();
      return;
    }

    if (code === 'Escape' && !clockPanel.hidden) {
      event.preventDefault();
      closeClock();
      return;
    }

    if (input.matches('pause', code)) {
      if (game.state === 'playing' || game.state === 'paused') {
        event.preventDefault();
        togglePause();
      }
      return;
    }

    const presetKey = code.indexOf('Digit') === 0 ? code.slice(5) : code.indexOf('Numpad') === 0 ? code.slice(6) : null;
    if (game.state === 'playing' && (input.matches('time', code) || (presetKey && presetKey >= '1' && presetKey <= '4'))) {
      event.preventDefault();
      if (input.matches('time', code)) changeTime(null);
      else changeTime(Number(presetKey) - 1);
      return;
    }

    if (input.matches('restart', code) && game.state !== 'title') {
      event.preventDefault();
      restartGame();
      return;
    }

    if (game.state === 'complete' && (code === 'Enter' || code === 'NumpadEnter')) {
      event.preventDefault();
      restartGame();
    }
  });

  /* ------------------------------------------------------------------ */
  /* Touch controls                                                     */
  /* ------------------------------------------------------------------ */

  const coarsePointer = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
  const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  if (coarsePointer || (hasTouch && window.innerWidth < 900)) {
    document.body.classList.add('touch-capable');
  }

  touchButtons.forEach((button) => {
    const action = button.getAttribute('data-action');
    let activePointer = null;

    const press = (event) => {
      if (game.state !== 'playing' || game.dialogueActive || settingsOpen) return;
      event.preventDefault();
      unlockAudio();
      activePointer = event.pointerId;
      button.classList.add('is-down');
      input.setVirtual(action, true);
      try {
        button.setPointerCapture(event.pointerId);
      } catch (error) {
        /* Pointer capture is a nice-to-have. */
      }
    };

    const release = (event) => {
      if (activePointer != null && event.pointerId !== activePointer) return;
      event.preventDefault();
      activePointer = null;
      button.classList.remove('is-down');
      input.setVirtual(action, false);
    };

    button.addEventListener('pointerdown', press);
    button.addEventListener('pointerup', release);
    button.addEventListener('pointercancel', release);
    button.addEventListener('lostpointercapture', release);
    button.addEventListener('contextmenu', (event) => event.preventDefault());
  });

  /* ------------------------------------------------------------------ */
  /* Responsive integer-ish cabinet fit                                 */
  /* ------------------------------------------------------------------ */

  let resizeScheduled = false;

  function fitScreen() {
    resizeScheduled = false;
    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;
    // Account for body gutters and the cabinet frame so the whole screen fits
    // a narrow phone viewport without a horizontal scrollbar.
    const horizontal = viewportW <= 760 ? 44 : 64;
    const touchDeck = document.body.classList.contains('touch-capable') ? 58 : 0;
    const vertical = (viewportW <= 760 ? 124 : 148) + touchDeck;

    const maxW = Math.max(280, Math.min(viewportW - horizontal, 1280));
    const maxH = Math.max(170, viewportH - vertical);
    const baseScale = Math.max(0.42, Math.min(maxW / PJ.VIEW_W, maxH / PJ.VIEW_H, 3.25));
    const baseW = Math.max(230, Math.floor(PJ.VIEW_W * baseScale));
    const baseH = Math.max(130, Math.floor((baseW * PJ.VIEW_H) / PJ.VIEW_W));

    const scale = Math.min(6.6, baseScale * zoomLevel);
    const w = Math.max(180, Math.floor(PJ.VIEW_W * scale));
    const h = Math.max(102, Math.floor((w * PJ.VIEW_H) / PJ.VIEW_W));

    screen.style.width = w + 'px';
    screen.style.height = h + 'px';
    shell.style.width = Math.ceil(w + 20) + 'px';
    shell.style.maxWidth = 'none';

    const compact = baseW < 680 || baseH < 500;
    document.body.classList.toggle('compact-ui', compact);
    fittedOnce = true;
  }

  function syncZoomUI() {
    const percent = Math.round(zoomLevel * 100);
    zoomValue.textContent = percent + '%';
    zoomChip.setAttribute('aria-label', '界面缩放 ' + percent + '%，点击重置为 100%');
  }

  function viewportAnchor(clientX, clientY) {
    const rect = screen.getBoundingClientRect();
    return {
      rx: (clientX - rect.left) / Math.max(1, rect.width),
      ry: (clientY - rect.top) / Math.max(1, rect.height),
      clientX: clientX,
      clientY: clientY
    };
  }

  function setZoom(next, anchor) {
    const clamped = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, next));
    if (Math.abs(clamped - zoomLevel) < 0.001) return;

    const before = screen.getBoundingClientRect();
    const pin = anchor || {
      rx: 0.5,
      ry: 0.5,
      clientX: before.left + before.width / 2,
      clientY: before.top + before.height / 2
    };

    zoomLevel = clamped;
    fitScreen();

    // Keep the point under the mouse fixed while the cabinet grows/shrinks.
    const after = screen.getBoundingClientRect();
    const scrollX = window.scrollX || window.pageXOffset;
    const scrollY = window.scrollY || window.pageYOffset;
    const targetX = after.left + scrollX + pin.rx * after.width - pin.clientX;
    const targetY = after.top + scrollY + pin.ry * after.height - pin.clientY;
    window.scrollTo({ left: targetX, top: targetY });

    syncZoomUI();
    zoomChip.classList.add('is-active');
    window.clearTimeout(zoomChipTimer);
    zoomChipTimer = window.setTimeout(() => zoomChip.classList.remove('is-active'), 260);
  }

  zoomChip.addEventListener('click', () => {
    setZoom(1);
    if (zoomChip.blur) zoomChip.blur();
  });

  screenFrame.addEventListener(
    'wheel',
    (event) => {
      // Let pinch-to-zoom / browser zoom keep their native behavior.
      if (event.ctrlKey) return;
      event.preventDefault();
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? window.innerHeight : 1;
      const anchor = viewportAnchor(event.clientX, event.clientY);
      setZoom(zoomLevel * Math.exp(-event.deltaY * unit * 0.00135), anchor);
    },
    { passive: false }
  );

  screenFrame.addEventListener('dblclick', () => setZoom(1));

  function scheduleFit() {
    if (resizeScheduled) return;
    resizeScheduled = true;
    window.requestAnimationFrame(fitScreen);
  }

  window.addEventListener('resize', scheduleFit);
  window.addEventListener('orientationchange', scheduleFit);

  /* ------------------------------------------------------------------ */
  /* Main loop                                                          */
  /* ------------------------------------------------------------------ */

  const STEP = 1 / 120;
  let lastTime = performance.now();
  let accumulator = 0;
  let fpsTimer = 0;
  let fpsFrames = 0;
  let crashed = false;

  function showError(error) {
    if (crashed) return;
    crashed = true;
    errorPanel.hidden = false;
    errorText.textContent = String((error && error.stack) || error || 'Unknown error');
    statusLive.textContent = '游戏遇到错误。';
    if (window.console && console.error) console.error(error);
  }

  window.addEventListener('error', (event) => {
    showError(event.error || event.message);
  });

  window.addEventListener('unhandledrejection', (event) => {
    showError(event.reason);
  });

  reloadBtn.addEventListener('click', () => window.location.reload());

  function frame(now) {
    if (crashed) return;

    try {
      const rawDt = Math.max(0, (now - lastTime) / 1000);
      lastTime = now;
      const dt = Math.min(rawDt, 0.1);
      accumulator += dt;

      let steps = 0;
      while (accumulator >= STEP && steps < 8) {
        game.update(STEP);
        input.endFrame();
        accumulator -= STEP;
        steps += 1;
      }
      if (steps === 8) accumulator = 0;

      game.render();
      if (game.state === 'playing' || !clockPanel.hidden) updateClockUI();
      if (game.state === 'playing' || !dialogueLayer.hidden) syncDialogue();

      fpsTimer += rawDt;
      fpsFrames += 1;
      if (fpsTimer >= 1) {
        fpsLabel.textContent = Math.round(fpsFrames / fpsTimer) + ' FPS';
        fpsTimer = 0;
        fpsFrames = 0;
      }
    } catch (error) {
      showError(error);
      return;
    }

    window.requestAnimationFrame(frame);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (!settingsOpen) game.pause();
    } else {
      lastTime = performance.now();
      accumulator = 0;
    }
  });

  /* ------------------------------------------------------------------ */
  /* Boot                                                               */
  /* ------------------------------------------------------------------ */

  // Small public handle for framework debugging / automated visual checks.
  window.PixelRunner = {
    game: game,
    input: input,
    sfx: sfx,
    beginGame: beginGame,
    restartGame: restartGame,
    backToTitle: backToTitle,
    setZoom: setZoom,
    cycleTime: () => changeTime(null),
    syncTimeUI: syncTimeUI,
    openClock: openClock,
    closeClock: closeClock,
    openSettings: openSettings,
    closeSettings: closeSettings
  };

  syncVolumeUI();
  renderBindings();
  renderGuide();
  renderDevSliders();
  syncDevUI();
  syncControlTexts();
  showSettingsTab(settings.lastTab, false);
  syncMuteUI();
  handleState('title');
  refreshBestLine();
  syncZoomUI();
  fitScreen();
  // A second fit after layout settles avoids a first-paint size jump.
  window.requestAnimationFrame(() => {
    if (!fittedOnce) fitScreen();
    scheduleFit();
  });

  if (query.get('debug') === '1') game.debug = true;
  if (query.get('play') === '1') {
    window.setTimeout(() => {
      if (game.state === 'title') beginGame({ silent: true });
    }, 120);
  }

  window.requestAnimationFrame((now) => {
    lastTime = now;
    window.requestAnimationFrame(frame);
  });
})();
