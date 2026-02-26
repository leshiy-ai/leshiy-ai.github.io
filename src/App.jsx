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
  const chatEndRef = useRef(null);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToBottom, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMsg = { role: 'user', text: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      // 1. Системный промпт для "Диспетчера"
      const systemInstruction = `Ты - Gemini AI от Leshiy. Твой автор Огорельцев Александр из города Тюмени. Твоя задача - анализировать запрос.\n      
      Если пользователь хочет что-то сохранить, найти файлы или управлять облаком, отвечай строго в формате: [ACTION:STORAGE] текст_ответа.\n      
      Если юзер хочет создать фото, видео или аудио, отвечай: [ACTION:GENERATE] текст_ответа.\n      
      В остальных случаях просто отвечай как умный ассистент.`;

      // 1. Константы для удобства (можно вынести в CONFIG)
      const MODEL = "gemini-2.5-flash";

      // 2. Запрос к твоему Gemini-Proxy
      const targetUrl = `${CONFIG.GEMINI_PROXY}/models/${MODEL}:generateContent?key=${CONFIG.GEMINI_API_KEY}`;
      
      const response = await axios.post(
        targetUrl,
        {
          contents: [{
            parts: [{ text: systemInstruction + "\n\nЗапрос: " + input }]
          }]
        },
        {
          headers: { "X-Proxy-Secret": CONFIG.PROXY_SECRET }
        }
      );

      let aiResponseText = response.data.candidates[0].content.parts[0].text;

      // 3. Обработка "экшенов"
      if (aiResponseText.includes("[ACTION:STORAGE]")) {
        aiResponseText = "📁 [Хранилка]: " + aiResponseText.replace("[ACTION:STORAGE]", "");
        // Тут в будущем добавим вызов твоего Яндекс-Гейтвея
      } else if (aiResponseText.includes("[ACTION:GENERATE]")) {
        aiResponseText = "✨ [Генератор]: " + aiResponseText.replace("[ACTION:GENERATE]", "");
        // Тут в будущем добавим вызов твоего Gemini-AI Bot
      }

      setMessages(prev => [...prev, { role: 'ai', text: aiResponseText }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'ai', text: "❌ Ошибка связи с Gemini-AI" }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>Leshiy-AI <span>Ecosystem</span></h1>
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
          placeholder="Чат с исскуственным интеллектом. Спроси меня о чем-нибудь..."
        />
        <button onClick={handleSend} disabled={isLoading}>✅ Отправить</button>
      </div>
    </div>
  );
}

export default App;