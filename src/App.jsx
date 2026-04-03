import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import { CONFIG } from './config';
import { askLeshiy, generateLeshiy } from './leshiy-core';
import { SERVICE_TYPE_MAP, AI_MODEL_MENU_CONFIG, getActiveModelKey as getActiveModelKeyGeneric, loadActiveModelConfig } from './ai-config';
import Sidebar from './Sidebar';
import './App.css';

// --- КОНСТАНТЫ ---
// Определяют основные режимы работы приложения и связывают их с типом сервиса
const LESHIY_MODES = [
    { id: 1, name: 'Общение', icon: '1️⃣', serviceType: 'TEXT_TO_TEXT' },
    { id: 2, name: 'Генерация фото', icon: '2️⃣', serviceType: 'TEXT_TO_IMAGE' },
    { id: 3, name: 'Синтез речи', icon: '3️⃣', serviceType: 'TEXT_TO_AUDIO' },
    { id: 4, name: 'Генерация видео', icon: '4️⃣', serviceType: 'TEXT_TO_VIDEO' }
];

// Карта селекторов моделей для каждого типа сервиса
const MODELS_SELECTORS = {
    'TEXT_TO_TEXT': [
        { key: 'TEXT_TO_TEXT_CLOUDFLARE', name: 'Базовая', icon: '✳️' },
        { key: 'TEXT_TO_TEXT_GEMINI', name: 'Умная', icon: '✨' },
        { key: 'TEXT_TO_TEXT_BOTHUB', name: 'Запасная', icon: '✴️' }
    ],
    'TEXT_TO_IMAGE': [
        { key: 'TEXT_TO_IMAGE_CLOUDFLARE', name: 'Быстрая', icon: '✳️' },
        { key: 'TEXT_TO_IMAGE_GEMINI', name: 'Качественная', icon: '✨' },
        { key: 'TEXT_TO_IMAGE_BOTHUB', name: 'Запасная', icon: '✴️' }
    ],
    'TEXT_TO_AUDIO': [
        { key: 'TEXT_TO_AUDIO_CLOUDFLARE', name: 'Быстрый', icon: '✳️' },
        { key: 'TEXT_TO_AUDIO_VOICERSS', name: 'Обычный', icon: '⚛️' },
        { key: 'TEXT_TO_AUDIO_GEMINI', name: 'Качественный', icon: '✨' },
        { key: 'TEXT_TO_AUDIO_BOTHUB', name: 'Запасной', icon: '✴️' }
    ],
    'TEXT_TO_VIDEO': [
        // Задел на будущее для моделей генерации видео
        { key: 'TEXT_TO_VIDEO_PLACEHOLDER', name: 'Скоро...', icon: '📹' }
    ]
};


const TRANSLATIONS = {
    ru: {
        title: 'Leshiy-AI',
        placeholder: (files) => files.length > 0 ? "Добавь текст к файлам..." : "Спроси меня о чем-нибудь...",
        send: 'Отправить',
        upload: '📎 Выбрать файл',
        welcome: 'Привет! Я Gemini-AI. Спроси меня о чём угодно, подключи Хранилку и вставляй картинки или файлы прямо в поле ввода или перетягивай в чат, я всё пойму, распознаю, и сделаю!',
        thinking: '⏳ Gemini-AI думает...',
        uploading: '☁️ Загружаю',
        uploadSuccess: '✅ Файл успешно сохранен в экосистеме!',
        uploadError: '❌ Не удалось сохранить',
        admin: '👑 Админка',
        version: 'Версия',
        author: 'Автор',
        tooltip_add_file: "Добавить файл",
        tooltip_record_voice: "Записать голос",
        tooltip_send: "Отправить",
        tooltip_toggle_lang: "Сменить язык",
        tooltip_toggle_theme: "Сменить тему",
        tooltip_reload: "Обновить чат",
        tooltip_close: "Закрыть чат",
        tooltip_select_mode: "Выбрать режим",
        tooltip_select_model: "Выбрать модель",
        tooltip_toggle_menu: "Открыть/закрыть меню",
        tooltip_new_chat: "Начать новый чат",
        tooltip_storage: "Открыть Хранилище",
        tooltip_admin: "Открыть админ-панель",
        tooltip_logout: "Выйти",
        tooltip_login: "Авторизоваться",
        tooltip_login_vk: "Войти через ВКонтакте",
        tooltip_login_tg: "Войти через Telegram",
        tooltip_rename_chat: "Переименовать чат",
        tooltip_delete_chat: "Удалить чат",
        tooltip_auto_rename: "Автоматически переименовать чат",
        tooltip_copy_text: "Копировать текст",
        tooltip_load_chat: "Загрузка...",
    },
    en: {
        title: 'Leshiy-AI',
        placeholder: (files) => files.length > 0 ? "Now add a text query to the files..." : "Ask something...",
        send: 'Send',
        upload: '📎 Select file',
        welcome: 'Hi! I am Gemini-AI. Ask me anything, connect Storage and insert pictures or files directly into the input field or drag them into the chat, I will understand everything, recognize it, and do it!',
        thinking: '⏳ Gemini-AI is thinking...',
        uploading: '☁️ Uploading',
        uploadSuccess: '✅ File successfully saved in the ecosystem!',
        uploadError: '❌ Failed to save',
        admin: '👑 Admin',
        version: 'Version',
        author: 'Author',
        tooltip_add_file: "Add file",
        tooltip_record_voice: "Record voice",
        tooltip_send: "Send",
        tooltip_toggle_lang: "Change language",
        tooltip_toggle_theme: "Change theme",
        tooltip_reload: "Reload chat",
        tooltip_close: "Close chat",
        tooltip_select_mode: "Select mode",
        tooltip_select_model: "Select model",
        tooltip_toggle_menu: "Toggle menu",
        tooltip_new_chat: "Start new chat",
        tooltip_storage: "Open Storage",
        tooltip_admin: "Open Admin Panel",
        tooltip_logout: "Logout",
        tooltip_login: "Sign in",
        tooltip_login_vk: "Login with VK ID",
        tooltip_login_tg: "Login with Telegram",
        tooltip_rename_chat: "Rename chat",
        tooltip_delete_chat: "Delete chat",
        tooltip_auto_rename: "Automatically rename chat",
        tooltip_copy_text: "Copy text",
        tooltip_load_chat: "Loading...",
    }
};

const fileToDataURL = (file) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
};

const Message = ({ message, onSwipe, onAction, userPhoto, userName, t }) => {
    const msgRef = useRef(null);
    const startX = useRef(0);
    const currentX = useRef(0);
    const isDragging = useRef(false);
    const [isCopied, setIsCopied] = useState(false);
    
    // --- Локальные refs ТОЛЬКО для логики перетаскивания файла ---
    const longPressTimer = useRef(null);
    const isFileDragging = useRef(false);
    const dragGhostRef = useRef(null);
    const isLongPress = useRef(false);
    const touchStartCoords = useRef({x: 0, y: 0});


    // --- УЛУЧШЕННАЯ ЛОГИКА для Mobile Touch-n-Drag (Long Press + Drag) ---
    const cleanupMobileDrag = () => {
        clearTimeout(longPressTimer.current);
        if (dragGhostRef.current) {
            dragGhostRef.current.remove();
            dragGhostRef.current = null;
        }
        isLongPress.current = false;
        isFileDragging.current = false;
        // Удаляем глобальные слушатели
        window.removeEventListener('touchmove', handleMobileDragMove);
        window.removeEventListener('touchend', handleMobileDragEndAndDrop);
        delete window.draggedFile;
    };

    const handleTouchStartOnDraggable = (e, fileToDrag) => {
        // УБИРАЕМ stopPropagation — даем браузеру шанс показать меню
        if (isDragging.current) return;
    
        touchStartCoords.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        window.draggedFile = fileToDrag;
        isLongPress.current = false;
        isFileDragging.current = false;
        
        longPressTimer.current = setTimeout(() => {
            isLongPress.current = true;
            // ТАКТИЛЬНЫЙ ОТКЛИК: теперь ты поймешь, что драг начался
            if (navigator.vibrate) navigator.vibrate(50); 
        }, 600); // Чуть увеличили задержку для системного меню
    
        window.addEventListener('touchmove', handleMobileDragMove, { passive: false });
        window.addEventListener('touchend', handleMobileDragEndAndDrop, { once: true });
    };
    
    const handleMobileDragMove = (e) => {
        if (!window.draggedFile) return;
        const touch = e.touches[0];
        const movedX = Math.abs(touch.clientX - touchStartCoords.current.x);
        const movedY = Math.abs(touch.clientY - touchStartCoords.current.y);
    
        // Если палец двинулся ДО лонг-пресса — это скролл. Сбрасываем всё.
        if (!isLongPress.current && (movedX > 10 || movedY > 10)) {
            cleanupMobileDrag();
            return;
        }
    
        // Если лонг-пресс был и мы начали движение
        if (isLongPress.current && (movedX > 5 || movedY > 5)) {
            isFileDragging.current = true;
            e.preventDefault(); // Блокируем скролл ТОЛЬКО когда реально тащим файл
    
            if (!dragGhostRef.current) {
                const ghost = document.createElement('div');
                ghost.className = 'drag-ghost-mobile';
                ghost.innerHTML = `📎 ${window.draggedFile?.name || 'Файл'}`;
                document.body.appendChild(ghost);
                dragGhostRef.current = ghost;
            }
    
            if (dragGhostRef.current) {
                dragGhostRef.current.style.left = `${touch.clientX}px`;
                dragGhostRef.current.style.top = `${touch.clientY - 40}px`; // Сдвиг выше пальца
            }
        }
    };
    
    const handleMobileDragEndAndDrop = (e) => {
        if (isFileDragging.current && window.draggedFile) {
            const touch = e.changedTouches[0];
            
            // Магия для поиска зоны дропа
            if (dragGhostRef.current) dragGhostRef.current.style.display = 'none';
            const target = document.elementFromPoint(touch.clientX, touch.clientY);
            if (dragGhostRef.current) dragGhostRef.current.style.display = 'block';
    
            // Ищем контейнер ввода (проверяем саму зону и её родителей)
            const dropZone = target?.closest('.input-area-container');
    
            if (dropZone) {
                const dropEvent = new CustomEvent('file-dropped', { detail: window.draggedFile });
                window.dispatchEvent(dropEvent);
                if (navigator.vibrate) navigator.vibrate([30, 30]); // Двойной клик на успех
            }
        }
        cleanupMobileDrag();
    };

    const handleTouchStart = (e) => {
        // ИЗМЕНЕНИЕ: Не начинаем свайп, если касание на файле.
        // У файлов будет своя логика долгого нажатия.
        if (e.target.closest('.file-badge') || e.target.closest('[data-is-draggable="true"]')) {
            return; // Выходим, отдаем управление логике перетаскивания файла
        }
        startX.current = e.touches[0].clientX;
        isDragging.current = true;
        if (msgRef.current) msgRef.current.style.transition = 'none';
    };

    const handleTouchMove = (e) => {
        clearTimeout(longPressTimer.current); 
        if (!isDragging.current || isFileDragging.current) return;
        currentX.current = e.touches[0].clientX - startX.current;
    
        if ((message.role === 'user' && currentX.current < 0) || (message.role.startsWith('ai') && currentX.current > 0)) {
                currentX.current = 0;
            }
        if (msgRef.current) msgRef.current.style.transform = `translateX(${currentX.current}px)`;
    };

    const handleTouchEnd = () => {
        isDragging.current = false;
        if (msgRef.current) {
            msgRef.current.style.transition = 'transform 0.3s ease-out, opacity 0.3s ease-out';
            const threshold = msgRef.current.offsetWidth * 0.4;
            if (Math.abs(currentX.current) > threshold) {
                const direction = currentX.current > 0 ? 1 : -1;
                msgRef.current.style.transform = `translateX(${direction * 100}%)`;
                msgRef.current.style.opacity = '0';
                setTimeout(() => onSwipe(message.id), 300);
            } else {
                msgRef.current.style.transform = 'translateX(0)';
            }
        }
        currentX.current = 0;
    };

    // --- ЕДИНЫЙ ОБРАБОТЧИК ПЕРЕТАСКИВАНИЯ ---
    const handleDragStart = (e, fileToDrag) => {
        if (!fileToDrag) return;
        // Используем глобальную переменную, т.к. dataTransfer не может передавать объекты
        window.draggedFile = fileToDrag;
        e.dataTransfer.setData('application/x-leshiy-file', 'true');
        
        const dragIcon = document.createElement('div');
        dragIcon.innerHTML = `📎 ${fileToDrag.name}`;
        dragIcon.className = 'drag-ghost';
        document.body.appendChild(dragIcon);
        e.dataTransfer.setDragImage(dragIcon, 10, 10);
        setTimeout(() => document.body.removeChild(dragIcon), 0);
    };

    // --- ФУНКЦИИ РЕНДЕРИНГА (ИСПРАВЛЕННЫЕ) ---
    const renderFile = (file, i) => {
        const type = file.type || '';
        const name = file.name || '';
        const isImg = (type.startsWith('image/') || (file.preview && !type)) && file.preview;
        const isVid = type.startsWith('video/');
        const isAud = type.startsWith('audio/') || name.endsWith('.mp3') || name.endsWith('.ogg') || name.endsWith('.wav');
        const isZip = name.endsWith('.zip') || name.endsWith('.rar') || name.endsWith('.7z');
        const isDoc = name.endsWith('.doc') || name.endsWith('.docx') || name.endsWith('.pdf') || name.endsWith('.xls') || name.endsWith('.xlsx');
        const isDraggable = !!file.file; // Можно перетаскивать, если есть объект файла
        const fileToDrag = file.file;

        // Рисуем img только если есть живое превью
        if (isImg) return <img key={i} src={file.preview} className="uploaded-image-preview" alt={name} />;
        
        let icon = '📎'; let label = 'ФАЙЛ';
        if (isVid) { icon = '🎬'; label = 'ВИДЕО'; }
        else if (isAud) { icon = '🎵'; label = 'АУДИО'; }
        else if (isZip) { icon = '📦'; label = 'АРХИВ'; }
        else if (isDoc) { icon = '📄'; label = 'ДОК'; }
        else if (type.startsWith('image/')) { icon = '🖼️'; label = 'ФОТО'; } // Фото из истории

        return (
        <div 
            key={i} 
            className={`file-badge ${label.toLowerCase()}`}
            draggable={isDraggable}
            onDragStart={(e) => handleDragStart(e, fileToDrag)}
            onTouchStart={(e) => handleTouchStartOnDraggable(e, fileToDrag)}
            onTouchEnd={handleTouchEnd} // Единая функция завершения
            title={isDraggable ? "Перетащить, чтобы использовать снова" : name}
        >
            <span className="file-icon">{icon}</span>
            <span className="file-name">{name.length > 10 ? name.substring(0,7)+'...' : name}</span>
            <span className="file-label">{label}</span>
        </div>
        );
    };
    
    // Рендер аудио из ответа AI (генерация голоса)
    const renderGeneratedAudio = (message) => {
        if (!message.audioUrl) return null;
        const fileToDrag = message.file;
    
        return (
            <div 
                // Внедряем через Ref, как и свайп
                ref={(el) => {
                    if (el && fileToDrag) {
                        makeDraggableToFile(el, fileToDrag, (f) => {
                            handleFileSelect({ target: { files: [f] } });
                        });
                    }
                }}
                className="voice-generation-wrapper clickable-drag-zone"
                draggable={!!fileToDrag}
                onDragStart={(e) => handleDragStart(e, fileToDrag)}
                // Эти обработчики больше не нужны для мобилы, их заменит makeDraggableToFile
                // Но можно оставить для совместимости, если они не конфликтуют
                data-is-draggable="true" 
                style={{ cursor: fileToDrag ? 'grab' : 'default' }}
            >
                <div className="voice-generation-layout">
                    <div className="file-badge audio static-badge">
                        <span className="file-icon">🎙</span>
                        <span className="file-label">ГОЛОС</span>
                    </div>
    
                    <div className="audio-body-zone">
                        <audio 
                            src={message.audioUrl} 
                            controls 
                            onContextMenu={(e) => e.preventDefault()} 
                        />
                        {message.text && (
                            <p className="voice-text-caption">{message.text}</p>
                        )}
                    </div>
                </div>
            </div>
        );
    };
    
    const textToRender = message.text || message.content;
    const isUser = message.role === 'user';
    const avatarUrl = isUser ? userPhoto : '/Gemini.png';
    const showAvatar = !isUser || (isUser && !!userPhoto);
    const name = isUser ? userName : 'Leshiy-AI';

    const handleCopy = () => {
        if (!textToRender) return;
    
        // Поддержка ВК Мини Апп
        if (window.vkBridge && window.location.search.includes('vk_app_id')) {
            window.vkBridge.send('VKWebAppCopyText', { text: textToRender })
                .then(() => {
                    setIsCopied(true);
                    setTimeout(() => setIsCopied(false), 2000);
                });
            return; 
        }
    
        // Твой оригинальный код без изменений
        navigator.clipboard.writeText(textToRender).then(() => {
            setIsCopied(true);
            setTimeout(() => setIsCopied(false), 2000);
        }).catch(err => {
            console.error('Failed to copy text: ', err);
        });
    };

    return (
        <div 
            ref={msgRef} 
            className={`message-container ${message.role}`}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
        >
            <div className="bubble">
                {showAvatar && <img src={avatarUrl} className="avatar" alt="avatar" />}
                <div className="message-content">
                    <div className="user-name">{name}</div>
                    <div className="message-body">
                        {/* Сначала рендерим вложения, если они есть */}
                        {message.attachments && message.attachments.length > 0 && (
                            <div className="attachments-grid">
                                {message.attachments.map((f, i) => renderFile(f, i))}
                            </div>
                        )}

                        {/* Рендер аудио из ответа AI (генерация голоса) */}
                        {message.audioUrl && renderGeneratedAudio(message)}

                        {/* Рендерим текст. Если текста нет и нет вложений — только тогда ярлык */}
                        {!message.audioUrl && (textToRender ? (
                            <ReactMarkdown>
                                {textToRender}
                            </ReactMarkdown>
                        ) : (
                            (!message.attachments || message.attachments.length === 0) && (
                                <p className="media-msg-label">Медиафайл</p>
                            )
                        ))}

                        {/* Кнопки действий */}
                        {message.buttons && (
                            <div className="message-buttons">
                                {message.buttons.map((btn, idx) => (
                                    <button key={idx} onClick={() => onAction(btn.action)} className="menu-btn">
                                        {btn.text}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
                {!isUser && textToRender && (
                    <button className="copy-btn" onClick={handleCopy} title={t.tooltip_copy_text}>
                        {isCopied ? '✅' : (
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                            </svg>
                        )}
                    </button>
                )}
            </div>
        </div>
    );
};

const makeSwipable = (panel, onRemove, useRotation = true) => {
    let startX = 0;
    let currentX = 0;
    const threshold = 100;
    if (!panel) return () => {};
    const style = window.getComputedStyle(panel);
    const initialTransform = style.transform !== 'none' ? style.transform : '';

    const onTouchStart = (e) => {
        startX = e.touches[0].clientX;
        panel.style.transition = 'none';
    };

    const onTouchMove = (e) => {
        currentX = e.touches[0].clientX - startX;
        if (Math.abs(currentX) > 5) {
            const rotation = useRotation ? ` rotate(${currentX / 20}deg)` : '';
            panel.style.transform = initialTransform + ` translateX(${currentX}px)` + rotation;
            panel.style.opacity = 1 - (Math.abs(currentX) / 350);
        }
    };

    const onTouchEnd = () => {
        panel.style.transition = 'transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.1), opacity 0.4s';
        if (Math.abs(currentX) > threshold) {
            const direction = currentX > 0 ? 1000 : -1000;
            panel.style.transform = initialTransform + ` translateX(${direction}px)`;
            panel.style.opacity = '0';
            
            setTimeout(() => {
                if (onRemove) onRemove();
                
                panel.style.transform = initialTransform;
                panel.style.opacity = '1';
            }, 400);
        } else {
            panel.style.transform = initialTransform;
            panel.style.opacity = '1';
        }
        currentX = 0;
    };

    panel.addEventListener('touchstart', onTouchStart, { passive: true });
    panel.addEventListener('touchmove', onTouchMove, { passive: true });
    panel.addEventListener('touchend', onTouchEnd);

    return () => {
      panel.removeEventListener('touchstart', onTouchStart);
      panel.removeEventListener('touchmove', onTouchMove);
      panel.removeEventListener('touchend', onTouchEnd);
    };
};

const makeDraggableToFile = (element, file, onDropToFile) => {
    let startX = 0;
    let startY = 0;
    let ghost = null;

    const onTouchStart = (e) => {
        // Не мешаем свайпу, если это быстрый жест
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
    };

    const onTouchMove = (e) => {
        const currentX = e.touches[0].clientX;
        const currentY = e.touches[0].clientY;

        // Если сдвинули палец более чем на 15px - считаем это драгом
        if (Math.abs(currentX - startX) > 15 || Math.abs(currentY - startY) > 15) {
            if (!ghost) {
                ghost = document.createElement('div');
                ghost.id = 'mobile-drag-ghost';
                ghost.innerHTML = "🎙"; // Или иконка файла
                ghost.style.cssText = `
                    position: fixed; width: 60px; height: 60px; 
                    background: rgba(76, 175, 80, 0.9); border-radius: 50%; 
                    z-index: 10000; pointer-events: none; display: flex; 
                    align-items: center; justify-content: center; font-size: 24px;
                `;
                document.body.appendChild(ghost);
            }
            ghost.style.left = `${currentX - 30}px`;
            ghost.style.top = `${currentY - 30}px`;
        }
    };

    const onTouchEnd = (e) => {
        if (ghost) {
            const touch = e.changedTouches[0];
            // Проверяем, что под пальцем в момент отпускания
            const target = document.elementFromPoint(touch.clientX, touch.clientY);
            const isInput = target?.closest('.chat-input-container') || target?.closest('textarea');

            if (isInput && onDropToFile) {
                onDropToFile(file);
            }

            ghost.remove();
            ghost = null;
        }
    };

    element.addEventListener('touchstart', onTouchStart, { passive: true });
    element.addEventListener('touchmove', onTouchMove, { passive: false });
    element.addEventListener('touchend', onTouchEnd);

    return () => {
        element.removeEventListener('touchstart', onTouchStart);
        element.removeEventListener('touchmove', onTouchMove);
        element.removeEventListener('touchend', onTouchEnd);
    };
};

function App() {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [files, setFiles] = useState([]);
    const [theme, setTheme] = useState(localStorage.getItem('theme') || 'dark');
    const [language, setLanguage] = useState(localStorage.getItem('language') || 'ru');
    const [showAdminPanel, setShowAdminPanel] = useState(false);
    const [isStorageVisible, setStorageVisible] = useState(false);
    const [isModelSelectorOpen, setIsModelSelectorOpen] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [isRecordingFile, setIsRecordingFile] = useState(false);
    const [isNumberMode, setIsNumberMode] = useState(false);
    const [isModeMenuOpen, setIsModeMenuOpen] = useState(false);
    const [textCaseMode, setTextCaseMode] = useState('normal');
    const [currentMode, setCurrentMode] = useState(1);
    const [currentVoiceId, setCurrentVoiceId] = useState(null);

    const [userName, setUserName] = useState(localStorage.getItem('vk_user_name') || "Пользователь");
    const [userPhoto, setUserPhoto] = useState(localStorage.getItem('vk_user_photo') || "");
    const [isLoggedIn, setIsLoggedIn] = useState(!!localStorage.getItem('vk_user_id'));
    const [isAdmin, setIsAdmin] = useState(localStorage.getItem('isAdmin') === 'true');
    const [selectedVoice, setSelectedVoice] = useState(() => localStorage.getItem('selected_voice_id'));
    const [currentUserId, setCurrentUserId] = useState(localStorage.getItem('vk_user_id') || "guest");
    const [currentChatId, setCurrentChatId] = useState(null);
    const [chatList, setChatList] = useState([]);

    const chatEndRef = useRef(null);
    const fileInputRef = useRef(null);
    const chatWindowRef = useRef(null);
    const appContainerRef = useRef(null);
    const longPressTimer = useRef(null);
    const mediaRecorderRef = useRef(null);
    const audioChunksRef = useRef([]);
    const startY = useRef(0);
    const isPulled = useRef(false);
    const welcomeMessageIdRef = useRef(null);
    const textareaRef = useRef(null);
    const modelSelectorRef = useRef(null);
    const restartTimeoutRef = useRef(null);

    // --- РЕФЫ ДЛЯ РАСПОЗНАВАНИЯ РЕЧИ ---
    const recognitionRef = useRef(null);
    const wasManuallyStoppedRef = useRef(false);
    const shouldSendOnEndRef = useRef(false);
    const isSendingRef = useRef(false);
    const blockClickRef = useRef(false);
    const baseTextRef = useRef('');
    const sessionFinalTextRef = useRef('');
    const isNumberModeRef = useRef(isNumberMode);
    const textCaseModeRef = useRef(textCaseMode);

    const [, setTick] = useState(0);
    const forceUpdate = () => setTick(tick => tick + 1);
    const t = useMemo(() => TRANSLATIONS[language], [language]);
    const isVK = useMemo(() => window.location.search.includes('vk_app_id'), []);

    const punctuationMap = useMemo(() => ({
        'тчк': '.', 'точка': '.', 'зпт': ',', 'запятая': ',', 'точка с запятой': ';',
        'тире': '-', 'дефис': '-', 'минус': '-',
        'равно': '=', 'плюс': '+', 'подчёркивание': '_',
        'звёздочка': '*', 'умножить': '*', 'пробел': ' ',
        'собака': '@', 'решётка': '#', 'номер': '№',
        'доллар': '$', 'евро': '€', 'рубль': '₽', 'градус': '°',
        'процент': '%', 'проценты': '%', 'апостроф': "'", 'амперсанд': '&',
        'слэш': '/', 'обратный слэш': '\\',
        'тильда': '~', 'восклицательный знак': '!', 'вопросительный знак': '?', 'вопрос': '?',
        'двоеточие': ':', 'степень': '^',
        'многоточие': '...', 'троеточие': '...', 'вертикальная черта': '|',
        'открыть скобку': '(', 'скобка открывается': '(',
        'закрыть скобку': ')', 'скобка закрывается': ')',
        'кавычки': '"', 'открыть кавычку': '«', 'закрыть кавычку': '»',
        'кавычка открывается': '«', 'кавычка закрывается': '»',
        'знак больше': '>', 'знак меньше': '<',
        'смайлик': '🙂', 'грустный смайлик': '☹️', 'сердце': '❤️'
    }), []);

    const numberMap = useMemo(() => ({
        'раз': 1, 'ноль': 0, 'один': 1, 'два': 2, 'три': 3, 'четыре': 4, 'пять': 5,
        'шесть': 6, 'семь': 7, 'восемь': 8, 'девять': 9, 'десять': 10
    }), []);

    const applyPunctuation = useCallback((text) => {
        let processed = ` ${text} `;
        const sortedKeys = Object.keys(punctuationMap).sort((a, b) => b.length - a.length);
        sortedKeys.forEach(key => {
            const regex = new RegExp(` ${key} `, 'gi');
            processed = processed.replace(regex, ` ${punctuationMap[key]} `);
        });
        processed = processed.replace(/\s+([.,!?:;»”’)])/g, '$1');
        processed = processed.replace(/([(«“‘])\s+/g, '$1');
        return processed.replace(/^[ \t]+|[ \t]+$/g, '');
    }, [punctuationMap]);

    const convertWordsToNumbers = useCallback((text) => {
        let processed = text;
        Object.keys(numberMap).forEach(word => {
            const regex = new RegExp(`\\b${word}\\b`, 'gi');
            processed = processed.replace(regex, numberMap[word]);
        });
        return processed;
    }, [numberMap]);

    const applyCaseMode = useCallback((text, mode) => {
        if (!text) return '';
        switch (mode) {
            case 'upper':
                return text.toUpperCase();
            case 'lower':
                return text.toLowerCase();
            case 'normal':
            default:
                return text.replace(/(^|[.!?]\s+)([а-яёa-z])/g, (match, p1, p2) => p1 + p2.toUpperCase());
        }
    }, []);

    useEffect(() => {
        isNumberModeRef.current = isNumberMode;
    }, [isNumberMode]);

    useEffect(() => {
        textCaseModeRef.current = textCaseMode;
    }, [textCaseMode]);

    const [activeModels, setActiveModels] = useState({
        TEXT_TO_TEXT: localStorage.getItem('ACTIVE_MODEL_TEXT_TO_TEXT') || 'TEXT_TO_TEXT_CLOUDFLARE',
        IMAGE_TO_TEXT: localStorage.getItem('ACTIVE_MODEL_IMAGE_TO_TEXT') || 'IMAGE_TO_TEXT_CLOUDFLARE',
        AUDIO_TO_TEXT: localStorage.getItem('ACTIVE_MODEL_AUDIO_TO_TEXT') || 'AUDIO_TO_TEXT_CLOUDFLARE',
        VIDEO_TO_TEXT: localStorage.getItem('ACTIVE_MODEL_VIDEO_TO_TEXT') || 'VIDEO_TO_TEXT_CLOUDFLARE',
        TEXT_TO_AUDIO: localStorage.getItem('ACTIVE_MODEL_TEXT_TO_AUDIO') || 'TEXT_TO_AUDIO_CLOUDFLARE',
        TEXT_TO_IMAGE: localStorage.getItem('ACTIVE_MODEL_TEXT_TO_IMAGE') || 'TEXT_TO_IMAGE_CLOUDFLARE',
        IMAGE_TO_IMAGE: localStorage.getItem('ACTIVE_MODEL_IMAGE_TO_IMAGE') || 'IMAGE_TO_IMAGE_CLOUDFLARE',
    });

    const updateModel = (type, modelKey) => {
        setActiveModels(prev => ({ ...prev, [type]: modelKey }));
        const kvKey = SERVICE_TYPE_MAP[type]?.kvKey;
        if (kvKey) {
            localStorage.setItem(kvKey, modelKey);
        } else {
            console.warn(`[App] Не удалось найти kvKey для типа сервиса: ${type}`);
        }
    };

    const handleModelSelect = (modelKey) => {
        // 1. Определяем тип сервиса (TEXT_TO_TEXT, TEXT_TO_AUDIO и т.д.)
        const serviceType = LESHIY_MODES.find(m => m.id === currentMode)?.serviceType;
        if (!serviceType) return;
    
        // 2. Находим правильный ключ для записи в localStorage (e.g., "ACTIVE_MODEL_TEXT_TO_AUDIO")
        const localStorageKey = SERVICE_TYPE_MAP[serviceType]?.kvKey;
        if (!localStorageKey) return;
    
        // 3. Сохраняем выбор в localStorage
        localStorage.setItem(localStorageKey, modelKey);
    
        // 4. ИСПРАВЛЕНИЕ: Обновляем состояние React, которое слушает useMemo
        setActiveModels(prev => ({
            ...prev,
            [serviceType]: modelKey
        }));
    
        // 5. Закрываем меню
        setIsModelSelectorOpen(false);
    };
    
    useEffect(() => {
        function handleClickOutside(event) {
            // --- 1. Логика для меню РЕЖИМОВ (1, 2, 3, 4) ---
            const modeBtn = event.target.closest('.mode-switcher-container'); // кнопка вызова режимов
            const modeMenu = event.target.closest('.model-selector-container'); // само меню режимов

            if (isModeMenuOpen) {
                // Если кликнули мимо меню режимов
                if (!modeMenu && !modeBtn) {
                    setIsModeMenuOpen(false);
                }
                // ФИКС: Если кликнули по кнопке выбора МОДЕЛЕЙ (*), закрываем РЕЖИМЫ принудительно
                if (event.target.closest('.model-selector-btn')) {
                    setIsModeMenuOpen(false);
                }
            }

            // --- 2. Логика для селектора МОДЕЛЕЙ (*) ---
            const modelBtn = event.target.closest('.model-selector-btn'); // кнопка звезды
            const modelMenu = modelSelectorRef.current && modelSelectorRef.current.contains(event.target);

            if (isModelSelectorOpen) {
                // Если кликнули мимо меню моделей
                if (!modelMenu && !modelBtn) {
                    setIsModelSelectorOpen(false);
                }
                // ФИКС: Если кликнули по кнопке РЕЖИМОВ, закрываем МОДЕЛИ принудительно
                if (event.target.closest('.mode-switcher-container')) {
                    setIsModelSelectorOpen(false);
                }
            }

            // --- 3. Сайдбар ---
            const sidebarElem = document.getElementById('sidebar');
            const toggleBtn = document.getElementById('toggle-menu'); // Добавляем ссылку на кнопку

            // Если сайдбар открыт
            if (sidebarElem && !document.body.classList.contains('sidebar-collapsed')) {
                
                // ПРОВЕРКА: Если клик был НЕ по сайдбару И НЕ по кнопке открытия
                const isClickInsideSidebar = sidebarElem.contains(event.target);
                const isClickOnToggleButton = toggleBtn && toggleBtn.contains(event.target);

                if (!isClickInsideSidebar && !isClickOnToggleButton) {
                    // Только тогда закрываем
                    document.body.classList.add('sidebar-collapsed');
                    console.log("App: Сайдбар закрыт автоматическим кликом вне области");
                }
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        document.addEventListener('touchstart', handleClickOutside); // Для мобилок

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('touchstart', handleClickOutside);
        };
    }, [isModeMenuOpen, isModelSelectorOpen]);

    const fetchChats = useCallback(async () => {
        if (currentUserId && currentUserId !== "guest") {
            try {
                const response = await axios.get(
                    `${CONFIG.STORAGE_GATEWAY}/api/list-chats?userId=${currentUserId}`
                );
                setChatList(response.data || []);
            } catch (err) {
                console.error("Не удалось получить список чатов:", err);
            }
        }
    }, [currentUserId]);
    
    const onNewChatRequest = useCallback(() => {
        setCurrentChatId(null);
        setFiles([]);
        setInput('');
        localStorage.removeItem('last_chat_id');
        
        const welcomeId = Date.now();
        welcomeMessageIdRef.current = welcomeId;
        setMessages([{ id: welcomeId, role: 'ai', text: t.welcome }]);
    }, [t]);
   
    useEffect(() => {
        Object.keys(activeModels).forEach(type => {
            const config = SERVICE_TYPE_MAP[type];
            if (config && config.kvKey) {
                const storedValue = localStorage.getItem(config.kvKey);
                const defaultValue = activeModels[type]; // Значение из стейта, которое уже включает Cloudflare по умолчанию

                // Если в localStorage ничего нет, устанавливаем значение по умолчанию
                if (!storedValue) {
                    localStorage.setItem(config.kvKey, defaultValue);
                }
            }
        });
    }, []); // Пустой массив зависимостей, чтобы выполнилось один раз при монтировании

    useEffect(() => {
        const textarea = textareaRef.current;
        if (textarea) {
            textarea.style.height = 'auto';
            textarea.style.height = `${textarea.scrollHeight}px`;
        }
    }, [input]);

    useEffect(() => {
        const handleAuthSuccess = (event) => {
            const data = event.detail; 
            if (!data) return;
        
            // 1. Если пришло просто число/строка — берем как есть.
            const userId = (typeof data === 'object') ? (data.user_id || data.id) : data;
            console.log("App: Устанавливаю нормальный userId:", userId);
            if (userId) {
                setCurrentUserId(String(userId));
                
                // 1. Сначала дергаем список чатов (чтобы Сайдбар ожил)
                setTimeout(() => {
                    if (typeof fetchChats === 'function') fetchChats();
                }, 100);
        
                // 2. ВОТ ТУТ ШЛЕМ КОМАНДУ (через 500мс, чтобы всё прогрузилось)
                setTimeout(() => {
                    console.log("App: Авто-команда для ТГ/ВК: /storage");
                    window.dispatchEvent(new CustomEvent('send-bot-command', { detail: '/storage' }));
                }, 500);
            }
            if (window.handleStatusResponse) {
                window.handleStatusResponse(data);
            }
        };

        const handleBotCommand = (event) => { handleSend(event.detail); };

        const mBtn = document.getElementById('toggle-menu');
        const body = document.body;

        if (body) {
            body.classList.add('sidebar-collapsed');
        }

        const hMC = (e) => {
            e.stopPropagation();
            if (body) {
                body.classList.toggle('sidebar-collapsed');
            }
        };

        let tsX = 0;
        const hTS = (e) => { tsX = e.touches[0].clientX; };
        const hTE = (e) => {
            const teX = e.changedTouches[0].clientX;
            if (!body) return;

            if (teX - tsX > 70 && tsX < 40) {
                body.classList.remove('sidebar-collapsed');
            }

            if (tsX - teX > 70) {
                body.classList.add('sidebar-collapsed');
            }
        };
        
        const handleFocus = () => {
            if (sessionStorage.getItem('waiting_for_auth') === 'true') {
                sessionStorage.removeItem('waiting_for_auth');
                handleSend('/storage_list'); 
            }
        };

        window.addEventListener('vk-auth-success', handleAuthSuccess);
        window.addEventListener('tg-auth-success', handleAuthSuccess);
        window.addEventListener('send-bot-command', handleBotCommand);
        document.addEventListener('touchstart', hTS);
        document.addEventListener('touchend', hTE);
        window.addEventListener('focus', handleFocus);
        if (mBtn) mBtn.addEventListener('click', hMC);

        return () => {
            window.removeEventListener('vk-auth-success', handleAuthSuccess);
            window.removeEventListener('tg-auth-success', handleAuthSuccess);
            window.removeEventListener('send-bot-command', handleBotCommand);
            document.removeEventListener('touchstart', hTS);
            document.removeEventListener('touchend', hTE);
            window.removeEventListener('focus', handleFocus);
            if (mBtn) mBtn.removeEventListener('click', hMC);
        };
    }, []);

    useEffect(() => {
        window.addEventListener('sidebar-new-chat', onNewChatRequest);
    
        const lastId = localStorage.getItem('last_chat_id');
        
        if (lastId && !currentChatId) {
            onSelectChat(lastId);
        } else if (!lastId && !currentChatId) {
            onNewChatRequest();
        }
    
        return () => {
            window.removeEventListener('sidebar-new-chat', onNewChatRequest);
        };
    }, [currentUserId, onNewChatRequest]);
    
    const onSelectChat = (chatId) => {
        if (!chatId) return;
        
        localStorage.setItem('last_chat_id', chatId);
        setCurrentChatId(chatId);
        
        loadChatFromHistory(chatId);
    };

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
    }, [theme]);

    useEffect(() => {
        localStorage.setItem('language', language);
        const welcomeMessage = t.welcome;
        setMessages(prevMessages => 
            prevMessages.map(msg => 
                msg.id === welcomeMessageIdRef.current 
                    ? { ...msg, text: welcomeMessage } 
                    : msg
            )
        );
    }, [language, t]);

    const scrollToBottom = (force = false) => {
        if (force) {
            chatEndRef.current?.scrollIntoView(false);
        } else {
            chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }
    };
    
    useEffect(() => {
        if (messages.length > 0) {
            scrollToBottom();
        }
    }, [messages]);

    const handleFileUpload = async (filesToUpload) => {
        for (let file of filesToUpload) {
            setMessages(prev => [...prev, { id: Date.now(), role: 'ai', text: `${t.uploading} ${file.name}...` }]);
            try {
                const formData = new FormData();
                formData.append('file', file);
                formData.append('chat_id', currentUserId);

                await axios.post(CONFIG.STORAGE_GATEWAY, formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });

                setMessages(prev => [...prev, { id: Date.now(), role: 'ai', text: `✅ ${file.name} ${t.uploadSuccess}` }]);
            } catch (err) {
                console.error("Ошибка загрузки файла:", err);
                setMessages(prev => [...prev, { id: Date.now(), role: 'ai', text: `❌ ${t.uploadError} ${file.name}` }]);
            }
        }
    };

    const handleFileSelect = async (selectedFiles) => {
        const newFiles = Array.from(selectedFiles);
        const processedFiles = [];
        const otherFiles = [];

        for (const file of newFiles) {
            const isImage = file.type.startsWith('image/');
            const isAudio = file.type.startsWith('audio/');
            const isVideo = file.type.startsWith('video/');

            if (isImage) {
                try {
                    const dataUrl = await fileToDataURL(file);
                    processedFiles.push({
                        id: Date.now() + Math.random(),
                        file: file,
                        base64: dataUrl.split(',')[1],
                        mimeType: file.type,
                        preview: dataUrl,
                    });
                } catch (error) {
                    console.error("Ошибка конвертации изображения:", error);
                    setMessages(prev => [...prev, { id: Date.now(), role: 'ai', text: '❌ Не удалось обработать изображение.' }]);
                }
            } else if (isAudio || isVideo) {
                processedFiles.push({
                    id: Date.now() + Math.random(),
                    file: file,
                    base64: null,
                    mimeType: file.type,
                    preview: null,
                });
            } else {
                otherFiles.push(file);
            }
        }
        
        setFiles(prev => [...prev, ...processedFiles]);

        if (otherFiles.length > 0) {
            handleFileUpload(otherFiles);
        }
    };
    
    useEffect(() => {
        const handleFileDropEvent = (event) => {
            const file = event.detail;
            if (file) {
                handleFileSelect([file]);
                // Если это аудио, автоматически переключаемся в режим чата для распознавания
                if (file.type.startsWith('audio/')) {
                    setCurrentMode(1);
                }
            }
        };
        window.addEventListener('file-dropped', handleFileDropEvent);
        return () => {
            window.removeEventListener('file-dropped', handleFileDropEvent);
        };
    }, [handleFileSelect, setCurrentMode]); // Зависимости для корректной работы

    const removeFile = (fileId) => {
        setFiles(prevFiles => prevFiles.filter(f => f.id !== fileId));
    };

    const generateSmartTitle = useCallback(async (messageHistory) => {
        if (!messageHistory || messageHistory.length < 1) return null;

        try {
            const prompt = "Проанализируй этот диалог и придумай для него короткое, ёмкое название (2-4 слова). Отвечай только названием, без лишних слов, кавычек или точек.";

            const aiResponse = await askLeshiy({
                text: prompt,
                history: messageHistory,
                isSystemTask: true // Теперь этот флаг ДОЙДЕТ до логики
            });

            if (aiResponse && aiResponse.text && aiResponse.type !== 'error') {
                const cleanedTitle = aiResponse.text.replace(/["«»*.]/g, '').trim();
                if (cleanedTitle) {
                    return cleanedTitle;
                }
            }
            return null;
        } catch (e) {
            console.warn("AI Title Generation failed:", e);
            return null;
        }
    }, []);

    const syncChatHistory = useCallback(async (chatId, currentMessages, titleOverride = null) => {
        if (currentUserId === "guest") return;
        
        const payload = {
            userId: String(currentUserId),
            chatId: chatId,
            messages: currentMessages.map(m => ({
                role: m.role,
                content: m.text || m.content,
                id: m.id,
                // Сохраняем только имена, чтобы в истории было видно, ЧТО прикрепляли
                attachments: (m.attachments || []).map(a => ({
                    name: a.name,
                    type: a.type
                }))
            }))
        };

        if (titleOverride) {
            payload.chatTitle = titleOverride;
        }

        try {
            await axios.post(`${CONFIG.STORAGE_GATEWAY}/api/history`, payload);
            fetchChats();
        } catch (err) {
            console.error("Ошибка сохранения истории:", err);
        }
    }, [currentUserId, fetchChats]);

    const handleHistorySync = useCallback(async (chatId, updatedMessages) => {
        if (currentUserId === "guest") return;

        const existingChat = chatList.find(c => c.id === chatId);
        let currentTitle = existingChat ? existingChat.title : "Новый чат";

        const userMessageCount = updatedMessages.filter(m => m.role === 'user').length;
        const isDefaultTitle = !existingChat || existingChat.title === "Новый чат" || /^Чат от/.test(existingChat.title);

        if (userMessageCount >= 3 && isDefaultTitle) {
            try {
                const smartTitle = await generateSmartTitle(updatedMessages);
                if (smartTitle && smartTitle !== currentTitle) {
                    currentTitle = smartTitle;
                    setChatList(prev => prev.map(c => 
                        c.id === chatId ? { ...c, title: smartTitle } : c
                    ));
                }
            } catch (e) {
                console.error("Ошибка при генерации заголовка:", e);
            }
        }

        await syncChatHistory(chatId, updatedMessages, currentTitle);
    }, [chatList, generateSmartTitle, syncChatHistory, currentUserId]);

    const handleModeButtonClick = (e) => {
        // 1. Если это был лонг-пресс (меню только что открылось от долгого нажатия)
        // Мы предотвращаем срабатывание клика сразу после появления меню
        if (isLongPressActive.current) {
            isLongPressActive.current = false;
            return;
        }

        // Считаем количество режимов прямо из массива констант
        const totalModes = LESHIY_MODES.length;
        // 2. Переключаем режим (теперь это происходит всегда при обычном клике)
        const nextMode = currentMode < totalModes ? currentMode + 1 : 1;
        setCurrentMode(nextMode);
    
        // 3. Если меню было открыто — закрываем его после переключения
        //if (isModeMenuOpen) {
        //    setIsModeMenuOpen(false);
        //}
    };
    
    const isLongPressActive = useRef(null); // Предохранитель

    const startLongPress = () => {
        isLongPressActive.current = false; // Сбрасываем при каждом нажатии
        longPressTimer.current = setTimeout(() => {
            setIsModeMenuOpen(true);
            isLongPressActive.current = true; // Помечаем, что это БЫЛ долгий тап
            if (navigator.vibrate) navigator.vibrate(50);
        }, 600);
    };
    
    const stopLongPress = () => {
        if (longPressTimer.current) {
            clearTimeout(longPressTimer.current);
        }
    };

    const handleSend = useCallback(async (text) => {
        let userMessageText = (typeof text === 'string' ? text : input).trim();
        const currentFiles = [...files];

        if (!userMessageText && currentFiles.length > 0) {
            userMessageText = currentFiles.map(f => f.file.name).join(', ');
        }

        if (!userMessageText && currentFiles.length === 0) return;

        let chatId = currentChatId;
        if (!chatId) {
            chatId = `chat_${Date.now()}`;
            setCurrentChatId(chatId);
            localStorage.setItem('last_chat_id', chatId);
            setChatList(prev => [{ id: chatId, title: "Новый чат", lastUpdate: Date.now() }, ...prev]);
        }

        const userMsg = {
            id: Date.now(),
            role: 'user',
            text: userMessageText,
            attachments: currentFiles.map(f => ({ 
                preview: f.preview, 
                name: f.file.name, 
                url: f.url,
                type: f.file.type,
                file: f.file
            }))
        };

        const initialMessages = (messages.length === 1 && messages[0].id === welcomeMessageIdRef.current && !(typeof text === 'string'))
            ? []
            : messages;

        const historyForAi = initialMessages.map(m => ({
            role: m.role === 'user' ? 'user' : 'model',
            parts: [{ text: m.text || m.content }]
        }));

        const newMessages = [...initialMessages, userMsg];
        setMessages(newMessages);
        setIsLoading(true);
        setFiles([]);
        setInput('');

        try {
            const aiResponse = await generateLeshiy({
                text: userMessageText,
                history: historyForAi,
                userId: currentUserId,
                files: currentFiles.map(f => ({ 
                    file: f.file,
                    base64: f.base64,
                    mimeType: f.mimeType
                })),
                currentMode: currentMode,
                voiceId: currentVoiceId
            });

            const assistantMsg = {
                id: Date.now() + 1,
                role: aiResponse.type === 'error' ? 'ai error' : (aiResponse.type === 'audio' ? 'ai audio' : 'ai'),
                text: aiResponse.text,
                buttons: aiResponse.buttons,
                audioUrl: aiResponse.audioUrl,
                file: aiResponse.file 
            };

            const updatedMessages = [...newMessages, assistantMsg];
            setMessages(updatedMessages);

            handleHistorySync(chatId, updatedMessages);

        } catch (err) {
            console.error("Ошибка связи с generateLeshiy:", err);
            setMessages(prev => [...prev, {
                id: Date.now(),
                role: 'ai error',
                text: 'Произошла ошибка при обращении к ИИ.'
            }]);
        } finally {
            setIsLoading(false);
        }
    }, [files, input, currentChatId, messages, currentUserId, handleHistorySync, currentMode, currentVoiceId]);

    const handleSendRef = useRef(handleSend);
    useEffect(() => { handleSendRef.current = handleSend; }, [handleSend]);

    const [chatOffset, setChatOffset] = useState(0);
    const [hasMore, setHasMore] = useState(true);
    const [isFetchingMore, setIsFetchingMore] = useState(false);

    const loadChatFromHistory = async (chatId, isLoadMore = false) => {
        if (isLoadMore && isFetchingMore) return;

        const limit = 20;
        const currentOffset = isLoadMore ? chatOffset : 0;
    
        if (isLoadMore) {
            setIsFetchingMore(true);
        } else {
            setIsLoading(true);
        }

        const chatWindow = chatWindowRef.current;
        const oldScrollHeight = chatWindow?.scrollHeight || 0;

        try {
            const res = await axios.get(`${CONFIG.STORAGE_GATEWAY}/api/get-history`, {
                params: {
                    userId: currentUserId,
                    chatId: chatId,
                    offset: currentOffset,
                    limit: limit
                }
            });
    
            const historyMessages = res.data.messages || [];
            
            if (!isLoadMore && historyMessages.length === 0) {
                onNewChatRequest();
                return;
            }

            const serverHasMore = res.data.hasMore;
    
            const formattedMsgs = historyMessages.map(m => ({
                id: m.id || Date.now() + Math.random(),
                role: m.role,
                text: m.content || m.text,
                attachments: m.attachments || []
            }));
    
            if (isLoadMore) {
                setMessages(prev => [...formattedMsgs, ...prev]);
                
                requestAnimationFrame(() => {
                    if (chatWindow) {
                        const newScrollHeight = chatWindow.scrollHeight;
                        chatWindow.scrollTop = newScrollHeight - oldScrollHeight;
                    }
                });

            } else {
                setMessages(formattedMsgs);
                scrollToBottom(true);
            }

            setChatOffset(prev => prev + limit);
            setHasMore(serverHasMore);
            setCurrentChatId(chatId);

        } catch (e) {
            console.error("Не удалось подгрузить историю, начинаем новый чат:", e);
            if (!isLoadMore) {
                onNewChatRequest();
            }
        } finally {
            if (isLoadMore) {
                setIsFetchingMore(false);
            } else {
                setIsLoading(false);
            }
        }
    };

    const handleDeleteChat = async (chatId) => {
        if (!window.confirm("Вы уверены, что хотите удалить этот чат навсегда?")) return;
    
        setChatList(prev => prev.filter(c => c.id !== chatId));

        try {
            await axios.post(`${CONFIG.STORAGE_GATEWAY}/api/history`, {
                userId: String(currentUserId),
                chatId: chatId,
                isDeleted: true, 
                messages: []     
            });

            if (currentChatId === chatId) {
                onNewChatRequest(); 
            }
            
            fetchChats();

        } catch (e) {
            console.error("Ошибка удаления чата:", e);
            fetchChats();
        }
    };
    
    const handleRenameChat = async (chatId) => {
        const chatToRename = chatList.find(c => c.id === chatId);
        if (!chatToRename) return;
    
        const newTitle = window.prompt("Введите новое название чата:", chatToRename.title);
    
        if (newTitle && newTitle.trim() && newTitle.trim() !== chatToRename.title) {
            const trimmedTitle = newTitle.trim();
            
            try {
                const historyRes = await axios.get(`${CONFIG.STORAGE_GATEWAY}/api/get-history`, {
                    params: { userId: currentUserId, chatId: chatId, limit: 1000 }
                });
                const currentMessages = historyRes.data.messages || [];

                await syncChatHistory(chatId, currentMessages, trimmedTitle);
    
            } catch (e) {
                console.error("Ошибка переименования чата:", e);
            }
        }
    };

    const handleAutoRenameChat = async (chatId) => {
        if (!chatId || currentUserId === 'guest') return;

        try {
            const res = await axios.get(`${CONFIG.STORAGE_GATEWAY}/api/get-history`, {
                params: {
                    userId: currentUserId,
                    chatId: chatId,
                    limit: 1000 
                }
            });

            const historyMessages = res.data.messages || [];
            if (historyMessages.length === 0) {
                console.warn("Невозможно переименовать пустой чат.");
                return;
            }

            const smartTitle = await generateSmartTitle(historyMessages);

            if (smartTitle) {
                setChatList(prev => prev.map(c =>
                    c.id === chatId ? { ...c, title: smartTitle } : c
                ));
                await syncChatHistory(chatId, historyMessages, smartTitle);
                console.log(`Чат успешно переименован в: "${smartTitle}"`);
            } else {
                console.warn("Не удалось сгенерировать новое название для чата.");
            }

        } catch (e) {
            console.error("Ошибка автоматического переименования чата:", e);
        }
    };
    
    const handleMenuAction = (action) => {
        if (action.startsWith('http')) {
            window.open(action, '_blank', 'noopener,noreferrer');
            return;
        }

        if (action.startsWith('auth_')) {
            const provider = action.replace('auth_', '');
            sessionStorage.setItem('waiting_for_auth', 'true');
            window.open(`${CONFIG.STORAGE_GATEWAY}/auth/${provider}?state=${currentUserId}`, '_blank');
        } else {
            const command = action.startsWith('/') ? action : `/${action}`;
            handleSend(command); 
        }
    };

    const handleSwipeMessage = useCallback((messageId) => {
        const updatedMessages = messages.filter(msg => msg.id !== messageId);
        
        setMessages(updatedMessages);

        if (currentChatId) {
            syncChatHistory(currentChatId, updatedMessages);
        }
    }, [messages, currentChatId, syncChatHistory]);

    const handleDragOver = (e) => { e.preventDefault(); setIsDragging(true); };
    const handleDragLeave = (e) => { e.preventDefault(); setIsDragging(false); };
    const handleDrop = (e) => {
        e.preventDefault();
        setIsDragging(false);
        // 1. ПРОВЕРКА НА ПЕРЕТАСКИВАЕМОЕ АУДИО
        const isLeshiyFile = e.dataTransfer.types.includes('application/x-leshiy-file');
        if (isLeshiyFile && window.draggedFile) {
            handleFileSelect([window.draggedFile]);
            
            // Если это аудио, автоматически переключаемся в режим распознавания
            if (window.draggedFile.type.startsWith('audio/')) {
                setCurrentMode(1);
            }
            delete window.draggedFile; // Очищаем
            return;
        }

        // 2. Стандартная логика для файлов с компьютера
        if (e.dataTransfer.files.length > 0) {
            handleFileSelect(e.dataTransfer.files);
        }
    };
    const handlePaste = (e) => {
        if (e.clipboardData.files.length > 0) {
            e.preventDefault();
            handleFileSelect(e.clipboardData.files);
        }
    };

    const softReload = () => {
        setInput('');
        setFiles([]);
        setIsLoading(false);
        if (currentChatId) {
            loadChatFromHistory(currentChatId);
        } else {
            onNewChatRequest();
        }
    };
    
    useEffect(() => {
        const chatWindow = chatWindowRef.current;
    
        const handleScroll = () => {
            if (chatWindow && chatWindow.scrollTop === 0 && hasMore && !isFetchingMore) {
                loadChatFromHistory(currentChatId, true);
            }
        };
    
        if (chatWindow) {
            chatWindow.addEventListener('scroll', handleScroll);
        }
    
        return () => {
            if (chatWindow) {
                chatWindow.removeEventListener('scroll', handleScroll);
            }
        };
    }, [chatWindowRef, hasMore, isFetchingMore, currentChatId, loadChatFromHistory]);

    const handleTouchStart = (e) => {
        if (chatWindowRef.current && chatWindowRef.current.scrollTop === 0) {
            startY.current = e.touches[0].pageY;
            isPulled.current = true;
            if (appContainerRef.current) {
                appContainerRef.current.style.transition = 'none';
            }
        }
    };

    const handleTouchMove = (e) => {
        if (!isPulled.current) return;
        const currentY = e.touches[0].pageY;
        const diff = currentY - startY.current;
        if (diff > 0) {
            const pullDistance = Math.pow(diff, 0.8);
            if (appContainerRef.current) {
                appContainerRef.current.style.transform = `translateY(${pullDistance}px)`;
            }
            const ptrText = document.getElementById('ptr-text');
            if (ptrText) {
                ptrText.innerText = pullDistance > 60 ? "Отпустите для загрузки истории" : "Потяните вверх";
            }
        }
    };

    const handleTouchEnd = () => {
        if (!isPulled.current) return;
        isPulled.current = false;
        const container = appContainerRef.current;
        if (!container) return;

        container.style.transition = 'transform 0.3s';
        const matrix = window.getComputedStyle(container).transform;
        const translateY = matrix !== 'none' ? parseFloat(matrix.split(',')[5]) : 0;

        if (translateY > 80) {
            container.style.transform = 'translateY(50px)';
            const ptrText = document.getElementById('ptr-text');
            const ptrLoader = document.getElementById('ptr-loader');
            if (ptrText) ptrText.innerText = "Загрузка...";
            if (ptrLoader) ptrLoader.style.display = 'block';

            loadChatFromHistory(currentChatId, true).finally(() => {
                 setTimeout(() => {
                    container.style.transform = 'translateY(0)';
                    if (ptrLoader) ptrLoader.style.display = 'none';
                }, 500);
            });
        } else {
            container.style.transform = 'translateY(0)';
        }
    };

    const toggleTheme = () => setTheme(theme === 'light' ? 'dark' : 'light');
    const toggleLanguage = () => setLanguage(language === 'ru' ? 'en' : 'ru');
    const closeApp = () => {
        const welcomeId = Date.now();
        welcomeMessageIdRef.current = welcomeId;
        setMessages([{ id: welcomeId, role: 'ai', text: t.welcome }]);
        softReload();
    };

    useEffect(() => {
        if (currentUserId && currentUserId !== 'guest') {
            fetchChats();
        }
        
    }, [fetchChats, currentUserId]);

    useEffect(() => {
      const modalContent = document.querySelector('.storage-content');
      if (isStorageVisible && modalContent) {
        const cleanupSwipe = makeSwipable(modalContent, () => setStorageVisible(false));
        return () => {
          cleanupSwipe();
        };
      }
    }, [isStorageVisible]);

    useEffect(() => {
        const adminModal = document.querySelector('.admin-modal');
        if (showAdminPanel && adminModal) {
          const cleanupSwipe = makeSwipable(adminModal, () => setShowAdminPanel(false), true); 
          return () => {
            cleanupSwipe();
          };
        }
      }, [showAdminPanel]);

    useEffect(() => {
        const handleProfileUpdate = () => {
            setUserName(localStorage.getItem('vk_user_name') || "Пользователь");
            setUserPhoto(localStorage.getItem('vk_user_photo') || "");
            setIsLoggedIn(!!localStorage.getItem('vk_user_id'));
            setIsAdmin(localStorage.getItem('isAdmin') === 'true');
        };

        window.addEventListener('user-profile-updated', handleProfileUpdate);
        return () => window.removeEventListener('user-profile-updated', handleProfileUpdate);
    }, []);
    
    useEffect(() => {
        const handleOpenStorage = () => {
            const userId = localStorage.getItem('vk_user_id');
            if (!userId || userId === 'null') {
                alert("Сначала авторизуйтесь!");
                return;
            }
            setStorageVisible(true);
        };
    
        const handleVkAuth = () => {
            const userId = localStorage.getItem('vk_user_id');
            if (!userId || userId === 'null') {
                const overlay = document.getElementById('vk_auth_overlay');
                if (overlay) overlay.style.display = 'flex';
                handleSend('/auth_init_vk');
            }
        };

        const handleTgAuth = () => {
            const userId = localStorage.getItem('vk_user_id');
            if (!userId || userId === 'null') {
                const overlay_vk = document.getElementById('vk_auth_overlay');
                const overlay_tg = document.getElementById('tg_auth_overlay');
                
                if (overlay_vk) overlay_vk.style.display = 'none';
                if (overlay_tg) overlay_tg.style.display = 'flex';
            }
        };
  
        const handleAdminPanel = () => {
          setShowAdminPanel(true);
          };
    
        const handleLogout = () => {
            localStorage.removeItem('vk_user_id');
            localStorage.removeItem('vk_user_name');
            localStorage.removeItem('vk_user_photo');
            localStorage.removeItem('last_chat_id');
            localStorage.removeItem('isAdmin');
            localStorage.removeItem('auth_provider');
            sessionStorage.clear();
            window.location.reload();
        };
    
        window.addEventListener('sidebar-storage', handleOpenStorage);
        window.addEventListener('sidebar-vk-auth', handleVkAuth);
        window.addEventListener('sidebar-tg-auth', handleTgAuth);
        window.addEventListener('sidebar-logout', handleLogout);
        window.addEventListener('sidebar-admin-panel', handleAdminPanel);
    
        return () => {
            window.removeEventListener('sidebar-storage', handleOpenStorage);
            window.removeEventListener('sidebar-vk-auth', handleVkAuth);
            window.removeEventListener('sidebar-tg-auth', handleTgAuth);
            window.removeEventListener('sidebar-logout', handleLogout);
            window.removeEventListener('sidebar-admin-panel', handleAdminPanel);
        };
    }, []);

    const processNewLineCommands = useCallback((text) => {
        if (!text) return '';
        const newLineCommands = language === 'ru' ? ['новая строка', 'с новой строки', 'энтер'] : ['new line'];
        let processedText = ` ${text} `;
        newLineCommands.forEach(cmd => {
            const regex = new RegExp(` ${cmd} `, 'gi');
            processedText = processedText.replace(regex, '\n');
        });
        return processedText.replace(/\s*\n\s*/g, '\n');
    }, [language]);

    useEffect(() => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            console.warn("Speech Recognition API не поддерживается в этом браузере.");
            return;
        }

        const recognition = new SpeechRecognition();
        recognitionRef.current = recognition;
        
        recognition.lang = language === 'ru' ? 'ru-RU' : 'en-US';
        recognition.interimResults = true;
        recognition.continuous = false; 

        recognition.onstart = () => {
            setIsRecording(true);
            wasManuallyStoppedRef.current = false;
            shouldSendOnEndRef.current = false;
            isSendingRef.current = false;
            sessionFinalTextRef.current = ''; 
        };

        recognition.onresult = (event) => {
            let sessionInterim = '';
            let sessionFinal = '';

            for (let i = 0; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    sessionFinal += event.results[i][0].transcript;
                } else {
                    sessionInterim += event.results[i][0].transcript;
                }
            }
            
            sessionFinalTextRef.current = sessionFinal || sessionInterim;
            
            const lowerSession = (sessionFinal || sessionInterim).toLowerCase().trim();
            if (lowerSession.endsWith('цифрами') || lowerSession.endsWith('символами')) {
                setIsNumberMode(true);
                isNumberModeRef.current = true;
                recognition.stop();
                return;
            }
            if (lowerSession.endsWith('буквами') || lowerSession.endsWith('текстом')) {
                setIsNumberMode(false);
                isNumberModeRef.current = false;
                recognition.stop();
                return;
            }
            if (lowerSession.endsWith('заглавными') || lowerSession.endsWith('большими')) {
                setTextCaseMode('upper');
                textCaseModeRef.current = 'upper';
                recognition.stop();
                return;
            }
            if (lowerSession.endsWith('маленькими') || lowerSession.endsWith('строчными')) {
                setTextCaseMode('lower');
                textCaseModeRef.current = 'lower';
                recognition.stop();
                return;
            }
            if (lowerSession.endsWith('обычными') || lowerSession.endsWith('как в предложении')) {
                setTextCaseMode('normal');
                textCaseModeRef.current = 'normal';
                recognition.stop();
                return;
            }

            const sendCommands = language === 'ru' ? ['отправить', 'послать'] : ['send', 'go'];
            const clearCommands = language === 'ru' ? ['очистить', 'удалить'] : ['clear', 'delete'];
            const undoCommands = language === 'ru' ? ['исправить', 'отменить'] : ['correct', 'undo'];

            if (sendCommands.some(cmd => lowerSession.endsWith(cmd)) && !isSendingRef.current) {
                isSendingRef.current = true;
                shouldSendOnEndRef.current = true;
                recognition.stop();
                return;
            }

            if (clearCommands.some(cmd => lowerSession.endsWith(cmd))) {
                baseTextRef.current = '';
                sessionFinalTextRef.current = '';
                setInput('');
                wasManuallyStoppedRef.current = true;
                recognition.stop();
                return;
            }
            
            const undoCmd = undoCommands.find(cmd => lowerSession.endsWith(cmd));
            if (undoCmd) {
                const sessionTextBeforeCommand = sessionFinal.substring(0, sessionFinal.toLowerCase().lastIndexOf(undoCmd)).trim();

                if (sessionTextBeforeCommand) {
                    const match = sessionTextBeforeCommand.match(/\S+$/);
                    const correctedSession = match ? sessionTextBeforeCommand.substring(0, match.index).trim() : '';
                    sessionFinalTextRef.current = correctedSession;
                    const newFullText = baseTextRef.current + processNewLineCommands(correctedSession) + ' ';
                    setInput(newFullText);
                } else {
                    const base = baseTextRef.current.trim();
                    const match = base.match(/\S+$/);
                    const correctedBase = match ? base.substring(0, match.index).trim() : '';
                    baseTextRef.current = correctedBase ? correctedBase + ' ' : '';
                    sessionFinalTextRef.current = '';
                    setInput(baseTextRef.current);
                }
                
                recognition.stop();
                return;
            }
            
            let processedSession = processNewLineCommands(sessionFinal);
            processedSession = applyPunctuation(processedSession);
            if (isNumberModeRef.current) {
                processedSession = convertWordsToNumbers(processedSession);
            }
            processedSession = applyCaseMode(processedSession, textCaseModeRef.current)

            setInput(baseTextRef.current + processedSession + sessionInterim);
        };

        recognition.onend = () => {
            const serviceWords = [
                'цифрами', 'символами', 'буквами', 'текстом', 
                'заглавными', 'большими', 'маленькими', 'строчными', 'обычными', 'как в предложении'
            ];

            const processChunk = (text) => {
                let cleanPhrase = text.trim();
                let commandFound = false;

                for (const word of serviceWords) {
                    if (cleanPhrase.toLowerCase() === word) {
                        cleanPhrase = '';
                        commandFound = true;
                        break;
                    }
                }

                if (!commandFound) {
                    for (const word of serviceWords) {
                        const regex = new RegExp(`\\s+${word}$`, 'i');
                        if (regex.test(cleanPhrase)) {
                            cleanPhrase = cleanPhrase.replace(regex, '');
                            break;
                        }
                    }
                }

                if (!cleanPhrase) return '';

                let processed = processNewLineCommands(cleanPhrase);
                processed = applyPunctuation(processed);
                if (isNumberModeRef.current) {
                    processed = convertWordsToNumbers(processed);
                }
                return applyCaseMode(processed, textCaseModeRef.current);
            }

            if (shouldSendOnEndRef.current) {
                const processedText = processChunk(sessionFinalTextRef.current);
                const finalToSubmit = (baseTextRef.current + processedText).trim();
                const cleanText = finalToSubmit.replace(/(отправить|послать|send|go)\s*$/gi, '').trim();
                
                handleSendRef.current(cleanText);
                
                baseTextRef.current = '';
                sessionFinalTextRef.current = '';
                setInput('');
                setIsRecording(false);
                return;
            }

            if (sessionFinalTextRef.current) {
                const processedText = processChunk(sessionFinalTextRef.current);
                if (processedText) {
                    baseTextRef.current += processedText + (processedText.endsWith('\n') ? '' : ' ');
                }
                sessionFinalTextRef.current = '';
            }
            
            setInput(baseTextRef.current);

            if (!wasManuallyStoppedRef.current) {
                if (restartTimeoutRef.current) clearTimeout(restartTimeoutRef.current);
                restartTimeoutRef.current = setTimeout(() => {
                    try {
                        if (!wasManuallyStoppedRef.current && recognitionRef.current) {
                            recognitionRef.current.start();
                        }
                    } catch (e) {
                        console.error("Ошибка авто-перезапуска распознавания:", e);
                        setIsRecording(false);
                    }
                }, 200);
            } else {
                setIsRecording(false);
            }
        };

        recognition.onerror = (event) => {
            if (event.error === 'no-speech' && !wasManuallyStoppedRef.current) {
                recognition.stop();
            } else if (event.error !== 'aborted') {
                console.error("Ошибка распознавания речи:", event.error);
                setIsRecording(false);
            }
        };

        return () => {
            if (restartTimeoutRef.current) clearTimeout(restartTimeoutRef.current);
            if (recognitionRef.current) {
                recognitionRef.current.onend = null;
                recognitionRef.current.stop();
            }
        };
    }, [language, processNewLineCommands, applyPunctuation, convertWordsToNumbers, applyCaseMode]);       

    const handleMicClick = () => {
        if (blockClickRef.current) return;
    
        if (longPressTimer.current) clearTimeout(longPressTimer.current);
    
        if (currentMode === 3) {
            if (isRecordingFile) {
                stopVoiceLongPress();
            } else {
                startFileRecordingLogic(); 
            }
            return;
        }
    
        if (!recognitionRef.current) return;
        if (isRecording) {
            if (restartTimeoutRef.current) clearTimeout(restartTimeoutRef.current);
            wasManuallyStoppedRef.current = true;
            recognitionRef.current.stop();
        } else {
            baseTextRef.current = input ? input.trim() + ' ' : '';
            try {
                recognitionRef.current.start();
            } catch (e) {
                console.error("Не удалось начать распознавание:", e);
                setIsRecording(false);
            }
        }
    };

    const startVoiceLongPress = (e) => {
        if (e.type === 'touchstart') e.preventDefault();
    
        if (longPressTimer.current) clearTimeout(longPressTimer.current);
    
        longPressTimer.current = setTimeout(() => {
            setCurrentMode(3);
            startFileRecordingLogic();
        }, 500);
    };
    
    const startFileRecordingLogic = async () => {
        setIsRecordingFile(true); 
        if (navigator.vibrate) navigator.vibrate(50);
        
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorderRef.current = new MediaRecorder(stream);
            audioChunksRef.current = [];
    
            mediaRecorderRef.current.ondataavailable = (event) => {
                if (event.data.size > 0) audioChunksRef.current.push(event.data);
            };
    
            mediaRecorderRef.current.onstop = () => {
                if (audioChunksRef.current.length === 0) return;
    
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
                const audioFile = new File([audioBlob], `voice_${Date.now()}.wav`, { type: 'audio/wav' });
                
                setFiles(prev => [...prev, {
                    id: Date.now(),
                    file: audioFile,
                    preview: null
                }]);
    
                setIsRecordingFile(false);
                stream.getTracks().forEach(track => track.stop());
            };
    
            mediaRecorderRef.current.start();
        } catch (err) {
            console.error("Ошибка микрофона:", err);
            setIsRecordingFile(false);
        }
    };
    
    const stopVoiceLongPress = () => {
        if (longPressTimer.current) clearTimeout(longPressTimer.current);
    
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
            mediaRecorderRef.current.stop();
            setIsRecordingFile(false);
            setIsRecording(false);
            
            blockClickRef.current = true;
            setTimeout(() => { blockClickRef.current = false; }, 300);
        }
    };

    const handleVoiceChange = (voiceId) => {
        setSelectedVoice(voiceId);
        localStorage.setItem('selected_voice_id', voiceId);
    };
    
    const availableVoices = useMemo(() => {
        if (currentMode !== 3) return [];
        // Загружаем конфиг для ТЕКУЩЕЙ активной TEXT_TO_AUDIO модели
        const activeModelConfig = loadActiveModelConfig('TEXT_TO_AUDIO');
        return activeModelConfig?.voices || [];
    }, [currentMode, activeModels.TEXT_TO_AUDIO]);

    useEffect(() => {
        // Если мы в режиме аудио (3)
        if (currentMode === 3) {
            // Проверяем, есть ли доступные голоса для текущей модели
            if (availableVoices.length > 0) {
                
                // ПРОВЕРЯЕМ, ЕСТЬ ЛИ ТЕКУЩИЙ ГОЛОС В НОВОМ СПИСКЕ
                const isCurrentVoiceValid = availableVoices.some(voice => voice.id === currentVoiceId);
    
                // ЕСЛИ ГОЛОС НЕ ВАЛИДЕН (т.е. его нет в новом списке), 
                // ТОГДА мы принудительно ставим первый из нового списка.
                if (!isCurrentVoiceValid) {
                    setCurrentVoiceId(availableVoices[0].id);
                }
            } else {
                // Если для модели голосов нет, сбрасываем
                setCurrentVoiceId(null);
            }
        } else {
            // Если мы не в режиме аудио, сбрасываем
            setCurrentVoiceId(null);
        }
    }, [currentMode, availableVoices]);


    const AdminPanel = ({ onClose }) => {
        const [tempSelections, setTempSelections] = useState({});

        useEffect(() => {
            const initialSelections = {};
            for (const serviceType in SERVICE_TYPE_MAP) {
                const activeKey = getActiveModelKeyGeneric(serviceType);
                if (activeKey) {
                    initialSelections[serviceType] = activeKey;
                }
            }
            setTempSelections(initialSelections);
        }, []);

        const handleModelChange = (serviceType, modelKey) => {
            setTempSelections(prev => ({ ...prev, [serviceType]: modelKey }));
        };

        const handleApply = () => {
            for (const [serviceType, modelKey] of Object.entries(tempSelections)) {
                updateModel(serviceType, modelKey);
            }
            onClose();
        };

        return (
            <div className="admin-modal-overlay" onClick={onClose}>
                <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
                    <button onClick={onClose} className="action-btn close-btn">&times;</button>
                    <h2>Настройка AI Моделей</h2>
                    {Object.entries(AI_MODEL_MENU_CONFIG).map(([serviceType, serviceConfig]) => (
                        <div key={serviceType} className="admin-service-section">
                            <h3>{serviceConfig.name}</h3>
                            <div className="admin-buttons-container">
                                {Object.entries(serviceConfig.models).map(([modelKey, modelName]) => (
                                    <button
                                        key={modelKey}
                                        className={`admin-model-btn ${tempSelections[serviceType] === modelKey ? 'active' : ''}`}
                                        onClick={() => handleModelChange(serviceType, modelKey)}
                                    >
                                        {modelName}
                                    </button>
                                ))}
                            </div>
                        </div>
                    ))}
                    <div className="admin-modal-footer">
                        <button onClick={onClose} className="admin-footer-btn cancel">Отмена</button>
                        <button onClick={handleApply} className="admin-footer-btn save">Применить</button>
                    </div>
                </div>
            </div>
        );
    };

    const storageUrl = `${CONFIG.STORAGE_GATEWAY}/vk?vk_user_id=${currentUserId}`;

    return (
        <div className="app-wrapper">
            {document.getElementById('sidebar') && createPortal(
            <Sidebar
            t={t}
            chatList={chatList || []} 
            currentChatId={currentChatId}
            onSelectChat={onSelectChat} 
            onDeleteChat={handleDeleteChat}
            onRenameChat={handleRenameChat}
            onAutoRenameChat={handleAutoRenameChat}
            userName={userName}
            isLoggedIn={isLoggedIn}
            userPhoto={userPhoto}
            isAdmin={isAdmin}
            isVK={isVK}
            fetchChats={fetchChats}
            />,
            document.getElementById('sidebar')
          )}

        <div 
            ref={appContainerRef}
            className={`app-container ${isDragging ? 'dragging' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
        >
            {showAdminPanel && <AdminPanel onClose={() => setShowAdminPanel(false)} />}
            
            <div 
                id="storage-modal" 
                className={`storage-modal ${isStorageVisible ? 'active' : ''}`}>
                <div className="storage-content" onClick={(e) => e.stopPropagation()}>
                    <div className="storage-header">
                        <span>🗄️ Приложение "Хранилка" by Leshiy</span>
                        <button 
                            id="close-storage" 
                            className="close-btn" 
                            onClick={() => setStorageVisible(false)}>
                            &times;
                        </button>
                    </div>
                    {isStorageVisible && <iframe 
                        id="storage-frame" 
                        src={storageUrl} 
                        title="Хранилка">
                    </iframe>}
                </div>
            </div>

            <div id="pull-to-refresh">
                <div id="ptr-loader" className="loader"></div>
                <span id="ptr-text">Потяните для обновления</span>
            </div>

            {isDragging && (
                <div className="drag-drop-zone-overlay">
                    <div className="drag-drop-message">
                        <div className="drag-icon">📥</div>
                        <p>Бросайте файлы сюда</p>
                    </div>
                </div>
            )}

            <header className="top">
                <img src="/Gemini.png" alt="Gemini AI" className="logo" />
                <h1>{t.title} <span>ECOSYSTEM</span></h1>
                <div className="top-actions">
                    <button className="action-btn" title={t.tooltip_toggle_lang} onClick={toggleLanguage}>{language === 'ru' ? '🇷🇺' : '🇺🇸'}</button>
                    <button className="action-btn" title={t.tooltip_toggle_theme} onClick={toggleTheme}>{theme === 'light' ? '☀️' : '🌙'}</button>
                    <button className="action-btn" title={t.tooltip_reload} onClick={softReload}>⟳</button>
                    <button className="action-btn close-btn" title={t.tooltip_close} onClick={closeApp}>✕</button>
                </div>
            </header>

            <div className="chat-window" ref={chatWindowRef}>
                {isFetchingMore && (
                    <div className="history-loader">
                        <div className="history-loader-bar"></div>
                    </div>
                )}
                {messages.map((m) => (
                    <Message key={m.id} message={m} onSwipe={handleSwipeMessage} onAction={handleMenuAction} userPhoto={userPhoto} userName={userName} t={t} />
                ))}
                {isLoading && !isFetchingMore && <div className="message-container ai"><div className="bubble typing">{t.thinking}</div></div>}
                <div ref={chatEndRef} />
            </div>
            
            <div className="input-area-container" onPaste={handlePaste}>

                <div className="input-area">
                    {(isRecording || isRecordingFile || files.length > 0 || currentMode === 3) && (
                        <div className="file-preview-container">
                            {isRecording && (!mediaRecorderRef.current || mediaRecorderRef.current.state !== 'recording') ? (
                                <div className="voice-commands-hints">
                                    <div className="rec-indicator">
                                        <span className="rec-dot"></span>
                                        <span className="rec-label">REC</span>
                                    </div>
                                    <div className="hints-scroll">
                                        <button className="hint-btn" onClick={() => {
                                            const modes = ['normal', 'upper', 'lower'];
                                            const nextIndex = (modes.indexOf(textCaseMode) + 1) % modes.length;
                                            setTextCaseMode(modes[nextIndex]);
                                        }}>
                                            {textCaseMode === 'normal' && '🔤 Aa (Норм)'}
                                            {textCaseMode === 'upper' && '🔠 AA (ВЕРХ)'}
                                            {textCaseMode === 'lower' && '🔡 aa (низ)'}
                                        </button>
                                        <button className={`hint-btn ${isNumberMode ? 'active-mode' : ''}`} onClick={() => setIsNumberMode(prev => !prev)}>
                                            {isNumberMode ? '🔢 Цифрами' : '🔣 Буквами'}
                                        </button>
                                        <button className="hint-btn" onClick={() => {
                                            if (restartTimeoutRef.current) clearTimeout(restartTimeoutRef.current);
                                            handleSend(input);
                                            wasManuallyStoppedRef.current = true;
                                            recognitionRef.current?.stop();
                                        }}>🆗 Отправить</button>
                                        <button className="hint-btn" onClick={() => {
                                            const currentInput = input.trim();
                                            const match = currentInput.match(/\S+$/);
                                            const correctedText = match ? currentInput.substring(0, match.index).trim() : '';
                                            baseTextRef.current = correctedText ? correctedText + ' ' : '';
                                            setInput(baseTextRef.current);
                                            if (recognitionRef.current && isRecording) recognitionRef.current.stop();
                                        }}>Отменить</button>
                                        <button className="hint-btn" onClick={() => {
                                            const newValue = input + '\n';
                                            baseTextRef.current = newValue;
                                            setInput(newValue);
                                        }}>Новая строка</button>
                                        <button className="hint-btn" onClick={() => {
                                            if (restartTimeoutRef.current) clearTimeout(restartTimeoutRef.current);
                                            baseTextRef.current = '';
                                            setInput('');
                                            wasManuallyStoppedRef.current = true;
                                            recognitionRef.current?.stop();
                                        }}>Очистить</button>
                                    </div>
                                </div>
                            ) : (
                                <div className="files-list-wrapper">
                                    {isRecordingFile && (
                                        <div className="file-preview-item recording-status">
                                            <div className="rec-dot-blink">🔴</div>
                                            <span className="file-preview-name" style={{color: '#ff4444', fontSize: '10px'}}>REC</span>
                                        </div>
                                    )}
                                    {files.map(file => {
                                        const type = file.file.type || '';
                                        const name = file.file.name || '';
                                        const fileUrl = file.audioUrl || (file.file instanceof Blob ? URL.createObjectURL(file.file) : file.preview);
                                        
                                        const isImage = type.startsWith('image/');
                                        const isVideo = type.startsWith('video/');
                                        const isAudio = type.startsWith('audio/') || name.endsWith('.wav') || name.endsWith('.mp3');
                                        
                                        return (
                                            <div key={file.id} className="file-preview-item" style={{ position: 'relative' }}>
                                                {isImage && (
                                                    <img 
                                                        src={fileUrl} 
                                                        className="image-preview" 
                                                        alt="preview" 
                                                        onClick={() => {
                                                            const a = document.createElement('a');
                                                            a.href = fileUrl;
                                                            a.target = '_blank';
                                                            a.click();
                                                        }}
                                                        style={{ cursor: 'zoom-in', width: '60px', height: '60px', objectFit: 'cover', borderRadius: '4px' }}
                                                    />
                                                )}
                            
                                                {isVideo && (
                                                    <video 
                                                        src={fileUrl} 
                                                        className="video-preview" 
                                                        controls 
                                                        style={{ width: '120px', borderRadius: '8px', maxHeight: '80px' }}
                                                    />
                                                )}
                                                {isAudio && (
                                                    <div className="audio-preview-content">
                                                        <audio key={fileUrl} src={fileUrl} controls />
                                                    </div>
                                                )}
                                                {!isImage && !isVideo && !isAudio && (
                                                    <div className="file-preview-icon">
                                                        {name.endsWith('.zip') || name.endsWith('.rar') ? '📦' : 
                                                         name.endsWith('.pdf') || name.endsWith('.doc') ? '📄' : '📎'}
                                                    </div>
                                                )}
                            
                                                <button onClick={() => removeFile(file.id)} className="clear-file-btn">✕</button>
                                                <span className="file-preview-name" title={name}>{name}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}
                    
                    {currentMode === 3 && availableVoices.length > 0 && (
                        <div className="voice-selector-container">
                            <>
                            <p className="voice-selector-title">Выберите голос для озвучивания:</p>
                            <div className="hints-scroll">
                                {availableVoices.map(voice => (
                                    <button 
                                        key={voice.id} 
                                        className={`hint-btn ${currentVoiceId === voice.id ? 'active-mode' : ''}`}
                                        onClick={() => setCurrentVoiceId(voice.id)}
                                    >
                                        {voice.icon} {voice.name}
                                    </button>
                                ))}
                            </div>
                            </>
                        </div>
                    )}
                    
                    <button id="input-add-btn" className="tool-btn" title={t.tooltip_add_file} onClick={() => fileInputRef.current.click()}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14m-7-7h14"/></svg>
                    </button>
                    <textarea 
                        ref={textareaRef}
                        rows="1"
                        value={input} 
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSend(input);
                            }
                        }}
                        placeholder={t.placeholder(files)}
                    />
                    <div className="model-selector-container" style={{ position: 'relative' }}>
                        <button 
                            className={`tool-btn ${isModeMenuOpen ? 'active' : ''}`}
                            onClick={handleModeButtonClick}
                            onMouseDown={startLongPress}
                            onMouseUp={stopLongPress}
                            onMouseLeave={stopLongPress}
                            onTouchStart={startLongPress}
                            onTouchEnd={stopLongPress}
                            title={t.tooltip_select_mode}
                            style={{ fontSize: '1.2rem' }}
                        >
                            {LESHIY_MODES.find(m => m.id === currentMode)?.icon}
                        </button>

                        {isModeMenuOpen && (
                            <div className="model-selector-dropdown" style={{ bottom: '100%', left: 0, display: 'block' }}>
                                {LESHIY_MODES.map(mode => (
                                    <button
                                        key={mode.id}
                                        className={`model-option ${currentMode === mode.id ? 'active' : ''}`}
                                        onClick={() => {
                                            setCurrentMode(mode.id);
                                            setIsModeMenuOpen(false);
                                        }}
                                    >
                                        <span className="model-option-icon">{mode.icon}</span>
                                        <span className="model-option-name">{mode.name}</span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                    <div className="model-selector-container" ref={modelSelectorRef}>
                        {(() => {
                            // --- Логика для динамического выбора ---
                            // 1. Определяем тип сервиса для текущего режима (TEXT_TO_TEXT, TEXT_TO_AUDIO...)
                            const currentServiceType = LESHIY_MODES.find(m => m.id === currentMode)?.serviceType;

                            // 2. Получаем список моделей для этого сервиса
                            const availableModels = MODELS_SELECTORS[currentServiceType] || [];

                            // 3. Если моделей меньше двух, просто не показываем селектор
                            if (availableModels.length < 1) {
                                return null;
                            }

                            // 4. Находим активную модель, чтобы показать ее иконку
                            const activeModelKey = getActiveModelKeyGeneric(currentServiceType);
                            const activeModel = availableModels.find(m => m.key === activeModelKey) || availableModels[0];
                            
                            // --- Отрисовка JSX ---
                            return (
                                <>
                                    <button id="input-model-selector" className="tool-btn model-selector-btn" title={t.tooltip_select_model} onClick={() => setIsModelSelectorOpen(prev => !prev)}>
                                        {activeModel?.icon}
                                    </button>
                                    {isModelSelectorOpen && (
                                        <div className="model-selector-dropdown">
                                            {availableModels.map(model => (
                                                <button
                                                    key={model.key}
                                                    className={`model-option ${activeModelKey === model.key ? 'active' : ''}`}
                                                    onClick={() => handleModelSelect(model.key)}
                                                >
                                                    <span className="model-option-icon">{model.icon}</span>
                                                    <span className="model-option-name">{model.name}</span>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </>
                            );
                        })()}
                    </div>
                     <button 
                        id="input-mic-btn" 
                        className={`tool-btn ${isRecording || isRecordingFile ? 'recording' : ''}`} 
                        title={t.tooltip_record_voice} 
                        onClick={handleMicClick}
                        onMouseDown={startVoiceLongPress}
                        onMouseUp={stopVoiceLongPress}
                        onMouseLeave={stopVoiceLongPress}
                        onTouchStart={startVoiceLongPress}
                        onTouchEnd={stopVoiceLongPress}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3zM19 10v2a7 7 0 0 1-14 0v-2M12 19v4"/>
                        </svg>
                    </button>
                    <button className="send-btn" title={t.tooltip_send} onClick={() => handleSend(input)} disabled={isLoading || (!input.trim() && files.length === 0)}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
                    </button>
                </div>
                <div className="input-footer">
                    {t.version} {process.env.APP_VERSION} &bull; {t.author}: {process.env.APP_AUTHOR}
                </div>
            </div>

            <input 
                type="file" 
                multiple
                accept="image/*,audio/*,video/*"
                ref={fileInputRef} 
                style={{ display: 'none' }} 
                onChange={(e) => handleFileSelect(e.target.files)}
            />
        </div>
        </div>
    );
}

export default App;
