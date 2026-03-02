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

    // ПЕРЕХВАТ СТЕЙТА (в самом начале обработки сообщения)
    let pendingAction = sessionStorage.getItem('pending_action');

    if (pendingAction === 'waiting_for_search' && !userQuery.startsWith('/')) {
        // Если мы ждали поиск и юзер прислал просто текст — превращаем его в команду поиска
        userQuery = `/search ${userQuery}`;
        lowerQuery = userQuery.toLowerCase(); 
        // Очищаем сразу, чтобы не зациклиться
        sessionStorage.removeItem('pending_action');
    } 
    // Если же пришла любая команда слэшем (напр. /storage), пока мы ждали поиск
    else if (userQuery.startsWith('/')) {
        // Просто сбрасываем ожидание, чтобы не мешало основной логике
        sessionStorage.removeItem('pending_action');
    }

    // ==========================================================
    // 1. ЛОГИКА ЭКОСИСТЕМЫ: ГЛАВНОЕ МЕНЮ И КОМАНДЫ
    // ==========================================================
    
    // Команда вызова меню Хранилки
    if (lowerQuery === '/storage' || lowerQuery.includes('хранилк')) {
        // Если НЕ авторизован — показываем только кнопку входа
        if (!currentUserId) {
            return {
                type: 'menu',
                text: '🔐 **Вход в Хранилку**\n\nДля доступа к вашим файлам необходимо авторизоваться через VK ID.',
                buttons: [
                    { text: '🆔 Войти через VK ID', action: '/auth_init_vk' }
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
                            window.dispatchEvent(new CustomEvent('send-bot-command', { detail: '/storage' }));
                        }
                    });
            });

            return { type: 'text', text: '⚡️ **Окно входа открыто!**' };
        }
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

    // ЗАГРУЗКА ФАЙЛОВ
    if (lowerQuery.includes("сохрани") || lowerQuery.includes("/upload") || hasFiles) {
        if (!hasFiles) return { type: 'text', text: "Прикрепите файл! 📎" };

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
    // 3. ФОРМИРОВАНИЕ BODY ПОД ПРОВАЙДЕРА
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