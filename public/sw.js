const CACHE_NAME = 'leshiy-ai-cache-v1.1.4';

const urlsToCache = [
  '/',
  '/index.html',
  '/offline.html',
  '/manifest.json',
  '/Gemini.png',
  '/vk_logo.svg',
  '/tg_logo.svg'
];

self.addEventListener('install', (event) => {
    self.skipWaiting(); 

    event.waitUntil(
      caches.open(CACHE_NAME).then((cache) => {
        return Promise.all(
          urlsToCache.map((url) => {
            return cache.add(url).catch((err) => console.warn(`Не удалось закешировать ${url}:`, err));
          })
        );
      })
    );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then(networkResponse => {
        const isFromOurOrigin = event.request.url.startsWith(self.location.origin);
        if (isFromOurOrigin && networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        // ИЗМЕНЕНО: Полностью переписанная логика для оффлайн-режима
        
        // 1. ПЕРВЫМ ДЕЛОМ проверяем, это навигационный запрос?
        if (event.request.mode === 'navigate') {
          // 2. Если да, НЕМЕДЛЕННО отдаем оффлайн-страницу.
          return caches.match('/offline.html');
        }

        // 3. Если это был другой запрос (картинка, стиль), ищем его в кэше.
        return caches.match(event.request)
          .then(cachedResponse => {
            // 4. Отдаем из кэша, если нашлось, или возвращаем ошибку.
            return cachedResponse || new Response('', { status: 404, statusText: 'Not Found' });
          });
      })
  );
});

self.addEventListener('activate', (event) => {
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
