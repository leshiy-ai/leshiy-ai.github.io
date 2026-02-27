// Этот файл адаптирован из рабочей конфигурации пользователя в gemini-bot и leshiy-storage-bot.

export const AI_MODELS = {
    // --- Модели Gemini ---
    TEXT_TO_TEXT_GEMINI: { 
        SERVICE: 'GEMINI', 
        MODEL: 'gemini-2.5-flash',
        API_KEY: 'GEMINI_API_KEY', 
        BASE_URL: 'https://generativelanguage.googleapis.com/v1beta'
    },
    AUDIO_TO_TEXT_GEMINI: { 
        SERVICE: 'GEMINI', 
        MODEL: 'gemini-2.5-flash', 
        API_KEY: 'GEMINI_API_KEY', 
        BASE_URL: 'https://generativelanguage.googleapis.com/v1beta'
    },
    VIDEO_TO_TEXT_GEMINI: { 
        SERVICE: 'GEMINI', 
        MODEL: 'gemini-2.5-flash', 
        API_KEY: 'GEMINI_API_KEY', 
        BASE_URL: 'https://generativelanguage.googleapis.com/v1beta'
    },
    TEXT_TO_AUDIO_GEMINI: { 
        SERVICE: 'GEMINI', 
        MODEL: 'gemini-2.5-flash-preview-tts', 
        API_KEY: 'GEMINI_API_KEY', 
        BASE_URL: 'https://generativelanguage.googleapis.com/v1beta'
    },
    IMAGE_TO_TEXT_GEMINI: { 
        SERVICE: 'GEMINI', 
        MODEL: 'gemini-2.5-flash',
        API_KEY: 'GEMINI_API_KEY', 
        BASE_URL: 'https://generativelanguage.googleapis.com/v1beta'
    },
    VIDEO_TO_ANALYSIS_GEMINI: { 
        SERVICE: 'GEMINI', 
        MODEL: 'gemini-2.5-flash', 
        API_KEY: 'GEMINI_API_KEY', 
        BASE_URL: 'https://generativelanguage.googleapis.com/v1beta'
    },

    // --- Модели Cloudflare ---

    // ✅ [Текст в Текст]
    TEXT_TO_TEXT_CLOUDFLARE: { 
        SERVICE: 'CLOUDFLARE', 
        MODEL: '@cf/qwen/qwen2.5-coder-32b-instruct',
        API_KEY: 'CLOUDFLARE_API_TOKEN', 
        BASE_URL: 'https://api.cloudflare.com/client/v4/accounts/'
    },
    // ✅ [Аудио в Текст]
    AUDIO_TO_TEXT_CLOUDFLARE: { 
        SERVICE: 'CLOUDFLARE', 
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
    // ✅ [Текст в Голос]
    TEXT_TO_AUDIO_CLOUDFLARE: { 
        SERVICE: 'CLOUDFLARE', 
        MODEL: '@cf/deepgram/aura-1', 
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
    // ✅ [Текст в Изображение]
    TEXT_TO_IMAGE_CLOUDFLARE: { 
        SERVICE: 'CLOUDFLARE', 
        MODEL: '@cf/stabilityai/stable-diffusion-xl-base-1.0', 
        API_KEY: 'CLOUDFLARE_API_TOKEN', 
        BASE_URL: 'https://api.cloudflare.com/client/v4/accounts/'
    },
    // ✅ [Изображение в Изображение]
    IMAGE_TO_IMAGE_CLOUDFLARE: { 
        SERVICE: 'CLOUDFLARE', 
        MODEL: '@cf/runwayml/stable-diffusion-v1-5-img2img', 
        API_KEY: 'CLOUDFLARE_API_TOKEN', 
        BASE_URL: 'https://api.cloudflare.com/client/v4/accounts/'
    },
    // ✅ [Видео в Текст]
    VIDEO_TO_TEXT_CLOUDFLARE: { 
        SERVICE: 'CLOUDFLARE', 
        MODEL: '@cf/openai/whisper', 
        API_KEY: 'CLOUDFLARE_API_TOKEN', 
        BASE_URL: 'https://api.cloudflare.com/client/v4/accounts/'
    },

    // --- Модели Bothub (OpenAI-совместимые) ---
    
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
    AUDIO_TO_TEXT_BOTHUB: { 
        SERVICE: 'BOTHUB', 
        MODEL: 'whisper-1', 
        API_KEY: 'BOTHUB_API_KEY', 
        BASE_URL: 'https://bothub.chat/api/v2/openai/v1'
    },
    IMAGE_TO_TEXT_BOTHUB: { 
        SERVICE: 'BOTHUB',   
        MODEL: 'gemini-2.5-flash',         
        API_KEY: 'BOTHUB_API_KEY', 
        BASE_URL: 'https://bothub.chat/api/v2/openai/v1'
    },
    TEXT_TO_IMAGE_BOTHUB: { 
        SERVICE: 'BOTHUB', 
        MODEL: 'dall-e-3', 
        API_KEY: 'BOTHUB_API_KEY',
        BASE_URL: 'https://bothub.chat/api/v2/openai/v1'
    },
    IMAGE_TO_IMAGE_BOTHUB: { 
        SERVICE: 'BOTHUB', 
        MODEL: 'gemini-2.5-flash-image', 
        API_KEY: 'BOTHUB_API_KEY',
        BASE_URL: 'https://bothub.chat/api/v2/openai/v1'
    }, 
    VIDEO_TO_TEXT_BOTHUB: { 
        SERVICE: 'BOTHUB', 
        MODEL: 'whisper-1', 
        API_KEY: 'BOTHUB_API_KEY', 
        BASE_URL: 'https://bothub.chat/api/v2/openai/v1'
    },
    VIDEO_TO_ANALYSIS_BOTHUB: { 
        SERVICE: 'BOTHUB', 
        MODEL: 'gemini-2.5-flash',         
        API_KEY: 'BOTHUB_API_KEY', 
        BASE_URL: 'https://bothub.chat/api/v2/openai/v1'
    },

    // --- Прочие модели ---
    TEXT_TO_IMAGE_KANDINSKY: { 
        SERVICE: 'FUSIONBRAIN', 
        MODEL: 'kandinsky', 
        API_KEY: 'FUSIONBRAIN_API_KEY',
        BASE_URL: 'https://api-key.fusionbrain.ai'
    },
    TEXT_TO_AUDIO_VOICERSS: { 
        SERVICE: 'VOICERSS', 
        MODEL: 'hl=ru-ru&v=TTS-Model&c=MP3',
        API_KEY: 'VOICERSS_API_KEY', 
        BASE_URL: 'http://api.voicerss.org'
    },
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
 * Генерирует конфигурацию для меню выбора AI-моделей.
 * Функция проходит по всем определенным моделям и группирует их по типу сервиса
 * (например, TEXT_TO_TEXT, IMAGE_TO_TEXT) на основе префикса ключа модели.
 * @param {object} models - Объект AI_MODELS.
 * @returns {object} Объект конфигурации для UI-меню.
 */
export function generateModelMenuConfig(models) {
  const config = {};
  // Инициализируем объект конфигурации всеми возможными типами сервисов из карты
  for (const serviceType in SERVICE_TYPE_MAP) {
      config[serviceType] = {
          name: SERVICE_TYPE_MAP[serviceType].name,
          kvKey: SERVICE_TYPE_MAP[serviceType].kvKey,
          models: {}
      };
  }

  // Проходим по каждой модели и помещаем ее в правильную категорию сервиса
  for (const [modelKey, modelDetails] of Object.entries(models)) {
    // Находим тип сервиса, который является префиксом ключа модели
    // Например, "TEXT_TO_TEXT_GEMINI" соответствует "TEXT_TO_TEXT"
    const matchingServiceType = Object.keys(SERVICE_TYPE_MAP).find(serviceType => modelKey.startsWith(serviceType));

    if (matchingServiceType) {
        // Создаем понятное имя для выпадающего списка моделей
        const friendlyName = `${modelDetails.SERVICE}: ${modelDetails.MODEL.split('/').pop()}`;
        config[matchingServiceType].models[modelKey] = friendlyName;
    }
  }
  return config;
}

export const AI_MODEL_MENU_CONFIG = generateModelMenuConfig(AI_MODELS);

/**
 * Получает ключ для текущей активной модели для заданного типа сервиса.
 * Сначала проверяет localStorage, а затем возвращает первую доступную модель в качестве запасного варианта.
 * @param {string} serviceType - Тип сервиса (например, 'TEXT_TO_TEXT').n * @returns {string|null} Ключ активной модели или null.
 */
export function getActiveModelKey(serviceType) {
    const serviceConfig = SERVICE_TYPE_MAP[serviceType];
    if (!serviceConfig) return null;

    const storedModelKey = localStorage.getItem(serviceConfig.kvKey);
    if (storedModelKey && AI_MODELS[storedModelKey]) {
        return storedModelKey;
    }
    
    // Запасной вариант: первая модель в списке для данного типа сервиса
    const defaultModelKey = Object.keys(AI_MODEL_MENU_CONFIG[serviceType]?.models || {})[0];
    return defaultModelKey || null;
}

/**
 * Загружает полный объект конфигурации для активной модели указанного типа сервиса.
 * @param {string} serviceType - Тип сервиса (например, 'TEXT_TO_TEXT').n * @returns {object|null} Полный объект конфигурации модели или null.
 */
export function loadActiveModelConfig(serviceType) {
    const modelKey = getActiveModelKey(serviceType);
    if (!modelKey) return null;
    const config = AI_MODELS[modelKey];
    return { ...config, key: modelKey }; 
}
