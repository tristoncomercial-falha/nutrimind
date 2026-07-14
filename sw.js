// ═══════════════════════════════════════════════════════════════
//  NutriMind IA — Service Worker
//  Estratégia: network-first para o HTML (sempre pega a versão mais
//  nova quando online), cache-first para ícones/estáticos.
//  Fornece fallback offline — requisito do Google Play (política 4.3).
// ═══════════════════════════════════════════════════════════════

const CACHE = 'nutrimind-v2';
const ASSETS = [
  './',
  './index.html',
  './icon-192.png',
  './icon-512.png',
  './manifest.webmanifest'
];

// Instala e pré-cacheia o essencial
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

// Ativa e limpa caches antigos
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch handler (obrigatório para o app ser aceito como instalável)
self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Só lida com GET; deixa POST (IA, pagamento) passar direto pra rede
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Nunca cacheia chamadas a APIs externas (workers, supabase, anthropic)
  if (url.origin !== self.location.origin) return;

  // HTML / navegação: network-first com fallback pro cache (offline)
  if (req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html')) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(req).then((r) => r || caches.match('./index.html')))
    );
    return;
  }

  // Estáticos (ícones, manifest): cache-first
  event.respondWith(
    caches.match(req).then((cached) =>
      cached ||
      fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        return res;
      }).catch(() => cached)
    )
  );
});
