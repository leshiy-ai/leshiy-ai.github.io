import { CONFIG } from './config';
import { version } from '../package.json';
import { AI_MODELS, loadActiveModelConfig } from './ai-config';
import axios from 'axios'; // Добавляем axios для работы со шлюзом хранилища

// =================================================================
// SECTION: Вспомогательные функции для аудио и конвертации
// =================================================================

/**
 * Конвертирует строку Base64 в ArrayBuffer. Браузерная версия.
 * @param {string} base64 - Строка в формате Base64.
 * @returns {ArrayBuffer}
 */
function base64ToArrayBuffer(base64) {
    const binary_string = window.atob(base64);
    const len = binary_string.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binary_string.charCodeAt(i);
    }
    return bytes.buffer;
}

/**
 * Отправляет сырой PCM ArrayBuffer на сервер для конвертации в MP3.
 * @param {ArrayBuffer} pcmBuffer - Сырые PCM-данные.
 * @returns {Promise<ArrayBuffer>} - ArrayBuffer с MP3-данными.
 */
async function convertPcmToMp3(pcmBuffer) {
    if (!CONFIG.MP3_CONVERTER_URL) {
        throw new Error("URL для PCM->MP3 конвертера не настроен в CONFIG.MP3_CONVERTER_URL");
    }
    try {
        console.log(`[MP3_CONVERTER] Отправка ${pcmBuffer.byteLength} байт PCM на ${CONFIG.MP3_CONVERTER_URL}`);
        const response = await fetch(CONFIG.MP3_CONVERTER_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/octet-stream' },
            body: pcmBuffer,
            signal: AbortSignal.timeout(30000) // 30 секунд таймаут
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Сервис конвертации MP3 вернул ошибку ${response.status}: ${errorText}`);
        }
        
        const mp3Buffer = await response.arrayBuffer();
        console.log(`[MP3_CONVERTER] Успешно получено ${mp3Buffer.byteLength} байт MP3.`);
        return mp3Buffer;
    } catch (error) {
        console.error("❌ Критическая ошибка конвертации PCM в MP3:", error);
        throw error;
    }
}

const SYSTEM_PROMPT = `Ты — многофункциональный AI-ассистент Gemini AI от Leshiy, отвечающий на русском языке.
Твоя задача — вести диалог, отвечать на вопросы и помогать пользователю с функциями приложения.
Ответы должны быть информативными и доброжелательными со смайликами и на русском языке.`;

export const askLeshiy = async ({ text, files = [], history = [], isSystemTask = false, currentMode = 1 }) => {
    let userQuery = text?.trim() || "";
    let lowerQuery = userQuery.toLowerCase();
    const hasFiles = files.length > 0;

    // --- НОВАЯ ЛОГИКА РЕЖИМОВ ---
    if (!isSystemTask) { // Системные задачи (типа заголовков) не трогаем
        if (currentMode === 2) {
            console.log("Движок: Генерация фото");
            // Тут позже прикрутим вызов генератора картинок
        } else if (currentMode === 3) {
            console.log("Движок: Генерация аудио");
        } else if (currentMode === 4) {
            console.log("Движок: Генерация видео");
        }
    }

    // --- УМНЫЙ РЕЖИМ: Авто-промпт для медиа ---
    if (hasFiles) {
        const firstFile = files[0];
        // Если текста нет ИЛИ текст — это просто имя файла
        if (!userQuery || userQuery === firstFile.file.name) {
            if (firstFile.file.type.startsWith('image/')) {
                userQuery = "Опиши это изображение.";
            } else if (firstFile.file.type.startsWith('audio/')) {
                userQuery = "Расшифруй это аудио.";
            } else if (firstFile.file.type.startsWith('video/')) {
                userQuery = "Что на этом видео?";
            }
            lowerQuery = userQuery.toLowerCase(); // Обновляем lowerQuery
        }
    }
    
    // 1. ПЕРЕМЕННЫЕ
    const SITE_APP_ID = "54467300"; // ID для авторизации на сайте
    const VK_MINI_APP_ID = "54419010"; // ID мини-приложения Хранилка
    const gateway = CONFIG.STORAGE_GATEWAY;
    const currentVersion = process.env.APP_VERSION;

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

    // ПЕРЕХВАТ СТЕЙТА (в самом начале обработки сообщения)
    let pendingAction = sessionStorage.getItem('pending_action');

    if (pendingAction === 'waiting_for_search' && !userQuery.startsWith('/')) {
        userQuery = `/search ${userQuery}`;
        lowerQuery = userQuery.toLowerCase(); 
        sessionStorage.removeItem('pending_action');
    } else if (userQuery.startsWith('/')) {
        sessionStorage.removeItem('pending_action');
    }

    // ==========================================================
    // 1. ЛОГИКА ЭКОСИСТЕМЫ: ГЛАВНОЕ МЕНЮ И КОМАНДЫ
    // ==========================================================
    
    // Команда вызова меню Хранилки
    if (lowerQuery === '/storage' || lowerQuery.includes('хранилк')) {
        sessionStorage.removeItem('pending_action');
        // Если НЕ авторизован — показываем только кнопку входа
        if (!currentUserId) {
            return {
                type: 'menu',
                text: '🔐 **Вход в Хранилку**\n\nДля доступа к вашим файлам необходимо авторизоваться.',
                buttons: [
                    { text: '🆔 Войти через VK ID', action: '/auth_init_vk' },
                    { text: '🆔 Войти через Telegram', action: '/auth_init_tg' }
                ]
            };
        }

        // --- ЕСЛИ АВТОРИЗОВАН (Запрос статуса и квоты) ---
        try {
            const statusRes = await axios.get(`${gateway}/?action=get-status&userId=${userId}`);
            const status = statusRes.data;

            if (!status.isConnected) {
                return {
                    type: 'menu',
                    text: `🗄 **Хранилка не подключена**\n\nВыберите облако для хранения ваших файлов:`,
                    buttons: [
                        { text: '🔗 Подключить Диск', action: '/storage_auth' },
                        { text: '🤝 Хранилка друга', action: '/storage_friends' },
                        { text: '📁 Мои Папки', action: '/storage_list' },
                        { text: '🔙 Назад', action: '/storage' }
                    ]
                };
            }

            const quotaRes = await axios.get(`${gateway}/api/get-quota?vk_user_id=${userId}`);
            const { used, total } = quotaRes.data;
            
            return {
                type: 'menu',
                text: `🗄 **Главное меню Хранилки**\n\n✅ Подключено: ${status.providerName}\n📂 Папка: \`${status.currentFolder || 'Root'}\`\n📊 Место: ${formatSize(used)} из ${formatSize(total)}`,
                buttons: [
                    { text: '🔗 Подключить Диск', action: '/storage_auth' },
                    { text: '📁 Мои Папки', action: '/storage_list' },
                    { text: '🔎 Поиск файлов', action: '/search' },
                    { text: '🤝 Поделиться', action: '/storage_invite' },
                    { text: '🔙 Назад', action: '/storage' }
                ]
            };
        } catch (e) {
            return { type: 'menu', text: `⚠️ Ошибка связи с сервером.`, buttons: [{ text: '🔙 Назад', action: '/storage' }] };
        }
    }

    // DEBUG INFO
    if (lowerQuery === '/debug') {
        // Собираем актуальные данные на лету
        const storedIsAdmin = localStorage.getItem('isAdmin') === 'true';
        const userId = localStorage.getItem('vk_user_id') || 'Not Set';
        const userName = localStorage.getItem('vk_user_name') || 'Guest';
        const authProvider = localStorage.getItem('auth_provider') || 'Anonymous';
        const lastStatus = window.lastServerResponse?.status || 'Unknown' // Ответ от get-status

        const debugTemplate = `
    🛠 **DEBUG INFO**
    --------------------------
    🆔 **User ID:** \`${userId}\`
    👤 **User Name:** ${userName}
    🔐 **Auth:** ${
        authProvider === 'Telegram' ? '🟩 Telegram' : 
        authProvider === 'VK' ? '🟦 VKontakte' : 
        '🟫 Anonymous'
    }
    📡 **Server Status:** ${lastStatus === 200 ? '✅ OK' : '⚠️ Check Network'}
    🕒 **Server Time:** ${new Date().toLocaleTimeString()}
    👥 **Role:** ${storedIsAdmin ? '🅰️ Admin' : '👤 User'}
    📦 **Version:** v${currentVersion}
            `.trim();

        return {
            id: Date.now(),
            text: debugTemplate,
            sender: 'bot',
            type: 'system_debug'
        }
    }

    // НОВЫЙ ОБРАБОТЧИК: Инициализация VK ID по клику
    if (lowerQuery === '/auth_init_vk') {
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
                            // Бросаем событие для глобального стейта
                            window.dispatchEvent(new CustomEvent('vk-auth-success', { detail: vkid }));
                            // Авто-переход в меню
                            //window.dispatchEvent(new CustomEvent('send-bot-command', { detail: '/storage' }));
                        }
                    });
            });

            return { type: 'text', text: '⚡️ **Окно входа ВКонтакте открыто!**' };
        }
    }

    // НОВЫЙ ОБРАБОТЧИК: Инициализация Telegram OAUth по клику
    if (lowerQuery === '/auth_init_tg') {
        //const overlay = document.getElementById('tg_auth_overlay');
        //const container = document.getElementById('tg_auth_container');
        // Генерируем событие, чтобы TelegramAuthModal в main.jsx показал модальное окно
        window.dispatchEvent(new CustomEvent('sidebar-tg-auth'));
        // Возврат из handleTelegramRedirect в main.jsx для выполнения команды /storage
        //window.dispatchEvent(new CustomEvent('send-bot-command', { detail: '/storage' }));
        return { type: 'text', text: '⚡️ **Окно входа в Telegram открыто!**' };
    }

    // АВТОРИЗАЦИЯ ОБЛАКОВ (Выбор провайдера)
    if (lowerQuery === '/storage_auth') {
        return {
            type: 'menu',
            text: '🔗 **Подключение облака**\nВыберите провайдера для авторизации:',
            buttons: [
                { text: '☁️ Yandex Disk', action: 'auth_yandex' },
                { text: '☁️ Google Drive', action: 'auth_google' },
                { text: '☁️ Dropbox', action: 'auth_dropbox' },
                { text: '✉️ Mail.ru (WebDAV)', action: '/storage_form_webdav' },
                { text: '🌐 FTP/SFTP/WebDAV', action: '/storage_custom' },
                { text: '🤝 Хранилка друга', action: '/storage_friends' },
                { text: '📁 Выбор папки', action: '/storage_list' },
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
                    text: '📁 **Ваши папки в облаке:**\n\nВыберите папку для сохранения файлов:',
                    buttons: [...folderButtons.slice(0, 20), 
                        { text: '➕ Создать папку', action: '/storage_folder_prompt' },
                        { text: '🔙 Назад', action: '/storage' }]
                };
            }
            return { 
                type: 'text', 
                text: '⚠️ Папки не найдены.',
                buttons: [{ text: '➕ Создать папку', action: 'storage_folder_prompt' }, { text: '🔙 Назад', action: '/storage' }]
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

    // --- ДИАЛОГ СОЗДАНИЯ ПАПКИ ---
    if (lowerQuery === '/storage_folder_prompt') {
        // Сохраняем в сессию флаг, что ждем имя папки
        sessionStorage.setItem('pending_action', 'create_folder');
        return {
            type: 'text',
            text: '📝 **Введите название новой папки:**\n\nПришлите название текстовым сообщением.',
            buttons: [{ text: '❌ Отмена', action: '/storage' }]
        };
    }

    // --- ОБРАБОТКА ТЕКСТОВОГО ВВОДА ДЛЯ ПАПКИ ---
    // Если в сессии висит флаг и это не системная команда (не начинается с /)
    if (sessionStorage.getItem('pending_action') === 'create_folder' && !userQuery.startsWith('/')) {
        sessionStorage.removeItem('pending_action'); // Сбрасываем флаг
        
        try {
            const res = await axios.post(`${gateway}/api/create-folder`, {
                userId: userId,
                name: userQuery // Используем введенный текст как имя
            });
            
            if (res.data.success) {
                return { 
                    type: 'text', 
                    text: `📂 Папка **${userQuery}** успешно создана!`,
                    buttons: [{ text: '🔙 В меню', action: '/storage' }]
                };
            }
        } catch (e) {
            return { type: 'error', text: `❌ Ошибка создания: ${e.message}` };
        }
    }

    // --- ЛОГИКА: ПОДКЛЮЧЕНИЕ ПО ССЫЛКЕ ---
    // 1. Обработка кнопки "Хранилка друга" (вызываем меню подключения)
    if (lowerQuery === '/storage_friends') {
        // Сохраняем в сессию флаг, что ждем имя папки
        sessionStorage.setItem('pending_action', 'connect_friends');
        return {
            type: 'menu',
            text: '🤝 **Подключение к Хранилке друга**\n\nВведите ссылку которую Вам предоставил друг, чтобы сохранять файлы в его облако.',
            buttons: [
                { text: '🔙 Назад', action: '/storage' }
            ]
        };
    }

    // Если пользователь прислал ссылку на хранилку
    if (lowerQuery.includes('leshiy-storage') && lowerQuery.includes('ref=')) {
        // Проверяем, что мы реально ждали эту ссылку (опционально, можно и без флага)
        if (sessionStorage.getItem('pending_action') === 'connect_friends') {
            sessionStorage.removeItem('pending_action'); 
            
            try {
                // Парсим ID друга из ссылки
                const parts = userQuery.split('?');
                if (parts.length < 2) throw new Error('Некорректная ссылка');
                
                const urlParams = new URLSearchParams(parts[1]);
                const friendId = urlParams.get('ref');
    
                if (!friendId) throw new Error('ID друга (ref) не найден');
    
                // Запрос в твой шлюз (воркер)
                const res = await axios.get(`${CONFIG.STORAGE_GATEWAY}?user_id=${userId}&action=connect_ref&ref_id=${friendId}`);
    
                return {
                    type: 'text',
                    text: '🤝 **Хранилка друга подключена!**\n\n' + (res.data.message || 'Связь установлена. Используется облако друга.'),
                    buttons: [
                        { text: '📁 Список папок', action: '/storage_list_folders' },
                        { text: '🔙 В меню', action: '/storage' }
                    ]
                };
            } catch (err) {
                return { type: 'error', text: '❌ Ошибка подключения: ' + err.message };
            }
        }
    }

    // --- ЛОГИКА: СВОИ СЕРВЕРА ---
    if (lowerQuery === 'auth_webdav' || lowerQuery === '/storage_custom') {
        return {
            type: 'menu',
            text: '📁 **Настройка своего сервера**\n\nВы можете подключить личное хранилище по протоколам FTP, SFTP или WebDAV.',
            buttons: [
                { text: '🌐 WebDAV (Облако Mail.Ru)', action: '/storage_form_webdav' },
                { text: '🔒 FTP', action: '/storage_form_ftp' },
                { text: '🔐 SFTP', action: '/storage_form_sftp' },
                { text: '🔙 Назад', action: '/storage_auth' }
            ]
        };
    }

    // Заглушка для форм (лучше вести на веб-морду твоего шлюза)
    if (lowerQuery.startsWith('/storage_form')) {
        sessionStorage.setItem('pending_action', 'setup_server');
        const protocol = lowerQuery.includes('ftp') ? 'FTP/SFTP' : 'WebDAV';
        return {
            type: 'text',
            text: `⚙️ **Подключение своего сервера ${protocol}**\n\nПросто пришлите строку в формате:\nпротокол://логин:пароль@хост\n\n**Примеры:**\n• webdav://user:pass@webdav.yandex.ru\n• ftp://admin:12345@92.255.162.189:21\n• sftp://root:password@my-server.com`,
            buttons: [{ text: '🔙 Назад', action: '/storage_auth' }]
        };
    }

    // 2. Перехват строки подключения
    if (sessionStorage.getItem('pending_action') === 'setup_server') {
        sessionStorage.removeItem('pending_action');
        try {
            // Парсим строку (стандартный формат URL)
            const setupUrl = new URL(userQuery.replace('webdav://', 'https://')); // Фикс для парсера
            
            const payload = {
                userId: userId,
                fullUrl: userQuery,
                host: setupUrl.hostname,
                user: decodeURIComponent(setupUrl.username),
                pass: decodeURIComponent(setupUrl.password),
                folderId: 'Root'
            };

            // Шлем POST запрос в твой эндпоинт Cloudflare
            const res = await axios.post(`${CONFIG.STORAGE_GATEWAY.replace('/api', '')}/api/setup-webdav`, payload);

            if (res.data.success) {
                return {
                    type: 'text',
                    text: res.data.message || '✅ Сервер успешно подключен!',
                    buttons: [
                        { text: '📁 Выбор папки', action: '/storage_list' },
                        { text: '🔙 В меню', action: '/storage' }
                    ]
                };
            } else {
                throw new Error(res.data.message || 'Ошибка сервера');
            }
        } catch (err) {
            return { 
                type: 'error', 
                text: '❌ Неверный формат! Убедитесь, что указали логин и пароль.\nПример: `ftp://user:pass@host`' 
            };
        }
    }

    // ЗАГРУЗКА ФАЙЛОВ (Умный режим)
    if (lowerQuery.includes("сохрани") || lowerQuery.includes("/upload")) {
    
        // Если команда есть, а файла нет — ругаемся
        if (!hasFiles) return { type: 'text', text: "Прикрепите файл, который нужно сохранить! 📎" };

        try {
            for (const f of files) {
                // 1. Читаем файл как ArrayBuffer (чистые байты), чтобы бэк не тупил
                const arrayBuffer = await f.file.arrayBuffer();

                // 2. Шлем на эндпоинт загрузки буфера
                const uploadUrl = `${gateway}/api/upload-buffer`; 

                await axios.post(uploadUrl, arrayBuffer, {
                    params: {
                        // Передаем параметры через URL, так как тело занято байтами
                        chat_id: userId,
                        filename: f.file.name
                    },
                    headers: { 
                        'Content-Type': f.file.type || 'application/octet-stream',
                        'x-vk-user-id': userId,
                        'x-file-name': encodeURI(f.file.name), // Бэк может брать имя отсюда
                        'x-file-size': f.file.size
                    }
                });
            }

            return { type: 'text', text: '✅ Файлы успешно улетели в облако!' };
        } catch (e) { 
            console.error("Критическая ошибка аплоада:", e.response?.data || e.message);
            return { type: 'error', text: '❌ Ошибка: ' + (e.response?.data?.error || e.message) }; 
        }
    }

    // ==========================================================
    // ПОИСК И СКАЧИВАНИЕ ФАЙЛОВ С ХРАНИЛКИ
    // ==========================================================
    if (lowerQuery.startsWith('/search') || lowerQuery.startsWith('найди') || lowerQuery.startsWith('поиск')) {
        // 1. Разбираем запрос на части
        const parts = userQuery.split(' ');
        let offset = 0;
        
        // Проверяем, есть ли число (offset) в конце для пагинации
        const lastPart = parseInt(parts[parts.length - 1]);
        if (!isNaN(lastPart) && parts.length > 1) {
            offset = lastPart;
            parts.pop();
        }

        // 2. Чистим поисковую фразу
        let searchTerm = parts.join(' ')
            .replace(/\/search|найди|поиск/gi, '')
            .trim();

        // --- ПРОВЕРКА НА ПУСТОЙ ВВОД ---
        // Если поискового слова нет И это не переход по страницам (offset === 0)
        if (!searchTerm && offset === 0) {
            // ЗАПОМИНАЕМ ШАГ: выставляем pending_action
            sessionStorage.setItem('pending_action', 'waiting_for_search');

            return { 
                type: 'text', 
                text: '🔍 **Режим поиска**\n\nВведите название файла, расширение (например, `jpg`) или часть имени.\n\n_Я жду вашего ввода..._',
            };
        }
        if (!searchTerm) {
            return { type: 'text', text: '🔍 Что именно искать? Напишите, например: *найди сейф*' };
        }
    
        try {
            // Очищаем экшн, так как поиск уже начался
            sessionStorage.removeItem('pending_action');

            // Сначала запрашиваем актуальный статус подключения
            const statusRes = await axios.get(`${gateway}/?action=get-status&userId=${userId}`);
            const status = statusRes.data;
            
            const currentP = status.provider || '';
            const currentF = status.currentFolder || '';

            // Запрос к API (оставляем как было)
            const res = await axios.get(`${gateway}/api/search?q=${encodeURIComponent(searchTerm)}&userId=${userId}`);
            const allFiles = res.data.results || [];
    
            if (allFiles.length === 0) {
                return { type: 'text', text: `🤷‍♂️ По запросу «${searchTerm}» ничего не найдено.` };
            }

            // РЕЖЕМ СЛАЙСОМ: берем 10 штук начиная с offset
            const files = allFiles.slice(offset, offset + 10);

            // --- ЛОГИКА СВЕТОФОРА ---
            const fileButtons = files.slice(0, 10).map(f => {
                // 1. Опознавание типа для иконки
                const ext = f.fileName.split('.').pop().toLowerCase();
                let emoji = '📄';
                // Если это голос или музыка — ставим соответствующие иконки
                if (['mp3', 'wav', 'ogg', 'm4a'].includes(ext) || f.fileType.includes('audio')) {
                    emoji = (f.fileName.toLowerCase().includes('voice') || f.fileType.includes('voice')) ? '🎤' : '🎵';
                } else if (['jpg', 'jpeg', 'png', 'gif'].includes(ext) || f.fileType.includes('photo')) {
                    emoji = '🖼️';
                } else if (['mp4', 'mov', 'avi'].includes(ext) || f.fileType.includes('video')) {
                    emoji = '🎬';
                }
    
            // 2. Светофор (сравнение провайдера и папки)
            let statusEmoji = '🟢'; 
            if (f.provider !== currentP) statusEmoji = '🔴';
            else if (f.folderId !== currentF) statusEmoji = '🟡';

            // 3. ССЫЛКА НА СКАТЫВАНИЕ (с сохранением параметров для ИИ-обработки)
            // Мы прокидываем type, чтобы воркер понимал: это голос (нужен транскрипт) или музыка (нужен Shazam)
            const downloadUrl = `${CONFIG.STORAGE_GATEWAY}/api/download` + 
                                `?path=${encodeURIComponent(f.folderId)}` + 
                                `&name=${encodeURIComponent(f.fileName)}` + 
                                `&type=${encodeURIComponent(f.fileType)}` + // ПЕРЕДАЕМ ТИП ДЛЯ ИИ
                                `&userId=${userId}`;

            return {
                text: `${statusEmoji} ${emoji} ${f.fileName}`,
                action: downloadUrl
                };
            });

            // Формируем кнопки навигации
            const navButtons = [];
            if (allFiles.length > offset + 10) {
                // Кнопка "Далее" просто отправляет команду боту с новым смещением
                navButtons.push({ text: '➡️ Далее', action: `/search ${searchTerm} ${offset + 10}` });
            }
            if (offset > 0) {
                navButtons.push({ text: '⬅️ Назад', action: `/search ${searchTerm} ${Math.max(0, offset - 10)}` });
            }

            return {
                type: 'menu',
                text: `🔍 **Результаты (${offset + 1}–${Math.min(offset + 10, allFiles.length)} из ${allFiles.length}):**\n\n` +
                      `🟢 — можно скачать\n` +
                      `🟡 — в другой папке\n` +
                      `🔴 — смените диск\n\n` +
                      `Нажмите на файл для загрузки:`,
                      buttons: [...fileButtons, ...navButtons, { text: '🔙 В меню', action: '/storage' }]
            };
        } catch (e) {
            console.error("Search error:", e);
            return { type: 'error', text: '⚠️ Ошибка при поиске файлов.' };
        }
    }

    // ==========================================================
    // 2. ОПРЕДЕЛЕНИЕ ТИПА СЕРВИСА И ЗАГРУЗКА МОДЕЛИ
    // ==========================================================
    let url, body, authHeader;
    let isRawBody = false;
    let config;
    let serviceType = 'TEXT_TO_TEXT';

    if (isSystemTask) {
        // Принудительно используем Cloudflare для системных задач, как и было указано.
        config = AI_MODELS['TEXT_TO_TEXT_CLOUDFLARE']; 
        
        if (!config) {
            console.error("❌ Ошибка: Системная модель TEXT_TO_TEXT_CLOUDFLARE не найдена.");
            return { type: 'error', text: 'Системная модель (Cloudflare) не настроена.' };
        }

        url = `${config.BASE_URL}/${CONFIG.CLOUDFLARE_ACCOUNT_ID}/ai/run/${config.MODEL}`;
        authHeader = `Bearer ${CONFIG[config.API_KEY]}`;
        
        const systemInstruction = text; // `text` - это системный промпт от App.jsx
        
        // `history` - это полный массив сообщений (JSON) из чата
        const messagesForCloudflare = history
        .map(h => {
            const msgText = typeof h.content === 'string' ? h.content : (h.text || "");
            const role = (h.role === 'model' || h.role === 'ai' || h.role === 'assistant') ? 'assistant' : 'user';
            return msgText.trim() ? `${role === 'user' ? 'Пользователь' : 'Ассистент'}: ${msgText}` : null;
        })
        .filter(Boolean)
        .slice(-6) // Последние 6 реплик — этого за глаза для названия
        .join("\n");
        
        body = {
            messages: [
                { role: 'system', content: systemInstruction },
                ...messagesForCloudflare
            ],
            stream: false
        };
        
        // ОТПРАВЛЯЕМ И СРАЗУ ВОЗВРАЩАЕМ
        const response = await fetch(CONFIG.PROXY_URL, {
            method: 'POST',
            mode: 'cors',
            headers: {
                'Content-Type': 'application/json',
                'X-Target-URL': url, // Прокси должен знать, куда слать
                'X-Proxy-Secret': CONFIG.PROXY_SECRET_KEY,
                'X-Proxy-Authorization': `Bearer ${CONFIG[config.API_KEY]}`
            },
            body: JSON.stringify(body)
        });

        const data = await response.json();
        const resultText = data?.result?.response || "Новый чат";
        
        return { text: resultText, type: 'text' }; // Возвращаем объект, который ждет App.jsx

    } else {
        const firstFileObj = hasFiles ? files[0].file : null;
        if (firstFileObj) {
            if (firstFileObj.type.startsWith('image/')) serviceType = 'IMAGE_TO_TEXT';
            else if (firstFileObj.type.startsWith('audio/')) serviceType = 'AUDIO_TO_TEXT';
            else if (firstFileObj.type.startsWith('video/')) serviceType = 'VIDEO_TO_TEXT';
            console.log("🧩 [DEBUG] Файл определен:", {
                name: firstFileObj?.name,
                type: firstFileObj?.type,
                size: firstFileObj?.size
            });
        }

        config = loadActiveModelConfig(serviceType);
        if (!config) return { type: 'error', text: `Модель для ${serviceType} не настроена` };

        // --- ЛОГ: Какая модель выбрана ---
        const friendlyModelName = `${config.SERVICE} (${config.MODEL})`;
        console.log(`🧠 AI-Модель для ${serviceType}: ${friendlyModelName}`);
        
        // ==========================================================
        // 3. ФОРМИРОВАНИЕ BODY ПОД ПРОВАЙДЕРА
        // ==========================================================
        switch (config.SERVICE) {
            case 'GEMINI':
                url = `${config.BASE_URL}/models/${config.MODEL}:generateContent?key=${CONFIG[config.API_KEY]}`;

                // 1. Предварительная подготовка данных
                const geminiHistory = history || [];
                let cleanBase64 = "";

                // 1. КОНВЕРТАЦИЯ: Если есть файл, но нет Base64 — достаем его
                if (firstFileObj) {
                    if (files[0].base64) {
                        const raw = files[0].base64;
                        cleanBase64 = raw.includes(',') ? raw.split(',')[1] : raw;
                    } else {
                        // ЧИТАЕМ БЫСТРО И АСИНХРОННО
                        try {
                            cleanBase64 = await new Promise((resolve, reject) => {
                                const reader = new FileReader();
                                reader.onload = () => {
                                    const res = reader.result;
                                    resolve(res.split(',')[1]); // Сразу отрезаем заголовок
                                };
                                reader.onerror = reject;
                                reader.readAsDataURL(firstFileObj); // Это ОЧЕНЬ быстро
                            });
                        } catch (e) {
                            console.error("❌ Ошибка FileReader:", e);
                        }
                    }
                }
                
                // 2. Формируем части сообщения (текст пользователя)
                let currentUserParts = [];
                if (userQuery) currentUserParts.push({ text: userQuery });

                // 3. Распределяем логику по типу сервиса
                if (firstFileObj && (serviceType.includes('AUDIO') || serviceType.includes('VIDEO'))) {
                    const isVideo = serviceType.includes('VIDEO');
                    const systemPrompt = `РОЛЬ: Ты эксперт по распознаванию речи. ТВОЯ ЦЕЛЬ: Транскрибировать ${isVideo ? 'видео' : 'аудио'} файл СТРОГО на РУССКОМ языке. Верни ТОЛЬКО текст.`;

                    body = {
                        system_instruction: { parts: [{ text: systemPrompt }] },
                        contents: [{
                            role: 'user',
                            parts: [
                                { text: `Транскрибируй этот ${isVideo ? 'видео' : 'аудио'} файл.` },
                                { 
                                    inlineData: { 
                                        mimeType: firstFileObj.type, // Тот самый из твоего дебага
                                        data: cleanBase64 
                                    } 
                                }
                            ]
                        }],
                        generationConfig: { temperature: 0.1 }
                    };
                    console.log(`📡 [GEMINI] AUDIO_TO_TEXT: ${firstFileObj.name} (${cleanBase64.length} симв.)`);

                } else if (firstFileObj && serviceType.includes('IMAGE')) {
                    // Добавляем картинку в части сообщения
                    currentUserParts.push({ 
                        inlineData: { mimeType: firstFileObj.type, data: cleanBase64 } 
                    });

                    body = { 
                        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
                        contents: [{ role: 'user', parts: currentUserParts }],
                        generationConfig: { maxOutputTokens: 2048, temperature: 0.2 }
                    };
                    console.log("👁 Gemini: Режим VISION (Image)");

                } else {
                    // --- ОБЫЧНЫЙ ЧАТ ---
                    body = { 
                        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
                        contents: [...geminiHistory, { role: 'user', parts: currentUserParts }],
                    };
                    console.log("💬 Gemini: Режим обычного диалога");
                }
                break;

            case 'CLOUDFLARE':
            case 'WORKERS_AI':
                url = `${config.BASE_URL}/${CONFIG.CLOUDFLARE_ACCOUNT_ID}/ai/run/${config.MODEL}`;
                authHeader = `Bearer ${CONFIG[config.API_KEY]}`;
                const firstFileData = files[0];

                if (serviceType.includes('AUDIO')) {
                    // Транскрибирует аудиофайл (ArrayBuffer), используя Workers AI (Whisper).
                    body = await firstFileData.file.arrayBuffer();
                    isRawBody = true;
                } else if (serviceType.includes('VIDEO')) {
                    // Транскрибирует видеофайл (ArrayBuffer), используя Workers AI (Whisper).
                    body = await firstFileData.file.arrayBuffer();
                    isRawBody = true;
                } else if (serviceType.includes('IMAGE')) {
                    // Распознавание картинки (Vision), используя Workers AI (Uform).
                    const byteString = atob(firstFileData.base64.split(',')[1] || firstFileData.base64);
                    const byteArray = new Uint8Array(byteString.length);
                    for (let i = 0; i < byteString.length; i++) byteArray[i] = byteString.charCodeAt(i);
                    // Промпт на английском (так Vision-модель поймет лучше всего)
                    const visionPrompt = `Instruction: ${userQuery}. (Task: Analyze the image and respond to the user's request in detail. Provide the description in English for further translation.)`;
                    body = { image: Array.from(byteArray), prompt: visionPrompt };
                } else {
                    const messages = [{ role: 'system', content: SYSTEM_PROMPT }];

                    if (history && history.length > 0) {
                        history.forEach(h => {
                            const role = h.role === 'model' ? 'assistant' : 'user';
                            if (h.parts && h.parts[0] && h.parts[0].text) {
                                messages.push({ role, content: h.parts[0].text });
                            }
                        });
                    }
                    
                    messages.push({ role: 'user', content: userQuery });
                    body = { messages, stream: false };
                }
                break;

            case 'BOTHUB':
                url = `${config.BASE_URL}/chat/completions`;
                authHeader = `Bearer ${CONFIG[config.API_KEY]}`;
                
                const botHubMessages = [{ role: 'system', content: SYSTEM_PROMPT }];

                if (history && history.length > 0) {
                    history.forEach(h => {
                        const role = h.role === 'model' ? 'assistant' : 'user';
                        if (h.parts && h.parts[0] && h.parts[0].text) {
                            botHubMessages.push({ role, content: h.parts[0].text });
                        }
                    });
                }
                
                const userContent = [{ type: 'text', text: userQuery }];
                files.forEach(f => {
                    if (f.base64) userContent.push({ type: 'image_url', image_url: { url: `data:${f.mimeType};base64,${f.base64}` } });
                });
                
                botHubMessages.push({ role: 'user', content: userContent });
                body = { model: config.MODEL, messages: botHubMessages };
                break;

            case 'DEEPSEEK':
                url = `${config.BASE_URL}/chat/completions`;
                authHeader = `Bearer ${CONFIG[config.API_KEY]}`;
                
                const deepseekMessages = [{ role: 'system', content: SYSTEM_PROMPT }];

                if (history && history.length > 0) {
                    history.forEach(h => {
                        const role = h.role === 'model' ? 'assistant' : 'user';
                        if (h.parts && h.parts[0] && h.parts[0].text) {
                            deepseekMessages.push({ role, content: h.parts[0].text });
                        }
                    });
                }
                
                deepseekMessages.push({ role: 'user', content: userQuery });
                
                body = {
                    model: config.MODEL,
                    messages: deepseekMessages,
                    stream: false
                };
                break;
        }
    }

    // ==========================================================
    // 4. ОТПРАВКА ЧЕРЕЗ ПРОКСИ С FALLBACK
    // ==========================================================
    try {
        const isBinary = isRawBody && (body instanceof ArrayBuffer || body instanceof Uint8Array);
        //let response;
    
        // Используем единую функцию для отправки запроса
        const response = await sendAIRequest(config, url, body, authHeader, isRawBody);

        /*
        // Общие заголовки для Яндекса и Cloudflare
        const commonProxyHeaders = {
            'X-Target-URL': url,
            'X-Proxy-Secret': CONFIG.PROXY_SECRET_KEY,
            'Content-Type': isBinary ? 'application/octet-stream' : 'application/json'
        };
        if (authHeader) commonProxyHeaders['X-Proxy-Authorization'] = authHeader;

        // --- БЛОК ДЕБАГА ПЕРЕД ОТПРАВКОЙ ---
        console.log("DEBUG SEND PROXY:", {
            url,
            isBinary: isBinary,
            body: isBinary ? "binary/string" : JSON.parse(JSON.stringify(body))
        });
        // -----------------------------------
    
        // --- ПОПЫТКА 1: Яндекс Прокси ---
        try {
            response = await fetch(CONFIG.PROXY_URL, {
                method: 'POST',
                mode: 'cors',
                headers: commonProxyHeaders,
                body: isBinary ? body : JSON.stringify(body)
            });
            if (!response.ok) throw response;
    
        } catch (error1) {
            // --- ПОПЫТКА 2: Cloudflare Прокси (Резерв) ---
            console.warn("Yandex Proxy failed, trying Attempt 2: Cloudflare...");
            try {
                response = await fetch(CONFIG.FALLBACK_PROXY, {
                    method: 'POST',
                    mode: 'cors',
                    headers: commonProxyHeaders,
                    body: isBinary ? body : JSON.stringify(body)
                });
                if (!response.ok) throw response;
    
            } catch (error2) {
                // --- ПОПЫТКА 3: Выделенный Gemini Прокси (Только для Gemini) ---
                const status2 = error2.status;
                const errorText2 = status2 ? await error2.text() : error2.message;
    
                // Проверяем, имеем ли мы право на последнюю попытку
                if (config.SERVICE === 'GEMINI') {
                    console.log("Cloudflare failed. Activating personal Gemini Proxy...");
                    try {
                        // Формируем URL: заменяем только домен на прокси
                        const geminiProxyUrl = url.replace(new URL(url).origin, CONFIG.GEMINI_PROXY);
                        
                        response = await fetch(geminiProxyUrl, {
                            method: 'POST',
                            mode: 'cors',
                            headers: {
                                'Content-Type': 'application/json',
                                'X-Proxy-Secret': CONFIG.GEMINI_PROXY_KEY
                            },
                            body: JSON.stringify(body)
                        });
                        
                        if (!response.ok) throw response;
    
                    } catch (error3) {
                        const status3 = error3.status;
                        const errorText3 = status3 ? await error3.text() : error3.message;
                        throw new Error(`Все 3 прокси отказали. Ошибка Gemini-Proxy (403/Geo?): ${status3} ${errorText3}`);
                    }
                } else {
                    // Если это не Gemini, и Cloudflare упал — всё, приехали
                    throw new Error(`Cloudflare Proxy также вернул ошибку: ${status2} ${errorText2}`);
                }
            }
        }*/
    
        // --- ОБРАБОТКА ФИНАЛЬНОГО РЕЗУЛЬТАТА ---
        const data = await response.json();
        let resultText = "Не удалось разобрать ответ.";

        // Логирование ответа от прокси и ИИ
        console.log("DEBUG RECEIVED PROXY:", data);

        if (config.SERVICE === 'GEMINI') resultText = data.candidates?.[0]?.content?.parts?.[0]?.text;
        else if (config.SERVICE === 'BOTHUB') resultText = data.choices?.[0]?.message?.content;
        else if (config.SERVICE === 'CLOUDFLARE' || config.SERVICE === 'WORKERS_AI') {
            resultText = data.result?.response || data.result?.description || data.result?.text || data.result;
            
            if (serviceType === 'IMAGE_TO_TEXT') {
                const englishDesc = data.result?.response || data.result?.description || data.result?.text || data.result;
                // Вызываем перевод с английского на русский
                resultText = await translateLeshiy(englishDesc, 'ru');
            }
        }
        else if (config.SERVICE === 'DEEPSEEK') resultText = data.choices?.[0]?.message?.content;
        return { type: 'text', text: resultText || "Получен пустой ответ от AI." };

    } catch (error) {
        console.error("AI request failed:", error);
        /*
        let friendlyMessage = "Произошла неизвестная ошибка.";
        const originalMessage = error.message || "";

        // 1. Проверяем на самые частые и понятные ошибки
        if (originalMessage.includes('quota') || originalMessage.includes('429')) {
            friendlyMessage = 'Исчерпан лимит запросов к этой модели. Попробуйте снова позже или выберите другую модель в настройках.';
        } else if (originalMessage.includes('Insufficient Balance') || originalMessage.includes('402')) {
            friendlyMessage = 'Закончились средства на балансе этой AI-модели. Пожалуйста, пополните баланс в личном кабинете провайдера.';
        } else if (originalMessage.includes('User location is not supported')) {
            friendlyMessage = 'Доступ к этой модели ограничен в вашем регионе. Резервный прокси не смог помочь.';
        } else if (originalMessage.includes('API key')) {
            friendlyMessage = 'Ключ API недействителен или отсутствует. Проверьте настройки.';
        } else if (originalMessage.includes('Failed to fetch')) {
            friendlyMessage = 'Сетевая ошибка. Проверьте подключение к интернету.';
        } else {
            // 2. Если не нашли, пытаемся вытащить сообщение из JSON
            const jsonMatch = originalMessage.match(/(\{.*\})/s);
            if (jsonMatch && jsonMatch[1]) {
                try {
                    const errorJson = JSON.parse(jsonMatch[1]);
                    const message = errorJson.error?.message || errorJson.message;
                    if (message && typeof message === 'string') {
                        // Берем только первую, самую информативную часть сообщения
                        friendlyMessage = message.split(/[\.|\n]/)[0];
                    } else {
                        // Если не смогли найти, оставляем как есть, но без JSON
                        friendlyMessage = originalMessage.substring(0, originalMessage.indexOf('{')).trim();
                    }
                } catch (e) {
                    // Если парсинг не удался, берем часть до JSON
                    const prefix = originalMessage.substring(0, originalMessage.indexOf('{')).trim();
                    friendlyMessage = prefix || originalMessage;
                }
            } else {
                // 3. Если ничего не подошло, выводим как есть
                friendlyMessage = originalMessage;
            }
        }*/

        //return { type: 'error', text: `❌ Ошибка: ${friendlyMessage}` };
        // ИСПОЛЬЗУЕМ НОВУЮ ФУНКЦИЮ ПРОВЕРКИ ОШИБОК
        return handleAiError(error);
    }

};

// =================================================================
// SECTION: Единая функция отправки AI запросов с прокси
// =================================================================
async function sendAIRequest(config, url, body, authHeader, isRawBody = false) {
    try {
        const isBinary = isRawBody && (body instanceof ArrayBuffer || body instanceof Uint8Array || body === null);
        let response;

        // Формируем заголовки для прокси
        const commonProxyHeaders = {
            'X-Target-URL': url,
            'X-Proxy-Secret': CONFIG.PROXY_SECRET_KEY,
            // Для бинарных запросов тип контента либо уже задан, либо не нужен (как для VoiceRSS)
            'Content-Type': isBinary ? (body ? 'application/octet-stream' : 'text/plain') : 'application/json'
        };
        // Добавляем авторизацию, если она нужна для целевого API
        if (authHeader) {
            commonProxyHeaders['X-Proxy-Authorization'] = authHeader;
        }
        
        // Для запросов, где тело не нужно (например, GET-запросы, обернутые в POST)
        const requestBody = body === null ? null : (isBinary ? body : JSON.stringify(body));

        console.log("DEBUG AI REQUEST:", {
            proxy: CONFIG.PROXY_URL,
            target: url,
            isBinary,
            hasBody: requestBody !== null,
            headers: commonProxyHeaders
        });

        // --- ПОПЫТКА 1: Основной прокси (Яндекс) ---
        try {
            response = await fetch(CONFIG.PROXY_URL, {
                method: 'POST',
                mode: 'cors',
                headers: commonProxyHeaders,
                body: requestBody
            });
            if (!response.ok) {
                 const errorText = await response.text();
                 throw new Error(`[Proxy 1] ${response.status}: ${errorText}`);
            }
        } catch (error1) {
            console.warn(`Основной прокси не удался: ${error1.message}. Пробую резервный...`);

            // --- ПОПЫТКА 2: Резервный прокси (Cloudflare) ---
            try {
                response = await fetch(CONFIG.FALLBACK_PROXY, {
                    method: 'POST',
                    mode: 'cors',
                    headers: commonProxyHeaders,
                    body: requestBody
                });
                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`[Proxy 2] ${response.status}: ${errorText}`);
                }
            } catch (error2) {
                 console.warn(`Резервный прокси не удался: ${error2.message}.`);

                // --- ПОПЫТКА 3: Выделенный прокси для Gemini (если применимо) ---
                if (config.SERVICE === 'GEMINI') {
                    console.log("Активирую персональный прокси для Gemini...");
                    try {
                        const geminiProxyUrl = url.replace(new URL(url).origin, CONFIG.GEMINI_PROXY);
                        
                        response = await fetch(geminiProxyUrl, {
                            method: 'POST',
                            mode: 'cors',
                            headers: {
                                'Content-Type': 'application/json',
                                'X-Proxy-Secret': CONFIG.GEMINI_PROXY_KEY
                            },
                            body: JSON.stringify(body) // Gemini всегда ждет JSON
                        });

                        if (!response.ok) {
                            const errorText = await response.text();
                            throw new Error(`[Proxy 3] ${response.status}: ${errorText}`);
                        }
                    } catch (error3) {
                         console.error(`Все 3 прокси не удались. Последняя ошибка (Gemini): ${error3.message}`);
                         throw error3; // Пробрасываем последнюю, самую специфичную ошибку
                    }
                } else {
                    // Если это не Gemini, и два основных прокси упали - пробрасываем вторую ошибку
                    throw error2;
                }
            }
        }
        
        // Если хотя бы один из прокси сработал, возвращаем успешный ответ
        return response;

    } catch (error) {
        // Логируем финальную ошибку, если ни один из методов не сработал
        console.error("❌ Финальная ошибка отправки AI-запроса:", error);
        // Пробрасываем ошибку выше, чтобы ее обработал вызывающий код (askLeshiy или generateAudio)
        throw error;
    }
}

// =================================================================
// SECTION: Универсальный обработчик ошибок AI
// =================================================================
/**
 * Обрабатывает ошибки от AI-сервисов и возвращает понятное сообщение.
 * @param {Error} error - Объект ошибки.
 * @returns {{type: string, text: string}} - Объект ошибки для отображения в чате.
 */
function handleAiError(error) {
    console.error("AI request failed:", error);
    let friendlyMessage = "Произошла неизвестная ошибка.";
    const originalMessage = (error && error.message) ? String(error.message) : "";
    // 1. Проверяем на самые частые и понятные ошибки по ключевым словам
    if (originalMessage.includes('quota') || originalMessage.includes('429')) {
        friendlyMessage = 'Исчерпан лимит запросов к этой модели. Попробуйте снова позже или выберите другую модель.';
    } else if (originalMessage.includes('Insufficient Balance') || originalMessage.includes('402')) {
        friendlyMessage = 'Закончились средства на балансе этой AI-модели. Пожалуйста, пополните баланс в личном кабинете провайдера.';
    } else if (originalMessage.includes('User location is not supported')) {
        friendlyMessage = 'Доступ к этой модели ограничен в вашем регионе. Резервный прокси не смог помочь.';
    } else if (originalMessage.includes('API key')) {
        friendlyMessage = 'Ключ API недействителен или отсутствует. Проверьте настройки.';
    } else if (originalMessage.includes('Failed to fetch') || originalMessage.includes('network error')) {
        friendlyMessage = 'Сетевая ошибка. Проверьте подключение к интернету или работу прокси-сервера.';
    } else {
        // 2. Если не нашли, пытаемся вытащить сообщение из JSON-ответа в тексте ошибки
        const jsonMatch = originalMessage.match(/(\{.*\})/s);
        if (jsonMatch && jsonMatch[1]) {
            try {
                const errorJson = JSON.parse(jsonMatch[1]);
                const message = errorJson.error?.message || errorJson.message;
                if (message && typeof message === 'string') {
                    // Берем только первую, самую информативную часть сообщения
                    friendlyMessage = message.split(/[\\.|\\n]/)[0];
                } else {
                    const prefix = originalMessage.substring(0, originalMessage.indexOf('{')).trim();
                    friendlyMessage = prefix || originalMessage;
                }
            } catch (e) {
                const prefix = originalMessage.substring(0, originalMessage.indexOf('{')).trim();
                friendlyMessage = prefix || originalMessage;
            }
        } else {
            // 3. Если ничего не подошло, выводим как есть
            friendlyMessage = originalMessage;
        }
    }
    return { type: 'error', text: `❌ Ошибка: ${friendlyMessage}` };
}

async function translateLeshiy(text, targetLang = "ru") {
    // Принудительно используем Cloudflare для перевода.
    const config = AI_MODELS['TEXT_TO_TEXT_CLOUDFLARE']; 

    if (!text || typeof text !== 'string') return text;
    // 1. ДИНАМИЧЕСКИ ОПРЕДЕЛЯЕМ ПРОМПТ
    let systemPrompt;
    if (targetLang === 'en') {
        systemPrompt = "You are a professional translator. Translate the following image generation prompt into professional English, suitable for text-to-image AI. Keep all descriptive and technical terms. Respond ONLY with the translated text, nothing else.";
    } else if (targetLang === 'ru') {
        systemPrompt = "You are a professional translator. Translate the following image generation prompt into clear Russian, suitable for user editing. Keep all descriptive and technical terms. Respond ONLY with the translated text, nothing else.";
    } else {
        return text; // Запасной вариант
    }
    try {
        // Используем ту же самую инфраструктуру Cloudflare, но другую модель (переводчик)
        const translateModel = '@cf/google/gemma-3-12b-it'; // Модель-переводчик - @cf/google/gemma-3-12b-it
        const translateUrl = `${config.BASE_URL}/${CONFIG.CLOUDFLARE_ACCOUNT_ID}/ai/run/${translateModel}`;

        // --- ЛОГ: Модель для перевода ---
        console.log(`🧠 AI-Модель для перевода: ${translateModel}`);
        console.log(`🔄 [translateLeshiy] Перевожу: Target: ${targetLang} | Text snippet: "${text.substring(0, 97)}..."`);

        const translateBody = {
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: text }
            ],
            stream: false,
            max_tokens: 512
        };
        // Общие заголовки для Cloudflare
        const translateHeaders = {
            'X-Target-URL': translateUrl,
            'X-Proxy-Secret': CONFIG.PROXY_SECRET_KEY,
            'X-Proxy-Authorization': `Bearer ${CONFIG[config.API_KEY]}`,
            'Content-Type': 'application/json'
        };

        // --- БЛОК ДЕБАГА ПЕРЕД ОТПРАВКОЙ ---
        console.log("DEBUG SEND TRANSLATION:", {
            url: CONFIG.PROXY_URL,
            target: translateUrl,
            body: JSON.stringify(translateBody)
        });
        // -----------------------------------
        
        const translateResponse = await fetch(CONFIG.PROXY_URL, {
            method: 'POST',
            mode: 'cors',
            headers: translateHeaders,
            body: JSON.stringify(translateBody)
        });

        if (!translateResponse.ok) {
            const errText = await translateResponse.text();
            throw new Error(`Translation Proxy Error: ${translateResponse.status} ${errText}`);
        }

        const translateData = await translateResponse.json();
        console.log("DEBUG TRANSLATION RECEIVED:", translateData);
        const resultText = translateData.result?.response || translateData.result;
        return (resultText && typeof resultText === 'string') ? resultText.trim() : text; // Если перевод сдох, отдаем ориг.

    } catch (error) {
        console.error("❌ [translateLeshiy] Ошибка:", error);
        return text; // Если всё упало, возвращаем оригинал
    }
}

/**
 * ГЕНЕРАТОР ЛЕШИЙ: Единая точка входа для всех типов контента
 * @param {Object} params - Объект с данными (текст, файлы, режим)
 */
export const generateLeshiy = async ({ text, files = [], history = [], currentMode = 1, voiceId = null }) => {
    const prompt = text?.trim() || "";

    // Логика выбора режима
    switch (Number(currentMode)) {
        case 1: // ОБЩЕНИЕ (Твой текущий askLeshiy)
            return await askLeshiy({ text: prompt, files, history });

        case 2: // ФОТО
            console.log("Режим: Генерация изображения");
            return await generateImage(prompt, files);

        case 3: // ГОЛОС (TTS)
            console.log("Режим: Генерация аудио");
            return await generateAudio(prompt, voiceId);

        case 4: // ВИДЕО
            console.log("Режим: Генерация видео");
            return await generateVideo(prompt, files);

        default:
            return await askLeshiy({ text: prompt, files, history });
    }
};

// Вспомогательные функции (заглушки, которые мы наполним API-логикой)
async function generateImage(prompt, files) {
    // Здесь пойдет вызов модели Nano Banana 2
    return { type: 'system', text: `🎨 Скоро... Здесь будет генерация фото по запросу: "${prompt}"...` };
}

async function generateAudio(prompt, voiceId) {
    const config = loadActiveModelConfig('TEXT_TO_AUDIO');
    if (!config) return { type: 'error', text: 'Модель для синтеза речи (TTS) не настроена' };
    
    const selectedVoice = voiceId || (config.voices && config.voices.length > 0 ? config.voices[0].id : null);
    console.log(`🎵 [AUDIO_GEN] Модель: ${config.SERVICE} (${config.MODEL}), Голос: ${selectedVoice}`);
    
    try {
        let audioUrl;
        let audioFile;

        // Генерируем имя файла из первых слов промпта
        const fileName = `${prompt.split(' ').slice(0, 5).join('_') || 'leshiy_audio'}.mp3`;
        
        // --- ОСОБЫЙ СЛУЧАЙ: GEMINI (требует конвертации PCM -> MP3) ---
        if (config.SERVICE === 'GEMINI') {
            const url = `${config.BASE_URL}/models/${config.MODEL}:generateContent?key=${CONFIG[config.API_KEY]}`;
            const body = {
                "generationConfig": { 
                    "responseModalities": ["AUDIO"], 
                    "speechConfig": {
                        "voiceConfig": {
                            "prebuiltVoiceConfig": {
                                "voiceName": selectedVoice
                            }
                        }
                    }
                },
                "contents": [{
                    "parts": [{ "text": prompt }] 
                }],
                "model": config.MODEL, 
            };
            
            // Отправляем запрос через прокси
            const response = await sendAIRequest(config, url, body, null, false);
            const data = await response.json();

            // Извлекаем сырые PCM-данные в Base64
            const pcmBase64 = data?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
            if (!pcmBase64) {
                 const reason = data?.candidates?.[0]?.finishReason;
                 if (reason === 'SAFETY') throw new Error(`Отказано в генерации из-за политики безопасности.`);
                 throw new Error(`Gemini не вернул аудио данные. Ответ: ${JSON.stringify(data).substring(0, 200)}`);
            }

            // Конвертируем Base64 -> ArrayBuffer -> MP3
            const pcmBuffer = base64ToArrayBuffer(pcmBase64);
            const mp3Buffer = await convertPcmToMp3(pcmBuffer);
            
            // Создаем Blob URL из готового MP3
            const mp3Blob = new Blob([mp3Buffer], { type: 'audio/mpeg' });
            audioUrl = URL.createObjectURL(mp3Blob);
            //const fileName = `leshiy-audio-${Date.now()}.mp3`;
            audioFile = new File([mp3Blob], fileName, { type: 'audio/mpeg' });


        } else {
            // --- СТАНДАРТНАЯ ЛОГИКА ДЛЯ ДРУГИХ СЕРВИСОВ (MP3/OGG напрямую) ---
            let url, authHeader, body;
            let isRawBody = false;
        
            switch (config.SERVICE) {
                case 'CLOUDFLARE':
                    url = `${config.BASE_URL}/${CONFIG.CLOUDFLARE_ACCOUNT_ID}/ai/run/${config.MODEL}`;
                    authHeader = `Bearer ${CONFIG[config.API_KEY]}`;
                    body = {
                        text: prompt,
                        speaker: selectedVoice,
                        language: 'ru-ru',
                        encoding: 'mp3'
                    };
                    break;
                    
                case 'BOTHUB':
                    url = `${config.BASE_URL}/audio/speech`;
                    authHeader = `Bearer ${CONFIG[config.API_KEY]}`;
                    body = {
                        model: config.MODEL,
                        input: prompt,
                        voice: selectedVoice,
                        response_format: "mp3"
                    };
                    isRawBody = true;
                    break;
                    
                case 'VOICERSS':
                    const voiceParam = selectedVoice ? `&v=${selectedVoice}` : '';
                    url = `${config.BASE_URL}?${config.MODEL}&key=${CONFIG[config.API_KEY]}&src=${encodeURIComponent(prompt)}${voiceParam}`;
                    body = null; 
                    isRawBody = true;
                    break;
                    
                default:
                    return { type: 'error', text: `Неподдерживаемый сервис для TTS: ${config.SERVICE}` };
            }
        
            // Используем единую функцию для отправки запроса
            const response = await sendAIRequest(config, url, body, authHeader, isRawBody);
            
            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.startsWith('audio')) {
                const errorText = await response.text();
                throw new Error(`Сервер вернул не аудио. Ответ: ${errorText.substring(0, 300)}`);
            }

            const blob = await response.blob();
            if (blob.size === 0) throw new Error('Сервер вернул пустой аудио-файл.');
            // ИЗМЕНЕНИЕ: Создаем полноценный файл с именем
            const fileName = `leshiy-audio-${Date.now()}.${contentType.split('/')[1] || 'mp3'}`;
            audioFile = new File([blob], fileName, { type: contentType });
            audioUrl = URL.createObjectURL(audioFile);
        }

        if (!audioUrl) throw new Error('Не удалось создать URL для аудио.');
        
        return { 
            type: 'audio', 
            text: `🎵 Аудио сгенерировано по запросу: "${prompt}"`,
            audioUrl: audioUrl,
            file: audioFile
        };
        
    } catch (error) {
        console.error("❌ [generateAudio] Ошибка:", error);
        return handleAiError(error);
    }
}

async function generateVideo(prompt, files) {
    // Здесь пойдет вызов Video Generate
    return { type: 'system', text: `🎬 Скоро... Здесь будет рендер видео по запросу: "${prompt}"...` };
}