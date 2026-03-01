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
    
    // 1. ПЕРЕМЕННЫЕ
    const SITE_APP_ID = "54467300"; // ID для авторизации на сайте
    const VK_MINI_APP_ID = "54419010"; // ID мини-приложения Хранилка
    const gateway = CONFIG.STORAGE_GATEWAY;
    
    // Пытаемся достать ID из URL (например, при переходе по реф-ссылке)
    const params = new URLSearchParams(window.location.search);
    const urlId = params.get('user_id');
    if (urlId) localStorage.setItem('vk_user_id', urlId);

    const currentUserId = localStorage.getItem('vk_user_id') || urlId;
    const userId = currentUserId || CONFIG.ADMIN_CHAT_ID;

    // Вспомогательная функция для форматирования размера
    const formatSize = (bytes) => {
        if (!bytes || bytes === 0) return '0 ГБ';
        return (bytes / (1024 ** 3)).toFixed(2) + ' ГБ';
    };

    // ==========================================================
    // 1. ЛОГИКА ЭКОСИСТЕМЫ: ГЛАВНОЕ МЕНЮ И КОМАНДЫ
    // ==========================================================
    
    if (lowerQuery === '/storage' || lowerQuery === 'хранилка') {
        // --- СЦЕНАРИЙ А: НУЖНА АВТОРИЗАЦИЯ В VK ---
        if (!currentUserId) {
            const VKID = window.VKIDSDK;
            const overlay = document.getElementById('vk_auth_overlay');
            const container = document.getElementById('vk_auth_container');

            if (overlay && container) {
                container.innerHTML = ''; 
                overlay.style.display = 'flex'; 

                VKID.Config.init({
                    app: SITE_APP_ID, 
                    redirectUrl: 'https://leshiy-ai.github.io',
                    responseMode: VKID.ConfigResponseMode.Callback,
                    source: VKID.ConfigSource.LOWCODE,
                });

                const oneTap = new VKID.OneTap();
                oneTap.render({
                    container: container,
                    showAlternativeLogin: true,
                    oauthList: ['mail_ru', 'ok_ru']
                })
                .on(VKID.OneTapInternalEvents.LOGIN_SUCCESS, function (payload) {
                    VKID.Auth.exchangeCode(payload.code, payload.device_id)
                        .then((data) => {
                            const vkid = data.user_id || data.id; 
                            if (vkid) {
                                localStorage.setItem('vk_user_id', vkid);
                                overlay.style.display = 'none';
                                // Вместо alert и reload шлем событие обновления
                                window.dispatchEvent(new CustomEvent('send-bot-command', { detail: '/storage' }));
                            }
                        });
                });

                return { type: 'text', text: `⚙️ **Открываю окно входа...**` };
            }
        }

        // --- СЦЕНАРИЙ Б: УЖЕ АВТОРИЗОВАН (Запрос статуса и квоты) ---
        try {
            // Сначала берем общий статус (там providerName и currentFolder)
            const statusRes = await axios.get(`${gateway}/?action=get-status&userId=${userId}`);
            const status = statusRes.data;

            if (!status.isConnected) {
                return {
                    type: 'menu',
                    text: `🗄 **Хранилка не подключена**\n\nВыберите облако для хранения ваших файлов:`,
                    buttons: [
                        { text: '🔗 Подключить Диск', action: '/storage_auth' },
                        { text: '🤝 Хранилка друга', action: '/storage_invite' },
                        { text: '🔙 Назад', action: '/start' }
                    ]
                };
            }

            // Затем берем квоту
            const quotaRes = await axios.get(`${gateway}/api/get-quota?vk_user_id=${userId}`);
            const { used, total } = quotaRes.data;
            
            return {
                type: 'menu',
                text: `🗄 **Главное меню Хранилки**\n\n✅ Подключено: ${status.providerName || 'Облако'}\n📂 Папка: \`${status.currentFolder || 'Root'}\`\n📊 Место: ${formatSize(used)} из ${formatSize(total)}`,
                buttons: [
                    { text: '📁 Мои Папки', action: '/storage_list' },
                    { text: '➕ Создать папку', action: '/create_folder_prompt' },
                    { text: '🤝 Поделиться', action: '/storage_invite' },
                    { text: '🔌 Отключить', action: '/storage_disconnect' }
                ]
            };
        } catch (e) {
            console.error("Ошибка API Хранилки:", e);
            return {
                type: 'menu',
                text: `🗄 **Главное меню Хранилки**\n\n⚠️ Ошибка связи с сервером.`,
                buttons: [{ text: '🔙 Назад', action: '/start' }]
            };
        }
    }

    // АВТОРИЗАЦИЯ ОБЛАКОВ (Выбор провайдера)
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

    // ИНВАЙТ-ССЫЛКА (Рефералка)
    if (lowerQuery === '/storage_invite') {
        try {
            const res = await axios.get(`${gateway}/api/create-invite?userId=${userId}`);
            // Используем ID мини-приложения для ссылки
            const inviteLink = `https://vk.com/app${VK_MINI_APP_ID}#ref=${res.data.inviteCode}`;

            return {
                type: 'text',
                text: `🤝 **Твоя реферальная ссылка**\n\nОтправь её другу, чтобы он мог сохранять файлы в твою папку:\n\n🔗 ${inviteLink}`,
                buttons: [{ text: '🔙 Назад', action: '/storage' }]
            };
        } catch (e) {
            return { type: 'error', text: '❌ Ошибка API при создании инвайта.' };
        }
    }

    // ОТКЛЮЧЕНИЕ ОБЛАКА
    if (lowerQuery === '/storage_disconnect') {
        try {
            await axios.post(`${gateway}/api/disconnect`, { userId: userId });
            return { 
                type: 'text', 
                text: '📴 **Диск успешно отключен.**\nАвтозагрузка прекращена, данные в облаке сохранены.',
                buttons: [{ text: '🔙 В меню', action: '/storage' }]
            };
        } catch (e) {
            return { type: 'error', text: '❌ Ошибка при отключении.' };
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
                    text: '📁 **Ваши папки в облаке:**\nВыберите папку для сохранения файлов:',
                    buttons: [...folderButtons.slice(0, 10), { text: '🔙 Назад', action: '/storage' }]
                };
            }
            return { 
                type: 'text', 
                text: '⚠️ Папки не найдены.',
                buttons: [{ text: '➕ Создать папку', action: '/create_folder_prompt' }, { text: '🔙 Назад', action: '/storage' }]
            };
        } catch (e) { return { type: 'error', text: '❌ Ошибка: Облако не отвечает.' }; }
    }

    // СМЕНА ПАПКИ (POST запрос на /api/select-folder)
    if (lowerQuery.startsWith('/set_folder_')) {
        const folderId = userQuery.replace(/\/set_folder_/i, '').trim();
        try {
            const res = await axios.post(`${gateway}/api/select-folder`, {
                userId: userId,
                folderId: folderId
            });

            if (res.data.success) {
                return { 
                    type: 'text', 
                    text: `✅ **Папка успешно изменена!**\nТекущая папка: \`${folderId}\``,
                    buttons: [{ text: '🔙 В меню', action: '/storage' }]
                };
            } else {
                throw new Error(res.data.error || 'Ошибка сервера');
            }
        } catch (e) {
            return { type: 'error', text: `❌ Ошибка смены папки: ${e.message}` };
        }
    }

    // СОЗДАНИЕ ПАПКИ
    if (lowerQuery.startsWith('/create_folder_')) {
        const folderName = userQuery.replace(/\/create_folder_/i, '').trim();
        try {
            const res = await axios.post(`${gateway}/api/create-folder`, {
                userId: userId,
                name: folderName
            });
            if (res.data.success) {
                return { 
                    type: 'text', 
                    text: `📂 Папка **${folderName}** создана и установлена как активная!`,
                    buttons: [{ text: '🔙 В меню', action: '/storage' }]
                };
            }
        } catch (e) {
            return { type: 'error', text: `❌ Ошибка создания папки: ${e.message}` };
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