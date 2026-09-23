import { resolve } from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, loadEnv } from 'vite';
import { validateDiscordClientId } from './web/config/discord-client-id.mts';

const root = import.meta.dirname;
const envDir = resolve(root, 'web');

export default defineConfig(({ mode }) => {
  validateDiscordClientId(loadEnv(mode, envDir, 'VITE_').VITE_DISCORD_CLIENT_ID);

  return {
    root,
    envDir,
    publicDir: false,
    plugins: [tailwindcss()],
    server: {
      port: 5173,
      strictPort: true,
      proxy: {
        '/api': {
          target: 'http://127.0.0.1:8080',
        },
        '/callback/': {
          target: 'http://127.0.0.1:8080',
        },
      },
    },
    build: {
      target: 'es2022',
      outDir: resolve(root, 'dist/public'),
      emptyOutDir: true,
      sourcemap: mode === 'development',
      minify: mode === 'production' ? 'oxc' : false,
    },
  };
});
