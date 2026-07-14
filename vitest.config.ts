import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      include: ['packages/*/src/**/*.ts'],
      provider: 'v8',
    },
    include: ['packages/*/src/**/*.test.ts'],
  },
});
