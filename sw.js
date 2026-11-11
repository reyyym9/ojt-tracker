const VERSION = 'v6';                // change this on every release
const PAGES = ['./', 'index.html', 'log.html', 'history.html', 'edit-day.html', 'reports.html', 'report.html', 'settings.html'];
const CSS = ['tokens', 'themes', 'base', 'components', 'screens'].map(name => `css/${name}.css`);
const JS = ['util', 'calc', 'store', 'images', 'photos', 'report-writer', 'autosize', 'theme-init', 'theme', 'config', 'auth', 'sync', 'photo-map', 'reminders', 'vendor/supabase', 'vendor/docx',
  'pages/dashboard', 'pages/log', 'pages/history', 'pages/edit-day', 'pages/reports', 'pages/report', 'pages/settings'].map(name => `js/${name}.js`);
const FILES = [...PAGES, ...CSS, ...JS];

self.addEventListener('install', event => event.waitUntil(
  caches.open(VERSION).then(cache => cache.addAll(FILES.map(file => new Request(file, { cache: 'reload' })))).then(() => self.skipWaiting())
));
self.addEventListener('activate', event => event.waitUntil(
  caches.keys().then(keys => Promise.all(keys.filter(key => key !== VERSION).map(key => caches.delete(key)))).then(() => self.clients.claim())
));
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== location.origin) return;
  event.respondWith(caches.match(event.request, { ignoreSearch: true }).then(hit => hit || fetch(event.request)));
});