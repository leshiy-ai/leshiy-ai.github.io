import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
document.addEventListener('DOMContentLoaded', () => {
  const sidebar = document.getElementById('sidebar');
  const toggleBtn = document.getElementById('toggle-menu');
  const storageBtn = document.getElementById('open-storage');

  // Переключалка меню
  toggleBtn.addEventListener('click', () => {
      sidebar.classList.toggle('active');
  });

  // Обработка клика по сейфу
  storageBtn.addEventListener('click', () => {
      alert('Открываем твою хранилку в Яндексе...');
      // Сюда вставим вызов твоей функции GET /images/{file}
  });
});

const storageModal = document.getElementById('storage-modal');
const closeStorage = document.getElementById('close-storage');
const storageBtn = document.getElementById('open-storage');
const mainContent = document.querySelector('.main-content');
const updateLayout = () => {
  const width = sidebar.classList.contains('active') ? '260px' : '68px';
  mainContent.style.marginLeft = width;
};

// Открыть хранилище
storageBtn.addEventListener('click', () => {
    storageModal.style.display = 'flex';
    // Можно принудительно обновить фрейм, если нужно
    // document.getElementById('storage-frame').src += ''; 
});

// Закрыть хранилище
closeStorage.addEventListener('click', () => {
    storageModal.style.display = 'none';
});

// Закрытие по клику вне окна
window.addEventListener('click', (event) => {
    if (event.target == storageModal) {
        storageModal.style.display = 'none';
    }
});

window.addEventListener('vk-auth-success', (event) => {
  const newUserId = event.detail;
  console.log("Система: Пользователь авторизован!", newUserId);
});
