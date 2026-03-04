import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import { CONFIG } from './config';
import { askLeshiy } from './leshiy-core';
import { SERVICE_TYPE_MAP, AI_MODEL_MENU_CONFIG, getActiveModelKey } from './ai-config';
import './App.css';

const fileToDataURL = (file) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
};

const Message = ({ message, onSwipe, onAction }) => {
    const msgRef = useRef(null);
    const startX = useRef(0);
    const currentX = useRef(0);
    const isDragging = useRef(false);

    const handleTouchStart = (e) => {
        startX.current = e.touches[0].clientX;
        isDragging.current = true;
        if (msgRef.current) msgRef.current.style.transition = 'none';
    };

    const handleTouchMove = (e) => {
        if (!isDragging.current) return;
        currentX.current = e.touches[0].clientX - startX.current;
        if ((message.role === 'user' && currentX.current < 0) || (message.role === 'ai' && currentX.current > 0)) {
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

    // Функция для отрисовки иконок вложений
    const renderFile = (file, i) => {
        const type = file.type || '';
        const name = file.name || '';
        const isImg = type.startsWith('image/') || (file.preview && !type);
        const isVid = type.startsWith('video/');
        const isAud = type.startsWith('audio/') || name.endsWith('.mp3') || name.endsWith('.ogg') || name.endsWith('.wav');
        const isZip = name.endsWith('.zip') || name.endsWith('.rar') || name.endsWith('.7z');
        const isDoc = name.endsWith('.doc') || name.endsWith('.docx') || name.endsWith('.pdf') || name.endsWith('.xls') || name.endsWith('.xlsx');

        if (isImg) return <img key={i} src={file.preview} className="uploaded-image-preview" />;
        
        let icon = '📎'; let label = 'FILE';
        if (isVid) { icon = '🎬'; label = 'VIDEO'; }
        else if (isAud) { icon = '🎵'; label = 'AUDIO'; }
        else if (isZip) { icon = '📦'; label = 'ARCHIVE'; }
        else if (isDoc) { icon = '📄'; label = 'DOC'; }

        return (
            <div key={i} className={`file-badge ${label.toLowerCase()}`}>
                <span className="file-icon">{icon}</span>
                <span className="file-name">{name.length > 10 ? name.substring(0,7)+'...' : name}</span>
                <span className="file-label">{label}</span>
            </div>
        );
    };

    return (
        <div ref={msgRef} className={`message-container ${message.role}`} onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}>
            <div className="bubble">
                {message.attachments && <div className="attachments-grid">{message.attachments.map((f, i) => renderFile(f, i))}</div>}
                {message.text ? <ReactMarkdown>{message.text}</ReactMarkdown> : <p className="media-msg-label">Медиафайл</p>}
                {message.buttons && <div className="message-buttons">{message.buttons.map((btn, idx) => <button key={idx} onClick={() => onAction(btn.action)} className="menu-btn">{btn.text}</button>)}</div>}
            </div>
        </div>
    );
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
    
    // Динамический ID пользователя
    const [currentUserId, setCurrentUserId] = useState(localStorage.getItem('vk_user_id') || "guest");

    const chatEndRef = useRef(null);
    const fileInputRef = useRef(null);
    const chatWindowRef = useRef(null);
    const appContainerRef = useRef(null);
    const startY = useRef(0);
    const isPulled = useRef(false);
    const welcomeMessageIdRef = useRef(null);

    const translations = {
        ru: {
            title: 'Leshiy-AI',
            placeholder: files.length > 0 ? "Теперь добавь текстовый запрос к файлам..." : "Спроси меня о чем-нибудь... или вставь файл (Ctrl+V)...",
            send: 'Отправить',
            upload: '📎 Выбрать файл',
            welcome: 'Привет! Я Leshiy-AI. Спроси меня о чём угодно, подключи Хранилку и вставляй картинки или файлы прямо в поле ввода или перетягивай в чат, я всё пойму, распознаю, и сделаю!',
            thinking: '⏳ Gemini-AI думает...',
            uploading: '☁️ Загружаю',
            uploadSuccess: '✅ Файл успешно сохранен в экосистеме!',
            uploadError: '❌ Не удалось сохранить',
            admin: '👑 Админка'
        },
        en: {
            title: 'Leshiy-AI',
            placeholder: files.length > 0 ? "Now add a text query to the files..." : "Ask something or paste a file (Ctrl+V)...",
            send: 'Send',
            upload: '📎 Select file',
            welcome: 'Hi! I am Leshiy-AI. Ask me anything, connect Storage and insert pictures or files directly into the input field or drag them into the chat, I will understand everything, recognize it, and do it!',
            thinking: '⏳ Gemini-AI is thinking...',
            uploading: '☁️ Uploading',
            uploadSuccess: '✅ File successfully saved in the ecosystem!',
            uploadError: '❌ Failed to save',
            admin: '👑 Admin'
        }
    };

    const t = translations[language];

    // Инициализация и слушатели событий
    useEffect(() => {
        const welcomeId = Date.now();
        welcomeMessageIdRef.current = welcomeId;
        setMessages([{ id: welcomeId, role: 'ai', text: t.welcome }]);

        // Слушаем успешную авторизацию из main.jsx
        const handleAuthSuccess = (event) => {
            const data = event.detail; 
            if (!data) return;
        
            // 1. Определяем ID (может быть объектом или просто строкой/числом)
            const userId = (typeof data === 'object') ? (data.vk_user_id || data.id) : data;
            setCurrentUserId(userId);
        
            // 2. Если пришел объект (с сервера) — прокидываем его целиком
            if (typeof data === 'object') {
                if (window.handleStatusResponse) {
                    window.handleStatusResponse(data);
                }
            } 
            // 3. Если пришло только ID (строка), собираем данные из памяти и обновляем UI
            else {
                const savedData = { 
                    vk_user_id: userId, 
                    userName: localStorage.getItem('vk_user_name'), 
                    userPhoto: localStorage.getItem('vk_user_photo') 
                };
                if (window.handleStatusResponse) {
                    window.handleStatusResponse(savedData);
                }
            }
        };

        const handleBotCommand = (event) => { handleSend(event.detail); };

        // --- SIDEBAR COLLAPSE LOGIC ---
        const mBtn = document.getElementById('toggle-menu');
        const body = document.body;

        // Set initial state to collapsed
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
            // Swipe right to open
            if (teX - tsX > 70 && tsX < 40) {
                body.classList.remove('sidebar-collapsed');
            }
            // Swipe left to close
            if (tsX - teX > 70) {
                body.classList.add('sidebar-collapsed');
            }
        };

        window.addEventListener('vk-auth-success', handleAuthSuccess);
        window.addEventListener('send-bot-command', handleBotCommand);
        document.addEventListener('touchstart', hTS);
        document.addEventListener('touchend', hTE);
        if (mBtn) mBtn.addEventListener('click', hMC);

        return () => {
            window.removeEventListener('vk-auth-success', handleAuthSuccess);
            window.removeEventListener('send-bot-command', handleBotCommand);
            document.removeEventListener('touchstart', hTS);
            document.removeEventListener('touchend', hTE);
            if (mBtn) mBtn.removeEventListener('click', hMC);
        };
    }, []);

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
    }, [theme]);

    useEffect(() => {
        localStorage.setItem('language', language);
        const welcomeMessage = translations[language].welcome;
        setMessages(prevMessages => 
            prevMessages.map(msg => 
                msg.id === welcomeMessageIdRef.current 
                    ? { ...msg, text: welcomeMessage } 
                    : msg
            )
        );
    }, [language]);

    const scrollToBottom = () => {
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(scrollToBottom, [messages]);

    const handleFileUpload = async (filesToUpload) => {
        for (let file of filesToUpload) {
            setMessages(prev => [...prev, { id: Date.now(), role: 'ai', text: `${t.uploading} ${file.name}...` }]);
            try {
                const formData = new FormData();
                formData.append('file', file);
                // Используем текущий ID вместо хардкода
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
    
    const removeFile = (fileId) => {
        setFiles(prevFiles => prevFiles.filter(f => f.id !== fileId));
    };

    const handleSend = async (commandOverride) => {
        const rawText = typeof commandOverride === 'string' ? commandOverride : input;
        const userMessageText = rawText.trim();
        if (userMessageText.toLowerCase() === '/admin') { setShowAdminPanel(true); setInput(''); return; }
        if (!userMessageText && files.length === 0) return;
    
        setIsLoading(true);
        const messageId = Date.now();
        const currentFiles = [...files];
    
        // Формируем вложения для истории чата
        const attachments = currentFiles.map(f => ({
            preview: f.preview, // будет null для не-картинок
            name: f.file.name,
            type: f.file.type,
            size: f.file.size
        }));
    
        setMessages(prev => [...prev, { 
            id: messageId, 
            role: 'user', 
            text: userMessageText,
            attachments: attachments // Теперь тут ВСЕ файлы
        }]);
    
        setInput(''); setFiles([]);
    
        try {
            const aiResponse = await askLeshiy({ text: userMessageText, files: currentFiles, userId: currentUserId });
            setMessages(prev => [...prev, { 
                id: Date.now() + 1, 
                role: aiResponse.type === 'error' ? 'ai error' : 'ai', 
                text: aiResponse.text,
                buttons: aiResponse.buttons 
            }]);
        } catch (err) {
            setMessages(prev => [...prev, { id: Date.now(), role: 'ai error', text: 'Произошла ошибка при обращении к лешему.' }]);
        } finally { setIsLoading(false); }
    };

    const handleMenuAction = (action) => {
        if (action.startsWith('http')) {
            window.open(action, '_blank', 'noopener,noreferrer');
            return;
        }

        if (action.startsWith('auth_')) {
            const provider = action.replace('auth_', '');
            sessionStorage.setItem('waiting_for_auth', 'true'); // Ставим метку
            // Используем актуальный ID
            window.open(`${CONFIG.STORAGE_GATEWAY}/auth/${provider}?state=${currentUserId}`, '_blank');
        } else {
            const command = action.startsWith('/') ? action : `/${action}`;
            handleSend(command); 
        }
    };

    window.addEventListener('focus', () => {
        // Если в сессии висит флаг, что мы уходили на авторизацию
        if (sessionStorage.getItem('waiting_for_auth') === 'true') {
            sessionStorage.removeItem('waiting_for_auth');
            // Автоматически отправляем команду на получение папок
            handleSend('/storage_list'); 
        }
    }, { once: false });

    const handleSwipeMessage = useCallback((messageId) => {
        setMessages(prevMessages => prevMessages.filter(msg => msg.id !== messageId));
    }, []);

    const handleDragOver = (e) => { e.preventDefault(); setIsDragging(true); };
    const handleDragLeave = (e) => { e.preventDefault(); setIsDragging(false); };
    const handleDrop = (e) => {
        e.preventDefault();
        setIsDragging(false);
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
    };
    
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
            e.preventDefault();
            const pullDistance = Math.pow(diff, 0.8);
            if (appContainerRef.current) {
                appContainerRef.current.style.transform = `translateY(${pullDistance}px)`;
            }
            const ptrText = document.getElementById('ptr-text');
            if (ptrText) {
                ptrText.innerText = pullDistance > 60 ? "Отпустите для обновления" : "Потяните для обновления";
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

        if (translateY > 60) {
            container.style.transform = 'translateY(60px)';
            const ptrText = document.getElementById('ptr-text');
            const ptrLoader = document.getElementById('ptr-loader');
            if (ptrText) ptrText.innerText = "Обновление...";
            if (ptrLoader) ptrLoader.style.display = 'block';

            setTimeout(() => {
                softReload();
                container.style.transform = 'translateY(0)';
                setTimeout(() => {
                    if (ptrLoader) ptrLoader.style.display = 'none';
                }, 300);
            }, 1000);
        } else {
            container.style.transform = 'translateY(0)';
        }
    };

    const toggleTheme = () => setTheme(theme === 'light' ? 'dark' : 'light');
    const toggleLanguage = () => setLanguage(language === 'ru' ? 'en' : 'ru');
    const closeApp = () => {
        const welcomeId = Date.now();
        welcomeMessageIdRef.current = welcomeId;
        setMessages([{ id: welcomeId, role: 'ai', text: translations[language].welcome }]);
        softReload();
    };

    const AdminPanel = ({ onClose }) => {
        const [tempSelections, setTempSelections] = useState({});

        useEffect(() => {
            const initialSelections = {};
            for (const serviceType in SERVICE_TYPE_MAP) {
                const activeKey = getActiveModelKey(serviceType);
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
                const kvKey = SERVICE_TYPE_MAP[serviceType]?.kvKey;
                if (kvKey && modelKey) {
                    localStorage.setItem(kvKey, modelKey);
                }
            }
            onClose();
        };

        return (
            <div className="admin-modal-overlay" onClick={onClose}>
                <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
                    <h2>AI Model Configuration</h2>
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

    return (
        <div 
            ref={appContainerRef}
            className={`app-container ${isDragging ? 'dragging' : ''}`}
            onPaste={handlePaste}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
        >
            {showAdminPanel && <AdminPanel onClose={() => setShowAdminPanel(false)} />}
            <div id="pull-to-refresh">
                <div id="ptr-loader" className="loader"></div>
                <span id="ptr-text">Потяните для обновления</span>
            </div>

            <header className="top">
                <img src="/Gemini.png" alt="Gemini AI" className="logo" />
                <h1>{t.title} <span>ECOSYSTEM</span></h1>
                <div className="top-actions">
                    <button className="action-btn" onClick={toggleLanguage}>{language === 'ru' ? '🇷🇺' : '🇺🇸'}</button>
                    <button className="action-btn" onClick={toggleTheme}>{theme === 'light' ? '☀️' : '🌙'}</button>
                    <button className="action-btn" onClick={softReload}>⟳</button>
                    <button className="action-btn close-btn" onClick={closeApp}>✕</button>
                </div>
            </header>

            <div className="chat-window" ref={chatWindowRef}>
                {messages.map((m) => (
                    <Message key={m.id} message={m} onSwipe={handleSwipeMessage} onAction={handleMenuAction} />
                ))}
                {isLoading && <div className="message-container ai"><div className="bubble typing">{t.thinking}</div></div>}
                <div ref={chatEndRef} />
            </div>
            <div className="input-area">
                {files.length > 0 && (
                    <div className="file-preview-container">
                    {files.map(file => {
                        const type = file.file.type;
                        const name = file.file.name;
                        // Определяем иконку
                        let icon = '📎';
                        if (type.startsWith('video/')) icon = '🎬';
                        else if (type.startsWith('audio/') || name.endsWith('.mp3')) icon = '🎵';
                        else if (name.endsWith('.zip') || name.endsWith('.rar')) icon = '📦';
                        else if (name.endsWith('.pdf') || name.endsWith('.doc') || name.endsWith('.docx')) icon = '📄';
                
                        return (
                            <div key={file.id} className="file-preview-item">
                                {file.preview ? (
                                    <img src={file.preview} className="image-preview" />
                                ) : (
                                    <div className="file-preview-icon">{icon}</div>
                                )}
                                <button onClick={() => removeFile(file.id)} className="clear-file-btn">✕</button>
                                <span className="file-preview-name">{name}</span>
                            </div>
                        );
                    })}
                </div>
                )}
                <input 
                    value={input} 
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                    placeholder={t.placeholder}
                />
                <button className="send-btn" onClick={() => handleSend()} disabled={isLoading}>{t.send}</button>
            </div>

            <input 
                type="file" 
                multiple
                accept="image/*,audio/*,video/*"
                ref={fileInputRef} 
                style={{ display: 'none' }} 
                onChange={(e) => handleFileSelect(e.target.files)}
            />
            <button className="upload-btn" onClick={() => fileInputRef.current.click()}>
                {t.upload}
            </button>
        </div>
    );
}

export default App;
