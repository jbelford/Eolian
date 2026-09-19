import { resolve } from 'node:path';
import { defineConfig } from 'vite';

const root = import.meta.dirname;

export default defineConfig(({ mode }) => ({
  root,
  publicDir: false,
  build: {
    target: 'es2015',
    outDir: resolve(root, 'dist/public'),
    emptyOutDir: true,
    sourcemap: mode === 'development',
    minify: mode === 'production' ? 'oxc' : false,
  },
}));
