import React, { useState, useEffect, useRef, useCallback } from 'react';

const Sidebar = ({ 
  t, // Принимаем объект переводов
  chatList = [], 
  innerRef,
  currentChatId, 
  onSelectChat, 
  onDeleteChat, 
  onRenameChat,
  onAutoRenameChat,
  isVK,
  fetchChats
}) => {

  const [userName, setUserName] = useState(localStorage.getItem('vk_user_name') || "Пользователь");
  const [userPhoto, setUserPhoto] = useState(localStorage.getItem('vk_user_photo') || "");
  const [isLoggedIn, setIsLoggedIn] = useState(!!localStorage.getItem('vk_user_id'));
  const [isProfileMenuVisible, setProfileMenuVisible] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isAdmin, setIsAdmin] = useState(localStorage.getItem('isAdmin') === 'true');
  const profileRef = useRef(null);

  // Состояние для "бесконечной" прокрутки
  const [visibleCount, setVisibleCount] = useState(12);
  const CHATS_PER_PAGE = 12;

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

  // Сбрасываем счетчик при изменении списка чатов (например, при поиске или удалении)
  useEffect(() => {
    setVisibleCount(CHATS_PER_PAGE);
  }, [chatList]);

  const handleNewChat = () => window.dispatchEvent(new CustomEvent('sidebar-new-chat'));
  const handleStorage = () => window.dispatchEvent(new CustomEvent('sidebar-storage'));
  const handleAdminPanel = () => window.dispatchEvent(new CustomEvent('sidebar-admin-panel'));
  const handleLogout = () => {
    setProfileMenuVisible(false);
    window.dispatchEvent(new CustomEvent('sidebar-logout'));
  };
  const handleVkAuth = () => {
    setProfileMenuVisible(false);
    console.log("Sidebar: Отправка события на открытие модалки VK");
    window.dispatchEvent(new CustomEvent('sidebar-vk-auth'));
  }

  const handleTgAuth = (e) => {
    if (e) e.stopPropagation();
    setProfileMenuVisible(false); // Закрываем менюшку
    console.log("Sidebar: Отправка события на открытие модалки ТГ");
    window.dispatchEvent(new CustomEvent('sidebar-tg-auth'));
  };

  const handleProfileClick = () => {
    setProfileMenuVisible(!isProfileMenuVisible);
  };

  const toggleSidebar = (e) => {
    // ОСТАНАВЛИВАЕМ всплытие, чтобы App.js не думал, что это клик "вне сайдбара"
    if (e && e.stopPropagation) e.stopPropagation();
    
    const newState = !isSidebarCollapsed;
    setIsSidebarCollapsed(newState);
    
    if (newState) {
      document.body.classList.add('sidebar-collapsed');
    } else {
      document.body.classList.remove('sidebar-collapsed');
    }
  };

  // Обработчик скролла для подгрузки чатов
  const handleScroll = (e) => {
      const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
      // Если до низа осталось меньше 20px и есть еще что загружать
      if (scrollHeight - scrollTop - clientHeight < 20 && visibleCount < chatList.length) {
          setVisibleCount(prevCount => prevCount + CHATS_PER_PAGE);
      }
  };

  const sortedChats = [...chatList].sort((a, b) => new Date(b.lastUpdate) - new Date(a.lastUpdate));

  return (
    <div ref={innerRef} id="sidebar" className={`sidebar ${isSidebarCollapsed ? 'collapsed' : ''}`}>
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
        <div className="sidebar-history-container" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {!isSidebarCollapsed && (
          <div className="history-section-header">
            <span className="text">💬 Чаты</span>
          </div>
        )}

        {/* Контейнер чатов теперь имеет собственный скролл */}
        <div className="sidebar-history" onScroll={handleScroll} style={{ flex: 1, overflowY: 'auto' }}>
          {sortedChats && sortedChats.length > 0 ? (
            sortedChats.slice(0, visibleCount).map((chat) => (
              <div 
                key={chat.id} 
                className={`history-item ${currentChatId === chat.id ? 'active' : ''}`}
                onClick={() => onSelectChat(chat.id)}
                title={chat.title} 
              >
                <div className="icon">💭</div>

                {!isSidebarCollapsed && (
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
            /* Если список пуст и это ВК — показываем кнопку инициации загрузки */
            isVK && !isSidebarCollapsed && (
              <div className="history-item history-item-loading" onClick={fetchChats} style={{cursor: 'pointer'}}>
                <span className="icon" title={t.tooltip_load_chat}>⏳</span>
                <span className="text">{t.tooltip_load_chat}</span>
              </div>
            )
          )}
          
          {/* Улучшенный индикатор загрузки */}
          {sortedChats.length > 0 && visibleCount < sortedChats.length && (
            <div className="history-item history-item-loading" onClick={() => setVisibleCount(prev => prev + CHATS_PER_PAGE)}>
              <span className="icon" title={t.tooltip_load_chat}>⏳</span>
              <span className="text">{t.tooltip_load_chat}</span>
            </div>
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
                <div className="profile-menu-item vk-auth-btn" onClick={handleVkAuth}>
                  <div className="icon">
                    <img src="/vk_logo.svg" alt="VK" />
                  </div>
                  <span className="text">Войти через VK</span>
                </div>
                
                <div className="profile-menu-item tg-auth-btn" onClick={handleTgAuth}>
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
