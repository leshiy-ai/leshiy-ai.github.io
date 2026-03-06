
import React, { useState, useEffect, useRef, useCallback } from 'react';

const Sidebar = ({ 
  chatList = [], 
  currentChatId, 
  onSelectChat, 
  onDeleteChat, 
  onRenameChat 
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
      setUserName('Войти через VK');
      setUserPhoto('https://vk.com/images/camera_100.png');
      setIsLoggedIn(false);
    }
    
    setIsAdmin(adminKey === 'true');
  }, []);

  useEffect(() => {
    updateProfileData();
    
    window.addEventListener('user-profile-updated', updateProfileData);
    window.addEventListener('storage', updateProfileData);

    return () => {
      window.removeEventListener('user-profile-updated', updateProfileData);
      window.removeEventListener('storage', updateProfileData);
    };
  }, [updateProfileData]);

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
            !collapsed && <div className="history-empty"></div>
          )}
        </div>
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
