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
const updateProfileUI = () => {
  const userId = localStorage.getItem('vk_user_id');
  const nameEl = document.getElementById('display-name');
  const avatarEl = document.getElementById('user-avatar');

  // Получаем динамические данные из хранилища
  const savedName = localStorage.getItem('vk_user_name');
  const savedPhoto = localStorage.getItem('vk_user_photo');

  if (userId && userId !== 'null') {
      // Если есть имя в памяти - ставим, если нет - показываем ID
      if (nameEl) nameEl.textContent = savedName || `ID: ${userId}`;
      
      if (avatarEl) {
          // Если есть фото - ставим, если нет - оставляем текущий src (заглушку)
          if (savedPhoto) {
              avatarEl.src = savedPhoto;
          }
      }
  } else {
      // Состояние разлогина
      if (nameEl) nameEl.textContent = "Войти через VK";
      if (avatarEl) avatarEl.src = "https://vk.com/images/camera_100.png";
  }
};

// Функция для обработки того самого JSON со статусом
window.handleStatusResponse = (data) => {
  if (data.userName) localStorage.setItem('vk_user_name', data.userName);
  if (data.userPhoto) localStorage.setItem('vk_user_photo', data.userPhoto);
  if (data.vk_user_id) localStorage.setItem('vk_user_id', data.vk_user_id); // если ID тоже там
  
  updateProfileUI();
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

    // Логика авторизации: показываем твой готовый оверлей
    if (profileBtn) {
      profileBtn.onclick = (e) => {
          // Ловим клик ВСЕГДА, а внутри решаем что делать
          const userId = localStorage.getItem('vk_user_id');
          
          if (!userId || userId === 'null') {
              if (overlay) {
                  overlay.style.display = 'flex';
                  // Пинаем SDK для отрисовки кнопок
                  window.dispatchEvent(new CustomEvent('send-bot-command', { detail: '/auth_init_vk' }));
              }
          } else {
              console.log("Юзер уже залогинен:", userId);
              // Тут можно открыть меню профиля или настройки
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

// LogOut - сброс авторизации ВК ИД
const logoutBtn = document.getElementById('logout-btn'); // Если создашь такую кнопку

if (logoutBtn) {
    logoutBtn.onclick = () => {
        localStorage.removeItem('vk_user_id');
        localStorage.removeItem('vk_user_name');
        localStorage.removeItem('vk_user_photo');
        // Перезагружаем, чтобы сработал updateProfileUI()
        location.reload(); 
    };
}
// Глобальный слушатель для VK
window.addEventListener('vk-auth-success', (event) => {
  const newUserId = event.detail;
  console.log("Система: Пользователь авторизован!", newUserId);
  updateProfileUI();
});