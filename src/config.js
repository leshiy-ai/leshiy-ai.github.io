export const CONFIG = {
    // Твой прокси для Gemini (Cloudflare)
    // В Vite доступ к переменным идет через import.meta.env
    GEMINI_PROXY: import.meta.env.VITE_GEMINI_PROXY || "https://gemini-proxy.leshiyalex.workers.dev/v1beta",
    GEMINI_API_KEY: import.meta.env.VITE_GEMINI_API_KEY,
    PROXY_SECRET: import.meta.env.VITE_PROXY_SECRET,
    
    // Твоя Хранилка (Яндекс)
    STORAGE_GATEWAY: "https://d5dtt5rfr7nk66bbrec2.kf69zffa.apigw.yandexcloud.net",
    // Твой медиа-бот (Cloudflare)
    GEMINI_AI_BOT: "https://leshiy-gemini-bot.leshiyalex.workers.dev"
};
