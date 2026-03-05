import React, { useState, useEffect, useRef, useCallback } from 'react';

const Sidebar = ({ 
  chatList = [], 
  currentChatId, 
  onSelectChat, 
  onDeleteChat, 
  onRenameChat 
}) => {

  const [userName, setUserName] = useState(null);
  const [userPhoto, setUserPhoto] = useState(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isProfileMenuVisible, setProfileMenuVisible] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const profileRef = useRef(null);
  const collapsed = isSidebarCollapsed;

  // Шаг 1: Создаем новую, стабильную функцию для обновления данных.
  // useCallback гарантирует, что эта функция не будет пересоздаваться при каждом рендере,
  // что делает ее безопасной для использования в useEffect.
  const updateProfileData = useCallback(() => {
    const id = localStorage.getItem('vk_user_id');
    const name = localStorage.getItem('vk_user_name');
    const photo = localStorage.getItem('vk_user_photo');
    const adminKey = localStorage.getItem('isAdmin');

    if (id && id !== 'null') {
      setUserName((name && name !== 'undefined') ? name : `ID: ${id}`);
      setUserPhoto((photo && photo !== 'null' && photo !== 'undefined') ? photo : 'https://vk.com/images/camera_100.png');
      setIsLoggedIn(true);
    } else {
      setUserName('Войти через VK');
      setUserPhoto('https://vk.com/images/camera_100.png');
      setIsLoggedIn(false);
    }
    
    setIsAdmin(adminKey === 'true');
  }, []); // Пустой массив зависимостей, т.к. сеттеры состояния стабильны.

  // Шаг 2: Используем новую функцию в useEffect.
  // Это гарантирует, что слушатели событий всегда вызывают актуальную логику.
  useEffect(() => {
    updateProfileData(); // Первоначальный вызов при загрузке
    
    // Подписываемся на события, используя новую стабильную функцию
    window.addEventListener('user-profile-updated', updateProfileData);
    window.addEventListener('storage', updateProfileData);

    // Очищаем подписки при размонтировании
    return () => {
      window.removeEventListener('user-profile-updated', updateProfileData);
      window.removeEventListener('storage', updateProfileData);
    };
  }, [updateProfileData]); // Зависим от нашей callback-функции

  // Эффект для закрытия меню по клику снаружи (остается без изменений)
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setProfileMenuVisible(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [profileRef]);

  // Обработчики событий (остаются без изменений)
  const handleNewChat = () => window.dispatchEvent(new CustomEvent('sidebar-new-chat'));
  const handleStorage = () => window.dispatchEvent(new CustomEvent('sidebar-storage'));
  const handleAdminPanel = () => window.dispatchEvent(new CustomEvent('sidebar-admin-panel'));
  const handleLogout = () => {
    setProfileMenuVisible(false);
    window.dispatchEvent(new CustomEvent('sidebar-logout'));
  };
  const handleProfileClick = () => {
    if (isLoggedIn) {
      setProfileMenuVisible(!isProfileMenuVisible);
    } else {
      window.dispatchEvent(new CustomEvent('sidebar-vk-auth'));
    }
  };

  const toggleSidebar = () => {
    const newState = !isSidebarCollapsed;
    setIsSidebarCollapsed(newState);
    
    // Синхронизируем с твоим CSS, который завязан на класс body
    if (newState) {
      document.body.classList.add('sidebar-collapsed');
    } else {
      document.body.classList.remove('sidebar-collapsed');
    }
  };

  return (
    // Шаг 3: Исправляем JSX, чтобы статус был под именем
    <div id="sidebar" className={`sidebar ${isSidebarCollapsed ? 'collapsed' : ''}`}>
        <div className="sidebar-top">
          {/* Добавляем onClick для управления состоянием */}
          <button id="toggle-menu" className="menu-btn" onClick={toggleSidebar}>☰</button>
          <div className="new-chat" onClick={handleNewChat}>
            <span className="icon">📝</span>
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
        {/* --- НОВЫЙ БЛОК: ИСТОРИЯ ЧАТОВ --- */}
        <div className="sidebar-history-container">
        {/* Заголовок "Чаты" с эмодзи 💬 */}
        {!collapsed && (
          <div className="history-section-header">
            <span className="text">💬 Чаты</span>
          </div>
        )}

        <div className="sidebar-history">
          {chatList && chatList.length > 0 ? (
            chatList.map((chat) => (
              <div 
                key={chat.id} 
                className={`history-item ${currentChatId === chat.id ? 'active' : ''}`}
                onClick={() => onSelectChat(chat.id)}
                title={collapsed ? chat.title : ""} 
              >
                <div className="icon">💭</div>

                {/* Текстовая часть видна только если НЕ collapsed */}
                {!collapsed && (
                  <>
                    <div className="history-text">
                      <span className="chat-title">{chat.title}</span>
                      <span className="chat-date">
                        {new Date(chat.lastUpdate).toLocaleDateString()}
                      </span>
                    </div>

                    <div className="history-actions">
                      <button 
                        className="action-icon rename" 
                        onClick={(e) => { e.stopPropagation(); onRenameChat(chat.id); }}
                      >
                        ✏️
                      </button>
                      <button 
                        className="action-icon delete" 
                        onClick={(e) => { e.stopPropagation(); onDeleteChat(chat.id); }}
                      >
                        🗑️
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))
          ) : (
            !collapsed && <div className="history-empty">История пуста</div>
          )}
        </div>
      </div>
        {/* ---------------------------------- */}
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
            {/* ИСПРАВЛЕННЫЙ БЛОК */}
            <div className="user-info">
              <span className="user-name" id="display-name">{userName}</span>
              {/* Статус теперь под именем. Добавляем класс для стилизации точки */}
              <span className={`user-status ${isLoggedIn ? 'online' : 'offline'}`}>
                {isLoggedIn ? 'Online' : 'Offline'}
              </span>
            </div>
          </div>
        </div>
      </div>
  );
};

export default Sidebar;
