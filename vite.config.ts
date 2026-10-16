import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: './',
  plugins: [react()],
  define: {
    __SUPABASE__: JSON.stringify({ url: process.env.SUPABASE_URL || '', key: process.env.SUPABASE_ANON_KEY || '' }),
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'chrome140',
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 2000,
  },
  server: { port: 5199, strictPort: true },
});
