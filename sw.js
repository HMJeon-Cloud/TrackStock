/* StockMind 서비스 워커 — '앱으로 설치'를 가능하게 하고, 오프라인일 때 마지막 화면을 보여준다.
   화면·스크립트는 항상 네트워크를 먼저 보고(새 버전이 바로 반영되게), 실패했을 때만 저장본을 쓴다.
   API 응답은 저장하지 않는다 (시세는 항상 최신이어야 하므로). */
var CACHE = "sm-shell-v1";
self.addEventListener("install", function (e) { self.skipWaiting(); });
self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET") return;
  var url = new URL(req.url);
  if (url.origin !== location.origin) return;              // CDN 라이브러리 등은 브라우저 기본 캐시에 맡긴다
  if (url.pathname.startsWith("/api/")) return;            // 시세·뉴스는 저장하지 않는다
  e.respondWith(
    fetch(req).then(function (res) {
      if (res && res.ok) { var copy = res.clone(); caches.open(CACHE).then(function (c) { c.put(req, copy); }); }
      return res;
    }).catch(function () {
      return caches.match(req).then(function (hit) {
        if (hit) return hit;
        if (req.mode === "navigate") return caches.match("/");
        return new Response("", { status: 503 });
      });
    })
  );
});
