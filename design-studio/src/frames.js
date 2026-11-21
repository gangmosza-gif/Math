// Photo-frame shapes: a picture is clipped to one of these and always fills the shape's box.
import { Path } from 'fabric';
import { SHAPE_FAMILIES } from './shapes2.js';

const f = (v) => Math.round(v * 100) / 100;
const poly = (pts) => 'M' + pts.map(([x, y]) => `${f(x)} ${f(y)}`).join(' L') + ' Z';
const regular = (n, rot = -Math.PI / 2) => poly(Array.from({ length: n }, (_, i) => [50 + 50 * Math.cos(rot + (i * 2 * Math.PI) / n), 50 + 50 * Math.sin(rot + (i * 2 * Math.PI) / n)]));
const star = (n, inner) => poly(Array.from({ length: n * 2 }, (_, i) => { const r = i % 2 ? inner : 50; const a = -Math.PI / 2 + (i * Math.PI) / n; return [50 + r * Math.cos(a), 50 + r * Math.sin(a)]; }));
const arc = (cx, cy, rx, ry, a0, a1, n = 40) => Array.from({ length: n + 1 }, (_, i) => { const a = a0 + ((a1 - a0) * i) / n; return [cx + rx * Math.cos(a), cy + ry * Math.sin(a)]; });
const fam = (k, i) => SHAPE_FAMILIES.find((x) => x.k === k).items[i].d;

/** [key, Thai label, path] – the path's own bounding box defines the frame's proportions. */
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
  ['ticket', 'ตั๋ว', poly([[0, 0], [140, 0], [140, 38], ...arc(140, 50, 12, 12, -Math.PI / 2, -1.5 * Math.PI, 12).map(([x, y]) => [x, y]), [140, 100], [0, 100], [0, 62], ...arc(0, 50, 12, 12, Math.PI / 2, -Math.PI / 2, 12), [0, 38]])],
];

function bbox(d) {
  const n = d.match(/-?\d*\.?\d+/g).map(Number);
  const xs = n.filter((_, i) => i % 2 === 0), ys = n.filter((_, i) => i % 2 === 1);
  return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
}

export const FRAME_SHAPES = LIST.map(([k, label, d]) => { const b = bbox(d); return { k, label, d, b, ratio: b.w / b.h }; });
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
