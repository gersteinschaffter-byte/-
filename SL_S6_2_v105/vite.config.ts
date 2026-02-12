import { defineConfig } from 'vite';

// Vite is used only as a lightweight dev server + bundler.
// Keep the config minimal so it's easy to maintain.
export default defineConfig({
  server: {
    port: 5173,
    strictPort: true,
  },
  build: {
    target: 'es2020',
  },
});
