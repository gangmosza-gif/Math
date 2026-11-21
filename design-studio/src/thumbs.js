// Real previews for the element panel: each chart / table / QR / mockup tile shows a miniature of the
// object it adds, built with the same code and default data (so the tile looks like the result).
import { buildChart, defaultChart } from './charts.js';
import { buildTable, buildQR, buildMockup, defaultTable, defaultQR, defaultMockup, placeholderImage } from './smart.js';
import { ensureFont } from './fonts.js';

const cache = new Map();
const U = 600; // build size; the picture is scaled down to the tile

async function build(kind) {
  if (kind === 'table') { const d = defaultTable(U); await ensureFont(d.fontFamily); return buildTable(d); }
  if (kind === 'qr') return buildQR(defaultQR(U));
  if (kind.startsWith('mockup-')) return buildMockup(defaultMockup(kind.slice(7), U, placeholderImage()));
  const d = defaultChart(kind, U);
  await ensureFont(d.fontFamily);
  return buildChart(d);
}

/** PNG data URL (≈240 px on the long side) of what `smart:<kind>` adds, cached for the session. */
export function smartThumb(kind) {
  if (!cache.has(kind)) {
    cache.set(kind, (async () => {
      const o = await build(kind);
      const long = Math.max(o.getScaledWidth(), o.getScaledHeight()) || 1;
      return o.toDataURL({ format: 'png', multiplier: 240 / long });
    })().catch((e) => { cache.delete(kind); throw e; }));
  }
  return cache.get(kind);
}

/** Swap the placeholders inside `root` for the real previews, one by one (keeps the panel responsive). */
export async function fillThumbs(root) {
  for (const el of [...root.querySelectorAll('[data-thumb]:not(.ready)')]) {
    try {
      const url = await smartThumb(el.dataset.thumb);
      if (!el.isConnected) return; // panel was re-rendered
      el.innerHTML = `<img src="${url}" alt="" draggable="false">`;
      el.classList.add('ready');
    } catch (e) { console.warn('thumb', el.dataset.thumb, e); }
    await new Promise((r) => setTimeout(r, 0));
  }
}
