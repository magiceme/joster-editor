const cacheName = 'joster-editor-v2-preview-5';
const shell = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './editor.js', './noise-gate.js'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(cacheName).then(cache => cache.addAll(shell)));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(
    keys.filter(key => key.startsWith('joster-editor-') && key !== cacheName).map(key => caches.delete(key))
  )).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).catch(() => caches.match('./index.html')));
  } else if (shell.some(path => new URL(path, self.registration.scope).href === url.href)) {
    event.respondWith(caches.match(event.request).then(response => response || fetch(event.request)));
  }
});
