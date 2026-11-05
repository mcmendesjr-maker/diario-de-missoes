// Service worker: deixa o app abrir sem internet.
// Ao publicar uma versão nova, aumente o número abaixo e também o ?v= no index.html e no app.js.
const VERSION = "v5";
const CACHE = "missoes-" + VERSION;
const SHELL = [
  "./", "index.html", "style.css", "app.js", "firebase.js", "manifest.json", "achievements.js",
  "icons/icon-192.png", "icons/icon-512.png"
];
// Arquivos de fora que podem ser guardados (biblioteca do Firebase e fontes).
const STATIC_HOSTS = ["www.gstatic.com", "fonts.googleapis.com", "fonts.gstatic.com"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("missoes-") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Arquivos do próprio app: tenta a internet primeiro (pega atualizações), cai no cache se estiver offline.
  if (url.origin === self.location.origin) {
    e.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
          return res;
        })
        .catch(() => caches.match(req).then((hit) => hit || (req.mode === "navigate" ? caches.match("index.html") : undefined)))
    );
    return;
  }

  // Biblioteca do Firebase e fontes: usa o cache se já tiver.
  if (STATIC_HOSTS.includes(url.hostname)) {
    e.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy));
        return res;
      }))
    );
  }
  // Login e banco de dados passam direto, sem cache.
});
