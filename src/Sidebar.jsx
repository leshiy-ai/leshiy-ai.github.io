import React, { useState, useEffect, useRef, useCallback } from 'react';

const Sidebar = ({ 
  t, // Принимаем объект переводов
  chatList = [], 
  currentChatId, 
  onSelectChat, 
  onDeleteChat, 
  onRenameChat,
  onAutoRenameChat
}) => {

  const [userName, setUserName] = useState(localStorage.getItem('vk_user_name') || "Пользователь");
  const [userPhoto, setUserPhoto] = useState(localStorage.getItem('vk_user_photo') || "");
  const [isLoggedIn, setIsLoggedIn] = useState(!!localStorage.getItem('vk_user_id'));
  const [isProfileMenuVisible, setProfileMenuVisible] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isAdmin, setIsAdmin] = useState(localStorage.getItem('isAdmin') === 'true');
  const profileRef = useRef(null);
  const collapsed = isSidebarCollapsed;

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
      setUserName(t.tooltip_login);
      setUserPhoto('https://vk.com/images/camera_100.png');
      setIsLoggedIn(false);
    }
    
    setIsAdmin(adminKey === 'true');
  }, [t]);

  useEffect(() => {
    // 1. Сразу при загрузке проверяем URL на наличие данных от ВК или ТГ
    const params = new URLSearchParams(window.location.search);
    const vkId = params.get('vk_user_id');
    const tgData = params.get('tg_data');

    if (vkId || tgData) {
      // Если пришли данные из URL — значит мы только что после редиректа.
      // Вызываем обновление профиля, оно само всё распарсит и запишет.
      updateProfileData();
      
      // Чистим URL, чтобы параметры не мозолили глаза и не вызывали циклов
      window.history.replaceState({}, document.title, window.location.pathname);
    } else {
      // Если в URL пусто — просто грузим то, что уже было в localStorage
      updateProfileData();
    }

    // 2. Слушаем событие обновления (чтобы аватарка менялась мгновенно)
    const handleUpdate = () => updateProfileData();
    window.addEventListener('user-profile-updated', handleUpdate);
    window.addEventListener('storage', handleUpdate); // На случай изменений в других вкладках

    return () => {
      window.removeEventListener('user-profile-updated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setProfileMenuVisible(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [profileRef]);

  const handleNewChat = () => window.dispatchEvent(new CustomEvent('sidebar-new-chat'));
  const handleStorage = () => window.dispatchEvent(new CustomEvent('sidebar-storage'));
  const handleAdminPanel = () => window.dispatchEvent(new CustomEvent('sidebar-admin-panel'));
  const handleLogout = () => {
    setProfileMenuVisible(false);
    window.dispatchEvent(new CustomEvent('sidebar-logout'));
  };
  const handleVkAuth = () => {
    setProfileMenuVisible(false);
    window.dispatchEvent(new CustomEvent('sidebar-vk-auth'));
  }

  const onTgLoginClick = (e) => {
    if (e) e.stopPropagation();
    setProfileMenuVisible(false); // Закрываем менюшку
    console.log("Sidebar: Отправка события на открытие модалки ТГ");
    window.dispatchEvent(new CustomEvent('sidebar-tg-auth'));
  };

  const handleProfileClick = () => {
    setProfileMenuVisible(!isProfileMenuVisible);
  };

  const toggleSidebar = () => {
    const newState = !isSidebarCollapsed;
    setIsSidebarCollapsed(newState);
    
    if (newState) {
      document.body.classList.add('sidebar-collapsed');
    } else {
      document.body.classList.remove('sidebar-collapsed');
    }
  };

  const sortedChats = [...chatList].sort((a, b) => new Date(b.lastUpdate) - new Date(a.lastUpdate));

  return (
    <div id="sidebar" className={`sidebar ${isSidebarCollapsed ? 'collapsed' : ''}`}>
        <div className="sidebar-top">
          <button id="toggle-menu" className="menu-btn" onClick={toggleSidebar} title={t.tooltip_toggle_menu}>☰</button>
          <div className="new-chat" onClick={handleNewChat} title={t.tooltip_new_chat}>
            <span className="icon">➕</span>
            <span className="text">Новый чат</span>
          </div>
        </div>
      
        <div className="sidebar-middle">
          <div className="nav-item" id="open-storage" onClick={handleStorage} title={t.tooltip_storage}>
            <span className="icon">🗄️</span>
            <span className="text">Хранилка</span>
          </div>
          {isAdmin && (
            <div className="nav-item" id="open-admin-panel" onClick={handleAdminPanel} title={t.tooltip_admin}>
              <span className="icon">🅰️</span>
              <span className="text">Админ меню</span>
            </div>
          )}
        </div>
        <div className="sidebar-history-container">
        {!collapsed && (
          <div className="history-section-header">
            <span className="text">💬 Чаты</span>
          </div>
        )}

        <div className="sidebar-history">
          {sortedChats && sortedChats.length > 0 ? (
            sortedChats.map((chat) => (
              <div 
                key={chat.id} 
                className={`history-item ${currentChatId === chat.id ? 'active' : ''}`}
                onClick={() => onSelectChat(chat.id)}
                title={chat.title} 
              >
                <div className="icon">💭</div>

                {!collapsed && (
                  <>
                    <div className="history-text">
                      <span className="chat-title">{chat.title}</span>
                      <span className="chat-date">
                      {chat.lastUpdate ? new Date(chat.lastUpdate).toLocaleString('ru-RU', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      }) : 'Недавно'}
                      </span>
                    </div>

                    <div className="history-actions">
                      <button 
                        className="action-icon rename" 
                        title={t.tooltip_rename_chat} 
                        onClick={(e) => { e.stopPropagation(); onRenameChat(chat.id); }}
                      >
                        ✏️
                      </button>
                      <button 
                        className="action-icon auto-rename" 
                        title={t.tooltip_auto_rename} 
                        onClick={(e) => { e.stopPropagation(); onAutoRenameChat(chat.id); }}
                      >
                        ✨
                      </button>
                      <button 
                        className="action-icon delete" 
                        title={t.tooltip_delete_chat} 
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
            !collapsed && <div className="history-empty"></div>
          )}
        </div>
      </div>

      <div className="sidebar-bottom" ref={profileRef}>
          {isProfileMenuVisible && (
            <div className="profile-menu">
            {isLoggedIn ? (
              <div className="profile-menu-item logout" onClick={handleLogout}>
                <span className="icon">🚪</span>
                <span className="text">Выход</span>
              </div>
            ) : (
              <>
                {/* Добавлен класс vk-auth-btn */}
                <div className="profile-menu-item vk-auth-btn" onClick={handleVkAuth}>
                  <div className="icon">
                    <img src="/vk_logo.svg" alt="VK" />
                  </div>
                  <span className="text">Войти через VK</span>
                </div>
                
                {/* Добавлен класс tg-auth-btn */}
                <div className="profile-menu-item tg-auth-btn" onClick={onTgLoginClick}>
                  <div className="icon">
                    <img src="/tg_logo.svg" alt="Telegram" />
                  </div>
                  <span className="text">Войти через Telegram</span>
                </div>
              </>
            )}
          </div>
          )}

          <div 
            className="user-profile"
            title={isLoggedIn ? `${t.tooltip_logout}: ${userName}` : t.tooltip_login}
            onClick={handleProfileClick}
            style={{ cursor: 'pointer' }}
          >
            <div className="avatar-container">
              <img id="user-avatar" src={userPhoto} alt="User Avatar" />
            </div>

            <div className="user-info">
              <span className="user-name" id="display-name">{userName}</span>
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
