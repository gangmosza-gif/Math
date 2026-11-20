import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// `npm run build`        -> dist/        (deploy anywhere: Vercel, Netlify, GitHub Pages)
// `npm run build:single` -> dist-single/ (one self-contained index.html)
export default defineConfig(({ mode }) => ({
  base: './',
  plugins: mode === 'single' ? [viteSingleFile()] : [],
  build: {
    outDir: mode === 'single' ? 'dist-single' : 'dist',
    chunkSizeWarningLimit: 3000,
  },
}));
