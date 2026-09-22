import { resolve } from 'node:path';
import { defineConfig } from 'vite';

const root = import.meta.dirname;

export default defineConfig({
  build: {
    ssr: resolve(root, 'tests/e2e/harness.ts'),
    target: 'node24',
    outDir: resolve(root, 'dist/e2e'),
    emptyOutDir: true,
    minify: false,
    sourcemap: true,
    rolldownOptions: {
      output: {
        format: 'esm',
        entryFileNames: 'harness.mjs',
        codeSplitting: false,
      },
    },
  },
});
