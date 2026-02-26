import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { CONFIG } from './config';
import { askLeshiy } from './leshiy-core';
import './App.css';

// --- Helper Functions ---
const fileToDataURL = (file) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
};

// --- Message Component for Swipe Logic ---
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

        // Allow swipe right for user, left for AI
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
            const threshold = msgRef.current.offsetWidth * 0.4; // 40% of width to trigger swipe

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
    
    // State for pull-to-refresh
    const [ptrState, setPtrState] = useState('idle'); // idle, pulling, refreshing

    const chatEndRef = useRef(null);
    const fileInputRef = useRef(null);
    const chatWindowRef = useRef(null); // Ref for chat window
    const appContainerRef = useRef(null); // Ref for the main container
    const startY = useRef(0); // For pull-to-refresh touch tracking

    const translations = {
        ru: {
            title: 'Leshiy-AI',
            placeholder: selectedImage ? "Теперь добавь текстовый запрос к картинке..." : "Спроси о чем-нибудь или вставь картинку (Ctrl+V)...",
            send: 'Отправить',
            upload: '📎 Выбрать файл',
            welcome: 'Привет! Я Leshiy-AI. Спрашивай, вставляй картинки, я всё могу!',
            thinking: '⏳ Gemini-AI думает...',
            uploading: '☁️ Загружаю',
            uploadSuccess: '✅ Файл успешно сохранен в экосистеме!',
            uploadError: '❌ Не удалось сохранить'
        },
        en: {
            title: 'Leshiy-AI',
            placeholder: selectedImage ? "Now add a text query to the picture..." : "Ask something or paste an image (Ctrl+V)...",
            send: 'Send',
            upload: '📎 Select file',
            welcome: 'Hi! I am Leshiy-AI. Ask, insert pictures, I can do anything!',
            thinking: '⏳ Gemini-AI is thinking...',
            uploading: '☁️ Uploading',
            uploadSuccess: '✅ File successfully saved in the ecosystem!',
            uploadError: '❌ Failed to save'
        }
    };

    const t = translations[language];

    useEffect(() => {
        setMessages([{ id: Date.now(), role: 'ai', text: t.welcome }]);
    }, []);

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
        const userMessage = input.trim();
        if (!userMessage && !selectedImage) return;

        setIsLoading(true);

        const messageToDisplay = { id: Date.now(), role: 'user', text: userMessage };
        if (selectedImage) {
            messageToDisplay.image = selectedImage.preview;
        }
        setMessages(prev => [...prev, messageToDisplay]);

        setInput('');
        setSelectedImage(null);

        try {
            const aiResponse = await askLeshiy({
                text: userMessage,
                imageBase64: selectedImage?.base64,
                mimeType: selectedImage?.mimeType,
            });

            setMessages(prev => [...prev, { id: Date.now() + 1, role: 'ai', text: aiResponse.text }]);

        } catch (err) {
            console.error("Ошибка отправки:", err);
            setMessages(prev => [...prev, { id: Date.now() + 1, role: 'ai', text: err.text || "❌ Что-то пошло не так..." }]);
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
            handleImageSelection(e.clipboardData.files);
            e.preventDefault();
        }
    };
    
    // --- Pull to Refresh Logic ---
    const handleTouchStart = (e) => {
        if (chatWindowRef.current && chatWindowRef.current.scrollTop === 0) {
            startY.current = e.touches[0].pageY;
            setPtrState('pulling');
        }
    };

    const handleTouchMove = (e) => {
        if (ptrState !== 'pulling') return;
        const currentY = e.touches[0].pageY;
        const diff = currentY - startY.current;
        if (diff > 0) {
            e.preventDefault();
            const pullDistance = Math.pow(diff, 0.85); // Creates a rubber-band effect
            if (appContainerRef.current) {
                appContainerRef.current.style.transform = `translateY(${pullDistance}px)`;
            }
            if (pullDistance > 80) { // Threshold to trigger refresh
                setPtrState('refreshing');
            }
        }
    };

    const handleTouchEnd = () => {
        if (ptrState === 'refreshing') {
            if (appContainerRef.current) {
                appContainerRef.current.style.transition = 'transform 0.3s';
                appContainerRef.current.style.transform = 'translateY(60px)';
            }
            setTimeout(() => {
                window.location.reload();
            }, 500); // Give time for the animation
        } else {
            if (appContainerRef.current) {
                appContainerRef.current.style.transition = 'transform 0.3s';
                appContainerRef.current.style.transform = 'translateY(0)';
            }
            setPtrState('idle');
        }
        startY.current = 0;
    };
    // --- End Pull to Refresh ---

    const toggleTheme = () => setTheme(theme === 'light' ? 'dark' : 'light');
    const toggleLanguage = () => setLanguage(language === 'ru' ? 'en' : 'ru');
    const uiReload = () => window.location.reload();
    const closeApp = () => window.close();

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
            <div id="pull-to-refresh">
                <div id="ptr-loader" style={{ display: ptrState === 'refreshing' ? 'block' : 'none' }}></div>
                {ptrState === 'pulling' && "Потяните для обновления"}
                {ptrState === 'refreshing' && "Обновление..."}
            </div>

            <header className="app-header">
                <img src="/Gemini.png" alt="Gemini AI" className="logo" />
                <h1>{t.title} <span>ECOSYSTEM</span></h1>
                <div className="header-actions">
                    <button className="action-btn" onClick={toggleLanguage}>{language === 'ru' ? '🇷🇺' : '🇺🇸'}</button>
                    <button className="action-btn" onClick={toggleTheme}>{theme === 'light' ? '☀️' : '🌙'}</button>
                    <button className="action-btn" onClick={uiReload}>⟳</button>
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
