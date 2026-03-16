import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import Sidebar from './Sidebar.jsx';
import App from './App.jsx';
import { CONFIG } from './config';
import React from 'react';

// --- ОБРАБОТЧИК РЕДИРЕКТА TELEGRAM ---
// Выполняется один раз при загрузке страницы
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
      
      // Обновляем UI, чтобы сразу показать пользователя
      window.dispatchEvent(new CustomEvent('user-profile-updated'));

    } catch (error) {
      console.error("Ошибка при обработке данных Telegram из URL:", error);
    }
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
    }
  } catch (error) {
    console.error("Ошибка при получении статуса пользователя от Хранилки:", error);
  }
};

// --- ГЛОБАЛЬНЫЕ СЛУШАТЕЛИ СОБЫТИЙ ---

document.addEventListener('DOMContentLoaded', () => {
  // Сначала проверяем, не вернулся ли пользователь с авторизации
  handleTelegramRedirect();
  
  const currentTheme = localStorage.getItem('theme') || 'dark';
  document.documentElement.setAttribute('data-theme', currentTheme);
  
  // Затем, как обычно, запрашиваем статус (возможно, он только что был установлен)
  window.fetchUserStatus();

  const toggleBtn = document.getElementById('toggle-menu');
  if (toggleBtn) {
    toggleBtn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      document.body.classList.toggle('sidebar-collapsed');
    };
  }
});

// Слушатель для OneTap кнопки VK
window.addEventListener('vk-auth-success', (event) => {
  const authData = event.detail;
  const userId = authData.user_id;

  if (!userId) {
    console.error("VK Auth Success: 'user_id' не найден в ответе OAuth", authData);
    return;
  }
  
  console.log("Система: Получен VK User ID:", userId);

  localStorage.setItem('vk_user_id', String(userId));
  window.fetchUserStatus();
});


// --- TELEGRAM AUTH MODAL (редирект-версия) ---
const TelegramAuthModal = ({ onClose }) => {

  // Функция для перехода на шлюз авторизации
  const handleStartAuth = () => {
      // Определяем, куда вернуть пользователя после авторизации
      const returnTo = window.location.href.split('?')[0]; 
      window.location.href = `${CONFIG.STORAGE_GATEWAY}/tg?return_to=${encodeURIComponent(returnTo)}`;
  };

  return (
      <div className="tg-auth-modal-overlay" onClick={onClose}>
          <div className="tg-auth-modal" onClick={(e) => e.stopPropagation()}>
              <button onClick={onClose} className="action-btn close-btn">&times;</button>
              <h2>Вход через Telegram</h2>
              <div style={{ marginTop: '20px', textAlign: 'center' }}>
                  <p style={{ color: '#666', fontSize: '14px', marginBottom: '20px' }}>
                      Для входа вы будете перенаправлены на защищенный шлюз Хранилки.
                  </p>
                  <button 
                      onClick={handleStartAuth} 
                      className="action-btn"
                      style={{ 
                          background: '#0088cc', 
                          color: 'white', 
                          width: '100%', 
                          padding: '12px', 
                          borderRadius: '12px', 
                          border: 'none', 
                          fontWeight: 'bold', 
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '10px'
                      }}
                  >
                      <img src="/tg_logo.svg" alt="Telegram" style={{ height: '24px', width: '24px' }} />
                      <span>Авторизоваться через Telegram</span>
                  </button>
              </div>
          </div>
      </div>
  );
};

// Слушатель для вызова модального окна
window.addEventListener('sidebar-tg-auth', () => {
    const overlay = document.getElementById('tg_auth_overlay');
    const root = createRoot(overlay);
    root.render(<TelegramAuthModal onClose={() => root.unmount()} />); 
});
