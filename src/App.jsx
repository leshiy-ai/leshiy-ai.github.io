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
        if (msgRef.current) {
            msgRef.current.style.transition = 'none';
        }
    };

    const handleTouchMove = (e) => {
        if (!isDragging.current) return;
        currentX.current = e.touches[0].clientX - startX.current;

        if ((message.role === 'user' && currentX.current < 0) || (message.role === 'ai' && currentX.current > 0)) {
            currentX.current = 0;
        }

        if (msgRef.current) {
            msgRef.current.style.transform = `translateX(${currentX.current}px)`;
        }
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

    return (
        <div
            ref={msgRef}
            className={`message-container ${message.role}`}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
        >
            <div className="bubble">
                {message.images && message.images.length > 0 && (
                    <div className="image-previews-container">
                        {message.images.map((imgSrc, index) => (
                            <img key={index} src={imgSrc} alt={`User upload ${index + 1}`} className="uploaded-image-preview" />
                        ))}
                    </div>
                )}
                {message.text && <ReactMarkdown>{message.text}</ReactMarkdown>}
                
                {message.buttons && (
                    <div className="message-buttons">
                        {message.buttons.map((btn, idx) => (
                            <button 
                                key={idx} 
                                onClick={() => onAction(btn.action)}
                                className="menu-btn"
                            >
                                {btn.text}
                            </button>
                        ))}
                    </div>
                )}
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
            welcome: 'Привет! Я Leshiy-AI. Спроси меня о чём угодно, вставляй картинки или файлы прямо в поле ввода или перетягивай в чат, я всё пойму, распознаю, и сделаю!',
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
            welcome: 'Hi! I am Leshiy-AI. Ask me anything, insert pictures or files directly into the input field or drag them into the chat, I will understand everything, recognize it, and do it!',
            thinking: '⏳ Gemini-AI is thinking...',
            uploading: '☁️ Uploading',
            uploadSuccess: '✅ File successfully saved in the ecosystem!',
            uploadError: '❌ Failed to save',
            admin: '👑 Admin'
        }
    };

    const t = translations[language];

    useEffect(() => {
        const welcomeId = Date.now();
        welcomeMessageIdRef.current = welcomeId;
        setMessages([{ id: welcomeId, role: 'ai', text: t.welcome }]);
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
                formData.append('chat_id', "235663624");

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
        const textToSend = typeof commandOverride === 'string' ? commandOverride : input;
        const userMessage = textToSend.trim();

        if (userMessage.toLowerCase() === '/admin') {
            setShowAdminPanel(true);
            setInput('');
            return;
        }

        if (!userMessage && files.length === 0) return;

        setIsLoading(true);

        const messageId = Date.now();
        setMessages(prev => [...prev, { 
            id: messageId, 
            role: 'user', 
            text: userMessage,
            images: files.filter(f => f.preview).map(f => f.preview)
        }]);

        const requestPayload = { 
            text: userMessage,
            files: files 
        };

        if (typeof commandOverride !== 'string') {
            setInput('');
            setFiles([]);
        }

        try {
            const aiResponse = await askLeshiy(requestPayload);
            
            setMessages(prev => [...prev, { 
                id: Date.now() + 1, 
                role: aiResponse.type === 'error' ? 'ai error' : 'ai', 
                text: aiResponse.text,
                buttons: aiResponse.buttons
            }]);
        } catch (err) {
            console.error("Ошибка отправки:", err);
            setMessages(prev => [...prev, { 
                id: Date.now() + 1, 
                role: 'ai error', 
                text: "❌ Связь с экосистемой прервана..." 
            }]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleMenuAction = (action) => {
        if (action.startsWith('auth_')) {
            const provider = action.replace('auth_', '');
            window.open(`${CONFIG.STORAGE_GATEWAY}/auth/${provider}?user_id=235663624`, '_blank');
        } else {
            handleSend(`/${action}`); 
        }
    };
    
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

            <header className="app-header">
                <img src="/Gemini.png" alt="Gemini AI" className="logo" />
                <h1>{t.title} <span>ECOSYSTEM</span></h1>
                <div className="header-actions">
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
                       {files.map(file => (
                            <div key={file.id} className="file-preview-item">
                                {file.preview ? <img src={file.preview} className="image-preview" /> : <span>📎</span>}
                                <button onClick={() => removeFile(file.id)} className="clear-file-btn">✕</button>
                            </div>
                        ))}
                    </div>
                )}
                <input 
                    value={input} 
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                    placeholder={t.placeholder}
                />
                <button onClick={() => handleSend()} disabled={isLoading}>{t.send}</button>
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
