import axios from 'axios';
import { CONFIG } from './config';

// The new core function for interacting with Gemini
export const askLeshiy = async ({ text, imageBase64, mimeType }) => {
    const MODEL = 'gemini-2.5-flash'; // A powerful model that supports text and images

    // A more advanced system prompt
    const systemInstruction = {
        role: 'system',
        parts: [{
            text: `Ты — Gemini-AI от Leshiy, дружелюбный и многофункциональный ассистент. Твой создатель — Александр Огорельцев.

Твои возможности:
- Вести осмысленный диалог на любые темы.
- Анализировать изображения, которые присылает пользователь.
- Генерировать изображения по запросу (используй [ACTION:GENERATE]).
- Сохранять важную информацию (используй [ACTION:STORAGE]).

Всегда отвечай в позитивном ключе, используй смайлики и будь готов помочь! Если пользователь прислал изображение, твоя главная задача — проанализировать его и ответить на связанный с ним вопрос. Если вопроса нет, просто опиши, что видишь на картинке.`
        }]
    };

    const contents = [];

    // Build the request content based on input
    const userParts = [];
    if (text) {
        userParts.push({ text });
    }
    if (imageBase64 && mimeType) {
        userParts.push({
            inline_data: {
                mime_type: mimeType,
                data: imageBase64
            }
        });
    }

    if (userParts.length > 0) {
        contents.push({ role: 'user', parts: userParts });
    }


    try {
        const response = await axios.post(
            `${CONFIG.GEMINI_PROXY}/models/${MODEL}:generateContent?key=${CONFIG.GEMINI_API_KEY}`,
            {
                contents,
                system_instruction: systemInstruction,
            },
            {
                headers: { 'X-Proxy-Secret': CONFIG.PROXY_SECRET }
            }
        );

        const aiText = response.data.candidates[0].content.parts[0].text;

        // Action detection
        if (aiText.includes('[ACTION:STORAGE]')) {
            return { type: 'system', text: aiText.replace('[ACTION:STORAGE]', '').trim(), action: 'storage' };
        }
        if (aiText.includes('[ACTION:GENERATE]')) {
            return { type: 'system', text: aiText.replace('[ACTION:GENERATE]', '').trim(), action: 'generate' };
        }

        return { type: 'text', text: aiText };

    } catch (error) {
        console.error('Gemini API Error:', error.response?.data || error.message);
        if (error.response?.status === 429) {
            return { type: 'error', text: 'Слишком много запросов к Gemini AI. Пожалуйста, подожди пару минут.' };
        }
        return { type: 'error', text: 'Ошибка при обращении к Gemini AI: ' + (error.response?.data?.error?.message || error.message) };
    }
};
