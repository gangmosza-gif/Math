// "Smart" elements rebuilt from data: tables, charts, QR codes, equations, image placeholders.
// Each returns a fabric object carrying `smart = { type, ...data }` so it can be edited later.
import { Group, Rect, Textbox, Line, Polyline, Circle, Path, FabricText, loadSVGFromString, util } from 'fabric';
import qrcode from 'qrcode-generator';

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
export function defaultChart(type, U) {
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
  if (d.chart === 'bar' || d.chart === 'line') {
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
    if (d.chart === 'line' && pts.length) {
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
