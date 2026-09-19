import { defineConfig } from 'vitest/config';
import { sharedConfig } from './vitest.shared.mts';

export default defineConfig({
  ...sharedConfig,
  test: {
    ...sharedConfig.test,
    include: ['tests/integration/**/*.{test,spec}.ts'],
  },
});
