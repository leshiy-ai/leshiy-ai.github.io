
// This is a simplified client-side adaptation of the AI configuration
// from the provided gemini-bot and leshiy-storage-bot projects.

// In a real application, the functions would make API calls.
// Here, they are placeholders.

const placeholderFunction = async (config, data, env) => {
    console.log(`Calling ${config.MODEL} via ${config.SERVICE}`);
    return { text: `Response from ${config.MODEL}` };
};

export const AI_MODELS = {
    // --- GEMINI ---
    TEXT_TO_TEXT_GEMINI: { 
        SERVICE: 'GEMINI', 
        FUNCTION: placeholderFunction, 
        MODEL: 'gemini-2.5-flash', 
        API_KEY: 'GEMINI_API_KEY', 
        BASE_URL: 'https://generativelanguage.googleapis.com/v1beta'
    },
    IMAGE_TO_TEXT_GEMINI: { 
        SERVICE: 'GEMINI', 
        FUNCTION: placeholderFunction, 
        MODEL: 'gemini-2.5-flash', 
        API_KEY: 'GEMINI_API_KEY', 
        BASE_URL: 'https://generativelanguage.googleapis.com/v1beta'
    },

    // --- WORKERS AI ---
    TEXT_TO_TEXT_WORKERS_AI: { 
        SERVICE: 'WORKERS_AI', 
        FUNCTION: placeholderFunction, 
        MODEL: '@cf/qwen/qwen1.5-14b-chat-awq',
        API_KEY: 'CLOUDFLARE_API_TOKEN', 
        BASE_URL: 'AI_RUN'
    },
    IMAGE_TO_TEXT_WORKERS_AI: { 
        SERVICE: 'WORKERS_AI', 
        FUNCTION: placeholderFunction,
        MODEL: '@cf/unum/uform-gen2-qwen-500m', 
        API_KEY: 'CLOUDFLARE_API_TOKEN', 
        BASE_URL: 'AI_RUN'
    },
};

export const SERVICE_TYPE_MAP = {
    'TEXT_TO_TEXT': { name: '✍️ Text → Text', kvKey: 'ai_config:ACTIVE_MODEL_TEXT_TO_TEXT' },
    'IMAGE_TO_TEXT': { name: '👁️ Image → Text', kvKey: 'ai_config:ACTIVE_MODEL_IMAGE_TO_TEXT' },
    // Add other service types as needed
};

export function generateModelMenuConfig(models) {
  const config = {};

  for (const [modelKey, modelDetails] of Object.entries(models)) {
      const parts = modelKey.split('_');
      const serviceType = parts.slice(0, 3).join('_');

      if (!SERVICE_TYPE_MAP[serviceType]) continue;

      if (!config[serviceType]) {
          config[serviceType] = {
              name: SERVICE_TYPE_MAP[serviceType].name,
              kvKey: SERVICE_TYPE_MAP[serviceType].kvKey,
              models: {}
          };
      }

      let friendlyName = `${modelDetails.SERVICE}: ${modelDetails.MODEL}`;
      config[serviceType].models[modelKey] = friendlyName;
  }
  return config;
}

export const AI_MODEL_MENU_CONFIG = generateModelMenuConfig(AI_MODELS);

export async function loadActiveConfig(serviceType) {
    const serviceConfig = SERVICE_TYPE_MAP[serviceType];
    if (!serviceConfig) {
        throw new Error(`Unknown service type: ${serviceType}`);
    }

    const kvKey = serviceConfig.kvKey;
    const defaultModelKey = Object.keys(AI_MODEL_MENU_CONFIG[serviceType]?.models || AI_MODELS).find(
        key => key.startsWith(serviceType)
    ) || Object.keys(AI_MODELS).find(key => key.startsWith(serviceType));

    // On the client, we use localStorage instead of a KV store.
    const activeModelKey = localStorage.getItem(kvKey) || defaultModelKey;
    
    const modelConfig = AI_MODELS[activeModelKey];

    if (!modelConfig) {
        console.error(`Config for model key "${activeModelKey}" not found, falling back to default.`);
        return AI_MODELS[defaultModelKey];
    }

    return modelConfig;
}
