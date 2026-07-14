import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      include: ['packages/*/src/**/*.ts'],
      provider: 'v8',
    },
    include: ['apps/mobile/src/**/*.test.ts', 'packages/*/src/**/*.test.ts'],
  },
});
