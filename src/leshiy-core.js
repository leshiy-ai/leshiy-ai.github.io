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
    
    // ГЛАВНОЕ МЕНЮ /STORAGE
    if (lowerQuery === '/storage' || lowerQuery === 'хранилка') {
        return {
            type: 'menu',
            text: `🗄 **Главное меню Хранилки**\n\nЗдесь ты можешь управлять своими облаками, проверять место и настраивать доступ для друзей.`,
            buttons: [
                { text: '📊 Статус и Квота', action: '/storage_status' },
                { text: '📁 Мои Папки', action: '/storage_list' },
                { text: '🔗 Подключить Диск', action: '/storage_auth' },
                { text: '🤝 Хранилка по ссылке', action: '/storage_invite' },
                { text: '🤖 Спросить ИИ', action: '/ai_help' }
            ]
        };
    }

    // МЕНЮ ВСЕХ ДОСТУПНЫХ ДИСКОВ (/storage_auth)
    if (lowerQuery === '/storage_auth') {
        return {
            type: 'menu',
            text: '🌐 **Доступные сервисы**\nВыбери, что хочешь подключить:',
            buttons: [
                // OAuth сервисы (идут через твой API GW)
                { text: '🔵 Яндекс Диск', action: `${STORAGE_GATEWAY}/auth/yandex?state=${userId}` },
                { text: '🟠 Google Drive', action: `${STORAGE_GATEWAY}/auth/google?state=${userId}` },
                { text: '🔵 Dropbox', action: `${STORAGE_GATEWAY}/auth/dropbox?state=${userId}` },
                
                // Сервисы с ручной настройкой (через веб-интерфейс приложения)
                { text: '🟣 Облако Mail.ru (WebDAV)', action: `${STORAGE_GATEWAY}/vk#webdav` },
                { text: '📁 FTP / SFTP Server', action: `${STORAGE_GATEWAY}/vk#ftp` },
                { text: '🔌 Свой WebDAV', action: `${STORAGE_GATEWAY}/vk#webdav` },
                
                { text: '🔙 Назад', action: '/storage' }
            ]
        };
    }

    // ХРАНИЛКА ПО ССЫЛКЕ (Инвайты)
    if (lowerQuery === '/storage_invite') {
        try {
            // Создаем инвайт-код через твой эндпоинт /api/create-invite
            const res = await axios.get(`${STORAGE_GATEWAY}/api/create-invite?userId=${userId}`);
            const inviteCode = res.data.inviteCode;
            const inviteLink = `https://vk.com/app51745507#invite=${inviteCode}`;

            return {
                type: 'text',
                text: `🤝 **Твоя реферальная ссылка**\n\nОтправь её другу, чтобы он мог сохранять файлы в твою папку:\n\n🔗 ${inviteLink}`,
                buttons: [{ text: '🔙 Назад', action: '/storage' }]
            };
        } catch (e) {
            return { type: 'error', text: '❌ Не удалось создать инвайт-ссылку.' };
        }
    }

    // СТАТУС (КВОТА)
    if (lowerQuery === '/storage_status' || lowerQuery === 'статус') {
        try {
            const res = await axios.get(`${STORAGE_GATEWAY}/api/get-quota?vk_user_id=${userId}`);
            const { used, total, providerName } = res.data;
            
            const usedGB = (used / (1024 ** 3)).toFixed(2);
            const totalGB = (total / (1024 ** 3)).toFixed(2);
            
            return {
                type: 'text',
                text: `✅ **Подключено:** ${providerName || 'Облако'}\n📊 **Место:** ${usedGB} ГБ из ${totalGB} ГБ`,
                buttons: [
                    { text: '📁 Показать папки', action: '/storage_list' },
                    { text: '🔙 Назад', action: '/storage' }
                ]
            };
        } catch (e) {
            return { 
                type: 'text', 
                text: '❌ Облако не подключено или сессия истекла.',
                buttons: [{ text: '🔗 Подключить', action: '/storage_auth' }]
            };
        }
    }

    // СПИСОК ПАПОК
    if (lowerQuery === '/storage_list') {
        try {
            const res = await axios.get(`${STORAGE_GATEWAY}/api/list-folders?vk_user_id=${userId}`);
            
            // Твой бэк возвращает массив объектов [{id, name}, ...]
            if (Array.isArray(res.data) && res.data.length > 0) {
                const folderButtons = res.data.map(f => ({
                    text: `📂 ${f.name}`,
                    action: `/set_folder_${f.id}` 
                }));
                return {
                    type: 'menu',
                    text: '📁 **Ваши папки в облаке:**\nВыберите папку назначения:',
                    buttons: [...folderButtons.slice(0, 8), { text: '🔙 Назад', action: '/storage' }]
                };
            }
            return { 
                type: 'text', 
                text: '⚠️ Папки не найдены.\nУбедитесь, что сервис выбран по умолчанию в приложении ВК.',
                buttons: [{ text: '🔗 Подключить диск', action: '/storage_auth' }]
            };
        } catch (e) { return { type: 'error', text: '❌ Ошибка: Облако не отвечает.' }; }
    }

    // ЗАГРУЗКА ФАЙЛОВ (/api/upload-multipart)
    if (lowerQuery.includes("сохрани") || lowerQuery.includes("/upload") || files.length > 0) {
        if (files.length === 0) return { type: 'text', text: "Прикрепите файл, и я отправлю его в Хранилку! 📎" };

        try {
            const formData = new FormData();
            // Твой обработчик handleVkUploadMultipart ожидает файлы в стандартном формате
            files.forEach((f, i) => {
                // Если у тебя base64, конвертируем в Blob или шлем как есть, если бэк готов
                formData.append(`file${i}`, f.file); 
            });

            const res = await axios.post(`${STORAGE_GATEWAY}/api/upload-multipart`, formData, {
                headers: { 'x-vk-user-id': userId }
            });

            return { type: 'text', text: '✅ Файлы успешно улетели в облако!' };
        } catch (e) { return { type: 'error', text: '❌ Ошибка загрузки: ' + e.message }; }
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