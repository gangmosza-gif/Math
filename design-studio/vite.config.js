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

// `npm run build`        -> dist/        (deploy anywhere: Vercel, Netlify, GitHub Pages)
// `npm run build:single` -> dist-single/ (one self-contained index.html + photos/)
export default defineConfig(({ mode }) => ({
  base: './',
  plugins: [inlineFonts(mode === 'single'), ...(mode === 'single' ? [viteSingleFile()] : [])],
  build: {
    outDir: mode === 'single' ? 'dist-single' : 'dist',
    chunkSizeWarningLimit: 3000,
  },
}));
