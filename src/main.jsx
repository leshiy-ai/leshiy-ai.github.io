import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Рендерим React
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Оживляем интерфейс (DOM)
document.addEventListener('DOMContentLoaded', () => {
    const userId = localStorage.getItem('vk_user_id');
    const nameEl = document.getElementById('display-name');
    const avatarEl = document.getElementById('user-avatar');

    if (userId) {
      // Если у тебя есть сохраненное имя/фото из VK после авторизации
      const savedName = localStorage.getItem('vk_user_name');
      const savedPhoto = localStorage.getItem('vk_user_photo');
      
      if (savedName) nameEl.textContent = savedName;
      if (savedPhoto) avatarEl.src = savedPhoto;
      
      // Если данных нет, можно вывести хотя бы ID для теста
      if (!savedName) nameEl.textContent = `User ID: ${userId}`;
    }

    const currentTheme = localStorage.getItem('theme') || 'dark';
    document.documentElement.setAttribute('data-theme', currentTheme);
    
    const sidebar = document.getElementById('sidebar');
    const toggleBtn = document.getElementById('toggle-menu');
    const storageBtn = document.getElementById('open-storage');
    const closeStorage = document.getElementById('close-storage');
    const storageModal = document.getElementById('storage-modal');
    const storageFrame = document.getElementById('storage-frame');

    // 1. Переключалка меню (Sidebar)
    if (toggleBtn && sidebar) {
        toggleBtn.addEventListener('click', () => {
            sidebar.classList.toggle('active');
        });
    }

    // 2. Открыть хранилище (Safe)
    if (storageBtn && storageModal) {
        storageBtn.addEventListener('click', () => {
            // Берем сохраненный ID или ставим тестовый
            const userId = localStorage.getItem('vk_user_id') || '3930898';
            const gatewayUrl = `https://d5dtt5rfr7nk66bbrec2.kf69zffa.apigw.yandexcloud.net/vk?vk_user_id=${userId}`;
            
            storageFrame.src = gatewayUrl;
            storageModal.style.display = 'flex';
        });
    }

    // 3. Закрыть хранилище
    if (closeStorage) {
        closeStorage.addEventListener('click', () => {
            storageModal.style.display = 'none';
        });
    }

    // 4. Закрытие модалки по клику на фон
    window.addEventListener('click', (event) => {
        if (event.target === storageModal) {
            storageModal.style.display = 'none';
        }
    });
});

// Глобальный слушатель для VK
window.addEventListener('vk-auth-success', (event) => {
  const newUserId = event.detail;
  console.log("Система: Пользователь авторизован!", newUserId);
});