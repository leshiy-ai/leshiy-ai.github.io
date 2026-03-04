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

// --- ИСПРАВЛЕННАЯ АРХИТЕКТУРА УПРАВЛЕНИЯ СТАТУСОМ ---

/**
 * Обрабатывает данные профиля и обновляет localStorage для UI.
 * Эта функция теперь получает данные из двух источников:
 * 1. Напрямую от VK (базовые данные: фото, имя).
 * 2. От нашего сервера (расширенные данные: isAdmin, кастомное имя).
 * @param {object | null} data - Объект с данными профиля.
 */
window.handleStatusResponse = (data) => {
  if (!data) {
    // Сценарий выхода: полная очистка
    localStorage.removeItem('vk_auth_data');
    localStorage.removeItem('vk_user_id');
    localStorage.removeItem('vk_user_name');
    localStorage.removeItem('vk_user_photo');
    localStorage.removeItem('isAdmin');
  } else {
    // Сценарий обновления: накладываем данные на localStorage
    // ID пользователя
    const userId = data.id || data.vk_user_id;
    if (userId) localStorage.setItem('vk_user_id', userId);

    // Имя пользователя (приоритет у данных с нашего сервера `userName`)
    const userName = data.userName || (data.first_name && `${data.first_name} ${data.last_name}`);
    if (userName) localStorage.setItem('vk_user_name', userName);

    // Фото пользователя (приоритет у данных с нашего сервера `userPhoto`)
    const userPhoto = data.userPhoto || data.photo_100;
    if (userPhoto) localStorage.setItem('vk_user_photo', userPhoto);
    else localStorage.removeItem('vk_user_photo'); // Если фото нет нигде - чистим

    // Статус админа (приходит только с нашего сервера)
    if (typeof data.isAdmin !== 'undefined') {
      localStorage.setItem('isAdmin', data.isAdmin);
    }
  }
  // Отправляем сигнал, что профиль обновился, чтобы UI (Сайдбар) перерисовался
  window.dispatchEvent(new CustomEvent('user-profile-updated'));
};

/**
 * **ИСПРАВЛЕНО**: Запрашивает статус пользователя с сервера, используя ПОДПИСАННЫЙ запрос.
 */
window.fetchUserStatus = async () => {
  // 1. Читаем ПОЛНЫЕ данные авторизации, сохраненные на шаге 1.
  const authDataString = localStorage.getItem('vk_auth_data');
  if (!authDataString) {
    // Если данных для аутентификации нет, ничего не делаем.
    // Профиль либо гостевой, либо будет сброшен при выходе.
    return;
  }

  try {
    const authData = JSON.parse(authDataString);

    // 2. Строим ПОДПИСАННЫЙ URL, как это делает работающая команда /storage.
    // Создаем URLSearchParams из ВСЕХ параметров, полученных от VK.
    const params = new URLSearchParams(authData);
    params.append('action', 'get-status'); // Добавляем нашу команду

    const fullUrl = `${CONFIG.STORAGE_GATEWAY}/?${params.toString()}`;

    // 3. Делаем правильный, верифицируемый запрос.
    const response = await fetch(fullUrl);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    
    const serverData = await response.json();

    // 4. Отправляем РАСШИРЕННЫЕ данные в обработчик.
    // `serverData` (isAdmin, userName) наложится поверх `authData` (фото, id).
    if (serverData) {
      window.handleStatusResponse({ ...authData, ...serverData });
    }
  } catch (error) {
    console.error("Ошибка при получении статуса пользователя с сервера:", error);
    // В случае ошибки не сбрасываем статус, чтобы не терять базовые данные от VK.
  }
};


// --- ГЛОБАЛЬНЫЕ СЛУШАТЕЛИ СОБЫТИЙ ---

document.addEventListener('DOMContentLoaded', () => {
  // Устанавливаем тему
  const currentTheme = localStorage.getItem('theme') || 'dark';
  document.documentElement.setAttribute('data-theme', currentTheme);

  // Первоначальная проверка статуса при загрузке страницы.
  // Функция сама найдет в localStorage все необходимые данные.
  window.fetchUserStatus();

  // Логика сворачивания/разворачивания сайдбара
  const sidebar = document.getElementById('sidebar');
  const toggleBtn = document.getElementById('toggle-menu');
  if (toggleBtn && sidebar) {
    toggleBtn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      // Используем классы на body для глобального эффекта
      document.body.classList.toggle('sidebar-collapsed');
    };
  }
});

/**
 * **ИСПРАВЛЕНО**: Слушатель для успешной авторизации VK.
 */
window.addEventListener('vk-auth-success', (event) => {
  const authData = event.detail;
  if (!authData || !authData.id) {
    console.error("VK Auth Success: не получены или неполные данные", authData);
    return;
  }
  
  console.log("Система: Получены полные данные авторизации. ID:", authData.id);

  // ШАГ 1: Сохраняем ВЕСЬ объект с параметрами подписи в localStorage.
  localStorage.setItem('vk_auth_data', JSON.stringify(authData));
  
  // Немедленно обновляем UI базовыми данными (имя, аватар).
  window.handleStatusResponse(authData);

  // ШАГ 2: СРАЗУ ЖЕ запрашиваем расширенный статус с нашего сервера.
  window.fetchUserStatus();
});
