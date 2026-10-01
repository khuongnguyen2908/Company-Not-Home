import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// base './' giúp game chạy được cả trên Vercel lẫn GitHub Pages (đường dẫn /ten-repo/)
export default defineConfig(({ mode }) => ({
  base: './',
  plugins: mode === 'single' ? [viteSingleFile()] : [],
  build: {
    outDir: mode === 'single' ? 'dist-single' : 'dist',
    chunkSizeWarningLimit: 2000,
  },
}));
