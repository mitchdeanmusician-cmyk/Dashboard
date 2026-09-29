// Mitch's Dashboard service worker
// 1. Receives photos and text shared from other apps (Share > Dashboard).
// 2. Keeps a copy of the page so the app still opens without internet.
const SHELL = 'mitch-shell-v1';
const SHARE = 'mitch-share';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method === 'POST' && url.pathname.endsWith('/share-target')) {
    e.respondWith(receiveShare(e.request));
    return;
  }
  // Pages: always try the network first so updates show straight away; fall back to the saved copy offline.
  if (e.request.mode === 'navigate' && url.origin === self.location.origin) {
    e.respondWith(
      fetch(e.request)
        .then(res => { const copy = res.clone(); caches.open(SHELL).then(c => c.put(self.registration.scope, copy)); return res; })
        .catch(() => caches.match(self.registration.scope).then(r => r || Response.error()))
    );
  }
});

async function receiveShare(request) {
  const form = await request.formData();
  const cache = await caches.open(SHARE);
  const files = form.getAll('files').filter(f => f && f.size);
  const meta = {
    title: String(form.get('title') || ''), text: String(form.get('text') || ''), url: String(form.get('url') || ''),
    files: files.map((f, i) => ({ key: 'file-' + i, name: f.name || 'shared', type: f.type || '' }))
  };
  await Promise.all(files.map((f, i) => cache.put(new Request(self.registration.scope + 'share/file-' + i), new Response(f, { headers: { 'Content-Type': f.type || 'application/octet-stream' } }))));
  await cache.put(new Request(self.registration.scope + 'share/meta'), new Response(JSON.stringify(meta), { headers: { 'Content-Type': 'application/json' } }));
  return Response.redirect(self.registration.scope + '?shared=1', 303);
}
