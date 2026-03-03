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

window.addEventListener('vk-auth-success', (event) => {
  const newUserId = event.detail;
  console.log("Система: Пользователь авторизован!", newUserId);
});
