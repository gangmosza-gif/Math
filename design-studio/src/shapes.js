import { Rect, Circle, Ellipse, Triangle, Polygon, Path, Line, Textbox, Gradient } from 'fabric';

const regular = (n, r, rot = -Math.PI / 2) =>
  Array.from({ length: n }, (_, i) => ({
    x: r + r * Math.cos(rot + (i * 2 * Math.PI) / n),
    y: r + r * Math.sin(rot + (i * 2 * Math.PI) / n),
  }));

const star = (points, outer, inner) =>
  Array.from({ length: points * 2 }, (_, i) => {
    const r = i % 2 ? inner : outer;
    const a = -Math.PI / 2 + (i * Math.PI) / points;
    return { x: outer + r * Math.cos(a), y: outer + r * Math.sin(a) };
  });

export const grad = (a, b, angle = 135) => {
  const rad = (angle * Math.PI) / 180;
  const x = Math.cos(rad) / 2;
  const y = Math.sin(rad) / 2;
  return new Gradient({
    type: 'linear',
    gradientUnits: 'percentage',
    coords: { x1: 0.5 - x, y1: 0.5 - y, x2: 0.5 + x, y2: 0.5 + y },
    colorStops: [
      { offset: 0, color: a },
      { offset: 1, color: b },
    ],
  });
};

const C = '#7c5cff';

// Each entry: [label, factory(size) -> fabric object]
export const SHAPES = [
  ['สี่เหลี่ยม', (s) => new Rect({ width: s, height: s, fill: C })],
  ['สี่เหลี่ยมมุมมน', (s) => new Rect({ width: s, height: s, rx: s * 0.15, ry: s * 0.15, fill: C })],
  ['วงกลม', (s) => new Circle({ radius: s / 2, fill: C })],
  ['วงรี', (s) => new Ellipse({ rx: s / 2, ry: s / 3, fill: C })],
  ['สามเหลี่ยม', (s) => new Triangle({ width: s, height: s * 0.87, fill: C })],
  ['สามเหลี่ยมมุมฉาก', (s) => new Polygon([{ x: 0, y: 0 }, { x: 0, y: s }, { x: s, y: s }], { fill: C })],
  ['ข้าวหลามตัด', (s) => new Polygon(regular(4, s / 2), { fill: C })],
  ['ห้าเหลี่ยม', (s) => new Polygon(regular(5, s / 2), { fill: C })],
  ['หกเหลี่ยม', (s) => new Polygon(regular(6, s / 2, 0), { fill: C })],
  ['แปดเหลี่ยม', (s) => new Polygon(regular(8, s / 2, Math.PI / 8), { fill: C })],
  ['ดาว', (s) => new Polygon(star(5, s / 2, s / 4.6), { fill: C })],
  ['ดาว 8 แฉก', (s) => new Polygon(star(8, s / 2, s / 3), { fill: C })],
  ['สี่เหลี่ยมด้านขนาน', (s) => new Polygon([{ x: s * 0.25, y: 0 }, { x: s, y: 0 }, { x: s * 0.75, y: s * 0.6 }, { x: 0, y: s * 0.6 }], { fill: C })],
  ['บวก', (s) => new Polygon([
    { x: s * 0.35, y: 0 }, { x: s * 0.65, y: 0 }, { x: s * 0.65, y: s * 0.35 }, { x: s, y: s * 0.35 },
    { x: s, y: s * 0.65 }, { x: s * 0.65, y: s * 0.65 }, { x: s * 0.65, y: s }, { x: s * 0.35, y: s },
    { x: s * 0.35, y: s * 0.65 }, { x: 0, y: s * 0.65 }, { x: 0, y: s * 0.35 }, { x: s * 0.35, y: s * 0.35 },
  ], { fill: C })],
  ['หัวใจ', (s) => scaled(new Path('M50 90 C20 70 0 52 0 30 C0 12 14 0 30 0 C40 0 47 6 50 14 C53 6 60 0 70 0 C86 0 100 12 100 30 C100 52 80 70 50 90 Z', { fill: '#ff4d6d' }), s)],
  ['ลูกศร', (s) => scaled(new Path('M0 35 L65 35 L65 15 L100 50 L65 85 L65 65 L0 65 Z', { fill: C }), s)],
  ['ลูกศรสองทาง', (s) => scaled(new Path('M0 50 L25 20 L25 38 L75 38 L75 20 L100 50 L75 80 L75 62 L25 62 L25 80 Z', { fill: C }), s)],
  ['กล่องข้อความ', (s) => scaled(new Path('M10 0 H90 Q100 0 100 10 V60 Q100 70 90 70 H42 L22 92 L26 70 H10 Q0 70 0 60 V10 Q0 0 10 0 Z', { fill: C }), s)],
  ['ป้ายริบบิ้น', (s) => scaled(new Path('M0 0 H100 L88 25 L100 50 H0 L12 25 Z', { fill: C }), s)],
  ['วงแหวน', (s) => new Circle({ radius: s / 2, fill: 'transparent', stroke: C, strokeWidth: s * 0.12 })],
  ['กรอบสี่เหลี่ยม', (s) => new Rect({ width: s, height: s, fill: 'transparent', stroke: C, strokeWidth: s * 0.06 })],
  ['ไล่สีม่วง-ชมพู', (s) => new Rect({ width: s, height: s, rx: s * 0.12, ry: s * 0.12, fill: grad('#7c5cff', '#ff5fa2') })],
  ['ไล่สีส้ม', (s) => new Circle({ radius: s / 2, fill: grad('#ffb347', '#ff5e62') })],
  ['ไล่สีฟ้า', (s) => new Rect({ width: s, height: s, fill: grad('#43cea2', '#185a9d') })],
];

function scaled(obj, s) {
  const k = s / Math.max(obj.width, obj.height);
  obj.set({ scaleX: k, scaleY: k });
  return obj;
}

export const LINES = [
  ['เส้นตรง', (s) => new Line([0, 0, s * 1.5, 0], { stroke: '#1f2333', strokeWidth: 6, strokeLineCap: 'round' })],
  ['เส้นประ', (s) => new Line([0, 0, s * 1.5, 0], { stroke: '#1f2333', strokeWidth: 6, strokeDashArray: [24, 14] })],
  ['เส้นจุด', (s) => new Line([0, 0, s * 1.5, 0], { stroke: '#1f2333', strokeWidth: 8, strokeDashArray: [0.1, 18], strokeLineCap: 'round' })],
  ['เส้นหนา', (s) => new Line([0, 0, s * 1.5, 0], { stroke: '#1f2333', strokeWidth: 18, strokeLineCap: 'round' })],
  ['ลูกศรเส้น', (s) => new Path(`M0 ${s * 0.1} L${s * 1.4} ${s * 0.1} M${s * 1.25} 0 L${s * 1.4} ${s * 0.1} L${s * 1.25} ${s * 0.2}`, { fill: '', stroke: '#1f2333', strokeWidth: 6, strokeLineCap: 'round', strokeLineJoin: 'round' })],
  ['เส้นโค้ง', (s) => new Path(`M0 ${s * 0.4} Q${s * 0.75} ${-s * 0.3} ${s * 1.5} ${s * 0.4}`, { fill: '', stroke: '#1f2333', strokeWidth: 6, strokeLineCap: 'round' })],
  ['เส้นซิกแซก', (s) => new Path(`M0 ${s * 0.2} L${s * 0.25} 0 L${s * 0.5} ${s * 0.2} L${s * 0.75} 0 L${s} ${s * 0.2} L${s * 1.25} 0 L${s * 1.5} ${s * 0.2}`, { fill: '', stroke: '#1f2333', strokeWidth: 6, strokeLineCap: 'round', strokeLineJoin: 'round' })],
];

export const STICKERS = [
  '😀', '😍', '🥳', '😎', '🤩', '👍', '👏', '🙏', '💪', '❤️', '🔥', '⭐', '✨', '🎉', '🎁', '🎈',
  '🎂', '🌸', '🌈', '☀️', '🌙', '⚡', '💡', '📌', '📣', '✅', '❌', '➕', '➖', '✖️', '➗', '🟰',
  '📚', '✏️', '📐', '📏', '🧮', '🏆', '🥇', '🎓', '🍕', '☕', '🍰', '🍜', '🛒', '💰', '📷', '🎵',
];

export function makeSticker(ch, s) {
  return new Textbox(ch, { fontSize: s * 0.8, width: s, textAlign: 'center', fontFamily: 'sans-serif' });
}

// Draw a small SVG preview for the element panel.
export function shapePreviewSVG(label) {
  const f = 'fill="#7c5cff"';
  const map = {
    'สี่เหลี่ยม': `<rect x="8" y="8" width="44" height="44" ${f}/>`,
    'สี่เหลี่ยมมุมมน': `<rect x="8" y="8" width="44" height="44" rx="9" ${f}/>`,
    'วงกลม': `<circle cx="30" cy="30" r="22" ${f}/>`,
    'วงรี': `<ellipse cx="30" cy="30" rx="24" ry="16" ${f}/>`,
    'สามเหลี่ยม': `<path d="M30 9L53 50H7z" ${f}/>`,
    'สามเหลี่ยมมุมฉาก': `<path d="M8 8v44h44z" ${f}/>`,
    'ข้าวหลามตัด': `<path d="M30 6l24 24-24 24L6 30z" ${f}/>`,
    'ห้าเหลี่ยม': `<path d="M30 7l22 16-8 26H16L8 23z" ${f}/>`,
    'หกเหลี่ยม': `<path d="M53 30L41.5 50h-23L7 30l11.5-20h23z" ${f}/>`,
    'แปดเหลี่ยม': `<path d="M21 8h18l13 13v18L39 52H21L8 39V21z" ${f}/>`,
    'ดาว': `<path d="M30 6l6.5 15 16 1.5-12 10.8 3.6 15.7L30 41l-14 8 3.5-15.7-12-10.8 16-1.5z" ${f}/>`,
    'ดาว 8 แฉก': `<path d="M30 6l5 12 12-5-5 12 12 5-12 5 5 12-12-5-5 12-5-12-12 5 5-12-12-5 12-5-5-12 12 5z" ${f}/>`,
    'สี่เหลี่ยมด้านขนาน': `<path d="M20 15h34l-14 30H6z" ${f}/>`,
    'บวก': `<path d="M24 8h12v16h16v12H36v16H24V36H8V24h16z" ${f}/>`,
    'หัวใจ': `<path d="M30 52C14 41 6 32 6 21 6 13 12 8 19 8c5 0 9 3 11 7 2-4 6-7 11-7 7 0 13 5 13 13 0 11-8 20-24 31z" fill="#ff4d6d"/>`,
    'ลูกศร': `<path d="M6 24h28V12l20 18-20 18V36H6z" ${f}/>`,
    'ลูกศรสองทาง': `<path d="M4 30l14-14v9h24v-9l14 14-14 14v-9H18v9z" ${f}/>`,
    'กล่องข้อความ': `<path d="M10 8h40a5 5 0 0 1 5 5v24a5 5 0 0 1-5 5H28L17 53l2-11h-9a5 5 0 0 1-5-5V13a5 5 0 0 1 5-5z" ${f}/>`,
    'ป้ายริบบิ้น': `<path d="M4 18h52l-7 12 7 12H4l7-12z" ${f}/>`,
    'วงแหวน': `<circle cx="30" cy="30" r="19" fill="none" stroke="#7c5cff" stroke-width="7"/>`,
    'กรอบสี่เหลี่ยม': `<rect x="10" y="10" width="40" height="40" fill="none" stroke="#7c5cff" stroke-width="4"/>`,
    'ไล่สีม่วง-ชมพู': `<defs><linearGradient id="g1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7c5cff"/><stop offset="1" stop-color="#ff5fa2"/></linearGradient></defs><rect x="8" y="8" width="44" height="44" rx="6" fill="url(#g1)"/>`,
    'ไล่สีส้ม': `<defs><linearGradient id="g2" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffb347"/><stop offset="1" stop-color="#ff5e62"/></linearGradient></defs><circle cx="30" cy="30" r="22" fill="url(#g2)"/>`,
    'ไล่สีฟ้า': `<defs><linearGradient id="g3" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#43cea2"/><stop offset="1" stop-color="#185a9d"/></linearGradient></defs><rect x="8" y="8" width="44" height="44" fill="url(#g3)"/>`,
    'เส้นตรง': `<path d="M6 30h48" stroke="#1f2333" stroke-width="4" stroke-linecap="round"/>`,
    'เส้นประ': `<path d="M6 30h48" stroke="#1f2333" stroke-width="4" stroke-dasharray="8 5"/>`,
    'เส้นจุด': `<path d="M6 30h48" stroke="#1f2333" stroke-width="5" stroke-dasharray="0.1 8" stroke-linecap="round"/>`,
    'เส้นหนา': `<path d="M6 30h48" stroke="#1f2333" stroke-width="10" stroke-linecap="round"/>`,
    'ลูกศรเส้น': `<path d="M6 30h46M44 22l8 8-8 8" fill="none" stroke="#1f2333" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`,
    'เส้นโค้ง': `<path d="M6 42Q30 6 54 42" fill="none" stroke="#1f2333" stroke-width="4" stroke-linecap="round"/>`,
    'เส้นซิกแซก': `<path d="M6 36l8-12 8 12 8-12 8 12 8-12 8 12" fill="none" stroke="#1f2333" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`,
  };
  return `<svg viewBox="0 0 60 60" width="100%" height="100%">${map[label] || ''}</svg>`;
}
