import { cache } from 'fabric';

// [family, google css spec, group]
// spec: 'i' = italic+bold axes, 'b' = 400/700, '' = single weight
export const FONTS = [
  ['Kanit', 'i', 'ไทย'],
  ['Prompt', 'i', 'ไทย'],
  ['Sarabun', 'i', 'ไทย'],
  ['Mitr', 'b', 'ไทย'],
  ['Noto Sans Thai', 'b', 'ไทย'],
  ['IBM Plex Sans Thai', 'b', 'ไทย'],
  ['Chakra Petch', 'i', 'ไทย'],
  ['Bai Jamjuree', 'i', 'ไทย'],
  ['K2D', 'i', 'ไทย'],
  ['Niramit', 'i', 'ไทย'],
  ['Krub', 'i', 'ไทย'],
  ['Mali', 'i', 'ไทย'],
  ['Athiti', 'b', 'ไทย'],
  ['Pridi', 'b', 'ไทย'],
  ['Taviraj', 'i', 'ไทย'],
  ['Trirong', 'i', 'ไทย'],
  ['Charm', 'b', 'ไทย'],
  ['Itim', '', 'ไทย'],
  ['Sriracha', '', 'ไทย'],
  ['Pattaya', '', 'ไทย'],
  ['Chonburi', '', 'ไทย'],
  ['Roboto', 'i', 'อังกฤษ'],
  ['Montserrat', 'i', 'อังกฤษ'],
  ['Poppins', 'i', 'อังกฤษ'],
  ['Playfair Display', 'i', 'อังกฤษ'],
  ['Merriweather', 'i', 'อังกฤษ'],
  ['Oswald', 'b', 'อังกฤษ'],
  ['Bebas Neue', '', 'อังกฤษ'],
  ['Anton', '', 'อังกฤษ'],
  ['Lobster', '', 'อังกฤษ'],
  ['Pacifico', '', 'อังกฤษ'],
  ['Dancing Script', 'b', 'อังกฤษ'],
  ['Caveat', 'b', 'อังกฤษ'],
];

export const FONT_NAMES = FONTS.map((f) => f[0]);

export function fontCssUrl(family) {
  const f = FONTS.find((x) => x[0] === family);
  const name = family.replace(/ /g, '+');
  let spec = '';
  if (f && f[1] === 'i') spec = ':ital,wght@0,400;0,700;1,400;1,700';
  else if (f && f[1] === 'b') spec = ':wght@400;700';
  return `https://fonts.googleapis.com/css2?family=${name}${spec}&display=swap`;
}

const linked = new Map();
const loaded = new Map();

/** Add the font's Google Fonts stylesheet; resolves when its @font-face rules are available. */
function linkFont(family) {
  if (!FONT_NAMES.includes(family)) return Promise.resolve();
  if (linked.has(family)) return linked.get(family);
  const l = document.createElement('link');
  l.rel = 'stylesheet';
  l.href = fontCssUrl(family);
  const p = new Promise((resolve) => {
    l.onload = resolve;
    l.onerror = resolve;
    setTimeout(resolve, 15000);
  });
  document.head.appendChild(l);
  linked.set(family, p);
  return p;
}

/** Link every font stylesheet so the font picker can preview them. */
export function linkAllFonts() {
  FONT_NAMES.forEach(linkFont);
}

/** Make sure a font family is downloaded before fabric measures text with it. */
export function ensureFont(family) {
  if (!family) return Promise.resolve();
  family = String(family).replace(/["']/g, '').split(',')[0].trim();
  if (loaded.has(family)) return loaded.get(family);
  const sample = 'กขAaBb1';
  const p = linkFont(family).then(() => Promise.race([
    Promise.all(
      ['400', '700', 'italic 400', 'italic 700'].map((w) =>
        document.fonts.load(`${w} 40px "${family}"`, sample).catch(() => null)
      )
    ),
    new Promise((r) => setTimeout(r, 8000)),
  ])).then(() => cache.clearFontCache(family));
  loaded.set(family, p);
  return p;
}

/** Collect every fontFamily used in a serialized canvas (including groups). */
export function fontsInJSON(json) {
  const out = new Set();
  const walk = (o) => {
    if (!o) return;
    if (o.fontFamily) out.add(o.fontFamily);
    (o.objects || []).forEach(walk);
  };
  (json.objects || []).forEach(walk);
  return [...out];
}

export function ensureFonts(list) {
  return Promise.all(list.map(ensureFont));
}
