
import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { CONFIG } from './config';
import { askLeshiy } from './leshiy-core';
// Correctly importing getActiveModelKey
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

// --- NEW, CORRECTED ADMIN PANEL ---
const AdminPanel = ({ onClose }) => {
    // State to hold temporary selections before applying
    const [tempSelections, setTempSelections] = useState({});

    // On component mount, load the currently saved selections from localStorage
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

    // Update temporary state when a model button is clicked
    const handleModelChange = (serviceType, modelKey) => {
        setTempSelections(prev => ({ ...prev, [serviceType]: modelKey }));
    };

    // Save the temporary selections to localStorage and close the panel
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
                                    // The 'active' class is now correctly applied based on tempSelections
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


function App() {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [selectedImage, setSelectedImage] = useState(null);
    const [theme, setTheme] = useState(localStorage.getItem('theme') || 'dark');
    const [language, setLanguage] = useState(localStorage.getItem('language') || 'ru');
    const [showAdminPanel, setShowAdminPanel] = useState(false);

    const chatEndRef = useRef(null);
    const fileInputRef = useRef(null);
    const chatWindowRef = useRef(null);
    const appContainerRef = useRef(null);
    const welcomeMessageIdRef = useRef(null);

    const translations = {
        ru: {
            title: 'Leshiy-AI',
            placeholder: selectedImage ? "Теперь добавь текстовый запрос к картинке..." : "Спроси меня о чем-нибудь...",
            send: 'Отправить',
            upload: '📎 Выбрать файл',
            welcome: 'Привет! Я Leshiy-AI. Спрашивай, вставляй картинки, я всё пойму.',
            thinking: '🤖 Думаю...',
            uploading: '☁️ Загружаю',
            uploadSuccess: '✅ Файл успешно сохранен!',
            uploadError: '❌ Не удалось сохранить',
        },
        en: {
            title: 'Leshiy-AI',
            placeholder: selectedImage ? "Now add a text query..." : "Ask me anything...",
            send: 'Send',
            upload: '📎 Select file',
            welcome: 'Hi! I am Leshiy-AI. Ask me anything, paste pictures, I will understand.',
            thinking: '🤖 Thinking...',
            uploading: '☁️ Uploading',
            uploadSuccess: '✅ File saved successfully!',
            uploadError: '❌ Failed to save',
        }
    };

    const t = translations[language];

    useEffect(() => {
        const welcomeId = Date.now();
        welcomeMessageIdRef.current = welcomeId;
        setMessages([{ id: welcomeId, role: 'ai', text: t.welcome }]);
    }, [language]); // Re-trigger welcome message on language change

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
    }, [theme]);
    
    useEffect(() => {
        localStorage.setItem('language', language);
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
            handleFileUpload(files); // Fallback to regular file upload
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
    
        // Prepare data for the core function
        const requestPayload = { text: input };
        if (selectedImage) {
            requestPayload.imageBase64 = selectedImage.base64;
            requestPayload.mimeType = selectedImage.mimeType;
        }
        
        setInput('');
        setSelectedImage(null);
    
        try {
            const aiResponse = await askLeshiy(requestPayload);
            const role = aiResponse.type === 'error' ? 'ai error' : 'ai';
            setMessages(prev => [...prev, { id: Date.now() + 1, role: role, text: aiResponse.text }]);
        } catch (err) {
            console.error("Ошибка отправки:", err);
            setMessages(prev => [...prev, { id: Date.now() + 1, role: 'ai error', text: "❌ Что-то пошло не так..." }]);
        } finally {
            setIsLoading(false);
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
            e.preventDefault();
            handleImageSelection(e.clipboardData.files);
        }
    };
    
    const softReload = () => {
        setInput('');
        setSelectedImage(null);
        setIsLoading(false);
        const welcomeId = Date.now();
        welcomeMessageIdRef.current = welcomeId;
        setMessages([{ id: welcomeId, role: 'ai', text: translations[language].welcome }]);
    };
    
    const toggleTheme = () => setTheme(theme === 'light' ? 'dark' : 'light');
    const toggleLanguage = () => setLanguage(language === 'ru' ? 'en' : 'ru');

    return (
        <div 
            ref={appContainerRef}
            className={`app-container ${isDragging ? 'dragging' : ''}`}
            onPaste={handlePaste}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        >
            {showAdminPanel && <AdminPanel onClose={() => setShowAdminPanel(false)} />}
            
            <header className="app-header">
                <img src="/leshiy-ai.png" alt="Leshiy AI" className="logo" />
                <h1>{t.title} <span>ecosystem</span></h1>
                <div className="header-actions">
                    <button className="action-btn" onClick={toggleLanguage}>{language === 'ru' ? 'RU' : 'EN'}</button>
                    <button className="action-btn" onClick={toggleTheme}>{theme === 'light' ? '☀️' : '🌙'}</button>
                    <button className="action-btn" onClick={softReload}>⟳</button>
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
                <textarea 
                    value={input} 
                    rows={1}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSend())}
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
