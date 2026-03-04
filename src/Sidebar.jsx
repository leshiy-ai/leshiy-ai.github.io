import React from 'react';

const Sidebar = () => {
  return (
    <div id="sidebar" class="sidebar collapsed">
        <div class="sidebar-top">
          <button id="toggle-menu" class="menu-btn">☰</button>
          <div class="new-chat">
            <span class="icon">➕</span>
            <span class="text">Новый чат</span>
          </div>
        </div>
      
        <div class="sidebar-middle">
          <div class="nav-item" id="open-storage">
            <span class="icon">🗄️</span>
            <span class="text">Хранилка</span>
          </div>
          
          <div id="logout-btn" class="logout-btn nav-item">
            <span class="icon">🚪</span>
            <span class="text">Выход</span>
          </div>
        </div>

        <div class="sidebar-bottom">
          <div class="user-profile" title="Leshiy User (Online)">
            <div class="avatar-container">
            <img id="user-avatar" src="https://vk.com/images/camera_100.png" alt="User Avatar" />
            </div>
            <div class="user-info">
              <span class="user-name" id="display-name">Leshiy User</span>
              <span class="user-status">● Online</span>
            </div>
          </div>
        </div>
      </div>
  );
};

export default Sidebar;