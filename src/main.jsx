import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import Sidebar from './Sidebar.jsx';
import App from './App.jsx';
import { CONFIG } from './config';

// --- РЕНДЕРИНГ КОМПОНЕНТОВ ---
createRoot(document.getElementById('sidebar')).render(
  <StrictMode>
    <Sidebar />
  </StrictMode>
);
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

    // Данные приходят с нашего сервера, где они уже обработаны
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
    // Если ID нет, очищаем данные, чтобы не было "Пользователь" и серой аватарки
    window.handleStatusResponse(null);
    return;
  }

  try {
    // Простой и правильный запрос, как вы и сказали
    const fullUrl = `${CONFIG.STORAGE_GATEWAY}/?action=get-status&userId=${userId}`;
    const response = await fetch(fullUrl);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    
    const serverData = await response.json();
    if (serverData) {
      // Передаем ПОЛНЫЙ профиль от сервера в обработчик
      window.handleStatusResponse(serverData);
    }
  } catch (error) {
    console.error("Ошибка при получении статуса пользователя от Хранилки:", error);
  }
};

// --- ГЛОБАЛЬНЫЕ СЛУШАТЕЛИ СОБЫТИЙ ---

document.addEventListener('DOMContentLoaded', () => {
  const currentTheme = localStorage.getItem('theme') || 'dark';
  document.documentElement.setAttribute('data-theme', currentTheme);
  
  // Запускаем проверку статуса при загрузке страницы
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
  // Ответ от кнопки приходит с полем user_id
  const userId = authData.user_id;

  if (!userId) {
    console.error("VK Auth Success: 'user_id' не найден в ответе OAuth", authData);
    return;
  }
  
  console.log("Система: Получен VK User ID:", userId);

  // Сохраняем ТОЛЬКО ID
  localStorage.setItem('vk_user_id', String(userId));
  
  // Сразу после получения ID, запрашиваем полный статус с нашего сервера
  window.fetchUserStatus();
});
