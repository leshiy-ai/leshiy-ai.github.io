import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import { CONFIG } from './config';
import { askLeshiy } from './leshiy-core';
import { SERVICE_TYPE_MAP, AI_MODEL_MENU_CONFIG, getActiveModelKey as getActiveModelKeyGeneric } from './ai-config';
import Sidebar from './Sidebar';
import './App.css';

// --- КОНСТАНТЫ ---
const TEXT_TO_TEXT_MODELS_SELECTOR = [
    { key: 'TEXT_TO_TEXT_CLOUDFLARE', name: 'Базовая модель', icon: '✳️' },
    { key: 'TEXT_TO_TEXT_GEMINI', name: 'Умная модель', icon: '✨' },
    { key: 'TEXT_TO_TEXT_BOTHUB', name: 'Запасная модель', icon: '✴️' }
];

const TRANSLATIONS = {
    ru: {
        title: 'Leshiy-AI',
        placeholder: (files) => files.length > 0 ? "Добавь текст к файлам..." : "Спроси меня о чем-нибудь...",
        send: 'Отправить',
        upload: '📎 Выбрать файл',
        welcome: 'Привет! Я Gemini-AI. Спроси меня о чём угодно, подключи Хранилку и вставляй картинки или файлы прямо в поле ввода или перетягивай в чат, я всё пойму, распознаю, и сделаю!',
        thinking: '⏳ Gemini-AI думает...',
        uploading: '☁️ Загружаю',
        uploadSuccess: '✅ Файл успешно сохранен в экосистеме!',
        uploadError: '❌ Не удалось сохранить',
        admin: '👑 Админка',
        version: 'Версия',
        author: 'Автор',
        tooltip_add_file: "Добавить файл",
        tooltip_record_voice: "Записать голос",
        tooltip_send: "Отправить",
        tooltip_toggle_lang: "Сменить язык",
        tooltip_toggle_theme: "Сменить тему",
        tooltip_reload: "Обновить чат",
        tooltip_close: "Закрыть чат",
        tooltip_select_model: "Выбрать модель",
        tooltip_toggle_menu: "Открыть/закрыть меню",
        tooltip_new_chat: "Начать новый чат",
        tooltip_storage: "Открыть Хранилище",
        tooltip_admin: "Открыть админ-панель",
        tooltip_logout: "Выйти",
        tooltip_login: "Войти через VK ID",
        tooltip_auto_rename: "Автоматически переименовать чат",
    },
    en: {
        title: 'Leshiy-AI',
        placeholder: (files) => files.length > 0 ? "Now add a text query to the files..." : "Ask something...",
        send: 'Send',
        upload: '📎 Select file',
        welcome: 'Hi! I am Gemini-AI. Ask me anything, connect Storage and insert pictures or files directly into the input field or drag them into the chat, I will understand everything, recognize it, and do it!',
        thinking: '⏳ Gemini-AI is thinking...',
        uploading: '☁️ Uploading',
        uploadSuccess: '✅ File successfully saved in the ecosystem!',
        uploadError: '❌ Failed to save',
        admin: '👑 Admin',
        version: 'Version',
        author: 'Author',
        tooltip_add_file: "Add file",
        tooltip_record_voice: "Record voice",
        tooltip_send: "Send",
        tooltip_toggle_lang: "Change language",
        tooltip_toggle_theme: "Change theme",
        tooltip_reload: "Reload chat",
        tooltip_close: "Close chat",
        tooltip_select_model: "Select model",
        tooltip_toggle_menu: "Toggle menu",
        tooltip_new_chat: "Start new chat",
        tooltip_storage: "Open Storage",
        tooltip_admin: "Open Admin Panel",
        tooltip_logout: "Logout",
        tooltip_login: "Login with VK ID",
        tooltip_auto_rename: "Automatically rename chat",
    }
};

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

    const renderFile = (file, i) => {
        const type = file.type || '';
        const name = file.name || '';
        const isImg = type.startsWith('image/') || (file.preview && !type);
        const isVid = type.startsWith('video/');
        const isAud = type.startsWith('audio/') || name.endsWith('.mp3') || name.endsWith('.ogg') || name.endsWith('.wav');
        const isZip = name.endsWith('.zip') || name.endsWith('.rar') || name.endsWith('.7z');
        const isDoc = name.endsWith('.doc') || name.endsWith('.docx') || name.endsWith('.pdf') || name.endsWith('.xls') || name.endsWith('.xlsx');

        if (isImg) return <img key={i} src={file.preview} className="uploaded-image-preview" />;
        
        let icon = '📎'; let label = 'ФАЙЛ';
        if (isVid) { icon = '🎬'; label = 'ВИДЕО'; }
        else if (isAud) { icon = '🎵'; label = 'АУДИО'; }
        else if (isZip) { icon = '📦'; label = 'АРХИВ'; }
        else if (isDoc) { icon = '📄'; label = 'ДОК'; }

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

const makeSwipable = (panel, onRemove, useRotation = true) => {
    let startX = 0;
    let currentX = 0;
    const threshold = 100;
    if (!panel) return () => {};
    const style = window.getComputedStyle(panel);
    const initialTransform = style.transform !== 'none' ? style.transform : '';

    const onTouchStart = (e) => {
        startX = e.touches[0].clientX;
        panel.style.transition = 'none';
    };

    const onTouchMove = (e) => {
        currentX = e.touches[0].clientX - startX;
        if (Math.abs(currentX) > 5) {
            const rotation = useRotation ? ` rotate(${currentX / 20}deg)` : '';
            panel.style.transform = initialTransform + ` translateX(${currentX}px)` + rotation;
            panel.style.opacity = 1 - (Math.abs(currentX) / 350);
        }
    };

    const onTouchEnd = () => {
        panel.style.transition = 'transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.1), opacity 0.4s';
        if (Math.abs(currentX) > threshold) {
            const direction = currentX > 0 ? 1000 : -1000;
            panel.style.transform = initialTransform + ` translateX(${direction}px)`;
            panel.style.opacity = '0';
            
            setTimeout(() => {
                if (onRemove) onRemove();
                
                panel.style.transform = initialTransform;
                panel.style.opacity = '1';
            }, 400);
        } else {
            panel.style.transform = initialTransform;
            panel.style.opacity = '1';
        }
        currentX = 0;
    };

    panel.addEventListener('touchstart', onTouchStart, { passive: true });
    panel.addEventListener('touchmove', onTouchMove, { passive: true });
    panel.addEventListener('touchend', onTouchEnd);

    return () => {
      panel.removeEventListener('touchstart', onTouchStart);
      panel.removeEventListener('touchmove', onTouchMove);
      panel.removeEventListener('touchend', onTouchEnd);
    };
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
    const [isStorageVisible, setStorageVisible] = useState(false);
    const [isModelSelectorOpen, setIsModelSelectorOpen] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [isNumberMode, setIsNumberMode] = useState(false);
    const [textCaseMode, setTextCaseMode] = useState('normal');
    
    const [userName, setUserName] = useState(localStorage.getItem('vk_user_name') || "Пользователь");
    const [userPhoto, setUserPhoto] = useState(localStorage.getItem('vk_user_photo') || "");
    const [isLoggedIn, setIsLoggedIn] = useState(!!localStorage.getItem('vk_user_id'));
    const [isAdmin, setIsAdmin] = useState(localStorage.getItem('isAdmin') === 'true');

    const [currentUserId, setCurrentUserId] = useState(localStorage.getItem('vk_user_id') || "guest");
    const [currentChatId, setCurrentChatId] = useState(null);
    const [chatList, setChatList] = useState([]);

    const chatEndRef = useRef(null);
    const fileInputRef = useRef(null);
    const chatWindowRef = useRef(null);
    const appContainerRef = useRef(null);
    const startY = useRef(0);
    const isPulled = useRef(false);
    const welcomeMessageIdRef = useRef(null);
    const textareaRef = useRef(null);
    const modelSelectorRef = useRef(null);
    const restartTimeoutRef = useRef(null);

    // --- РЕФЫ ДЛЯ РАСПОЗНАВАНИЯ РЕЧИ ---
    const recognitionRef = useRef(null);
    const wasManuallyStoppedRef = useRef(false);
    const shouldSendOnEndRef = useRef(false);
    const isSendingRef = useRef(false);
    const baseTextRef = useRef('');
    const sessionFinalTextRef = useRef('');
    const isNumberModeRef = useRef(isNumberMode);
    const textCaseModeRef = useRef(textCaseMode);

    const t = useMemo(() => TRANSLATIONS[language], [language]);

    const punctuationMap = useMemo(() => ({
        'тчк': '.', 'точка': '.', 'зпт': ',', 'запятая': ',', 'точка с запятой': ';',
        'тире': '-', 'дефис': '-', 'минус': '-',
        'равно': '=', 'плюс': '+', 'подчёркивание': '_',
        'звёздочка': '*', 'умножить': '*', 'пробел': ' ',
        'собака': '@', 'решётка': '#', 'номер': '№',
        'доллар': '$', 'евро': '€', 'рубль': '₽', 'градус': '°',
        'процент': '%', 'проценты': '%', 'апостроф': "'", 'амперсанд': '&',
        'слэш': '/', 'обратный слэш': '\\',
        'тильда': '~', 'восклицательный знак': '!', 'вопросительный знак': '?', 'вопрос': '?',
        'двоеточие': ':', 'степень': '^',
        'многоточие': '...', 'троеточие': '...', 'вертикальная черта': '|',
        'открыть скобку': '(', 'скобка открывается': '(',
        'закрыть скобку': ')', 'скобка закрывается': ')',
        'кавычки': '"', 'открыть кавычку': '«', 'закрыть кавычку': '»',
        'кавычка открывается': '«', 'кавычка закрывается': '»',
        'знак больше': '>', 'знак меньше': '<',
        'смайлик': '🙂', 'грустный смайлик': '☹️', 'сердце': '❤️'
    }), []);

    const numberMap = useMemo(() => ({
        'раз': 1, 'ноль': 0, 'один': 1, 'два': 2, 'три': 3, 'четыре': 4, 'пять': 5,
        'шесть': 6, 'семь': 7, 'восемь': 8, 'девять': 9, 'десять': 10
    }), []);

    const applyPunctuation = useCallback((text) => {
        let processed = ` ${text} `;
        const sortedKeys = Object.keys(punctuationMap).sort((a, b) => b.length - a.length);
        sortedKeys.forEach(key => {
            const regex = new RegExp(` ${key} `, 'gi');
            processed = processed.replace(regex, ` ${punctuationMap[key]} `);
        });
        processed = processed.replace(/\s+([.,!?:;»”’)])/g, '$1');
        processed = processed.replace(/([(«“‘])\s+/g, '$1');
        return processed.replace(/^[ \t]+|[ \t]+$/g, '');
    }, [punctuationMap]);

    const convertWordsToNumbers = useCallback((text) => {
        let processed = text;
        Object.keys(numberMap).forEach(word => {
            const regex = new RegExp(`\\b${word}\\b`, 'gi');
            processed = processed.replace(regex, numberMap[word]);
        });
        return processed;
    }, [numberMap]);

    const applyCaseMode = useCallback((text, mode) => {
        if (!text) return '';
        switch (mode) {
            case 'upper':
                return text.toUpperCase();
            case 'lower':
                return text.toLowerCase();
            case 'normal':
            default:
                return text.replace(/(^|[.!?]\s+)([а-яёa-z])/g, (match, p1, p2) => p1 + p2.toUpperCase());
        }
    }, []);

    useEffect(() => {
        isNumberModeRef.current = isNumberMode;
    }, [isNumberMode]);

    useEffect(() => {
        textCaseModeRef.current = textCaseMode;
    }, [textCaseMode]);

    const [activeModels, setActiveModels] = useState({
        TEXT_TO_TEXT: localStorage.getItem('ACTIVE_MODEL_TEXT_TO_TEXT') || 'TEXT_TO_TEXT_CLOUDFLARE',
        IMAGE_TO_TEXT: localStorage.getItem('ACTIVE_MODEL_IMAGE_TO_TEXT') || 'IMAGE_TO_TEXT_CLOUDFLARE',
        AUDIO_TO_TEXT: localStorage.getItem('ACTIVE_MODEL_AUDIO_TO_TEXT') || 'AUDIO_TO_TEXT_CLOUDFLARE',
        VIDEO_TO_TEXT: localStorage.getItem('ACTIVE_MODEL_VIDEO_TO_TEXT') || 'VIDEO_TO_TEXT_CLOUDFLARE',
    });

    const activeTttModelKey = activeModels.TEXT_TO_TEXT;
    const activeTttModel = TEXT_TO_TEXT_MODELS_SELECTOR.find(m => m.key === activeTttModelKey) || TEXT_TO_TEXT_MODELS_SELECTOR[0];

    const updateModel = (type, modelKey) => {
        setActiveModels(prev => ({ ...prev, [type]: modelKey }));
        const kvKey = `ACTIVE_MODEL_${type}`;
        localStorage.setItem(kvKey, modelKey);
    };

    const handleModelSelect = (modelKey) => {
        updateModel('TEXT_TO_TEXT', modelKey);
        setIsModelSelectorOpen(false);
    };

    useEffect(() => {
        function handleClickOutside(event) {
            if (modelSelectorRef.current && !modelSelectorRef.current.contains(event.target)) {
                setIsModelSelectorOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    const fetchChats = useCallback(async () => {
        if (currentUserId && currentUserId !== "guest") {
            try {
                const response = await axios.get(
                    `${CONFIG.STORAGE_GATEWAY}/api/list-chats?userId=${currentUserId}`
                );
                setChatList(response.data || []);
            } catch (err) {
                console.error("Не удалось получить список чатов:", err);
            }
        }
    }, [currentUserId]);
    
    const onNewChatRequest = useCallback(() => {
        setCurrentChatId(null);
        setFiles([]);
        setInput('');
        localStorage.removeItem('last_chat_id');
        
        const welcomeId = Date.now();
        welcomeMessageIdRef.current = welcomeId;
        setMessages([{ id: welcomeId, role: 'ai', text: t.welcome }]);
    }, [t]);
   
    useEffect(() => {
        Object.keys(activeModels).forEach(type => {
            const config = SERVICE_TYPE_MAP[type];
            if (config && config.kvKey) {
                if (!localStorage.getItem(config.kvKey)) {
                    localStorage.setItem(config.kvKey, activeModels[type]);
                }
            }
        });
    }, [activeModels]);

    useEffect(() => {
        const textarea = textareaRef.current;
        if (textarea) {
            textarea.style.height = 'auto';
            textarea.style.height = `${textarea.scrollHeight}px`;
        }
    }, [input]);

    useEffect(() => {
        const handleAuthSuccess = (event) => {
            const data = event.detail; 
            if (!data) return;
        
            const userId = data.user_id || data.id;
            setCurrentUserId(userId);
        
            if (window.handleStatusResponse) {
                window.handleStatusResponse(data);
            }
        };

        const handleBotCommand = (event) => { handleSend(event.detail); };

        const mBtn = document.getElementById('toggle-menu');
        const body = document.body;

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

            if (teX - tsX > 70 && tsX < 40) {
                body.classList.remove('sidebar-collapsed');
            }

            if (tsX - teX > 70) {
                body.classList.add('sidebar-collapsed');
            }
        };
        
        const handleFocus = () => {
            if (sessionStorage.getItem('waiting_for_auth') === 'true') {
                sessionStorage.removeItem('waiting_for_auth');
                handleSend('/storage_list'); 
            }
        };

        window.addEventListener('vk-auth-success', handleAuthSuccess);
        window.addEventListener('send-bot-command', handleBotCommand);
        document.addEventListener('touchstart', hTS);
        document.addEventListener('touchend', hTE);
        window.addEventListener('focus', handleFocus);
        if (mBtn) mBtn.addEventListener('click', hMC);

        return () => {
            window.removeEventListener('vk-auth-success', handleAuthSuccess);
            window.removeEventListener('send-bot-command', handleBotCommand);
            document.removeEventListener('touchstart', hTS);
            document.removeEventListener('touchend', hTE);
            window.removeEventListener('focus', handleFocus);
            if (mBtn) mBtn.removeEventListener('click', hMC);
        };
    }, []);

    useEffect(() => {
        window.addEventListener('sidebar-new-chat', onNewChatRequest);
    
        const lastId = localStorage.getItem('last_chat_id');
        
        if (lastId && !currentChatId) {
            onSelectChat(lastId);
        } else if (!lastId) {
            onNewChatRequest();
        }
    
        return () => {
            window.removeEventListener('sidebar-new-chat', onNewChatRequest);
        };
    }, [currentUserId, onNewChatRequest]);
    
    const onSelectChat = (chatId) => {
        if (!chatId) return;
        
        localStorage.setItem('last_chat_id', chatId);
        setCurrentChatId(chatId);
        
        loadChatFromHistory(chatId);
    };

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
    }, [theme]);

    useEffect(() => {
        localStorage.setItem('language', language);
        const welcomeMessage = t.welcome;
        setMessages(prevMessages => 
            prevMessages.map(msg => 
                msg.id === welcomeMessageIdRef.current 
                    ? { ...msg, text: welcomeMessage } 
                    : msg
            )
        );
    }, [language, t]);

    const scrollToBottom = (force = false) => {
        if (force) {
            chatEndRef.current?.scrollIntoView(false);
        } else {
            chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }
    };
    
    useEffect(() => {
        if (messages.length > 0) {
            scrollToBottom();
        }
    }, [messages]);

    const handleFileUpload = async (filesToUpload) => {
        for (let file of filesToUpload) {
            setMessages(prev => [...prev, { id: Date.now(), role: 'ai', text: `${t.uploading} ${file.name}...` }]);
            try {
                const formData = new FormData();
                formData.append('file', file);
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

    const generateSmartTitle = useCallback(async (messageHistory) => {
        if (!messageHistory || messageHistory.length < 1) return null;

        try {
            const prompt = "Проанализируй этот диалог и придумай для него короткое, ёмкое название (2-4 слова). Отвечай только названием, без лишних слов, кавычек или точек.";

            const aiResponse = await askLeshiy({
                text: prompt,
                history: messageHistory, // Передаем полный массив сообщений как историю
                isSystemTask: true
            });

            if (aiResponse && aiResponse.text && aiResponse.type !== 'error') {
                const cleanedTitle = aiResponse.text.replace(/[\"«»*.]/g, '').trim();
                if (cleanedTitle) {
                    return cleanedTitle;
                }
            }
            return null;
        } catch (e) {
            console.warn("AI Title Generation failed:", e);
            return null;
        }
    }, []);

    const syncChatHistory = useCallback(async (chatId, currentMessages, titleOverride = null) => {
        if (currentUserId === "guest") return;
        
        const payload = {
            userId: String(currentUserId),
            chatId: chatId,
            messages: currentMessages.map(m => ({
                role: m.role,
                content: m.text,
                id: m.id
            }))
        };

        if (titleOverride) {
            payload.chatTitle = titleOverride;
        }

        try {
            await axios.post(`${CONFIG.STORAGE_GATEWAY}/api/history`, payload);
            fetchChats();
        } catch (err) {
            console.error("Ошибка сохранения истории:", err);
        }
    }, [currentUserId, fetchChats]);

    const handleHistorySync = useCallback(async (chatId, updatedMessages) => {
        if (currentUserId === "guest") return;

        const existingChat = chatList.find(c => c.id === chatId);
        let currentTitle = existingChat ? existingChat.title : "Новый чат";

        const userMessageCount = updatedMessages.filter(m => m.role === 'user').length;
        const isDefaultTitle = !existingChat || existingChat.title === "Новый чат" || /^Чат от/.test(existingChat.title);

        if (userMessageCount >= 3 && isDefaultTitle) {
            try {
                const smartTitle = await generateSmartTitle(updatedMessages);
                if (smartTitle && smartTitle !== currentTitle) {
                    currentTitle = smartTitle;
                    setChatList(prev => prev.map(c => 
                        c.id === chatId ? { ...c, title: smartTitle } : c
                    ));
                }
            } catch (e) {
                console.error("Ошибка при генерации заголовка:", e);
            }
        }

        await syncChatHistory(chatId, updatedMessages, currentTitle);
    }, [chatList, generateSmartTitle, syncChatHistory, currentUserId]);


    const handleSend = useCallback(async (text) => {
        const userMessageText = (typeof text === 'string' ? text : input).trim();

        if (userMessageText.toLowerCase() === '/admin') {
            setShowAdminPanel(true);
            setInput('');
            return;
        }

        if (!userMessageText && files.length === 0) return;

        let chatId = currentChatId;
        if (!chatId) {
            chatId = `chat_${Date.now()}`;
            setCurrentChatId(chatId);
            localStorage.setItem('last_chat_id', chatId);
            // Создаем новый чат в списке сразу
            setChatList(prev => [{ id: chatId, title: "Новый чат", lastUpdate: Date.now() }, ...prev]);
        }

        const currentFiles = [...files];
        const userMsg = {
            id: Date.now(),
            role: 'user',
            text: userMessageText,
            attachments: currentFiles.map(f => ({ 
                preview: f.preview, 
                name: f.file.name, 
                type: f.file.type 
            }))
        };

        const initialMessages = (messages.length === 1 && messages[0].id === welcomeMessageIdRef.current && !(typeof text === 'string'))
            ? []
            : messages;

        const historyForAi = initialMessages.map(m => ({
            role: m.role === 'user' ? 'user' : 'model',
            parts: [{ text: m.text || m.content }]
        }));

        const newMessages = [...initialMessages, userMsg];
        setMessages(newMessages);
        setIsLoading(true);
        setFiles([]);
        setInput('');

        try {
            const aiResponse = await askLeshiy({
                text: userMessageText,
                history: historyForAi,
                userId: currentUserId,
                files: currentFiles.map(f => ({ 
                    file: f.file,
                    base64: f.base64,
                    mimeType: f.mimeType
                }))
            });

            const assistantMsg = {
                id: Date.now() + 1,
                role: aiResponse.type === 'error' ? 'ai error' : 'ai',
                text: aiResponse.text,
                buttons: aiResponse.buttons
            };

            const updatedMessages = [...newMessages, assistantMsg];
            setMessages(updatedMessages);

            handleHistorySync(chatId, updatedMessages);

        } catch (err) {
            console.error("Ошибка связи с Лешим:", err);
            setMessages(prev => [...prev, {
                id: Date.now(),
                role: 'ai error',
                text: 'Произошла ошибка при обращении к лешему.'
            }]);
        } finally {
            setIsLoading(false);
        }
    }, [files, input, currentChatId, messages, currentUserId, handleHistorySync]);

    const handleSendRef = useRef(handleSend);
    useEffect(() => { handleSendRef.current = handleSend; }, [handleSend]);

    const [chatOffset, setChatOffset] = useState(0);
    const [hasMore, setHasMore] = useState(true);
    const [isFetchingMore, setIsFetchingMore] = useState(false);

    const loadChatFromHistory = async (chatId, isLoadMore = false) => {
        if (isLoadMore && isFetchingMore) return;

        const limit = 20;
        const currentOffset = isLoadMore ? chatOffset : 0;
    
        if (isLoadMore) {
            setIsFetchingMore(true);
        } else {
            setIsLoading(true);
        }

        const chatWindow = chatWindowRef.current;
        const oldScrollHeight = chatWindow?.scrollHeight || 0;

        try {
            const res = await axios.get(`${CONFIG.STORAGE_GATEWAY}/api/get-history`, {
                params: {
                    userId: currentUserId,
                    chatId: chatId,
                    offset: currentOffset,
                    limit: limit
                }
            });
    
            const historyMessages = res.data.messages || [];
            
            if (!isLoadMore && historyMessages.length === 0) {
                onNewChatRequest();
                return;
            }

            const serverHasMore = res.data.hasMore;
    
            const formattedMsgs = historyMessages.map(m => ({
                id: m.id || Date.now() + Math.random(),
                role: m.role,
                text: m.content || m.text
            }));
    
            if (isLoadMore) {
                setMessages(prev => [...formattedMsgs, ...prev]);
                
                requestAnimationFrame(() => {
                    if (chatWindow) {
                        const newScrollHeight = chatWindow.scrollHeight;
                        chatWindow.scrollTop = newScrollHeight - oldScrollHeight;
                    }
                });

            } else {
                setMessages(formattedMsgs);
                scrollToBottom(true);
            }

            setChatOffset(prev => prev + limit);
            setHasMore(serverHasMore);
            setCurrentChatId(chatId);

        } catch (e) {
            console.error("Не удалось подгрузить историю, начинаем новый чат:", e);
            if (!isLoadMore) {
                onNewChatRequest();
            }
        } finally {
            if (isLoadMore) {
                setIsFetchingMore(false);
            } else {
                setIsLoading(false);
            }
        }
    };

    const handleDeleteChat = async (chatId) => {
        if (!window.confirm("Вы уверены, что хотите удалить этот чат навсегда?")) return;
    
        setChatList(prev => prev.filter(c => c.id !== chatId));

        try {
            await axios.post(`${CONFIG.STORAGE_GATEWAY}/api/history`, {
                userId: String(currentUserId),
                chatId: chatId,
                isDeleted: true, 
                messages: []     
            });

            if (currentChatId === chatId) {
                onNewChatRequest(); 
            }
            
            fetchChats();

        } catch (e) {
            console.error("Ошибка удаления чата:", e);
            alert('Не удалось удалить чат. Попробуйте снова.');
            fetchChats();
        }
    };
    
    const handleRenameChat = async (chatId) => {
        const chatToRename = chatList.find(c => c.id === chatId);
        if (!chatToRename) return;
    
        const newTitle = window.prompt("Введите новое название чата:", chatToRename.title);
    
        if (newTitle && newTitle.trim() && newTitle.trim() !== chatToRename.title) {
            const trimmedTitle = newTitle.trim();
            
            try {
                const historyRes = await axios.get(`${CONFIG.STORAGE_GATEWAY}/api/get-history`, {
                    params: { userId: currentUserId, chatId: chatId, limit: 1000 }
                });
                const currentMessages = historyRes.data.messages || [];

                await syncChatHistory(chatId, currentMessages, trimmedTitle);
    
            } catch (e) {
                console.error("Ошибка переименования чата:", e);
                alert(`Не удалось переименовать чат. ${e.message}`);
            }
        }
    };

    const handleAutoRenameChat = async (chatId) => {
        if (!chatId || currentUserId === 'guest') return;

        try {
            const res = await axios.get(`${CONFIG.STORAGE_GATEWAY}/api/get-history`, {
                params: {
                    userId: currentUserId,
                    chatId: chatId,
                    limit: 1000 
                }
            });

            const historyMessages = res.data.messages || [];
            if (historyMessages.length === 0) {
                alert("Невозможно переименовать пустой чат.");
                return;
            }

            const smartTitle = await generateSmartTitle(historyMessages);

            if (smartTitle) {
                setChatList(prev => prev.map(c =>
                    c.id === chatId ? { ...c, title: smartTitle } : c
                ));
                await syncChatHistory(chatId, historyMessages, smartTitle);
                alert(`Чат переименован в: "${smartTitle}"`);
            } else {
                alert("Не удалось сгенерировать новое название для чата.");
            }

        } catch (e) {
            console.error("Ошибка автоматического переименования чата:", e);
            alert(`Ошибка: ${e.message}`);
        }
    };
    
    const handleMenuAction = (action) => {
        if (action.startsWith('http')) {
            window.open(action, '_blank', 'noopener,noreferrer');
            return;
        }

        if (action.startsWith('auth_')) {
            const provider = action.replace('auth_', '');
            sessionStorage.setItem('waiting_for_auth', 'true');
            window.open(`${CONFIG.STORAGE_GATEWAY}/auth/${provider}?state=${currentUserId}`, '_blank');
        } else {
            const command = action.startsWith('/') ? action : `/${action}`;
            handleSend(command); 
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
        if (currentChatId) {
            loadChatFromHistory(currentChatId);
        } else {
            onNewChatRequest();
        }
    };
    
    useEffect(() => {
        const chatWindow = chatWindowRef.current;
    
        const handleScroll = () => {
            if (chatWindow && chatWindow.scrollTop === 0 && hasMore && !isFetchingMore) {
                loadChatFromHistory(currentChatId, true);
            }
        };
    
        if (chatWindow) {
            chatWindow.addEventListener('scroll', handleScroll);
        }
    
        return () => {
            if (chatWindow) {
                chatWindow.removeEventListener('scroll', handleScroll);
            }
        };
    }, [chatWindowRef, hasMore, isFetchingMore, currentChatId, loadChatFromHistory]);

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
                ptrText.innerText = pullDistance > 60 ? "Отпустите для загрузки истории" : "Потяните вверх";
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

        if (translateY > 80) {
            container.style.transform = 'translateY(50px)';
            const ptrText = document.getElementById('ptr-text');
            const ptrLoader = document.getElementById('ptr-loader');
            if (ptrText) ptrText.innerText = "Загрузка...";
            if (ptrLoader) ptrLoader.style.display = 'block';

            loadChatFromHistory(currentChatId, true).finally(() => {
                 setTimeout(() => {
                    container.style.transform = 'translateY(0)';
                    if (ptrLoader) ptrLoader.style.display = 'none';
                }, 500);
            });
        } else {
            container.style.transform = 'translateY(0)';
        }
    };

    const toggleTheme = () => setTheme(theme === 'light' ? 'dark' : 'light');
    const toggleLanguage = () => setLanguage(language === 'ru' ? 'en' : 'ru');
    const closeApp = () => {
        const welcomeId = Date.now();
        welcomeMessageIdRef.current = welcomeId;
        setMessages([{ id: welcomeId, role: 'ai', text: t.welcome }]);
        softReload();
    };

    useEffect(() => {
        fetchChats();
    }, [fetchChats]);

    useEffect(() => {
      const modalContent = document.querySelector('.storage-content');
      if (isStorageVisible && modalContent) {
        const cleanupSwipe = makeSwipable(modalContent, () => setStorageVisible(false));
        return () => {
          cleanupSwipe();
        };
      }
    }, [isStorageVisible]);

    useEffect(() => {
        const adminModal = document.querySelector('.admin-modal');
        if (showAdminPanel && adminModal) {
          const cleanupSwipe = makeSwipable(adminModal, () => setShowAdminPanel(false), true); 
          return () => {
            cleanupSwipe();
          };
        }
      }, [showAdminPanel]);

    useEffect(() => {
    const handleProfileUpdate = () => {
        setUserName(localStorage.getItem('vk_user_name') || "Пользователь");
        setUserPhoto(localStorage.getItem('vk_user_photo') || "");
        setIsLoggedIn(!!localStorage.getItem('vk_user_id'));
        setIsAdmin(localStorage.getItem('isAdmin') === 'true');
    };

    window.addEventListener('user-profile-updated', handleProfileUpdate);
    return () => window.removeEventListener('user-profile-updated', handleProfileUpdate);
    }, []);
    
    useEffect(() => {
        const handleOpenStorage = () => {
            const userId = localStorage.getItem('vk_user_id');
            if (!userId || userId === 'null') {
                alert("Сначала авторизуйтесь!");
                return;
            }
            setStorageVisible(true);
        };
    
        const handleVkAuth = () => {
            const userId = localStorage.getItem('vk_user_id');
            if (!userId || userId === 'null') {
                const overlay = document.getElementById('vk_auth_overlay');
                if (overlay) overlay.style.display = 'flex';
                handleSend('/auth_init_vk');
            }
        };
  
        const handleAdminPanel = () => {
          setShowAdminPanel(true);
          };
    
        const handleLogout = () => {
            localStorage.removeItem('vk_user_id');
            localStorage.removeItem('vk_user_name');
            localStorage.removeItem('vk_user_photo');
            localStorage.removeItem('last_chat_id');
            sessionStorage.clear();
            window.location.reload();
        };
    
        window.addEventListener('sidebar-storage', handleOpenStorage);
        window.addEventListener('sidebar-vk-auth', handleVkAuth);
        window.addEventListener('sidebar-logout', handleLogout);
        window.addEventListener('sidebar-admin-panel', handleAdminPanel);
    
        return () => {
            window.removeEventListener('sidebar-storage', handleOpenStorage);
            window.removeEventListener('sidebar-vk-auth', handleVkAuth);
            window.removeEventListener('sidebar-logout', handleLogout);
            window.removeEventListener('sidebar-admin-panel', handleAdminPanel);
        };
    }, []);

    // --- Speech Recognition (План Б: Ручной continuous - ФИНАЛЬНАЯ ВЕРСИЯ) ---
    const processNewLineCommands = useCallback((text) => {
        if (!text) return '';
        const newLineCommands = language === 'ru' ? ['новая строка', 'с новой строки', 'энтер'] : ['new line'];
        // Pad with spaces for robust matching of multi-word commands
        let processedText = ` ${text} `;
        newLineCommands.forEach(cmd => {
            // Match the command surrounded by spaces
            const regex = new RegExp(` ${cmd} `, 'gi');
            processedText = processedText.replace(regex, '\\n');
        });
        // Clean up spaces around the generated newline and trim the result
        return processedText.replace(/\s*\n\s*/g, '\\n');
    }, [language]);

    useEffect(() => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            console.warn("Speech Recognition API не поддерживается в этом браузере.");
            return;
        }

        const recognition = new SpeechRecognition();
        recognitionRef.current = recognition;
        
        recognition.lang = language === 'ru' ? 'ru-RU' : 'en-US';
        recognition.interimResults = true;
        // ГЛАВНЫЙ ФИКС: Отключаем нативный continuous, который глючит на мобилках
        recognition.continuous = false; 

        recognition.onstart = () => {
            setIsRecording(true);
            wasManuallyStoppedRef.current = false;
            shouldSendOnEndRef.current = false;
            isSendingRef.current = false;
            sessionFinalTextRef.current = ''; 
        };

        recognition.onresult = (event) => {
            let sessionInterim = '';
            let sessionFinal = '';

            for (let i = 0; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    sessionFinal += event.results[i][0].transcript;
                } else {
                    sessionInterim += event.results[i][0].transcript;
                }
            }
            
            // Сохраняем "сырой" финальный результат для onend и для проверки команд
            sessionFinalTextRef.current = sessionFinal || sessionInterim;
            
            // --- ОБРАБОТКА ГОЛОСОВЫХ РЕЖИМОВ ---
            const lowerSession = (sessionFinal || sessionInterim).toLowerCase().trim();
            if (lowerSession.endsWith('цифрами') || lowerSession.endsWith('символами')) {
                setIsNumberMode(true);
                isNumberModeRef.current = true;
                recognition.stop();
                return;
            }
            if (lowerSession.endsWith('буквами') || lowerSession.endsWith('текстом')) {
                setIsNumberMode(false);
                isNumberModeRef.current = false;
                recognition.stop();
                return;
            }
            if (lowerSession.endsWith('заглавными') || lowerSession.endsWith('большими')) {
                setTextCaseMode('upper');
                textCaseModeRef.current = 'upper';
                recognition.stop();
                return;
            }
            if (lowerSession.endsWith('маленькими') || lowerSession.endsWith('строчными')) {
                setTextCaseMode('lower');
                textCaseModeRef.current = 'lower';
                recognition.stop();
                return;
            }
            if (lowerSession.endsWith('обычными') || lowerSession.endsWith('как в предложении')) {
                setTextCaseMode('normal');
                textCaseModeRef.current = 'normal';
                recognition.stop();
                return;
            }

            // --- ОБРАБОТКА КОМАНД НА ЛЕТУ ---
            const sendCommands = language === 'ru' ? ['отправить', 'послать'] : ['send', 'go'];
            const clearCommands = language === 'ru' ? ['очистить', 'удалить'] : ['clear', 'delete'];
            const undoCommands = language === 'ru' ? ['исправить', 'отменить'] : ['correct', 'undo'];

            // 1. КОМАНДА "ОТПРАВИТЬ"
            if (sendCommands.some(cmd => lowerSession.endsWith(cmd)) && !isSendingRef.current) {
                isSendingRef.current = true;
                shouldSendOnEndRef.current = true;
                recognition.stop(); // onend обработает отправку
                return;
            }

            // 2. КОМАНДА "ОЧИСТИТЬ"
            if (clearCommands.some(cmd => lowerSession.endsWith(cmd))) {
                baseTextRef.current = '';
                sessionFinalTextRef.current = '';
                setInput('');
                wasManuallyStoppedRef.current = true;
                recognition.stop();
                return;
            }
            
            // 3. КОМАНДА "ОТМЕНИТЬ"
            const undoCmd = undoCommands.find(cmd => lowerSession.endsWith(cmd));
            if (undoCmd) {
                const sessionTextBeforeCommand = sessionFinal.substring(0, sessionFinal.toLowerCase().lastIndexOf(undoCmd)).trim();

                if (sessionTextBeforeCommand) {
                    const match = sessionTextBeforeCommand.match(/\S+$/);
                    const correctedSession = match ? sessionTextBeforeCommand.substring(0, match.index).trim() : '';
                    sessionFinalTextRef.current = correctedSession;
                    const newFullText = baseTextRef.current + processNewLineCommands(correctedSession) + ' ';
                    setInput(newFullText);
                } else {
                    const base = baseTextRef.current.trim();
                    const match = base.match(/\S+$/);
                    const correctedBase = match ? base.substring(0, match.index).trim() : '';
                    baseTextRef.current = correctedBase ? correctedBase + ' ' : '';
                    sessionFinalTextRef.current = '';
                    setInput(baseTextRef.current);
                }
                
                recognition.stop();
                return;
            }
            
            // --- ВИЗУАЛИЗАЦИЯ ---
            let processedSession = processNewLineCommands(sessionFinal);
            processedSession = applyPunctuation(processedSession);
            if (isNumberModeRef.current) {
                processedSession = convertWordsToNumbers(processedSession);
            }
            processedSession = applyCaseMode(processedSession, textCaseModeRef.current)

            setInput(baseTextRef.current + processedSession + sessionInterim);
        };

        recognition.onend = () => {
            const serviceWords = [
                'цифрами', 'символами', 'буквами', 'текстом', 
                'заглавными', 'большими', 'маленькими', 'строчными', 'обычными', 'как в предложении'
            ];

            const processChunk = (text) => {
                let cleanPhrase = text.trim();
                let commandFound = false;

                for (const word of serviceWords) {
                    if (cleanPhrase.toLowerCase() === word) {
                        cleanPhrase = '';
                        commandFound = true;
                        break;
                    }
                }

                if (!commandFound) {
                    for (const word of serviceWords) {
                        const regex = new RegExp(`\\s+${word}$`, 'i');
                        if (regex.test(cleanPhrase)) {
                            cleanPhrase = cleanPhrase.replace(regex, '');
                            break;
                        }
                    }
                }

                if (!cleanPhrase) return '';

                let processed = processNewLineCommands(cleanPhrase);
                processed = applyPunctuation(processed);
                if (isNumberModeRef.current) {
                    processed = convertWordsToNumbers(processed);
                }
                return applyCaseMode(processed, textCaseModeRef.current);
            }

            // 1. ЛОГИКА ОТПРАВКИ
            if (shouldSendOnEndRef.current) {
                const processedText = processChunk(sessionFinalTextRef.current);
                const finalToSubmit = (baseTextRef.current + processedText).trim();
                const cleanText = finalToSubmit.replace(/(отправить|послать|send|go)\s*$/gi, '').trim();
                
                handleSendRef.current(cleanText);
                
                baseTextRef.current = '';
                sessionFinalTextRef.current = '';
                setInput('');
                setIsRecording(false);
                return;
            }

            // 2. ОБЫЧНОЕ ЗАВЕРШЕНИЕ ФРАЗЫ: фиксируем её в базу
            if (sessionFinalTextRef.current) {
                const processedText = processChunk(sessionFinalTextRef.current);
                if (processedText) {
                    // Add a space only if the text doesn't end with a newline
                    baseTextRef.current += processedText + (processedText.endsWith('\\n') ? '' : ' ');
                }
                sessionFinalTextRef.current = '';
            }
            
            setInput(baseTextRef.current);

            // 3. АВТО-РЕСТАРТ
            if (!wasManuallyStoppedRef.current) {
                if (restartTimeoutRef.current) clearTimeout(restartTimeoutRef.current);
                restartTimeoutRef.current = setTimeout(() => {
                    try {
                        if (!wasManuallyStoppedRef.current && recognitionRef.current) {
                            recognitionRef.current.start();
                        }
                    } catch (e) {
                        console.error("Ошибка авто-перезапуска распознавания:", e);
                        setIsRecording(false);
                    }
                }, 200);
            } else {
                setIsRecording(false);
            }
        };

        recognition.onerror = (event) => {
            if (event.error === 'no-speech' && !wasManuallyStoppedRef.current) {
                recognition.stop();
            } else if (event.error !== 'aborted') {
                console.error("Ошибка распознавания речи:", event.error);
                setIsRecording(false);
            }
        };

        return () => {
            if (restartTimeoutRef.current) clearTimeout(restartTimeoutRef.current);
            if (recognitionRef.current) {
                recognitionRef.current.onend = null;
                recognitionRef.current.stop();
            }
        };
    }, [language, processNewLineCommands, applyPunctuation, convertWordsToNumbers, applyCaseMode]);       

    const handleMicClick = () => {
        if (!recognitionRef.current) return;

        if (isRecording) {
            if (restartTimeoutRef.current) clearTimeout(restartTimeoutRef.current);
            wasManuallyStoppedRef.current = true;
            recognitionRef.current.stop();
        } else {
            baseTextRef.current = input ? input.trim() + ' ' : '';
            try {
                recognitionRef.current.start();
            } catch (e) {
                console.error("Не удалось начать распознавание:", e);
                setIsRecording(false);
            }
        }
    };
    // ------------------------ //

    const AdminPanel = ({ onClose }) => {
        const [tempSelections, setTempSelections] = useState({});

        useEffect(() => {
            const initialSelections = {};
            for (const serviceType in SERVICE_TYPE_MAP) {
                const activeKey = getActiveModelKeyGeneric(serviceType);
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
            alert('Настройки моделей обновлены!');
        };

        return (
            <div className="admin-modal-overlay" onClick={onClose}>
                <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
                    <button onClick={onClose} className="action-btn close-btn">&times;</button>
                    <h2>Настройка AI Моделей</h2>
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

    const storageUrl = `${CONFIG.STORAGE_GATEWAY}/vk?vk_user_id=${currentUserId}`;

    return (
        <div className="app-wrapper">
            {document.getElementById('sidebar') && createPortal(
            <Sidebar
            t={t}
            chatList={chatList || []} 
            currentChatId={currentChatId}
            onSelectChat={onSelectChat} 
            onDeleteChat={handleDeleteChat}
            onRenameChat={handleRenameChat}
            onAutoRenameChat={handleAutoRenameChat}
            userName={userName}
            isLoggedIn={isLoggedIn}
            userPhoto={userPhoto}
            isAdmin={isAdmin}
            />,
            document.getElementById('sidebar')
          )}

        <div 
            ref={appContainerRef}
            className={`app-container ${isDragging ? 'dragging' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
        >
            {showAdminPanel && <AdminPanel onClose={() => setShowAdminPanel(false)} />}
            
            <div 
                id="storage-modal" 
                className={`storage-modal ${isStorageVisible ? 'active' : ''}`}>
                <div className="storage-content" onClick={(e) => e.stopPropagation()}>
                    <div className="storage-header">
                        <span>🗄️ Приложение "Хранилка" by Leshiy</span>
                        <button 
                            id="close-storage" 
                            className="close-btn" 
                            onClick={() => setStorageVisible(false)}>
                            &times;
                        </button>
                    </div>
                    {isStorageVisible && <iframe 
                        id="storage-frame" 
                        src={storageUrl} 
                        title="Хранилка">
                    </iframe>}
                </div>
            </div>

            <div id="pull-to-refresh">
                <div id="ptr-loader" className="loader"></div>
                <span id="ptr-text">Потяните для обновления</span>
            </div>

            <header className="top">
                <img src="/Gemini.png" alt="Gemini AI" className="logo" />
                <h1>{t.title} <span>ECOSYSTEM</span></h1>
                <div className="top-actions">
                    <button className="action-btn" title={t.tooltip_toggle_lang} onClick={toggleLanguage}>{language === 'ru' ? '🇷🇺' : '🇺🇸'}</button>
                    <button className="action-btn" title={t.tooltip_toggle_theme} onClick={toggleTheme}>{theme === 'light' ? '☀️' : '🌙'}</button>
                    <button className="action-btn" title={t.tooltip_reload} onClick={softReload}>⟳</button>
                    <button className="action-btn close-btn" title={t.tooltip_close} onClick={closeApp}>✕</button>
                </div>
            </header>

            <div className="chat-window" ref={chatWindowRef}>
                {isFetchingMore && (
                    <div className="history-loader">
                        <div className="history-loader-bar"></div>
                    </div>
                )}
                {messages.map((m) => (
                    <Message key={m.id} message={m} onSwipe={handleSwipeMessage} onAction={handleMenuAction} />
                ))}
                {isLoading && !isFetchingMore && <div className="message-container ai"><div className="bubble typing">{t.thinking}</div></div>}
                <div ref={chatEndRef} />
            </div>
            
            <div className="input-area-container" onPaste={handlePaste}>

                <div className="input-area">
                    {/* ЛОГИКА ГОЛОСОВЫХ КОМАНД ИЛИ ПРЕВЬЮ ФАЙЛОВ */}
                    {(isRecording || files.length > 0) && (
                        <div className="file-preview-container">
                            {isRecording ? (
                                // Показываем команды, когда микрофон включен
                                <div className="voice-commands-hints">
                                    <div className="rec-indicator">
                                        <span className="rec-dot"></span>
                                        <span className="rec-label">REC</span>
                                    </div>
                                    <div className="hints-scroll">
                                        <button 
                                            className="hint-btn" 
                                            onClick={() => {
                                                const modes = ['normal', 'upper', 'lower'];
                                                const nextIndex = (modes.indexOf(textCaseMode) + 1) % modes.length;
                                                setTextCaseMode(modes[nextIndex]);
                                            }}
                                        >
                                            {textCaseMode === 'normal' && '🔤 Aa (Норм)'}
                                            {textCaseMode === 'upper' && '🔠 AA (ВЕРХ)'}
                                            {textCaseMode === 'lower' && '🔡 aa (низ)'}
                                        </button>
                                        <button 
                                            className={`hint-btn ${isNumberMode ? 'active-mode' : ''}`} 
                                            onClick={() => setIsNumberMode(prev => !prev)}
                                        >
                                            {isNumberMode ? '🔢 Цифрами' : '🔣 Буквами'}
                                        </button>
                                        <button className="hint-btn" onClick={() => {
                                            if (restartTimeoutRef.current) clearTimeout(restartTimeoutRef.current);
                                            handleSend(input);
                                            wasManuallyStoppedRef.current = true;
                                            recognitionRef.current?.stop();
                                        }}>🆗 Отправить</button>

                                        <button className="hint-btn" onClick={() => {
                                            const currentInput = input.trim();
                                            const match = currentInput.match(/\S+$/);
                                            const correctedText = match ? currentInput.substring(0, match.index).trim() : '';
                                            baseTextRef.current = correctedText ? correctedText + ' ' : '';
                                            sessionFinalTextRef.current = '';
                                            setInput(baseTextRef.current);
                                            if (recognitionRef.current && isRecording) {
                                                recognitionRef.current.stop();
                                            }
                                        }}>Отменить</button>

                                        <button className="hint-btn" onClick={() => {
                                            const newValue = input + '\\n';
                                            baseTextRef.current = newValue;
                                            setInput(newValue);
                                        }}>Новая строка</button>

                                        <button className="hint-btn" onClick={() => {
                                            if (restartTimeoutRef.current) clearTimeout(restartTimeoutRef.current);
                                            baseTextRef.current = '';
                                            sessionFinalTextRef.current = '';
                                            setInput('');
                                            wasManuallyStoppedRef.current = true;
                                            recognitionRef.current?.stop();
                                        }}>Очистить</button>
                                    </div>
                                </div>
                            ) : (
                                // Твой стандартный рендер файлов
                                files.map(file => {
                                    const type = file.file.type;
                                    const name = file.file.name;
                                    let icon = '📎';
                                    if (type.startsWith('video/')) icon = '🎬';
                                    else if (type.startsWith('audio/') || name.endsWith('.mp3')) icon = '🎵';
                                    else if (name.endsWith('.zip') || name.endsWith('.rar')) icon = '📦';
                                    else if (name.endsWith('.pdf') || name.endsWith('.doc') || name.endsWith('.docx')) icon = '📄';

                                    return (
                                        <div key={file.id} className="file-preview-item">
                                            {file.preview ? (
                                                <img src={file.preview} className="image-preview" alt="preview" />
                                            ) : (
                                                <div className="file-preview-icon">{icon}</div>
                                            )}
                                            <button onClick={() => removeFile(file.id)} className="clear-file-btn">✕</button>
                                            <span className="file-preview-name">{name}</span>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    )}
                    <button id="input-add-btn" className="tool-btn" title={t.tooltip_add_file} onClick={() => fileInputRef.current.click()}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14m-7-7h14"/></svg>
                    </button>
                    <textarea 
                        ref={textareaRef}
                        rows="1"
                        value={input} 
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSend(input);
                            }
                        }}
                        placeholder={t.placeholder(files)}
                    />
                    <div className="model-selector-container" ref={modelSelectorRef}>
                        <button id="input-model-selector" className="tool-btn model-selector-btn" title={t.tooltip_select_model} onClick={() => setIsModelSelectorOpen(prev => !prev)}>
                           {activeTttModel.icon}
                        </button>
                        {isModelSelectorOpen && (
                            <div className="model-selector-dropdown">
                                {TEXT_TO_TEXT_MODELS_SELECTOR.map(model => (
                                    <button
                                        key={model.key}
                                        className={`model-option ${activeTttModelKey === model.key ? 'active' : ''}`}
                                        onClick={() => handleModelSelect(model.key)}
                                    >
                                        <span className="model-option-icon">{model.icon}</span>
                                        <span className="model-option-name">{model.name}</span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                     <button id="input-mic-btn" className={`tool-btn ${isRecording ? 'recording' : ''}`} title={t.tooltip_record_voice} onClick={handleMicClick}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3zM19 10v2a7 7 0 0 1-14 0v-2M12 19v4"/></svg>
                    </button>
                    <button className="send-btn" title={t.tooltip_send} onClick={() => handleSend(input)} disabled={isLoading || (!input.trim() && files.length === 0)}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
                    </button>
                </div>
                <div className="input-footer">
                    {t.version} {process.env.APP_VERSION} &bull; {t.author}: {process.env.APP_AUTHOR}
                </div>
            </div>

            <input 
                type="file" 
                multiple
                accept="image/*,audio/*,video/*"
                ref={fileInputRef} 
                style={{ display: 'none' }} 
                onChange={(e) => handleFileSelect(e.target.files)}
            />
        </div>
        </div>
    );
}

export default App;
