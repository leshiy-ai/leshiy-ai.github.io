import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { CONFIG } from './config';
import { askLeshiy } from './leshiy-core';
import './App.css';

// Helper to convert file to Base64
const fileToDataURL = (file) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
};

function App() {
    const [messages, setMessages] = useState([
        { role: 'ai', text: 'Привет! Я Leshiy-AI. Спрашивай, вставляй картинки, я всё могу!' }
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    
    // State for the selected image file and its Base64 representation
    const [selectedImage, setSelectedImage] = useState(null); 

    const chatEndRef = useRef(null);
    const fileInputRef = useRef(null);

    const scrollToBottom = () => {
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(scrollToBottom, [messages]);

    // Uploader for non-image files to your storage worker
    const handleFileUpload = async (files) => {
        for (let file of files) {
            setMessages(prev => [...prev, { role: 'ai', text: `☁️ Загружаю ${file.name}...` }]);
            try {
                const formData = new FormData();
                formData.append('file', file);
                formData.append('chat_id', "235663624"); // Your user ID

                await axios.post(CONFIG.STORAGE_GATEWAY, formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });

                setMessages(prev => [...prev, { role: 'ai', text: `✅ Файл ${file.name} успешно сохранен в экосистеме!` }]);
            } catch (err) {
                console.error("Ошибка загрузки файла:", err);
                setMessages(prev => [...prev, { role: 'ai', text: `❌ Не удалось сохранить ${file.name}` }]);
            }
        }
    };
    
    // Handler for image selection (drag-drop, paste, click)
    const handleImageSelection = async (files) => {
        const imageFile = Array.from(files).find(file => file.type.startsWith('image/'));
        if (!imageFile) {
            // If it's not an image, use the old file upload logic
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

    const handleSend = async () => {
        const userMessage = input.trim();
        if (!userMessage && !selectedImage) return;

        setIsLoading(true);

        // Prepare user message for display
        const messageToDisplay = { role: 'user', text: userMessage };
        if (selectedImage) {
            messageToDisplay.image = selectedImage.preview;
        }
        setMessages(prev => [...prev, messageToDisplay]);

        // Clear inputs
        setInput('');
        setSelectedImage(null);

        try {
            // Call the core AI function with text and/or image
            const aiResponse = await askLeshiy({
                text: userMessage,
                imageBase64: selectedImage?.base64,
                mimeType: selectedImage?.mimeType,
            });

            // Handle actions or simple text responses
            if (aiResponse.action === 'generate') {
                // The generate function is not yet refactored, so we call it separately
                // In the future, this could be unified
                setMessages(prev => [...prev, { role: 'ai', text: `✨ Генерирую: "${aiResponse.text}"...` }]);
                // await generateImage(aiResponse.text, userMessage); // Placeholder
            } else if (aiResponse.action === 'storage') {
                 setMessages(prev => [...prev, { role: 'ai', text: `📁 Сохраняю: "${aiResponse.text}"` }]);
                // await saveTextToStorage(aiResponse.text); // Placeholder
            }
            else {
                setMessages(prev => [...prev, { role: 'ai', text: aiResponse.text }]);
            }

        } catch (err) {
            console.error("Ошибка отправки:", err);
            setMessages(prev => [...prev, { role: 'ai', text: err.text || "❌ Что-то пошло не так..." }]);
        } finally {
            setIsLoading(false);
        }
    };


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
                <h1>Leshiy-AI <span>ECOSYSTEM</span></h1>
                <div className="status-dots">
                    <span title="Gemini Proxy" className="dot green"></span>
                    <span title="Storage (Worker)" className="dot blue"></span>
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
                {isLoading && <div className="message ai"><div className="bubble typing">⏳ Gemini-AI думает...</div></div>}
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
                    placeholder={selectedImage ? "Теперь добавь текстовый запрос к картинке..." : "Спроси о чем-нибудь или вставь картинку (Ctrl+V)..."}
                />
                <button onClick={handleSend} disabled={isLoading}>Отправить</button>
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
                📎 Выбрать файл
            </button>
        </div>
    );
}

export default App;
