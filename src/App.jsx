import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { CONFIG } from './config';
import './App.css';

function App() {
  const [messages, setMessages] = useState([
    { role: 'ai', text: 'Привет! Я Gemini-AI от Leshiy. Твой проводник в мире нейронок и файлов. Чем могу помочь?' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false); // Состояние для перетаскивания
  const chatEndRef = useRef(null);
  const fileInputRef = useRef(null); // Реф для скрытого инпута файлов

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToBottom, [messages]);

  // --- ЛОГИКА DRAG AND DROP ---
  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFiles(files);
    }
  };

  const handleFiles = (files) => {
    // Пока просто выводим в чат, позже подключим STORAGE_GATEWAY
    const fileNames = Array.from(files).map(f => f.name).join(', ');
    setMessages(prev => [...prev, { 
      role: 'ai', 
      text: `📁 Поймал файлы: ${fileNames}. Готовлю их к загрузке в хранилище...` 
    }]);
  };

  // --- ЛОГИКА ОТПРАВКИ ТЕКСТА ---
  const handleSend = async () => {
    if (!input.trim()) return;

    const userMsg = { role: 'user', text: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const systemInstruction = `Ты - Gemini AI от Leshiy. Твой автор Огорельцев Александр из города Тюмени. Твоя задача - анализировать запрос.\n      Если пользователь хочет что-то сохранить, найти файлы или управлять облаком, отвечай строго в формате: [ACTION:STORAGE] текст_ответа.\n      Если юзер хочет создать фото, видео или аудио, отвечай: [ACTION:GENERATE] текст_ответа.\n      В остальных случаях просто отвечай как умный ассистент.`;

      const MODEL = "gemini-2.5-flash";

      const targetUrl = `${CONFIG.GEMINI_PROXY}/models/${MODEL}:generateContent?key=${CONFIG.GEMINI_API_KEY}`;
      
      const response = await axios.post(
        targetUrl,
        {
          contents: [{
            parts: [{ text: systemInstruction + "\\n\\nЗапрос: " + input }]
          }]
        },
        { headers: { "X-Proxy-Secret": CONFIG.PROXY_SECRET } }
      );

      let aiResponseText = response.data.candidates[0].content.parts[0].text;

      if (aiResponseText.includes("[ACTION:STORAGE]")) {
        aiResponseText = "📁 [Хранилка]: " + aiResponseText.replace("[ACTION:STORAGE]", "");
      } else if (aiResponseText.includes("[ACTION:GENERATE]")) {
        aiResponseText = "✨ [Генератор]: " + aiResponseText.replace("[ACTION:GENERATE]", "");
      }

      setMessages(prev => [...prev, { role: 'ai', text: aiResponseText }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'ai', text: "❌ Ошибка связи с Gemini-AI. Проверь модель и прокси." }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="app-container">
      {/* Главная обертка с пунктирной зоной */}
      <div 
        className={`drop-zone-wrapper ${isDragging ? 'dragging' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <header className="app-header">
          <img src="/Gemini.png" alt="Gemini AI" className="logo" />
          <h1>Leshiy-AI <span>ECOSYSTEM</span></h1>
          <div className="status-dots">
            <span title="Gemini Proxy" className="dot green"></span>
            <span title="Storage (Yandex)" className="dot blue"></span>
          </div>
        </header>

        <div className="chat-window">
          {messages.map((m, i) => (
            <div key={i} className={`message ${m.role}`}>
              <div className="bubble">{m.text}</div>
            </div>
          ))}
          {isLoading && <div className="message ai"><div className="bubble typing">⏳ Gemini-AI думает...</div></div>}
          <div ref={chatEndRef} />
        </div>

        <div className="input-area">
          <input 
            value={input} 
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Чат с ИИ. Спроси что-нибудь..."
          />
          <button onClick={handleSend} disabled={isLoading}>Отправить</button>
        </div>

        {/* Кнопка загрузки файлов */}
        <input 
          type="file" 
          multiple 
          ref={fileInputRef} 
          style={{ display: 'none' }} 
          onChange={(e) => handleFiles(e.target.files)}
        />
        <button 
          className="upload-btn" 
          onClick={() => fileInputRef.current.click()}
        >
          📎 Выбрать файлы для загрузки
        </button>
      </div>
    </div>
  );
}

export default App;
