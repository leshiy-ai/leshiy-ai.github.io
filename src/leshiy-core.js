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
    // 1. ОБЪЯВЛЯЕМ ВСЕ ПЕРЕМЕННЫЕ (чтобы не было ошибок "is not defined")
    const vk_app_id = "54467300";
    const redirect_uri = encodeURIComponent("https://leshiy-ai.github.io");
    
    // Пытаемся безопасно достать ID из URL (на случай если мы только что вернулись из ВК)
    const params = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.replace('#', '?'));
    const urlId = params.get('user_id') || hashParams.get('user_id');
    
    // Итоговый userId для запросов к Хранилке
    const userId = urlId || localStorage.getItem('vk_user_id') || CONFIG.ADMIN_CHAT_ID || "3930898";
    const gateway = CONFIG.STORAGE_GATEWAY;

    // Сохраняем ID в память, если он пришел в URL
    if (urlId) {
        localStorage.setItem('vk_user_id', urlId);
    }
    // ==========================================================
    // 1. ЛОГИКА ЭКОСИСТЕМЫ: ГЛАВНОЕ МЕНЮ И КОМАНДЫ
    // ==========================================================
    
    if (lowerQuery === '/storage' || lowerQuery === 'хранилка') {
        // Если пользователь еще не авторизован через ВК (нет ID в памяти)
        if (!localStorage.getItem('vk_user_id') && !urlId) {
            // Чистая ссылка без лишних scope
            const vkAuthUrl = `https://oauth.vk.com/authorize?client_id=${vk_app_id}&display=page&redirect_uri=${redirect_uri}&response_type=token&v=5.131`;
            return {
                type: 'menu',
                text: `👋 **Добро пожаловать в Хранилку!**\n\nДля работы с облачными дисками нужно авторизоваться через ВК.`,
                buttons: [
                    { 
                        text: '🔐 Войти через VK OAuth', 
                        action: vkAuthUrl // Теперь handleMenuAction поймет, что это ссылка
                    },
                    { text: '🤖 Спросить ИИ', action: '/ai_help' }
                ]
            };
        }

        // Если авторизован — СРАЗУ тянем квоту и показываем статус в меню
        try {
            const res = await axios.get(`${gateway}/api/get-quota?vk_user_id=${userId}`);
            const { used, total, providerName } = res.data;
            const usedGB = (used / (1024 ** 3)).toFixed(2);
            const totalGB = (total / (1024 ** 3)).toFixed(2);

            return {
                type: 'menu',
                text: `🗄 **Главное меню Хранилки**\n\n✅ Подключено: ${providerName || 'Облако'}\n📊 Место: ${usedGB} ГБ из ${totalGB} ГБ`,
                buttons: [
                    { text: '📁 Мои Папки', action: '/storage_list' },
                    { text: '🔗 Подключить Диск', action: '/storage_auth' },
                    { text: '🤝 Хранилка друга', action: '/storage_invite' },
                    { text: '🤖 Спросить ИИ', action: '/ai_help' }
                ]
            };
        } catch (e) {
            return {
                type: 'menu',
                text: `🗄 **Главное меню Хранилки**\n\n⚠️ Диск не подключен или ошибка API.`,
                buttons: [
                    { text: '🔗 Подключить Диск', action: '/storage_auth' },
                    { text: '🤝 Хранилка по ссылке', action: '/storage_invite' },
                    { text: '🔙 Назад', action: '/start' }
                ]
            };
        }
    }

    // АВТОРИЗАЦИЯ ОБЛАКОВ
    if (lowerQuery === '/storage_auth') {
        return {
            type: 'menu',
            text: '🔗 **Подключение облака**\nВыберите провайдера для авторизации:',
            buttons: [
                { text: '🔵 Yandex Disk', action: 'auth_yandex' },
                { text: '🟠 Google Drive', action: 'auth_google' },
                { text: '🔵 Dropbox', action: 'auth_dropbox' },
                { text: '🟣 Mail.ru (WebDAV)', action: 'auth_mailru' },
                { text: '📁 FTP/SFTP', action: 'auth_ftp' },
                { text: '🔌 Свой WebDAV', action: 'auth_webdav' },
                { text: '🔙 Назад', action: '/storage' }
            ]
        };
    }

    // ИНВАЙТ-ССЫЛКА
    if (lowerQuery === '/storage_invite') {
        try {
            const res = await axios.get(`${gateway}/api/create-invite?userId=${userId}`);
            const inviteLink = `https://vk.com/app${VK_APP_ID}#ref=${res.data.inviteCode}`;

            return {
                type: 'text',
                text: `🤝 **Твоя реферальная ссылка**\n\nОтправь её другу, чтобы он мог сохранять файлы в твою папку:\n\n🔗 ${inviteLink}`,
                buttons: [{ text: '🔙 Назад', action: '/storage' }]
            };
        } catch (e) {
            return { type: 'error', text: '❌ Ошибка API при создании инвайта.' };
        }
    }

    // СПИСОК ПАПОК
    if (lowerQuery === '/storage_list') {
        try {
            const res = await axios.get(`${gateway}/api/list-folders?vk_user_id=${userId}`);
            if (Array.isArray(res.data) && res.data.length > 0) {
                const folderButtons = res.data.map(f => ({
                    text: `📂 ${f.name}`,
                    action: `/set_folder_${f.id}` 
                }));
                return {
                    type: 'menu',
                    text: '📁 **Ваши папки в облаке:**',
                    buttons: [...folderButtons.slice(0, 8), { text: '🔙 Назад', action: '/storage' }]
                };
            }
            return { type: 'text', text: '⚠️ Папки не найдены.' };
        } catch (e) { return { type: 'error', text: '❌ Ошибка: Облако не отвечает.' }; }
    }

    // СМЕНА ПАПКИ
    if (lowerQuery.startsWith('/set_folder_')) {
        const folderId = lowerQuery.replace('/set_folder_', '');
        try {
            await axios.get(`${gateway}/api/set-active-folder?vk_user_id=${userId}&folder_id=${folderId}`);
            return { 
                type: 'text', 
                text: `📁 Папка успешно изменена!\nТеперь все файлы будут сохраняться сюда.`,
                buttons: [{ text: '🔙 В меню', action: '/storage' }]
            };
        } catch (e) {
            return { type: 'error', text: '❌ Ошибка при смене папки.' };
        }
    }

    // СТАТУС (КВОТА) - как отдельная команда тоже оставляем
    if (lowerQuery === '/storage_status' || lowerQuery === 'статус') {
        try {
            const res = await axios.get(`${gateway}/api/get-quota?vk_user_id=${userId}`);
            const { used, total, providerName } = res.data;
            const usedGB = (used / (1024 ** 3)).toFixed(2);
            const totalGB = (total / (1024 ** 3)).toFixed(2);
            return {
                type: 'text',
                text: `✅ **Подключено:** ${providerName || 'Облако'}\n📊 **Место:** ${usedGB} ГБ из ${totalGB} ГБ`,
                buttons: [{ text: '📁 Показать папки', action: '/storage_list' }, { text: '🔙 Назад', action: '/storage' }]
            };
        } catch (e) {
            return { type: 'text', text: '❌ Облако не подключено.', buttons: [{ text: '🔗 Подключить', action: '/storage_auth' }] };
        }
    }

    // ЗАГРУЗКА ФАЙЛОВ
    if (lowerQuery.includes("сохрани") || lowerQuery.includes("/upload") || hasFiles) {
        if (!hasFiles) return { type: 'text', text: "Прикрепите файл! 📎" };

        try {
            const formData = new FormData();
            files.forEach((f, i) => {
                formData.append(`file${i}`, f.file); 
            });

            await axios.post(`${gateway}/api/upload-multipart`, formData, {
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