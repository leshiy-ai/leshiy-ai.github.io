/**
 * Основной файл конфигурации.
 * Считывает переменные окружения, установленные во время сборки (build).
 * Важно: эти переменные НЕ являются секретами в браузере. Они встраиваются в код
 * в момент сборки в GitHub Actions.
 */
export const CONFIG = {
    // Прокси для Gemini, чтобы обходить блокировки Google.
    // В Vite доступ к переменным идет через import.meta.env
    GEMINI_PROXY: import.meta.env.VITE_GEMINI_PROXY || "https://gemini-proxy.leshiyalex.workers.dev/v1beta",
    PROXY_SECRET: import.meta.env.VITE_PROXY_SECRET,
    GEMINI_API_KEY: import.meta.env.VITE_GEMINI_API_KEY,
    CLOUDFLARE_API_TOKEN: import.meta.env.VITE_CLOUDFLARE_API_TOKEN,
    CLOUDFLARE_ACCOUNT_ID: import.meta.env.VITE_CLOUDFLARE_ACCOUNT_ID,
    BOTHUB_API_KEY: import.meta.env.VITE_BOTHUB_API_KEY,
        
    // Твоя Хранилка (Яндекс)
    STORAGE_GATEWAY: "https://d5dtt5rfr7nk66bbrec2.kf69zffa.apigw.yandexcloud.net",
    // Твой медиа-бот (Cloudflare)
    GEMINI_AI_BOT: "https://leshiy-gemini-bot.leshiyalex.workers.dev"
};