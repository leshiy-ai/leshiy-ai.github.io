import axios from 'axios';
import { CONFIG } from './config';

export const askLeshiy = async (userText, history = []) => {
    // 1. Сначала спрашиваем Gemini через твой прокси
    // Мы добавляем системную инструкцию, чтобы он понимал, что он - Диспетчер
    const systemPrompt = `Ты - Leshiy-AI. У тебя есть доступ к Хранилищу (Яндекс) и AI-Генератору (Cloudflare). 
    Если юзер хочет сохранить файл, ответь в формате: [ACTION:STORAGE_SAVE]. 
    Если создать фото/видео/аудио: [ACTION:AI_GENERATE]. 
    Иначе просто ответь текстом.`;

    try {
        const response = await axios.post(`${CONFIG.GEMINI_PROXY}/models/gemini-1.5-flash:generateContent`, {
            contents: [{ parts: [{ text: systemPrompt + "\n\n" + userText }] }]
        }, {
            headers: { "X-Proxy-Secret": CONFIG.PROXY_SECRET }
        });

        const aiText = response.data.candidates[0].content.parts[0].text;

        // 2. Проверяем, не вызвал ли ИИ "инструмент"
        if (aiText.includes("[ACTION:STORAGE_SAVE]")) {
            return { type: 'system', text: 'Понял, сохраняю в облако...', action: 'storage' };
        }
        
        return { type: 'text', text: aiText };
    } catch (error) {
        return { type: 'error', text: 'Ошибка связи с Лешим-АИ: ' + error.message };
    }
};