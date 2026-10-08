// ============================================================
// 屿 IsleOS v4.1 — 系统核心层（N.core）
// 设置持久化 / 主题 / 壁纸 / 通知 / 菜单 / 对话框 / 音效 / 顶栏
// ============================================================
window.N = window.N || {};

// 版本单一来源：所有界面显示的版本号都引用这里，
// 发布时只改这一处 + index.html/sw.js 的缓存参数。
N.VERSION = '4.4';

// ---------- 图标库 ----------
N.icons = {
  files: '<svg viewBox="0 0 24 24" fill="none"><path d="M3 7.5A2.5 2.5 0 0 1 5.5 5h4l2 2.5h7A2.5 2.5 0 0 1 21 10v7.5a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5v-10Z" fill="#fff"/></svg>',
  folder: '<svg viewBox="0 0 24 24" fill="none"><path d="M3 7.5A2.5 2.5 0 0 1 5.5 5h4l2 2.5h7A2.5 2.5 0 0 1 21 10v7.5a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5v-10Z" fill="#3ba0ff"/></svg>',
  file: '<svg viewBox="0 0 24 24" fill="none"><path d="M6 3.5h8L19 8.5v12a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-16a1 1 0 0 1 1-1Z" fill="#8e8e93"/><path d="M14 3.5 19 8.5h-5v-5Z" fill="#c7c7cc"/></svg>',
  image: '<svg viewBox="0 0 24 24" fill="none"><rect x="3" y="4.5" width="18" height="15" rx="2.5" fill="#fff"/><path d="M5 16.5l4.2-5 3 3.4 2.3-2.6L19 16.5H5Z" fill="#30d158"/><circle cx="9" cy="8.7" r="1.5" fill="#ffd60a"/></svg>',
  term: '<svg viewBox="0 0 24 24" fill="none"><rect x="3" y="4.5" width="18" height="15" rx="2.5" fill="#fff" opacity=".22"/><path d="M6.5 9.5l3.4 3.2-3.4 3.2" stroke="#fff" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/><path d="M12.5 16h5.5" stroke="#fff" stroke-width="1.9" stroke-linecap="round"/></svg>',
  calc: '<svg viewBox="0 0 24 24" fill="none"><rect x="5" y="3" width="14" height="18" rx="2.5" fill="#fff"/><rect x="7.2" y="5.4" width="9.6" height="4" rx="1" fill="#0a84ff"/><g fill="#1d1d1f"><rect x="7.2" y="11" width="2.6" height="2.6" rx=".8"/><rect x="10.7" y="11" width="2.6" height="2.6" rx=".8"/><rect x="14.2" y="11" width="2.6" height="2.6" rx=".8"/><rect x="7.2" y="14.6" width="2.6" height="2.6" rx=".8"/><rect x="10.7" y="14.6" width="2.6" height="2.6" rx=".8"/><rect x="14.2" y="14.6" width="2.6" height="2.6" rx=".8"/><rect x="7.2" y="18.2" width="6.1" height="1.6" rx=".8"/></g></svg>',
  notes: '<svg viewBox="0 0 24 24" fill="none"><path d="M5 4.5A1.5 1.5 0 0 1 6.5 3h11A1.5 1.5 0 0 1 19 4.5v15a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 19.5v-15Z" fill="#fff"/><path d="M8 8h8M8 11.5h8M8 15h5" stroke="#0a84ff" stroke-width="1.7" stroke-linecap="round"/></svg>',
  clock: '<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" fill="#fff"/><path d="M12 7v5l3.4 2" stroke="#0a84ff" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  paint: '<svg viewBox="0 0 24 24" fill="none"><path d="M12 3a9 9 0 1 0 0 18c1.4 0 2-.9 2-1.8 0-.9-.6-1.4-.6-2.2 0-1 .8-1.6 1.9-1.6H17a4.2 4.2 0 0 0 4.2-4.2C21.2 6.6 17 3 12 3Z" fill="#fff"/><circle cx="8" cy="9.4" r="1.5" fill="#ff3b30"/><circle cx="12" cy="7.4" r="1.5" fill="#ffd60a"/><circle cx="16" cy="9.4" r="1.5" fill="#30d158"/><circle cx="7.4" cy="13.6" r="1.5" fill="#0a84ff"/></svg>',
  synth: '<svg viewBox="0 0 24 24" fill="none"><path d="M9 18.5a2.6 2.6 0 1 1-1.7-2.45V6.2L19 4v3.2L9.9 8.9v7.85c0 .7-.34 1.35-.9 1.75Z" fill="#fff"/><path d="M19 4l1.6-.35v3.2L19 7.2V4Z" fill="#fff" opacity=".7"/></svg>',
  gallery: '<svg viewBox="0 0 24 24" fill="none"><rect x="3" y="4.5" width="18" height="15" rx="2.5" fill="#fff"/><path d="M5 16.5l4.2-5 3 3.4 2.3-2.6L19 16.5H5Z" fill="#ff6a88"/><circle cx="9" cy="8.7" r="1.5" fill="#ffd60a"/></svg>',
  settings: '<svg viewBox="0 0 24 24" fill="none"><path d="M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4Z" fill="#fff"/><path d="M19.4 13.5a7.6 7.6 0 0 0 0-3l2-1.5-2-3.4-2.3 1a7.7 7.7 0 0 0-2.6-1.5L14 2.5h-4l-.5 2.6a7.7 7.7 0 0 0-2.6 1.5l-2.3-1-2 3.4 2 1.5a7.6 7.6 0 0 0 0 3l-2 1.5 2 3.4 2.3-1a7.7 7.7 0 0 0 2.6 1.5l.5 2.6h4l.5-2.6a7.7 7.7 0 0 0 2.6-1.5l2.3 1 2-3.4-2-1.5Z" stroke="#fff" stroke-width="1.6"/></svg>',
  rocket: '<svg viewBox="0 0 24 24" fill="none"><path d="M4.5 16.5c-1.5 1.4-2 5-2 5s3.6-.5 5-2c.7-.8.7-2 0-2.8-.8-.7-2.2-.7-3 .8Z" fill="#fff"/><path d="M12 15l-3-3c1.5-4 4.5-8.5 10-10 .5 0 1 .5 1 1-1.5 5.5-6 8.5-10 10Z" fill="#fff"/><circle cx="15.5" cy="8.5" r="1.6" fill="#5e5ce6"/></svg>',
  help: '<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" fill="#fff"/><path d="M9.6 9.2A2.5 2.5 0 0 1 14.5 10c0 1.4-1.9 1.8-2.4 2.9-.1.3-.2.6-.2 1.1" stroke="#0a84ff" stroke-width="1.8" stroke-linecap="round"/><circle cx="12" cy="16.8" r="1.2" fill="#0a84ff"/></svg>',
  agent: '<svg viewBox="0 0 24 24" fill="none"><path d="M4 5.5A1.5 1.5 0 0 1 5.5 4h13A1.5 1.5 0 0 1 20 5.5v7A1.5 1.5 0 0 1 18.5 14H10l-4.2 4v-4H5.5A1.5 1.5 0 0 1 4 12.5v-7Z" fill="#fff"/><circle cx="8.6" cy="9.2" r="1.15" fill="#0a84ff"/><circle cx="12" cy="9.2" r="1.15" fill="#0a84ff"/><circle cx="15.4" cy="9.2" r="1.15" fill="#0a84ff"/></svg>',
  browser: '<svg viewBox="0 0 24 24" fill="none"><rect x="3" y="4" width="18" height="16" rx="3" fill="#fff"/><path d="M3 8.2h18" stroke="#0a84ff" stroke-width="2"/><circle cx="12" cy="14.4" r="3.8" stroke="#0a84ff" stroke-width="1.5"/><path d="M8.2 14.4h7.6M12 10.6v7.6" stroke="#0a84ff" stroke-width="1.1"/></svg>'
};

// ---------- 应用注册表 ----------
N.apps = {
  registry: {},
  order: [],
  register(app) {
    if (!app || !app.id || typeof app.render !== 'function') {
      throw new Error('应用注册信息不完整: ' + (app && app.id));
    }
    if (this.registry[app.id]) throw new Error('应用重复注册: ' + app.id);
    this.registry[app.id] = app;
    this.order.push(app.id);
  },
  get(id) { return this.registry[id]; }
};

// ---------- 设置持久化 ----------
N.state = (function () {
  const KEY = 'nimbus.settings';
  function all() {
    try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; }
  }
  function get(k, def) {
    const s = all();
    return (k in s) ? s[k] : def;
  }
  function set(k, v) {
    const s = all();
    s[k] = v;
    try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* 存储满等真实异常静默 */ }
    return v;
  }
  return { all, get, set };
})();

// ---------- 主题 ----------
N.theme = {
  apply(mode) {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const dark = mode === 'dark' || (mode === 'auto' && mq.matches);
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  },
  watch() {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const fn = () => {
      if (N.state.get('theme', 'light') === 'auto') this.apply('auto');
    };
    if (mq.addEventListener) mq.addEventListener('change', fn);
    else if (mq.addListener) mq.addListener(fn);
  }
};

// ---------- 毛玻璃开关 ----------
N.glass = {
  apply(on) {
    document.documentElement.classList.toggle('no-glass', !on);
  }
};

// ---------- 音频与音效 ----------
N.audio = {
  ctx: null,
  get() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    if (!this.ctx) this.ctx = new AC();
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  },
  // 简单包络音；force=true 时无视系统音效开关（如合成器）
  tone(freq, dur, type, vol, force) {
    if (!force && !N.state.get('sound', true)) return null;
    const ctx = this.get();
    if (!ctx) return null;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(vol || 0.12, ctx.currentTime + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + dur + 0.05);
    return { osc, gain };
  }
};

N.sounds = {
  startup() {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((f, i) => setTimeout(() => N.audio.tone(f, 0.35, 'sine', 0.08, true), i * 130));
  },
  notify() { N.audio.tone(880, 0.12, 'sine', 0.07); setTimeout(() => N.audio.tone(1174.7, 0.18, 'sine', 0.07), 110); },
  alarm() {
    for (let i = 0; i < 6; i++) {
      setTimeout(() => N.audio.tone(1046.5, 0.16, 'square', 0.09, true), i * 280);
    }
  }
};

// ---------- 通知（Toast + 通知中心，真实历史） ----------
N.notify = (function () {
  const list = [];      // {msg, time}
  let unread = 0;
  let toastTimer = null;

  function toastEl() { return document.getElementById('toast'); }
  function panelEl() { return document.getElementById('notifyPanel'); }

  function renderBadge() {
    const badge = document.getElementById('bellBadge');
    if (!badge) return;
    badge.hidden = unread === 0;
    badge.textContent = unread > 99 ? '99+' : String(unread);
  }

  function fmt(t) {
    const d = new Date(t);
    return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0') + ':' + String(d.getSeconds()).padStart(2, '0');
  }

  function renderPanel() {
    const listEl = document.getElementById('npList');
    if (!listEl) return;
    listEl.innerHTML = '';
    if (!list.length) {
      const empty = document.createElement('div');
      empty.className = 'np-empty';
      empty.textContent = '暂无通知';
      listEl.appendChild(empty);
      return;
    }
    list.slice().reverse().forEach(item => {
      const div = document.createElement('div');
      div.className = 'np-item';
      const msg = document.createElement('div');
      msg.className = 'np-msg';
      msg.textContent = item.msg;
      const time = document.createElement('div');
      time.className = 'np-time';
      time.textContent = fmt(item.time);
      div.appendChild(msg); div.appendChild(time);
      listEl.appendChild(div);
    });
  }

  function toast(msg, opts) {
    const el = toastEl();
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
    list.push({ msg, time: Date.now() });
    if (list.length > 60) list.shift();
    if (!(opts && opts.silent)) N.sounds.notify();
    if (!panelEl().hidden) { unread = 0; renderPanel(); }
    else unread += 1;
    renderBadge();
  }

  function togglePanel(force) {
    const panel = panelEl();
    const show = force !== undefined ? force : panel.hidden;
    panel.hidden = !show;
    if (show) { unread = 0; renderPanel(); renderBadge(); }
  }

  function clearAll() {
    list.length = 0;
    unread = 0;
    renderPanel();
    renderBadge();
  }

  return { toast, togglePanel, clearAll, renderPanel };
})();

// ---------- 菜单（下拉 / 右键共用） ----------
N.menu = (function () {
  const root = () => document.getElementById('menuRoot');

  function close() {
    const el = root();
    el.hidden = true;
    el.innerHTML = '';
    document.querySelectorAll('#topbar .menu-item.active').forEach(m => m.classList.remove('active'));
  }

  // items: [{label, action, checked, disabled} | {sep:true}]；anchorEl 用于顶栏菜单定位
  function open(items, x, y, anchorEl) {
    const el = root();
    el.innerHTML = '';
    items.forEach(it => {
      if (it.sep) {
        const sep = document.createElement('div');
        sep.className = 'menu-sep';
        el.appendChild(sep);
        return;
      }
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'menu-act' + (it.disabled ? ' disabled' : '');
      const label = document.createElement('span');
      label.className = 'mi-label';
      label.textContent = it.label;
      const check = document.createElement('span');
      check.className = 'mi-check';
      check.textContent = it.checked ? '✓' : '';
      btn.appendChild(label);
      btn.appendChild(check);
      btn.addEventListener('click', () => { close(); if (it.action) it.action(); });
      el.appendChild(btn);
    });
    el.hidden = false;
    // 定位并夹紧到视口内
    const w = el.offsetWidth, h = el.offsetHeight;
    el.style.left = Math.max(6, Math.min(x, window.innerWidth - w - 6)) + 'px';
    el.style.top = Math.max(6, Math.min(y, window.innerHeight - h - 6)) + 'px';
    if (anchorEl) anchorEl.classList.add('active');
  }

  return { open, close };
})();

// ---------- 对话框（真实 confirm / prompt） ----------
N.modal = (function () {
  function root() { return document.getElementById('modalRoot'); }
  function card() { return document.getElementById('modalCard'); }

  function show(builder) {
    return new Promise(resolve => {
      const r = root(), c = card();
      c.innerHTML = '';
      r.hidden = false;
      builder(c, value => { r.hidden = true; c.innerHTML = ''; resolve(value); });
    });
  }

  function confirm(opts) {
    const o = opts || {};
    return show((c, done) => {
      const h = document.createElement('h3');
      h.textContent = o.title || '确认';
      const msg = document.createElement('div');
      msg.className = 'm-msg';
      msg.textContent = o.message || '';
      const actions = document.createElement('div');
      actions.className = 'm-actions';
      const cancel = document.createElement('button');
      cancel.className = 'btn ghost';
      cancel.textContent = o.cancelText || '取消';
      const ok = document.createElement('button');
      ok.className = 'btn' + (o.danger ? ' danger' : '');
      ok.textContent = o.okText || '确定';
      cancel.addEventListener('click', () => done(false));
      ok.addEventListener('click', () => done(true));
      actions.appendChild(cancel); actions.appendChild(ok);
      c.appendChild(h); c.appendChild(msg); c.appendChild(actions);
      ok.focus();
      c._key = (e) => {
        if (e.key === 'Escape') done(false);
        if (e.key === 'Enter') done(true);
      };
      document.addEventListener('keydown', c._key, { once: true });
    });
  }

  function prompt(opts) {
    const o = opts || {};
    return show((c, done) => {
      const h = document.createElement('h3');
      h.textContent = o.title || '输入';
      const msg = document.createElement('div');
      if (o.message) { msg.className = 'm-msg'; msg.textContent = o.message; c.appendChild(h); c.appendChild(msg); }
      else c.appendChild(h);
      const input = document.createElement('input');
      input.value = o.value || '';
      input.placeholder = o.placeholder || '';
      input.spellcheck = false;
      const actions = document.createElement('div');
      actions.className = 'm-actions';
      const cancel = document.createElement('button');
      cancel.className = 'btn ghost';
      cancel.textContent = '取消';
      const ok = document.createElement('button');
      ok.className = 'btn';
      ok.textContent = o.okText || '确定';
      cancel.addEventListener('click', () => done(null));
      ok.addEventListener('click', () => done(input.value));
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') done(input.value);
        if (e.key === 'Escape') done(null);
      });
      actions.appendChild(cancel); actions.appendChild(ok);
      c.appendChild(input); c.appendChild(actions);
      setTimeout(() => { input.focus(); input.select(); }, 30);
    });
  }

  return { confirm, prompt };
})();

// ---------- 壁纸 ----------
N.wallpaper = (function () {
  const GRADS = ['wp-0', 'wp-1', 'wp-2', 'wp-3', 'wp-4'];
  let gradIndex = 0;
  let fileUrl = null;

  function el() { return document.getElementById('wallpaper'); }

  function applyGradient(i) {
    gradIndex = ((i % GRADS.length) + GRADS.length) % GRADS.length;
    const w = el();
    GRADS.forEach(g => w.classList.remove(g));
    if (fileUrl) { URL.revokeObjectURL(fileUrl); fileUrl = null; }
    w.style.backgroundImage = '';
    w.classList.add(GRADS[gradIndex]);
    N.state.set('wall', { type: 'gradient', index: gradIndex });
    document.querySelectorAll('.wp-chip').forEach((c, idx) => c.classList.toggle('active', idx === gradIndex));
  }

  async function applyFile(path) {
    const blob = await N.vfs.readBlob(path);
    if (!/^image\//.test(blob.type || '') && !/\.(png|jpe?g|webp|gif)$/i.test(path)) {
      throw new Error('不是可用的图片文件');
    }
    const url = URL.createObjectURL(blob);
    const w = el();
    GRADS.forEach(g => w.classList.remove(g));
    if (fileUrl) URL.revokeObjectURL(fileUrl);
    fileUrl = url;
    w.style.backgroundImage = 'url("' + url + '")';
    N.state.set('wall', { type: 'file', path });
    document.querySelectorAll('.wp-chip').forEach(c => c.classList.remove('active'));
  }

  async function next() {
    if (N.state.get('wall', { type: 'gradient', index: 0 }).type === 'file') return applyGradient(0);
    applyGradient(gradIndex + 1);
  }

  async function restore() {
    const w = N.state.get('wall', null);
    if (w && w.type === 'file' && w.path) {
      try { await applyFile(w.path); return; } catch (e) { /* 文件可能已被删除，回退渐变 */ }
    }
    applyGradient(w && w.type === 'gradient' ? w.index : 0);
  }

  return { applyGradient, applyFile, next, restore, GRADS };
})();

// ---------- 系统启动（顶栏真实数据 + 菜单绑定） ----------
N.core = {
  start() {
    startClock();
    initBattery();
    initNetwork();
    bindBell();
    bindMenus();
    bindGlobalDismiss();
    N.theme.watch();
  }
};

// 顶栏时钟（真实系统时间）
function startClock() {
  const tEl = document.getElementById('tbTime');
  const dEl = document.getElementById('tbDate');
  const WEEK = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  function tick() {
    const d = new Date();
    const t = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
    if (tEl.textContent !== t) tEl.textContent = t;
    const ds = (d.getMonth() + 1) + '月' + d.getDate() + '日 ' + WEEK[d.getDay()];
    if (dEl.textContent !== ds) dEl.textContent = ds;
  }
  tick();
  setInterval(tick, 1000);
}

// 真实电池（Battery Status API）；不支持则整个组件移除，绝不显示假电量
async function initBattery() {
  const el = document.getElementById('tbBattery');
  if (!navigator.getBattery) { el.remove(); return; }
  try {
    const b = await navigator.getBattery();
    el.hidden = false;
    function render() {
      const pct = Math.round(b.level * 100);
      const charging = !!b.charging;
      el.className = 'tb-batt';
      el.title = charging ? ('充电中 · 电量 ' + pct + '%') : ('电量 ' + pct + '%');
      el.innerHTML =
        '<span class="shell"><span class="fill' + (charging ? ' chg' : '') + '" style="width:' + pct + '%"></span></span>' +
        '<span>' + (charging ? '<span class="bolt">⚡</span>' : '') + pct + '%</span>';
    }
    b.addEventListener('levelchange', render);
    b.addEventListener('chargingchange', render);
    render();
  } catch (e) {
    el.remove();
  }
}

// 真实网络状态（navigator.onLine + online/offline 事件）
function initNetwork() {
  const el = document.getElementById('tbNet');
  const SVG_ON = '<svg viewBox="0 0 24 24" fill="none"><path d="M2.5 9.2a14.5 14.5 0 0 1 19 0" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/><path d="M5.8 12.8a9.7 9.7 0 0 1 12.4 0" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" opacity=".8"/><path d="M9.1 16.3a5 5 0 0 1 5.8 0" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" opacity=".6"/><circle cx="12" cy="19.4" r="1.5" fill="currentColor"/></svg>';
  const SVG_OFF = '<svg viewBox="0 0 24 24" fill="none"><path d="M2.5 9.2a14.5 14.5 0 0 1 19 0" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" opacity=".45"/><path d="M5.8 12.8a9.7 9.7 0 0 1 8.2-2.3" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" opacity=".45"/><path d="M4 4l16 16" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/><circle cx="12" cy="19.4" r="1.5" fill="currentColor" opacity=".45"/></svg>';
  function render() {
    const online = navigator.onLine;
    el.innerHTML = online ? SVG_ON : SVG_OFF;
    el.classList.toggle('offline', !online);
    el.title = online ? '网络正常' : '离线';
  }
  window.addEventListener('online', () => { render(); N.notify.toast('网络已连接'); });
  window.addEventListener('offline', () => { render(); N.notify.toast('网络已断开'); });
  render();
}

// 通知中心
function bindBell() {
  const bell = document.getElementById('tbBell');
  bell.addEventListener('click', (e) => {
    e.stopPropagation();
    N.notify.togglePanel();
  });
  document.getElementById('npClear').addEventListener('click', () => N.notify.clearAll());
}

// 顶栏真实下拉菜单
function bindMenus() {
  const MENU_BUILDERS = {
    system() {
      const dark = document.documentElement.dataset.theme === 'dark';
      return [
        { label: '关于本机', action: () => N.wm.openApp('about') },
        { sep: true },
        { label: '深色模式', checked: dark, action: () => toggleDark() },
        { label: '毛玻璃效果', checked: N.state.get('glass', true), action: () => toggleGlass() },
        { label: '锁定屏幕', action: () => N.shell.lock() },
        { sep: true },
        { label: '重新启动', action: () => N.shell.restart() },
        { label: '关机', action: () => N.shell.shutdown() },
        { sep: true },
        { label: '恢复出厂…', action: () => N.shell.factoryReset() }
      ];
    },
    file() {
      return [
        { label: '新建文本文件', action: () => newTextFile() },
        { label: '新建文件夹', action: () => newFolder() },
        { sep: true },
        { label: '打开文件管理器', action: () => N.wm.openApp('files') }
      ];
    },
    display() {
      const dark = document.documentElement.dataset.theme === 'dark';
      return [
        { label: '下一张壁纸', action: () => N.wallpaper.next() },
        { label: '打开图库', action: () => N.wm.openApp('gallery') },
        { sep: true },
        { label: '深色模式', checked: dark, action: () => toggleDark() },
        { label: '毛玻璃效果', checked: N.state.get('glass', true), action: () => toggleGlass() }
      ];
    },
    go() {
      const items = N.apps.order
        .filter(id => id !== 'about' && id !== 'help')
        .map(id => ({ label: N.apps.get(id).name, action: () => N.wm.openApp(id) }));
      items.push({ sep: true });
      items.push({ label: '关于本机', action: () => N.wm.openApp('about') });
      return items;
    },
    help() {
      return [
        { label: '使用帮助', action: () => N.wm.openApp('help') },
        { label: '关于本机', action: () => N.wm.openApp('about') }
      ];
    }
  };

  document.querySelectorAll('#topbar [data-menu]').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      const builder = MENU_BUILDERS[el.dataset.menu];
      if (!builder) return;
      const wasActive = el.classList.contains('active');
      N.menu.close();
      if (wasActive) return;
      const rect = el.getBoundingClientRect();
      N.menu.open(builder(), rect.left, rect.bottom + 6, el);
    });
  });
}

async function toggleDark() {
  const dark = document.documentElement.dataset.theme === 'dark';
  const next = dark ? 'light' : 'dark';
  N.state.set('theme', next);
  N.theme.apply(next);
}

async function toggleGlass() {
  const on = !N.state.get('glass', true);
  N.state.set('glass', on);
  N.glass.apply(on);
}

async function newTextFile() {
  const name = await N.modal.prompt({ title: '新建文本文件', message: '将创建在 /文稿 目录下', value: '未命名.txt', placeholder: '文件名.txt' });
  if (name === null) return;
  try {
    const p = await N.vfs.write('/文稿/' + name, '');
    N.notify.toast('已创建：' + p);
    N.wm.openApp('files', { path: '/文稿' });
  } catch (err) {
    N.notify.toast('创建失败：' + err.message);
  }
}

async function newFolder() {
  const name = await N.modal.prompt({ title: '新建文件夹', message: '将创建在 /文稿 目录下', value: '新建文件夹', placeholder: '文件夹名' });
  if (name === null) return;
  try {
    const p = await N.vfs.mkdir('/文稿/' + name);
    N.notify.toast('已创建文件夹：' + p);
    N.wm.openApp('files', { path: '/文稿' });
  } catch (err) {
    N.notify.toast('创建失败：' + err.message);
  }
}

// 点击空白处 / Esc 关闭菜单与通知面板
function bindGlobalDismiss() {
  document.addEventListener('click', (e) => {
    const menuEl = document.getElementById('menuRoot');
    const panel = document.getElementById('notifyPanel');
    if (!menuEl.hidden && !menuEl.contains(e.target)) N.menu.close();
    if (!panel.hidden && !panel.contains(e.target) && !e.target.closest('#tbBell')) N.notify.togglePanel(false);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      N.menu.close();
      N.notify.togglePanel(false);
    }
  });
}
