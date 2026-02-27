import { CONFIG } from './config';
import { loadActiveModelConfig } from './ai-config';

/**
 * A universal dispatcher for making AI requests.
 * It determines the service type based on the input (text, image, audio, etc.),
 * loads the appropriate model configuration, and formats the request
 * for the corresponding service (Gemini, Cloudflare, Bothub, etc.).
 *
 * @param {object} params - The request parameters.
 * @param {string} params.text - The text prompt.
 * @param {string} [params.imageBase64] - Base64 encoded image data.
 * @param {string} [params.mimeType] - The MIME type of the image.
 * @param {File} [params.file] - A file object for audio or video.
 * @returns {Promise<object>} A promise that resolves to the AI response.
 */
export const askLeshiy = async ({ text, imageBase64, mimeType, file }) => {
    // 1. Determine the service type based on input
    let serviceType;
    if (file) {
        if (file.type.startsWith('audio/')) serviceType = 'AUDIO_TO_TEXT';
        else if (file.type.startsWith('video/')) serviceType = 'VIDEO_TO_TEXT';
        else serviceType = 'IMAGE_TO_TEXT'; // Default file type
    } else if (imageBase64) {
        serviceType = 'IMAGE_TO_TEXT';
    } else {
        serviceType = 'TEXT_TO_TEXT';
    }

    // 2. Load the active model configuration for the determined service type
    const config = loadActiveModelConfig(serviceType);
    if (!config) {
        return { type: 'error', text: `No model configured for ${serviceType}` };
    }

    // --- The single endpoint for all proxied requests ---
    // Your Gemini worker is smart enough to handle routing to different services.
    const PROXY_ENDPOINT = CONFIG.GEMINI_PROXY;

    // 3. Prepare request details (URL, headers, body)
    let url, body, headers = {
        'Content-Type': 'application/json',
        'X-Proxy-Secret': CONFIG.PROXY_SECRET, // Your security key for the proxy
    };

    const requestPayload = { // This is the object that will be sent to your bot
        modelConfig: config, // Send the whole model config for the bot to use
        text: text,
        imageBase64: imageBase64,
        mimeType: mimeType,
        // File handling will need to be done via a separate upload service
    };

    // All requests now go to your single, intelligent proxy bot.
    url = PROXY_ENDPOINT;
    body = requestPayload;

    // Special handling for file uploads - they must go to the storage gateway first.
    // The main AI request will be sent after the file is uploaded.
    if (file) {
        try {
            const formData = new FormData();
            formData.append('file', file);
            // This would ideally return a URL to the uploaded file
            const uploadResponse = await fetch(CONFIG.STORAGE_GATEWAY, { 
                method: 'POST', 
                body: formData 
            });
            const uploadResult = await uploadResponse.json();
            if (!uploadResult.url) { // Assuming the storage returns a URL
                throw new Error('File upload did not return a URL.');
            }
            // Add the file URL to the payload for the AI bot
            body.fileUrl = uploadResult.url; 
            // Now the request can proceed to the AI bot with the file URL
        } catch(err) {
            console.error("File Upload Error:", err);
            return { type: 'error', text: '❌ Error uploading file to storage.' };
        }
    }

    // 4. Execute the fetch request to your bot
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Bot API Error Response:', errorText);
            throw new Error(`Bot returned an error: ${response.status}`);
        }

        const data = await response.json(); // Assuming your bot returns JSON

        // 5. Return the parsed response
        // This part assumes your bot's response has a { type: 'text', text: '...' } structure.
        // You might need to adjust this based on your bot's actual response format.
        if (!data.text) {
             throw new Error('Parsed response does not contain a "text" field.');
        }

        return { type: 'text', text: data.text };

    } catch (error) {
        console.error('askLeshiy Fetch Error:', error.message);
        return { type: 'error', text: `❌ Critical error: ${error.message}. Check console.` };
    }
};