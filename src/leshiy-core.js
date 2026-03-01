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
    const userId = CONFIG.ADMIN_CHAT_ID || "3930898";

    // ==========================================================
    // 1. ЛОГИКА ЭКОСИСТЕМЫ: ПЕРЕХВАТ КОМАНД ДЛЯ ХРАНИЛКИ
    // ==========================================================
    // 1. Главное меню
    if (lowerQuery === '/storage' || lowerQuery === 'хранилка') {
        return {
        type: 'menu',
        text: '📂 Меню Хранилки Leshiy-AI\nВыберите действие:',
        buttons: [
            { text: '📁 Выбрать папку', action: '/storage_list' },
            { text: '⚙️ Статус дисков', action: '/storage_status' },
            { text: '🔗 Привязать диск', action: '/storage_auth' }
        ]
        };
    }
    
    // 2. Эндпоинт статуса
    if (lowerQuery === '/storage_status') {
        try {
        const res = await axios.get(CONFIG.STORAGE_GATEWAY + '?user_id=' + userId + '&action=status');
        return {
            type: 'text',
            text: '📊 Статус:\n' + (res.data.message || 'Система готова'),
            buttons: [{ text: '🔙 Назад', action: '/storage' }]
        };
        } catch (e) { return { type: 'error', text: '❌ Ошибка API статуса' }; }
    }
    
    // 3. Динамический список папок
    if (lowerQuery === '/storage_list') {
        try {
        const res = await axios.get(CONFIG.STORAGE_GATEWAY + '?user_id=' + userId + '&action=list_folders');
        if (res.data.folders && res.data.folders.length > 0) {
            const folderButtons = res.data.folders.map(f => ({
            text: '📂 ' + f.name,
            action: '/set_folder_' + f.id
            }));
            return {
            type: 'menu',
            text: '📁 Выберите папку в облаке:',
            buttons: [...folderButtons, { text: '🔙 Назад', action: '/storage' }]
            };
        }
        return { type: 'text', text: '⚠️ Папки не найдены. Проверьте авторизацию.' };
        } catch (e) { return { type: 'error', text: '❌ Ошибка получения списка папок' }; }
    }
    // 4. Меню авторизации
    if (lowerQuery === '/storage_auth') {
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
            const response = await axios.post(CONFIG.STORAGE_GATEWAY, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
        
            // ВСТАВКА НОВОЙ ЛОГИКИ ПРОВЕРКИ:
            const resData = response.data;
            if (resData && (resData.status === 'error' || resData.error)) {
                throw new Error(resData.message || resData.error || 'Ошибка шлюза');
            }
            
            // Если всё ок, продолжаем...
            return { success: true, message: "Файл успешно сохранен!" };
        } catch (error) {
            console.error("Ошибка загрузки:", error.message);
            return { success: false, error: error.message };
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