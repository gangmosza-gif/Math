// Editable PowerPoint (.pptx) and Word (.docx) export.
// Every page is analysed into "items": real text boxes, shapes, tables and charts that stay
// editable in Office, plus pictures for anything Office cannot draw natively.
import { Point } from 'fabric';
import { renderPage } from './export.js';

const isText = (o) => o && (o.type === 'textbox' || o.type === 'itext' || o.type === 'text');
import { seriesOf, niceScale } from './charts.js';

// chart types PowerPoint / Word can draw natively (the rest are exported as pictures)
export const NATIVE_CHARTS = ['bar', 'hbar', 'line', 'area', 'pie', 'donut', 'bar-group', 'bar-stack', 'bar-stack100', 'hbar-group', 'hbar-stack', 'line-multi', 'line-smooth', 'area-stack', 'radar'];
const FONT_SIZE_MULT = 1.13; // fabric line box = fontSize * lineHeight * 1.13

// ---------------------------------------------------------------- colour helpers
const ctx2d = typeof document !== 'undefined' ? document.createElement('canvas').getContext('2d') : null;
/** Any CSS colour → { hex: 'RRGGBB', alpha } or null when transparent / missing. */
export function parseColor(c) {
  if (!c || c === 'transparent' || c === 'none') return null;
  if (typeof c === 'object' && c.colorStops) return parseColor(c.colorStops[0]?.color);
  ctx2d.fillStyle = '#000000';
  ctx2d.fillStyle = c;
  const v = ctx2d.fillStyle;
  if (v.startsWith('#')) return { hex: v.slice(1).toUpperCase(), alpha: 1 };
  const m = v.match(/rgba?\(([^)]+)\)/);
  if (!m) return null;
  const [r, g, b, a = 1] = m[1].split(',').map((x) => parseFloat(x));
  if (+a === 0) return null;
  return { hex: [r, g, b].map((n) => Math.round(n).toString(16).padStart(2, '0')).join('').toUpperCase(), alpha: +a };
}
const isGradient = (f) => f && typeof f === 'object' && f.colorStops;

// ---------------------------------------------------------------- page analysis
function baseStyle(o) {
  return {
    fontFamily: o.fontFamily, fontSize: o.fontSize, fontWeight: o.fontWeight, fontStyle: o.fontStyle,
    fill: o.fill, underline: o.underline, linethrough: o.linethrough, textBackgroundColor: o.textBackgroundColor,
  };
}

/**
 * Split a text object into its *displayed* lines (after word-wrapping) of runs that share a style.
 * Keeping the designer's exact line breaks matters for Thai: Office breaks Thai lines with its own
 * dictionary, so it would otherwise wrap at different places than the design.
 * Each line: { runs: [{ text, style }], soft } — soft = continues the previous paragraph (wrapped line).
 */
export function textLines(o) {
  const wrapped = o._textLines && o._textLines.length ? o._textLines : String(o.text || '').split('\n').map((l) => (typeof o.graphemeSplit === 'function' ? o.graphemeSplit(l) : Array.from(l)));
  const lines = [];
  let prevLine = -1;
  wrapped.forEach((chars, i) => {
    const map = (o._styleMap && o._styleMap[i]) || { line: i, offset: 0 };
    const runs = [];
    chars.forEach((ch, j) => {
      const st = { ...baseStyle(o), ...((o.styles && o.styles[map.line] && o.styles[map.line][map.offset + j]) || {}) };
      const key = JSON.stringify(st, (k, v) => (v && v.colorStops ? v.colorStops[0].color : v));
      const last = runs[runs.length - 1];
      if (last && last.key === key) last.text += ch;
      else runs.push({ key, text: ch, style: st });
    });
    // drop the space fabric leaves at the end of a wrapped line
    if (runs.length && i + 1 < wrapped.length && ((o._styleMap && o._styleMap[i + 1]) || {}).line === map.line) runs[runs.length - 1].text = runs[runs.length - 1].text.replace(/\s+$/, '');
    lines.push({ runs, soft: i > 0 && map.line === prevLine });
    prevLine = map.line;
  });
  return lines;
}
const firstStyle = (it) => it.lines.flatMap((l) => l.runs)[0]?.style || {};

function box(o) {
  const c = o.getCenterPoint();
  const w = o.width * Math.abs(o.scaleX), h = o.height * Math.abs(o.scaleY);
  return { x: c.x - w / 2, y: c.y - h / 2, w, h, angle: o.angle || 0, flipH: !!o.flipX, flipV: !!o.flipY };
}

/** Render one object on its own as a PNG data URL, placed where it sits on the page. */
function asPicture(o, mult = 2) {
  const cv = o.toCanvasElement({ multiplier: mult, enableRetinaScaling: false });
  const c = o.getCenterPoint();
  const w = cv.width / mult, h = cv.height / mult;
  return { kind: 'image', data: cv.toDataURL('image/png'), x: c.x - w / 2, y: c.y - h / 2, w, h, link: o.link, alt: o.alt || o.name };
}

function shapeKind(o) {
  if (o.clipPath || (o.filters && o.filters.length) || isGradient(o.fill) || isGradient(o.stroke)) return null;
  if (o.type === 'rect') return o.rx > 0 ? 'roundRect' : 'rect';
  if (o.type === 'circle' || o.type === 'ellipse') return 'ellipse';
  if (o.type === 'triangle') return 'triangle';
  if (o.type === 'polygon') return 'poly';
  return null;
}

function shapeItem(o, kind) {
  const b = box(o);
  const sc = Math.abs(o.scaleX);
  const fill = parseColor(o.fill);
  const stroke = o.stroke && o.strokeWidth > 0 ? parseColor(o.stroke) : null;
  const item = {
    kind: 'shape', shape: kind, ...b, fill, opacity: o.opacity ?? 1, link: o.link,
    stroke: stroke ? { ...stroke, width: o.strokeWidth * sc, dash: o.strokeDashArray ? (o.strokeDashArray[0] < 1 ? 'sysDot' : 'dash') : 'solid' } : null,
    radius: kind === 'roundRect' ? Math.min(o.rx * sc, b.w / 2, b.h / 2) : 0,
  };
  if (kind === 'poly') {
    // bake the full transform into the points, then express them relative to their bounding box
    const m = o.calcTransformMatrix();
    const pts = o.points.map((p) => new Point(p.x - o.pathOffset.x, p.y - o.pathOffset.y).transform(m));
    const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
    const x = Math.min(...xs), y = Math.min(...ys);
    Object.assign(item, { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y, angle: 0, flipH: false, flipV: false, points: pts.map((p) => ({ x: p.x - x, y: p.y - y })) });
  }
  return item;
}

function lineItem(o) {
  const lp = o.calcLinePoints();
  const m = o.calcTransformMatrix();
  const a = new Point(lp.x1, lp.y1).transform(m), b = new Point(lp.x2, lp.y2).transform(m);
  const stroke = parseColor(o.stroke);
  if (!stroke) return null;
  return {
    kind: 'line', x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(b.x - a.x), h: Math.abs(b.y - a.y),
    flipV: (b.x - a.x) * (b.y - a.y) < 0, stroke: { ...stroke, width: o.strokeWidth * Math.abs(o.scaleY), dash: o.strokeDashArray ? (o.strokeDashArray[0] < 1 ? 'sysDot' : 'dash') : 'solid' }, opacity: o.opacity ?? 1,
  };
}

function textItem(o, extra = {}) {
  const b = box(o);
  const sc = Math.abs(o.scaleY);
  return {
    kind: 'text', ...b, lines: textLines(o), scale: sc, align: o.textAlign || 'left', lineHeight: o.lineHeight || 1.16,
    charSpacing: o.charSpacing || 0, opacity: o.opacity ?? 1, link: o.link,
    stroke: o.stroke && o.strokeWidth > 0 ? parseColor(o.stroke) : null, strokeWidth: (o.strokeWidth || 0) * sc,
    shadow: o.shadow ? { color: parseColor(o.shadow.color), blur: o.shadow.blur * sc, ox: o.shadow.offsetX * sc, oy: o.shadow.offsetY * sc } : null,
    ...extra,
  };
}

function tableItem(g) {
  const d = g.smart;
  const sx = Math.abs(g.scaleX), sy = Math.abs(g.scaleY);
  const rects = g.getObjects().filter((o) => o.type === 'rect');
  const cols = Math.max(...d.rows.map((r) => r.length));
  const colW = rects.slice(0, cols).map((r) => r.width * sx);
  const rowH = [];
  for (let r = 0; r < d.rows.length; r++) rowH.push(rects[r * cols].height * sy);
  const b = box(g);
  return {
    kind: 'table', x: b.x, y: b.y, w: colW.reduce((a, c) => a + c, 0), h: rowH.reduce((a, c) => a + c, 0), colW, rowH,
    rows: d.rows.map((r) => Array.from({ length: cols }, (_, i) => String(r[i] ?? ''))),
    header: d.header, headerFill: parseColor(d.headerFill), headerColor: parseColor(d.headerColor), fill: parseColor(d.fill),
    stripe: parseColor(d.stripe), border: parseColor(d.border), color: parseColor(d.color),
    fontFamily: d.fontFamily, fontSize: d.fontSize * sy, align: d.align || 'center', pad: d.fontSize * 0.5 * sx,
  };
}

function chartItem(g) {
  const d = g.smart;
  const b = box(g);
  const sc = Math.abs(g.scaleY);
  const fs = Math.max(10, Math.round(Math.min(d.width, d.height) * 0.055)) * sc;
  return {
    kind: 'chart', chart: d.chart, ...b, title: d.title, labels: d.labels.map(String), values: d.values.map((v) => +v || 0),
    series: seriesOf(d), multi: !!(d.series && d.series.length > 1) || ['radar'].includes(d.chart),
    axisMax: (() => { const all = seriesOf(d).flatMap((x) => x.values); const stack = d.chart.includes('stack'); const hi = stack ? Math.max(...d.labels.map((_, j) => seriesOf(d).reduce((a, x) => a + Math.max(0, x.values[j]), 0))) : Math.max(1, ...all); return niceScale(Math.min(0, ...all), hi).max; })(),
    colors: Array.from({ length: Math.max(d.labels.length, (d.series || []).length) }, (_, i) => parseColor(d.colors[i % d.colors.length])?.hex || '7C5CFF'),
    showValues: d.showValues, fontFamily: d.fontFamily, color: parseColor(d.color)?.hex || '1F2333', fontSize: fs,
  };
}

/**
 * Analyse one page. Returns { bg: { color } | { image }, items: [...] } in design pixels.
 * `mode`: 'pptx' | 'docx' – Word cannot rotate text frames or draw shapes, so those become pictures there.
 */
export async function pageModel(design, pageJSON, mode = 'pptx') {
  const json = typeof pageJSON === 'string' ? JSON.parse(pageJSON) : pageJSON;
  const sc = await renderPage(design, json);
  const items = [];
  try {
    let bg;
    const bgc = sc.backgroundColor;
    if (!sc.backgroundImage && !isGradient(bgc)) bg = { color: parseColor(bgc) || { hex: 'FFFFFF', alpha: 1 } };
    else {
      const bgOnly = await renderPage(design, { ...json, objects: [] });
      bg = { image: bgOnly.toDataURL({ format: 'png', multiplier: Math.min(2, 2400 / Math.max(design.width, design.height)) }) };
      bgOnly.dispose();
    }
    for (const o of sc.getObjects()) {
      if (!o.visible) continue;
      if (isText(o)) {
        // curved or gradient text cannot be reproduced by Office; Word text frames also cannot rotate or carry outlines/shadows
        const hollow = !parseColor(o.fill);
        const effects = o.path || isGradient(o.fill) || (mode === 'docx' && ((o.angle % 360) || o.flipX || o.flipY || hollow));
        items.push(effects ? asPicture(o) : textItem(o));
        continue;
      }
      if (o.shapeText) {
        const [shape, text] = o.getObjects();
        const kind = shapeKind(shape);
        const tb = text;
        const sCenter = shape.getCenterPoint(); // v6: already in page coordinates
        const gs = Math.abs(o.scaleX);
        if (mode === 'pptx' && kind && kind !== 'poly' && !o.angle) {
          const w = shape.width * Math.abs(shape.scaleX) * gs, h = shape.height * Math.abs(shape.scaleY) * gs;
          const base = shapeItem(shape, kind);
          items.push({
            ...base, kind: 'shapeText', x: sCenter.x - w / 2, y: sCenter.y - h / 2, w, h, radius: base.radius * gs,
            stroke: base.stroke ? { ...base.stroke, width: base.stroke.width * gs } : null,
            text: textItem(tb, { scale: Math.abs(tb.scaleY) * gs }), opacity: o.opacity ?? 1,
          });
        } else {
          // picture of the shape + an editable text frame on top
          const pic = asPicture(o);
          const clone = await tb.clone();
          clone.set({ fontSize: tb.fontSize * gs, width: tb.width * gs, scaleX: 1, scaleY: 1, angle: (o.angle || 0) + (tb.angle || 0) });
          const tc = tb.getCenterPoint();
          clone.initDimensions();
          clone.setPositionByOrigin(tc, 'center', 'center');
          const shapeOnly = await o.clone(['shapeText']);
          shapeOnly.getObjects()[1].set('visible', false);
          items.push({ ...asPicture(shapeOnly), link: o.link });
          if (mode === 'docx' && clone.angle) items.push(pic); else items.push(textItem(clone));
        }
        continue;
      }
      if (o.smart?.type === 'table' && !(mode === 'docx' && o.angle)) { items.push(tableItem(o)); continue; }
      if (o.smart?.type === 'chart' && NATIVE_CHARTS.includes(o.smart.chart) && !o.angle) { items.push(chartItem(o)); continue; }
      const kind = mode === 'pptx' ? shapeKind(o) : null;
      if (kind) { items.push(shapeItem(o, kind)); continue; }
      if (mode === 'pptx' && o.type === 'line' && !o.shadow) { const li = lineItem(o); if (li) { items.push(li); continue; } }
      items.push(asPicture(o));
    }
    return { bg, items };
  } finally {
    sc.dispose();
  }
}

/** Inches per design pixel (physical size for paper presets, 96 dpi otherwise). */
export function inchPerPx(design) {
  return design.mm ? design.mm[0] / 25.4 / design.width : 1 / 96;
}

const b64 = (dataURL) => dataURL.replace(/^data:/, '');

/**
 * Chart XML from both libraries only names the Latin font, so Office would draw Thai labels in its
 * default complex-script font (Tahoma). Add the same font as East-Asian and complex-script font.
 */
async function fixChartFonts(blob) {
  const { default: JSZip } = await import('jszip');
  const zip = await JSZip.loadAsync(blob);
  const charts = Object.keys(zip.files).filter((f) => /charts\/chart\d+\.xml$/.test(f));
  if (!charts.length) return blob;
  for (const f of charts) {
    let x = await zip.file(f).async('string');
    x = x.replace(/<a:latin typeface="([^"]+)"([^>]*)\/>(?!<a:ea)/g, (m, face, rest) => `<a:latin typeface="${face}"${rest}/><a:ea typeface="${face}"/><a:cs typeface="${face}"/>`);
    zip.file(f, x);
  }
  return zip.generateAsync({ type: 'blob', mimeType: blob.type || undefined });
}
const lineSpacingPt = (it, fontPx, toPt) => toPt(fontPx * it.scale) * it.lineHeight * FONT_SIZE_MULT;
// Office puts the extra leading of an exact line spacing above the first line; fabric does not.
// Measured with LibreOffice for 10 fonts and several sizes / line heights (error ≤ 2 px):
const firstLineShift = (it, fontPx, app) => {
  const fs = fontPx * it.scale;
  const lead = FONT_SIZE_MULT * fs * (it.lineHeight - 1);
  return app === 'pptx' ? lead + 0.04 * fs : 0.8 * lead;
};

// ================================================================ PowerPoint
export async function buildPptx(design, pages, onProgress = () => {}) {
  const { default: PptxGenJS } = await import('pptxgenjs');
  const pptx = new PptxGenJS();
  let ipp = inchPerPx(design);
  const maxIn = Math.max(design.width, design.height) * ipp;
  if (maxIn > 56) ipp *= 56 / maxIn; // PowerPoint's largest slide is 56 in
  const I = (px) => +(px * ipp).toFixed(4);
  const PT = (px) => px * ipp * 72;
  pptx.defineLayout({ name: 'LAI', width: I(design.width), height: I(design.height) });
  pptx.layout = 'LAI';
  pptx.title = design.name;
  const alignOf = (a) => (a === 'justify' ? 'justify' : a === 'center' ? 'center' : a === 'right' ? 'right' : 'left');

  const runsOf = (it) => {
    const out = [];
    it.lines.forEach((line, li) => {
      let runs = line.runs;
      if (!runs.length) runs = [{ text: '', style: firstStyle(it) }];
      const nextSoft = it.lines[li + 1]?.soft;
      runs.forEach((r, ri) => {
        const st = r.style;
        const col = parseColor(st.fill);
        const hl = parseColor(st.textBackgroundColor);
        out.push({
          text: r.text,
          options: {
            fontFace: st.fontFamily, fontSize: +(PT(st.fontSize * it.scale)).toFixed(2), bold: st.fontWeight === 'bold' || +st.fontWeight >= 600,
            italic: st.fontStyle === 'italic', underline: st.underline ? { style: 'sng' } : undefined, strike: st.linethrough ? 'sngStrike' : undefined,
            color: col ? col.hex : 'FFFFFF', transparency: col ? Math.round((1 - col.alpha * it.opacity) * 100) : 100,
            highlight: hl ? hl.hex : undefined, lang: 'th-TH',
            charSpacing: it.charSpacing ? +(PT(st.fontSize * it.scale) * it.charSpacing / 1000).toFixed(2) : undefined,
            breakLine: ri === runs.length - 1 && li < it.lines.length - 1 && !nextSoft,
            softBreakBefore: ri === 0 && line.soft ? true : undefined,
            hyperlink: it.link ? { url: it.link } : undefined,
          },
        });
      });
    });
    return out;
  };

  const textOpts = (it) => {
    const first = firstStyle(it);
    // a little extra width so Office never wraps a line that fit in the design
    const extra = it.w * 0.02;
    const x = it.align === 'center' ? it.x - extra / 2 : it.align === 'right' ? it.x - extra : it.x;
    return {
      x: I(x), y: I(it.y - firstLineShift(it, first.fontSize || 20, 'pptx')), w: I(it.w + extra), h: I(it.h), margin: 0, valign: 'top', align: alignOf(it.align), isTextBox: true, fit: 'none', wrap: true,
      lineSpacing: +lineSpacingPt(it, first.fontSize || 20, PT).toFixed(2), paraSpaceBefore: 0, paraSpaceAfter: 0,
      rotate: it.angle || undefined, flipH: it.flipH || undefined, flipV: it.flipV || undefined,
      outline: it.stroke ? { color: it.stroke.hex, size: +PT(it.strokeWidth).toFixed(2) } : undefined,
      shadow: it.shadow && it.shadow.color ? { type: 'outer', color: it.shadow.color.hex, opacity: it.shadow.color.alpha, blur: +PT(it.shadow.blur).toFixed(1), offset: +PT(Math.hypot(it.shadow.ox, it.shadow.oy)).toFixed(1), angle: Math.round((Math.atan2(it.shadow.oy, it.shadow.ox) * 180) / Math.PI + 360) % 360 } : undefined,
    };
  };

  const shapeType = (k) => ({ rect: pptx.ShapeType.rect, roundRect: pptx.ShapeType.roundRect, ellipse: pptx.ShapeType.ellipse, triangle: pptx.ShapeType.triangle, poly: pptx.ShapeType.custGeom }[k]);
  const shapeOpts = (it) => ({
    x: I(it.x), y: I(it.y), w: I(it.w), h: I(it.h), rotate: it.angle || undefined, flipH: it.flipH || undefined, flipV: it.flipV || undefined,
    fill: it.fill ? { color: it.fill.hex, transparency: Math.round((1 - it.fill.alpha * it.opacity) * 100) } : { type: 'none' },
    line: it.stroke ? { color: it.stroke.hex, width: +PT(it.stroke.width).toFixed(2), dashType: it.stroke.dash, transparency: Math.round((1 - it.stroke.alpha * it.opacity) * 100) } : { type: 'none' },
    rectRadius: it.shape === 'roundRect' ? I(it.radius) : undefined,
    points: it.points ? [...it.points.map((p, i) => ({ x: I(p.x), y: I(p.y), ...(i === 0 ? { moveTo: true } : {}) })), { close: true }] : undefined,
    hyperlink: it.link ? { url: it.link } : undefined,
  });

  for (let n = 0; n < pages.length; n++) {
    onProgress(n, pages.length);
    const pg = pages[n];
    const model = await pageModel(design, pg.json, 'pptx');
    const slide = pptx.addSlide();
    if (model.bg.color) slide.background = { color: model.bg.color.hex };
    else slide.background = { data: b64(model.bg.image) };
    for (const it of model.items) {
      if (it.kind === 'text') slide.addText(runsOf(it), textOpts(it));
      else if (it.kind === 'shape') slide.addShape(shapeType(it.shape), shapeOpts(it));
      else if (it.kind === 'shapeText') {
        const t = it.text;
        slide.addText(runsOf(t), { ...shapeOpts(it), shape: shapeType(it.shape), align: alignOf(t.align), valign: 'middle', margin: 0, wrap: true, fit: 'none', lineSpacing: +lineSpacingPt(t, firstStyle(t).fontSize || 20, PT).toFixed(2) });
      } else if (it.kind === 'line') {
        slide.addShape(pptx.ShapeType.line, { x: I(it.x), y: I(it.y), w: I(it.w), h: I(it.h), flipV: it.flipV || undefined, line: { color: it.stroke.hex, width: +PT(it.stroke.width).toFixed(2), dashType: it.stroke.dash, transparency: Math.round((1 - it.stroke.alpha * it.opacity) * 100) } });
      } else if (it.kind === 'image') {
        slide.addImage({ data: b64(it.data), x: I(it.x), y: I(it.y), w: I(it.w), h: I(it.h), hyperlink: it.link ? { url: it.link } : undefined, altText: it.alt || undefined });
      } else if (it.kind === 'table') {
        const fsz = +PT(it.fontSize).toFixed(2);
        const rows = it.rows.map((r, ri) => r.map((c) => {
          const head = it.header && ri === 0;
          const fill = head ? it.headerFill : it.stripe && ri % 2 === (it.header ? 0 : 1) ? it.stripe : it.fill;
          return { text: c, options: { bold: head, color: (head ? it.headerColor : it.color)?.hex || '000000', fill: fill ? { color: fill.hex } : undefined } };
        }));
        slide.addTable(rows, {
          x: I(it.x), y: I(it.y), w: I(it.w), colW: it.colW.map(I), rowH: it.rowH.map(I), fontFace: it.fontFamily, fontSize: fsz, lang: 'th-TH',
          align: it.align, valign: 'middle', margin: [0, Math.min(0.9, I(it.pad)), 0, Math.min(0.9, I(it.pad))], border: { type: 'solid', pt: 1, color: it.border?.hex || 'CCCCCC' }, autoPage: false,
        });
      } else if (it.kind === 'chart') {
        addPptxChart(pptx, slide, it, I, PT);
      }
    }
    if (pg.notes) slide.addNotes(pg.notes);
  }
  onProgress(pages.length, pages.length);
  return fixChartFonts(await pptx.write({ outputType: 'blob' }));
}

function addPptxChart(pptx, slide, it, I, PT) {
  const base = {
    x: I(it.x), y: I(it.y), w: I(it.w), h: I(it.h),
    showTitle: !!it.title, title: it.title || undefined, titleBold: true, dataLabelFontBold: true, titleFontFace: it.fontFamily, titleFontSize: +(PT(it.fontSize) * 1.35).toFixed(1), titleColor: it.color,
    catAxisLabelFontFace: it.fontFamily, valAxisLabelFontFace: it.fontFamily, dataLabelFontFace: it.fontFamily, legendFontFace: it.fontFamily,
    catAxisLabelFontSize: +(PT(it.fontSize) * 0.85).toFixed(1), valAxisLabelFontSize: +(PT(it.fontSize) * 0.8).toFixed(1), dataLabelFontSize: +(PT(it.fontSize) * 0.85).toFixed(1),
    legendFontSize: +(PT(it.fontSize) * 0.85).toFixed(1), catAxisLabelColor: it.color, valAxisLabelColor: it.color, dataLabelColor: it.color,
    showValue: !!it.showValues, valGridLine: { color: 'E5E5E5', size: 0.5 },
  };
  if (it.chart === 'pie' || it.chart === 'donut') {
    // the design's legend shows "label (value)"
    slide.addChart(it.chart === 'pie' ? pptx.ChartType.pie : pptx.ChartType.doughnut, [{ name: it.title || 'ข้อมูล', labels: it.labels.map((l, i) => `${l} (${it.values[i]})`), values: it.values }], {
      ...base, chartColors: it.colors, showValue: false, showPercent: !!it.showValues, dataLabelColor: 'FFFFFF', showLegend: true, legendPos: 'r', holeSize: 55,
    });
  } else if (it.chart === 'bar' || it.chart === 'hbar') {
    // one series per category, stacked, so every bar keeps its own colour (as in the design)
    const data = it.labels.map((l, i) => ({ name: l, labels: it.labels, values: it.values.map((v, j) => (j === i ? v : 0)) }));
    slide.addChart(pptx.ChartType.bar, data, { ...base, valAxisMaxVal: it.axisMax, valAxisMinVal: 0, barDir: it.chart === 'hbar' ? 'bar' : 'col', catAxisOrientation: it.chart === 'hbar' ? 'maxMin' : 'minMax', barGrouping: 'clustered', barOverlapPct: 100, chartColors: it.colors, showLegend: false, barGapWidthPct: 60, dataLabelFormatCode: '#,##0.##;;;', dataLabelPosition: 'outEnd' });
  } else if (it.multi) {
    // several series: legend on top, one colour per series (as in the design)
    const data = it.series.map((x) => ({ name: x.name, labels: it.labels, values: x.values }));
    const legend = { showLegend: true, legendPos: 't' };
    const k = it.chart;
    if (k.startsWith('bar') || k.startsWith('hbar')) {
      slide.addChart(pptx.ChartType.bar, data, { ...base, ...legend, chartColors: it.colors, barDir: k.startsWith('hbar') ? 'bar' : 'col', catAxisOrientation: k.startsWith('hbar') ? 'maxMin' : 'minMax', valAxisLabelFormatCode: k.endsWith('stack100') ? '0%' : undefined, barGrouping: k.endsWith('stack100') ? 'percentStacked' : k.includes('stack') ? 'stacked' : 'clustered', barOverlapPct: k.includes('stack') ? 100 : undefined, barGapWidthPct: 60, valAxisMinVal: 0, valAxisMaxVal: k.endsWith('stack100') ? undefined : it.axisMax, dataLabelPosition: k.includes('stack') ? 'ctr' : 'outEnd', dataLabelColor: k.includes('stack') ? 'FFFFFF' : it.color });
    } else if (k === 'radar') {
      slide.addChart(pptx.ChartType.radar, data, { ...base, ...legend, chartColors: it.colors, radarStyle: 'marker', showValue: false });
    } else if (k === 'area-stack') {
      slide.addChart(pptx.ChartType.area, data, { ...base, ...legend, chartColors: it.colors, barGrouping: 'stacked', showValue: false, valAxisMinVal: 0, valAxisMaxVal: it.axisMax });
    } else {
      slide.addChart(pptx.ChartType.line, data, { ...base, ...legend, chartColors: it.colors, lineSize: 3, lineDataSymbol: 'circle', lineDataSymbolSize: 7, lineSmooth: k === 'line-smooth', showValue: false, valAxisMinVal: 0, valAxisMaxVal: it.axisMax });
    }
  } else {
    slide.addChart(it.chart === 'area' ? pptx.ChartType.area : pptx.ChartType.line, [{ name: it.title || 'ข้อมูล', labels: it.labels, values: it.values }], {
      ...base, chartColors: [it.colors[0]], showLegend: false, lineSize: 3, lineDataSymbol: 'circle', lineDataSymbolSize: 8, dataLabelPosition: 't', valAxisMinVal: 0, valAxisMaxVal: it.axisMax,
    });
  }
}

// ================================================================ Word
export async function buildDocx(design, pages, onProgress = () => {}) {
  const D = await import('docx');
  const { ChartRun } = await import('docx/charts');
  const ipp = inchPerPx(design);
  const TW = (px) => Math.round(px * ipp * 1440); // twips
  const EMU = (px) => Math.round(px * ipp * 914400);
  const P96 = (px) => px * ipp * 96; // docx "pixels"
  const PT = (px) => px * ipp * 72;
  const align = (a) => ({ center: D.AlignmentType.CENTER, right: D.AlignmentType.RIGHT, justify: D.AlignmentType.JUSTIFIED }[a] || D.AlignmentType.LEFT);
  const font = (f) => ({ ascii: f, hAnsi: f, cs: f, eastAsia: f });
  const dataOf = (url) => Uint8Array.from(atob(url.split(',')[1]), (c) => c.charCodeAt(0));
  const floating = (x, y, z, behind = true) => ({
    horizontalPosition: { relative: D.HorizontalPositionRelativeFrom.PAGE, offset: EMU(x) },
    verticalPosition: { relative: D.VerticalPositionRelativeFrom.PAGE, offset: EMU(y) },
    wrap: { type: D.TextWrappingType.NONE }, behindDocument: behind, allowOverlap: true, lockAnchor: true, zIndex: z,
  });

  const runOf = (r, it) => {
    const st = r.style;
    const col = parseColor(st.fill);
    const hl = parseColor(st.textBackgroundColor);
    const half = Math.round(PT(st.fontSize * it.scale) * 2 * 100) / 100;
    const bold = st.fontWeight === 'bold' || +st.fontWeight >= 600;
    const italic = st.fontStyle === 'italic';
    return new D.TextRun({
      text: r.text, font: font(st.fontFamily), size: half, sizeComplexScript: half, bold, boldComplexScript: bold, italics: italic, italicsComplexScript: italic,
      color: col ? col.hex : 'FFFFFF', underline: st.underline ? { type: D.UnderlineType.SINGLE } : undefined, strike: !!st.linethrough,
      shading: hl ? { type: D.ShadingType.CLEAR, fill: hl.hex, color: 'auto' } : undefined,
      characterSpacing: it.charSpacing ? Math.round(PT(st.fontSize * it.scale) * it.charSpacing / 1000 * 20) : undefined,
      language: { value: 'th-TH', bidirectional: 'th-TH' },
    });
  };

  const textParagraphs = (it) => {
    const first = firstStyle(it);
    const extra = it.w * 0.02;
    const x = it.align === 'center' ? it.x - extra / 2 : it.align === 'right' ? it.x - extra : it.x;
    const frame = {
      type: 'absolute', position: { x: TW(x), y: TW(it.y - firstLineShift(it, first.fontSize || 20, 'docx')) }, width: TW(it.w + extra), height: TW(it.h),
      anchor: { horizontal: D.FrameAnchorType.PAGE, vertical: D.FrameAnchorType.PAGE }, rule: D.HeightRule.AT_LEAST, wrap: D.FrameWrap.NONE ?? 'none',
    };
    const line = Math.round(lineSpacingPt(it, first.fontSize || 20, PT) * 20);
    // paragraphs = original lines; wrapped lines inside a paragraph are joined with soft line breaks
    const paras = [];
    for (const l of it.lines) {
      if (!l.soft || !paras.length) paras.push([]);
      const cur = paras[paras.length - 1];
      if (l.soft) cur.push(new D.TextRun({ break: 1 }));
      if (l.runs.length) cur.push(...l.runs.map((r) => runOf(r, it)));
      else cur.push(new D.TextRun({ text: '', font: font(first.fontFamily), size: Math.round(PT((first.fontSize || 20) * it.scale) * 2) }));
    }
    return paras.map((children) => {
      if (it.link) children = [new D.ExternalHyperlink({ link: it.link, children })];
      return new D.Paragraph({ frame, alignment: align(it.align), spacing: { before: 0, after: 0, line, lineRule: D.LineRuleType.EXACT }, children });
    });
  };

  const tableOf = (it) => {
    const fszHalf = Math.round(PT(it.fontSize) * 2);
    const border = { style: D.BorderStyle.SINGLE, size: 6, color: it.border?.hex || 'CCCCCC' };
    return new D.Table({
      layout: D.TableLayoutType.FIXED, columnWidths: it.colW.map(TW), width: { size: TW(it.w), type: D.WidthType.DXA },
      float: { horizontalAnchor: D.TableAnchorType.PAGE, verticalAnchor: D.TableAnchorType.PAGE, absoluteHorizontalPosition: TW(it.x), absoluteVerticalPosition: TW(it.y) },
      rows: it.rows.map((r, ri) => new D.TableRow({
        height: { value: TW(it.rowH[ri]), rule: D.HeightRule.ATLEAST },
        children: r.map((c, ci) => {
          const head = it.header && ri === 0;
          const fill = head ? it.headerFill : it.stripe && ri % 2 === (it.header ? 0 : 1) ? it.stripe : it.fill;
          return new D.TableCell({
            width: { size: TW(it.colW[ci]), type: D.WidthType.DXA }, verticalAlign: D.VerticalAlign.CENTER,
            shading: fill ? { type: D.ShadingType.CLEAR, fill: fill.hex, color: 'auto' } : undefined,
            margins: { left: TW(it.pad), right: TW(it.pad), top: 0, bottom: 0 },
            borders: { top: border, bottom: border, left: border, right: border },
            children: [new D.Paragraph({ alignment: align(it.align), spacing: { before: 0, after: 0 }, children: [new D.TextRun({ text: c, font: font(it.fontFamily), size: fszHalf, sizeComplexScript: fszHalf, bold: head, boldComplexScript: head, color: (head ? it.headerColor : it.color)?.hex || '000000', language: { value: 'th-TH', bidirectional: 'th-TH' } })] })],
          });
        }),
      })),
    });
  };

  const chartOf = (it, z, behind) => {
    const fontOpt = { name: it.fontFamily, color: it.color };
    const common = {
      title: it.title ? { text: it.title, font: { ...fontOpt, size: +(PT(it.fontSize) * 1.35).toFixed(1), bold: true } } : undefined,
      font: fontOpt, transformation: { width: P96(it.w), height: P96(it.h) }, floating: floating(it.x, it.y, z, behind),
      chartArea: { fill: 'none', border: 'none' },
    };
    if (it.chart === 'pie' || it.chart === 'donut') {
      return new ChartRun({
        ...common, type: it.chart === 'pie' ? 'pie' : 'doughnut', categories: it.labels.map((l, i) => `${l} (${it.values[i]})`), legend: { position: 'right', font: { ...fontOpt, size: +(PT(it.fontSize) * 0.85).toFixed(1) } },
        series: [{ name: it.title || 'ข้อมูล', values: it.values, colors: it.colors }],
        dataLabels: it.showValues ? { percentage: true, font: { ...fontOpt, color: 'FFFFFF', size: +(PT(it.fontSize) * 0.85).toFixed(1), bold: true } } : undefined,
      });
    }
    const fsz = (k) => +(PT(it.fontSize) * k).toFixed(1);
    if (it.multi) {
      const k = it.chart;
      const legend = { position: 'top', font: { ...fontOpt, size: fsz(0.85) } };
      if (k === 'radar') return new ChartRun({ ...common, type: 'radar', categories: it.labels, legend, series: it.series.map((x, i) => ({ name: x.name, values: x.values, color: it.colors[i] })) });
      const type = k.startsWith('hbar') ? 'bar' : k.startsWith('bar') ? 'column' : k.startsWith('area') ? 'area' : 'line';
      const stacking = k.endsWith('stack100') ? 'percent' : k.includes('stack') ? 'stacked' : 'none';
      return new ChartRun({
        ...common, type, categories: it.labels, legend, stacking,
        series: it.series.map((x, i) => ({ name: x.name, values: x.values, color: it.colors[i], ...(k === 'line-smooth' ? { smooth: true } : {}) })),
        dataLabels: it.showValues && (type === 'column' || type === 'bar') ? { value: true, font: { ...fontOpt, size: fsz(0.7), bold: true } } : undefined,
        categoryAxis: { font: { ...fontOpt, size: fsz(0.85) }, reverseOrder: type === 'bar' }, valueAxis: { font: { ...fontOpt, size: fsz(0.8) }, ...(stacking === 'percent' ? { numberFormat: '0%' } : { minimum: 0, maximum: it.axisMax }) },
      });
    }
    const type = { bar: 'column', hbar: 'bar', line: 'line', area: 'area' }[it.chart];
    return new ChartRun({
      ...common, type, categories: it.labels, legend: false,
      series: [{ name: it.title || 'ข้อมูล', values: it.values, ...(type === 'column' || type === 'bar' ? { colors: it.colors } : { color: it.colors[0] }) }],
      dataLabels: it.showValues ? { value: true, font: { ...fontOpt, size: +(PT(it.fontSize) * 0.85).toFixed(1), bold: true } } : undefined,
      categoryAxis: { font: { ...fontOpt, size: fsz(0.85) }, reverseOrder: type === 'bar' }, valueAxis: { font: { ...fontOpt, size: fsz(0.8) }, minimum: 0, maximum: it.axisMax },
    });
  };

  const sections = [];
  for (let n = 0; n < pages.length; n++) {
    onProgress(n, pages.length);
    const model = await pageModel(design, pages[n].json, 'docx');
    const anchors = [];
    const flow = [];
    let z = 1;
    // page background: a full-page picture (Word only has one page colour for the whole document)
    let bgURL = model.bg.image;
    if (!bgURL) {
      const c = document.createElement('canvas');
      c.width = 16; c.height = 16;
      const g = c.getContext('2d');
      g.fillStyle = '#' + model.bg.color.hex;
      g.fillRect(0, 0, 16, 16);
      bgURL = c.toDataURL('image/png');
    }
    anchors.push(new D.ImageRun({ type: 'png', data: dataOf(bgURL), transformation: { width: P96(design.width), height: P96(design.height) }, floating: floating(0, 0, z++), altText: { name: 'พื้นหลัง', description: 'พื้นหลังของหน้า', title: 'พื้นหลัง' } }));
    // Word keeps text frames and tables in one "text layer": a picture goes behind it unless it must cover
    // a text/table that sits below it in the design, in which case it floats in front of the text.
    const overlaps = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
    model.items.forEach((it, i) => {
      if (it.kind === 'image' || it.kind === 'chart') it.front = model.items.slice(0, i).some((t) => (t.kind === 'text' || t.kind === 'table') && overlaps(t, it));
    });
    for (const it of model.items) {
      if (it.kind === 'image') {
        anchors.push(new D.ImageRun({ type: 'png', data: dataOf(it.data), transformation: { width: P96(it.w), height: P96(it.h) }, floating: floating(it.x, it.y, z++, !it.front), altText: { name: it.alt || 'ภาพ', description: it.alt || '', title: it.alt || '' } }));
      } else if (it.kind === 'chart') {
        anchors.push(chartOf(it, z++, !it.front));
      } else if (it.kind === 'text') {
        flow.push(...textParagraphs(it));
      } else if (it.kind === 'table') {
        flow.push(tableOf(it));
      }
    }
    sections.push({
      properties: {
        type: n === 0 ? undefined : D.SectionType.NEXT_PAGE,
        // explicit width/height (docx would swap them again for LANDSCAPE)
        page: { size: { width: TW(design.width), height: TW(design.height) }, margin: { top: 0, right: 0, bottom: 0, left: 0, header: 0, footer: 0, gutter: 0 } },
      },
      children: [new D.Paragraph({ spacing: { before: 0, after: 0, line: 20, lineRule: D.LineRuleType.EXACT }, children: anchors }), ...flow, new D.Paragraph({ spacing: { before: 0, after: 0, line: 20, lineRule: D.LineRuleType.EXACT }, children: [] })],
    });
  }
  onProgress(pages.length, pages.length);
  const doc = new D.Document({
    title: design.name, creator: 'Lai Studio',
    styles: { default: { document: { run: { font: font('Sarabun'), language: { value: 'th-TH', bidirectional: 'th-TH' } } } } },
    sections,
  });
  return fixChartFonts(await D.Packer.toBlob(doc));
}
