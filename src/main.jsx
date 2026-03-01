import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

window.addEventListener('vk-auth-success', (event) => {
  const newUserId = event.detail;
  console.log("Система: Пользователь авторизован!", newUserId);
});
