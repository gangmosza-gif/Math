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

const linked = new Set();
const loaded = new Map();

function linkFont(family) {
  if (linked.has(family) || !FONT_NAMES.includes(family)) return;
  linked.add(family);
  const l = document.createElement('link');
  l.rel = 'stylesheet';
  l.href = fontCssUrl(family);
  document.head.appendChild(l);
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
  linkFont(family);
  const sample = 'กขAaBb1';
  const p = Promise.race([
    Promise.all(
      ['400', '700', 'italic 400', 'italic 700'].map((w) =>
        document.fonts.load(`${w} 40px "${family}"`, sample).catch(() => null)
      )
    ),
    new Promise((r) => setTimeout(r, 6000)),
  ]).then(() => cache.clearFontCache(family));
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
