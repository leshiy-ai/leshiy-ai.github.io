import { CONFIG } from './config';
import { loadActiveModelConfig } from './ai-config';

const SYSTEM_PROMPT = `Ты — многофункциональный AI-ассистент Gemini AI от Leshiy, отвечающий на русском языке.
Твоя задача — вести диалог, отвечать на вопросы и помогать пользователю с функциями приложения.

Твои ключевые функции:
- Распознавание и анализ изображений, аудио и видео.
- Ответы на текстовые запросы в режиме чата.

Ответы должны быть информативными и доброжелательными со смайликами.`;

export const askLeshiy = async ({ text, files = [] }) => {
    let serviceType = 'TEXT_TO_TEXT';
    const firstFile = files.length > 0 ? files[0].file : null;

    if (firstFile) {
        if (firstFile.type.startsWith('image/')) {
            serviceType = 'IMAGE_TO_TEXT';
        } else if (firstFile.type.startsWith('audio/')) {
            serviceType = 'AUDIO_TO_TEXT';
        } else if (firstFile.type.startsWith('video/')) {
            serviceType = 'VIDEO_TO_TEXT';
        }
    }

    const config = loadActiveModelConfig(serviceType);
    if (!config) return { type: 'error', text: `Модель для ${serviceType} не настроена` };

    let url, body, authHeader;
    let isRawBody = false;
    const hasFiles = files.length > 0;

    switch (config.SERVICE) {
        case 'GEMINI':
            url = `${config.BASE_URL}/models/${config.MODEL}:generateContent?key=${CONFIG[config.API_KEY]}`;
            const userQuery = text || (hasFiles ? "Проанализируй эти файлы" : "Привет");
            const parts = [{ text: `${SYSTEM_PROMPT}\n\nЗапрос пользователя: ${userQuery}` }];

            files.forEach(fileData => {
                if (fileData.base64) {
                    parts.push({ inlineData: { mimeType: fileData.mimeType, data: fileData.base64 } });
                }
            });
            body = { contents: [{ parts: parts }] };
            break;

        case 'CLOUDFLARE':
        case 'WORKERS_AI':
            url = `${config.BASE_URL}/${CONFIG.CLOUDFLARE_ACCOUNT_ID}/ai/run/${config.MODEL}`;
            authHeader = `Bearer ${CONFIG[config.API_KEY]}`;
            const firstFileData = files.length > 0 ? files[0] : null;

            if (serviceType.includes('AUDIO') || serviceType.includes('VIDEO')) {
                if (!firstFileData) return { type: 'error', text: `Для этой модели требуется файл.` };
                body = await firstFileData.file.arrayBuffer();
                isRawBody = true;
            } else if (serviceType.includes('IMAGE')) {
                if (!firstFileData || !firstFileData.base64) return { type: 'error', text: `Для этой модели требуется изображение.` };
                const byteString = atob(firstFileData.base64);
                const byteArray = new Uint8Array(byteString.length);
                for (let i = 0; i < byteString.length; i++) byteArray[i] = byteString.charCodeAt(i);
                body = { image: Array.from(byteArray), prompt: text || "Опиши это изображение" };
            } else {
                body = {
                    messages: [
                        { role: 'system', content: SYSTEM_PROMPT },
                        { role: 'user', content: text }
                    ],
                    stream: false
                };
            }
            break;

        case 'BOTHUB': // OpenAI-совместимый
            url = `${config.BASE_URL}/chat/completions`;
            authHeader = `Bearer ${CONFIG[config.API_KEY]}`;
            const userContent = [{ type: 'text', text: text || (hasFiles ? "Опиши это" : "Привет") }];

            files.forEach(fileData => {
                if (fileData.base64) {
                    userContent.push({ type: 'image_url', image_url: { url: `data:${fileData.mimeType};base64,${fileData.base64}` } });
                }
            });

            const finalContent = userContent.length === 1 && userContent[0].type === 'text'
                ? userContent[0].text
                : userContent;

            body = { model: config.MODEL, messages: [{ role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content: finalContent }] };
            break;
    }

    try {
        const proxyHeaders = {
            'X-Target-URL': url,
            'X-Proxy-Secret': CONFIG.PROXY_SECRET_KEY,
            'Content-Type': isRawBody ? 'application/octet-stream' : 'application/json'
        };
        if (authHeader) {
            proxyHeaders['X-Proxy-Authorization'] = authHeader;
        }

        const response = await fetch(CONFIG.PROXY_URL, {
            method: 'POST',
            headers: proxyHeaders,
            body: isRawBody ? body : JSON.stringify(body),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error("API Error Response:", errorText);
            const errData = JSON.parse(errorText || "{}");
            const detail = errData.error?.message || errorText;
            throw new Error(`Ошибка API: ${response.status}. ${detail}`);
        }

        const data = await response.json();
        let resultText = "Не удалось разобрать ответ.";

        if (config.SERVICE === 'GEMINI') {
            resultText = data.candidates?.[0]?.content?.parts?.[0]?.text;
        } else if (config.SERVICE === 'BOTHUB') {
            resultText = data.choices?.[0]?.message?.content;
        } else if (config.SERVICE === 'CLOUDFLARE' || config.SERVICE === 'WORKERS_AI') {
            resultText = data.result?.response || data.result?.text || "Нет ответа от Cloudflare";
        }
        
        if (!resultText) {
           console.error("Полный ответ от API:", data);
           resultText = "Получен пустой ответ от AI.";
        }

        return { type: 'text', text: resultText };

    } catch (error) {
        console.error("Ошибка при вызове askLeshiy:", error);
        return { type: 'error', text: `❌ Ошибка сети: ${error.message}` };
    }
};