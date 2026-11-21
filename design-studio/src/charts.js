// Chart library: 32 chart types built from data as fabric groups (editable later from `smart` data).
// Data model: { labels: [...], values: [...] (first series), series?: [{ name, values }] (all series) }
import { Group, Rect, Line, Polyline, Polygon, Circle, Path, FabricText } from 'fabric';

export const CHART_COLORS = ['#7c5cff', '#ff5fa2', '#22c3e6', '#ffb020', '#2ecc71', '#ff6b4a', '#4f8cff', '#a0a8c0'];

// [key, label, group, multi-series?]
export const CHART_TYPES = [
  ['bar', 'กราฟแท่ง', 'แท่ง'], ['bar-group', 'กราฟแท่งกลุ่ม (หลายชุด)', 'แท่ง', 1], ['bar-stack', 'กราฟแท่งซ้อน', 'แท่ง', 1], ['bar-stack100', 'กราฟแท่งซ้อน 100%', 'แท่ง', 1],
  ['hbar', 'กราฟแท่งแนวนอน', 'แท่ง'], ['hbar-group', 'แท่งแนวนอนกลุ่ม', 'แท่ง', 1], ['hbar-stack', 'แท่งแนวนอนซ้อน', 'แท่ง', 1],
  ['waterfall', 'กราฟน้ำตก', 'แท่ง'], ['lollipop', 'กราฟอมยิ้ม', 'แท่ง'],
  ['line', 'กราฟเส้น', 'เส้นและพื้นที่'], ['line-multi', 'กราฟเส้นหลายชุด', 'เส้นและพื้นที่', 1], ['line-smooth', 'กราฟเส้นโค้ง', 'เส้นและพื้นที่', 1], ['step', 'กราฟขั้นบันได', 'เส้นและพื้นที่', 1],
  ['area', 'กราฟพื้นที่', 'เส้นและพื้นที่'], ['area-stack', 'กราฟพื้นที่ซ้อน', 'เส้นและพื้นที่', 1],
  ['pie', 'กราฟวงกลม', 'วงกลม'], ['donut', 'กราฟโดนัท', 'วงกลม'], ['halfdonut', 'ครึ่งวงกลม', 'วงกลม'], ['polar', 'กราฟกลีบ (Polar)', 'วงกลม'], ['radial', 'วงแหวนซ้อน', 'วงกลม'],
  ['radar', 'กราฟเรดาร์', 'อื่น ๆ', 1], ['scatter', 'กราฟกระจาย', 'อื่น ๆ', 1], ['bubble', 'กราฟฟอง', 'อื่น ๆ', 1], ['heatmap', 'แผนภาพความร้อน', 'อื่น ๆ', 1],
  ['funnel', 'กราฟกรวย', 'อื่น ๆ'], ['treemap', 'แผนผังต้นไม้ (Treemap)', 'อื่น ๆ'], ['dotplot', 'กราฟจุด', 'อื่น ๆ'],
  ['progress', 'แถบความคืบหน้า (%)', 'อินโฟกราฟิก'], ['ring', 'วงแหวนความคืบหน้า (%)', 'อินโฟกราฟิก'], ['pictogram', 'ภาพสัญลักษณ์ (%)', 'อินโฟกราฟิก'],
  ['gauge', 'มาตรวัด (%)', 'อินโฟกราฟิก'], ['stat', 'การ์ดตัวเลข (KPI)', 'อินโฟกราฟิก'],
];
export const MULTI_TYPES = CHART_TYPES.filter((t) => t[3]).map((t) => t[0]);
const PERCENT_TYPES = ['progress', 'ring', 'pictogram', 'gauge', 'radial'];

export function defaultChart(type, U) {
  const base = { type: 'chart', chart: type, colors: CHART_COLORS, showValues: true, fontFamily: 'Prompt', color: '#1f2333', width: Math.round(U * 0.7), height: Math.round(U * 0.45) };
  if (PERCENT_TYPES.includes(type)) {
    const d = { ...base, title: type === 'pictogram' ? 'นักเรียนที่ผ่านเกณฑ์' : 'ความคืบหน้าโครงการ', labels: type === 'pictogram' ? ['ห้อง 1', 'ห้อง 2'] : ['ออกแบบ', 'พัฒนา', 'ทดสอบ'], values: type === 'pictogram' ? [70, 40] : [90, 65, 30] };
    if (type === 'gauge') Object.assign(d, { title: 'คะแนนความพึงพอใจ', labels: ['คะแนน'], values: [78], height: Math.round(U * 0.4) });
    if (type === 'ring') d.height = Math.round(U * 0.32);
    return d;
  }
  if (type === 'stat') return { ...base, title: 'ผลงานไตรมาสนี้', labels: ['ลูกค้าใหม่', 'ยอดขาย (ล้าน)', 'ความพึงพอใจ %'], values: [1250, 4.8, 96], height: Math.round(U * 0.3) };
  if (type === 'scatter' || type === 'bubble') {
    return { ...base, title: type === 'bubble' ? 'ขนาดร้านกับยอดขาย' : 'ชั่วโมงอ่านหนังสือกับคะแนน', labels: ['1', '2', '3', '4', '5', '6', '7', '8'], values: [42, 51, 55, 63, 67, 74, 79, 88], series: [{ name: type === 'bubble' ? 'ยอดขาย' : 'คะแนน', values: [42, 51, 55, 63, 67, 74, 79, 88] }, { name: type === 'bubble' ? 'ขนาดร้าน' : 'ห้อง 2', values: type === 'bubble' ? [3, 8, 5, 12, 7, 15, 9, 20] : [38, 45, 58, 57, 70, 69, 82, 85] }] };
  }
  if (type === 'heatmap') {
    const labels = ['จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.'];
    const series = ['เช้า', 'บ่าย', 'เย็น'].map((n, i) => ({ name: n, values: labels.map((_, j) => ((i * 7 + j * 13) % 20) + 5) }));
    return { ...base, title: 'จำนวนผู้ใช้ห้องสมุด', labels, values: series[0].values, series };
  }
  if (type === 'funnel') return { ...base, title: 'เส้นทางลูกค้า', labels: ['เห็นโฆษณา', 'เข้าเว็บไซต์', 'ใส่ตะกร้า', 'สั่งซื้อ'], values: [1000, 620, 310, 140] };
  if (type === 'waterfall') return { ...base, title: 'งบประมาณคงเหลือ', labels: ['เริ่มต้น', 'รายรับ', 'ค่าเช่า', 'ค่าจ้าง', 'อื่น ๆ'], values: [100, 45, -30, -40, -10] };
  if (type === 'treemap') return { ...base, title: 'สัดส่วนงบประมาณ', labels: ['การศึกษา', 'สุขภาพ', 'กีฬา', 'ศิลปะ', 'อื่น ๆ'], values: [40, 25, 15, 12, 8] };
  if (type === 'radar') {
    const labels = ['ภาษา', 'คณิต', 'วิทย์', 'สังคม', 'ศิลปะ', 'กีฬา'];
    const series = [{ name: 'นักเรียน A', values: [80, 65, 70, 90, 60, 75] }, { name: 'นักเรียน B', values: [60, 85, 80, 55, 75, 70] }];
    return { ...base, title: 'ผลการเรียนรายวิชา', labels, values: series[0].values, series, height: Math.round(U * 0.55) };
  }
  const d = { ...base, title: type === 'pie' || type === 'donut' || type === 'halfdonut' || type === 'polar' ? 'สัดส่วนผู้ตอบ' : 'ยอดขายรายเดือน', labels: ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.'], values: [12, 19, 8, 15, 22] };
  if (MULTI_TYPES.includes(type)) d.series = [{ name: 'ปี 2568', values: [12, 19, 8, 15, 22] }, { name: 'ปี 2569', values: [9, 14, 13, 18, 16] }];
  return d;
}

export function seriesOf(d) {
  if (d.series && d.series.length) return d.series.map((s, i) => ({ name: s.name || `ชุดที่ ${i + 1}`, values: d.labels.map((_, j) => +s.values[j] || 0) }));
  return [{ name: d.title || 'ข้อมูล', values: d.labels.map((_, j) => +d.values[j] || 0) }];
}

/** A "nice" axis: max rounded up to 1/2/2.5/5 × 10^k, with the step between 5 ticks. */
export function niceScale(min, max, ticks = 5) {
  if (max <= min) max = min + 1;
  const raw = (max - min) / ticks;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) || 10 * mag;
  return { min: Math.floor(min / step) * step, max: Math.ceil(max / step) * step, step };
}

/** Make a text label fit `maxW`: shrink a little (to 80%), then shorten it with '…'. The full text stays in the data. */
function fitText(t, maxW) {
  if (!(maxW > 0) || t.width * (t.scaleX || 1) <= maxW) return t;
  const k = Math.max(0.8, maxW / t.width);
  t.set({ scaleX: k, scaleY: k });
  if (t.width * k <= maxW) return t;
  const chars = [...t.text];
  let lo = 0, hi = chars.length;
  while (lo < hi) { // longest prefix that fits with the ellipsis
    const mid = Math.ceil((lo + hi) / 2);
    t.set('text', chars.slice(0, mid).join('') + '…');
    if (t.width * k <= maxW) lo = mid; else hi = mid - 1;
  }
  t.set('text', chars.slice(0, Math.max(1, lo)).join('') + '…');
  return t;
}

const compact = typeof Intl !== 'undefined' ? new Intl.NumberFormat('th-TH', { notation: 'compact', maximumFractionDigits: 1 }) : null;
/** Axis tick: short form for big numbers (3 พันล้าน) so the axis never widens the chart. */
const fmtAxis = (n) => (compact && Math.abs(n) >= 1e6 ? compact.format(n) : fmt(n));
const fmt = (n) => (typeof n === 'string' ? n : Math.abs(n) >= 1000 ? n.toLocaleString('en-US') : Number.isInteger(n) ? String(n) : (+n).toFixed(1));

export function buildChart(d) {
  // no data at all: draw an empty placeholder category instead of invalid geometry
  if (!d.labels || !d.labels.length) d = { ...d, labels: ['—'], values: [0], series: d.series && d.series.length ? d.series.map((x) => ({ ...x, values: [0] })) : d.series };
  const W = d.width, H = d.height;
  const fs = Math.max(10, Math.round(Math.min(W, H) * 0.055));
  const col = (i) => d.colors[i % d.colors.length];
  const objs = [];
  const txt = (s, opts) => new FabricText(String(s), { fontSize: fs, fontFamily: d.fontFamily, fill: d.color, ...opts });
  const series = seriesOf(d);
  const vals = series[0].values;
  const multi = MULTI_TYPES.includes(d.chart) && series.length > 1;
  let top = 0;
  if (d.title) {
    const t = txt(d.title, { fontSize: fs * 1.35, fontWeight: 'bold', originX: 'center', left: W / 2, top: 0 });
    objs.push(t);
    top = t.height + fs * 0.6;
  }
  objs.push(new Rect({ left: 0, top: 0, width: W, height: H, fill: 'transparent', strokeWidth: 0, selectable: false }));
  // legend for multi-series charts
  if (multi && !['scatter', 'bubble', 'heatmap'].includes(d.chart) || d.chart === 'scatter' && series.length > 1) {
    let x = 0;
    const items = series.map((s, i) => { const t = txt(s.name, { fontSize: fs * 0.8, left: 0, top }); return { t, i, w: fs * 1.2 + t.width + fs }; });
    const total = items.reduce((a, b) => a + b.w, 0);
    x = (W - total) / 2;
    for (const it of items) {
      objs.push(new Rect({ left: x, top: top + fs * 0.15, width: fs * 0.8, height: fs * 0.8, rx: 3, ry: 3, fill: col(it.i) }));
      it.t.set({ left: x + fs * 1.1 });
      objs.push(it.t);
      x += it.w;
    }
    top += fs * 1.6;
  }
  const area = { x: 0, y: top, w: W, h: H - top };
  const kind = d.chart;
  if (['bar', 'bar-group', 'bar-stack', 'bar-stack100', 'line', 'line-multi', 'line-smooth', 'step', 'area', 'area-stack', 'waterfall', 'lollipop'].includes(kind)) cartesian(objs, d, series, area, fs, txt, col, 'v');
  else if (['hbar', 'hbar-group', 'hbar-stack', 'dotplot'].includes(kind)) cartesian(objs, d, series, area, fs, txt, col, 'h');
  else if (['pie', 'donut', 'halfdonut'].includes(kind)) pie(objs, d, vals, area, fs, txt, col);
  else if (kind === 'polar') polar(objs, d, vals, area, fs, txt, col);
  else if (kind === 'radial') radial(objs, d, vals, area, fs, txt, col);
  else if (kind === 'radar') radar(objs, d, series, area, fs, txt, col);
  else if (kind === 'scatter' || kind === 'bubble') scatter(objs, d, series, area, fs, txt, col);
  else if (kind === 'heatmap') heatmap(objs, d, series, area, fs, txt, col);
  else if (kind === 'funnel') funnel(objs, d, vals, area, fs, txt, col);
  else if (kind === 'treemap') treemap(objs, d, vals, area, fs, txt, col);
  else if (kind === 'gauge') gauge(objs, d, vals, area, fs, txt, col);
  else if (kind === 'stat') stat(objs, d, vals, area, fs, txt, col);
  else if (kind === 'progress') progress(objs, d, vals, area, fs, txt, col);
  else if (kind === 'ring') rings(objs, d, vals, area, fs, txt, col);
  else if (kind === 'pictogram') pictogram(objs, d, vals, area, fs, txt, col);
  return new Group(objs, { smart: { ...d }, name: 'กราฟ' });
}

// ---------------------------------------------------------------- cartesian (bars, lines, areas)
function cartesian(objs, d, series, area, fs, txt, col, dir) {
  const kind = d.chart;
  const n = Math.max(1, d.labels.length);
  const stacked = kind.includes('stack');
  const pct = kind === 'bar-stack100';
  let lo = 0, hi = 1;
  if (kind === 'waterfall') {
    let run = 0;
    series[0].values.forEach((v, i) => { const a = i === 0 ? 0 : run; run = i === 0 ? v : run + v; lo = Math.min(lo, a, run); hi = Math.max(hi, a, run); });
  } else if (stacked) {
    for (let j = 0; j < n; j++) { const sum = series.reduce((a, s) => a + Math.max(0, s.values[j]), 0); hi = Math.max(hi, pct ? 100 : sum); }
  } else {
    const all = series.flatMap((s) => s.values);
    hi = Math.max(1, ...all);
    lo = Math.min(0, ...all);
  }
  const sc = pct ? { min: 0, max: 100, step: 20 } : niceScale(lo, hi);
  const vertical = dir === 'v';
  const labelW = vertical ? fs * 2.8 : Math.min(area.w * 0.3, fs * 6);
  const plot = vertical ? { x: area.x + labelW, y: area.y + fs * 0.4, w: area.w - labelW, h: area.h - fs * 2.2 } : { x: area.x + labelW, y: area.y, w: area.w - labelW - fs * 2.5, h: area.h - fs * 1.6 };
  const pos = (v) => (vertical ? plot.y + plot.h - ((v - sc.min) / (sc.max - sc.min)) * plot.h : plot.x + ((v - sc.min) / (sc.max - sc.min)) * plot.w);
  // grid + value labels
  for (let v = sc.min; v <= sc.max + 1e-9; v += sc.step) {
    const p = pos(v);
    const zero = Math.abs(v) < 1e-9;
    if (vertical) {
      objs.push(new Line([plot.x, p, plot.x + plot.w, p], { stroke: zero ? d.color : 'rgba(127,127,127,0.25)', strokeWidth: zero ? 2 : 1 }));
      objs.push(txt(fmtAxis(+v.toFixed(6)) + (pct ? '%' : ''), { fontSize: fs * 0.75, originX: 'right', originY: 'center', left: plot.x - fs * 0.4, top: p, opacity: 0.7 }));
    } else {
      objs.push(new Line([p, plot.y, p, plot.y + plot.h], { stroke: zero ? d.color : 'rgba(127,127,127,0.25)', strokeWidth: zero ? 2 : 1 }));
      objs.push(txt(fmtAxis(+v.toFixed(6)) + (pct ? '%' : ''), { fontSize: fs * 0.7, originX: 'center', left: p, top: plot.y + plot.h + fs * 0.3, opacity: 0.7 }));
    }
  }
  const band = (vertical ? plot.w : plot.h) / n;
  const center = (j) => (vertical ? plot.x : plot.y) + band * (j + 0.5);
  d.labels.forEach((l, j) => {
    if (vertical) objs.push(fitText(txt(l, { fontSize: fs * 0.8, originX: 'center', left: center(j), top: plot.y + plot.h + fs * 0.4 }), band * 0.96));
    else objs.push(fitText(txt(l, { fontSize: fs * 0.8, originX: 'right', originY: 'center', left: plot.x - fs * 0.4, top: center(j) }), labelW - fs * 0.5));
  });
  const valueLabel = (v, x, y, opts = {}) => { if (d.showValues) objs.push(txt(fmt(v), { fontSize: fs * 0.75, fontWeight: 'bold', ...opts, left: x, top: y })); };
  const rect = (a, b, c, e, fill) => {
    // a..b along value axis, c = band centre, e = thickness
    const p1 = pos(a), p2 = pos(b);
    if (vertical) objs.push(new Rect({ left: c - e / 2, top: Math.min(p1, p2), width: e, height: Math.max(0.5, Math.abs(p2 - p1)), fill, rx: Math.min(5, e * 0.1), ry: Math.min(5, e * 0.1) }));
    else objs.push(new Rect({ left: Math.min(p1, p2), top: c - e / 2, width: Math.max(0.5, Math.abs(p2 - p1)), height: e, fill, rx: Math.min(5, e * 0.1), ry: Math.min(5, e * 0.1) }));
  };
  if (kind === 'bar' || kind === 'hbar') {
    series[0].values.forEach((v, j) => {
      rect(0, v, center(j), band * 0.62, col(j));
      if (vertical) valueLabel(v, center(j), pos(Math.max(0, v)) - fs * 0.25, { originX: 'center', originY: 'bottom' });
      else valueLabel(v, pos(Math.max(0, v)) + fs * 0.3, center(j), { originY: 'center' });
    });
  } else if (kind === 'bar-group' || kind === 'hbar-group') {
    const k = series.length, e = (band * 0.75) / k;
    series.forEach((s, i) => s.values.forEach((v, j) => {
      const c = center(j) - band * 0.375 + e * (i + 0.5);
      rect(0, v, c, e * 0.9, col(i));
      if (vertical) valueLabel(v, c, pos(Math.max(0, v)) - fs * 0.2, { originX: 'center', originY: 'bottom', fontSize: fs * 0.62 });
      else valueLabel(v, pos(Math.max(0, v)) + fs * 0.25, c, { originY: 'center', fontSize: fs * 0.62 });
    }));
  } else if (kind === 'bar-stack' || kind === 'bar-stack100' || kind === 'hbar-stack') {
    for (let j = 0; j < n; j++) {
      const total = series.reduce((a, s) => a + Math.max(0, s.values[j]), 0) || 1;
      let acc = 0;
      series.forEach((s, i) => {
        const v = Math.max(0, s.values[j]);
        const h = pct ? (v / total) * 100 : v;
        rect(acc, acc + h, center(j), band * 0.6, col(i));
        if (d.showValues && h > (sc.max - sc.min) * 0.06) objs.push(txt(pct ? `${Math.round(h)}%` : fmt(v), { fontSize: fs * 0.62, fill: '#ffffff', fontWeight: 'bold', originX: 'center', originY: 'center', left: vertical ? center(j) : pos(acc + h / 2), top: vertical ? pos(acc + h / 2) : center(j) }));
        acc += h;
      });
    }
  } else if (kind === 'waterfall') {
    let run = 0;
    series[0].values.forEach((v, j) => {
      const a = j === 0 ? 0 : run;
      run = j === 0 ? v : run + v;
      rect(a, run, center(j), band * 0.6, j === 0 ? col(0) : v >= 0 ? '#2ecc71' : '#ff6b4a');
      if (j > 0) objs.push(new Line([center(j - 1) + band * 0.3, pos(a), center(j) - band * 0.3, pos(a)], { stroke: 'rgba(127,127,127,0.6)', strokeWidth: 1, strokeDashArray: [4, 3] }));
      valueLabel(j === 0 ? fmt(v) : (v > 0 ? '+' : '') + fmt(v), center(j), pos(Math.max(a, run)) - fs * 0.25, { originX: 'center', originY: 'bottom' });
    });
  } else if (kind === 'lollipop' || kind === 'dotplot') {
    series[0].values.forEach((v, j) => {
      const c = center(j);
      if (vertical) {
        objs.push(new Line([c, pos(0), c, pos(v)], { stroke: col(j), strokeWidth: Math.max(2, fs * 0.18) }));
        objs.push(new Circle({ left: c, top: pos(v), radius: fs * 0.45, originX: 'center', originY: 'center', fill: col(j) }));
        valueLabel(v, c, pos(v) - fs * 0.6, { originX: 'center', originY: 'bottom' });
      } else {
        objs.push(new Line([pos(sc.min), c, pos(sc.max), c], { stroke: 'rgba(127,127,127,0.25)', strokeWidth: Math.max(2, fs * 0.25), strokeLineCap: 'round' }));
        objs.push(new Circle({ left: pos(v), top: c, radius: fs * 0.45, originX: 'center', originY: 'center', fill: col(j) }));
        valueLabel(v, pos(v) + fs * 0.7, c, { originY: 'center' });
      }
    });
  } else {
    // lines & areas
    const baseline = series.map(() => 0);
    const cum = d.labels.map(() => 0);
    series.forEach((s, i) => {
      if (kind === 'line' || kind === 'area') { if (i > 0) return; }
      const pts = s.values.map((v, j) => {
        const y = kind === 'area-stack' ? cum[j] + Math.max(0, v) : v;
        return { x: center(j), y: pos(y), v, base: kind === 'area-stack' ? cum[j] : 0 };
      });
      const c = col(kind === 'line' || kind === 'area' ? 0 : i);
      if (kind === 'area' || kind === 'area-stack') {
        const lower = pts.map((p) => ({ x: p.x, y: pos(p.base) })).reverse();
        objs.push(new Polygon([...pts.map((p) => ({ x: p.x, y: p.y })), ...lower], { fill: c, opacity: kind === 'area-stack' ? 0.75 : 0.3, objectCaching: false }));
      }
      let path;
      if (kind === 'line-smooth') path = smoothPath(pts);
      else if (kind === 'step') path = pts.map((p, j) => (j === 0 ? `M ${p.x - band / 2} ${p.y} L ${p.x + band / 2} ${p.y}` : `L ${p.x - band / 2} ${p.y} L ${p.x + band / 2} ${p.y}`)).join(' ');
      else path = pts.map((p, j) => `${j ? 'L' : 'M'} ${p.x} ${p.y}`).join(' ');
      objs.push(new Path(path, { fill: '', stroke: c, strokeWidth: Math.max(3, fs * 0.2), strokeLineJoin: 'round', strokeLineCap: 'round', objectCaching: false }));
      if (kind !== 'step' && kind !== 'area-stack') pts.forEach((p) => objs.push(new Circle({ left: p.x, top: p.y, radius: fs * 0.28, originX: 'center', originY: 'center', fill: '#ffffff', stroke: c, strokeWidth: fs * 0.14 })));
      if (d.showValues && (series.length === 1 || kind === 'line' || kind === 'area')) pts.forEach((p) => valueLabel(p.v, p.x, p.y - fs * 0.55, { originX: 'center', originY: 'bottom' }));
      if (kind === 'area-stack') s.values.forEach((v, j) => { cum[j] += Math.max(0, v); });
      baseline[i] = 1;
    });
  }
}

function smoothPath(pts) {
  if (pts.length < 2) return `M ${pts[0].x} ${pts[0].y}`;
  let p = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    const c1x = p1.x + (p2.x - p0.x) / 6, c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6, c2y = p2.y - (p3.y - p1.y) / 6;
    p += ` C ${c1x} ${c1y} ${c2x} ${c2y} ${p2.x} ${p2.y}`;
  }
  return p;
}

// ---------------------------------------------------------------- circular
const arcPath = (cx, cy, r, a0, a1, r2 = 0) => {
  const P = (r, a) => `${cx + r * Math.cos(a)} ${cy + r * Math.sin(a)}`;
  const large = a1 - a0 > Math.PI ? 1 : 0;
  if (a1 - a0 >= Math.PI * 2 - 1e-6) a1 = a0 + Math.PI * 2 - 1e-4;
  if (!r2) return `M ${cx} ${cy} L ${P(r, a0)} A ${r} ${r} 0 ${large} 1 ${P(r, a1)} Z`;
  return `M ${P(r, a0)} A ${r} ${r} 0 ${large} 1 ${P(r, a1)} L ${P(r2, a1)} A ${r2} ${r2} 0 ${large} 0 ${P(r2, a0)} Z`;
};

/** Colour key beside a round chart; it always fits maxW × maxH (more columns, then smaller text). */
function legend(objs, d, items, x, y, fs, txt, col, maxW = Infinity, maxH = Infinity) {
  const n = items.length;
  let cols = 1, k = 1;
  for (cols = 1; cols <= 4; cols++) {
    k = Math.min(1, maxH / (Math.ceil(n / cols) * fs * 1.6));
    if (k >= 0.62 || cols === 4) break;
  }
  const f = fs * k, colW = maxW / cols, perCol = Math.ceil(n / cols);
  items.forEach((label, i) => {
    const lx = x + Math.floor(i / perCol) * colW, ly = y + (i % perCol) * f * 1.6;
    objs.push(new Rect({ left: lx, top: ly, width: f, height: f, rx: 3, ry: 3, fill: col(i) }));
    objs.push(fitText(txt(label, { fontSize: f * 0.85, left: lx + f * 1.5, top: ly - f * 0.05 }), colW - f * 1.7));
  });
}

function pie(objs, d, vals, a, fs, txt, col) {
  const total = vals.reduce((s, v) => s + Math.max(0, v), 0) || 1;
  const legendW = a.w * 0.38;
  const half = d.chart === 'halfdonut';
  const r = half ? Math.min((a.w - legendW) / 2, a.h * 0.85) * 0.92 : Math.min((a.w - legendW) / 2, a.h / 2) * 0.92;
  const cx = (a.w - legendW) / 2, cy = half ? a.y + a.h * 0.85 : a.y + a.h / 2;
  const span = half ? Math.PI : Math.PI * 2;
  let a0 = half ? Math.PI : -Math.PI / 2;
  const hole = d.chart === 'pie' ? 0 : r * 0.55;
  vals.forEach((v, i) => {
    const a1 = a0 + (Math.max(0, v) / total) * span;
    if (v > 0) objs.push(new Path(arcPath(cx, cy, r, a0, a1, hole), { fill: col(i), stroke: '#ffffff', strokeWidth: 2 }));
    if (d.showValues && v > 0 && (a1 - a0) > 0.2) {
      const am = (a0 + a1) / 2, rr = hole ? (r + hole) / 2 : r * 0.62;
      objs.push(txt(`${Math.round((v / total) * 100)}%`, { fontSize: fs * 0.8, fontWeight: 'bold', fill: '#ffffff', originX: 'center', originY: 'center', left: cx + rr * Math.cos(am), top: cy + rr * Math.sin(am) }));
    }
    a0 = a1;
  });
  legend(objs, d, d.labels.map((l, i) => `${l} (${fmt(vals[i])})`), a.w - legendW + fs, a.y + fs * 0.5, fs, txt, col, legendW - fs, a.h - fs * 0.5);
}

function polar(objs, d, vals, a, fs, txt, col) {
  const legendW = a.w * 0.38;
  const R = Math.min((a.w - legendW) / 2, a.h / 2) * 0.92;
  const cx = (a.w - legendW) / 2, cy = a.y + a.h / 2;
  const max = Math.max(1, ...vals);
  const n = vals.length, step = (Math.PI * 2) / n;
  for (let k = 1; k <= 4; k++) objs.push(new Circle({ left: cx, top: cy, radius: (R * k) / 4, originX: 'center', originY: 'center', fill: '', stroke: 'rgba(127,127,127,0.25)', strokeWidth: 1 }));
  vals.forEach((v, i) => {
    const r = Math.max(2, (R * Math.max(0, v)) / max);
    objs.push(new Path(arcPath(cx, cy, r, -Math.PI / 2 + i * step, -Math.PI / 2 + (i + 1) * step), { fill: col(i), opacity: 0.85, stroke: '#ffffff', strokeWidth: 2 }));
  });
  legend(objs, d, d.labels.map((l, i) => `${l} (${fmt(vals[i])})`), a.w - legendW + fs, a.y + fs * 0.5, fs, txt, col, legendW - fs, a.h - fs * 0.5);
}

function radial(objs, d, vals, a, fs, txt, col) {
  const legendW = a.w * 0.4;
  const R = Math.min((a.w - legendW) / 2, a.h / 2) * 0.95;
  const cx = (a.w - legendW) / 2, cy = a.y + a.h / 2;
  const n = vals.length, th = (R * 0.7) / n;
  vals.forEach((v, i) => {
    const r = R - i * th, r2 = r - th * 0.75;
    objs.push(new Path(arcPath(cx, cy, r, 0, Math.PI * 2 - 1e-3, r2), { fill: 'rgba(127,127,127,0.15)' }));
    const p = Math.max(0, Math.min(100, v));
    if (p > 0) objs.push(new Path(arcPath(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * p) / 100, r2), { fill: col(i) }));
  });
  legend(objs, d, d.labels.map((l, i) => `${l} ${fmt(vals[i])}%`), a.w - legendW + fs, a.y + fs * 0.5, fs, txt, col, legendW - fs, a.h - fs * 0.5);
}

function radar(objs, d, series, a, fs, txt, col) {
  const n = d.labels.length;
  const R = Math.min(a.w, a.h) / 2 - fs * 2.2;
  const cx = a.w / 2, cy = a.y + a.h / 2;
  const max = niceScale(0, Math.max(1, ...series.flatMap((s) => s.values))).max;
  const ang = (i) => -Math.PI / 2 + (i * Math.PI * 2) / n;
  for (let k = 1; k <= 4; k++) objs.push(new Polygon(d.labels.map((_, i) => ({ x: cx + ((R * k) / 4) * Math.cos(ang(i)), y: cy + ((R * k) / 4) * Math.sin(ang(i)) })), { fill: '', stroke: 'rgba(127,127,127,0.3)', strokeWidth: 1 }));
  d.labels.forEach((l, i) => {
    objs.push(new Line([cx, cy, cx + R * Math.cos(ang(i)), cy + R * Math.sin(ang(i))], { stroke: 'rgba(127,127,127,0.3)', strokeWidth: 1 }));
    objs.push(txt(l, { fontSize: fs * 0.8, originX: 'center', originY: 'center', left: cx + (R + fs * 1.1) * Math.cos(ang(i)), top: cy + (R + fs * 0.9) * Math.sin(ang(i)) }));
  });
  series.forEach((s, si) => {
    const pts = s.values.map((v, i) => ({ x: cx + (R * Math.max(0, v)) / max * Math.cos(ang(i)), y: cy + (R * Math.max(0, v)) / max * Math.sin(ang(i)) }));
    objs.push(new Polygon(pts, { fill: col(si), opacity: 0.25, objectCaching: false }));
    objs.push(new Polygon(pts, { fill: '', stroke: col(si), strokeWidth: Math.max(2, fs * 0.15), objectCaching: false }));
    pts.forEach((p) => objs.push(new Circle({ left: p.x, top: p.y, radius: fs * 0.22, originX: 'center', originY: 'center', fill: col(si) })));
  });
}

function scatter(objs, d, series, a, fs, txt, col) {
  const xs = d.labels.map((l, i) => (isNaN(parseFloat(l)) ? i + 1 : parseFloat(l)));
  const bubble = d.chart === 'bubble';
  const ys = bubble ? [series[0].values] : series.map((s) => s.values);
  const sx = niceScale(Math.min(0, ...xs), Math.max(...xs)), sy = niceScale(Math.min(0, ...ys.flat()), Math.max(...ys.flat()));
  const plot = { x: a.x + fs * 2.8, y: a.y + fs * 0.4, w: a.w - fs * 3.4, h: a.h - fs * 2.2 };
  const X = (v) => plot.x + ((v - sx.min) / (sx.max - sx.min)) * plot.w, Y = (v) => plot.y + plot.h - ((v - sy.min) / (sy.max - sy.min)) * plot.h;
  for (let v = sy.min; v <= sy.max + 1e-9; v += sy.step) { objs.push(new Line([plot.x, Y(v), plot.x + plot.w, Y(v)], { stroke: 'rgba(127,127,127,0.25)', strokeWidth: 1 })); objs.push(txt(fmtAxis(+v.toFixed(6)), { fontSize: fs * 0.75, originX: 'right', originY: 'center', left: plot.x - fs * 0.4, top: Y(v), opacity: 0.7 })); }
  for (let v = sx.min; v <= sx.max + 1e-9; v += sx.step) objs.push(txt(fmtAxis(+v.toFixed(6)), { fontSize: fs * 0.75, originX: 'center', left: X(v), top: plot.y + plot.h + fs * 0.4, opacity: 0.7 }));
  objs.push(new Line([plot.x, plot.y + plot.h, plot.x + plot.w, plot.y + plot.h], { stroke: d.color, strokeWidth: 2 }));
  if (bubble) {
    const sizes = (series[1] || series[0]).values;
    const smax = Math.max(1, ...sizes);
    xs.forEach((x, i) => objs.push(new Circle({ left: X(x), top: Y(series[0].values[i]), radius: Math.max(4, Math.sqrt(Math.max(0, sizes[i]) / smax) * fs * 2.2), originX: 'center', originY: 'center', fill: col(i), opacity: 0.7, stroke: '#ffffff', strokeWidth: 1.5 })));
  } else {
    ys.forEach((vals, si) => xs.forEach((x, i) => objs.push(new Circle({ left: X(x), top: Y(vals[i]), radius: fs * 0.38, originX: 'center', originY: 'center', fill: col(si), opacity: 0.85 }))));
  }
}

function heatmap(objs, d, series, a, fs, txt, col) {
  const labelW = Math.min(a.w * 0.25, fs * 5);
  const rows = series.length, cols = d.labels.length;
  const cw = (a.w - labelW) / cols, ch = (a.h - fs * 1.6) / rows;
  const all = series.flatMap((s) => s.values);
  const lo = Math.min(...all), hi = Math.max(...all);
  const base = col(0);
  const n = parseInt(base.slice(1), 16), br = n >> 16, bg = (n >> 8) & 255, bb = n & 255;
  series.forEach((s, r) => {
    objs.push(txt(s.name, { fontSize: fs * 0.8, originX: 'right', originY: 'center', left: labelW - fs * 0.4, top: a.y + ch * (r + 0.5) }));
    s.values.forEach((v, c) => {
      const t = hi > lo ? (v - lo) / (hi - lo) : 1;
      const mix = (x) => Math.round(255 + (x - 255) * (0.15 + 0.85 * t));
      objs.push(new Rect({ left: labelW + c * cw + 1, top: a.y + r * ch + 1, width: cw - 2, height: ch - 2, rx: 4, ry: 4, fill: `rgb(${mix(br)},${mix(bg)},${mix(bb)})` }));
      if (d.showValues) objs.push(txt(fmt(v), { fontSize: fs * 0.75, fontWeight: 'bold', fill: t > 0.55 ? '#ffffff' : d.color, originX: 'center', originY: 'center', left: labelW + c * cw + cw / 2, top: a.y + r * ch + ch / 2 }));
    });
  });
  d.labels.forEach((l, c) => objs.push(txt(l, { fontSize: fs * 0.8, originX: 'center', left: labelW + c * cw + cw / 2, top: a.y + rows * ch + fs * 0.3 })));
}

function funnel(objs, d, vals, a, fs, txt, col) {
  const max = Math.max(1, ...vals);
  const n = vals.length, h = a.h / n;
  vals.forEach((v, i) => {
    const w1 = (a.w * 0.9 * Math.max(0, v)) / max, w2 = i + 1 < n ? (a.w * 0.9 * Math.max(0, vals[i + 1])) / max : w1 * 0.8;
    const cx = a.w / 2, y = a.y + i * h;
    objs.push(new Polygon([{ x: cx - w1 / 2, y }, { x: cx + w1 / 2, y }, { x: cx + w2 / 2, y: y + h - 3 }, { x: cx - w2 / 2, y: y + h - 3 }], { fill: col(i) }));
    const label = txt(`${d.labels[i]}${d.showValues ? `  ${fmt(v)}` : ''}`, { fontSize: fs * 0.85, fontWeight: 'bold', fill: '#ffffff', originX: 'center', originY: 'center', left: cx, top: y + h / 2 });
    // too narrow for the label: put it beside the segment in the normal text colour
    if (label.width > Math.min(w1, w2) * 0.92) {
      const lx = cx + Math.max(w1, w2) / 2 + fs * 0.4, room = a.w - lx;
      if (label.width <= room) label.set({ fill: d.color, originX: 'left', left: lx });
      else {
        // no room beside it either: shrink the label onto the segment, dark text on a light band
        const k = Math.max(0.45, Math.min(1, (a.w * 0.96) / label.width));
        label.set({ fill: d.color, scaleX: k, scaleY: k, textBackgroundColor: 'rgba(255,255,255,0.85)' });
      }
    }
    objs.push(label);
  });
}

function treemap(objs, d, vals, a, fs, txt, col) {
  const items = vals.map((v, i) => ({ v: Math.max(0, v), i })).filter((x) => x.v > 0).sort((p, q) => q.v - p.v);
  const total = items.reduce((s, x) => s + x.v, 0) || 1;
  let rect = { x: a.x, y: a.y, w: a.w, h: a.h };
  let remaining = total;
  items.forEach((it, k) => {
    const share = it.v / remaining;
    let r;
    if (rect.w >= rect.h) { r = { x: rect.x, y: rect.y, w: rect.w * share, h: rect.h }; rect = { x: rect.x + r.w, y: rect.y, w: rect.w - r.w, h: rect.h }; }
    else { r = { x: rect.x, y: rect.y, w: rect.w, h: rect.h * share }; rect = { x: rect.x, y: rect.y + r.h, w: rect.w, h: rect.h - r.h }; }
    remaining -= it.v;
    objs.push(new Rect({ left: r.x + 1.5, top: r.y + 1.5, width: Math.max(1, r.w - 3), height: Math.max(1, r.h - 3), rx: 6, ry: 6, fill: col(it.i) }));
    if (r.w > fs * 3 && r.h > fs * 1.6) {
      objs.push(fitText(txt(d.labels[it.i], { fontSize: fs * 0.85, fontWeight: 'bold', fill: '#ffffff', left: r.x + fs * 0.5, top: r.y + fs * 0.4 }), r.w - fs));
      if (d.showValues) objs.push(txt(`${Math.round((it.v / total) * 100)}%`, { fontSize: fs * 0.75, fill: '#ffffff', left: r.x + fs * 0.5, top: r.y + fs * 1.5 }));
    }
  });
}

function gauge(objs, d, vals, a, fs, txt, col) {
  const p = Math.max(0, Math.min(100, vals[0] || 0));
  const R = Math.min(a.w / 2, a.h - fs * 2.4) * 0.95, r2 = R * 0.7;
  const cx = a.w / 2, cy = a.y + R + fs * 0.2;
  objs.push(new Path(arcPath(cx, cy, R, Math.PI, Math.PI * 2, r2), { fill: 'rgba(127,127,127,0.15)' }));
  if (p > 0) objs.push(new Path(arcPath(cx, cy, R, Math.PI, Math.PI + (Math.PI * p) / 100, r2), { fill: col(0) }));
  const na = Math.PI + (Math.PI * p) / 100;
  objs.push(new Line([cx, cy, cx + r2 * 0.9 * Math.cos(na), cy + r2 * 0.9 * Math.sin(na)], { stroke: d.color, strokeWidth: Math.max(3, fs * 0.2), strokeLineCap: 'round' }));
  objs.push(new Circle({ left: cx, top: cy, radius: fs * 0.4, originX: 'center', originY: 'center', fill: d.color }));
  // value under the pivot so the needle never covers it
  objs.push(txt(`${fmt(p)}%`, { fontSize: fs * 1.6, fontWeight: 'bold', originX: 'center', originY: 'top', left: cx, top: cy + fs * 0.55, fill: col(0) }));
  objs.push(fitText(txt(d.labels[0] || '', { fontSize: fs * 0.8, originX: 'right', originY: 'top', left: cx - R * 0.55, top: cy + fs * 0.5, opacity: 0.75 }), cx - R * 0.55));
}

function stat(objs, d, vals, a, fs0, txt, col) {
  const n = Math.max(1, vals.length), gap = fs0 * 0.6, w = (a.w - gap * (n - 1)) / n;
  const fs = Math.max(fs0, Math.min(w, a.h) * 0.12);
  vals.forEach((v, i) => {
    const x = i * (w + gap);
    objs.push(new Rect({ left: x, top: a.y, width: w, height: a.h, rx: fs * 0.6, ry: fs * 0.6, fill: '#ffffff', stroke: col(i), strokeWidth: Math.max(2, fs * 0.12) }));
    const big = txt(fmt(v), { fontSize: Math.min(fs * 2.2, a.h * 0.42), fontWeight: 'bold', fill: col(i), originX: 'center', originY: 'center', left: x + w / 2, top: a.y + a.h * 0.42 });
    if (big.width > w * 0.9) big.set({ fontSize: (big.fontSize * w * 0.9) / big.width });
    objs.push(big);
    objs.push(fitText(txt(d.labels[i] || '', { fontSize: fs * 0.8, originX: 'center', originY: 'center', left: x + w / 2, top: a.y + a.h * 0.78, opacity: 0.8 }), w * 0.9));
  });
}

function progress(objs, d, vals, a, fs, txt, col) {
  const n = Math.max(1, vals.length), rowH = a.h / n;
  vals.forEach((v, i) => {
    const p = Math.max(0, Math.min(100, v)), y = a.y + rowH * i;
    objs.push(txt(d.labels[i] ?? '', { fontSize: fs * 0.85, left: 0, top: y }));
    if (d.showValues) objs.push(txt(`${fmt(p)}%`, { fontSize: fs * 0.85, fontWeight: 'bold', originX: 'right', left: a.w, top: y }));
    const by = y + fs * 1.35, bh = Math.max(6, Math.min(rowH - fs * 1.6, fs * 0.9));
    objs.push(new Rect({ left: 0, top: by, width: a.w, height: bh, rx: bh / 2, ry: bh / 2, fill: 'rgba(127,127,127,0.18)' }));
    if (p > 0) objs.push(new Rect({ left: 0, top: by, width: Math.max(bh, (a.w * p) / 100), height: bh, rx: bh / 2, ry: bh / 2, fill: col(i) }));
  });
}

function rings(objs, d, vals, a, fs, txt, col) {
  const n = Math.max(1, vals.length), cw = a.w / n;
  const r = Math.min(cw * 0.42, (a.h - fs * 1.8) / 2), sw = r * 0.22;
  vals.forEach((v, i) => {
    const p = Math.max(0, Math.min(100, v)), cx = cw * (i + 0.5), cy = a.y + r + sw / 2;
    objs.push(new Circle({ left: cx, top: cy, radius: r, originX: 'center', originY: 'center', fill: '', stroke: 'rgba(127,127,127,0.18)', strokeWidth: sw }));
    if (p > 0) {
      const a0 = -Math.PI / 2, a1 = a0 + (Math.PI * 2 * Math.min(p, 99.99)) / 100;
      const pt = (q) => `${cx + r * Math.cos(q)} ${cy + r * Math.sin(q)}`;
      objs.push(new Path(`M ${pt(a0)} A ${r} ${r} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${pt(a1)}`, { fill: '', stroke: col(i), strokeWidth: sw, strokeLineCap: 'round' }));
    }
    if (d.showValues) objs.push(txt(`${fmt(p)}%`, { fontSize: fs * 1.1, fontWeight: 'bold', originX: 'center', originY: 'center', left: cx, top: cy }));
    objs.push(txt(d.labels[i] ?? '', { fontSize: fs * 0.85, originX: 'center', left: cx, top: cy + r + sw / 2 + fs * 0.4 }));
  });
}

function pictogram(objs, d, vals, a, fs, txt, col) {
  const n = Math.max(1, vals.length), rowH = a.h / n;
  const labelW = Math.min(a.w * 0.25, fs * 5);
  const size = Math.min(rowH * 0.8, (a.w - labelW - fs * 3) / 10.5);
  const person = (x, y, s, fill) => [
    new Circle({ left: x + s * 0.5, top: y + s * 0.2, radius: s * 0.18, originX: 'center', originY: 'center', fill }),
    new Path(`M ${x + s * 0.2} ${y + s} L ${x + s * 0.2} ${y + s * 0.6} Q ${x + s * 0.2} ${y + s * 0.42} ${x + s * 0.38} ${y + s * 0.42} L ${x + s * 0.62} ${y + s * 0.42} Q ${x + s * 0.8} ${y + s * 0.42} ${x + s * 0.8} ${y + s * 0.6} L ${x + s * 0.8} ${y + s} Z`, { fill }),
  ];
  vals.forEach((v, i) => {
    const p = Math.max(0, Math.min(100, v)), y = a.y + rowH * i + (rowH - size) / 2;
    objs.push(txt(d.labels[i] ?? '', { fontSize: fs * 0.85, originY: 'center', left: 0, top: y + size / 2 }));
    const filled = Math.round(p / 10);
    for (let k = 0; k < 10; k++) objs.push(...person(labelW + k * size * 1.05, y, size, k < filled ? col(i) : 'rgba(127,127,127,0.25)'));
    if (d.showValues) objs.push(txt(`${fmt(p)}%`, { fontSize: fs * 0.85, fontWeight: 'bold', originY: 'center', left: labelW + 10.5 * size * 1.05, top: y + size / 2 }));
  });
}

/** rows (CSV/TSV) → labels + one series per numeric column (header row = series names). */
export function rowsToData(rows) {
  const num = (v) => parseFloat(String(v).replace(/[,%\s]/g, ''));
  if (!rows.length) return null;
  const hasHeader = rows[0].length > 1 && rows[0].slice(1).every((c) => isNaN(num(c)));
  const head = hasHeader ? rows[0] : null;
  const body = (hasHeader ? rows.slice(1) : rows).filter((r) => r.length > 1 && !isNaN(num(r[1])));
  if (!body.length) return null;
  const cols = Math.max(...body.map((r) => r.length)) - 1;
  const series = Array.from({ length: cols }, (_, c) => ({ name: head ? head[c + 1] || `ชุดที่ ${c + 1}` : `ชุดที่ ${c + 1}`, values: body.map((r) => num(r[c + 1]) || 0) }));
  return { labels: body.map((r) => r[0]), values: series[0].values, series };
}
