import { defineConfig } from 'vite';

// Relative base, so the same build works on GitHub Pages (under /skyline-sniper/) and inside
// the Android app. Downloaded assets live in public/game-assets and are copied as they are.
export default defineConfig({
  base: './',
  build: {
    target: 'es2020',
    outDir: 'dist',
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 1200
  }
});
