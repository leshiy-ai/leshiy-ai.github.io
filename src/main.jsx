import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import Sidebar from './Sidebar.jsx'
import App from './App.jsx'

// Рендерим Sidebar
createRoot(document.getElementById('sidebar')).render(
  <StrictMode>
    <Sidebar />
  </StrictMode>,
)

// Рендерим React
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Эта функция теперь центральный "оповещатель" для всего приложения
window.handleStatusResponse = (statusData) => {
  if (!statusData) return;
  
  // 1. Сохраняем свежие данные в localStorage
  if (statusData.vk_user_id) localStorage.setItem('vk_user_id', statusData.vk_user_id);
  if (statusData.userName) localStorage.setItem('vk_user_name', statusData.userName);
  if (statusData.userPhoto) localStorage.setItem('vk_user_photo', statusData.userPhoto);

  // 2. Отправляем сигнал, что профиль обновился. Sidebar его поймает.
  window.dispatchEvent(new CustomEvent('user-profile-updated'));
};

// Оживляем интерфейс (DOM)
document.addEventListener('DOMContentLoaded', () => {
  
    const currentTheme = localStorage.getItem('theme') || 'dark';
    document.documentElement.setAttribute('data-theme', currentTheme);

    const sidebar = document.getElementById('sidebar');
    const toggleBtn = document.getElementById('toggle-menu');

    // Переключалка меню (Sidebar) остаётся здесь, т.к. управляет классами на <body>
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

// Глобальный слушатель для VK: после успешной авторизации, App.jsx пришлет нам данные
// Нам больше не нужно здесь ничего делать, так как App.jsx вызовет handleStatusResponse
window.addEventListener('vk-auth-success', (event) => {
  console.log("Система: Пользователь авторизован! ID:", event.detail);
  // App.jsx возьмет на себя дальнейшую логику и вызовет handleStatusResponse
});
