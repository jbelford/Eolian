import { defineConfig } from 'vitest/config';
import { sharedConfig } from './vitest.shared.mts';

export default defineConfig({
  ...sharedConfig,
  test: {
    ...sharedConfig.test,
    environment: 'jsdom',
    include: ['tests/web/**/*.{test,spec}.{ts,tsx}'],
    setupFiles: ['./tests/web/setup.ts'],
  },
});
