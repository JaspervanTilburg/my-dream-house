import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    // Three.js alone is about 600 KB; that is expected for this app.
    chunkSizeWarningLimit: 1000,
  },
});
