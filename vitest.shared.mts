import { fileURLToPath } from 'node:url';

const sourceDirectory = fileURLToPath(new URL('./src', import.meta.url));

export const sharedConfig = {
  resolve: {
    alias: [{ find: /^@eolian\/(.+)$/, replacement: `${sourceDirectory}/$1` }],
  },
  test: {
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    isolate: true,
    clearMocks: true,
    restoreMocks: true,
    unstubEnvs: true,
    unstubGlobals: true,
    coverage: {
      provider: 'v8' as const,
      reporter: ['text' as const, 'html' as const, 'lcov' as const],
      reportsDirectory: './coverage',
      include: ['src/**/*.ts'],
      exclude: ['src/app.ts', 'src/**/@types.ts', 'src/**/index.ts'],
    },
  },
};
