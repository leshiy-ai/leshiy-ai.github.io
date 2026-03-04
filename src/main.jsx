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

// Вспомогательная функция (вынесена в глобальную область для слушателей)
window.updateProfileUI = (data = null) => {
  // Используем селекторы из твоего CSS
  const nameEl = document.querySelector('.user-name');
  const avatarImg = document.querySelector('.avatar-container img');

  const name = data?.userName || localStorage.getItem('vk_user_name');
  const photo = data?.userPhoto || localStorage.getItem('vk_user_photo');
  const id = data?.vk_user_id || localStorage.getItem('vk_user_id');

  if (id && id !== 'null') {
      if (nameEl) {
          nameEl.textContent = (name && name !== 'undefined') ? name : `ID: ${id}`;
      }
      if (avatarImg) {
          // Если фото есть — ставим, если нет — дефолт ВК
          avatarImg.src = (photo && photo !== 'null' && photo !== 'undefined') 
              ? photo 
              : "https://vk.com/images/camera_100.png";
      }
  }
};

window.handleStatusResponse = (statusData) => {
  if (!statusData) return;
  
  // Сохраняем ключи именно так, как они приходят в JSON
  if (statusData.vk_user_id) localStorage.setItem('vk_user_id', statusData.vk_user_id);
  if (statusData.userName) localStorage.setItem('vk_user_name', statusData.userName);
  if (statusData.userPhoto) localStorage.setItem('vk_user_photo', statusData.userPhoto);

  window.updateProfileUI(statusData);
};

// Оживляем интерфейс (DOM)
document.addEventListener('DOMContentLoaded', () => {
  
    // Сразу обновляем UI и тему
    updateProfileUI();
    const currentTheme = localStorage.getItem('theme') || 'dark';
    document.documentElement.setAttribute('data-theme', currentTheme);

    // Ищем все элементы один раз
    const sidebar = document.getElementById('sidebar');
    const toggleBtn = document.getElementById('toggle-menu');
    const storageBtn = document.getElementById('open-storage');
    const closeStorage = document.getElementById('close-storage');
    const storageModal = document.getElementById('storage-modal');
    const storageFrame = document.getElementById('storage-frame');
    const profileBtn = document.querySelector('.user-profile');
    const overlay = document.getElementById('vk_auth_overlay');
    const logoutBtn = document.getElementById('logout-btn');

    // Логика авторизации: показываем твой готовый оверлей
    if (profileBtn) {
      profileBtn.onclick = () => {
          const userId = localStorage.getItem('vk_user_id');
          if (!userId || userId === 'null') {
              if (overlay) {
                  overlay.style.display = 'flex';
                  window.dispatchEvent(new CustomEvent('send-bot-command', { detail: '/auth_init_vk' }));
              }
          }
      };
    }

    // 1. Переключалка меню (Sidebar)
    // ВАЖНО: на мобилке мы юзаем .active, на ПК .collapsed
    toggleBtn.onclick = (e) => {
      e.preventDefault(); // Чтобы страница не дергалась
      e.stopPropagation(); // Чтобы клик не улетал дальше
      
      if (window.innerWidth <= 768) {
          // На мобиле: убираем collapsed (чтобы не мешал) и тоглим active
          sidebar.classList.remove('collapsed');
          sidebar.classList.toggle('active');
      } else {
          // На ПК: убираем active (чтобы не мешал) и тоглим collapsed
          sidebar.classList.remove('active');
          sidebar.classList.toggle('collapsed');
      }
  };

    // 2. Открыть хранилище (Safe)
    if (storageBtn && storageModal) {
        storageBtn.addEventListener('click', () => {
            // Берем сохраненный ID или ставим тестовый
            const userId = localStorage.getItem('vk_user_id');
            if (!userId) {
              alert("Сначала авторизуйтесь!");
              return;
            }
            const gatewayUrl = `https://d5dtt5rfr7nk66bbrec2.kf69zffa.apigw.yandexcloud.net/vk?vk_user_id=${userId}`;
            
            storageFrame.src = gatewayUrl;
            storageModal.style.display = 'flex';
        });
    }

    // 3. Закрыть хранилище
    if (logoutBtn) {
        logoutBtn.onclick = () => {
            console.log("Выход из системы...");
            localStorage.removeItem('vk_user_id');
            localStorage.removeItem('vk_user_name');
            localStorage.removeItem('vk_user_photo');
            
            // Очищаем аватарку вручную перед релоадом для красоты
            document.getElementById('display-name').textContent = "Войти через VK";
            document.getElementById('user-avatar').src = "https://vk.com/images/camera_100.png";
            
            window.location.reload(); 
        };
    }

    // 4. Закрытие модалки по клику на фон
    window.addEventListener('click', (event) => {
        if (event.target === storageModal) {
            storageModal.style.display = 'none';
        }
    });

    // 5. Закрытие модалки по крестику (ты забыл добавить слушатель)
    if (closeStorage) {
      closeStorage.onclick = () => {
          storageModal.style.display = 'none';
      };
    }
});

// Глобальный слушатель для VK
window.addEventListener('vk-auth-success', (event) => {
  const newUserId = event.detail;
  console.log("Система: Пользователь авторизован!", newUserId);
  window.updateProfileUI();
});