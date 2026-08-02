import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The embed build: one self-contained ES module (React + styled-components
// bundled) that the VG-800 app commits as an artifact and lazy-imports.
// ES format only — the worklet ships inline via ?raw + Blob and the code
// uses import.meta, both of which UMD/IIFE would break.
export default defineConfig({
  plugins: [react()],
  define: { 'process.env.NODE_ENV': JSON.stringify('production') },
  build: {
    outDir: 'dist-embed',
    emptyOutDir: true,
    lib: {
      entry: 'src/embed.tsx',
      formats: ['es'],
      fileName: () => 'fretboard-embed.es.js',
    },
  },
});
