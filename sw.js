// ============================================================
// 屿 IsleOS — Service Worker
// 静态资源预缓存 + stale-while-revalidate；版本升级时清旧缓存。
// ============================================================
const CACHE = 'isle-v4.4';
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/style.css?v=4.1',
  './js/vfs.js?v=4.1',
  './js/core.js?v=4.1',
  './js/wm.js?v=4.1',
  './js/shell.js?v=4.1',
  './js/apps-a.js?v=4.1',
  './js/apps-b.js?v=4.1',
  './js/apps-c.js?v=4.1',
  './js/main.js?v=4.1',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-192.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon-256.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => Promise.allSettled(ASSETS.map(a => c.add(a))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  // HTML 走网络优先，离线回退缓存
  if (req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html')) {
    e.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put('./', copy));
          return res;
        })
        .catch(() => caches.match('./').then(r => r || Response.error()))
    );
    return;
  }

  // 静态资源：缓存优先，后台更新
  e.respondWith(
    caches.match(req).then(cached => {
      const network = fetch(req)
        .then(res => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(CACHE).then(c => c.put(req, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
