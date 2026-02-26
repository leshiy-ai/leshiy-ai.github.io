import axios from 'axios';
import { CONFIG } from './config';
import { AI_MODELS, loadActiveConfig, SERVICE_TYPE_MAP } from './ai-config';

// --- Specific Function for Gemini API via Proxy ---
async function callGemini(config, { text, imageBase64, mimeType }) {
    const modelId = config.MODEL;
    const systemInstruction = {
        role: 'system',
        parts: [{ text: `Ты — Gemini-AI от Leshiy, дружелюбный и многофункциональный ассистент.` }]
    };

    const userParts = [];
    if (text) userParts.push({ text });
    if (imageBase64 && mimeType) {
        userParts.push({ inline_data: { mime_type: mimeType, data: imageBase64 } });
    }

    const contents = [{ role: 'user', parts: userParts }];

    try {
        const response = await axios.post(
            // The BASE_URL for Gemini is the proxy URL
            `${config.BASE_URL}/models/${modelId}:generateContent?key=${CONFIG.GEMINI_API_KEY}`,
            { contents, system_instruction: systemInstruction },
            { headers: { 'X-Proxy-Secret': CONFIG.PROXY_SECRET } }
        );
        return response.data.candidates[0].content.parts[0].text;
    } catch (error) {
        console.error('Gemini API Error:', error.response?.data || error.message);
        throw new Error('Ошибка при обращении к Gemini AI');
    }
}

// --- Specific Function for Cloudflare AI REST API ---
async function callCloudflareAI(config, { text, imageBase64 }) {
    const modelId = config.MODEL;
    const apiToken = CONFIG.CLOUDFLARE_API_TOKEN;
    
    // CORRECT: Use the BASE_URL from the config object
    const url = `${config.BASE_URL}${modelId}`;

    let payload;
    // Check if it is an image-to-text model
    if (modelId.includes('uform')) {
        // This model expects an image as an array of bytes
        const imageBytes = [...new Uint8Array(atob(imageBase64).split('').map(c => c.charCodeAt(0)))];
        payload = {
            prompt: text || 'Describe this image',
            image: imageBytes
        };
    } else {
        // This is a text-to-text model
        payload = {
            messages: [
                { role: 'system', content: 'You are a friendly assistant.' },
                { role: 'user', content: text }
            ]
        };
    }

    try {
        const response = await axios.post(url, payload, {
            headers: {
                'Authorization': `Bearer ${apiToken}`,
                'Content-Type': 'application/json'
            }
        });

        if (modelId.includes('uform')) {
            return response.data.result.description;
        } else {
            return response.data.result.response;
        }
    } catch (error) {
        console.error('Cloudflare AI Error:', error.response?.data || error.message);
        throw new Error('Ошибка при обращении к Cloudflare AI');
    }
}

// --- Main Core Function (Dispatcher) ---
export const askLeshiy = async ({ text, imageBase64, mimeType }) => {
    const serviceType = imageBase64 ? 'IMAGE_TO_TEXT' : 'TEXT_TO_TEXT';
    const modelConfig = await loadActiveConfig(serviceType);

    try {
        let resultText;
        if (modelConfig.SERVICE === 'GEMINI') {
            // Also pass the BASE_URL for Gemini to its function
            modelConfig.BASE_URL = CONFIG.GEMINI_PROXY;
            resultText = await callGemini(modelConfig, { text, imageBase64, mimeType });
        } else if (modelConfig.SERVICE === 'WORKERS_AI') {
            resultText = await callCloudflareAI(modelConfig, { text, imageBase64 });
        } else {
            throw new Error(`Unsupported service: ${modelConfig.SERVICE}`);
        }
        
        return { type: 'text', text: resultText };

    } catch (error) {
        console.error('askLeshiy Error:', error.message);
        return { type: 'error', text: error.message };
    }
};
