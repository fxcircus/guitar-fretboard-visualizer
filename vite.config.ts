/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Deployed to GitHub Pages at /<repo>/, so assets need that prefix. `npm run
// dev` and `npm run preview` set BASE_PATH=/ implicitly via mode.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/guitar-fretboard-visualizer/' : '/',
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
}));
