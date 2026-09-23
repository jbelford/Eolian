import { defineConfig } from 'vitest/config';
import { sharedConfig } from './vitest.shared.mts';

export default defineConfig({
  ...sharedConfig,
  test: {
    ...sharedConfig.test,
    environment: 'jsdom',
    env: { VITE_DISCORD_CLIENT_ID: '123456789012345678' },
    include: ['tests/web/**/*.{test,spec}.{ts,tsx}'],
    setupFiles: ['./tests/web/setup.ts'],
  },
});
