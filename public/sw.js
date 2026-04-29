const CACHE_NAME = 'leshiy-ai-v1.1.4';

const urlsToCache = [
  '/',
  '/index.html',
  '/offline.html',
  '/manifest.json',
  '/Gemini.png',
  '/tg_logo.svg'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
      caches.open(CACHE_NAME).then((cache) => {
        // Кэшируем по одному, чтобы если один упал, остальные загрузились
        return Promise.all(
          urlsToCache.map((url) => {
            return cache.add(url).catch((err) => console.warn(`Не удалось закешировать ${url}:`, err));
          })
        );
      })
    );
});

self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);
  
    // ИГНОРИРУЕМ ВСЁ КРОМЕ GET (POST/PUT/DELETE не кэшируем)
    if (event.request.method !== 'GET') return;

    // ИГНОРИРУЕМ API и ВНЕШНИЕ СКРИПТЫ
    // Если запрос идет к API или сторонним сервисам (VK, TG, Yandex) — не трогаем их
    if (url.origin !== self.location.origin || url.href.includes('apigw.yandexcloud.net')) {
      return; // SW просто пропускает эти запросы, они идут напрямую в сеть
    }
  
    // Для навигации (index.html) — Network First
    if (event.request.mode === 'navigate') {
      event.respondWith(
        fetch(event.request).catch(() => caches.match('/offline.html'))
      );
      return;
    }
  
    // Для статики (картинки, css, js) — Cache First
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        // Если нашли в кэше — отдаем
        if (cachedResponse) {
          return cachedResponse;
        }
  
        // Если нет — идем в сеть
        return fetch(event.request)
          .then((networkResponse) => {
            // Кэшируем только если ответ валидный (200) и не является непрозрачным (opaque)
            if (networkResponse && networkResponse.status === 200 && networkResponse.type !== 'opaque') {
                const copy = networkResponse.clone();
                caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
            }
            return networkResponse;
          })
          .catch(() => {
            // Если сеть упала и в кэше нет — возвращаем 404
            return new Response('Not Found', { status: 404 });
          });
      })
    );
});

self.addEventListener('activate', (event) => {
  // ЭТА СТРОКА ГАРАНТИРУЕТ, ЧТО SW СТАНОВИТСЯ ГЛАВНЫМ ПРЯМО СЕЙЧАС
  event.waitUntil(clients.claim());

  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

self.addEventListener('push', (event) => {
    try {
      const data = event.data?.json();
      self.registration.showNotification(data.title || 'Leshiy-AI', {
        body: data.body || '',
        icon: '/Gemini.png',
        badge: '/Gemini.png',
        data: { url: data.url || '/' },
        tag: data.tag || 'default'
      });
    } catch (e) {
      console.error('❌ Push error:', e);
    }
});
  
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    clients.openWindow(event.notification.data.url || '/');
});