import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    include: ['**/*.test.ts'],
    exclude: [...configDefaults.exclude, '.next/**'],
  },
});
