import { CONFIG } from './config.js';

const CLOUDFLARE_ACCOUNT_ID = CONFIG.CLOUDFLARE_ACCOUNT_ID;

export const AI_MODELS = {
    // --- Gemini Models ---
    TEXT_TO_TEXT_GEMINI: { 
        SERVICE: 'GEMINI', 
        MODEL: 'gemini-2.5-flash',
        API_KEY: 'GEMINI_API_KEY', 
        BASE_URL: 'https://gemini-proxy.leshiyalex.workers.dev/v1beta'
    },
    IMAGE_TO_TEXT_GEMINI: { 
        SERVICE: 'GEMINI', 
        MODEL: 'gemini-2.5-flash',
        API_KEY: 'GEMINI_API_KEY', 
        BASE_URL: 'https://gemini-proxy.leshiyalex.workers.dev/v1beta'
    },

    // --- Cloudflare Models ---
    TEXT_TO_TEXT_CLOUDFLARE: { 
        SERVICE: 'CLOUDFLARE', 
        MODEL: '@cf/qwen/qwen1.5-14b-chat-awq',
        API_KEY: 'CLOUDFLARE_API_TOKEN', 
        BASE_URL: `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/ai`
    },
    TEXT_TO_TEXT_LLAMA: { 
        SERVICE: 'CLOUDFLARE', 
        MODEL: '@cf/meta/llama-3-8b-instruct',
        API_KEY: 'CLOUDFLARE_API_TOKEN', 
        BASE_URL: `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/ai`
    },
    IMAGE_TO_TEXT_CLOUDFLARE: { 
        SERVICE: 'CLOUDFLARE',
        MODEL: '@cf/unum/uform-gen2-qwen-500m', 
        API_KEY: 'CLOUDFLARE_API_TOKEN', 
        BASE_URL: `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/ai`
    },
};

export const SERVICE_TYPE_MAP = {
    'TEXT_TO_TEXT': { name: '✍️ Text → Text', kvKey: 'leshiy-ai-config-text-model' },
    'IMAGE_TO_TEXT': { name: '👁️ Image → Text', kvKey: 'leshiy-ai-config-image-model' },
};

export function generateModelMenuConfig(models) {
  const config = {};
  for (const serviceType in SERVICE_TYPE_MAP) {
      config[serviceType] = {
          name: SERVICE_TYPE_MAP[serviceType].name,
          kvKey: SERVICE_TYPE_MAP[serviceType].kvKey,
          models: {}
      };
  }

  for (const [modelKey, modelDetails] of Object.entries(models)) {
      const isImageModel = modelKey.includes('IMAGE');
      const serviceType = isImageModel ? 'IMAGE_TO_TEXT' : 'TEXT_TO_TEXT';

      if (config[serviceType]) {
          const friendlyName = `${modelDetails.SERVICE}: ${modelDetails.MODEL.split('/').pop()}`;
          config[serviceType].models[modelKey] = friendlyName;
      }
  }
  return config;
}

export const AI_MODEL_MENU_CONFIG = generateModelMenuConfig(AI_MODELS);

export function getActiveModelKey(serviceType) {
    const serviceConfig = SERVICE_TYPE_MAP[serviceType];
    if (!serviceConfig) return null;

    const storedModelKey = localStorage.getItem(serviceConfig.kvKey);
    if (storedModelKey && AI_MODELS[storedModelKey]) {
        return storedModelKey;
    }

    const defaultModelKey = Object.keys(AI_MODEL_MENU_CONFIG[serviceType]?.models || {})[0];
    return defaultModelKey || null;
}

export function loadActiveModelConfig(serviceType) {
    const modelKey = getActiveModelKey(serviceType);
    if (!modelKey) return null;
    const config = AI_MODELS[modelKey];
    return { ...config, key: modelKey }; 
}
