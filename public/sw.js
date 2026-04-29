const CACHE_NAME = 'leshiy-ai-v1.1.4';

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
  // Мы обрабатываем только GET-запросы
  if (event.request.method !== 'GET') {
    return;
  }

  // Для всех GET-запросов: сначала сеть, потом кэш
  event.respondWith(
    // 1. Пытаемся получить из сети
    fetch(event.request)
      .then(networkResponse => {
        // Если запрос успешен, кэшируем и возвращаем его
        if (networkResponse && networkResponse.status === 200 && networkResponse.type !== 'opaque') {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME)
            .then(cache => {
              cache.put(event.request, responseToCache);
            });
        }
        return networkResponse;
      })
      .catch(() => {
        // 2. Если сеть недоступна, ищем в кэше
        return caches.match(event.request)
          .then(cachedResponse => {
            // Если нашли в кэше - отдаем
            if (cachedResponse) {
              return cachedResponse;
            }

            // 3. Если это навигация на страницу, которой нет в кэше, показываем оффлайн-страницу
            if (event.request.mode === 'navigate') {
              return caches.match('/offline.html');
            }
            
            // Для других ассетов, которых нет в кэше, браузер обработает ошибку
            return new Response('Not Found', { status: 404 });
          });
      })
  );
});


self.addEventListener('activate', (event) => {
  // Эта строка гарантирует, что новый SW сразу перехватывает управление
  event.waitUntil(clients.claim());

  // Удаляем старые кэши, которые не соответствуют текущей версии
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
