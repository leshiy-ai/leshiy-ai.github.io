import { CONFIG } from './config';
import { loadActiveModelConfig } from './ai-config';

// --- Основная функция-диспетчер для всех AI-запросов ---
export const askLeshiy = async ({ text, imageBase64, mimeType, file }) => {
    // 1. Определяем основной тип сервиса по входным данным
    let serviceType;
    if (file) {
        if (file.type.startsWith('audio/')) serviceType = 'AUDIO_TO_TEXT';
        else if (file.type.startsWith('video/')) serviceType = 'VIDEO_TO_TEXT';
        else serviceType = 'IMAGE_TO_TEXT'; // Запасной вариант для других типов файлов
    } else if (imageBase64) {
        serviceType = 'IMAGE_TO_TEXT';
    } else {
        serviceType = 'TEXT_TO_TEXT';
    }

    const config = loadActiveModelConfig(serviceType);
    if (!config) {
        return { type: 'error', text: `Модель для ${serviceType} не настроена` };
    }

    // 2. Готовим детали запроса - они будут зависеть от конкретного сервиса
    let url, body, headers;

    const apiKey = CONFIG[config.API_KEY];

    // 3. Собираем запрос в зависимости от сервиса
    switch (config.SERVICE) {
        case 'GEMINI':
            // Запросы к Gemini проксируются, BASE_URL - это URL прокси.
            url = `${config.BASE_URL}/models/${config.MODEL}:generateContent?key=${apiKey}`;
            headers = { 
                'Content-Type': 'application/json',
                'X-Proxy-Secret': CONFIG.PROXY_SECRET
            };
            const geminiParts = [{ text }];
            if (imageBase64) {
                geminiParts.push({ inline_data: { mime_type: mimeType, data: imageBase64 } });
            }
            body = { contents: [{ parts: geminiParts }] };
            break;

        case 'BOTHUB':
            // Bothub использует OpenAI-совместимые эндпоинты
            url = `${config.BASE_URL}/chat/completions`;
            headers = { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            };
            const messages = [{ role: 'user', content: text }];
            if (imageBase64) {
                messages[0].content = [
                    { type: 'text', text },
                    { type: 'image_url', image_url: { url: `data:${mimeType};base64,${imageBase64}` } }
                ];
            }
            body = { model: config.MODEL, messages: messages };
            break;

        case 'CLOUDFLARE':
        case 'WORKERS_AI':
            // ПРЯМОЙ вызов API Cloudflare. 
            // ACCOUNT_ID должен быть внедрен в код на этапе сборки (build).
            const accountId = CONFIG.CLOUDFLARE_ACCOUNT_ID;
            if (!accountId) {
                // Эта ошибка теперь будет возникать только если переменная VITE_CLOUDFLARE_ACCOUNT_ID не была установлена при сборке.
                return { 
                    type: 'error', 
                    text: '❌ Ошибка сборки: CLOUDFLARE_ACCOUNT_ID не был найден. Проверьте переменные окружения в GitHub Actions.' 
                };
            }
            url = `${config.BASE_URL}${accountId}/ai/run/${config.MODEL}`;
            headers = { 'Authorization': `Bearer ${apiKey}` };
            // Тело запроса для Cloudflare зависит от модели. Это базовый пример для text-to-text.
            // Для других типов (image-to-text и т.д.) потребуется более сложная логика.
            if (imageBase64) {
                 body = { image: Array.from(Buffer.from(imageBase64, 'base64')), prompt: text };
            } else if (file) {
                // Для работы с файлами напрямую, их нужно передавать как ArrayBuffer
                const fileBuffer = await file.arrayBuffer();
                body = Array.from(new Uint8Array(fileBuffer));
                headers['Content-Type'] = file.type;
            } else {
                body = { prompt: text };
            }
            break;

        default:
            return { type: 'error', text: `Сервис "${config.SERVICE}" не реализован.` };
    }

    // 4. Выполняем fetch-запрос
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: headers,
            // Тело для файловых запросов к CF не нужно оборачивать в JSON.stringify
            body: (config.SERVICE === 'WORKERS_AI' && file) ? body : JSON.stringify(body),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Ошибка API:', `URL: ${url}`, `Статус: ${response.status}`, `Ответ: ${errorText}`);
            throw new Error(`Вызов API завершился с ошибкой, статус ${response.status}`);
        }
        
        // Разбор ответа зависит от типа контента
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
            const data = await response.json();
            let resultText = 'Не удалось разобрать JSON ответ.';
            if (config.SERVICE === 'GEMINI') {
                resultText = data.candidates?.[0]?.content?.parts?.[0]?.text;
            } else if (config.SERVICE === 'BOTHUB') {
                resultText = data.choices?.[0]?.message?.content;
            } else if (config.SERVICE === 'CLOUDFLARE') {
                // У Cloudflare разные форматы ответа, это для text-to-text
                resultText = data.result?.response;
            } else if (config.SERVICE === 'WORKERS_AI' && serviceType === 'AUDIO_TO_TEXT') {
                resultText = data.text;
            }
            return { type: 'text', text: resultText };
        } else {
            // Для аудио-файлов и т.д.
            const blob = await response.blob();
            const blobUrl = URL.createObjectURL(blob);
            return { type: 'audio', url: blobUrl }; // Возвращаем URL для проигрывания
        }

    } catch (error) {
        console.error('Ошибка fetch в askLeshiy:', error.message);
        return { type: 'error', text: `❌ Критическая ошибка: ${error.message}. Проверьте консоль.` };
    }
};