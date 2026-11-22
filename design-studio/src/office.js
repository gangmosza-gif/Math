// Editable PowerPoint (.pptx) and Word (.docx) export.
// Every page is analysed into "items": real text boxes, shapes, tables and charts that stay
// editable in Office, plus pictures for anything Office cannot draw natively.
import { Point } from 'fabric';
import { renderPage, pageRef } from './export.js';
import { hasDoc, docSettings, docDecorations } from './docsetup.js';

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
export async function pageModel(design, pageArg, mode = 'pptx') {
  const { json: pageJSON } = pageRef(design, pageArg);
  const json = typeof pageJSON === 'string' ? JSON.parse(pageJSON) : pageJSON;
  // Word gets header/footer/page numbers/watermark/border as real Word features (added in buildDocx);
  // PowerPoint has no headers, so they come in as ordinary editable text on each slide
  const sc = await renderPage(design, pageArg, { deco: mode === 'pptx' });
  const U = Math.min(design.width, design.height);
  const items = [];
  try {
    let bg;
    const bgc = sc.backgroundColor;
    if (!sc.backgroundImage && !isGradient(bgc)) bg = { color: parseColor(bgc) || { hex: 'FFFFFF', alpha: 1 } };
    else {
      const bgOnly = await renderPage(design, { ...json, objects: [] }, { deco: false });
      bg = { image: bgOnly.toDataURL({ format: 'png', multiplier: Math.min(2, 2400 / Math.max(design.width, design.height)) }) };
      bgOnly.dispose();
    }
    for (const o of sc.getObjects()) {
      if (!o.visible) continue;
      if (o.decoRole === 'watermark') { items.push({ ...asPicture(o), alt: 'ลายน้ำ' }); continue; }
      if (isText(o)) {
        // curved or gradient text cannot be reproduced by Office; Word text frames also cannot rotate or carry outlines/shadows
        const hollow = !parseColor(o.fill);
        const effects = o.path || isGradient(o.fill) || (mode === 'docx' && ((o.angle % 360) || o.flipX || o.flipY || hollow));
        if (effects) { items.push(asPicture(o)); continue; }
        // headings (same rule as the outline panel) become Word heading paragraphs
        const size = (o.fontSize || 0) * Math.abs(o.scaleY || 1);
        const level = o.autoPage || o.autoToc || o.decoRole ? 0 : size >= U * 0.08 ? 1 : size >= U * 0.055 ? 2 : 0;
        items.push(textItem(o, { level, autoPage: o.autoPage || null, listType: o.listType || null }));
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
    const model = await pageModel(design, pg, 'pptx');
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
/**
 * Word export. mode 'flow' (documents/reports): ordinary paragraphs in reading order that flow and wrap like any
 * Word document — headings, lists, inline tables/pictures, side-by-side items in an invisible table.
 * mode 'layout' (designs): every text sits in a text frame at its exact place, so the page looks identical.
 */
export async function buildDocx(design, pages, onProgress = () => {}, { mode = 'layout' } = {}) {
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
      ...(r.children ? { children: r.children } : { text: r.text }), font: font(st.fontFamily), size: half, sizeComplexScript: half, bold, boldComplexScript: bold, italics: italic, italicsComplexScript: italic,
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
    if (it.autoPage) {
      // a page number placed on the page: a real PAGE field, so Word renumbers it by itself
      const r0 = it.lines[0]?.runs[0];
      const st = r0 ? r0.style : first;
      const run = (children) => runOf({ text: undefined, style: st, children }, it);
      paras.length = 0;
      paras.push([run(pageFieldParts(it.autoPage === 'nN' ? 'nN' : 'n'))]);
    }
    return paras.map((children) => {
      if (it.link) children = [new D.ExternalHyperlink({ link: it.link, children })];
      const heading = it.level === 1 ? D.HeadingLevel.HEADING_1 : it.level === 2 ? D.HeadingLevel.HEADING_2 : undefined;
      return new D.Paragraph({ frame, heading, alignment: align(it.align), spacing: { before: 0, after: 0, line, lineRule: D.LineRuleType.EXACT }, children });
    });
  };

  const pageFieldParts = (fmt) => ({
    n: [D.PageNumber.CURRENT], nN: [D.PageNumber.CURRENT, ' / ', D.PageNumber.TOTAL_PAGES],
    th: ['หน้า ', D.PageNumber.CURRENT], thN: ['หน้า ', D.PageNumber.CURRENT, ' จาก ', D.PageNumber.TOTAL_PAGES],
    dash: ['- ', D.PageNumber.CURRENT, ' -'],
  }[fmt] || [D.PageNumber.CURRENT]);

  // ---- document setup → Word header / footer / PAGE fields / watermark / page border
  const doc = hasDoc(design) ? docSettings(design) : null;
  const MMTW = (mm) => Math.round((mm / 25.4) * 1440);
  const bandParas = (where, withNum, withWatermark) => {
    const paras = [];
    const side = doc.border.style !== 'none' ? Math.max(doc.edge, doc.border.inset + 4) : doc.edge;
    const indent = { left: MMTW(side), right: MMTW(side) };
    const runStyle = (c) => ({ font: font(c.font), size: Math.round(c.size * 2), sizeComplexScript: Math.round(c.size * 2), bold: !!c.bold, boldComplexScript: !!c.bold, italics: !!c.italic, italicsComplexScript: !!c.italic, color: (parseColor(c.color) || { hex: '000000' }).hex, language: { value: 'th-TH', bidirectional: 'th-TH' } });
    const c = doc[where];
    // the watermark rides in the first header paragraph as a placeholder run, swapped for VML WordArt after packing
    let lead = withWatermark ? [new D.TextRun({ text: 'LAIWATERMARK' })] : [];
    const take = () => { const l = lead; lead = []; return l; };
    const lineOf = (cfg) => ({ before: 0, after: 0, line: Math.round(cfg.size * 1.3 * 20), lineRule: D.LineRuleType.EXACT });
    if (c.text.trim()) {
      const lines = c.text.split('\n');
      paras.push(new D.Paragraph({ alignment: align(c.align), indent, spacing: lineOf(c), children: [...take(), ...lines.flatMap((l, i) => [...(i ? [new D.TextRun({ break: 1 })] : []), new D.TextRun({ text: l, ...runStyle(c) })])] }));
    }
    if (withNum && doc.pageNum.pos === where) {
      paras.push(new D.Paragraph({ alignment: align(doc.pageNum.align), indent, spacing: lineOf(doc.pageNum), children: [...take(), new D.TextRun({ children: pageFieldParts(doc.pageNum.fmt), ...runStyle({ ...doc.pageNum, bold: false, italic: false }) })] }));
    }
    if (lead.length || !paras.length) paras.push(new D.Paragraph({ spacing: { before: 0, after: 0, line: 20, lineRule: D.LineRuleType.EXACT }, children: take() }));
    return paras;
  };
  let headerSet = null;
  if (doc) {
    const wm = !!doc.watermark.text.trim();
    const mk = (withNum) => ({ headers: new D.Header({ children: bandParas('header', withNum, wm) }), footers: new D.Footer({ children: bandParas('footer', withNum, false) }) });
    const def = mk(true);
    headerSet = { headers: { default: def.headers }, footers: { default: def.footers }, titlePage: false };
    if (doc.pageNum.skipFirst && doc.pageNum.pos !== 'none') {
      const first = mk(false);
      headerSet = { headers: { default: def.headers, first: first.headers }, footers: { default: def.footers, first: first.footers }, titlePage: true };
    }
  }
  const bandMm = (where) => {
    if (!doc) return 0;
    const pts = (doc[where].text.trim() ? doc[where].size * 1.3 * doc[where].text.split('\n').length : 0) + (doc.pageNum.pos === where ? doc.pageNum.size * 1.3 : 0);
    return (pts / 72) * 25.4;
  };
  const sideMm = doc ? (doc.border.style !== 'none' ? Math.max(doc.edge, doc.border.inset + 4) : doc.edge) : 12.7;
  const bodyMargins = doc
    ? { top: MMTW(doc.edge + bandMm('header') + 3), bottom: MMTW(doc.edge + bandMm('footer') + 3), left: MMTW(Math.max(sideMm, 12.7)), right: MMTW(Math.max(sideMm, 12.7)) }
    : { top: MMTW(12.7), bottom: MMTW(12.7), left: MMTW(12.7), right: MMTW(12.7) };
  const BORDER = { single: 'SINGLE', thick: 'SINGLE', double: 'DOUBLE', dashed: 'DASHED', dotted: 'DOTTED' };
  const pageBorders = doc && doc.border.style !== 'none' ? (() => {
    const b = { style: D.BorderStyle[BORDER[doc.border.style]], size: Math.max(2, Math.min(96, Math.round(doc.border.width * (doc.border.style === 'thick' ? 2.5 : 1) * 8))), color: (parseColor(doc.border.color) || { hex: '000000' }).hex, space: Math.min(31, Math.round((doc.border.inset / 25.4) * 72)) };
    return { pageBorders: { display: D.PageBorderDisplay.ALL_PAGES, offsetFrom: D.PageBorderOffsetFrom.PAGE, zOrder: D.PageBorderZOrder.FRONT }, pageBorderTop: b, pageBorderBottom: b, pageBorderLeft: b, pageBorderRight: b };
  })() : undefined;

  const tableOf = (it, floatIt = true, indentL = 0) => {
    const fszHalf = Math.round(PT(it.fontSize) * 2);
    const border = { style: D.BorderStyle.SINGLE, size: 6, color: it.border?.hex || 'CCCCCC' };
    return new D.Table({
      layout: D.TableLayoutType.FIXED, columnWidths: it.colW.map(TW), width: { size: TW(it.w), type: D.WidthType.DXA },
      ...(floatIt
        ? { float: { horizontalAnchor: D.TableAnchorType.PAGE, verticalAnchor: D.TableAnchorType.PAGE, absoluteHorizontalPosition: TW(it.x), absoluteVerticalPosition: TW(it.y) } }
        : { indent: { size: indentL, type: D.WidthType.DXA } }),
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
      font: fontOpt, transformation: { width: P96(it.w), height: P96(it.h) }, ...(z === null ? {} : { floating: floating(it.x, it.y, z, behind) }),
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


  // ------------------------------------------------------------------ flowing document
  const listConfig = [
    { reference: 'lai-bullet', levels: [{ level: 0, format: D.LevelFormat.BULLET, text: '•', alignment: D.AlignmentType.LEFT, style: { paragraph: { indent: { left: 360, hanging: 360 } } } }] },
    { reference: 'lai-number', levels: [{ level: 0, format: D.LevelFormat.DECIMAL, text: '%1.', alignment: D.AlignmentType.LEFT, style: { paragraph: { indent: { left: 360, hanging: 360 } } } }] },
  ];
  let listInstance = 0;
  const flowMargins = [];
  const MM = (mm) => mm / 25.4 / ipp; // design px per mm
  const LIST_RE = { bullet: /^\s*[•·▪◦‣\-–]\s+/, number: /^\s*\d+[.)]\s+/ };

  /** One text item as flowing paragraphs: original line breaks are kept, wrapped lines are left to Word. */
  const flowText = (it, { indentL, indentR, before }) => {
    const first = firstStyle(it);
    const pitch = Math.round(lineSpacingPt(it, first.fontSize || 20, PT) * 20);
    const heading = it.level === 1 ? D.HeadingLevel.HEADING_1 : it.level === 2 ? D.HeadingLevel.HEADING_2 : undefined;
    if (it.autoPage) {
      const r0 = it.lines[0]?.runs[0];
      return [new D.Paragraph({ alignment: align(it.align), indent: { left: indentL, right: indentR }, spacing: { before, after: 0, line: pitch, lineRule: D.LineRuleType.EXACT }, children: [runOf({ style: r0 ? r0.style : first, children: pageFieldParts(it.autoPage === 'nN' ? 'nN' : 'n') }, it)] })];
    }
    const paras = [];
    for (const l of it.lines) {
      if (!l.soft || !paras.length) paras.push([]);
      paras[paras.length - 1].push(...l.runs.map((r) => ({ ...r })));
    }
    // list: Word numbering instead of typed bullets / numbers
    const plain = paras.map((rs) => rs.map((r) => r.text).join(''));
    let list = it.listType === 'bullet' || it.listType === 'number' ? it.listType : null;
    if (!list && plain.length && plain.every((t) => !t.trim() || LIST_RE.bullet.test(t))) list = 'bullet';
    if (!list && plain.length > 1 && plain.every((t) => !t.trim() || LIST_RE.number.test(t))) list = 'number';
    const instance = list ? ++listInstance : 0;
    const hang = Math.round(PT((first.fontSize || 20) * it.scale) * 0.6 * 20);
    return paras.map((runs, i) => {
      if (list && runs.length) {
        const re = LIST_RE[list];
        const k = runs.findIndex((r) => r.text.trim());
        if (k >= 0) runs[k] = { ...runs[k], text: runs[k].text.replace(re, '') };
      }
      let children = runs.filter((r) => r.text).map((r) => runOf(r, it));
      if (!children.length) children = [new D.TextRun({ text: '', font: font(first.fontFamily), size: Math.round(PT((first.fontSize || 20) * it.scale) * 2) })];
      if (it.link) children = [new D.ExternalHyperlink({ link: it.link, children })];
      return new D.Paragraph({
        heading, alignment: align(it.align), children,
        indent: list ? { left: indentL + hang, hanging: hang, right: indentR } : { left: indentL, right: indentR },
        ...(list ? { numbering: { reference: `lai-${list}`, level: 0, instance } } : {}),
        spacing: { before: i === 0 ? before : 0, after: 0, line: pitch, lineRule: D.LineRuleType.EXACT },
        keepNext: !!heading,
      });
    });
  };
  const flowItem = (it, ctx) => {
    if (it.kind === 'text') return flowText(it, ctx);
    if (it.kind === 'table') {
      const spacer = ctx.before > 40 ? [new D.Paragraph({ spacing: { before: 0, after: 0, line: Math.max(20, ctx.before), lineRule: D.LineRuleType.EXACT }, children: [] })] : [];
      return [...spacer, tableOf(it, false, ctx.indentL)];
    }
    const run = it.kind === 'chart'
      ? chartOf(it, null)
      : new D.ImageRun({ type: 'png', data: dataOf(it.data), transformation: { width: P96(it.w), height: P96(it.h) }, altText: { name: it.alt || 'ภาพ', description: it.alt || '', title: it.alt || '' } });
    return [new D.Paragraph({ indent: { left: ctx.indentL }, spacing: { before: ctx.before, after: 0 }, children: [run] })];
  };

  /** A page as flowing content. Pictures that sit behind text stay floating behind it (decoration). */
  const flowPage = (model, anchors, nextZ, n) => {
    const W = design.width, H = design.height;
    const area = (a) => a.w * a.h;
    const inter = (a, b) => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
    const isTextish = (t) => t.kind === 'text' || t.kind === 'table';
    const deco = [], items = [];
    // content reaching into the footer zone cannot flow (Word would push it to a new page): it stays pinned to the page
    const footZone = doc ? H - MM(doc.edge + bandMm('footer') + 1) : H - MM(3);
    const pinned = [];
    for (const it of model.items) {
      const behindText = (it.kind === 'image') && (area(it) > W * H * 0.5 || model.items.some((t) => t !== it && isTextish(t) && inter(t, it) > area(t) * 0.5));
      if (behindText) deco.push(it);
      else if (it.y + it.h > footZone && it.y > H * 0.5) pinned.push(it);
      else items.push(it);
    }
    const pinnedOut = [];
    for (const it of pinned) {
      if (it.kind === 'image') anchors.push(new D.ImageRun({ type: 'png', data: dataOf(it.data), transformation: { width: P96(it.w), height: P96(it.h) }, floating: floating(it.x, it.y, nextZ(), false), altText: { name: it.alt || 'ภาพ', description: it.alt || '', title: it.alt || '' } }));
      else if (it.kind === 'chart') anchors.push(chartOf(it, nextZ(), false));
      else if (it.kind === 'text') pinnedOut.push(...textParagraphs(it));
      else if (it.kind === 'table') pinnedOut.push(tableOf(it));
    }
    for (const it of deco) anchors.push(new D.ImageRun({ type: 'png', data: dataOf(it.data), transformation: { width: P96(it.w), height: P96(it.h) }, floating: floating(it.x, it.y, nextZ(), true), altText: { name: it.alt || 'ภาพตกแต่ง', description: it.alt || '', title: it.alt || '' } }));
    // margins of this page from where its content sits (documents keep 10–40 mm)
    const xs = items.map((t) => t.x), xe = items.map((t) => t.x + t.w), ye = items.map((t) => t.y + t.h);
    const clampMm = (v, lo, hi) => Math.max(MM(lo), Math.min(MM(hi), v));
    const Lp = doc ? Math.max(MM(sideMm), Math.min(...xs, MM(40))) : clampMm(items.length ? Math.min(...xs) : MM(20), 10, 40);
    const Rp = doc ? Math.max(MM(sideMm), Math.min(W - Math.max(...xe, 0), MM(40))) : clampMm(items.length ? W - Math.max(...xe) : MM(20), 10, 40);
    // the body starts at the first content line (Word moves it below a taller header by itself)
    const firstY = items.length ? Math.min(...items.map((t) => t.y)) : MM(12.7);
    const topMm = Math.max(3, Math.min(doc ? doc.edge + bandMm('header') + 3 : 12.7, firstY * ipp * 25.4));
    const lowest = items.length ? Math.max(...ye) : 0;
    const botMm = Math.max(0, Math.min(doc ? doc.edge + bandMm('footer') + 3 : 12.7, ((H - lowest) * ipp * 25.4) - 1));
    flowMargins[n] = { top: MMTW(topMm), bottom: MMTW(botMm), left: TW(Lp), right: TW(Rp) };
    // where Word will really put each item: text in exact lines (n × pitch) whose first line sits a bit lower
    for (const it of items) {
      if (it.kind === 'text') {
        const fpx = firstStyle(it).fontSize || 20;
        const pitch = fpx * it.scale * it.lineHeight * FONT_SIZE_MULT;
        it.wTop = it.y - firstLineShift(it, fpx, 'docx');
        it.wH = Math.max(1, it.lines.length) * pitch;
      } else { it.wTop = it.y; it.wH = it.h; }
    }
    // rows: items whose vertical ranges overlap and do not overlap sideways sit next to each other
    items.sort((a, b) => a.y - b.y || a.x - b.x);
    const rows = [];
    for (const it of items) {
      const row = rows[rows.length - 1];
      const fits = row && row.items.every((o) => o.x + o.w <= it.x + 1 || it.x + it.w <= o.x + 1)
        && it.y < row.bottom - Math.min(it.h, row.minH) * 0.5;
      if (fits) { row.items.push(it); row.bottom = Math.max(row.bottom, it.y + it.h); row.minH = Math.min(row.minH, it.h); row.wTop = Math.min(row.wTop, it.wTop); row.wBottom = Math.max(row.wBottom, it.wTop + it.wH); }
      else rows.push({ items: [it], top: it.y, bottom: it.y + it.h, minH: it.h, wTop: it.wTop, wBottom: it.wTop + it.wH });
    }
    const out = [];
    let prev = MM(topMm);
    const twGap = (px) => Math.max(0, TW(px));
    for (const row of rows) {
      const before = twGap(row.wTop - prev);
      if (row.items.length === 1) {
        const it = row.items[0];
        const extra = it.kind === 'text' ? it.w * 0.03 : 0; // Word's Thai line breaking needs a hair more room
        const snap = (v) => (Math.abs(v) < TW(MM(2)) ? 0 : v); // a hair of indent only gets in the way when editing
        out.push(...flowItem(it, { indentL: snap(TW(it.x - Lp)), indentR: snap(Math.max(0, TW(W - Rp - (it.x + it.w) - extra))), before }));
      } else {
        // invisible table, one cell per item
        const cols = row.items.slice().sort((a, b) => a.x - b.x);
        const x0 = cols[0].x;
        const edges = cols.map((c, i) => (i + 1 < cols.length ? cols[i + 1].x : Math.max(c.x + c.w, W - Rp)));
        const widths = cols.map((c, i) => Math.max(TW(20), TW(edges[i] - c.x)));
        const none = { style: D.BorderStyle.NONE, size: 0, color: 'FFFFFF' };
        if (before > 40) out.push(new D.Paragraph({ spacing: { before: 0, after: 0, line: Math.max(20, before), lineRule: D.LineRuleType.EXACT }, children: [] }));
        out.push(new D.Table({
          layout: D.TableLayoutType.FIXED, columnWidths: widths, width: { size: widths.reduce((a, b) => a + b, 0), type: D.WidthType.DXA },
          indent: { size: TW(x0 - Lp), type: D.WidthType.DXA },
          borders: { top: none, bottom: none, left: none, right: none, insideHorizontal: none, insideVertical: none },
          rows: [new D.TableRow({
            children: cols.map((c, i) => new D.TableCell({
              width: { size: widths[i], type: D.WidthType.DXA }, margins: { top: 0, bottom: 0, left: 0, right: 0 },
              borders: { top: none, bottom: none, left: none, right: none },
              children: flowItem(c, { indentL: 0, indentR: Math.max(0, TW(edges[i] - (c.x + c.w))), before: twGap(c.wTop - row.wTop) }),
            })),
          })],
        }));
      }
      prev = row.wBottom;
    }
    return [...out, ...pinnedOut];
  };

  const sections = [];
  let coloredBg = false;
  for (let n = 0; n < pages.length; n++) {
    onProgress(n, pages.length);
    const model = await pageModel(design, pages[n], 'docx');
    const anchors = [];
    const flow = [];
    let z = 1;
    // page background: a full-page picture (Word only has one page colour for the whole document).
    // A plain white page needs none — Word pages are white — which also keeps the watermark visible.
    const whitePage = !model.bg.image && model.bg.color && /^F{6}$/i.test(model.bg.color.hex) && (model.bg.color.alpha ?? 1) >= 0.99;
    if (!whitePage) coloredBg = true;
    let bgURL = model.bg.image;
    if (!bgURL) {
      const c = document.createElement('canvas');
      c.width = 16; c.height = 16;
      const g = c.getContext('2d');
      g.fillStyle = '#' + model.bg.color.hex;
      g.fillRect(0, 0, 16, 16);
      bgURL = c.toDataURL('image/png');
    }
    if (!whitePage) anchors.push(new D.ImageRun({ type: 'png', data: dataOf(bgURL), transformation: { width: P96(design.width), height: P96(design.height) }, floating: floating(0, 0, z++), altText: { name: 'พื้นหลัง', description: 'พื้นหลังของหน้า', title: 'พื้นหลัง' } }));
    // Word keeps text frames and tables in one "text layer": a picture goes behind it unless it must cover
    // a text/table that sits below it in the design, in which case it floats in front of the text.
    const overlaps = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
    model.items.forEach((it, i) => {
      // …and a picture above such a front picture stays above it (front as well), keeping the design's order
      if (it.kind === 'image' || it.kind === 'chart') it.front = model.items.slice(0, i).some((t) => ((t.kind === 'text' || t.kind === 'table') || t.front) && overlaps(t, it));
    });
    if (mode === 'flow') {
      flow.push(...flowPage(model, anchors, () => z++, n));
    } else for (const it of model.items) {
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
        page: {
          size: { width: TW(design.width), height: TW(design.height) },
          // real margins so text typed later in Word starts inside the page (the design itself is positioned absolutely)
          margin: { ...(mode === 'flow' ? flowMargins[n] : bodyMargins), header: doc ? MMTW(doc.edge) : 0, footer: doc ? MMTW(doc.edge) : 0, gutter: 0 },
          ...(pageBorders ? { borders: pageBorders } : {}),
        },
        ...(headerSet && n === 0 && headerSet.titlePage ? { titlePage: true } : {}),
      },
      ...(headerSet ? { headers: n === 0 || !headerSet.titlePage ? headerSet.headers : { default: headerSet.headers.default }, footers: n === 0 || !headerSet.titlePage ? headerSet.footers : { default: headerSet.footers.default } } : {}),
      children: [new D.Paragraph({ spacing: { before: 0, after: 0, line: 20, lineRule: D.LineRuleType.EXACT }, children: anchors }), ...flow, new D.Paragraph({ spacing: { before: 0, after: 0, line: 20, lineRule: D.LineRuleType.EXACT }, children: [] })],
    });
  }
  onProgress(pages.length, pages.length);
  const wordDoc = new D.Document({
    title: design.name, creator: 'Lai Studio',
    styles: {
      // text typed later in Word: Sarabun 16 pt, the usual size for Thai documents
      default: { document: { run: { font: font('Sarabun'), size: 32, sizeComplexScript: 32, language: { value: 'th-TH', bidirectional: 'th-TH' } } } },
      // neutral heading styles: the look comes from each run, the styles give Word's navigation pane / table of contents the outline
      paragraphStyles: [1, 2].map((lv) => ({ id: `Heading${lv}`, name: `heading ${lv}`, basedOn: 'Normal', next: 'Normal', quickFormat: true, paragraph: { outlineLevel: lv - 1, spacing: { before: 0, after: 0 } }, run: { color: '000000' } })),
    },
    numbering: { config: listConfig },
    sections,
  });
  let blob = await fixChartFonts(await D.Packer.toBlob(wordDoc));
  if (doc && doc.watermark.text.trim()) blob = await addWatermark(blob, design, doc, coloredBg);
  return blob;
}

/** Swap the placeholder run in every header for a Word watermark (VML WordArt, editable in Design → Watermark). */
async function addWatermark(blob, design, doc, front = false) {
  const JSZip = (await import('jszip')).default;
  const zip = await JSZip.loadAsync(blob);
  const w = doc.watermark;
  const esc = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const specs = docDecorations(design, 0, 1).find((x) => x.kind === 'watermark');
  const ptPerPx = inchPerPx(design) * 72;
  const wPt = (specs.textW * ptPerPx).toFixed(1), hPt = (specs.fontSize * ptPerPx * 1.0).toFixed(1);
  const rot = Math.round(((specs.angle % 360) + 360) % 360);
  const col = '#' + (parseColor(w.color) || { hex: 'C0C0C0' }).hex;
  let n = 0;
  const vml = () => {
    n++;
    return `<w:r><w:rPr><w:noProof/></w:rPr><w:pict>${n > 0 ? '<v:shapetype id="_x0000_t136" coordsize="21600,21600" o:spt="136" adj="10800" path="m@7,l@8,m@5,21600l@6,21600e"><v:formulas><v:f eqn="sum #0 0 10800"/><v:f eqn="prod #0 2 1"/><v:f eqn="sum 21600 0 @1"/><v:f eqn="sum 0 0 @2"/><v:f eqn="sum 21600 0 @3"/><v:f eqn="if @0 @3 0"/><v:f eqn="if @0 21600 @1"/><v:f eqn="if @0 0 @2"/><v:f eqn="if @0 @4 21600"/><v:f eqn="mid @5 @6"/><v:f eqn="mid @8 @5"/><v:f eqn="mid @7 @8"/><v:f eqn="mid @6 @7"/><v:f eqn="sum @6 0 @5"/></v:formulas><v:path textpathok="t" o:connecttype="custom" o:connectlocs="@9,0;@10,10800;@11,21600;@12,10800" o:connectangles="270,180,90,0"/><v:textpath on="t" fitshape="t"/><v:handles><v:h position="#0,bottomRight" xrange="6629,14971"/></v:handles><o:lock v:ext="edit" text="t" shapetype="t"/></v:shapetype>' : ''}`
      + `<v:shape id="PowerPlusWaterMarkObject${1000 + n}" o:spid="_x0000_s${2048 + n}" type="#_x0000_t136" style="position:absolute;margin-left:0;margin-top:0;width:${wPt}pt;height:${hPt}pt;rotation:${rot};z-index:${front ? 251659264 : -251654144};mso-position-horizontal:center;mso-position-horizontal-relative:page;mso-position-vertical:center;mso-position-vertical-relative:page" o:allowincell="f" fillcolor="${col}" stroked="f">`
      + `<v:fill opacity="${(+w.opacity).toFixed(2)}"/><v:textpath style="font-family:&quot;${esc(w.font)}&quot;;font-size:1pt${w.bold ? ';font-weight:bold' : ''}" string="${esc(w.text.trim())}"/><w10:wrap anchorx="page" anchory="page"/></v:shape></w:pict></w:r>`;
  };
  for (const f of Object.keys(zip.files).filter((x) => /^word\/header\d*\.xml$/.test(x))) {
    let x = await zip.file(f).async('string');
    if (!x.includes('LAIWATERMARK')) continue;
    x = x.replace(/<w:r>(?:(?!<w:r>)[\s\S])*?LAIWATERMARK[\s\S]*?<\/w:r>/, vml);
    // make sure the VML namespaces are declared on the root
    const ns = { 'xmlns:v': 'urn:schemas-microsoft-com:vml', 'xmlns:o': 'urn:schemas-microsoft-com:office:office', 'xmlns:w10': 'urn:schemas-microsoft-com:office:word' };
    x = x.replace(/<w:hdr\b([^>]*)>/, (m0, attrs) => `<w:hdr${attrs}${Object.entries(ns).filter(([k]) => !attrs.includes(k + '=')).map(([k, v]) => ` ${k}="${v}"`).join('')}>`);
    zip.file(f, x);
  }
  return zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
}
