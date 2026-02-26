import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { CONFIG } from './config';
import { askLeshiy } from './leshiy-core';
import { AI_MODELS, SERVICE_TYPE_MAP, AI_MODEL_MENU_CONFIG, loadActiveConfig } from './ai-config';
import './App.css';

const fileToDataURL = (file) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
};

const Message = ({ message, onSwipe }) => {
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
                {message.image && <img src={message.image} alt="User upload" className="uploaded-image-preview" />}
                {message.text}
            </div>
        </div>
    );
};


function App() {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [selectedImage, setSelectedImage] = useState(null);
    const [theme, setTheme] = useState(localStorage.getItem('theme') || 'dark');
    const [language, setLanguage] = useState(localStorage.getItem('language') || 'ru');
    const [ptrState, setPtrState] = useState('idle');
    const [isAdmin, setIsAdmin] = useState(true); // Default to true for now
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
            placeholder: selectedImage ? "Теперь добавь текстовый запрос к картинке..." : "Спроси меня о чем-нибудь... или вставь картинку (Ctrl+V)...",
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
            placeholder: selectedImage ? "Now add a text query to the picture..." : "Ask something or paste an image (Ctrl+V)...",
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

    const handleFileUpload = async (files) => {
        for (let file of files) {
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

    const handleImageSelection = async (files) => {
        const imageFile = Array.from(files).find(file => file.type.startsWith('image/'));
        if (!imageFile) {
            handleFileUpload(files);
            return;
        }

        try {
            const dataUrl = await fileToDataURL(imageFile);
            const base64 = dataUrl.split(',')[1];
            setSelectedImage({
                file: imageFile,
                base64: base64,
                mimeType: imageFile.type,
                preview: dataUrl,
            });
        } catch (error) {
            console.error("Ошибка конвертации изображения:", error);
            setMessages(prev => [...prev, { id: Date.now(), role: 'ai', text: '❌ Не удалось обработать изображение.' }]);
        }
    };

    const handleSend = async () => {
        if (input.trim().toLowerCase() === '/admin') {
            setShowAdminPanel(true);
            setInput('');
            return;
        }
        const userMessage = input.trim();
        if (!userMessage && !selectedImage) return;
    
        setIsLoading(true);
    
        const messageToDisplay = { id: Date.now(), role: 'user', text: userMessage };
        if (selectedImage) {
            messageToDisplay.image = selectedImage.preview;
        }
        setMessages(prev => [...prev, messageToDisplay]);
    
        const imageToProcess = selectedImage;
        const textToProcess = input;
    
        setInput('');
        setSelectedImage(null);
    
        if (imageToProcess) {
            const lowerCaseMessage = textToProcess.toLowerCase();
    
            if (lowerCaseMessage.startsWith('сохрани')) {
                let path = '';
                if (lowerCaseMessage.startsWith('сохрани в ')) {
                    path = textToProcess.substring('сохрани в '.length).trim();
                }
    
                setMessages(prev => [...prev, { id: Date.now(), role: 'ai', text: `${t.uploading} ${imageToProcess.file.name}...` }]);
    
                try {
                    const formData = new FormData();
                    formData.append('file', imageToProcess.file);
                    formData.append('chat_id', "235663624");
                    if (path) {
                        formData.append('path', path);
                    }
    
                    await axios.post(CONFIG.STORAGE_GATEWAY, formData, {
                        headers: { 'Content-Type': 'multipart/form-data' }
                    });
    
                    let successMsg = `✅ ${imageToProcess.file.name} ${t.uploadSuccess}`;
                    if (path) {
                        successMsg += ` в "${path}"`;
                    }
                    setMessages(prev => [...prev, { id: Date.now() + 1, role: 'ai', text: successMsg }]);
    
                } catch (err) {
                    console.error("Ошибка загрузки файла:", err);
                    setMessages(prev => [...prev, { id: Date.now() + 1, role: 'ai', text: `❌ ${t.uploadError} ${imageToProcess.file.name}` }]);
                } finally {
                    setIsLoading(false);
                }
    
            } else {
                try {
                    const aiResponse = await askLeshiy({
                        text: textToProcess,
                        imageBase64: imageToProcess.base64,
                        mimeType: imageToProcess.mimeType,
                    });
                    setMessages(prev => [...prev, { id: Date.now() + 1, role: 'ai', text: aiResponse.text }]);
                } catch (err) {
                    console.error("Ошибка отправки:", err);
                    setMessages(prev => [...prev, { id: Date.now() + 1, role: 'ai', text: err.text || "❌ Что-то пошло не так..." }]);
                } finally {
                    setIsLoading(false);
                }
            }
        } else {
            try {
                const aiResponse = await askLeshiy({ text: textToProcess });
                setMessages(prev => [...prev, { id: Date.now() + 1, role: 'ai', text: aiResponse.text }]);
            } catch (err) {
                console.error("Ошибка отправки:", err);
                setMessages(prev => [...prev, { id: Date.now() + 1, role: 'ai', text: err.text || "❌ Что-то пошло не так..." }]);
            } finally {
                setIsLoading(false);
            }
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
            handleImageSelection(e.dataTransfer.files);
        }
    };
    const handlePaste = (e) => {
        if (e.clipboardData.files.length > 0) {
            handleImageSelection(e.target.files);
            e.preventDefault();
        }
    };

    const softReload = () => {
        setInput('');
        setSelectedImage(null);
        setIsLoading(false);
    };
    
    const handleTouchStart = (e) => {
        if (chatWindowRef.current && chatWindowRef.current.scrollTop === 0) {
            startY.current = e.touches[0].pageY;
            isPulled.current = true;
            appContainerRef.current.style.transition = 'none';
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
            if (pullDistance > 60) {
                ptrText.innerText = "Отпустите для обновления";
            } else {
                ptrText.innerText = "Потяните для обновления";
            }
        }
    };

    const handleTouchEnd = () => {
        if (!isPulled.current) return;
        isPulled.current = false;
        const container = appContainerRef.current;
        container.style.transition = 'transform 0.3s';
        const matrix = window.getComputedStyle(container).transform;
        const translateY = matrix !== 'none' ? parseFloat(matrix.split(',')[5]) : 0;

        if (translateY > 60) {
            container.style.transform = 'translateY(60px)';
            const ptrText = document.getElementById('ptr-text');
            const ptrLoader = document.getElementById('ptr-loader');
            ptrText.innerText = "Обновление...";
            ptrLoader.style.display = 'block';
            setTimeout(() => {
                softReload();
                container.style.transform = 'translateY(0)';
                setTimeout(() => {
                    ptrLoader.style.display = 'none';
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

    const AdminPanel = () => {
        const [currentModels, setCurrentModels] = useState({});

        useEffect(() => {
            const initialModels = {};
            for (const serviceType in SERVICE_TYPE_MAP) {
                const storedModel = localStorage.getItem(SERVICE_TYPE_MAP[serviceType].kvKey);
                if (storedModel) {
                    initialModels[serviceType] = storedModel;
                } else {
                    initialModels[serviceType] = Object.keys(AI_MODEL_MENU_CONFIG[serviceType].models)[0];
                }
            }
            setCurrentModels(initialModels);
        }, []);

        const handleModelChange = (serviceType, modelKey) => {
            localStorage.setItem(SERVICE_TYPE_MAP[serviceType].kvKey, modelKey);
            setCurrentModels(prev => ({...prev, [serviceType]: modelKey}));
        };

        return (
            <div className="admin-modal-overlay" onClick={() => setShowAdminPanel(false)}>
                <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
                    <h2>AI Model Configuration</h2>
                    {Object.entries(AI_MODEL_MENU_CONFIG).map(([serviceType, serviceConfig]) => (
                        <div key={serviceType} className="admin-service-section">
                            <h3>{serviceConfig.name}</h3>
                            <div className="admin-buttons-container">
                                {Object.entries(serviceConfig.models).map(([modelKey, modelName]) => (
                                    <button
                                        key={modelKey}
                                        className={`admin-model-btn ${currentModels[serviceType] === modelKey ? 'active' : ''}`}
                                        onClick={() => handleModelChange(serviceType, modelKey)}
                                    >
                                        {modelName}
                                    </button>
                                ))}
                            </div>
                        </div>
                    ))}
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
            {showAdminPanel && <AdminPanel />}
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
                    <Message key={m.id} message={m} onSwipe={handleSwipeMessage} />
                ))}
                {isLoading && <div className="message-container ai"><div className="bubble typing">{t.thinking}</div></div>}
                <div ref={chatEndRef} />
            </div>

            <div className="input-area">
                {selectedImage && (
                    <div className="image-preview-container">
                        <img src={selectedImage.preview} alt="Preview" className="image-preview" />
                        <button onClick={() => setSelectedImage(null)} className="clear-image-btn">❌</button>
                    </div>
                )}
                <input 
                    value={input} 
                    onChange={(e) => setInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                    placeholder={t.placeholder}
                />
                <button onClick={handleSend} disabled={isLoading}>{t.send}</button>
            </div>

            <input 
                type="file" 
                multiple
                accept="image/*,application/*,text/*"
                ref={fileInputRef} 
                style={{ display: 'none' }} 
                onChange={(e) => handleImageSelection(e.target.files)}
            />
            <button className="upload-btn" onClick={() => fileInputRef.current.click()}>
                {t.upload}
            </button>
        </div>
    );
}

export default App;
