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
    const sidebar = document.getElementById('sidebar');
    const toggleBtn = document.getElementById('toggle-menu');
    const storageBtn = document.getElementById('open-storage');
    const storageModal = document.getElementById('storage-modal');
    const closeStorage = document.getElementById('close-storage');

    // 1. Переключалка меню (Sidebar)
    if (toggleBtn && sidebar) {
        toggleBtn.addEventListener('click', () => {
            sidebar.classList.toggle('active');
        });
    }

    // 2. Открыть хранилище (Safe)
    if (storageBtn && storageModal) {
        storageBtn.addEventListener('click', () => {
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