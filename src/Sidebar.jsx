import React, { useState, useEffect, useRef } from 'react';

const Sidebar = () => {
  const [userName, setUserName] = useState(null);
  const [userPhoto, setUserPhoto] = useState(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isProfileMenuVisible, setProfileMenuVisible] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false); // Состояние для админских прав
  const profileRef = useRef(null);

  // Эффект для обновления данных профиля и проверки прав админа
  useEffect(() => {
    const updateProfileAndCheckAdmin = () => {
      const id = localStorage.getItem('vk_user_id');
      const name = localStorage.getItem('vk_user_name');
      const photo = localStorage.getItem('vk_user_photo');
      const adminKey = localStorage.getItem('IS_ADMIN'); // <-- ИСПРАВЛЕНО: Проверяем ключ IS_ADMIN

      if (id && id !== 'null') {
        setUserName((name && name !== 'undefined') ? name : `ID: ${id}`);
        setUserPhoto((photo && photo !== 'null' && photo !== 'undefined') ? photo : "https://vk.com/images/camera_100.png");
        setIsLoggedIn(true);
      } else {
        setUserName('Войти через VK');
        setUserPhoto("https://vk.com/images/camera_100.png");
        setIsLoggedIn(false);
      }
      
      setIsAdmin(adminKey === 'true'); // <-- ИСПРАВЛЕНО: Устанавливаем статус админа, если ключ равен 'true'
    };

    updateProfileAndCheckAdmin();
    // Добавляем слушатель и на storage, чтобы при изменении ключа админа права обновлялись
    window.addEventListener('user-profile-updated', updateProfileAndCheckAdmin);
    window.addEventListener('storage', updateProfileAndCheckAdmin); 

    return () => {
      window.removeEventListener('user-profile-updated', updateProfileAndCheckAdmin);
      window.removeEventListener('storage', updateProfileAndCheckAdmin);
    };
  }, []);

  // Эффект для закрытия меню по клику вне его
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setProfileMenuVisible(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [profileRef]);

  // --- ОБРАБОТЧИКИ СОБЫТИЙ ---
  const handleNewChat = () => window.dispatchEvent(new CustomEvent('sidebar-new-chat'));
  const handleStorage = () => window.dispatchEvent(new CustomEvent('sidebar-storage'));
  const handleAdminPanel = () => window.dispatchEvent(new CustomEvent('sidebar-admin-panel'));
  const handleLogout = () => {
    setProfileMenuVisible(false);
    window.dispatchEvent(new CustomEvent('sidebar-logout'));
  };

  // Главный обработчик для клика по профилю
  const handleProfileClick = () => {
    if (isLoggedIn) {
      setProfileMenuVisible(!isProfileMenuVisible);
    } else {
      window.dispatchEvent(new CustomEvent('sidebar-vk-auth'));
    }
  };

  return (
    <div id="sidebar" className="sidebar collapsed">
        <div className="sidebar-top">
          <button id="toggle-menu" className="menu-btn">☰</button>
          <div className="new-chat" onClick={handleNewChat}>
            <span className="icon">➕</span>
            <span className="text">Новый чат</span>
          </div>
        </div>
      
        <div className="sidebar-middle">
          <div className="nav-item" id="open-storage" onClick={handleStorage}>
            <span className="icon">🗄️</span>
            <span className="text">Хранилка</span>
          </div>
          {isAdmin && (
            <div className="nav-item" id="open-admin-panel" onClick={handleAdminPanel}>
              <span className="icon">🅰️</span>
              <span className="text">Админ меню</span>
            </div>
          )}
        </div>

        <div className="sidebar-bottom" ref={profileRef}>
          {isProfileMenuVisible && (
            <div className="profile-menu">
              <div className="profile-menu-item logout" onClick={handleLogout}>
                <span className="icon">🚪</span>
                <span className="text">Выход</span>
              </div>
            </div>
          )}

          <div 
            className="user-profile"
            title={isLoggedIn ? `Профиль: ${userName}` : 'Нажмите для авторизации через VK'}
            onClick={handleProfileClick}
            style={{ cursor: 'pointer' }}
          >
            <div className="avatar-container">
              <img id="user-avatar" src={userPhoto} alt="User Avatar" />
            </div>
            <div className="user-info">
              <span className="user-name" id="display-name">{userName}</span>
              <span className="user-status">{isLoggedIn ? '● Online' : '● Offline'}</span>
            </div>
          </div>
        </div>
      </div>
  );
};

export default Sidebar;
