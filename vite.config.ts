import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';
import deployment from './vercel.json';

const contentPolicy = deployment.headers.flatMap(rule => rule.headers)
  .find(header => header.key === 'Content-Security-Policy-Report-Only')!.value;

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      chunkSizeWarningLimit: 700,
    },
    // Acceptance browsers exercise the production policy under enforcement.
    preview: { headers: { 'Content-Security-Policy': contentPolicy } },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
