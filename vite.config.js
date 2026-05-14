import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';

// Читаем package.json, чтобы получить версию и автора
const packageJson = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'package.json'), 'utf-8'));

export default defineConfig({
  plugins: [react()],
  base: './', // Оставляем как есть, для GitHub Pages это правильно
  build: {
    crossOrigin: false,
    outDir: 'dist',
    // НОВОЕ: Указываем Vite собирать две точки входа
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'), // Ваша главная страница
        vk: path.resolve(__dirname, 'vk.html'),      // Наша новая страница авторизации
      },
    },
  },
  define: {
    // Передаем переменные в приложение
    'process.env.APP_VERSION': JSON.stringify(packageJson.version),
    'process.env.APP_AUTHOR': JSON.stringify(packageJson.author),
  },
});
