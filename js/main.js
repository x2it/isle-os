// ============================================================
// 屿 IsleOS v4.1 — 启动引导
// 初始化设置 → 文件系统 → 核心与窗口 → 首启向导或直接进入
// ============================================================
window.N = window.N || {};

N.boot = {
  play(el, ms) {
    return new Promise(resolve => {
      el.classList.remove('hide');
      setTimeout(() => {
        el.classList.add('hide');
        setTimeout(() => { el.remove(); resolve(); }, 620);
      }, ms);
    });
  }
};

(async function main() {
  'use strict';
  const settings = N.state.all();

  // 主题与毛玻璃在开机前就应用，避免闪变
  N.theme.apply(settings.theme || 'light');
  N.glass.apply(settings.glass !== false);

  // Shell 初始化（电源按钮 / 锁屏点按）
  N.shell.init();

  // 开机画面版本号（单一来源 N.VERSION）
  const bootVer = document.getElementById('bootVer');
  if (bootVer) bootVer.textContent = 'ISLEOS · v' + N.VERSION;

  // 开机画面（设置里可关闭）
  const bootEl = document.getElementById('boot');
  const bootP = (settings.boot !== false)
    ? N.boot.play(bootEl, 1900)
    : (bootEl && bootEl.remove(), Promise.resolve());

  // 开机文案轮换
  const bootMsg = document.getElementById('bootMsg');
  const MSGS = ['正在涨潮…', '点亮灯塔…', '整理贝壳…'];
  let msgIdx = 0;
  const msgTimer = (settings.boot !== false && bootMsg)
    ? setInterval(() => {
        msgIdx = (msgIdx + 1) % MSGS.length;
        bootMsg.textContent = MSGS[msgIdx];
      }, 620)
    : null;

  // 文件系统初始化（与开机画面并行）
  try {
    await N.vfs.ready;
  } catch (err) {
    // OPFS 不可用时已自动降级为内存模式，系统照常可用
  }

  await bootP;
  if (msgTimer) clearInterval(msgTimer);

  try {
    N.core.start();
    N.wm.start();
    await N.wallpaper.restore();

    // 首次使用 → 上岛向导；之后安静进入桌面
    if (!N.shell.isSetupDone()) {
      N.shell.showWelcome();
    } else {
      N.sounds.startup();
    }

    // PWA Service Worker
    const localHost = ['localhost', '127.0.0.1'].includes(location.hostname);
    if ('serviceWorker' in navigator && (location.protocol === 'https:' || localHost)) {
      try { navigator.serviceWorker.register('sw.js'); } catch (e) { /* 注册失败不影响使用 */ }
    }
  } catch (err) {
    const msg = document.getElementById('bootMsg');
    if (msg) msg.textContent = '启动出错：' + (err && err.message || err);
    const b = document.getElementById('boot');
    if (b) b.classList.add('hide');
  }
})();
