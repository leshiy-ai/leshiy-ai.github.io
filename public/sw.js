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
  if (event.request.method !== 'GET') {
    return; // Обрабатываем только GET-запросы
  }

  // Стратегия: Сначала сеть, потом кэш (Network falling back to cache)
  event.respondWith(
    fetch(event.request)
      .then(networkResponse => {
        // Если из сети пришел корректный ответ, кэшируем его и возвращаем
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        // Если сеть недоступна, обращаемся к кэшу
        return caches.match(event.request)
          .then(cachedResponse => {
            // Если ресурс есть в кэше, отдаем его
            if (cachedResponse) {
              return cachedResponse;
            }

            // Если это навигационный запрос (запрос страницы) и его нет в кэше, отдаем index.html.
            // Это позволяет SPA (одностраничному приложению) обработать URL, сохраняя параметры.
            if (event.request.mode === 'navigate') {
              return caches.match('/index.html')
                .then(indexResponse => {
                  // Если есть index.html - хорошо, если нет - показываем оффлайн-страницу
                  return indexResponse || caches.match('/offline.html');
                });
            }
            
            // Для других ресурсов (картинки, скрипты), которых нет в кэше, позволяем браузеру обработать ошибку.
            // Возвращаем undefined, чтобы браузер показал стандартную ошибку (например, сломанную картинку).
            return undefined;
          });
      })
  );
});

self.addEventListener('activate', (event) => {
  // Гарантируем, что новый Service Worker сразу перехватывает управление
  event.waitUntil(clients.claim());

  // Удаляем старые кэши, которые не входят в "белый список"
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
