import { resolve } from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

const root = import.meta.dirname;

export default defineConfig(({ mode }) => ({
  root,
  publicDir: false,
  plugins: [tailwindcss()],
  build: {
    target: 'es2022',
    outDir: resolve(root, 'dist/public'),
    emptyOutDir: true,
    sourcemap: mode === 'development',
    minify: mode === 'production' ? 'oxc' : false,
  },
}));
