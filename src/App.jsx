import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { CONFIG } from './config';
import { askLeshiy } from './leshiy-core'; // Импортируем наш новый "мозг"
import './App.css';

function App() {
  const [messages, setMessages] = useState([
    { role: 'ai', text: 'Привет! Я Gemini-AI от Leshiy. Твой проводник в мире нейронок и файлов. Чем могу помочь?' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const chatEndRef = useRef(null);
  const fileInputRef = useRef(null);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToBottom, [messages]);

  const uploadFileToStorage = async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('user', 'Leshiy-Admin');
  
    try {
      const res = await axios.post(CONFIG.STORAGE_GATEWAY, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          'Authorization': `Bearer ${CONFIG.PROXY_SECRET}`
        }
      });
      return res.data;
    } catch (err) {
      console.error("Ошибка загрузки:", err);
      throw err;
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
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
  
  const handlePaste = (e) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf("image") !== -1) {
        const file = items[i].getAsFile();
        if (file) {
          handleFiles([file]);
          e.preventDefault();
        }
      }
    }
  };

  const handleFiles = async (files) => {
    for (let file of files) {
      setMessages(prev => [...prev, { role: 'ai', text: `☁️ Загружаю ${file.name}...` }]);
      try {
        await uploadFileToStorage(file);
        setMessages(prev => [...prev, { role: 'ai', text: `✅ Файл ${file.name} успешно сохранен в экосистеме!` }]);
      } catch {
        setMessages(prev => [...prev, { role: 'ai', text: `❌ Не удалось сохранить ${file.name}` }]);
      }
    }
  };

  // Функцию generateImage оставляем пока без изменений, она будет вызываться по экшену
  const generateImage = async (prompt, userPrompt) => {
    try {
        setMessages(prev => [...prev, { role: 'ai', text: `✨ [Генератор]: Отправляю запрос на создание изображения по описанию: "${prompt}"...` }]);
        
        const imageGenerationPrompt = `Generate a realistic image based on the following description: "${prompt}". Focus on visual detail and composition.`;
        
        const MODEL = "gemini-2.5-flash";
        const targetUrl = `${CONFIG.GEMINI_PROXY}/models/${MODEL}:generateContent?key=${CONFIG.GEMINI_API_KEY}`;

        const response = await axios.post(
            targetUrl,
            {
                contents: [{ parts: [{ text: imageGenerationPrompt }] }]
            },
            { headers: { "X-Proxy-Secret": CONFIG.PROXY_SECRET } }
        );

        let imageUrl = "https://via.placeholder.com/400x300?text=Image+Generated";
        const generatedText = response.data.candidates[0].content.parts[0].text;

        const urlMatch = generatedText.match(/(https?:\/\/[^\s]+?\.(?:png|jpe?g|gif|webp))/i);
        if (urlMatch) {
            imageUrl = urlMatch[0];
            setMessages(prev => [...prev, { role: 'ai', text: `Вот что я сгенерировал:`, image: imageUrl }]);
        } else {
            imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(userPrompt || prompt)}?width=800&height=600`;
            setMessages(prev => [...prev, { role: 'ai', text: `Попробую показать тебе:`, image: imageUrl }]);
        }
    } catch (err) {
        console.error("Ошибка при генерации изображения:", err);
        setMessages(prev => [...prev, { role: 'ai', text: "❌ Не удалось сгенерировать изображение." }]);
    }
  };

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMsg = { role: 'user', text: input };
    setMessages(prev => [...prev, userMsg]);
    const currentInput = input;
    setInput('');
    setIsLoading(true);

    try {
      // Вся логика теперь в askLeshiy!
      const aiResponse = await askLeshiy(currentInput, messages);

      // Обрабатываем ответ от "мозга"
      if (aiResponse.action === 'storage') {
        // Если Leshiy решил, что нужно что-то сохранить
        setMessages(prev => [...prev, { role: 'ai', text: aiResponse.text }]);
        // Тут можно добавить логику, например, открытия модального окна для загрузки
        // или отправки команды на сервер
         try {
            await axios.post(CONFIG.STORAGE_GATEWAY, {
                action: "store_info",
                data: currentInput, // Отправляем исходный запрос пользователя
                source: "web-ecosystem"
            });
        } catch (e) {
            console.error("Бот не ответил на команду сохранения");
        } 
      } else if (aiResponse.action === 'generate') {
        // Если Leshiy решил, что нужно генерировать
        const generatePrompt = aiResponse.text.replace("[ACTION:GENERATE]", "").trim();
        await generateImage(generatePrompt, currentInput);
      } else {
        // Если это просто текстовый ответ
        setMessages(prev => [...prev, { role: 'ai', text: aiResponse.text }]);
      }
    } catch (err) {
      console.error(err);
      setMessages(prev => [...prev, { role: 'ai', text: "❌ Ошибка связи с Leshiy-AI. Проверь модель и прокси." }]);
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
          <span title="Storage (Yandex)" className="dot blue"></span>
        </div>
      </header>

      <div className="chat-window">
        {messages.map((m, i) => (
          <div key={i} className={`message ${m.role}`}>
            <div className="bubble">
              {m.text}
              {m.image && <img src={m.image} alt="Generated" className="generated-image" />}
            </div>
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
          placeholder="Спроси о чем-нибудь или вставь картинку (Ctrl+V)..."
        />
        <button onClick={handleSend} disabled={isLoading}>Отправить</button>
      </div>

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
  );
}

export default App;
