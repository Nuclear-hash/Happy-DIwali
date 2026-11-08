import { defineConfig } from 'vite';

export default defineConfig({
  // Set VITE_BASE=/<repo>/ for GitHub Pages project sites; '/' everywhere else.
  base: process.env.VITE_BASE || '/',
  server: {
    host: '0.0.0.0',
    port: 3000,
    // The preview hostname is injected at runtime so no VM name is baked in.
    // localhost / 127.0.0.1 stay allowed so the app also works when run locally.
    allowedHosts: process.env.PREVIEW_HOST
      ? [process.env.PREVIEW_HOST, 'localhost', '127.0.0.1']
      : ['localhost', '127.0.0.1'],
    fs: { strict: false },
  },
  build: {
    target: 'es2020',
    assetsInlineLimit: 4096,
    chunkSizeWarningLimit: 2000,
  },
});
