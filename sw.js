/* 旅途 Fluid Travel · 轻量离线壳（缓存静态资源，不缓存地图瓦片） */
/* 改 UI/逻辑后务必 bump CACHE，否则会一直吃到旧的单目的地页面 */
const CACHE = "fluid-travel-v20-ai-route-ui";
const ASSETS = [
  "./",
  "./index.html",
  "./css/styles.css",
  "./js/city-catalog.js",
  "./js/app.js",
  "./js/generator.js",
  "./js/map.js",
  "./js/geo-utils.js",
  "./js/lottie-fx.js",
  "./js/export.js",
  "./js/pack-smart.js",
  "./js/astro.js",
  "./js/gear.js",
  "./js/photo-extra.js",
  "./README.md",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  // 不拦截跨域 API / 瓦片（天气、地理编码、地图）
  if (url.origin !== self.location.origin) return;

  // HTML / JS / CSS：网络优先，避免开发/更新后仍卡在旧壳（如单目的地）
  const isAppShell =
    req.mode === "navigate" ||
    url.pathname.endsWith(".html") ||
    url.pathname.endsWith(".js") ||
    url.pathname.endsWith(".css") ||
    url.pathname.endsWith("/") ||
    url.pathname.endsWith("/index.html");

  if (isAppShell) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const clone = res.clone();
            caches.open(CACHE).then((c) => c.put(req, clone));
          }
          return res;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const clone = res.clone();
            caches.open(CACHE).then((c) => c.put(req, clone));
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
