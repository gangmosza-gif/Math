// Document setup shared by the editor, picture/PDF export and PowerPoint/Word export:
// header & footer text, automatic page numbers, watermark and page border.
// Settings live on the design (`design.doc`) and apply to every page.

export const DOC_DEFAULT = {
  header: { text: '', align: 'center', bold: false, italic: false, color: '#64748b', size: 10, font: 'Sarabun' },
  footer: { text: '', align: 'center', bold: false, italic: false, color: '#64748b', size: 10, font: 'Sarabun' },
  pageNum: { pos: 'none', align: 'center', fmt: 'n', skipFirst: false, color: '#64748b', size: 10, font: 'Sarabun' },
  watermark: { text: '', color: '#e5484d', opacity: 0.18, diagonal: true, font: 'Kanit', bold: true },
  border: { style: 'none', color: '#1f2333', width: 1.5, inset: 8 },
  edge: 10, // distance of header/footer from the paper edge (mm)
};

export const PAGE_NUM_FORMATS = [
  ['n', '1'], ['nN', '1 / 3'], ['th', 'หน้า 1'], ['thN', 'หน้า 1 จาก 3'], ['dash', '- 1 -'],
];
export const WATERMARK_PRESETS = ['ลับ', 'ลับมาก', 'ลับที่สุด', 'ด่วนที่สุด', 'ร่าง', 'สำเนา', 'ตัวอย่าง', 'CONFIDENTIAL', 'DRAFT'];
export const BORDER_STYLES = [['none', 'ไม่มี'], ['single', 'เส้นเดี่ยว'], ['thick', 'เส้นหนา'], ['double', 'เส้นคู่'], ['dashed', 'เส้นประ'], ['dotted', 'เส้นจุด']];

const clone = (o) => JSON.parse(JSON.stringify(o));

let measureCtx;
/** Width of a single line of text in px at the given size (browser canvas metrics). */
export function measureText(text, font, bold, size) {
  if (typeof document === 'undefined') return text.length * size * 0.6;
  measureCtx = measureCtx || document.createElement('canvas').getContext('2d');
  measureCtx.font = `${bold ? 'bold ' : ''}${size}px "${font}", sans-serif`;
  return measureCtx.measureText(text).width;
}

/** Settings merged with the defaults (always a full object). */
export function docSettings(design) {
  const d = design && design.doc ? design.doc : {};
  const out = clone(DOC_DEFAULT);
  for (const k of Object.keys(out)) {
    if (d[k] !== undefined) out[k] = typeof out[k] === 'object' ? { ...out[k], ...d[k] } : d[k];
  }
  return out;
}

/** true when any document decoration is switched on. */
export function hasDoc(design) {
  const s = docSettings(design);
  return !!(s.header.text.trim() || s.footer.text.trim() || s.pageNum.pos !== 'none' || s.watermark.text.trim() || s.border.style !== 'none');
}

/** Pixels of the design per millimetre / per point (paper presets use their real size, others 96 dpi). */
export function pxPerMm(design) {
  return design.mm ? design.width / design.mm[0] : 96 / 25.4;
}
export const pxPerPt = (design) => (pxPerMm(design) * 25.4) / 72;

export function pageNumberText(fmt, i, n) {
  const k = i + 1;
  return { n: `${k}`, nN: `${k} / ${n}`, th: `หน้า ${k}`, thN: `หน้า ${k} จาก ${n}`, dash: `- ${k} -` }[fmt] ?? `${k}`;
}

/** Number of a page among the pages that are exported/shown (hidden pages are skipped). */
export function visibleNumber(design, pageIndex) {
  const vis = design.pages.map((p, i) => (p.hidden ? -1 : i)).filter((i) => i >= 0);
  return { i: vis.indexOf(pageIndex), n: vis.length };
}

/**
 * Plain descriptions of the decorations of one page, in design pixels.
 * `no` = 0-based page number among exported pages, `total` = number of exported pages.
 */
export function docDecorations(design, no, total) {
  if (!hasDoc(design)) return [];
  const s = docSettings(design);
  const W = design.width, H = design.height;
  const mm = pxPerMm(design), pt = pxPerPt(design);
  const edge = s.edge * mm;
  const side = Math.max(edge, s.border.style !== 'none' ? (s.border.inset + 4) * mm : 0);
  const out = [];
  if (s.border.style !== 'none') {
    out.push({ kind: 'border', inset: s.border.inset * mm, width: Math.max(0.5, s.border.width) * pt, color: s.border.color, style: s.border.style, W, H });
  }
  if (s.watermark.text.trim()) {
    const diag = Math.hypot(W, H);
    const text = s.watermark.text.trim();
    // as wide as ~60% of the diagonal, but never taller than ~22% of the short side
    const w100 = measureText(text, s.watermark.font, s.watermark.bold, 100);
    const fontSize = Math.min(((s.watermark.diagonal ? diag : W) * 0.6 * 100) / Math.max(1, w100), Math.min(W, H) * 0.22);
    out.push({
      kind: 'watermark', text, color: s.watermark.color, opacity: s.watermark.opacity,
      angle: s.watermark.diagonal ? -(Math.atan2(H, W) * 180) / Math.PI : 0,
      fontSize, textW: (w100 * fontSize) / 100, font: s.watermark.font, bold: s.watermark.bold, cx: W / 2, cy: H / 2,
    });
  }
  const num = s.pageNum.pos !== 'none' && no >= 0 && !(s.pageNum.skipFirst && no === 0) ? pageNumberText(s.pageNum.fmt, no, total) : '';
  const band = (where) => {
    const lines = [];
    const cfg = s[where];
    if (cfg.text.trim()) lines.push({ role: where, text: cfg.text, ...cfg });
    if (num && s.pageNum.pos === where) lines.push({ role: 'pagenum', text: num, ...s.pageNum, bold: false, italic: false });
    // lines stack top-down; the header starts at the edge distance, the footer ends there
    const LH = 1.3;
    const nl = (l) => String(l.text).split('\n').length;
    const total = lines.reduce((a, l) => a + l.size * pt * LH * nl(l), 0);
    let y = where === 'header' ? edge : H - edge - total;
    return lines.map((l) => {
      const fs = l.size * pt, lh = fs * LH * nl(l);
      const r = { kind: 'text', role: l.role, text: l.text, align: l.align, x: side, w: W - side * 2, y, h: lh, fontSize: fs, fontFamily: l.font, bold: !!l.bold, italic: !!l.italic, color: l.color, where, sizePt: l.size };
      y += lh;
      return r;
    });
  };
  out.push(...band('header'), ...band('footer'));
  return out;
}

/** Fabric objects for the decorations (static, not selectable, never saved into the page). */
export function decorationObjects(F, specs, exclude = true) {
  const objs = [];
  const base = { selectable: false, evented: false, excludeFromExport: exclude, docDeco: true, objectCaching: false };
  for (const sp of specs) {
    if (sp.kind === 'border') {
      const { inset: i, width: w, W, H } = sp;
      const rect = (d, sw) => new F.Rect({ ...base, left: i + d, top: i + d, width: W - (i + d) * 2, height: H - (i + d) * 2, fill: '', stroke: sp.color, strokeWidth: sw, originX: 'left', originY: 'top', strokeUniform: true });
      if (sp.style === 'double') { objs.push(rect(0, w), rect(w * 2.5, w)); objs.slice(-2).forEach((o) => { o.decoRole = 'border'; }); continue; }
      const r = rect(0, sp.style === 'thick' ? w * 2.5 : w);
      if (sp.style === 'dashed') r.set('strokeDashArray', [w * 5, w * 3]);
      if (sp.style === 'dotted') r.set({ strokeDashArray: [0.01, w * 2.5], strokeLineCap: 'round' });
      r.decoRole = 'border';
      objs.push(r);
    } else if (sp.kind === 'watermark') {
      const t = new F.Text(sp.text, { ...base, fontFamily: sp.font, fontWeight: sp.bold ? 'bold' : 'normal', fontSize: sp.fontSize, fill: sp.color, opacity: sp.opacity, originX: 'center', originY: 'center', left: sp.cx, top: sp.cy, angle: sp.angle });
      t.decoRole = 'watermark';
      objs.push(t);
    } else if (sp.kind === 'text') {
      objs.push(new F.Textbox(sp.text, {
        ...base, left: sp.x, top: sp.y, width: sp.w, fontSize: sp.fontSize, fontFamily: sp.fontFamily, lineHeight: 1.16,
        fontWeight: sp.bold ? 'bold' : 'normal', fontStyle: sp.italic ? 'italic' : 'normal', fill: sp.color, textAlign: sp.align,
        decoRole: sp.role,
      }));
    }
  }
  return objs;
}

/** Fonts used by the decorations (to load before drawing). */
export function decorationFonts(design) {
  if (!hasDoc(design)) return [];
  const s = docSettings(design);
  return [...new Set([s.header.font, s.footer.font, s.pageNum.font, s.watermark.font])];
}
