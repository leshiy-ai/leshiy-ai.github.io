import { CONFIG } from './config';
import { loadActiveModelConfig } from './ai-config';

// --- Основная функция-диспетчер для всех AI-запросов ---
export const askLeshiy = async ({ text, imageBase64, mimeType, file }) => {
    // 1. Определяем основной тип сервиса по входным данным
    let serviceType;
    if (file) {
        if (file.type.startsWith('audio/')) serviceType = 'AUDIO_TO_TEXT';
        else if (file.type.startsWith('video/')) serviceType = 'VIDEO_TO_TEXT';
        else serviceType = 'IMAGE_TO_TEXT';
    } else if (imageBase64) {
        serviceType = 'IMAGE_TO_TEXT';
    } else {
        serviceType = 'TEXT_TO_TEXT';
    }

    const config = loadActiveModelConfig(serviceType);
    if (!config) {
        return { type: 'error', text: `Модель для ${serviceType} не настроена` };
    }

    let url, body, headers;
    let isRawBody = false; // Флаг для тел запроса, которые не нужно превращать в JSON

    // 3. Собираем запрос в зависимости от сервиса
    switch (config.SERVICE) {
        case 'GEMINI':
            const geminiApiKey = CONFIG[config.API_KEY];
            if (!geminiApiKey) {
                 return { type: 'error', text: `Ключ ${config.API_KEY} не найден. Проверьте конфигурацию.` };
            }
            url = `${config.BASE_URL}/models/${config.MODEL}:generateContent?key=${geminiApiKey}`;
            headers = { 
                'Content-Type': 'application/json',
                'X-Proxy-Secret': CONFIG.PROXY_SECRET 
            };
            const geminiParts = [{ text }];
            if (imageBase64) {
                geminiParts.push({ inline_data: { mime_type: mimeType, data: imageBase64 } });
            }
            body = {
                contents: [{ parts: geminiParts }],
                systemInstruction: { parts: [{ text: 'Ты — многофункциональный AI-ассистент "Gemini AI" от Leshiy, отвечающий на русском языке.' }] } 
            };
            break;

        case 'BOTHUB':
            const bothubApiKey = CONFIG[config.API_KEY];
            if (!bothubApiKey) {
                return { type: 'error', text: `Ключ ${config.API_KEY} не найден. Проверьте конфигурацию.` };
            }
            url = `${config.BASE_URL}/chat/completions`;
            headers = { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${bothubApiKey}`
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
            const accountId = CONFIG.CLOUDFLARE_ACCOUNT_ID;
            const cfApiKey = CONFIG.CLOUDFLARE_API_TOKEN;
            url = `${config.BASE_URL}${accountId}/ai/run/${config.MODEL}`;
            headers = { 
                'Authorization': `Bearer ${cfApiKey}`,
                'Content-Type': 'application/json'
            };

            if (serviceType === 'AUDIO_TO_TEXT' || serviceType === 'VIDEO_TO_TEXT') {
                if (!file) return { type: 'error', text: 'Файл не найден для транскрипции.' };
                body = await file.arrayBuffer();
                headers['Content-Type'] = file.type;
                isRawBody = true;
            } else if (serviceType === 'IMAGE_TO_TEXT') {
                if (!imageBase64) return { type: 'error', text: 'Изображение не найдено.' };
                const byteString = atob(imageBase64);
                const byteArray = new Uint8Array(byteString.length);
                for (let i = 0; i < byteString.length; i++) {
                    byteArray[i] = byteString.charCodeAt(i);
                }
                body = { image: Array.from(byteArray), prompt: text };
            } else { // TEXT_TO_TEXT
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
            body: isRawBody ? body : JSON.stringify(body),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Ошибка API:', `URL: ${url}`, `Статус: ${response.status}`, `Ответ: ${errorText}`);
            throw new Error(`Вызов API завершился с ошибкой, статус ${response.status}`);
        }
        
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
            const data = await response.json();
            let resultText = 'Не удалось разобрать JSON ответ.';
            if (config.SERVICE === 'GEMINI') {
                resultText = data.candidates?.[0]?.content?.parts?.[0]?.text;
            } else if (config.SERVICE === 'BOTHUB') {
                resultText = data.choices?.[0]?.message?.content;
            } else if (config.SERVICE === 'CLOUDFLARE') {
                resultText = data.result?.response;
            } else if (config.SERVICE === 'WORKERS_AI') {
                resultText = data.text || data.result?.response;
            }
            return { type: 'text', text: resultText };
        } else {
            const blob = await response.blob();
            const blobUrl = URL.createObjectURL(blob);
            return { type: 'audio', url: blobUrl };
        }

    } catch (error) {
        console.error('Ошибка fetch в askLeshiy:', error.message);
        return { type: 'error', text: `❌ Критическая ошибка: ${error.message}. Проверьте консоль.` };
    }
};