// オフライン対応 Service Worker
const CACHE = "chousashi-dojo-v53";
const ASSETS = [
  "./",
  "./index.html",
  "./css/style.css",
  "./manifest.json",
  "./js/app.js",
  "./js/store.js",
  "./js/calc.js",
  "./js/data/schedule.js",
  "./js/data/lectures.js",
  "./js/data/questions.js",
  "./js/data/flash.js",
  "./js/data/written.js",
  "./js/data/calc-guide.js",
  "./js/data/importance.js",
  "./js/data/articles.js",
  "./js/data/patterns.js",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)),
        ),
      ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return; // GET以外はキャッシュ対象外
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        // 200の完全応答のみキャッシュ。206(音声シーク等の部分応答)は put が例外になるため除外。
        if (res && res.status === 200 && res.type === "basic") {
          const copy = res.clone();
          caches
            .open(CACHE)
            .then((c) => c.put(e.request, copy).catch(() => {}));
        }
        return res;
      })
      .catch(() => caches.match(e.request)),
  );
});
