/**
 * Decorated frames (like Canva's polaroid / film / device frames): a card or device drawn around a
 * photo slot. Each design is described in a 0..w × 0..h box; the editor turns it into a Fabric group
 * whose photo child (decoPhoto) is a normal frame picture — drop a photo on it, double-click to adjust.
 *
 * part = { t: 'rect'|'circle'|'path', x, y, w, h, r, d, fill, stroke, sw, angle, opacity, shadow }
 */
const SH = { color: 'rgba(0,0,0,0.22)', blur: 18, offsetX: 0, offsetY: 6 };
const SH_SOFT = { color: 'rgba(0,0,0,0.14)', blur: 26, offsetX: 0, offsetY: 10 };

const holes = (x0, x1, y, n, hw, hh) => Array.from({ length: n }, (_, i) => ({ t: 'rect', x: x0 + ((x1 - x0 - hw) * i) / (n - 1), y, w: hw, h: hh, r: hh * 0.25, fill: '#f4f1ea' }));

/** Perforated stamp edge: rectangle with semicircle bites along every side. */
function stampPath(w, h, rad) {
  const nx = Math.max(3, Math.round(w / (rad * 3.2))), ny = Math.max(3, Math.round(h / (rad * 3.2)));
  const dx = w / nx, dy = h / ny;
  let d = `M0 0`;
  for (let i = 0; i < nx; i++) d += ` L${i * dx + dx / 2 - rad} 0 A${rad} ${rad} 0 0 0 ${i * dx + dx / 2 + rad} 0`;
  d += ` L${w} 0`;
  for (let i = 0; i < ny; i++) d += ` L${w} ${i * dy + dy / 2 - rad} A${rad} ${rad} 0 0 0 ${w} ${i * dy + dy / 2 + rad}`;
  d += ` L${w} ${h}`;
  for (let i = nx - 1; i >= 0; i--) d += ` L${i * dx + dx / 2 + rad} ${h} A${rad} ${rad} 0 0 0 ${i * dx + dx / 2 - rad} ${h}`;
  d += ` L0 ${h}`;
  for (let i = ny - 1; i >= 0; i--) d += ` L0 ${i * dy + dy / 2 + rad} A${rad} ${rad} 0 0 0 0 ${i * dy + dy / 2 - rad}`;
  return d + ' Z';
}

export const DECO_FRAMES = [
  {
    k: 'polaroid', label: 'โพลารอยด์', build: () => ({
      w: 100, h: 122,
      under: [{ t: 'rect', x: 0, y: 0, w: 100, h: 122, r: 1.5, fill: '#ffffff', shadow: SH }],
      photo: { x: 6, y: 6, w: 88, h: 88 },
      over: [],
    }),
  },
  {
    k: 'polaroid-tilt', label: 'โพลารอยด์ เอียง + เทปกาว', build: () => ({
      w: 100, h: 122,
      under: [{ t: 'rect', x: 0, y: 0, w: 100, h: 122, r: 1.5, fill: '#ffffff', shadow: SH }],
      photo: { x: 6, y: 6, w: 88, h: 88 },
      over: [{ t: 'rect', x: 34, y: -7, w: 32, h: 13, fill: '#f6e7a8', opacity: 0.85, angle: -4 }],
      angle: -5,
    }),
  },
  {
    k: 'instant-wide', label: 'ฟิล์มอินสแตนท์ แนวนอน', build: () => ({
      w: 140, h: 108,
      under: [{ t: 'rect', x: 0, y: 0, w: 140, h: 108, r: 2, fill: '#ffffff', shadow: SH }],
      photo: { x: 7, y: 7, w: 126, h: 78 },
      over: [],
    }),
  },
  {
    k: 'film-h', label: 'ฟิล์มภาพยนตร์ แนวนอน', build: () => ({
      w: 160, h: 100,
      under: [{ t: 'rect', x: 0, y: 0, w: 160, h: 100, fill: '#1b1b1f', shadow: SH }, ...holes(5, 155, 4, 12, 7, 7), ...holes(5, 155, 89, 12, 7, 7)],
      photo: { x: 6, y: 16, w: 148, h: 68 },
      over: [],
    }),
  },
  {
    k: 'film-v', label: 'ฟิล์มภาพยนตร์ แนวตั้ง', build: () => ({
      w: 100, h: 160,
      under: [{ t: 'rect', x: 0, y: 0, w: 100, h: 160, fill: '#1b1b1f', shadow: SH },
        ...Array.from({ length: 12 }, (_, i) => ({ t: 'rect', x: 4, y: 5 + (143 * i) / 11, w: 7, h: 7, r: 1.7, fill: '#f4f1ea' })),
        ...Array.from({ length: 12 }, (_, i) => ({ t: 'rect', x: 89, y: 5 + (143 * i) / 11, w: 7, h: 7, r: 1.7, fill: '#f4f1ea' }))],
      photo: { x: 16, y: 6, w: 68, h: 148 },
      over: [],
    }),
  },
  {
    k: 'browser', label: 'หน้าต่างเว็บเบราว์เซอร์', build: () => ({
      w: 160, h: 112,
      under: [{ t: 'rect', x: 0, y: 0, w: 160, h: 112, r: 6, fill: '#e9ebf0', shadow: SH_SOFT },
        { t: 'circle', x: 7, y: 5, w: 6, h: 6, fill: '#ff5f57' }, { t: 'circle', x: 16, y: 5, w: 6, h: 6, fill: '#febc2e' }, { t: 'circle', x: 25, y: 5, w: 6, h: 6, fill: '#28c840' },
        { t: 'rect', x: 38, y: 4, w: 100, h: 8, r: 4, fill: '#ffffff' }],
      photo: { x: 0, y: 16, w: 160, h: 96 },
      over: [],
    }),
  },
  {
    k: 'phone', label: 'โทรศัพท์มือถือ', build: () => ({
      w: 80, h: 160,
      under: [{ t: 'rect', x: 0, y: 0, w: 80, h: 160, r: 13, fill: '#16161a', shadow: SH_SOFT }],
      photo: { x: 4.5, y: 4.5, w: 71, h: 151, r: 9 },
      over: [{ t: 'rect', x: 30, y: 8, w: 20, h: 6, r: 3, fill: '#16161a' }],
    }),
  },
  {
    k: 'tablet', label: 'แท็บเล็ต', build: () => ({
      w: 150, h: 112,
      under: [{ t: 'rect', x: 0, y: 0, w: 150, h: 112, r: 9, fill: '#202024', shadow: SH_SOFT }, { t: 'circle', x: 142.5, y: 54, w: 4, h: 4, fill: '#3a3a40' }],
      photo: { x: 7, y: 7, w: 134, h: 98, r: 3 },
      over: [],
    }),
  },
  {
    k: 'laptop', label: 'แล็ปท็อป', build: () => ({
      w: 180, h: 118,
      under: [{ t: 'rect', x: 20, y: 0, w: 140, h: 104, r: 6, fill: '#202024', shadow: SH_SOFT },
        { t: 'path', d: 'M0 104 L180 104 L174 114 Q172 118 166 118 L14 118 Q8 118 6 114 Z', fill: '#c9ccd3' },
        { t: 'rect', x: 76, y: 104, w: 28, h: 3, r: 1.5, fill: '#a9adb6' }],
      photo: { x: 26, y: 6, w: 128, h: 92 },
      over: [],
    }),
  },
  {
    k: 'tape', label: 'รูปติดเทปกาว', build: () => ({
      w: 110, h: 90,
      under: [{ t: 'rect', x: 0, y: 0, w: 110, h: 90, fill: '#ffffff', shadow: SH }],
      photo: { x: 4, y: 4, w: 102, h: 82 },
      over: [{ t: 'rect', x: -9, y: 1, w: 32, h: 11, fill: '#f7d9e3', opacity: 0.85, angle: -40 },
        { t: 'rect', x: 87, y: 78, w: 32, h: 11, fill: '#f7d9e3', opacity: 0.85, angle: -40 }],
    }),
  },
  {
    k: 'ring', label: 'วงกลมขอบสี', build: () => ({
      w: 100, h: 100,
      under: [{ t: 'circle', x: 0, y: 0, w: 100, h: 100, fill: '#7c5cff', shadow: SH_SOFT }, { t: 'circle', x: 5, y: 5, w: 90, h: 90, fill: '#ffffff' }],
      photo: { x: 8, y: 8, w: 84, h: 84, mask: 'circle' },
      over: [],
    }),
  },
  {
    k: 'stamp-card', label: 'แสตมป์', build: () => ({
      w: 100, h: 124,
      under: [{ t: 'path', d: stampPath(100, 124, 3.2), fill: '#ffffff', shadow: SH }],
      photo: { x: 9, y: 9, w: 82, h: 106 },
      over: [],
    }),
  },
  {
    k: 'card-shadow', label: 'การ์ดเงานุ่ม มุมมน', build: () => ({
      w: 120, h: 120,
      under: [{ t: 'rect', x: 0, y: 0, w: 120, h: 120, r: 12, fill: '#ffffff', shadow: SH_SOFT }],
      photo: { x: 6, y: 6, w: 108, h: 108, r: 8 },
      over: [],
    }),
  },
  {
    k: 'arch-gold', label: 'โค้งขอบทอง', build: () => ({
      w: 100, h: 122.5,
      under: [{ t: 'path', d: 'M0 50 A50 50 0 0 1 100 50 L100 122.5 L0 122.5 Z', fill: '#c9a14a', shadow: SH_SOFT }],
      photo: { x: 5, y: 5, w: 90, h: 112.5, mask: 'arch' },
      over: [],
    }),
  },
];

export const decoFrame = (k) => DECO_FRAMES.find((d) => d.k === k);

/** Small SVG preview for the panel. */
export function decoPreview(k) {
  const f = decoFrame(k);
  if (!f) return '';
  const s = f.build();
  const pad = 10;
  const part = (p) => {
    const tr = p.angle ? ` transform="rotate(${p.angle} ${p.x + p.w / 2} ${p.y + p.h / 2})"` : '';
    const op = p.opacity != null ? ` opacity="${p.opacity}"` : '';
    if (p.t === 'circle') return `<ellipse cx="${p.x + p.w / 2}" cy="${p.y + p.h / 2}" rx="${p.w / 2}" ry="${p.h / 2}" fill="${p.fill}"${op}/>`;
    if (p.t === 'path') return `<path d="${p.d}" fill="${p.fill}"${op}/>`;
    return `<rect x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" rx="${p.r || 0}" fill="${p.fill}"${op}${tr}/>`;
  };
  const ph = s.photo;
  const photo = ph.mask === 'circle' ? `<ellipse cx="${ph.x + ph.w / 2}" cy="${ph.y + ph.h / 2}" rx="${ph.w / 2}" ry="${ph.h / 2}" fill="url(#dg)"/>`
    : ph.mask === 'arch' ? `<path d="M${ph.x} ${ph.y + ph.w / 2} A${ph.w / 2} ${ph.w / 2} 0 0 1 ${ph.x + ph.w} ${ph.y + ph.w / 2} L${ph.x + ph.w} ${ph.y + ph.h} L${ph.x} ${ph.y + ph.h} Z" fill="url(#dg)"/>`
      : `<rect x="${ph.x}" y="${ph.y}" width="${ph.w}" height="${ph.h}" rx="${ph.r || 0}" fill="url(#dg)"/>`;
  return `<svg viewBox="${-pad} ${-pad} ${s.w + pad * 2} ${s.h + pad * 2}" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="dg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#bfe3ff"/><stop offset="1" stop-color="#c9b8ff"/></linearGradient></defs><g${s.angle ? ` transform="rotate(${s.angle} ${s.w / 2} ${s.h / 2})"` : ''}>${s.under.map(part).join('')}${photo}${s.over.map(part).join('')}</g></svg>`;
}
