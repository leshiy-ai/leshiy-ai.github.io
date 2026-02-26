import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { CONFIG } from './config';
import { askLeshiy } from './leshiy-core';
import './App.css';

const fileToDataURL = (file) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
};

function App() {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [selectedImage, setSelectedImage] = useState(null);
    const [theme, setTheme] = useState(localStorage.getItem('theme') || 'dark');
    const [language, setLanguage] = useState(localStorage.getItem('language') || 'ru');

    const chatEndRef = useRef(null);
    const fileInputRef = useRef(null);

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
        setMessages([{ role: 'ai', text: t.welcome }]);
    }, []); // Пустой массив зависимостей

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
            setMessages(prev => [...prev, { role: 'ai', text: `${t.uploading} ${file.name}...` }]);
            try {
                const formData = new FormData();
                formData.append('file', file);
                formData.append('chat_id', "235663624");

                await axios.post(CONFIG.STORAGE_GATEWAY, formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });

                setMessages(prev => [...prev, { role: 'ai', text: `✅ ${file.name} ${t.uploadSuccess}` }]);
            } catch (err) {
                console.error("Ошибка загрузки файла:", err);
                setMessages(prev => [...prev, { role: 'ai', text: `❌ ${t.uploadError} ${file.name}` }]);
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
            setMessages(prev => [...prev, { role: 'ai', text: '❌ Не удалось обработать изображение.' }]);
        }
    };

    const handleSend = async () => {
        const userMessage = input.trim();
        if (!userMessage && !selectedImage) return;

        setIsLoading(true);

        const messageToDisplay = { role: 'user', text: userMessage };
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

            if (aiResponse.action === 'generate') {
                setMessages(prev => [...prev, { role: 'ai', text: `✨ Генерирую: "${aiResponse.text}"...` }]);
            } else if (aiResponse.action === 'storage') {
                 setMessages(prev => [...prev, { role: 'ai', text: `📁 Сохраняю: "${aiResponse.text}"` }]);
            } else {
                setMessages(prev => [...prev, { role: 'ai', text: aiResponse.text }]);
            }
        } catch (err) {
            console.error("Ошибка отправки:", err);
            setMessages(prev => [...prev, { role: 'ai', text: err.text || "❌ Что-то пошло не так..." }]);
        } finally {
            setIsLoading(false);
        }
    };

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

    const toggleTheme = () => setTheme(theme === 'light' ? 'dark' : 'light');
    const toggleLanguage = () => setLanguage(language === 'ru' ? 'en' : 'ru');
    const uiReload = () => window.location.reload();
    const closeApp = () => window.close();

    return (
        <div 
            className={`app-container ${isDragging ? 'dragging' : ''}`}
            onPaste={handlePaste}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        >
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

            <div className="chat-window">
                {messages.map((m, i) => (
                    <div key={i} className={`message ${m.role}`}>
                        <div className="bubble">
                            {m.image && <img src={m.image} alt="User upload" className="uploaded-image-preview" />}
                            {m.text}
                        </div>
                    </div>
                ))}
                {isLoading && <div className="message ai"><div className="bubble typing">{t.thinking}</div></div>}
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
