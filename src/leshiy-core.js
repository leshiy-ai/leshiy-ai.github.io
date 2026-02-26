import axios from 'axios';
import { CONFIG } from './config';

export const askLeshiy = async (userText, history = []) => {
    // Временно меняем на 1.5, чтобы IDX и прокси не выдавали 429
    const MODEL = "gemini-1.5-flash"; 
    
    const systemPrompt = `Ты - Leshiy-AI. Твой автор Огорельцев Александр.
    Если юзер хочет сохранить файл или инфу, ответь: [ACTION:STORAGE] текст. 
    Если создать фото/изображение: [ACTION:GENERATE] текст. 
    Иначе просто ответь как умный ассистент со смайликами.`;

    try {
        const response = await axios.post(`${CONFIG.GEMINI_PROXY}/models/${MODEL}:generateContent?key=${CONFIG.GEMINI_API_KEY}`, {
            contents: [{ parts: [{ text: systemPrompt + "\n\nЗапрос: " + userText }] }]
        }, {
            headers: { "X-Proxy-Secret": CONFIG.PROXY_SECRET }
        });

        const aiText = response.data.candidates[0].content.parts[0].text;

        // Точная проверка экшенов
        if (aiText.includes("[ACTION:STORAGE]")) {
            return { type: 'system', text: aiText.replace("[ACTION:STORAGE]", "").trim(), action: 'storage' };
        }
        
        if (aiText.includes("[ACTION:GENERATE]")) {
            return { type: 'system', text: aiText.replace("[ACTION:GENERATE]", "").trim(), action: 'generate' };
        }
        
        return { type: 'text', text: aiText };
    } catch (error) {
        // Если ловим 429, возвращаем понятную ошибку
        if (error.response?.status === 429) {
            return { type: 'error', text: 'Леший притормозил (превышена квота). Подожди минуту.' };
        }
        return { type: 'error', text: 'Ошибка связи: ' + error.message };
    }
};