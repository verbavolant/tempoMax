import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import tseslint from 'typescript-eslint';

export default defineConfig(
  globalIgnores(['dist/']),
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    // Service worker in JS puro, copiato così com'è da Vite (public/): globali del contesto worker.
    files: ['public/sw.js'],
    languageOptions: {
      globals: { self: 'readonly', caches: 'readonly', fetch: 'readonly', URL: 'readonly' },
    },
  },
);
