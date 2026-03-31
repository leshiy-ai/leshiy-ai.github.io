import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import Sidebar from './Sidebar.jsx';
import App from './App.jsx';
import { CONFIG } from './config';
import React from 'react';
let modalRoot = null;

// --- ОБРАБОТЧИКИ РЕДИРЕКТА 

// --- Возврат из ВК --- Выполняется один раз при загрузке страницы
const handleVKRedirect = () => {
  const params = new URLSearchParams(window.location.search);
  const vkUserId = params.get('vk_user_id');
  
  if (vkUserId) {
      localStorage.setItem('vk_user_id', vkUserId);
      localStorage.setItem('auth_provider', 'VK');
      // Чистим URL, чтобы при обновлении страницы не висел ID
      const newUrl = window.location.origin + window.location.pathname;
      window.history.replaceState({}, document.title, newUrl);
      console.log("VK ID сохранен из редиректа:", vkUserId);
  }
};

// --- Возврат из TELEGRAM --- Выполняется один раз при загрузке страницы
const handleTelegramRedirect = () => {
  const params = new URLSearchParams(window.location.search);
  const tgData = params.get('tg_data');

  if (tgData) {
    try {
      const userData = JSON.parse(decodeURIComponent(tgData));
      
      // 1. Склеиваем имя и фамилию (проверяем, есть ли фамилия вообще)
      const fullName = userData.last_name 
        ? `${userData.first_name} ${userData.last_name}` 
        : userData.first_name;

      localStorage.setItem('vk_user_id', `${userData.id}`);
      localStorage.setItem('vk_user_name', fullName); // Теперь с фамилией

      // Сохраняем данные из URL
      localStorage.setItem('vk_user_photo', userData.photo_url || '/tg_logo.svg');
      localStorage.setItem('isAdmin', userData.isAdmin || 'false');

      // Очищаем URL, чтобы убрать данные и избежать повторной обработки
      window.history.replaceState({}, document.title, window.location.pathname);

      // БРОСАЕМ СОБЫТИЕ УСПЕХА
      const userId = String(userData.id); // Сначала объявляем!
      console.log("Система: TG Auth Success для ID:", userId);
      // Когда ТГ вернул с редиректом:
      localStorage.setItem('auth_provider', 'Telegram');
      window.dispatchEvent(new CustomEvent('tg-auth-success', { detail: String(userData.id) }));
      // ВЫЗЫВАЕМ СИНХРОНИЗАЦИЮ СТАТУСА
      window.fetchUserStatus();
      // Обновляем UI, чтобы сразу показать пользователя
      window.dispatchEvent(new CustomEvent('user-profile-updated'));

    } catch (error) {
      console.error("Ошибка при обработке данных Telegram из URL:", error);
    }
  }
};

// --- АВТОМАТИЧЕСКАЯ АУТЕНТИФИКАЦИЯ ДЛЯ TELEGRAM APP ---
// Выполняется при загрузке, если мы внутри ТГ и не авторизованы
const tgAppAutoAuth = async () => {
  const tg = window.Telegram?.WebApp;
  
  // Если нет объекта ТГ, выходим без алертов (чтобы не спамить в обычном браузере)
  if (!tg || !tg.initData) return;
  // Сразу сообщаем ТГ, что мы готовы, и разворачиваем на весь экран
  tg.ready();
  tg.expand();

  // Если ID уже в памяти, авторизация не нужна
  if (localStorage.getItem('vk_user_id')) {
    if (!localStorage.getItem('auth_provider')) {
        localStorage.setItem('auth_provider', 'Telegram');
    }
    return; 
}

  try {
      // Формируем URL. Убедись, что CONFIG.STORAGE_GATEWAY определен!
      const authUrl = `${CONFIG.STORAGE_GATEWAY}/auth/telegram/callback?bot=gemini&${tg.initData}`;

      const response = await fetch(authUrl, {
          method: 'GET',
          headers: { 'Accept': 'application/json' }
      });

      const data = await response.json();

      if (data.user_id || data.id) {
          const id = data.user_id || data.id;
          localStorage.setItem('vk_user_id', id);
          localStorage.setItem('auth_provider', 'Telegram');
          if (window.fetchUserStatus) window.fetchUserStatus();
      }
  } catch (err) {
    console.error("Silent auth failed:", err);
  }
};

// --- АВТОМАТИЧЕСКАЯ АУТЕНТИФИКАЦИЯ ДЛЯ VK MINI APP ---
const vkAppAutoAuth = async () => {
  const bridge = window.vkBridge;
  if (!bridge) return;

  try {
      // Инициализируем VK Bridge
      await bridge.send('VKWebAppInit');

      // Проверяем, есть ли параметры ВК в URL (признак, что мы внутри ВК)
      const urlParams = new URLSearchParams(window.location.search);
      if (!urlParams.has('vk_app_id')) return; // Мы не в ВК

      // Если уже залогинены в приложении — выходим
      if (localStorage.getItem('vk_user_id')) return;

      console.log("VK Mini App: Запуск фоновой авторизации...");

      // Отправляем все параметры запроса на бэкенд для проверки подписи (sign)
      const authUrl = `${CONFIG.STORAGE_GATEWAY}/auth/vk/callback?${window.location.search}`;

      const response = await fetch(authUrl, {
          method: 'GET',
          headers: { 'Accept': 'application/json' }
      });

      if (response.ok) {
        // 1. Проверяем URL, на который нас в итоге привел fetch после всех редиректов
        const finalUrl = new URL(response.url);
        const idFromUrl = finalUrl.searchParams.get('vk_user_id');
  
        if (idFromUrl) {
          localStorage.setItem('vk_user_id', idFromUrl);
          localStorage.setItem('auth_provider', 'VK');
          console.log("VK Auth Success (from URL)! ID:", idFromUrl);
        } else {
          // 2. Если в URL нет ID, пробуем парсить как JSON (на случай, если бэкенд отдал JSON)
          try {
            const data = await response.json();
            const id = data.user_id || data.id || data.vk_user_id;
            if (id) {
              localStorage.setItem('vk_user_id', id);
              console.log("VK Auth Success (from JSON)! ID:", id);
            }
          } catch (e) {
            console.log("Response was not JSON, and no ID in URL");
          }
        }
  
        // Если в итоге ID в памяти появился — чистим интерфейс
        if (localStorage.getItem('vk_user_id')) {
          const authOverlay = document.querySelector('.tg-auth-modal-overlay');
          if (authOverlay) authOverlay.style.display = 'none';
          if (window.fetchUserStatus) window.fetchUserStatus();
        }
      }
    } catch (err) {
      console.error("VK Auth Error:", err);
    }
};

// --- ИНИЦИАЛИЗАЦИЯ REACT ---
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
);

// --- ПРАВИЛЬНАЯ АРХИТЕКТУРА УПРАВЛЕНИЯ СТАТУСОМ ---

window.handleStatusResponse = (data) => {
  if (!data) {
    localStorage.removeItem('vk_user_id');
    localStorage.removeItem('vk_user_name');
    localStorage.removeItem('vk_user_photo');
    localStorage.removeItem('isAdmin');
  } else {
    const userId = data.id || data.vk_user_id;
    if (userId) localStorage.setItem('vk_user_id', userId);

    const userName = data.userName;
    if (userName) localStorage.setItem('vk_user_name', userName);

    const userPhoto = data.userPhoto;
    if (userPhoto) localStorage.setItem('vk_user_photo', userPhoto);

    if (typeof data.isAdmin !== 'undefined') {
      localStorage.setItem('isAdmin', String(data.isAdmin));
    }
  }
  window.dispatchEvent(new CustomEvent('user-profile-updated'));
};

window.fetchUserStatus = async () => {
  const userId = localStorage.getItem('vk_user_id');
  if (!userId || userId === 'null' || userId === 'undefined') {
    window.handleStatusResponse(null);
    return;
  }

  try {
    const fullUrl = `${CONFIG.STORAGE_GATEWAY}/?action=get-status&userId=${userId}`;
    const response = await fetch(fullUrl);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    
    const serverData = await response.json();
    if (serverData) {
      window.handleStatusResponse(serverData);
      // ГЕНЕРИРУЕМ СОБЫТИЕ
      console.log("Main: Статус подтвержден, запрашиваю обновление чатов");
      window.dispatchEvent(new CustomEvent('user-profile-updated', { detail: serverData }));
      // Записываем статус в "глобальное окно"
      window.lastServerResponse = { status: response.status };
    }
  } catch (error) {
    console.error("Ошибка при получении статуса пользователя от Хранилки:", error);
    window.lastServerResponse = { status: 500 };
  }
};

// --- ГЛОБАЛЬНЫЕ СЛУШАТЕЛИ СОБЫТИЙ ---

document.addEventListener('DOMContentLoaded', () => {
  // Сначала проверяем, не вернулся ли пользователь с авторизации
  handleTelegramRedirect();
  
  // Пытаемся автоматически залогинить пользователя, если это Mini App
  // Проверка для Телеграм
  if (window.Telegram?.WebApp?.initData) {
    tgAppAutoAuth();
  } 
  // Проверка для ВК (ищем vk_app_id в URL)
  else if (window.location.search.includes('vk_app_id')) {
      vkAppAutoAuth();
  }

  const currentTheme = localStorage.getItem('theme') || 'dark';
  document.documentElement.setAttribute('data-theme', currentTheme);
  
  // Затем, как обычно, запрашиваем статус (возможно, он только что был установлен)
  window.fetchUserStatus();
});

// Слушатель для OneTap кнопки VK
window.addEventListener('vk-auth-success', (event) => {
  const response = event.detail;
  console.log("Система: Получен ответ от VK:", response);

  // 1. Извлекаем данные (проверяем все возможные места вложенности)
  const userId = (typeof response === 'number' || typeof response === 'string') 
                 ? response 
                 : (response.user_id || 
                    (response.data && response.data.auth_info && response.data.auth_info.user && response.data.auth_info.user.id) || 
                    response.id);

  if (!userId) {
    console.error("VK Auth Success: 'user_id' не найден в ответе OAuth", response);
    return;
  }
  
  console.log("Система: Получен VK User ID:", userId);
  // Когда ВК отдал данные:
  localStorage.setItem('auth_provider', 'VK');
  localStorage.setItem('vk_user_id', String(userId));
  window.fetchUserStatus();
});

// Слушатель для Telegram-авторизации
window.addEventListener('tg-auth-success', (event) => {
  // 1. Закрываем модалку
  const overlay = document.getElementById('tg_auth_overlay');
  if (overlay) overlay.style.display = 'none';
});

// Модальное окно Telegram-авторизации
const TelegramAuthModal = ({ onClose }) => {
  const containerRef = React.useRef(null);

  React.useEffect(() => {
    // 1. Создаем глобальную функцию-коллбэк, которую вызовет виджет
    window.onTelegramAuth = (user) => {
      console.log("Widget success! Перенаправляю на бэкенд для проверки...");
  
      // 1. Собираем параметры из объекта user (id, hash, auth_date и т.д.)
      const queryParams = new URLSearchParams();
      for (const key in user) {
          queryParams.append(key, user[key]);
      }
      
      // 2. Добавляем твои обязательные параметры bot и return_to
      queryParams.append('bot', 'gemini');
      queryParams.append('return_to', 'https://leshiy-ai.github.io');
  
      // 3. Формируем ТВОЮ длинную ссылку
      const authUrl = `${CONFIG.STORAGE_GATEWAY}/auth/telegram/callback?${queryParams.toString()}`;
  
      // 4. Прямой редирект (вместо fetch)
      // Это заставит бэкенд отработать, проверить хеш и вернуть нас назад с tg_data
      window.location.href = authUrl;
  };
  
  // Чистим контейнер перед вставкой
    if (containerRef.current) {
        containerRef.current.innerHTML = '';
        const script = document.createElement('script');
        script.async = true;
        script.src = "https://telegram.org/js/telegram-widget.js?23";
        script.setAttribute('data-telegram-login', 'gemini_aitg_bot');
        script.setAttribute('data-size', 'large');
        script.setAttribute('data-request-access', 'write');
        // ДЛЯ МОБИЛЫ (Callback режим):
        script.setAttribute('data-onauth', 'onTelegramAuth(user)');
        // ДЛЯ ПК (Redirect режим):
        //script.setAttribute('data-auth-url', '${CONFIG.STORAGE_GATEWAY}/auth/telegram/callback?bot=gemini&return_to=https://leshiy-ai.github.io');
        
        containerRef.current.appendChild(script);
    }

    return () => {
        // Чистим за собой
        delete window.onTelegramAuth;
    };
  }, [onClose]);

  return (
    /* Фон с блюром как у ВК */
    <div style={{
      position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', 
      background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)', 
      zIndex: 10001, display: 'flex', justifyContent: 'center', alignItems: 'center'
    }} onClick={onClose}>
      
      {/* Белая карточка */}
      <div style={{
        background: 'white', padding: '24px', borderRadius: '20px', 
        boxTarget: '0 10px 25px rgba(0,0,0,0.2)', width: '90%', maxWidth: '360px', 
        position: 'relative', textAlign: 'center'
      }} onClick={(e) => e.stopPropagation()}>
        
        <div style={{ marginBottom: '20px' }}>
            <div style={{ fontSize: '40px', marginBottom: '10px' }}>🔐</div>
            <h3 style={{ margin: 0, fontFamily: 'sans-serif', color: '#333', fontSize: '20px' }}>Вход в Gemini AI</h3>
            <p style={{ fontSize: '14px', color: '#666', marginTop: '8px' }}>
              Используйте Telegram для синхронизации ваших чатов и настроек
            </p>
        </div>

        {/* Сюда встанет виджет */}
        <div ref={containerRef} style={{ minHeight: '44px', display: 'flex', justifyContent: 'center' }}></div>
        
        <button 
          onClick={onClose} 
          style={{ width: '100%', marginTop: '20px', border: 'none', background: 'none', color: '#0077ff', cursor: 'pointer', fontSize: '14px', fontWeight: '500' }}
        >
          Позже
        </button>
      </div>
    </div>
  );
};

const handleMiniAppAuth = () => {
  const tg = window.Telegram?.WebApp;
  
  // 1. Обязательно сообщаем ТГ, что приложение готово, иначе initDataUnsafe будет пустым
  if (tg) tg.ready();

  if (tg?.initDataUnsafe?.user && !localStorage.getItem('vk_user_id')) {
    console.log("Mini App detected: Выполняю фоновый вход...");
    const user = tg.initDataUnsafe.user;
    const fullName = `${user.first_name || ''} ${user.last_name || ''}`.trim();

    localStorage.setItem('vk_user_id', user.id.toString());
    localStorage.setItem('vk_user_name', fullName);
    localStorage.setItem('vk_user_photo', user.photo_url || '');
    
    // 2. Кидаем оба события: одно для чата, второе для Сайдбара (чтобы убрать Offline)
    window.dispatchEvent(new CustomEvent('user-profile-updated'));
    window.dispatchEvent(new CustomEvent('sidebar-storage'));
    if (window.fetchUserStatus) window.fetchUserStatus(user.id.toString());
  }
};

// Просто запускаем её. Она проверит: если мы в ТГ и не залогинены — залогинит.
handleMiniAppAuth();

// Слушатель для вызова модального окна
window.addEventListener('sidebar-tg-auth', () => {
  // Проверка на Mini App
  const tg = window.Telegram?.WebApp;
  if (tg && tg.initData && tg.initData.length > 0) {
      const returnTo = window.location.href.split('?')[0];
      const autoAuthUrl = `${CONFIG.STORAGE_GATEWAY}/auth/telegram/callback?bot=gemini&return_to=${encodeURIComponent(returnTo)}&${tg.initData}`;
      window.location.href = autoAuthUrl;
      return;
  }

  // Рендер модалки
  const overlayElement = document.getElementById('tg_auth_overlay');
  if (!overlayElement) {
      console.error("Элемент tg_auth_overlay не найден в index.html!");
      return;
  }
  
  // Если корень еще не создан — создаем, если создан — используем повторно
  if (!modalRoot) {
      modalRoot = createRoot(overlayElement);
  }

  modalRoot.render(
      <TelegramAuthModal onClose={() => modalRoot.render(null)} />
  ); 
});