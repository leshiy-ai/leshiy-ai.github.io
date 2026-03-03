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
  
    // Вспомогательная функция для обновления профиля (чтобы вызвать её и при загрузке, и при входе)
    const updateProfileUI = () => {
      const userId = localStorage.getItem('vk_user_id');
      const nameEl = document.getElementById('display-name');
      const avatarEl = document.getElementById('user-avatar');

      if (userId && userId !== 'null') {
          const savedName = localStorage.getItem('vk_user_name');
          const savedPhoto = localStorage.getItem('vk_user_photo');
          
          if (nameEl) nameEl.textContent = savedName || `ID: ${userId}`;
          if (avatarEl && savedPhoto) avatarEl.src = savedPhoto;
      } else {
          if (nameEl) nameEl.textContent = "Войти через VK";
          if (avatarEl) avatarEl.src = "https://vk.com/images/camera_100.png"; // дефолт
      }
    };

    updateProfileUI();

    const currentTheme = localStorage.getItem('theme') || 'dark';
    document.documentElement.setAttribute('data-theme', currentTheme);

    const sidebar = document.getElementById('sidebar');
    const toggleBtn = document.getElementById('toggle-menu');
    const storageBtn = document.getElementById('open-storage');
    const closeStorage = document.getElementById('close-storage');
    const storageModal = document.getElementById('storage-modal');
    const storageFrame = document.getElementById('storage-frame');
    const profileBtn = document.querySelector('.user-profile');

    // Логика авторизации по клику на аватар/профиль
    const profileArea = document.querySelector('.user-profile');
    if (profileArea) {
        profileArea.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation(); // Чтобы событие не улетало выше
            
            const userId = localStorage.getItem('vk_user_id');
            if (!userId || userId === 'null') {
                console.log("Запуск авторизации...");
                const overlay = document.getElementById('vk_auth_overlay');
                const container = document.getElementById('vk_auth_container');
                
                if (overlay && container) {
                    overlay.style.setProperty('display', 'flex', 'important');
                    container.innerHTML = '';
                    
                    // Вызываем твою команду инициализации, если она нужна
                    window.dispatchEvent(new CustomEvent('send-bot-command', { detail: '/auth_init_vk' }));
                } else {
                    // Если оверлея нет в DOM, пробуем редирект как запасной вариант
                    console.error("Оверлей не найден!");
                }
            }
        };
    }

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
  updateProfileUI();
});