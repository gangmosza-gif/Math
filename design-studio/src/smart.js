// "Smart" elements rebuilt from data: tables, charts, QR codes, equations, image placeholders.
// Each returns a fabric object carrying `smart = { type, ...data }` so it can be edited later.
import { Group, Rect, Textbox, Line, Polyline, Polygon, Circle, Path, FabricText, FabricImage, Shadow, loadSVGFromString, util } from 'fabric';
import qrcode from 'qrcode-generator';
import { ICON_PATHS } from './icons.js';

export const CHART_COLORS = ['#7c5cff', '#ff5fa2', '#22c3e6', '#ffb020', '#2ecc71', '#ff6b4a', '#4f8cff', '#a0a8c0'];

// ---------------------------------------------------------------- table
export function defaultTable(U) {
  return {
    type: 'table',
    rows: [
      ['หัวข้อ', 'ค่า A', 'ค่า B'],
      ['รายการ 1', '10', '20'],
      ['รายการ 2', '15', '25'],
      ['รายการ 3', '12', '30'],
    ],
    header: true,
    headerFill: '#7c5cff',
    headerColor: '#ffffff',
    fill: '#ffffff',
    stripe: '#f3f0ff',
    border: '#c9c3e6',
    color: '#1f2333',
    fontFamily: 'Sarabun',
    fontSize: Math.round(U * 0.032),
    cellWidth: Math.round(U * 0.22),
    align: 'center',
  };
}

export function buildTable(d) {
  const pad = d.fontSize * 0.5;
  const cols = Math.max(...d.rows.map((r) => r.length));
  const objs = [];
  let y = 0;
  d.rows.forEach((row, ri) => {
    const isHead = d.header && ri === 0;
    const texts = [];
    for (let ci = 0; ci < cols; ci++) {
      const t = new Textbox(String(row[ci] ?? ''), {
        width: d.cellWidth - pad * 2,
        fontSize: d.fontSize,
        fontFamily: d.fontFamily,
        fontWeight: isHead ? 'bold' : 'normal',
        fill: isHead ? d.headerColor : d.color,
        textAlign: d.align,
        splitByGrapheme: true,
      });
      texts.push(t);
    }
    const rowH = Math.max(d.fontSize * 1.3, ...texts.map((t) => t.height)) + pad * 2;
    texts.forEach((t, ci) => {
      const x = ci * d.cellWidth;
      const bg = isHead ? d.headerFill : (d.stripe && ri % 2 === (d.header ? 0 : 1) ? d.stripe : d.fill);
      objs.push(new Rect({ left: x, top: y, width: d.cellWidth, height: rowH, fill: bg || 'transparent', stroke: d.border, strokeWidth: 1.5, strokeUniform: true }));
      t.set({ left: x + pad, top: y + (rowH - t.height) / 2 });
      objs.push(t);
    });
    y += rowH;
  });
  return new Group(objs, { smart: { ...d }, name: 'ตาราง', objectCaching: true });
}

// ---------------------------------------------------------------- chart
export const CHART_TYPES = [
  ['bar', 'กราฟแท่ง'], ['hbar', 'กราฟแท่งแนวนอน'], ['line', 'กราฟเส้น'], ['area', 'กราฟพื้นที่'],
  ['pie', 'กราฟวงกลม'], ['donut', 'กราฟโดนัท'], ['progress', 'แถบความคืบหน้า (%)'], ['ring', 'วงแหวนความคืบหน้า (%)'], ['pictogram', 'ภาพสัญลักษณ์ (%)'],
];
const PERCENT_TYPES = ['progress', 'ring', 'pictogram'];

export function defaultChart(type, U) {
  if (PERCENT_TYPES.includes(type)) {
    return {
      type: 'chart', chart: type, title: type === 'pictogram' ? 'นักเรียนที่ผ่านเกณฑ์' : 'ความคืบหน้าโครงการ',
      labels: type === 'pictogram' ? ['ห้อง 1', 'ห้อง 2'] : ['ออกแบบ', 'พัฒนา', 'ทดสอบ'],
      values: type === 'pictogram' ? [70, 40] : [90, 65, 30],
      colors: CHART_COLORS, showValues: true,
      width: Math.round(U * 0.7), height: Math.round(U * (type === 'ring' ? 0.32 : 0.36)),
      fontFamily: 'Prompt', color: '#1f2333',
    };
  }
  return {
    type: 'chart',
    chart: type,
    title: type === 'pie' || type === 'donut' ? 'สัดส่วนผู้ตอบ' : 'ยอดขายรายเดือน',
    labels: ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.'],
    values: [12, 19, 8, 15, 22],
    colors: CHART_COLORS,
    showValues: true,
    width: Math.round(U * 0.7),
    height: Math.round(U * 0.45),
    fontFamily: 'Prompt',
    color: '#1f2333',
  };
}

function fmt(n) {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

export function buildChart(d) {
  const W = d.width, H = d.height;
  const fs = Math.max(10, Math.round(Math.min(W, H) * 0.055));
  const objs = [];
  const txt = (s, opts) => new FabricText(String(s), { fontSize: fs, fontFamily: d.fontFamily, fill: d.color, ...opts });
  const vals = d.values.map((v) => +v || 0);
  let top = 0;
  if (d.title) {
    const t = txt(d.title, { fontSize: fs * 1.35, fontWeight: 'bold', originX: 'center', left: W / 2, top: 0 });
    objs.push(t);
    top = t.height + fs * 0.6;
  }
  // invisible frame keeps the group's box stable
  objs.push(new Rect({ left: 0, top: 0, width: W, height: H, fill: 'transparent', strokeWidth: 0, selectable: false }));
  if (d.chart === 'hbar') {
    const max = Math.max(1, ...vals);
    const n = Math.max(1, vals.length);
    const labelW = Math.min(W * 0.3, fs * 6);
    const rowH = (H - top) / n;
    vals.forEach((v, i) => {
      const y = top + rowH * i;
      const bw = ((W - labelW - fs * 3) * Math.max(0, v)) / max;
      objs.push(txt(d.labels[i] ?? '', { fontSize: fs * 0.85, originX: 'right', originY: 'center', left: labelW - fs * 0.4, top: y + rowH / 2 }));
      objs.push(new Rect({ left: labelW, top: y + rowH * 0.18, width: Math.max(0.5, bw), height: rowH * 0.64, fill: d.colors[i % d.colors.length], rx: 4, ry: 4 }));
      if (d.showValues) objs.push(txt(fmt(v), { fontSize: fs * 0.85, fontWeight: 'bold', originY: 'center', left: labelW + bw + fs * 0.3, top: y + rowH / 2 }));
    });
  } else if (d.chart === 'progress') {
    const n = Math.max(1, vals.length);
    const rowH = (H - top) / n;
    vals.forEach((v, i) => {
      const p = Math.max(0, Math.min(100, v));
      const y = top + rowH * i;
      objs.push(txt(d.labels[i] ?? '', { fontSize: fs * 0.85, left: 0, top: y }));
      if (d.showValues) objs.push(txt(`${fmt(p)}%`, { fontSize: fs * 0.85, fontWeight: 'bold', originX: 'right', left: W, top: y }));
      const by = y + fs * 1.35, bh = Math.max(6, Math.min(rowH - fs * 1.6, fs * 0.9));
      objs.push(new Rect({ left: 0, top: by, width: W, height: bh, rx: bh / 2, ry: bh / 2, fill: 'rgba(127,127,127,0.18)' }));
      if (p > 0) objs.push(new Rect({ left: 0, top: by, width: Math.max(bh, (W * p) / 100), height: bh, rx: bh / 2, ry: bh / 2, fill: d.colors[i % d.colors.length] }));
    });
  } else if (d.chart === 'ring') {
    const n = Math.max(1, vals.length);
    const cw = W / n;
    const r = Math.min(cw * 0.42, (H - top - fs * 1.8) / 2);
    const sw = r * 0.22;
    vals.forEach((v, i) => {
      const p = Math.max(0, Math.min(100, v));
      const cx = cw * (i + 0.5), cy = top + r + sw / 2;
      objs.push(new Circle({ left: cx, top: cy, radius: r, originX: 'center', originY: 'center', fill: '', stroke: 'rgba(127,127,127,0.18)', strokeWidth: sw }));
      if (p > 0) {
        const a0 = -Math.PI / 2, a1 = a0 + (Math.PI * 2 * Math.min(p, 99.99)) / 100;
        const pt = (a) => `${cx + r * Math.cos(a)} ${cy + r * Math.sin(a)}`;
        objs.push(new Path(`M ${pt(a0)} A ${r} ${r} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${pt(a1)}`, { fill: '', stroke: d.colors[i % d.colors.length], strokeWidth: sw, strokeLineCap: 'round' }));
      }
      if (d.showValues) objs.push(txt(`${fmt(p)}%`, { fontSize: fs * 1.1, fontWeight: 'bold', originX: 'center', originY: 'center', left: cx, top: cy }));
      objs.push(txt(d.labels[i] ?? '', { fontSize: fs * 0.85, originX: 'center', left: cx, top: cy + r + sw / 2 + fs * 0.4 }));
    });
  } else if (d.chart === 'pictogram') {
    const n = Math.max(1, vals.length);
    const rowH = (H - top) / n;
    const labelW = Math.min(W * 0.25, fs * 5);
    const size = Math.min(rowH * 0.8, (W - labelW - fs * 3) / 10.5);
    const person = (x, y, s, fill) => [
      new Circle({ left: x + s * 0.5, top: y + s * 0.2, radius: s * 0.18, originX: 'center', originY: 'center', fill }),
      new Path(`M ${x + s * 0.2} ${y + s} L ${x + s * 0.2} ${y + s * 0.6} Q ${x + s * 0.2} ${y + s * 0.42} ${x + s * 0.38} ${y + s * 0.42} L ${x + s * 0.62} ${y + s * 0.42} Q ${x + s * 0.8} ${y + s * 0.42} ${x + s * 0.8} ${y + s * 0.6} L ${x + s * 0.8} ${y + s} Z`, { fill }),
    ];
    vals.forEach((v, i) => {
      const p = Math.max(0, Math.min(100, v));
      const y = top + rowH * i + (rowH - size) / 2;
      objs.push(txt(d.labels[i] ?? '', { fontSize: fs * 0.85, originY: 'center', left: 0, top: y + size / 2 }));
      const filled = Math.round(p / 10);
      for (let k = 0; k < 10; k++) objs.push(...person(labelW + k * size * 1.05, y, size, k < filled ? d.colors[i % d.colors.length] : 'rgba(127,127,127,0.25)'));
      if (d.showValues) objs.push(txt(`${fmt(p)}%`, { fontSize: fs * 0.85, fontWeight: 'bold', originY: 'center', left: labelW + 10.5 * size * 1.05, top: y + size / 2 }));
    });
  } else if (d.chart === 'bar' || d.chart === 'line' || d.chart === 'area') {
    const max = Math.max(1, ...vals);
    const axisL = fs * 2.6, axisB = H - fs * 2;
    const plotH = axisB - top - fs * 1.2;
    const plotW = W - axisL;
    const n = Math.max(1, vals.length);
    const step = plotW / n;
    for (let g = 0; g <= 4; g++) {
      const yv = axisB - (plotH * g) / 4;
      objs.push(new Line([axisL, yv, W, yv], { stroke: g === 0 ? d.color : 'rgba(127,127,127,0.25)', strokeWidth: g === 0 ? 2 : 1 }));
      objs.push(txt(fmt((max * g) / 4), { fontSize: fs * 0.8, originX: 'right', originY: 'center', left: axisL - fs * 0.4, top: yv, fill: d.color, opacity: 0.7 }));
    }
    const pts = [];
    vals.forEach((v, i) => {
      const cx = axisL + step * (i + 0.5);
      const h = (plotH * v) / max;
      if (d.chart === 'bar') {
        const bw = step * 0.62;
        objs.push(new Rect({ left: cx - bw / 2, top: axisB - h, width: bw, height: Math.max(0.5, h), fill: d.colors[i % d.colors.length], rx: Math.min(6, bw * 0.1), ry: Math.min(6, bw * 0.1) }));
      }
      pts.push({ x: cx, y: axisB - h });
      if (d.showValues) objs.push(txt(fmt(v), { fontSize: fs * 0.85, fontWeight: 'bold', originX: 'center', originY: 'bottom', left: cx, top: axisB - h - fs * (d.chart === 'line' ? 0.6 : 0.25) }));
      objs.push(txt(d.labels[i] ?? '', { fontSize: fs * 0.85, originX: 'center', left: cx, top: axisB + fs * 0.4 }));
    });
    if (d.chart === 'area' && pts.length) {
      const poly = [{ x: pts[0].x, y: axisB }, ...pts, { x: pts[pts.length - 1].x, y: axisB }];
      objs.push(new Polyline(poly, { fill: d.colors[0], opacity: 0.3, stroke: '', objectCaching: false }));
    }
    if ((d.chart === 'line' || d.chart === 'area') && pts.length) {
      objs.push(new Polyline(pts, { fill: '', stroke: d.colors[0], strokeWidth: Math.max(3, fs * 0.22), strokeLineJoin: 'round', strokeLineCap: 'round', objectCaching: false }));
      pts.forEach((p) => objs.push(new Circle({ left: p.x, top: p.y, radius: fs * 0.32, originX: 'center', originY: 'center', fill: '#ffffff', stroke: d.colors[0], strokeWidth: fs * 0.15 })));
    }
  } else {
    const total = vals.reduce((a, b) => a + Math.max(0, b), 0) || 1;
    const legendW = W * 0.38;
    const r = Math.min((W - legendW) / 2, (H - top) / 2) * 0.92;
    const cx = (W - legendW) / 2, cy = top + (H - top) / 2;
    let a0 = -Math.PI / 2;
    vals.forEach((v, i) => {
      const a1 = a0 + (Math.max(0, v) / total) * Math.PI * 2;
      const large = a1 - a0 > Math.PI ? 1 : 0;
      const p = (a) => `${cx + r * Math.cos(a)} ${cy + r * Math.sin(a)}`;
      let path;
      if (a1 - a0 >= Math.PI * 2 - 1e-6) path = `M ${cx - r} ${cy} A ${r} ${r} 0 1 1 ${cx + r} ${cy} A ${r} ${r} 0 1 1 ${cx - r} ${cy} Z`;
      else path = `M ${cx} ${cy} L ${p(a0)} A ${r} ${r} 0 ${large} 1 ${p(a1)} Z`;
      if (v > 0) objs.push(new Path(path, { fill: d.colors[i % d.colors.length], stroke: '#ffffff', strokeWidth: 2 }));
      if (d.showValues && v > 0) {
        const am = (a0 + a1) / 2, rr = d.chart === 'donut' ? r * 0.78 : r * 0.62;
        objs.push(txt(`${Math.round((v / total) * 100)}%`, { fontSize: fs * 0.85, fontWeight: 'bold', fill: '#ffffff', originX: 'center', originY: 'center', left: cx + rr * Math.cos(am), top: cy + rr * Math.sin(am) }));
      }
      a0 = a1;
    });
    if (d.chart === 'donut') objs.push(new Circle({ left: cx, top: cy, radius: r * 0.55, originX: 'center', originY: 'center', fill: '#ffffff' }));
    vals.forEach((v, i) => {
      const ly = top + fs * 0.5 + i * fs * 1.6;
      objs.push(new Rect({ left: W - legendW + fs, top: ly, width: fs, height: fs, rx: 3, ry: 3, fill: d.colors[i % d.colors.length] }));
      objs.push(txt(`${d.labels[i] ?? ''} (${fmt(v)})`, { fontSize: fs * 0.85, left: W - legendW + fs * 2.5, top: ly - fs * 0.05 }));
    });
  }
  return new Group(objs, { smart: { ...d }, name: 'กราฟ' });
}

// ---------------------------------------------------------------- QR
export function defaultQR(U) {
  return { type: 'qr', text: 'https://example.com', color: '#000000', bg: '#ffffff', size: Math.round(U * 0.35) };
}

export function buildQR(d) {
  const qr = qrcode(0, 'M');
  qr.addData(unescape(encodeURIComponent(d.text || ' ')));
  qr.make();
  const n = qr.getModuleCount();
  const quiet = 2;
  const cell = d.size / (n + quiet * 2);
  let p = '';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    if (qr.isDark(r, c)) {
      const x = (c + quiet) * cell, y = (r + quiet) * cell;
      p += `M${x} ${y}h${cell}v${cell}h${-cell}z`;
    }
  }
  const bg = new Rect({ left: 0, top: 0, width: d.size, height: d.size, fill: d.bg || 'transparent' });
  const dots = new Path(p, { fill: d.color, left: quiet * cell, top: quiet * cell });
  return new Group([bg, dots], { smart: { ...d }, name: 'QR Code' });
}

// ---------------------------------------------------------------- equation
let mj = null;
async function mathjax() {
  if (mj) return mj;
  const [{ mathjax }, { TeX }, { SVG }, { liteAdaptor }, { RegisterHTMLHandler }] = await Promise.all([
    import('mathjax-full/js/mathjax.js'),
    import('mathjax-full/js/input/tex.js'),
    import('mathjax-full/js/output/svg.js'),
    import('mathjax-full/js/adaptors/liteAdaptor.js'),
    import('mathjax-full/js/handlers/html.js'),
  ]);
  await Promise.all([import('mathjax-full/js/input/tex/base/BaseConfiguration.js'), import('mathjax-full/js/input/tex/ams/AmsConfiguration.js')]);
  const adaptor = liteAdaptor();
  RegisterHTMLHandler(adaptor);
  const doc = mathjax.document('', { InputJax: new TeX({ packages: ['base', 'ams'] }), OutputJax: new SVG({ fontCache: 'none' }) });
  mj = { adaptor, doc };
  return mj;
}

/** Render LaTeX to an SVG string (throws on TeX errors). */
export async function latexToSVG(latex, color = '#1f2333') {
  const { adaptor, doc } = await mathjax();
  const node = doc.convert(latex, { display: true });
  let svg = adaptor.innerHTML(node);
  if (/data-mjx-error|merror/.test(svg)) {
    const m = svg.match(/data-mjx-error="([^"]*)"/);
    throw new Error(m ? m[1] : 'สมการไม่ถูกต้อง');
  }
  svg = svg.replace(/currentColor/g, color);
  return svg;
}

export function defaultEquation(U) {
  return { type: 'equation', latex: 'x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}', color: '#1f2333', height: Math.round(U * 0.12) };
}

export async function buildEquation(d) {
  let svg = await latexToSVG(d.latex, d.color);
  // drop ex-based width/height; rely on viewBox
  svg = svg.replace(/<svg([^>]*?)\swidth="[^"]*"/, '<svg$1').replace(/<svg([^>]*?)\sheight="[^"]*"/, '<svg$1').replace(/<svg([^>]*?)\sstyle="[^"]*"/, '<svg$1');
  const vb = svg.match(/viewBox="([-\d.\s]+)"/)[1].split(/\s+/).map(Number);
  svg = svg.replace('<svg', `<svg width="${vb[2]}" height="${vb[3]}"`);
  const { objects, options } = await loadSVGFromString(svg);
  const list = objects.filter(Boolean);
  const g = util.groupSVGElements(list, options);
  const grp = g.type === 'group' ? g : new Group([g]);
  const k = d.height / grp.height;
  grp.set({ scaleX: k, scaleY: k, smart: { ...d }, name: 'สมการ' });
  return grp;
}

// ---------------------------------------------------------------- image placeholders
let placeholderURL = null;
export function placeholderImage() {
  if (placeholderURL) return placeholderURL;
  const c = document.createElement('canvas');
  c.width = 600;
  c.height = 600;
  const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 600, 600);
  g.addColorStop(0, '#e6e2f5');
  g.addColorStop(1, '#d3cdea');
  x.fillStyle = g;
  x.fillRect(0, 0, 600, 600);
  x.strokeStyle = '#8f86b8';
  x.lineWidth = 14;
  x.lineJoin = 'round';
  x.strokeRect(210, 220, 180, 150);
  x.beginPath();
  x.moveTo(220, 360); x.lineTo(285, 290); x.lineTo(330, 335); x.lineTo(350, 315); x.lineTo(385, 360);
  x.stroke();
  x.beginPath();
  x.arc(340, 262, 16, 0, Math.PI * 2);
  x.fillStyle = '#8f86b8';
  x.fill();
  x.font = 'bold 34px sans-serif';
  x.textAlign = 'center';
  x.fillText('ลากรูปมาวาง', 300, 440);
  placeholderURL = c.toDataURL('image/png');
  return placeholderURL;
}

export const FRAMES = [
  ['สี่เหลี่ยม', 'none', 1], ['มุมมน', 'rounded', 1], ['วงกลม', 'circle', 1],
  ['ดาว', 'star', 1], ['หัวใจ', 'heart', 1], ['หกเหลี่ยม', 'hexagon', 1],
  ['แนวนอน 16:9', 'rounded', 16 / 9], ['แนวตั้ง 3:4', 'rounded', 3 / 4],
];

// grids: list of [x, y, w, h] fractions of the page (with margins handled by caller)
export const GRIDS = [
  ['2 ช่อง ซ้าย-ขวา', [[0, 0, 0.5, 1], [0.5, 0, 0.5, 1]]],
  ['2 ช่อง บน-ล่าง', [[0, 0, 1, 0.5], [0, 0.5, 1, 0.5]]],
  ['3 ช่อง', [[0, 0, 0.6, 1], [0.6, 0, 0.4, 0.5], [0.6, 0.5, 0.4, 0.5]]],
  ['4 ช่อง', [[0, 0, 0.5, 0.5], [0.5, 0, 0.5, 0.5], [0, 0.5, 0.5, 0.5], [0.5, 0.5, 0.5, 0.5]]],
  ['6 ช่อง', [0, 1, 2].flatMap((c) => [0, 1].map((r) => [c / 3, r / 2, 1 / 3, 0.5]))],
  ['ช่องใหญ่ + 3', [[0, 0, 1, 0.62], [0, 0.62, 1 / 3, 0.38], [1 / 3, 0.62, 1 / 3, 0.38], [2 / 3, 0.62, 1 / 3, 0.38]]],
];

/** Parse pasted / uploaded CSV or TSV text into rows of cells. */
export function parseDelimited(text) {
  const lines = String(text || '').replace(/\r/g, '').split('\n').filter((l) => l.trim() !== '');
  if (!lines.length) return [];
  const sep = lines[0].includes('\t') ? '\t' : lines[0].includes(';') && !lines[0].includes(',') ? ';' : ',';
  return lines.map((line) => {
    const out = [];
    let cur = '', q = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { if (q && line[i + 1] === '"') { cur += '"'; i++; } else q = !q; }
      else if (ch === sep && !q) { out.push(cur.trim()); cur = ''; }
      else cur += ch;
    }
    out.push(cur.trim());
    return out;
  });
}

/** Rows -> { labels, values } (first column = label, second = number; header row skipped). */
export function rowsToSeries(rows) {
  const num = (v) => parseFloat(String(v).replace(/[,%\s]/g, ''));
  const body = rows.length && rows[0].length > 1 && isNaN(num(rows[0][1])) ? rows.slice(1) : rows;
  const labels = [], values = [];
  for (const r of body) {
    if (r.length < 2 || isNaN(num(r[1]))) continue;
    labels.push(r[0]);
    values.push(num(r[1]));
  }
  return { labels, values };
}

// ---------------------------------------------------------------- icons
export async function buildIcon(d) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${d.color}" stroke-width="${d.weight || 1.8}" stroke-linecap="round" stroke-linejoin="round">${ICON_PATHS[d.name] || ''}</svg>`;
  const { objects, options } = await loadSVGFromString(svg);
  const list = objects.filter(Boolean);
  list.forEach((o) => { if (!o.fill || o.fill === 'none') o.set('fill', ''); });
  const frame = new Rect({ left: 0, top: 0, width: 24, height: 24, fill: 'transparent', strokeWidth: 0 });
  const g = new Group([frame, ...list], { smart: { ...d }, name: 'ไอคอน' });
  const k = d.size / 24;
  g.set({ scaleX: k, scaleY: k });
  return g;
}

// ---------------------------------------------------------------- mockups
export const MOCKUPS = [
  ['phone', '📱', 'มือถือ'], ['tablet', '📲', 'แท็บเล็ต'], ['laptop', '💻', 'แล็ปท็อป'],
  ['monitor', '🖥️', 'จอคอมพิวเตอร์'], ['polaroid', '🖼️', 'รูปโพลารอยด์'], ['frame', '🪟', 'กรอบรูปติดผนัง'],
];

// device geometry in base units: body parts + the screen rectangle the picture fills
function mockupParts(device) {
  const dark = '#1b1d24';
  switch (device) {
    case 'phone': return { w: 300, h: 600, screen: [16, 56, 268, 488, 10], parts: [
      new Rect({ left: 0, top: 0, width: 300, height: 600, rx: 42, ry: 42, fill: dark }),
      new Rect({ left: 115, top: 24, width: 70, height: 10, rx: 5, ry: 5, fill: '#3a3d48' }),
      new Circle({ left: 150, top: 572, radius: 11, originX: 'center', originY: 'center', fill: '', stroke: '#3a3d48', strokeWidth: 3 })] };
    case 'tablet': return { w: 600, h: 800, screen: [36, 56, 528, 688, 6], parts: [
      new Rect({ left: 0, top: 0, width: 600, height: 800, rx: 40, ry: 40, fill: dark }),
      new Circle({ left: 300, top: 28, radius: 6, originX: 'center', originY: 'center', fill: '#3a3d48' })] };
    case 'laptop': return { w: 900, h: 560, screen: [74, 26, 752, 470, 2], parts: [
      new Rect({ left: 50, top: 0, width: 800, height: 520, rx: 20, ry: 20, fill: dark }),
      new Polygon([{ x: 0, y: 520 }, { x: 900, y: 520 }, { x: 870, y: 560 }, { x: 30, y: 560 }], { fill: '#c9ccd6' }),
      new Rect({ left: 390, top: 520, width: 120, height: 10, rx: 4, ry: 4, fill: '#a9adba' })] };
    case 'monitor': return { w: 800, h: 640, screen: [22, 22, 756, 446, 2], parts: [
      new Rect({ left: 0, top: 0, width: 800, height: 490, rx: 16, ry: 16, fill: dark }),
      new Polygon([{ x: 350, y: 490 }, { x: 450, y: 490 }, { x: 470, y: 610 }, { x: 330, y: 610 }], { fill: '#a9adba' }),
      new Rect({ left: 250, top: 605, width: 300, height: 35, rx: 12, ry: 12, fill: '#c9ccd6' })] };
    case 'polaroid': return { w: 400, h: 480, screen: [24, 24, 352, 352, 0], parts: [
      new Rect({ left: 0, top: 0, width: 400, height: 480, fill: '#ffffff', shadow: new Shadow({ color: 'rgba(0,0,0,0.25)', blur: 18, offsetX: 0, offsetY: 8 }) })] };
    default: return { w: 520, h: 420, screen: [56, 56, 408, 308, 0], parts: [
      new Rect({ left: 0, top: 0, width: 520, height: 420, fill: '#8b5a2b', shadow: new Shadow({ color: 'rgba(0,0,0,0.3)', blur: 16, offsetX: 0, offsetY: 8 }) }),
      new Rect({ left: 26, top: 26, width: 468, height: 368, fill: '#f5f1e8' })] };
  }
}

export function defaultMockup(device, U, src) {
  return { type: 'mockup', device, src, width: Math.round(U * (device === 'phone' ? 0.3 : device === 'tablet' ? 0.42 : 0.6)) };
}

export async function buildMockup(d) {
  const g = mockupParts(d.device);
  const [sx, sy, sw, sh, r] = g.screen;
  const img = await FabricImage.fromURL(d.src, { crossOrigin: 'anonymous' });
  const { width: nw, height: nh } = img.getOriginalSize();
  const k = Math.max(sw / nw, sh / nh);
  const cw = sw / k, ch = sh / k;
  img.set({ cropX: (nw - cw) / 2, cropY: (nh - ch) / 2, width: cw, height: ch, scaleX: k, scaleY: k, left: sx, top: sy });
  if (r) img.set('clipPath', new Rect({ width: cw, height: ch, rx: r / k, ry: r / k, originX: 'center', originY: 'center', left: 0, top: 0 }));
  const group = new Group([...g.parts, img], { smart: { ...d }, name: 'ม็อกอัป' });
  const s = d.width / g.w;
  group.set({ scaleX: s, scaleY: s });
  return group;
}
