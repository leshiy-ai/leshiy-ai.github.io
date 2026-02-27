import { CONFIG } from './config';
import { loadActiveModelConfig } from './ai-config';

// Универсальная системная инструкция для всех чат-моделей
const SYSTEM_PROMPT = "Ты — дружелюбный и вежливый ИИ-ассистент Gemini-AI от Leshiy. Всегда отвечай развёрнуто, дружелюбно и используй смайлики. 😊";

export const askLeshiy = async ({ text, imageBase64, mimeType, file }) => {
    // 1. Определяем тип контента
    let serviceType = 'TEXT_TO_TEXT';
    if (file) {
        serviceType = file.type.startsWith('audio/') ? 'AUDIO_TO_TEXT' : 
                      file.type.startsWith('video/') ? 'VIDEO_TO_TEXT' : 'IMAGE_TO_TEXT';
    } else if (imageBase64) {
        serviceType = 'IMAGE_TO_TEXT';
    }

    const config = loadActiveModelConfig(serviceType);
    if (!config) return { type: 'error', text: `Модель для ${serviceType} не настроена` };

    let url, body, authHeader;
    let isRawBody = false;

    // 2. Формируем данные под конкретный сервис
    switch (config.SERVICE) {
        case 'GEMINI':
            url = `${config.BASE_URL}/models/${config.MODEL}:generateContent?key=${CONFIG[config.API_KEY]}`;
            const parts = [{ text: text || "Опиши это" }];
            if (imageBase64) parts.push({ inline_data: { mime_type: mimeType, data: imageBase64 } });
            body = { contents: [{ parts }], systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] } };
            break;

        case 'CLOUDFLARE':
        case 'WORKERS_AI':
            url = `https://api.cloudflare.com/client/v4/accounts/${CONFIG.CLOUDFLARE_ACCOUNT_ID}/ai/run/${config.MODEL}`;
            authHeader = `Bearer ${CONFIG.CLOUDFLARE_API_TOKEN}`;
            
            if (serviceType.includes('AUDIO')) {
                body = await file.arrayBuffer();
                isRawBody = true;
            } else if (imageBase64) {
                const byteString = atob(imageBase64);
                const byteArray = new Uint8Array(byteString.length);
                for (let i = 0; i < byteString.length; i++) byteArray[i] = byteString.charCodeAt(i);
                body = { image: Array.from(byteArray), prompt: text || "Describe this" };
            } else {
                body = {
                    messages: [
                        { role: 'system', content: SYSTEM_PROMPT },
                        { role: 'user', content: text }
                    ]
                };
            }
            break;

        case 'BOTHUB':
            url = `${config.BASE_URL}/chat/completions`;
            authHeader = `Bearer ${CONFIG[config.API_KEY]}`;
            const userContent = imageBase64
                ? [{ type: 'text', text: text || "Опиши это" }, { type: 'image_url', image_url: { url: `data:${mimeType};base64,${imageBase64}` } }]
                : text;
            const msgs = [
                { role: 'system', content: SYSTEM_PROMPT },
                { role: 'user', content: userContent }
            ];
            body = { model: config.MODEL, messages: msgs };
            break;
    }

    // 3. ОТПРАВКА ЧЕРЕЗ ПРОКСИ (Критически важная часть)
    try {
        const proxyHeaders = {
            'X-Target-URL': url,
            'X-Proxy-Secret': CONFIG.PROXY_SECRET_KEY,
            'Content-Type': isRawBody ? 'application/octet-stream' : 'application/json'
        };

        // Если есть заголовок авторизации, пакуем его в X-Proxy-Authorization,
        // как того требует универсальный прокси-воркер.
        if (authHeader) {
            proxyHeaders['X-Proxy-Authorization'] = authHeader;
        }

        const response = await fetch(CONFIG.PROXY_URL, {
            method: 'POST',
            headers: proxyHeaders,
            body: isRawBody ? body : JSON.stringify(body),
        });

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            const cfError = errData.errors?.[0]?.message;
            const genericError = errData.message || `Ошибка API ${response.status}`;
            throw new Error(cfError || genericError);
        }

        const data = await response.json();
        
        // 4. Парсинг ответа
        let resultText = '';
        if (config.SERVICE === 'GEMINI') {
            resultText = data.candidates?.[0]?.content?.parts?.[0]?.text;
        } else if (config.SERVICE === 'BOTHUB') {
            resultText = data.choices?.[0]?.message?.content;
        } else if (config.SERVICE === 'CLOUDFLARE' || config.SERVICE === 'WORKERS_AI') {
            resultText = data.result?.response || data.result?.text || "Нет ответа от Cloudflare";
        } else {
            resultText = "Не удалось разобрать ответ";
        }

        return { type: 'text', text: resultText };

    } catch (error) {
        return { type: 'error', text: `❌ ${error.message}` };
    }
};