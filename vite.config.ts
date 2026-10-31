import { defineConfig } from 'vitest/config';

export default defineConfig({
  // GitHub Pages pubblica il repo sotto https://verbavolant.github.io/tempoMax/ (doc Vite "Deploying a Static Site").
  base: '/tempoMax/',
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
