import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    // Finché non esiste il primo test (T-005) la suite vuota non deve fallire.
    passWithNoTests: true,
  },
});
