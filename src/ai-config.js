// This file is adapted from the user's working configuration in gemini-bot and leshiy-storage-bot.

export const AI_MODELS = {
    // --- Gemini Models ---
    TEXT_TO_TEXT_GEMINI: { 
        SERVICE: 'GEMINI', 
        MODEL: 'gemini-2.5-flash',
        API_KEY: 'GEMINI_API_KEY', 
        BASE_URL: 'https://gemini-proxy.leshiyalex.workers.dev/v1beta'
    },
    AUDIO_TO_TEXT_GEMINI: { 
        SERVICE: 'GEMINI', 
        MODEL: 'gemini-2.5-flash', 
        API_KEY: 'GEMINI_API_KEY', 
        BASE_URL: 'https://gemini-proxy.leshiyalex.workers.dev/v1beta'
    },
    VIDEO_TO_TEXT_GEMINI: { 
        SERVICE: 'GEMINI', 
        MODEL: 'gemini-2.5-flash', 
        API_KEY: 'GEMINI_API_KEY', 
        BASE_URL: 'https://gemini-proxy.leshiyalex.workers.dev/v1beta'
    },
    TEXT_TO_AUDIO_GEMINI: { 
        SERVICE: 'GEMINI', 
        MODEL: 'gemini-2.5-flash-preview-tts', 
        API_KEY: 'GEMINI_API_KEY', 
        BASE_URL: 'https://gemini-proxy.leshiyalex.workers.dev/v1beta'
    },
    IMAGE_TO_TEXT_GEMINI: { 
        SERVICE: 'GEMINI', 
        MODEL: 'gemini-2.5-flash',
        API_KEY: 'GEMINI_API_KEY', 
        BASE_URL: 'https://gemini-proxy.leshiyalex.workers.dev/v1beta'
    },
    VIDEO_TO_ANALYSIS_GEMINI: { 
        SERVICE: 'GEMINI', 
        MODEL: 'gemini-2.5-flash', 
        API_KEY: 'GEMINI_API_KEY', 
        BASE_URL: 'https://gemini-proxy.leshiyalex.workers.dev/v1beta'
    },

    // --- Cloudflare Models ---

    // ✅ [Текст в Текст]
    TEXT_TO_TEXT_CLOUDFLARE: { 
        SERVICE: 'CLOUDFLARE', 
        MODEL: '@cf/qwen/qwen2.5-coder-32b-instruct',
        API_KEY: 'CLOUDFLARE_API_TOKEN', 
        BASE_URL: 'https://api.cloudflare.com/client/v4/accounts/'
    },
    TEXT_TO_TEXT_LLAMA: { 
        SERVICE: 'CLOUDFLARE', 
        MODEL: '@cf/google/gemma-2b-it-lora',
        API_KEY: 'CLOUDFLARE_API_TOKEN', 
        BASE_URL: 'https://api.cloudflare.com/client/v4/accounts/'
    },
    // ✅ [Аудио в Текст]
    AUDIO_TO_TEXT_WORKERS_AI: { 
        SERVICE: 'WORKERS_AI', 
        MODEL: '@cf/openai/whisper', 
        API_KEY: 'CLOUDFLARE_API_TOKEN', 
        BASE_URL: 'https://api.cloudflare.com/client/v4/accounts/'
    },
    // ✅ [Изображение в Текст (Видение)]
    IMAGE_TO_TEXT_CLOUDFLARE: { 
        SERVICE: 'CLOUDFLARE',
        MODEL: '@cf/unum/uform-gen2-qwen-500m', 
        API_KEY: 'CLOUDFLARE_API_TOKEN', 
        BASE_URL: 'https://api.cloudflare.com/client/v4/accounts/'
    },
    // ✅ [Текст в Голос] - убогий перевод
    TEXT_TO_AUDIO_WORKERS_AI: { 
        SERVICE: 'WORKERS_AI', 
        MODEL: '@cf/deepgram/aura-1', 
        API_KEY: 'CLOUDFLARE_API_TOKEN', 
        BASE_URL: 'https://api.cloudflare.com/client/v4/accounts/'
    },
    // ✅ [Изображение в Текст (Видение)]
    IMAGE_TO_TEXT_WORKERS_AI: { 
        SERVICE: 'WORKERS_AI', 
        MODEL: '@cf/unum/uform-gen2-qwen-500m', 
        API_KEY: 'CLOUDFLARE_API_TOKEN', 
        BASE_URL: 'https://api.cloudflare.com/client/v4/accounts/'
    },
    // ✅ [Текст в Изображение - /create]
    TEXT_TO_IMAGE_WORKERS_AI: { 
        SERVICE: 'WORKERS_AI', 
        MODEL: '@cf/stabilityai/stable-diffusion-xl-base-1.0', 
        API_KEY: 'CLOUDFLARE_API_TOKEN', 
        BASE_URL: 'https://api.cloudflare.com/client/v4/accounts/'
    },
    // ✅ [Изображение в Изображение - /photo]
    IMAGE_TO_IMAGE_WORKERS_AI: { 
        SERVICE: 'WORKERS_AI', 
        MODEL: '@cf/runwayml/stable-diffusion-v1-5-img2img', 
        API_KEY: 'CLOUDFLARE_API_TOKEN', 
        BASE_URL: 'https://api.cloudflare.com/client/v4/accounts/'
    },
    // ✅ [Видео в Текст]
    VIDEO_TO_TEXT_WORKERS_AI: { 
        SERVICE: 'WORKERS_AI', 
        MODEL: '@cf/openai/whisper', 
        API_KEY: 'CLOUDFLARE_API_TOKEN', 
        BASE_URL: 'https://api.cloudflare.com/client/v4/accounts/'
    },

    // --- BOTHUB TEXT --- (БЕСПЛАТНО)
    TEXT_TO_TEXT_BOTHUB: { 
        SERVICE: 'BOTHUB',       
        MODEL: 'gemini-2.5-flash',       
        API_KEY: 'BOTHUB_API_KEY', 
        BASE_URL: 'https://bothub.chat/api/v2/openai/v1'
    },
    TEXT_TO_AUDIO_BOTHUB: { 
        SERVICE: 'BOTHUB', 
        MODEL: 'tts-1',
        API_KEY: 'BOTHUB_API_KEY', 
        BASE_URL: 'https://bothub.chat/api/v2/openai/v1'
    },
    // --- BOTHUB WHISPER-1 --- (ПЛАТНО)
    AUDIO_TO_TEXT_BOTHUB: { 
        SERVICE: 'BOTHUB', 
        MODEL: 'whisper-1', 
        API_KEY: 'BOTHUB_API_KEY', 
        BASE_URL: 'https://bothub.chat/api/v2/openai/v1'
    },
    // --- BOTHUB VISION --- (ПЛАТНО и нестабильно)
    IMAGE_TO_TEXT_BOTHUB: { 
        SERVICE: 'BOTHUB',   
        MODEL: 'gemini-2.5-flash',         
        API_KEY: 'BOTHUB_API_KEY', 
        BASE_URL: 'https://bothub.chat/api/v2/openai/v1'
    },
    // [DALL-E-3 - /create] (ПЛАТНЫЙ - 33000 CAPS / 5,19 ₽ за шт.)
    TEXT_TO_IMAGE_BOTHUB: { 
        SERVICE: 'BOTHUB', 
        MODEL: 'dall-e-3', 
        API_KEY: 'BOTHUB_API_KEY',
        BASE_URL: 'https://bothub.chat/api/v2/openai/v1'
    },
    // [gemini-2.5-flash-image для /photo] (Через BotHub API, ПЛАТНЫЙ)
    IMAGE_TO_IMAGE_BOTHUB: { 
        SERVICE: 'BOTHUB', 
        MODEL: 'gemini-2.5-flash-image', 
        API_KEY: 'BOTHUB_API_KEY',
        BASE_URL: 'https://bothub.chat/api/v2/openai/v1'
    }, 
    // --- BOTHUB WHISPER-1 --- (ПЛАТНО)
    VIDEO_TO_TEXT_BOTHUB: { 
        SERVICE: 'BOTHUB', 
        MODEL: 'whisper-1', 
        API_KEY: 'BOTHUB_API_KEY', 
        BASE_URL: 'https://bothub.chat/api/v2/openai/v1'
    },
    // --- BOTHUB VIDEO VISION --- (ПЛАТНО)
    VIDEO_TO_ANALYSIS_BOTHUB: { 
        SERVICE: 'BOTHUB', 
        MODEL: 'gemini-2.5-flash',         
        API_KEY: 'BOTHUB_API_KEY', 
        BASE_URL: 'https://bothub.chat/api/v2/openai/v1'
    },

    // [FUSIONBRAIN Kandinsky - /create] (Тестовый, ПЛАТНЫЙ попытки 88/100 до 01.01.2026)
    TEXT_TO_IMAGE_KANDINSKY: { 
        SERVICE: 'FUSIONBRAIN', 
        MODEL: 'kandinsky', 
        API_KEY: 'FUSIONBRAIN_API_KEY',
        BASE_URL: 'https://api-key.fusionbrain.ai'
    },

    // Текст в голос - говорилка для /say
    TEXT_TO_AUDIO_VOICERSS: { 
        SERVICE: 'VOICERSS', 
        MODEL: 'hl=ru-ru&v=TTS-Model&c=MP3',
        API_KEY: 'VOICERSS_API_KEY', 
        BASE_URL: 'http://api.voicerss.org'
    },

    // --- DEEPSEEK ---
    TEXT_TO_TEXT_DEEPSEEK: { 
        SERVICE: 'DEEPSEEK', 
        MODEL: 'deepseek-chat', 
        API_KEY: 'DEEPSEEK_API_KEY', 
        BASE_URL: 'https://api.deepseek.com/v1'
    },
};

export const SERVICE_TYPE_MAP = {
    'TEXT_TO_TEXT': { name: '✍️ Text → Text', kvKey: 'leshiy-ai-config-text-model' },
    'IMAGE_TO_TEXT': { name: '👁️ Image → Text', kvKey: 'leshiy-ai-config-image-model' },
    'AUDIO_TO_TEXT': { name: '🎤 Audio → Text', kvKey: 'ACTIVE_MODEL_AUDIO_TO_TEXT' },
    'VIDEO_TO_TEXT': { name: '🎧 Video → Text', kvKey: 'ACTIVE_MODEL_VIDEO_TO_TEXT' },
    'TEXT_TO_AUDIO': { name: '🔊 Text → Audio', kvKey: 'ACTIVE_MODEL_TEXT_TO_AUDIO' },
    'TEXT_TO_IMAGE': { name: '📖 Text → Image', kvKey: 'ACTIVE_MODEL_TEXT_TO_IMAGE' },
    'IMAGE_TO_IMAGE': { name: '✨ Image → Image', kvKey: 'ACTIVE_MODEL_IMAGE_TO_IMAGE' },
    'TEXT_TO_VIDEO': { name: '📹 Text → Video', kvKey: 'ACTIVE_MODEL_TEXT_TO_VIDEO' },
    'IMAGE_TO_VIDEO': { name: '🎬 Image → Video', kvKey: 'ACTIVE_MODEL_IMAGE_TO_VIDEO' },
    'VIDEO_TO_VIDEO': { name: '🎥 Video → Video', kvKey: 'ACTIVE_MODEL_VIDEO_TO_VIDEO' },
    'AUDIO_TO_AUDIO': { name: '💿 Audio → Audio', kvKey: 'ACTIVE_MODEL_AUDIO_TO_AUDIO' },
    'AUDIO_TO_VIDEO': { name: '🗣 Audio → Video', kvKey: 'ACTIVE_MODEL_AUDIO_TO_VIDEO' },
    'IMAGE_TO_UPSCALE' : {name: '📈 Image → Upscale', kvKey: 'ACTIVE_MODEL_IMAGE_TO_UPSCALE' },
    'VIDEO_TO_UPSCALE' : {name: '📺 Video → Upscale', kvKey: 'ACTIVE_MODEL_VIDEO_TO_UPSCALE' },
    'VIDEO_TO_ANALYSIS' : {name: '👀 Video → Analysis', kvKey: 'ACTIVE_MODEL_VIDEO_TO_ANALYSIS' },
};

/**
 * Generates a configuration for the AI model selection menu.
 * It iterates over all defined models and groups them by their service type
 * (e.g., TEXT_TO_TEXT, IMAGE_TO_TEXT) based on the model key prefix.
 * @param {object} models - The AI_MODELS object.
 * @returns {object} A configuration object for the UI menu.
 */
export function generateModelMenuConfig(models) {
  const config = {};
  // Initialize the config object with all possible service types from the map
  for (const serviceType in SERVICE_TYPE_MAP) {
      config[serviceType] = {
          name: SERVICE_TYPE_MAP[serviceType].name,
          kvKey: SERVICE_TYPE_MAP[serviceType].kvKey,
          models: {}
      };
  }

  // Iterate over each model and place it in the correct service type category
  for (const [modelKey, modelDetails] of Object.entries(models)) {
    // Find the service type that is a prefix of the model key
    // For example, "TEXT_TO_TEXT_GEMINI" matches "TEXT_TO_TEXT"
    const matchingServiceType = Object.keys(SERVICE_TYPE_MAP).find(serviceType => modelKey.startsWith(serviceType));

    if (matchingServiceType) {
        // Create a user-friendly name for the model dropdown
        const friendlyName = `${modelDetails.SERVICE}: ${modelDetails.MODEL.split('/').pop()}`;
        config[matchingServiceType].models[modelKey] = friendlyName;
    }
  }
  return config;
}


export const AI_MODEL_MENU_CONFIG = generateModelMenuConfig(AI_MODELS);

/**
 * Gets the key for the currently active model for a given service type.
 * It checks localStorage first, and falls back to the first available model.
 * @param {string} serviceType - The type of service (e.g., 'TEXT_TO_TEXT').
 * @returns {string|null} The key of the active model or null.
 */
export function getActiveModelKey(serviceType) {
    const serviceConfig = SERVICE_TYPE_MAP[serviceType];
    if (!serviceConfig) return null;

    const storedModelKey = localStorage.getItem(serviceConfig.kvKey);
    if (storedModelKey && AI_MODELS[storedModelKey]) {
        return storedModelKey;
    }
    
    // Fallback to the first model in the list for that service type
    const defaultModelKey = Object.keys(AI_MODEL_MENU_CONFIG[serviceType]?.models || {})[0];
    return defaultModelKey || null;
}

/**
 * Loads the full configuration object for the active model of a service type.
 * @param {string} serviceType - The type of service (e.g., 'TEXT_TO_TEXT').
 * @returns {object|null} The full model configuration object or null.
 */
export function loadActiveModelConfig(serviceType) {
    const modelKey = getActiveModelKey(serviceType);
    if (!modelKey) return null;
    const config = AI_MODELS[modelKey];
    return { ...config, key: modelKey }; 
}
