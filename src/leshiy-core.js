import { CONFIG } from './config';
import { loadActiveModelConfig } from './ai-config';
import axios from 'axios'; // Добавляем axios для работы со шлюзом хранилища

const SYSTEM_PROMPT = `Ты — многофункциональный AI-ассистент Gemini AI от Leshiy, отвечающий на русском языке.
Твоя задача — вести диалог, отвечать на вопросы и помогать пользователю с функциями приложения.
Ответы должны быть информативными и доброжелательными со смайликами.`;

export const askLeshiy = async ({ text, files = [] }) => {
    const userQuery = text?.trim() || "";
    const lowerQuery = userQuery.toLowerCase();
    const hasFiles = files.length > 0;

    // ==========================================================
    // 1. ЛОГИКА ЭКОСИСТЕМЫ: ПЕРЕХВАТ КОМАНД ДЛЯ ХРАНИЛКИ
    // ==========================================================
    if (lowerQuery.includes('/storage') || lowerQuery.includes('хранил')) {
        return {
            type: 'menu',
            text: '📂 **Меню Хранилки Leshiy-AI**\nВыберите облачный сервис для настройки или авторизации:',
            buttons: [
                { text: '🔵 Yandex Disk', action: 'auth_yandex' },
                { text: '🟠 Google Drive', action: 'auth_google' },
                { text: '🟠 Dropbox', action: 'auth_dropbox' },
                { text: '🟣 Mail.ru (WebDAV)', action: 'auth_mailru' },
                { text: '📁 FTP/SFTP', action: 'auth_ftp' },
                { text: '⚙️ Статус дисков', action: 'storage_status' }
            ]
        };
    }

    if (lowerQuery.includes("сохрани") || lowerQuery.includes("/upload")) {
        if (!hasFiles) return { type: 'error', text: "❌ Нечего сохранять. Прикрепите файлы!" };
        
        try {
            // Обрабатываем все прикрепленные файлы
            for (const fileData of files) {
                const formData = new FormData();
                // Если есть живой файл (Blob/File) из инпута
                if (fileData.file) {
                    formData.append('file', fileData.file);
                } 
                // Если есть только base64 (например, вставка из буфера), конвертируем в Blob
                else if (fileData.base64) {
                    const blob = await (await fetch(`data:${fileData.mimeType};base64,${fileData.base64}`)).blob();
                    formData.append('file', blob, `upload_${Date.now()}.${fileData.mimeType.split('/')[1]}`);
                }
                
                formData.append('chat_id', CONFIG.ADMIN_CHAT_ID || "235663624");

                // Шлем в твой STORAGE_GATEWAY (как в leshiy-storage-bot.js)
                await axios.post(CONFIG.STORAGE_GATEWAY, formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
            }
            return { type: 'text', text: "✅ **Экосистема: Хранилка**\nВсе файлы успешно приняты и отправлены в твоё облако! ☁️" };
        } catch (err) {
            return { type: 'error', text: `❌ Ошибка Хранилки: ${err.message}` };
        }
    }

    // ==========================================================
    // 2. ОПРЕДЕЛЕНИЕ ТИПА СЕРВИСА И ЗАГРУЗКА МОДЕЛИ
    // ==========================================================
    let serviceType = 'TEXT_TO_TEXT';
    const firstFileObj = hasFiles ? files[0].file : null;

    if (firstFileObj) {
        if (firstFileObj.type.startsWith('image/')) serviceType = 'IMAGE_TO_TEXT';
        else if (firstFileObj.type.startsWith('audio/')) serviceType = 'AUDIO_TO_TEXT';
        else if (firstFileObj.type.startsWith('video/')) serviceType = 'VIDEO_TO_TEXT';
    }

    const config = loadActiveModelConfig(serviceType);
    if (!config) return { type: 'error', text: `Модель для ${serviceType} не настроена` };

    let url, body, authHeader;
    let isRawBody = false;

    // ==========================================================
    // 3. ФОРМИРОВАНИЕ BODY ПОД ПРОВАЙДЕРА (Твой восстановленный код)
    // ==========================================================
    switch (config.SERVICE) {
        case 'GEMINI':
            url = `${config.BASE_URL}/models/${config.MODEL}:generateContent?key=${CONFIG[config.API_KEY]}`;
            const prompt = text || (hasFiles ? "Проанализируй эти файлы" : "Привет");
            const parts = [{ text: `${SYSTEM_PROMPT}\n\nЗапрос: ${prompt}` }];

            files.forEach(f => {
                if (f.base64) parts.push({ inlineData: { mimeType: f.mimeType, data: f.base64 } });
            });
            body = { contents: [{ parts }] };
            break;

        case 'CLOUDFLARE':
        case 'WORKERS_AI':
            url = `${config.BASE_URL}/${CONFIG.CLOUDFLARE_ACCOUNT_ID}/ai/run/${config.MODEL}`;
            authHeader = `Bearer ${CONFIG[config.API_KEY]}`;
            const firstFileData = files[0];

            if (serviceType.includes('AUDIO') || serviceType.includes('VIDEO')) {
                body = await firstFileData.file.arrayBuffer();
                isRawBody = true;
            } else if (serviceType.includes('IMAGE')) {
                const byteString = atob(firstFileData.base64);
                const byteArray = new Uint8Array(byteString.length);
                for (let i = 0; i < byteString.length; i++) byteArray[i] = byteString.charCodeAt(i);
                body = { image: Array.from(byteArray), prompt: text || "Опиши изображение" };
            } else {
                body = {
                    messages: [{ role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content: text }],
                    stream: false
                };
            }
            break;

        case 'BOTHUB':
            url = `${config.BASE_URL}/chat/completions`;
            authHeader = `Bearer ${CONFIG[config.API_KEY]}`;
            const userContent = [{ type: 'text', text: text || "Опиши это" }];
            files.forEach(f => {
                if (f.base64) userContent.push({ type: 'image_url', image_url: { url: `data:${f.mimeType};base64,${f.base64}` } });
            });
            body = { model: config.MODEL, messages: [{ role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content: userContent }] };
            break;
    }

    // ==========================================================
    // 4. ОТПРАВКА ЧЕРЕЗ ТВОЙ ПРОКСИ
    // ==========================================================
    try {
        const proxyHeaders = {
            'X-Target-URL': url,
            'X-Proxy-Secret': CONFIG.PROXY_SECRET_KEY,
            'Content-Type': isRawBody ? 'application/octet-stream' : 'application/json'
        };
        if (authHeader) proxyHeaders['X-Proxy-Authorization'] = authHeader;

        const response = await fetch(CONFIG.PROXY_URL, {
            method: 'POST',
            headers: proxyHeaders,
            body: isRawBody ? body : JSON.stringify(body),
        });

        if (!response.ok) throw new Error(`Ошибка API: ${response.status}`);

        const data = await response.json();
        let resultText = "Не удалось разобрать ответ.";

        if (config.SERVICE === 'GEMINI') resultText = data.candidates?.[0]?.content?.parts?.[0]?.text;
        else if (config.SERVICE === 'BOTHUB') resultText = data.choices?.[0]?.message?.content;
        else if (config.SERVICE === 'CLOUDFLARE' || config.SERVICE === 'WORKERS_AI') resultText = data.result?.response || data.result?.text;
        
        return { type: 'text', text: resultText || "Получен пустой ответ от AI." };

    } catch (error) {
        return { type: 'error', text: `❌ Ошибка сети: ${error.message}` };
    }
};