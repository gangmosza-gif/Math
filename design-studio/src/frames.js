// Photo-frame shapes: a picture is clipped to one of these and always fills the shape's box.
import { Path } from 'fabric';
import { SHAPE_FAMILIES } from './shapes2.js';
import { GLYPHS } from './frame-glyphs.js';

const f = (v) => Math.round(v * 100) / 100;
const poly = (pts) => 'M' + pts.map(([x, y]) => `${f(x)} ${f(y)}`).join(' L') + ' Z';
const regular = (n, rot = -Math.PI / 2) => poly(Array.from({ length: n }, (_, i) => [50 + 50 * Math.cos(rot + (i * 2 * Math.PI) / n), 50 + 50 * Math.sin(rot + (i * 2 * Math.PI) / n)]));
const star = (n, inner) => poly(Array.from({ length: n * 2 }, (_, i) => { const r = i % 2 ? inner : 50; const a = -Math.PI / 2 + (i * Math.PI) / n; return [50 + r * Math.cos(a), 50 + r * Math.sin(a)]; }));
const arc = (cx, cy, rx, ry, a0, a1, n = 40) => Array.from({ length: n + 1 }, (_, i) => { const a = a0 + ((a1 - a0) * i) / n; return [cx + rx * Math.cos(a), cy + ry * Math.sin(a)]; });
const fam = (k, i) => SHAPE_FAMILIES.find((x) => x.k === k).items[i].d;

/** Polygon with rounded corners (radius r in the same units). */
function roundPoly(pts, r, steps = 8) {
  const out = [];
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n];
    const d1 = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]), d2 = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
    const rr = Math.min(r, d1 / 2, d2 / 2);
    const a = [p1[0] + ((p0[0] - p1[0]) * rr) / d1, p1[1] + ((p0[1] - p1[1]) * rr) / d1];
    const b = [p1[0] + ((p2[0] - p1[0]) * rr) / d2, p1[1] + ((p2[1] - p1[1]) * rr) / d2];
    for (let k = 0; k <= steps; k++) {
      const t = k / steps;
      out.push([(1 - t) ** 2 * a[0] + 2 * (1 - t) * t * p1[0] + t * t * b[0], (1 - t) ** 2 * a[1] + 2 * (1 - t) * t * p1[1] + t * t * b[1]]);
    }
  }
  return poly(out);
}
const regPts = (n, rot = -Math.PI / 2) => Array.from({ length: n }, (_, i) => [50 + 50 * Math.cos(rot + (i * 2 * Math.PI) / n), 50 + 50 * Math.sin(rot + (i * 2 * Math.PI) / n)]);
const superellipse = (pow, w = 100, h = 100) => poly(Array.from({ length: 160 }, (_, i) => { const t = (i / 160) * 2 * Math.PI; const c = Math.cos(t), s = Math.sin(t); return [w / 2 + (w / 2) * Math.sign(c) * Math.abs(c) ** (2 / pow), h / 2 + (h / 2) * Math.sign(s) * Math.abs(s) ** (2 / pow)]; }));
/** Deterministic pseudo-random numbers (the same "torn" edge every time). */
const rnd = (seed) => () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
/** Rectangle whose edges follow f(t, side) – used for torn paper, waves and stamps. */
function edgeRect(w, h, f, step = 2) {
  const pts = [];
  const side = (x0, y0, x1, y1, nx, ny, k) => {
    const len = Math.hypot(x1 - x0, y1 - y0), n = Math.ceil(len / step);
    for (let i = 0; i < n; i++) { const t = i / n; const o = f(t * len, k); pts.push([x0 + (x1 - x0) * t + nx * o, y0 + (y1 - y0) * t + ny * o]); }
  };
  side(0, 0, w, 0, 0, 1, 0); side(w, 0, w, h, -1, 0, 1); side(w, h, 0, h, 0, -1, 2); side(0, h, 0, 0, 1, 0, 3);
  return poly(pts);
}
const torn = (seed, amp) => { const r = rnd(seed); return edgeRect(100, 120, () => r() * amp, 3); };
const stamp = edgeRect(100, 120, (x) => { const u = (x % 10) / 10; return u > 0.25 && u < 0.75 ? 4 * Math.sin(((u - 0.25) / 0.5) * Math.PI) : 0; }, 1);
const wavyRect = edgeRect(100, 100, (x) => 3 + 3 * Math.sin((x / 100) * Math.PI * 8), 1.5);
const scallopRect = edgeRect(100, 100, (x) => 5 * (1 - Math.abs(Math.sin((x / 100) * Math.PI * 6))), 1);
const brush = (seed) => { const r = rnd(seed); const ph = [r() * 6, r() * 6, r() * 6]; return edgeRect(140, 100, (x, k) => 5 + 3 * Math.sin(x / 7 + ph[k % 3]) + 2 * Math.sin(x / 2.3 + k) + r() * 1.5, 2); };
const crescent = poly([...arc(50, 50, 50, 50, -Math.PI / 2 + 0.35, Math.PI * 1.5 - 0.35, 60), ...arc(68, 44, 40, 40, Math.PI * 1.32, -Math.PI * 0.32 + Math.PI * 2 - Math.PI * 2, 60).reverse()]);
const heartF = (i) => SHAPE_FAMILIES.find((x) => x.k === 'heart').items[i].d;

/** [key, Thai label, path, category] – the path's own bounding box defines the frame's proportions. */
const LIST = [
  ['triangle', 'สามเหลี่ยม', poly([[50, 0], [100, 87], [0, 87]])],
  ['triangle-down', 'สามเหลี่ยมกลับหัว', poly([[0, 0], [100, 0], [50, 87]])],
  ['right-triangle', 'สามเหลี่ยมมุมฉาก', poly([[0, 0], [0, 100], [100, 100]])],
  ['diamond', 'ข้าวหลามตัด', poly([[50, 0], [100, 50], [50, 100], [0, 50]])],
  ['pentagon', 'ห้าเหลี่ยม', regular(5)],
  ['octagon', 'แปดเหลี่ยม', regular(8, Math.PI / 8)],
  ['star8', 'ดาว 8 แฉก', star(8, 34)],
  ['burst', 'ดาวระเบิด', fam('asterisk', 5)],
  ['scallop', 'ป้ายหยัก', fam('asterisk', 9)],
  ['cross', 'กากบาท', poly([[35, 0], [65, 0], [65, 35], [100, 35], [100, 65], [65, 65], [65, 100], [35, 100], [35, 65], [0, 65], [0, 35], [35, 35]])],
  ['parallelogram', 'สี่เหลี่ยมด้านขนาน', poly([[25, 0], [140, 0], [115, 100], [0, 100]])],
  ['arch', 'ซุ้มโค้ง', poly([[0, 125], [0, 50], ...arc(50, 50, 50, 50, Math.PI, 2 * Math.PI), [100, 125]])],
  ['semicircle', 'ครึ่งวงกลม', poly(arc(50, 50, 50, 50, Math.PI, 2 * Math.PI))],
  ['ellipse', 'วงรี', poly(arc(70, 50, 70, 50, 0, 2 * Math.PI, 120))],
  ['pill', 'แคปซูล', poly([...arc(25, 25, 25, 25, Math.PI / 2, (3 * Math.PI) / 2, 20), ...arc(115, 25, 25, 25, -Math.PI / 2, Math.PI / 2, 20)])],
  ['shield', 'โล่', fam('banner', 1)],
  ['drop', 'หยดน้ำ', fam('drop', 0)],
  ['leaf', 'ใบไม้', fam('drop', 5)],
  ['cloud', 'ก้อนเมฆ', fam('cloud', 0)],
  ['flower5', 'ดอกไม้ 5 กลีบ', fam('flower', 1)],
  ['flower8', 'ดอกไม้ 8 กลีบ', fam('flower', 3)],
  ['blob1', 'รูปทรงอิสระ 1', fam('blob', 0)],
  ['blob2', 'รูปทรงอิสระ 2', fam('blob', 1)],
  ['blob3', 'รูปทรงอิสระ 3', fam('blob', 5)],
  ['bubble', 'กล่องคำพูด', fam('bubble', 1)],
  ['folder', 'แฟ้มเอกสาร', 'M0 8Q0 0 8 0H40Q44 0 46 3L50 9H132Q140 9 140 17V92Q140 100 132 100H8Q0 100 0 92Z', 'badge'],
  ['ticket', 'ตั๋ว', poly([[0, 0], [140, 0], [140, 38], ...arc(140, 50, 12, 12, -Math.PI / 2, -1.5 * Math.PI, 12).map(([x, y]) => [x, y]), [140, 100], [0, 100], [0, 62], ...arc(0, 50, 12, 12, Math.PI / 2, -Math.PI / 2, 12), [0, 38]])],
  // ---- more geometry
  ['squircle', 'สี่เหลี่ยมมนนุ่ม', superellipse(5), 'geo'],
  ['rounded-big', 'สี่เหลี่ยมมุมมนมาก', roundPoly([[0, 0], [100, 0], [100, 100], [0, 100]], 32), 'geo'],
  ['leaf-corner', 'มุมโค้งทแยง', poly([[0, 0], [60, 0], ...arc(60, 40, 40, 40, -Math.PI / 2, 0, 16), [100, 100], [40, 100], ...arc(40, 60, 40, 40, Math.PI / 2, Math.PI, 16)]), 'geo'],
  ['cut-corner', 'สี่เหลี่ยมตัดมุม', poly([[18, 0], [82, 0], [100, 18], [100, 82], [82, 100], [18, 100], [0, 82], [0, 18]]), 'geo'],
  ['portrait-round', 'แนวตั้งมุมมน', roundPoly([[0, 0], [80, 0], [80, 120], [0, 120]], 14), 'geo'],
  ['landscape-round', 'แนวนอนมุมมน', roundPoly([[0, 0], [160, 0], [160, 90], [0, 90]], 14), 'geo'],
  ['rounded-triangle', 'สามเหลี่ยมมน', roundPoly([[50, 0], [100, 87], [0, 87]], 14), 'geo'],
  ['trapezoid', 'สี่เหลี่ยมคางหมู', poly([[22, 0], [78, 0], [100, 80], [0, 80]]), 'geo'],
  ['trapezoid-down', 'คางหมูกลับหัว', poly([[0, 0], [100, 0], [78, 80], [22, 80]]), 'geo'],
  ['kite', 'ว่าว', poly([[50, 0], [90, 40], [50, 120], [10, 40]]), 'geo'],
  ['rhombus-wide', 'ข้าวหลามตัดแนวนอน', poly([[70, 0], [140, 45], [70, 90], [0, 45]]), 'geo'],
  ['hexagon-v', 'หกเหลี่ยมแนวตั้ง', regular(6), 'geo'],
  ['heptagon', 'เจ็ดเหลี่ยม', regular(7), 'geo'],
  ['decagon', 'สิบเหลี่ยม', regular(10), 'geo'],
  ['rounded-hexagon', 'หกเหลี่ยมมน', roundPoly(regPts(6, 0), 12), 'geo'],
  ['rounded-pentagon', 'ห้าเหลี่ยมมน', roundPoly(regPts(5), 12), 'geo'],
  ['chevron', 'บั้งลูกศร', poly([[0, 0], [100, 0], [130, 50], [100, 100], [0, 100], [30, 50]]), 'geo'],
  ['arrow-right', 'ลูกศร', poly([[0, 30], [90, 30], [90, 0], [140, 50], [90, 100], [90, 70], [0, 70]]), 'geo'],
  ['home-plate', 'ป้ายชี้', poly([[0, 0], [110, 0], [140, 50], [110, 100], [0, 100]]), 'geo'],
  ['house', 'บ้าน', poly([[50, 0], [100, 40], [100, 100], [0, 100], [0, 40]]), 'geo'],
  ['cross-round', 'กากบาทมน', roundPoly([[35, 0], [65, 0], [65, 35], [100, 35], [100, 65], [65, 65], [65, 100], [35, 100], [35, 65], [0, 65], [0, 35], [35, 35]], 8), 'geo'],
  ['star4', 'ดาว 4 แฉก', star(4, 20), 'star'],
  ['star5', 'ดาว 5 แฉก', star(5, 22), 'star'],
  ['star6', 'ดาว 6 แฉก', star(6, 28), 'star'],
  ['star12', 'ดาว 12 แฉก', star(12, 40), 'star'],
  ['star-round', 'ดาวมน', roundPoly(star(5, 24).slice(1, -2).split(' L').map((p) => p.split(' ').map(Number)), 8), 'star'],
  ['sun', 'ดวงอาทิตย์', fam('asterisk', 8), 'star'],
  ['burst24', 'ดาวระเบิด 24 แฉก', fam('asterisk', 6), 'star'],
  ['sparkle', 'ประกายวิบวับ', poly(Array.from({ length: 200 }, (_, i) => { const t = (i / 200) * 2 * Math.PI; const r = 50 * Math.abs(Math.cos(2 * t)) ** 3 + 8; return [50 + r * Math.cos(t), 50 + r * Math.sin(t)]; })), 'star'],
  // ---- nature & organic (from the shape families)
  ...[1, 2, 3, 4, 5].map((i) => [`cloud${i}`, `ก้อนเมฆ ${i + 1}`, fam('cloud', i), 'nature']),
  ...[1, 2, 3, 4].map((i) => [`drop${i}`, `หยดน้ำ ${i + 1}`, fam('drop', i), 'nature']),
  ...[0, 2, 4, 6, 7].map((i) => [`flower-x${i}`, SHAPE_FAMILIES.find((x) => x.k === 'flower').items[i].label, fam('flower', i), 'nature']),
  ...[2, 3, 4, 6].map((i) => [`blob-x${i}`, SHAPE_FAMILIES.find((x) => x.k === 'blob').items[i].label, fam('blob', i), 'nature']),
  ['moon', 'พระจันทร์เสี้ยว', crescent, 'nature'],
  ...[0, 1, 2, 3, 4].map((i) => [`heart${i}`, SHAPE_FAMILIES.find((x) => x.k === 'heart').items[i].label, heartF(i), 'heart']),
  ...[0, 2, 3].map((i) => [`bubble-x${i}`, SHAPE_FAMILIES.find((x) => x.k === 'bubble').items[i].label, fam('bubble', i), 'badge']),
  ...[0, 2, 3, 4, 5, 6].map((i) => [`banner${i}`, SHAPE_FAMILIES.find((x) => x.k === 'banner').items[i].label, fam('banner', i), 'badge']),
  // ---- paper edges
  ['torn1', 'กระดาษฉีก 1', torn(7, 5), 'edge'],
  ['torn2', 'กระดาษฉีก 2', torn(31, 8), 'edge'],
  ['stamp', 'แสตมป์', stamp, 'edge'],
  ['wavy', 'ขอบคลื่น', wavyRect, 'edge'],
  ['scallop-rect', 'ขอบหยัก', scallopRect, 'edge'],
  ['brush1', 'รอยพู่กัน 1', brush(11), 'edge'],
  ['brush2', 'รอยพู่กัน 2', brush(97), 'edge'],
  // ---- letters, numbers, Thai consonants (Kanit ExtraBold outlines)
  ...GLYPHS.latin.map((c) => [`abc-${c}`, `ตัวอักษร ${c}`, GLYPHS.d[c], 'abc']),
  ...GLYPHS.digits.map((c) => [`num-${c}`, `ตัวเลข ${c}`, GLYPHS.d[c], 'num']),
  ...GLYPHS.thai.map((c, i) => [`th-${i}`, `พยัญชนะ ${c}`, GLYPHS.d[c], 'thai']),
];
export const FRAME_CATEGORIES = [
  ['basic', 'พื้นฐาน'], ['geo', 'เรขาคณิต'], ['star', 'ดาวและแสง'], ['nature', 'ธรรมชาติและออร์แกนิก'], ['heart', 'หัวใจ'],
  ['badge', 'ป้ายและกล่องคำพูด'], ['edge', 'ขอบกระดาษ แสตมป์ พู่กัน'], ['abc', 'ตัวอักษร A–Z'], ['num', 'ตัวเลข 0–9'], ['thai', 'พยัญชนะไทย ก–ฮ'],
];

function bbox(d) {
  const n = d.match(/-?\d*\.?\d+/g).map(Number);
  const xs = n.filter((_, i) => i % 2 === 0), ys = n.filter((_, i) => i % 2 === 1);
  return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
}

export const FRAME_SHAPES = LIST.map(([k, label, d, cat]) => { const b = bbox(d); return { k, label, d, b, ratio: b.w / b.h, cat: cat || 'basic' }; });
const BY_KEY = Object.fromEntries(FRAME_SHAPES.map((s) => [s.k, s]));
export const isFrameShape = (k) => !!BY_KEY[k];

/** Clip path that stretches the shape over a w×h picture (centred on the picture). */
export function frameClipPath(k, w, h) {
  const s = BY_KEY[k];
  const p = new Path(s.d, { originX: 'center', originY: 'center', left: 0, top: 0 });
  p.set({ scaleX: w / p.width, scaleY: h / p.height });
  return p;
}

export const framePreview = (k, fill = '#cfc8ec') => {
  const s = BY_KEY[k];
  return `<svg viewBox="${s.b.x - 2} ${s.b.y - 2} ${s.b.w + 4} ${s.b.h + 4}" width="100%" height="100%" preserveAspectRatio="xMidYMid meet"><path d="${s.d}" fill="${fill}"/></svg>`;
};
