// ============================================================
// 屿 IsleOS v4.1 — 生命周期层（N.shell）
// 锁屏 / 关机 / 重启 / 首启向导 / 恢复出厂
// ============================================================
window.N = window.N || {};

N.shell = (function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const WEEK = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

  // ---------- 文案工具 ----------
  function greetText(d) {
    const h = d.getHours();
    if (h >= 5 && h < 11) return '早上好';
    if (h >= 11 && h < 14) return '中午好';
    if (h >= 14 && h < 18) return '下午好';
    if (h >= 18 && h < 23) return '晚上好';
    return '夜深了';
  }
  function dateText(d) {
    return (d.getMonth() + 1) + '月' + d.getDate() + '日 ' + WEEK[d.getDay()];
  }
  function userName() {
    return (N.state.get('name', '') || '').trim();
  }

  // ---------- 锁屏 ----------
  let lockTimer = null;
  let locked = false;

  function renderLock() {
    const d = new Date();
    const t = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
    const timeEl = $('lockTime');
    if (timeEl.textContent !== t) timeEl.textContent = t;
    $('lockDate').textContent = dateText(d);
    const name = userName();
    $('lockGreet').textContent = greetText(d) + (name ? '，' + name : '');
  }

  function lock() {
    if (locked || off) return;
    locked = true;
    const layer = $('lockLayer');
    layer.classList.remove('unlocking');
    layer.hidden = false;
    renderLock();
    clearInterval(lockTimer);
    lockTimer = setInterval(renderLock, 5000);
    N.menu.close();
    N.notify.togglePanel(false);
  }

  function unlock() {
    if (!locked) return;
    locked = false;
    const layer = $('lockLayer');
    layer.classList.add('unlocking');
    clearInterval(lockTimer);
    setTimeout(() => {
      layer.hidden = true;
      layer.classList.remove('unlocking');
    }, 340);
  }

  // ---------- 关机 / 重启 ----------
  let off = false;

  function hideShell() {
    ['topbar', 'dock', 'desktop', 'notifyPanel', 'menuRoot'].forEach(id => {
      const el = $(id);
      if (el) el.hidden = true;
    });
    N.menu.close();
    N.notify.togglePanel(false);
    try { N.wm.closeAll(); } catch (e) { /* 窗口清理失败不阻塞关机 */ }
  }

  function shutdown() {
    if (off) return;
    off = true;
    if (locked) unlock();
    hideShell();
    const layer = $('powerLayer');
    layer.querySelector('.power-text').textContent = '已关机 · 点按电源开机';
    layer.hidden = false;
    [784, 587.3, 392].forEach((f, i) =>
      setTimeout(() => N.audio.tone(f, 0.3, 'sine', 0.09, true), i * 150));
  }

  function restart() {
    if (off) return;
    off = true;
    if (locked) unlock();
    hideShell();
    const layer = $('powerLayer');
    layer.querySelector('.power-text').textContent = '正在重新启动…';
    layer.hidden = false;
    const btn = $('powerBtn');
    if (btn) btn.style.display = 'none';
    [523.25, 392].forEach((f, i) =>
      setTimeout(() => N.audio.tone(f, 0.22, 'sine', 0.08, true), i * 120));
    setTimeout(() => location.reload(), 900);
  }

  // ---------- 首启向导 ----------
  let wlState = { theme: 'auto', wall: 0 };

  function showWelcome() {
    const layer = $('welcomeLayer');
    layer.hidden = false;

    // 外观：即时预览，上岛时才落盘
    const themeWrap = $('wlTheme');
    themeWrap.querySelectorAll('button').forEach(b => {
      b.classList.toggle('active', b.dataset.v === wlState.theme);
      b.onclick = () => {
        wlState.theme = b.dataset.v;
        themeWrap.querySelectorAll('button').forEach(x => x.classList.toggle('active', x === b));
        N.theme.apply(wlState.theme);
      };
    });

    // 壁纸：点击即应用（applyGradient 自带记忆）
    const wallsWrap = $('wlWalls');
    wallsWrap.innerHTML = '';
    N.wallpaper.GRADS.forEach((g, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = g + (i === wlState.wall ? ' active' : '');
      b.title = '壁纸 ' + (i + 1);
      b.onclick = () => {
        wlState.wall = i;
        wallsWrap.querySelectorAll('button').forEach(x => x.classList.toggle('active', x === b));
        N.wallpaper.applyGradient(i);
      };
      wallsWrap.appendChild(b);
    });

    const nameInput = $('wlName');
    nameInput.value = N.state.get('name', '') || '';
    nameInput.onkeydown = (e) => { if (e.key === 'Enter') doneWelcome(); };
    $('wlDone').onclick = doneWelcome;
    $('wlSkip').onclick = skipWelcome;

    setTimeout(() => { try { nameInput.focus(); } catch (e) { /* 虚拟键盘环境 */ } }, 260);
  }

  function finishWelcome() {
    const layer = $('welcomeLayer');
    layer.style.transition = 'opacity .4s ease';
    layer.style.opacity = '0';
    setTimeout(() => {
      layer.hidden = true;
      layer.style.transition = '';
      layer.style.opacity = '';
    }, 420);
    N.sounds.startup();
  }

  function doneWelcome() {
    const name = $('wlName').value.trim();
    if (name) N.state.set('name', name.slice(0, 16));
    N.state.set('theme', wlState.theme);
    N.state.set('setupDone', true);
    N.theme.apply(wlState.theme);
    finishWelcome();
    N.notify.toast(name ? '欢迎上岛，' + name : '欢迎上岛', { silent: true });
  }

  function skipWelcome() {
    N.state.set('setupDone', true);
    finishWelcome();
  }

  // ---------- 恢复出厂 ----------
  async function factoryReset() {
    const ok = await N.modal.confirm({
      title: '恢复出厂',
      message: '将清除全部设置、便签与文件（含图库作品），并重新走一遍上岛向导。此操作不可恢复。',
      okText: '恢复出厂', danger: true
    });
    if (!ok) return;
    const ok2 = await N.modal.confirm({
      title: '最后确认',
      message: '确定清除小岛上的一切吗？',
      okText: '清除一切', danger: true
    });
    if (!ok2) return;
    try { await N.vfs.wipeAll(); } catch (e) { /* 尽力清除 */ }
    try {
      Object.keys(localStorage)
        .filter(k => k.startsWith('nimbus.'))
        .forEach(k => localStorage.removeItem(k));
      sessionStorage.clear();
    } catch (e) { /* 忽略 */ }
    location.reload();
  }

  // ---------- 初始化 ----------
  function init() {
    const btn = $('powerBtn');
    if (btn) btn.addEventListener('click', () => location.reload());
    const lockEl = $('lockLayer');
    if (lockEl) lockEl.addEventListener('click', unlock);
  }

  return {
    init, lock, unlock, shutdown, restart,
    showWelcome, factoryReset,
    isLocked: () => locked,
    isOff: () => off,
    isSetupDone: () => N.state.get('setupDone', false) === true,
  };
})();
