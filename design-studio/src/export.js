import { StaticCanvas } from 'fabric';
import { jsPDF } from 'jspdf';
import JSZip from 'jszip';
import { ensureFonts, fontsInJSON, fontCssUrl, FONT_NAMES } from './fonts.js';
import { buildCmykPdf } from './cmyk.js';

/** Render one page (serialized JSON string) to an offscreen fabric canvas. */
export async function renderPage(design, pageJSON, { transparent = false, forceBg = null, bleed = 0 } = {}) {
  const json = typeof pageJSON === 'string' ? JSON.parse(pageJSON) : pageJSON;
  await ensureFonts(fontsInJSON(json));
  const el = document.createElement('canvas');
  const sc = new StaticCanvas(el, { width: design.width + bleed * 2, height: design.height + bleed * 2, enableRetinaScaling: false, renderOnAddRemove: false });
  await sc.loadFromJSON(json);
  if (bleed) {
    // extend the page by `bleed` px on each side (print bleed)
    sc.viewportTransform = [1, 0, 0, 1, bleed, bleed];
    sc.backgroundVpt = false;
    const bi = sc.backgroundImage;
    if (bi) {
      const k = Math.max((design.width + bleed * 2) / bi.width, (design.height + bleed * 2) / bi.height);
      bi.set({ scaleX: k, scaleY: k, originX: 'left', originY: 'top', left: (design.width + bleed * 2 - bi.width * k) / 2, top: (design.height + bleed * 2 - bi.height * k) / 2 });
    }
  }
  if (transparent) sc.backgroundColor = '';
  else if (!sc.backgroundColor && forceBg) sc.backgroundColor = forceBg;
  sc.renderAll();
  return sc;
}

/** Links on a page: [{ url, left, top, width, height }] in design pixels. */
export async function pageLinks(design, pageJSON) {
  const json = typeof pageJSON === 'string' ? JSON.parse(pageJSON) : pageJSON;
  if (!(json.objects || []).some((o) => o.link)) return [];
  const sc = await renderPage(design, json);
  const out = sc.getObjects().filter((o) => o.link && o.visible).map((o) => ({ url: o.link, ...o.getBoundingRect() }));
  sc.dispose();
  return out;
}

export function safeURL(u) {
  u = String(u || '').trim();
  if (!u) return '';
  if (!/^(https?:|mailto:|tel:)/i.test(u)) u = /^[\w.-]+@[\w.-]+\.\w+$/.test(u) ? 'mailto:' + u : 'https://' + u.replace(/^\/+/, '');
  // PDF link targets must be plain ASCII: percent-encode Thai and other characters
  try { u = encodeURI(decodeURI(u)); } catch { u = encodeURI(u); }
  return u;
}

export async function pageToDataURL(design, pageJSON, { format = 'png', multiplier = 1, quality = 0.92, transparent = false, bleed = 0 } = {}) {
  const sc = await renderPage(design, pageJSON, { transparent: transparent && format === 'png', forceBg: format === 'png' ? null : '#ffffff', bleed });
  const url = sc.toDataURL({ format, multiplier, quality, enableRetinaScaling: false });
  sc.dispose();
  return url;
}

export async function pageToSVG(design, pageJSON) {
  const json = typeof pageJSON === 'string' ? JSON.parse(pageJSON) : pageJSON;
  const sc = await renderPage(design, json);
  let svg = sc.toSVG({ width: design.width, height: design.height, viewBox: { x: 0, y: 0, width: design.width, height: design.height } });
  sc.dispose();
  const fonts = fontsInJSON(json).filter((f) => FONT_NAMES.includes(f));
  if (fonts.length) {
    const imports = fonts.map((f) => `@import url('${fontCssUrl(f).replace(/&/g, '&amp;')}');`).join('\n');
    svg = svg.replace(/<defs>/, `<defs>\n<style type="text/css">${imports}</style>`);
  }
  return svg;
}

export function dataURLToBlob(url) {
  const [head, body] = url.split(',');
  const mime = head.match(/:(.*?);/)[1];
  const bin = atob(body);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

export function downloadBlob(blob, filename) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

const safeName = (n) => (n || 'design').replace(/[\\/:*?"<>|]+/g, '-').trim() || 'design';

/**
 * Export the design.
 * opts: { format: png|jpg|webp|svg|pdf|json, pages: [index], scale, quality, transparent, onProgress }
 */
export async function exportDesign(design, opts) {
  const { format, pages, scale = 1, quality = 0.92, transparent = false, onProgress = () => {} } = opts;
  const name = safeName(design.name);
  const list = pages.map((i) => ({ i, page: design.pages[i] }));

  if (format === 'json') {
    const blob = new Blob([JSON.stringify({ app: 'lai-studio', version: 1, design })], { type: 'application/json' });
    return downloadBlob(blob, `${name}.lai.json`);
  }

  if (format === 'pptx') {
    const { default: PptxGenJS } = await import('pptxgenjs');
    const pptx = new PptxGenJS();
    const wIn = design.width / 96, hIn = design.height / 96;
    const k = Math.min(1, 13.33 / Math.max(wIn, hIn) * 1.0);
    pptx.defineLayout({ name: 'LAI', width: Math.max(1, wIn * k), height: Math.max(1, hIn * k) });
    pptx.layout = 'LAI';
    for (let n = 0; n < list.length; n++) {
      onProgress(n, list.length);
      const url = await pageToDataURL(design, list[n].page.json, { format: 'png', multiplier: Math.max(1, scale) });
      pptx.addSlide().addImage({ data: url, x: 0, y: 0, w: wIn * k, h: hIn * k });
    }
    onProgress(list.length, list.length);
    const blob = await pptx.write({ outputType: 'blob' });
    return downloadBlob(blob, `${name}.pptx`);
  }

  if (format === 'pdf' && opts.print && opts.cmyk) return exportCmykPDF(design, list, name, onProgress);
  if (format === 'pdf' && opts.print) return exportPrintPDF(design, list, name, onProgress);

  if (format === 'pdf') {
    const mm = design.mm;
    const unit = mm ? 'mm' : 'pt';
    const pw = mm ? mm[0] : design.width * 0.75;
    const ph = mm ? mm[1] : design.height * 0.75;
    const orientation = pw > ph ? 'landscape' : 'portrait';
    const pdf = new jsPDF({ orientation, unit, format: [pw, ph], compress: true });
    for (let k = 0; k < list.length; k++) {
      onProgress(k, list.length);
      if (k > 0) pdf.addPage([pw, ph], orientation);
      const url = await pageToDataURL(design, list[k].page.json, { format: 'jpeg', multiplier: scale, quality: 0.95 });
      pdf.addImage(url, 'JPEG', 0, 0, pw, ph, undefined, 'FAST');
      const f = pw / design.width;
      for (const l of await pageLinks(design, list[k].page.json)) pdf.link(l.left * f, l.top * f, l.width * f, l.height * f, { url: l.url });
    }
    onProgress(list.length, list.length);
    return downloadBlob(pdf.output('blob'), `${name}.pdf`);
  }

  const ext = format === 'jpg' ? 'jpg' : format;
  const files = [];
  for (let k = 0; k < list.length; k++) {
    onProgress(k, list.length);
    const { i, page } = list[k];
    let blob;
    if (format === 'svg') {
      blob = new Blob([await pageToSVG(design, page.json)], { type: 'image/svg+xml' });
    } else {
      const f = format === 'jpg' ? 'jpeg' : format;
      blob = dataURLToBlob(await pageToDataURL(design, page.json, { format: f, multiplier: scale, quality, transparent }));
    }
    files.push({ blob, filename: list.length > 1 ? `page-${String(i + 1).padStart(2, '0')}.${ext}` : `${name}.${ext}` });
  }
  onProgress(list.length, list.length);

  if (files.length === 1) return downloadBlob(files[0].blob, files[0].filename);
  const zip = new JSZip();
  files.forEach((f) => zip.file(f.filename, f.blob));
  const blob = await zip.generateAsync({ type: 'blob' });
  return downloadBlob(blob, `${name}.zip`);
}

/** Open the browser print dialog with every page as an image. */
export async function printDesign(design) {
  const imgs = [];
  for (const p of design.pages.filter((x) => !x.hidden)) imgs.push(await pageToDataURL(design, p.json, { format: 'png', multiplier: 2 }));
  const frame = document.createElement('iframe');
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
  document.body.appendChild(frame);
  const size = design.mm ? `${design.mm[0]}mm ${design.mm[1]}mm` : `${design.width * 0.75}pt ${design.height * 0.75}pt`;
  const doc = frame.contentDocument;
  doc.open();
  doc.write(`<!doctype html><html><head><style>@page{size:${size};margin:0}html,body{margin:0}img{display:block;width:100%;height:100vh;object-fit:contain;page-break-after:always}</style></head><body>${imgs.map((s) => `<img src="${s}">`).join('')}</body></html>`);
  doc.close();
  await new Promise((r) => setTimeout(r, 400));
  frame.contentWindow.focus();
  frame.contentWindow.print();
  setTimeout(() => frame.remove(), 60000);
}

/** Small thumbnail data URL for a page. */
export async function pageThumb(design, pageJSON, width = 240) {
  return pageToDataURL(design, pageJSON, { format: 'jpeg', multiplier: width / design.width, quality: 0.8 });
}

/** Print-ready PDF: 300 dpi, 3 mm bleed and crop marks. */
async function exportPrintPDF(design, list, name, onProgress) {
  const pxPerMM = design.mm ? design.width / design.mm[0] : 96 / 25.4;
  const tw = design.mm ? design.mm[0] : design.width / pxPerMM;
  const th = design.mm ? design.mm[1] : design.height / pxPerMM;
  const bleedMM = 3, slugMM = 8;
  const pw = tw + 2 * (bleedMM + slugMM), ph = th + 2 * (bleedMM + slugMM);
  const orientation = pw > ph ? 'landscape' : 'portrait';
  const pdf = new jsPDF({ orientation, unit: 'mm', format: [pw, ph], compress: true });
  const multiplier = Math.max(1, (300 / 25.4) / pxPerMM);
  for (let k = 0; k < list.length; k++) {
    onProgress(k, list.length);
    if (k > 0) pdf.addPage([pw, ph], orientation);
    const url = await pageToDataURL(design, list[k].page.json, { format: 'jpeg', multiplier, quality: 0.95, bleed: Math.round(bleedMM * pxPerMM) });
    pdf.addImage(url, 'JPEG', slugMM, slugMM, tw + 2 * bleedMM, th + 2 * bleedMM, undefined, 'FAST');
    const f = tw / design.width, o = slugMM + bleedMM;
    for (const l of await pageLinks(design, list[k].page.json)) pdf.link(o + l.left * f, o + l.top * f, l.width * f, l.height * f, { url: l.url });
    // crop marks at the trim edges, drawn in the slug area
    pdf.setDrawColor(0);
    pdf.setLineWidth(0.25);
    const x0 = slugMM + bleedMM, y0 = slugMM + bleedMM, x1 = x0 + tw, y1 = y0 + th;
    const len = slugMM - 1.5;
    for (const x of [x0, x1]) { pdf.line(x, 0.5, x, 0.5 + len); pdf.line(x, ph - 0.5 - len, x, ph - 0.5); }
    for (const y of [y0, y1]) { pdf.line(0.5, y, 0.5 + len, y); pdf.line(pw - 0.5 - len, y, pw - 0.5, y); }
  }
  onProgress(list.length, list.length);
  return downloadBlob(pdf.output('blob'), `${name}-print.pdf`);
}

/** Print PDF in CMYK (300 dpi, 3 mm bleed, crop marks). */
async function exportCmykPDF(design, list, name, onProgress) {
  const pxPerMM = design.mm ? design.width / design.mm[0] : 96 / 25.4;
  const tw = design.mm ? design.mm[0] : design.width / pxPerMM;
  const th = design.mm ? design.mm[1] : design.height / pxPerMM;
  const multiplier = Math.max(1, (300 / 25.4) / pxPerMM);
  const pages = [];
  for (let k = 0; k < list.length; k++) {
    onProgress(k, list.length);
    const sc = await renderPage(design, list[k].page.json, { forceBg: '#ffffff', bleed: Math.round(3 * pxPerMM) });
    const canvas = sc.toCanvasElement(multiplier);
    sc.dispose();
    pages.push({ canvas, trimW: tw, trimH: th, bleed: 3, slug: 8 });
  }
  onProgress(list.length, list.length);
  return downloadBlob(buildCmykPdf(pages, design.name), `${name}-print-cmyk.pdf`);
}
