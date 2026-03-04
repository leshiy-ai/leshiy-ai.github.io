import React, { useState, useEffect, useRef } from 'react';

const Sidebar = () => {
  const [userName, setUserName] = useState(null);
  const [userPhoto, setUserPhoto] = useState(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isProfileMenuVisible, setProfileMenuVisible] = useState(false);
  const profileRef = useRef(null);

  // Эффект для обновления данных профиля
  useEffect(() => {
    const updateProfile = () => {
      const id = localStorage.getItem('vk_user_id');
      const name = localStorage.getItem('vk_user_name');
      const photo = localStorage.getItem('vk_user_photo');

      if (id && id !== 'null') {
        setUserName((name && name !== 'undefined') ? name : `ID: ${id}`);
        setUserPhoto((photo && photo !== 'null' && photo !== 'undefined') ? photo : "https://vk.com/images/camera_100.png");
        setIsLoggedIn(true);
      } else {
        setUserName('Войти через VK');
        setUserPhoto("https://vk.com/images/camera_100.png");
        setIsLoggedIn(false);
      }
    };

    updateProfile();
    window.addEventListener('user-profile-updated', updateProfile);

    return () => {
      window.removeEventListener('user-profile-updated', updateProfile);
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
  const handleLogout = () => {
    setProfileMenuVisible(false); // Сначала закрываем меню
    window.dispatchEvent(new CustomEvent('sidebar-logout'));
  };

  // Главный обработчик для клика по профилю
  const handleProfileClick = () => {
    if (isLoggedIn) {
      setProfileMenuVisible(!isProfileMenuVisible); // Показываем/скрываем меню
    } else {
      window.dispatchEvent(new CustomEvent('sidebar-vk-auth')); // Авторизуем
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
        </div>

        <div className="sidebar-bottom" ref={profileRef}>
          {/* -- НОВОЕ ВСПЛЫВАЮЩЕЕ МЕНЮ -- */}
          {isProfileMenuVisible && (
            <div className="profile-menu">
              <div className="profile-menu-item" onClick={handleLogout}>
                <span className="icon">🚪</span>
                <span className="text">Выход</span>
              </div>
            </div>
          )}

          <div 
            className="user-profile"
            title={isLoggedIn ? `Профиль: ${userName}` : 'Нажмите для авторизации через VK'}
            onClick={handleProfileClick}
            style={{ cursor: 'pointer' }} // Курсор всегда pointer, так как есть действие
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
