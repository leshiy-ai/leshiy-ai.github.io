import { CONFIG } from './config';
import { loadActiveModelConfig } from './ai-config';

// --- Main Core Function (Dispatcher) ---
export const askLeshiy = async ({ text, imageBase64, mimeType }) => {
    const serviceType = imageBase64 ? 'IMAGE_TO_TEXT' : 'TEXT_TO_TEXT';
    const config = loadActiveModelConfig(serviceType);

    if (!config) {
        return { type: 'error', text: `Модель для ${serviceType} не настроена` };
    }

    // --- Prepare Request Details ---
    let url, body, headers;

    if (config.SERVICE === 'GEMINI') {
        url = `${CONFIG.GEMINI_PROXY}/models/${config.MODEL}:generateContent?key=${CONFIG.GEMINI_API_KEY}`;
        headers = { 
            'Content-Type': 'application/json',
            'X-Proxy-Secret': CONFIG.PROXY_SECRET
        };
        
        const userParts = [];
        if (text) userParts.push({ text });
        if (imageBase64 && mimeType) {
            userParts.push({ inline_data: { mime_type: mimeType, data: imageBase64 } });
        }

        body = {
            contents: [{ role: 'user', parts: userParts }],
            system_instruction: { role: 'system', parts: [{ text: 'Ты — Gemini AI от Leshiy, дружелюбный и полезный ассистент.' }] }
        };

    } else if (config.SERVICE === 'CLOUDFLARE') {
        url = `${config.BASE_URL}${config.MODEL}`;
        headers = { 'Authorization': `Bearer ${CONFIG.CLOUDFLARE_API_TOKEN}` };

        if (serviceType === 'IMAGE_TO_TEXT') {
            const imageArray = new Uint8Array(atob(imageBase64).split('').map(c => c.charCodeAt(0)));
            body = {
                prompt: text || 'Опиши это изображение',
                image: [...imageArray]
            };
        } else { // TEXT_TO_TEXT
            body = {
                messages: [
                    { role: 'system', content: 'Ты — дружелюбный ассистент.' },
                    { role: 'user', content: text }
                ]
            };
        }
    } else {
        return { type: 'error', text: `Неподдерживаемый сервис: ${config.SERVICE}` };
    }

    // --- Execute Fetch Request with Error Handling ---
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            if (response.status === 429 && config.SERVICE === 'GEMINI') {
                throw new Error('GEMINI_QUOTA');
            }
            const errorText = await response.text();
            console.error('API Error Response:', errorText);
            throw new Error(`API_ERROR: ${response.status}`);
        }

        const data = await response.json();

        // --- Parse Response ---
        let resultText;
        if (config.SERVICE === 'GEMINI') {
            resultText = data.candidates?.[0]?.content?.parts?.[0]?.text;
        } else if (config.SERVICE === 'CLOUDFLARE') {
            if (serviceType === 'IMAGE_TO_TEXT') {
                resultText = data.result?.description;
            } else { // TEXT_TO_TEXT
                resultText = data.result?.response;
            }
        }

        if (typeof resultText !== 'string') {
            console.error('Could not parse a valid string result from API response:', data);
            throw new Error('PARSE_ERROR');
        }

        return { type: 'text', text: resultText };

    } catch (error) {
        console.error('askLeshiy fetch Error:', error.message);
        
        if (error.message.includes('GEMINI_QUOTA')) {
            return { type: 'error', text: '❌ Лимит запросов к Gemini исчерпан. Выберите другую модель или проверьте биллинг.' };
        }
        if (error.message.includes('Failed to fetch')) {
            return { type: 'error', text: '❌ Ошибка сети при запросе к Cloudflare. Вероятно, проблема с CORS или API.' };
        }
        if (error.message.includes('API_ERROR')) {
            const status = error.message.split(': ')[1];
            return { type: 'error', text: `❌ API вернуло ошибку ${status}.` };
        }
        if (error.message.includes('PARSE_ERROR')) {
            return { type: 'error', text: '❌ Не удалось разобрать ответ от API.' };
        }

        return { type: 'error', text: '❌ Неизвестная ошибка. Проверьте консоль.' };
    }
};
