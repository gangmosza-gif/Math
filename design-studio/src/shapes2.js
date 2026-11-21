// Shape families drawn from formulas (clouds, hearts, banners, drops, gears, starbursts, flowers, blobs …).
// Every shape is one SVG path normalised into a 100×100 box, so it can be recoloured and resized freely.
import { Path } from 'fabric';

const f = (v) => Math.round(v * 100) / 100;
const poly = (pts) => 'M' + pts.map(([x, y]) => `${f(x)} ${f(y)}`).join(' L') + ' Z';
const TAU = Math.PI * 2;

/** Fit path data (absolute M/L/C/Q/A-free numbers only) into a 100×100 box keeping proportions. */
function fit(d) {
  const nums = d.match(/-?\d*\.?\d+/g).map(Number);
  const xs = nums.filter((_, i) => i % 2 === 0), ys = nums.filter((_, i) => i % 2 === 1);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const k = 100 / Math.max(x1 - x0, y1 - y0);
  const ox = (100 - (x1 - x0) * k) / 2, oy = (100 - (y1 - y0) * k) / 2;
  let i = 0;
  return d.replace(/-?\d*\.?\d+/g, (m) => { const v = +m; const r = i % 2 === 0 ? (v - x0) * k + ox : (v - y0) * k + oy; i++; return String(f(r)); });
}
/** Outline of a polar function r(θ) around (50,50). */
const polar = (r, n = 360) => poly(Array.from({ length: n }, (_, i) => { const t = (i / n) * TAU - Math.PI / 2; const rr = r(t); return [50 + rr * Math.cos(t), 50 + rr * Math.sin(t)]; }));
/** Union of circles cut flat at the bottom (clouds). */
function cloud(circles, base) {
  const xs = circles.flatMap(([cx, , r]) => [cx - r, cx + r]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs);
  const top = [], bot = [];
  for (let k = 0; k <= 240; k++) {
    const x = x0 + ((x1 - x0) * k) / 240;
    let t = Infinity, b = -Infinity;
    for (const [cx, cy, r] of circles) {
      const dx = x - cx;
      if (Math.abs(dx) > r) continue;
      const s = Math.sqrt(r * r - dx * dx);
      t = Math.min(t, cy - s); b = Math.max(b, cy + s);
    }
    if (t === Infinity) continue;
    top.push([x, t]); bot.push([x, Math.min(b, base)]);
  }
  return poly([...top, ...bot.reverse()]);
}
const heart = (sx, sy, p = 3) => poly(Array.from({ length: 300 }, (_, i) => {
  const t = (i / 300) * TAU;
  const x = 16 * Math.sin(t) ** 3;
  const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t) * (p / 3);
  return [50 + x * sx, 50 - y * sy];
}));
const drop = (sharp, tilt = 0) => poly(Array.from({ length: 240 }, (_, i) => {
  const t = (i / 240) * TAU;
  const x = Math.sin(t) * Math.sin(t / 2) ** sharp * 40;
  const y = -Math.cos(t) * 45;
  const c = Math.cos(tilt), s = Math.sin(tilt);
  return [50 + x * c - y * s, 50 + x * s + y * c];
}));
function gear(teeth, outer, inner, hole, toothW = 0.5) {
  const pts = [];
  const n = teeth * 4;
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * TAU;
    const phase = i % 4;
    const r = phase === 1 || phase === 2 ? outer : inner;
    const a = a0 + (phase === 1 ? -toothW * 0.05 : phase === 2 ? toothW * 0.05 : 0);
    pts.push([50 + r * Math.cos(a), 50 + r * Math.sin(a)]);
  }
  let d = poly(pts);
  if (hole) d += ' ' + circlePath(50, 50, hole);
  return d;
}
const circlePath = (cx, cy, r) => poly(Array.from({ length: 120 }, (_, i) => [cx + r * Math.cos((i / 120) * TAU), cy + r * Math.sin((i / 120) * TAU)]));
function burst(points, outer, inner, round = 0) {
  return polar((t) => {
    const u = ((t + Math.PI / 2) * points) / TAU;
    const fr = u - Math.floor(u);
    const tri = Math.abs(fr - 0.5) * 2; // 1 at the tips, 0 between
    const k = round ? Math.pow(tri, 1 + round) : tri;
    return inner + (outer - inner) * k;
  }, points * 24);
}
function asterisk(arms, len, w) {
  const pts = [];
  for (let i = 0; i < arms; i++) {
    const a = (i / arms) * TAU - Math.PI / 2, b = a + TAU / arms / 2;
    const px = Math.cos(a + Math.PI / 2) * w, py = Math.sin(a + Math.PI / 2) * w;
    pts.push([50 + Math.cos(a) * len - px, 50 + Math.sin(a) * len - py], [50 + Math.cos(a) * len + px, 50 + Math.sin(a) * len + py]);
    const ir = w / Math.sin(Math.PI / arms);
    pts.push([50 + Math.cos(b) * ir, 50 + Math.sin(b) * ir]);
  }
  return poly(pts);
}
const flower = (petals, depth, holeR = 0, sharp = 1) => {
  let d = polar((t) => 30 + depth * Math.abs(Math.cos((petals * t) / 2)) ** sharp, petals * 40);
  if (holeR) d += ' ' + circlePath(50, 50, holeR);
  return d;
};
/** Smooth closed blob through control radii (Catmull-Rom style sampling). */
function blob(radii) {
  const n = radii.length;
  return polar((t) => {
    const u = (((t + Math.PI / 2) / TAU) * n + n) % n;
    const i = Math.floor(u), fr = u - i;
    const p0 = radii[(i - 1 + n) % n], p1 = radii[i], p2 = radii[(i + 1) % n], p3 = radii[(i + 2) % n];
    return 0.5 * (2 * p1 + (-p0 + p2) * fr + (2 * p0 - 5 * p1 + 4 * p2 - p3) * fr * fr + (-p0 + 3 * p1 - 3 * p2 + p3) * fr ** 3);
  }, 240);
}
const scallop = (n, r, bump) => polar((t) => r + bump * Math.abs(Math.sin((n * t) / 2)), n * 30);
const roundRectPath = (x, y, w, h, r) => poly([
  ...Array.from({ length: 10 }, (_, i) => { const a = Math.PI + (i / 9) * Math.PI / 2; return [x + r + r * Math.cos(a), y + r + r * Math.sin(a)]; }),
  ...Array.from({ length: 10 }, (_, i) => { const a = -Math.PI / 2 + (i / 9) * Math.PI / 2; return [x + w - r + r * Math.cos(a), y + r + r * Math.sin(a)]; }),
  ...Array.from({ length: 10 }, (_, i) => { const a = (i / 9) * Math.PI / 2; return [x + w - r + r * Math.cos(a), y + h - r + r * Math.sin(a)]; }),
  ...Array.from({ length: 10 }, (_, i) => { const a = Math.PI / 2 + (i / 9) * Math.PI / 2; return [x + r + r * Math.cos(a), y + h - r + r * Math.sin(a)]; }),
]);

const fam = (k, title, list) => ({ k, title, items: list.map(([label, d, evenodd]) => ({ label, d: fit(d), evenodd: !!evenodd })) });

export const SHAPE_FAMILIES = [
  fam('cloud', 'ก้อนเมฆ', [
    ['เมฆฟู', cloud([[25, 55, 18], [45, 40, 22], [68, 45, 20], [82, 58, 14], [55, 60, 18]], 72)],
    ['เมฆยาว', cloud([[15, 60, 12], [32, 48, 16], [52, 42, 18], [72, 48, 15], [88, 60, 11]], 70)],
    ['เมฆก้อนเดียว', cloud([[30, 58, 16], [52, 44, 24], [74, 58, 16]], 72)],
    ['เมฆเล็ก', cloud([[30, 60, 14], [48, 50, 18], [66, 60, 14]], 72)],
    ['เมฆโดม', cloud([[40, 52, 22], [62, 46, 24], [80, 60, 12], [22, 62, 12]], 72)],
    ['เมฆหลายก้อน', cloud([[14, 62, 9], [28, 52, 13], [44, 44, 15], [60, 46, 14], [75, 52, 12], [88, 62, 9]], 70)],
  ]),
  fam('heart', 'หัวใจ', [
    ['หัวใจ', heart(2.6, 2.6)], ['หัวใจกว้าง', heart(3.1, 2.4)], ['หัวใจสูง', heart(2.3, 3)], ['หัวใจมน', heart(2.7, 2.7, 0.5)], ['หัวใจแหลม', heart(2.4, 2.8, 5)],
    ['หัวใจกลวง', heart(2.6, 2.6) + ' ' + heart(1.6, 1.6).replace(/M/, 'M'), true],
  ]),
  fam('banner', 'แบนเนอร์และริบบิ้น', [
    ['ริบบิ้นปลายตัด', poly([[0, 30], [100, 30], [88, 50], [100, 70], [0, 70], [12, 50]])],
    ['โล่ล่างแหลม', poly([[15, 0], [85, 0], [85, 80], [50, 100], [15, 80]])],
    ['ธงปลายหยัก', poly([[10, 0], [90, 0], [90, 100], [50, 78], [10, 100]])],
    ['ที่คั่นหนังสือ', poly([[25, 0], [75, 0], [75, 100], [50, 82], [25, 100]])],
    ['ป้ายแขวน', poly([[20, 0], [80, 0], [80, 75], [50, 100], [20, 75]])],
    ['ริบบิ้นธงยาว', poly([[0, 35], [100, 35], [100, 65], [0, 65], [8, 50]])],
    ['ป้ายลูกศร', poly([[0, 25], [80, 25], [100, 50], [80, 75], [0, 75]])],
    ['ป้ายราคา', poly([[20, 20], [100, 20], [100, 80], [20, 80], [0, 50]]) + ' ' + circlePath(22, 50, 6), true],
  ]),
  fam('drop', 'หยดน้ำ', [['หยดน้ำ', drop(1.5)], ['หยดน้ำอ้วน', drop(1)], ['หยดน้ำแหลม', drop(2.5)], ['หยดน้ำเอียง', drop(1.5, 0.5)], ['หยดน้ำกลับหัว', drop(1.5, Math.PI)], ['ใบไม้', drop(2, Math.PI / 4)]]),
  fam('gear', 'ฟันเฟือง', [
    ['เฟือง 8 ซี่', gear(8, 48, 38, 20), true], ['เฟือง 10 ซี่', gear(10, 48, 40, 24), true], ['เฟือง 12 ซี่', gear(12, 48, 40, 16), true],
    ['เฟือง 16 ซี่', gear(16, 48, 42, 22), true], ['เฟืองทึบ', gear(10, 48, 38, 0)], ['เฟืองรูเล็ก', gear(8, 48, 36, 8), true],
  ]),
  fam('asterisk', 'ดาวแฉกและเครื่องหมายดอกจัน', [
    ['ดอกจัน 6 แฉก', asterisk(6, 48, 6)], ['ดอกจัน 8 แฉก', asterisk(8, 48, 7)], ['ดอกจันหนา', asterisk(5, 48, 12)], ['ดอกจัน 4 แฉก', asterisk(4, 48, 9)], ['ดอกจัน 12 แฉก', asterisk(12, 48, 4)],
    ['ดาวระเบิด 16 แฉก', burst(16, 48, 36)], ['ดาวระเบิด 24 แฉก', burst(24, 48, 40)], ['ดาวกระจาย', burst(12, 48, 22)], ['ดาวมน', burst(10, 48, 32, 1.5)], ['ป้ายหยัก', scallop(18, 42, 7)],
  ]),
  fam('flower', 'รูปทรงดอกไม้ (ออร์แกนิก)', [
    ['ดอกไม้ 4 กลีบ', flower(4, 20)], ['ดอกไม้ 5 กลีบ', flower(5, 18)], ['ดอกไม้ 6 กลีบ', flower(6, 16)], ['ดอกไม้ 8 กลีบ', flower(8, 14)],
    ['ดอกไม้กลีบแหลม', flower(6, 20, 0, 3)], ['ดอกไม้มีรู', flower(5, 18, 10), true], ['ใบโคลเวอร์', flower(4, 24, 0, 0.6)], ['ดอกไม้ 12 กลีบ', flower(12, 10)],
  ]),
  fam('blob', 'รูปทรงอิสระ', [
    ['ก้อนหินมน', blob([40, 46, 38, 44, 42, 36, 46, 40])], ['ก้อนอิสระ', blob([44, 30, 46, 38, 48, 32, 42, 46])], ['ก้อนยืด', blob([48, 26, 30, 48, 26, 30])],
    ['ก้อนสามมุม', blob([46, 30, 46, 30, 46, 30])], ['ก้อนสี่มุม', blob([46, 34, 46, 34, 46, 34, 46, 34])], ['ก้อนเอียง', blob([30, 48, 40, 30, 44, 34, 38, 46])],
    ['ครึ่งวงกลม', poly(Array.from({ length: 61 }, (_, i) => [50 + 48 * Math.cos(Math.PI + (i / 60) * Math.PI), 70 + 48 * Math.sin(Math.PI + (i / 60) * Math.PI)]))],
    ['เสี้ยววงกลม', poly([[0, 100], ...Array.from({ length: 61 }, (_, i) => [100 * Math.cos(-Math.PI / 2 + (i / 60) * Math.PI / 2) * 0 + 100 * Math.sin((i / 60) * Math.PI / 2), 100 - 100 * Math.cos((i / 60) * Math.PI / 2)])])],
    ['ซุ้มโค้ง', poly([[10, 100], [10, 45], ...Array.from({ length: 61 }, (_, i) => [50 - 40 * Math.cos((i / 60) * Math.PI), 45 - 40 * Math.sin((i / 60) * Math.PI)]), [90, 100]])],
    ['แคปซูล', roundRectPath(0, 30, 100, 40, 20)],
  ]),
  fam('bubble', 'กล่องคำพูด', [
    ['กล่องคำพูดกลม', circlePath(50, 45, 40).replace(/ Z$/, '') + ' Z ' + poly([[30, 75], [18, 98], [48, 82]])],
    ['กล่องคำพูดเหลี่ยม', poly([[0, 0], [100, 0], [100, 70], [45, 70], [25, 95], [28, 70], [0, 70]])],
    ['กล่องความคิด', cloud([[25, 45, 18], [45, 32, 22], [68, 36, 20], [80, 50, 14], [52, 52, 20]], 64) + ' ' + circlePath(22, 80, 7) + ' ' + circlePath(10, 94, 4)],
    ['กล่องคำพูดตะโกน', burst(14, 48, 34)],
  ]),
];

/** Fabric object for a family shape at `size` px. */
export function makeFamilyShape(item, size, fill = '#7c5cff') {
  const p = new Path(item.d, { fill, fillRule: item.evenodd ? 'evenodd' : 'nonzero', name: item.label });
  const k = size / Math.max(p.width, p.height);
  p.set({ scaleX: k, scaleY: k });
  return p;
}
export const familyPreview = (item) => `<svg viewBox="-2 -2 104 104" width="100%" height="100%"><path d="${item.d}" fill="currentColor" fill-rule="${item.evenodd ? 'evenodd' : 'nonzero'}"/></svg>`;
