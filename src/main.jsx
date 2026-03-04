import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import Sidebar from './Sidebar.jsx';
import App from './App.jsx';
import { CONFIG } from './config'; // Импортируем конфиг

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


// --- ГЛОБАЛЬНЫЕ ФУНКЦИИ УПРАВЛЕНИЯ СТАТУСОМ ---

/**
 * УМНАЯ функция для обработки данных о статусе пользователя.
 * Обновляет localStorage, только если в полученных данных есть соответствующие поля.
 * @param {object | null} statusData - Объект с данными (может быть неполным).
 */
window.handleStatusResponse = (statusData) => {
  if (!statusData) {
    // Сброс данных при выходе или ошибке
    localStorage.removeItem('vk_user_id');
    localStorage.removeItem('vk_user_name');
    localStorage.removeItem('vk_user_photo');
    localStorage.removeItem('isAdmin');
  } else {
    // Обновляем ID пользователя, если он есть
    const userId = statusData.vk_user_id || statusData.id;
    if (userId) {
        localStorage.setItem('vk_user_id', userId);
    }
    // Обновляем имя, только если оно пришло в ответе
    if (statusData.userName) {
        localStorage.setItem('vk_user_name', statusData.userName);
    }
    // Обновляем фото, только если оно пришло в ответе
    if (statusData.userPhoto) {
        localStorage.setItem('vk_user_photo', statusData.userPhoto);
    }
    // `isAdmin` может быть false, поэтому проверяем на undefined
    if (typeof statusData.isAdmin !== 'undefined') {
        localStorage.setItem('isAdmin', statusData.isAdmin);
    }
  }
  // Отправляем сигнал, что профиль обновился, чтобы UI (Сайдбар) перерисовался
  window.dispatchEvent(new CustomEvent('user-profile-updated'));
};

/**
 * Запрашивает статус пользователя с сервера.
 * @param {string | number} userId - ID пользователя VK.
 */
window.fetchUserStatus = async (userId) => {
  if (!userId || userId === 'null' || userId === 'guest') {
    window.handleStatusResponse(null); // Сбрасываем данные для гостя
    return;
  }
  try {
    const response = await fetch(`${CONFIG.STORAGE_GATEWAY}/?action=get-status&vk_user_id=${userId}`);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const data = await response.json();
    if (data) {
      // Прокидываем в обработчик, добавляя ID для консистентности
      window.handleStatusResponse({ ...data, vk_user_id: userId });
    }
  } catch (error) {
    console.error("Ошибка при получении статуса пользователя:", error);
    window.handleStatusResponse(null); // Сброс в случае ошибки
  }
};


// --- ГЛОБАЛЬНЫЕ СЛУШАТЕЛИ СОБЫТИЙ ---

// Срабатывает при полной загрузке HTML
document.addEventListener('DOMContentLoaded', () => {
  // Устанавливаем тему
  const currentTheme = localStorage.getItem('theme') || 'dark';
  document.documentElement.setAttribute('data-theme', currentTheme);

  // Первоначальная проверка статуса при загрузке страницы
  const initialUserId = localStorage.getItem('vk_user_id');
  window.fetchUserStatus(initialUserId);

  // Логика сворачивания/разворачивания сайдбара
  const sidebar = document.getElementById('sidebar');
  const toggleBtn = document.getElementById('toggle-menu');
  if (toggleBtn && sidebar) {
    toggleBtn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (window.innerWidth <= 768) {
        sidebar.classList.remove('collapsed');
        sidebar.classList.toggle('active');
      } else {
        sidebar.classList.remove('active');
        sidebar.classList.toggle('collapsed');
      }
    };
  }
});

// Срабатывает, когда App.jsx подтверждает успешную авторизацию VK
window.addEventListener('vk-auth-success', (event) => {
  const detail = event.detail;
  // ID может быть как строкой, так и в объекте
  const userId = (typeof detail === 'object' && detail !== null) ? detail.vk_user_id : detail;
  
  console.log("Система: Пользователь авторизован! ID:", userId);

  if (userId && userId !== 'null') {
    window.fetchUserStatus(userId); // Запрашиваем полный статус с сервера
  }
});
