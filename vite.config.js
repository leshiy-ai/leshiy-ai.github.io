import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';

// Читаем package.json, чтобы получить версию и автора
const packageJson = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'package.json'), 'utf-8'));

export default defineConfig({
  plugins: [react()],
  base: './',
  define: {
    // Передаем переменные в приложение
    'process.env.APP_VERSION': JSON.stringify(packageJson.version),
    'process.env.APP_AUTHOR': JSON.stringify(packageJson.author),
  },
});
