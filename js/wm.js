// ============================================================
// 屿 IsleOS v4.1 — 窗口管理器（N.wm）
// 窗口：拖动 / resize / 最小化 / 最大化 / 关闭 / 焦点
// 小屏自动全屏；键盘弹起跟随可视区；跨断点智能切换
// ============================================================
window.N = window.N || {};

N.wm = (function () {
  'use strict';

  const DESK_APPS = ['files', 'notes', 'gallery', 'clock', 'agent'];
  const openWins = {};   // appId -> win element
  let zTop = 100;
  let winSeq = 0;

  // 与 CSS 断点（max-width: 720px）保持一致
  function isMobile() { return window.innerWidth <= 720; }

  function focusWin(win) {
    zTop += 1;
    win.style.zIndex = zTop;
    document.querySelectorAll('.win').forEach(w => w.classList.remove('focused'));
    win.classList.add('focused');
    syncDock();
  }

  function syncDock() {
    document.querySelectorAll('.dock-item').forEach(item => {
      const id = item.dataset.app;
      const win = openWins[id];
      const running = !!win && !win.classList.contains('minimized');
      item.classList.toggle('running', running);
      item.classList.toggle('minned', !!win && win.classList.contains('minimized'));
    });
  }

  function closeWin(win) {
    const id = win.dataset.app;
    if (typeof win._onClose === 'function') {
      try { win._onClose(); } catch (e) { /* 清理回调异常不影响关窗 */ }
    }
    win.classList.add('closing');
    setTimeout(() => {
      win.remove();
      delete openWins[id];
      syncDock();
    }, 180);
  }

  // 立即关闭全部窗口（关机 / 重启 / 恢复出厂前调用）
  function closeAll() {
    Object.values(openWins).forEach(win => {
      if (typeof win._onClose === 'function') {
        try { win._onClose(); } catch (e) { /* 忽略 */ }
      }
      win.remove();
    });
    Object.keys(openWins).forEach(k => delete openWins[k]);
    syncDock();
  }

  function openApp(appId, params) {
    const app = N.apps.get(appId);
    if (!app) { N.notify.toast('应用不存在：' + appId); return; }

    const existing = openWins[appId];
    if (existing) {
      if (existing.classList.contains('minimized')) existing.classList.remove('minimized');
      focusWin(existing);
      if (typeof existing._onParams === 'function') {
        try { existing._onParams(params || {}); } catch (e) { /* 参数回调忽略 */ }
      }
      return existing;
    }

    const win = document.createElement('div');
    win.className = 'win';
    win.dataset.app = appId;

    const W = Math.min(app.w || 520, window.innerWidth - 20);
    const H = Math.min(app.h || 400, window.innerHeight - 120);
    const x = Math.max(10, (window.innerWidth - W) / 2 + (winSeq % 5) * 26 - 52);
    const y = Math.max(38, (window.innerHeight - H) / 2 - 26 + (winSeq % 5) * 22 - 44);
    Object.assign(win.style, { width: W + 'px', height: H + 'px', left: x + 'px', top: y + 'px' });
    if (isMobile()) win.classList.add('maxed');
    winSeq += 1;

    win.innerHTML =
      '<div class="win-titlebar">' +
        '<div class="traffic">' +
          '<button class="t-dot t-close" data-sym="✕" title="关闭" aria-label="关闭"></button>' +
          '<button class="t-dot t-min" data-sym="−" title="最小化" aria-label="最小化"></button>' +
          '<button class="t-dot t-max" data-sym="+" title="最大化" aria-label="最大化"></button>' +
        '</div>' +
        '<div class="win-title"></div>' +
      '</div>' +
      '<div class="win-body"></div>';
    win.querySelector('.win-title').textContent = app.name;

    document.body.appendChild(win);
    openWins[appId] = win;
    focusWin(win);

    try {
      app.render(win.querySelector('.win-body'), win, params || {});
    } catch (err) {
      win.querySelector('.win-body').innerHTML =
        '<div style="padding:20px;color:var(--text-2);font-size:13px;">应用加载出错：' +
        String(err && err.message || err) + '</div>';
    }
    syncDock();

    // 红绿灯
    win.querySelector('.t-close').addEventListener('click', (e) => { e.stopPropagation(); closeWin(win); });
    win.querySelector('.t-min').addEventListener('click', (e) => {
      e.stopPropagation();
      win.classList.add('minimized');
      syncDock();
    });
    win.querySelector('.t-max').addEventListener('click', (e) => {
      e.stopPropagation();
      win.classList.toggle('maxed');
    });
    win.addEventListener('pointerdown', () => focusWin(win));

    // 拖动（pointer events，鼠标/触摸统一）
    const bar = win.querySelector('.win-titlebar');
    let drag = null;
    bar.addEventListener('pointerdown', (e) => {
      if (e.target.closest('.t-dot') || win.classList.contains('maxed')) return;
      drag = { dx: e.clientX - win.offsetLeft, dy: e.clientY - win.offsetTop };
      focusWin(win);
      bar.setPointerCapture(e.pointerId);
      e.preventDefault();
    });
    bar.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const nx = Math.min(window.innerWidth - 70, Math.max(-win.offsetWidth + 90, e.clientX - drag.dx));
      const ny = Math.min(window.innerHeight - 60, Math.max(34, e.clientY - drag.dy));
      win.style.left = nx + 'px';
      win.style.top = ny + 'px';
    });
    bar.addEventListener('pointerup', () => { drag = null; });
    bar.addEventListener('pointercancel', () => { drag = null; });

    // 双击标题栏 最大化/还原
    bar.addEventListener('dblclick', (e) => {
      if (e.target.closest('.t-dot')) return;
      win.classList.toggle('maxed');
    });

    // resize（右 / 下 / 右下）
    ['e', 's', 'se'].forEach(dir => {
      const h = document.createElement('div');
      h.className = 'rs rs-' + dir;
      win.appendChild(h);
      h.addEventListener('pointerdown', (e) => {
        if (win.classList.contains('maxed')) return;
        e.preventDefault();
        e.stopPropagation();
        const sw = win.offsetWidth, sh = win.offsetHeight, sx = e.clientX, sy = e.clientY;
        const minW = app.minW || 300, minH = app.minH || 200;
        h.setPointerCapture(e.pointerId);
        function move(ev) {
          if (dir !== 's') win.style.width = Math.max(minW, sw + ev.clientX - sx) + 'px';
          if (dir !== 'e') win.style.height = Math.max(minH, sh + ev.clientY - sy) + 'px';
        }
        function up() {
          window.removeEventListener('pointermove', move);
          window.removeEventListener('pointerup', up);
        }
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', up);
      });
    });

    return win;
  }

  // ---------- 视口变化：跨断点切换 + 键盘适配 ----------
  function bindViewport() {
    let wasMobile = isMobile();

    let rzTimer = null;
    window.addEventListener('resize', () => {
      const m = isMobile();
      if (m !== wasMobile) {
        Object.values(openWins).forEach(w => {
          if (m) {
            w._wasMaxed = w.classList.contains('maxed');
            w.classList.add('maxed');
          } else {
            if (!w._wasMaxed) w.classList.remove('maxed');
            delete w._wasMaxed;
          }
        });
        wasMobile = m;
      }
      // 桌面图标依赖视口高度分列，任何尺寸变化都需重排（节流）
      clearTimeout(rzTimer);
      rzTimer = setTimeout(() => renderDesktop(), 120);
    });

    // 软键盘：跟随可视高度，输入框不被遮挡
    if (window.visualViewport) {
      const vv = window.visualViewport;
      const apply = () => {
        const kbOpen = vv.height < window.innerHeight * 0.78;
        document.body.classList.toggle('kb-open', kbOpen);
        document.documentElement.style.setProperty('--vvh', vv.height + 'px');
      };
      vv.addEventListener('resize', apply);
      apply();
    }
  }

  // ---------- 桌面图标 ----------
  // 视口较矮时自动分列，避免图标压到 Dock 上
  function renderDesktop() {
    const desktop = document.getElementById('desktop');
    desktop.innerHTML = '';
    const touchOnly = window.matchMedia('(hover: none)').matches;
    const usable = Math.max(180, window.innerHeight - 150);
    const perCol = Math.max(1, Math.floor(usable / 102));
    DESK_APPS.forEach((id, i) => {
      const app = N.apps.get(id);
      if (!app) return;
      const el = document.createElement('div');
      el.className = 'desk-icon';
      if (!touchOnly) {
        const col = Math.floor(i / perCol), row = i % perCol;
        el.style.right = (26 + col * 96) + 'px';
        el.style.top = (16 + row * 102) + 'px';
      }
      el.innerHTML =
        '<div class="di-glyph" style="background:' + app.bg + '">' + N.icons[app.icon] + '</div>' +
        '<span></span>';
      el.querySelector('span').textContent = app.name;
      el.addEventListener('click', () => {
        if (touchOnly) { openApp(id); return; }
        document.querySelectorAll('.desk-icon.selected').forEach(s => s.classList.remove('selected'));
        el.classList.add('selected');
      });
      el.addEventListener('dblclick', () => openApp(id));
      desktop.appendChild(el);
    });
  }

  // 点击桌面空白取消选中（只绑定一次，避免 renderDesktop 重复挂载监听器）
  function bindDesktopClick() {
    const desktop = document.getElementById('desktop');
    desktop.addEventListener('click', (e) => {
      if (e.target === desktop) {
        document.querySelectorAll('.desk-icon.selected').forEach(s => s.classList.remove('selected'));
      }
    });
  }

  // ---------- 桌面右键菜单 ----------
  function bindContextMenu() {
    const desktop = document.getElementById('desktop');
    desktop.addEventListener('contextmenu', (e) => {
      if (e.target !== desktop) return;
      e.preventDefault();
      const dark = document.documentElement.dataset.theme === 'dark';
      N.menu.open([
        { label: '下一张壁纸', action: () => N.wallpaper.next() },
        { label: '深色模式', checked: dark, action: () => toggleTheme() },
        { sep: true },
        { label: '新建文本文件', action: () => newFileOnDesk('text') },
        { label: '新建文件夹', action: () => newFileOnDesk('folder') },
        { sep: true },
        { label: '使用帮助', action: () => openApp('help') }
      ], e.clientX, e.clientY);
    });
  }

  function toggleTheme() {
    const d = document.documentElement.dataset.theme === 'dark';
    N.state.set('theme', d ? 'light' : 'dark');
    N.theme.apply(d ? 'light' : 'dark');
  }

  async function newFileOnDesk(kind) {
    if (kind === 'folder') {
      const name = await N.modal.prompt({ title: '新建文件夹', message: '将创建在 /文稿 目录下', value: '新建文件夹' });
      if (name === null) return;
      try {
        await N.vfs.mkdir('/文稿/' + name);
        N.notify.toast('已创建文件夹');
        openApp('files', { path: '/文稿' });
      } catch (err) { N.notify.toast('创建失败：' + err.message); }
    } else {
      const name = await N.modal.prompt({ title: '新建文本文件', message: '将创建在 /文稿 目录下', value: '未命名.txt' });
      if (name === null) return;
      try {
        await N.vfs.write('/文稿/' + name, '');
        N.notify.toast('已创建：' + name);
        openApp('files', { path: '/文稿' });
      } catch (err) { N.notify.toast('创建失败：' + err.message); }
    }
  }

  // ---------- Dock ----------
  // 显式定义顺序与分组（不随注册顺序漂移）：
  // [智能体 浏览器] | [文件 便签 图库 时钟] | [画板 合成器 计算器 终端] | [设置]
  // 关于本机 / 帮助不进 Dock，走顶部菜单（屿 / 帮助）。
  const DOCK_ORDER = ['agent', 'browser', 'files', 'notes', 'gallery', 'clock', 'paint', 'synth', 'calc', 'term', 'settings'];
  const DOCK_SEP_AFTER = ['browser', 'clock', 'term'];

  function renderDock() {
    const dock = document.getElementById('dock');
    dock.innerHTML = '';
    DOCK_ORDER.forEach(id => {
      const app = N.apps.get(id);
      if (!app) return;
      const item = document.createElement('div');
      item.className = 'dock-item';
      item.dataset.app = id;
      item.innerHTML =
        '<div class="dk-glyph" style="background:' + app.bg + '">' + N.icons[app.icon] + '</div>' +
        '<span class="dk-tip"></span>' +
        '<span class="dk-dot"></span>';
      item.querySelector('.dk-tip').textContent = app.name;
      item.addEventListener('click', () => {
        const win = openWins[id];
        if (win && !win.classList.contains('minimized')) {
          if (win.classList.contains('focused')) win.classList.add('minimized');
          else focusWin(win);
        } else if (win) {
          win.classList.remove('minimized');
          focusWin(win);
        } else {
          openApp(id);
        }
        syncDock();
      });
      dock.appendChild(item);
      if (DOCK_SEP_AFTER.includes(id)) {
        const sep = document.createElement('div');
        sep.className = 'dock-sep';
        dock.appendChild(sep);
      }
    });
  }

  function start() {
    renderDock();
    renderDesktop();
    bindDesktopClick();
    bindContextMenu();
    bindViewport();
    syncDock();
  }

  return { openApp, closeWin, closeAll, start, isMobile };
})();
