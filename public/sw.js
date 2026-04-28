const CACHE_NAME = 'leshiy-ai-v1.1.3';

const urlsToCache = [
  '/',
  '/index.html',
  '/offline.html',
  '/manifest.json',
  '/Gemini.png',
  '/tg_logo.svg',
  '/src/index.css',
  '/src/App.css'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache:', CACHE_NAME);
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('fetch', (event) => {
    event.respondWith(
      caches.match(event.request).then((response) => {
        // 1. Если есть в кэше — сразу отдаем
        if (response) {
          return response;
        }
  
        // 2. Иначе идем в сеть
        return fetch(event.request).then((response) => {
          // Проверка: успешный ли ответ
          if (!response || response.status !== 200 || (response.type !== 'basic' && response.type !== 'cors')) {
            return response;
          }
  
          // Кэшируем успешный ответ
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
  
          return response;
        }).catch(() => {
          // 3. ЕСЛИ СЕТЬ УПАЛА (ошибка catch)
          // Проверяем: если это навигация (пользователь переходит по страницам),
          // отдаем заглушку офлайна
          if (event.request.mode === 'navigate') {
            return caches.match('/offline.html');
          }
          
          // Для картинок/скриптов можно ничего не делать или отдать заглушку
        });
      })
    );
});

self.addEventListener('activate', (event) => {
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