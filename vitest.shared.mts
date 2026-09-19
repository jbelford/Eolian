import { fileURLToPath } from 'node:url';

const sourceDirectory = fileURLToPath(new URL('./src', import.meta.url));

export const sharedConfig = {
  define: {
    __COMMIT_DATE__: JSON.stringify('test'),
  },
  resolve: {
    alias: [{ find: /^@eolian\/(.+)$/, replacement: `${sourceDirectory}/$1` }],
  },
  test: {
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    isolate: true,
    pool: 'forks' as const,
    fileParallelism: true,
    maxWorkers: '100%',
    maxConcurrency: 5,
    clearMocks: true,
    restoreMocks: true,
    unstubEnvs: true,
    unstubGlobals: true,
    coverage: {
      provider: 'v8' as const,
      reporter: ['text' as const, 'html' as const, 'lcov' as const],
      reportsDirectory: './coverage',
      include: ['src/**/*.ts'],
      exclude: [
        'src/app.ts',
        'src/**/@types.ts',
        'src/**/index.ts',
        // Browser-backed proof-token generation is an external integration boundary.
        'src/api/youtube/potoken.ts',
      ],
      thresholds: {
        statements: 85,
        branches: 78,
        functions: 85,
        lines: 85,
      },
    },
  },
};
