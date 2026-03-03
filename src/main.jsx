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

// Вспомогательная функция (вынесена в глобальную область для слушателей)
window.updateProfileUI = (data = null) => {
  const nameEl = document.getElementById('display-name');
  const avatarEl = document.getElementById('user-avatar');

  // Если данные пришли (из Реакта), берем их. Если нет — из памяти.
  const name = data?.userName || localStorage.getItem('vk_user_name');
  const photo = data?.userPhoto || localStorage.getItem('vk_user_photo');
  const id = data?.vk_user_id || localStorage.getItem('vk_user_id');

  if (id && id !== 'null') {
      if (nameEl) nameEl.textContent = (name && name !== 'undefined') ? name : `ID: ${id}`;
      if (avatarEl && photo) avatarEl.src = photo;
  } else {
      if (nameEl) nameEl.textContent = "Войти через VK";
      if (avatarEl) avatarEl.src = "https://vk.com/images/camera_100.png";
  }
};

// Вызывается из App.jsx при получении get-status
window.handleStatusResponse = (statusData) => {
  if (!statusData) return;
  
  if (statusData.userName) localStorage.setItem('vk_user_name', statusData.userName);
  if (statusData.userPhoto) localStorage.setItem('vk_user_photo', statusData.userPhoto);
  if (statusData.vk_user_id) localStorage.setItem('vk_user_id', statusData.vk_user_id);

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

    // Выход (LogOut) — перенес сюда для надежности
    if (logoutBtn) {
        logoutBtn.onclick = () => {
            localStorage.removeItem('vk_user_id');
            localStorage.removeItem('vk_user_name');
            localStorage.removeItem('vk_user_photo');
            location.reload(); 
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
});

// Глобальный слушатель для VK
window.addEventListener('vk-auth-success', (event) => {
  const newUserId = event.detail;
  console.log("Система: Пользователь авторизован!", newUserId);
  window.updateProfileUI();
});