// Our own graphics, drawn in code (no outside source, free to use):
//   decorItems()  – single-colour decorations for slides (halftone dots, city skyline, folder, brush strokes …)
//   pixelItems()  – full-colour retro pixel-art icons (computer, folder, cursor …)
// Each item is [name, svgBody, width, height, thaiSearchWords].

const r1 = (v) => Math.round(v * 10) / 10;
/** Many dots as one path (one object in the editor instead of hundreds). */
const dots = (list) => `<path d="${list.filter(([, , r]) => r >= 0.8).map(([x, y, r]) => `M${r1(x - r)} ${r1(y)}a${r1(r)} ${r1(r)} 0 1 0 ${r1(2 * r)} 0a${r1(r)} ${r1(r)} 0 1 0 ${r1(-2 * r)} 0`).join('')}"/>`;
const grid = (w, h, step, fn) => { const out = []; for (let y = step / 2; y < h; y += step) for (let x = step / 2; x < w; x += step) { const r = fn(x, y); if (r > 0) out.push([x, y, r]); } return out; };
/** Deterministic pseudo-random numbers (the same drawing on every build). */
const rnd = (seed) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const poly = (pts) => 'M' + pts.map(([x, y]) => `${r1(x)} ${r1(y)}`).join('L') + 'Z';
/** A thick line along a list of points, as a filled outline. */
function ribbon(pts, t) {
  const L = [], R = [];
  pts.forEach((p, i) => {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    let nx = -(b[1] - a[1]), ny = b[0] - a[0];
    const n = Math.hypot(nx, ny) || 1;
    nx /= n; ny /= n;
    const w = typeof t === 'function' ? t(i / (pts.length - 1)) : t;
    L.push([p[0] + nx * w / 2, p[1] + ny * w / 2]);
    R.push([p[0] - nx * w / 2, p[1] - ny * w / 2]);
  });
  return poly([...L, ...R.reverse()]);
}
const bez = (p0, p1, p2, p3, n = 40) => Array.from({ length: n + 1 }, (_, i) => { const t = i / n, u = 1 - t; return [u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0], u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1]]; });
const arrowHead = (tip, from, size) => {
  const dx = tip[0] - from[0], dy = tip[1] - from[1], n = Math.hypot(dx, dy) || 1, ux = dx / n, uy = dy / n;
  return poly([[tip[0] + ux * size * 0.3, tip[1] + uy * size * 0.3], [tip[0] - ux * size + -uy * size * 0.7, tip[1] - uy * size + ux * size * 0.7], [tip[0] - ux * size * 0.55, tip[1] - uy * size * 0.55], [tip[0] - ux * size - -uy * size * 0.7, tip[1] - uy * size - ux * size * 0.7]]);
};
const P = (d, extra = '') => `<path${extra} d="${d}"/>`;

export function decorItems() {
  const items = [];
  const add = (name, body, w, h, th) => items.push([name, body, w, h, th]);

  // ---- halftone dots
  add('halftone-corner', dots(grid(400, 400, 20, (x, y) => { const d = Math.hypot(x, 400 - y); return 8.5 * (1 - d / 430); })), 400, 400, 'ฮาล์ฟโทน จุด ไล่ขนาด มุม ลายจุด');
  add('halftone-fade', dots(grid(800, 200, 16, (x) => 6.5 * (1 - x / 800))), 800, 200, 'ฮาล์ฟโทน จุด ไล่ขนาด แถบ ลายจุด');
  add('halftone-circle', dots(grid(400, 400, 18, (x, y) => { const d = Math.hypot(x - 200, y - 200); return d < 196 ? 8 * (1 - d / 210) : 0; })), 400, 400, 'ฮาล์ฟโทน จุด วงกลม ลายจุด');
  add('halftone-diagonal', dots(grid(600, 600, 18, (x, y) => 7.5 * Math.max(0, 1 - (x + (600 - y)) / 650))), 600, 600, 'ฮาล์ฟโทน จุด ทแยง ลายจุด');
  add('dot-grid', dots(grid(400, 400, 28, () => 3.6)), 400, 400, 'จุด ตาราง ลายจุด ตกแต่ง');

  // ---- city skyline (solid, and with windows)
  const R = rnd(7), blds = [];
  for (let x = 0; x < 1200;) { const w = 50 + Math.floor(R() * 70), h = 80 + Math.floor(R() * 200); blds.push([x, w, h]); x += w; }
  const H = 320;
  const solid = blds.map(([x, w, h], i) => {
    let d = `M${x} ${H}V${H - h}H${x + w}V${H}Z`;
    if (i % 5 === 2) d += `M${x + w / 2 - 3} ${H - h}V${H - h - 40}H${x + w / 2 + 3}V${H - h}Z`; // antenna
    if (i % 7 === 4) d += `M${x + 6} ${H - h}L${x + w / 2} ${H - h - 34}L${x + w - 6} ${H - h}Z`; // pointed roof
    return d;
  }).join('');
  add('skyline', P(solid), 1200, H + 10, 'เมือง ตึก อาคาร เส้นขอบฟ้า ซิลลูเอท');
  const win = blds.map(([x, w, h]) => {
    let d = `M${x} ${H}V${H - h}H${x + w}V${H}Z`;
    const cols = Math.max(2, Math.floor((w - 12) / 16));
    const gap = (w - cols * 8) / (cols + 1);
    for (let y = H - h + 16; y < H - 24; y += 22) for (let c = 0; c < cols; c++) d += `M${r1(x + gap + c * (8 + gap))} ${y}h8v12h-8Z`;
    return d;
  }).join('');
  add('skyline-windows', P(win, ' fill-rule="evenodd"'), 1200, H, 'เมือง ตึก อาคาร หน้าต่าง เส้นขอบฟ้า');

  // ---- folder (card with a tab), and a file tab label
  add('folder', P('M20 64Q20 40 44 40H214Q232 40 243 54L262 78H556Q580 78 580 102V416Q580 440 556 440H44Q20 440 20 416Z'), 600, 460, 'แฟ้ม โฟลเดอร์ การ์ด กล่องข้อความ');
  add('folder-back', P('M20 64Q20 40 44 40H214Q232 40 243 54L262 78H556Q580 78 580 102V140H20Z'), 600, 160, 'แฟ้ม โฟลเดอร์ แถบ');

  // ---- brush strokes & highlighter
  const brush = (seed, w, h) => {
    const r = rnd(seed), top = [], bot = [];
    for (let i = 0; i <= 40; i++) {
      const x = (w * i) / 40, taper = Math.min(1, i / 4, (40 - i) / 3);
      top.push([x, h / 2 - (h / 2 - 6) * taper - r() * 7]);
      bot.push([x, h / 2 + (h / 2 - 6) * taper + r() * 7]);
    }
    return poly([...top, ...bot.reverse()]);
  };
  add('brush-stroke', P(brush(11, 800, 140)), 800, 150, 'พู่กัน แปรง รอยพู่กัน ไฮไลต์ ปากกาเน้น');
  add('brush-stroke-2', P(brush(23, 700, 90)), 700, 100, 'พู่กัน แปรง รอยพู่กัน ไฮไลต์ ขีดเส้นใต้');

  // ---- lines: wavy, zigzag, loop, curvy arrows
  const wave = Array.from({ length: 161 }, (_, i) => [10 + i * 5, 30 + Math.sin((i / 160) * Math.PI * 8) * 14]);
  add('wavy-line', P(ribbon(wave, 8)), 820, 60, 'เส้นคลื่น ขีดเส้นใต้ ตกแต่ง');
  const zz = Array.from({ length: 21 }, (_, i) => [10 + i * 40, i % 2 ? 50 : 10]);
  add('zigzag-line', P(ribbon(zz, 8)), 820, 60, 'เส้นซิกแซก ขีดเส้นใต้ ตกแต่ง');
  const loop = Array.from({ length: 241 }, (_, i) => { const t = (i / 240) * Math.PI * 10; return [20 + i * 3.2 + Math.cos(t) * 18, 40 + Math.sin(t) * 18]; });
  add('loop-line', P(ribbon(loop, 6)), 820, 80, 'เส้นขด ลายมือ ขีดเส้นใต้ ตกแต่ง');
  {
    const c = bez([30, 160], [120, 20], [280, 20], [360, 120]);
    add('curvy-arrow', P(ribbon(c.slice(0, -2), 9)) + P(arrowHead(c[c.length - 1], c[c.length - 4], 34)), 400, 200, 'ลูกศร โค้ง ลายมือ ชี้');
    const s = bez([20, 60], [140, 200], [240, -40], [370, 120]);
    add('swirl-arrow', P(ribbon(s.slice(0, -2), 9)) + P(arrowHead(s[s.length - 1], s[s.length - 4], 34)), 400, 200, 'ลูกศร คดเคี้ยว ลายมือ ชี้');
    const lp = [...bez([20, 150], [80, 40], [200, 20], [210, 90], 24), ...bez([210, 90], [215, 150], [130, 150], [150, 90], 20).slice(1), ...bez([150, 90], [170, 30], [300, 40], [370, 70], 24).slice(1)];
    add('loop-arrow', P(ribbon(lp.slice(0, -2), 9)) + P(arrowHead(lp[lp.length - 1], lp[lp.length - 4], 32)), 400, 180, 'ลูกศร วน ลายมือ ชี้');
  }

  // ---- big shapes for slide backgrounds
  add('ring-quarter', P('M0 0A400 400 0 0 1 400 400H290A290 290 0 0 0 0 110Z'), 400, 400, 'วง โค้ง มุม พื้นหลัง วงแหวน');
  add('circle-quarter', P('M0 0A400 400 0 0 1 400 400H0Z'), 400, 400, 'วงกลม หนึ่งในสี่ มุม พื้นหลัง');
  add('corner-triangle', P('M0 0H400L0 400Z'), 400, 400, 'มุม สามเหลี่ยม พื้นหลัง เฉียง');
  add('chevron-band', P('M0 0H170L400 200L170 400H0L230 200Z'), 400, 400, 'บั้ง ลูกศร แถบเฉียง พื้นหลัง');
  add('diagonal-band', P('M120 0H400L280 400H0Z'), 400, 400, 'แถบเฉียง พื้นหลัง');
  add('wave-bottom', P('M0 120C160 40 300 180 480 110S760 30 800 90V200H0Z'), 800, 200, 'คลื่น ขอบล่าง พื้นหลัง');
  add('blob-soft', P('M210 30C300 10 390 70 380 170C372 260 300 330 200 330C100 330 20 270 22 180C25 90 120 50 210 30Z'), 400, 360, 'รูปทรงอิสระ ก้อน พื้นหลัง');
  add('blob-wide', P('M80 60C180 0 330 40 460 30C590 20 690 90 660 180C630 270 470 250 340 270C200 292 60 290 30 200C10 140 30 90 80 60Z'), 700, 300, 'รูปทรงอิสระ ก้อน พื้นหลัง');
  {
    const pts = [];
    for (let i = 0; i < 40; i++) { const a = (i / 40) * Math.PI * 2 - Math.PI / 2, r = i % 2 ? 150 : 200; pts.push([200 + Math.cos(a) * r, 200 + Math.sin(a) * r]); }
    add('starburst', P(poly(pts)), 400, 400, 'ป้าย ดาวระเบิด ราคา ลดราคา');
  }
  const spark = (cx, cy, s) => `M${cx} ${cy - s}C${cx + s * 0.12} ${cy - s * 0.12} ${cx + s * 0.12} ${cy - s * 0.12} ${cx + s} ${cy}C${cx + s * 0.12} ${cy + s * 0.12} ${cx + s * 0.12} ${cy + s * 0.12} ${cx} ${cy + s}C${cx - s * 0.12} ${cy + s * 0.12} ${cx - s * 0.12} ${cy + s * 0.12} ${cx - s} ${cy}C${cx - s * 0.12} ${cy - s * 0.12} ${cx - s * 0.12} ${cy - s * 0.12} ${cx} ${cy - s}Z`;
  add('sparkles', P(spark(150, 170, 110) + spark(300, 70, 55) + spark(310, 270, 38)), 380, 320, 'ประกาย วิบวับ ดาว ตกแต่ง');
  add('washi-tape', P('M0 0L12 10L0 20L12 30L0 40L12 50L0 60L12 70L0 80H388L400 70L388 60L400 50L388 40L400 30L388 20L400 10L388 0Z'), 400, 80, 'เทปกาว วาชิ เทป ตกแต่ง น่ารัก');
  add('speech-round', P('M200 20C310 20 390 80 390 160S310 300 200 300C178 300 158 298 140 293L60 330L82 262C40 236 10 200 10 160C10 80 90 20 200 20Z'), 400, 340, 'กล่องคำพูด บับเบิล พูด');
  add('cloud-puffy', P('M90 250C40 250 10 220 10 180S45 115 95 120C100 60 160 20 220 35C260 10 330 30 345 85C395 85 430 125 425 170S385 250 340 250Z'), 440, 260, 'ก้อนเมฆ ตกแต่ง น่ารัก');
  add('grid-paper', P(Array.from({ length: 21 }, (_, i) => `M${i * 30} 0h1.5v600h-1.5ZM0 ${i * 30}h600v1.5h-600Z`).join('')), 600, 600, 'กระดาษตาราง เส้นตาราง สมุด พื้นหลัง');
  add('grid-paper-wide', P(Array.from({ length: 33 }, (_, i) => `M${i * 30} 0h1.2v540h-1.2Z`).join('') + Array.from({ length: 19 }, (_, i) => `M0 ${i * 30}h960v1.2h-960Z`).join('')), 960, 540, 'กระดาษตาราง เส้นตาราง สมุด พื้นหลัง 16:9 สไลด์');
  add('lined-paper', P(Array.from({ length: 20 }, (_, i) => `M0 ${30 + i * 30}h600v2h-600Z`).join('')), 600, 600, 'กระดาษเส้น สมุด บรรทัด พื้นหลัง');
  return items;
}

// ---------------------------------------------------------------- retro pixel art (colour)
const PAL = { K: '#1f2333', W: '#ffffff', G: '#c3cad6', D: '#8a94a6', B: '#3b6fd8', N: '#1e3a8a', C: '#5fd3e8', Y: '#ffd43b', O: '#f5a524', L: '#fff1a6', R: '#ef4444', S: '#dfe4ec', P: '#a5b4fc', E: '#34d399', M: '#f472b6' };
const PIX = {
  'pixel-computer': ['..KKKKKKKKKKKK..', '.KGGGGGGGGGGGGK.', '.KGKKKKKKKKKKGK.', '.KGKBBBBBBBBKGK.', '.KGKBCBBBBCBKGK.', '.KGKBBBBBBBBKGK.', '.KGKBCBBBBCBKGK.', '.KGKBBCCCCBBKGK.', '.KGKKKKKKKKKKGK.', '.KGGGGGGGGGERGK.', '.KKKKKKKKKKKKKK.', '.....KGGGGK.....', '..KKKKKKKKKKKK..', '.KWGWGWGWGWGWGK.', '.KGWGWGWGWGWGWK.', '.KKKKKKKKKKKKKK.'],
  'pixel-folder': ['................', '.KKKKKK.........', 'KYYYYYYK........', 'KYYYYYYYKKKKKKK.', 'KYYYYYYYYYYYYYYK', 'KLLLLLLLLLLLLLLK', 'KYYYYYYYYYYYYYYK', 'KYYYYYYYYYYYYYYK', 'KYYYYYYYYYYYYYYK', 'KYYYYYYYYYYYYYYK', 'KYYYYYYYYYYYYYYK', 'KOOOOOOOOOOOOOOK', 'KOOOOOOOOOOOOOOK', '.KKKKKKKKKKKKKK.'],
  'pixel-cursor': ['K...........', 'KK..........', 'KWK.........', 'KWWK........', 'KWWWK.......', 'KWWWWK......', 'KWWWWWK.....', 'KWWWWWWK....', 'KWWWWWWWK...', 'KWWWWWWWWK..', 'KWWWWWKKKKK.', 'KWWKWWK.....', 'KWK.KWWK....', 'KK..KWWK....', 'K....KWWK...', '.....KKKK...'],
  'pixel-hand': ['....KK..........', '...KWWK.........', '...KWWK.........', '...KWWK.........', '...KWWKKK.KK....', '...KWWKWWKWWKK..', '...KWWKWWKWWKWK.', '.KKKWWWWWWWWWWK.', 'KWWKWWWWWWWWWWK.', 'KWWWWWWWWWWWWGK.', '.KWWWWWWWWWWWGK.', '..KWWWWWWWWWWGK.', '..KWWWWWWWWWGK..', '...KWWWWWWWWGK..', '...KWWWWWWWGK...', '...KKKKKKKKKK...'],
  'pixel-info': ['....KKKKKKKK....', '..KKWWWWWWWWKK..', '.KWWWWWNNWWWWWK.', 'KWWWWWWNNWWWWWWK', 'KWWWWWWWWWWWWWWK', 'KWWWWWNNNWWWWWWK', 'KWWWWWWNNWWWWWWK', 'KWWWWWWNNWWWWWWK', 'KWWWWWWNNWWWWWWK', '.KWWWWNNNNWWWWK.', '..KKWWWWWWWWKK..', '....KKKWWKKK....', '......KWK.......', '.....KWK........', '....KK..........'],
  'pixel-floppy': ['KKKKKKKKKKKKKK..', 'KBBKWWWWWWWWKBK.', 'KBBKWWWWWWKWKBBK', 'KBBKWWWWWWKWKBBK', 'KBBKWWWWWWWWKBBK', 'KBBBKKKKKKKKBBBK', 'KBBBBBBBBBBBBBBK', 'KBBWWWWWWWWWWBBK', 'KBBWRRRRRRRRWBBK', 'KBBWWWWWWWWWWBBK', 'KBBWGGGGGGGGWBBK', 'KBBWWWWWWWWWWBBK', 'KBBWGGGGGGGGWBBK', 'KBBWWWWWWWWWWBBK', 'KKKKKKKKKKKKKKKK'],
  'pixel-notepad': ['..K.K.K.K.K.K...', '.KGKGKGKGKGKGK..', 'KCCCCCCCCCCCCCK.', 'KCWWWWWWWWWWWCK.', 'KCWKKKKKKKKKWCK.', 'KCWWWWWWWWWWWCK.', 'KCWKKKKKKKKKWCK.', 'KCWWWWWWWWWWWCK.', 'KCWKKKKKKWWWWCK.', 'KCWWWWWWWWWWWCK.', 'KCWKKKKKKKKKWCK.', 'KCWWWWWWWWWWWCK.', 'KCCCCCCCCCCCCCK.', '.KKKKKKKKKKKKK..'],
  'pixel-printer': ['....KKKKKKKK....', '....KWWWWWWK....', '....KWKKKKWK....', '....KWWWWWWK....', '..KKKKKKKKKKKK..', '.KGGGGGGGGGGGGK.', 'KGGGGGGGGGGGEGGK', 'KGGGGGGGGGGGGGGK', 'KDDDDDDDDDDDDDDK', 'KGGKWWWWWWWWKGGK', 'KGGKWKKKKKKWKGGK', '.KKKWWWWWWWWKKK.', '....KWKKKKWK....', '....KWWWWWWK....', '....KKKKKKKK....'],
  'pixel-cd': ['.....KKKKKK.....', '...KKSSSSSSKK...', '..KSPPSSSSSSSK..', '.KSPPPSSSSSSSSK.', '.KSPPSSSSSSSSSK.', 'KSSSSSSKKSSSSSSK', 'KSSSSSKWWKSSSSSK', 'KSSSSSKWWKSSSSSK', 'KSSSSSSKKSSSSSSK', '.KSSSSSSSSSSPSK.', '.KSSSSSSSSSPPSK.', '..KSSSSSSSPPSK..', '...KKSSSSSSKK...', '.....KKKKKK.....'],
  'pixel-heart': ['..KKK...KKK..', '.KRRRK.KRRRK.', 'KRWWRRKRRRRRK', 'KRWRRRRRRRRRK', 'KRRRRRRRRRRRK', '.KRRRRRRRRRK.', '..KRRRRRRRK..', '...KRRRRRK...', '....KRRRK....', '.....KRK.....', '......K......'],
  'pixel-star': ['.......K.......', '......KYK......', '......KYK......', '.....KYYYK.....', 'KKKKKKYYYKKKKKK', '.KYYYYYYYYYYYK.', '..KYYYYYYYYYK..', '...KYYYYYYYK...', '...KYYYKYYYK...', '..KYYYK.KYYYK..', '..KYYK...KYYK..', '.KYK.......KYK.', '.KK.........KK.'],
  'pixel-mail': ['KKKKKKKKKKKKKKKK', 'KKWWWWWWWWWWWWKK', 'KWKWWWWWWWWWWKWK', 'KWWKWWWWWWWWKWWK', 'KWWWKWWWWWWKWWWK', 'KWWWWKWWWWKWWWWK', 'KWWWWWKKKKWWWWWK', 'KWWWWWWWWWWWWWWK', 'KWWWWWWWWWWWWWWK', 'KKKKKKKKKKKKKKKK'],
  'pixel-bulb': ['.....KKKKK.....', '...KKYYYYYKK...', '..KYYWWYYYYYK..', '.KYYWYYYYYYYYK.', '.KYYYYYYYYYYYK.', '.KYYYYYYYYYYYK.', '..KYYYYYYYYYK..', '...KYYYYYYYK...', '....KYYYYYK....', '....KKKKKKK....', '....KGGGGGK....', '....KKKKKKK....', '....KGGGGGK....', '.....KKKKK.....'],
  'pixel-window': ['KKKKKKKKKKKKKKKK', 'KNNNNNNNNNNKWKRK', 'KNNNNNNNNNNKKKKK', 'KWWWWWWWWWWWWWWK', 'KWGGGGGGGWWWWWWK', 'KWWWWWWWWWWWWWWK', 'KWGGGGGGGGGGGWWK', 'KWWWWWWWWWWWWWWK', 'KWGGGGGWWWWWWWWK', 'KWWWWWWWWWKKKKWK', 'KWWWWWWWWWKEEKWK', 'KWWWWWWWWWKKKKWK', 'KKKKKKKKKKKKKKKK'],
  'pixel-chat': ['.KKKKKKKKKKKKK..', 'KMMMMMMMMMMMMMK.', 'KMWWMMMMMMMMMMK.', 'KMMMMMMMMMMMMMK.', 'KMWMWMWMMMMMMMK.', 'KMMMMMMMMMMMMMK.', 'KMMMMMMMMMMMMMK.', '.KKKMMKKKKKKKK..', '...KMK..........', '...KK...........'],
  'pixel-trophy': ['.KKKKKKKKKKKK.', 'KYKYYYYYYYYKYK', 'KYKYYWYYYYYKYK', '.KKYYWYYYYYKK.', '..KYYYYYYYYK..', '...KYYYYYYK...', '....KYYYYK....', '.....KYYK.....', '.....KOOK.....', '....KOOOOK....', '...KKKKKKKK...', '...KDDDDDDK...', '...KKKKKKKK...'],
};
export function pixelItems() {
  const TH = { computer: 'คอมพิวเตอร์ ย้อนยุค', folder: 'แฟ้ม โฟลเดอร์', cursor: 'เมาส์ ลูกศร เคอร์เซอร์', hand: 'มือ ชี้ คลิก', info: 'ข้อมูล ไอ', floppy: 'แผ่นดิสก์ บันทึก', notepad: 'สมุดโน้ต บันทึก', printer: 'เครื่องพิมพ์ ปริ้น', cd: 'ซีดี แผ่น', heart: 'หัวใจ', star: 'ดาว', mail: 'จดหมาย อีเมล', bulb: 'หลอดไฟ ไอเดีย', window: 'หน้าต่าง โปรแกรม', chat: 'แชท ข้อความ', trophy: 'ถ้วยรางวัล' };
  return Object.entries(PIX).map(([name, rows]) => {
    const w = Math.max(...rows.map((r) => r.length)), h = rows.length;
    const byColor = {};
    rows.forEach((row, y) => {
      for (let x = 0; x < row.length;) {
        const c = row[x];
        let e = x;
        while (e < row.length && row[e] === c) e++;
        if (c !== '.') (byColor[c] ||= []).push(`M${x} ${y}h${e - x}v1h-${e - x}Z`);
        x = e;
      }
    });
    const body = `<g shape-rendering="crispEdges">${Object.entries(byColor).map(([c, d]) => `<path fill="${PAL[c]}" d="${d.join('')}"/>`).join('')}</g>`;
    return [name, body, w, h, 'พิกเซล ย้อนยุค เรโทร ' + (TH[name.slice(6)] || '')];
  });
}
