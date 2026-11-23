import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import fs from 'node:fs';
import path from 'node:path';

/**
 * `virtual:inline-fonts`: in the single-file build every bundled font (public/fonts) is packed into the
 * page as @font-face rules with data: URLs, so the one HTML file needs no font files next to it.
 * In the normal build it is null and fonts load from the fonts/ folder.
 */
function inlineFonts(enabled) {
  const id = 'virtual:inline-fonts';
  return {
    name: 'inline-fonts',
    resolveId: (s) => (s === id ? '\0' + id : null),
    load(s) {
      if (s !== '\0' + id) return null;
      if (!enabled) return 'export default null;';
      const dir = path.resolve('public/fonts');
      const out = {};
      for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.css'))) {
        // Google splits each font by script (/* thai */, /* latin */, /* vietnamese */ …): the one-file page keeps
        // only the Thai and basic Latin parts to stay small; the full app keeps every part
        const css = fs.readFileSync(path.join(dir, f), 'utf8').split(/(?=\/\* [a-z-]+ \*\/)/).filter((b) => /^\/\* (thai|latin) \*\//.test(b)).join('').replace(/\/\*[^]*?\*\//g, '');
        out[f.replace(/\.css$/, '')] = css.replace(/url\(([^)]+)\)/g, (m, u) => `url(data:font/woff2;base64,${fs.readFileSync(path.join(dir, u)).toString('base64')})`);
      }
      return `export default ${JSON.stringify(out)};`;
    },
  };
}

/**
 * `virtual:inline-photos`: in the offline build the photo library (public/photos: manifest + pictures) is packed
 * into the page as data: URLs, so index.html opened straight from a folder (file://, no server, no internet)
 * has its photos too. Elsewhere it is null and photos load from the photos/ folder.
 */
function inlinePhotos(enabled) {
  const id = 'virtual:inline-photos';
  return {
    name: 'inline-photos',
    resolveId: (s) => (s === id ? '\0' + id : null),
    load(s) {
      if (s !== '\0' + id) return null;
      const dir = path.resolve('public/photos');
      if (!enabled || !fs.existsSync(path.join(dir, 'manifest.json'))) return 'export default null;';
      const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
      const data = {};
      for (const it of manifest.items) data[it.id] = 'data:image/webp;base64,' + fs.readFileSync(path.join(dir, `${it.id}.webp`)).toString('base64');
      return `export default ${JSON.stringify({ manifest, data })};`;
    },
  };
}

// `npm run build`        -> dist/        (deploy anywhere: Vercel, Netlify, GitHub Pages)
// `npm run build:offline`-> dist-offline/ (ONE index.html with fonts + photos: double-click to open, no server, no internet)
// `npm run build:single` -> dist-single/ (one self-contained index.html + photos/)
export default defineConfig(({ mode }) => ({
  base: './',
  plugins: [inlineFonts(mode === 'single' || mode === 'offline'), inlinePhotos(mode === 'offline'), ...(mode === 'single' || mode === 'offline' ? [viteSingleFile()] : [])],
  build: {
    outDir: mode === 'single' ? 'dist-single' : mode === 'offline' ? 'dist-offline' : 'dist',
    chunkSizeWarningLimit: 3000,
  },
}));
