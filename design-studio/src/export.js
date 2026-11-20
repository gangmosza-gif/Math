import { StaticCanvas } from 'fabric';
import { jsPDF } from 'jspdf';
import JSZip from 'jszip';
import { ensureFonts, fontsInJSON, fontCssUrl, FONT_NAMES } from './fonts.js';

/** Render one page (serialized JSON string) to an offscreen fabric canvas. */
export async function renderPage(design, pageJSON, { transparent = false, forceBg = null } = {}) {
  const json = typeof pageJSON === 'string' ? JSON.parse(pageJSON) : pageJSON;
  await ensureFonts(fontsInJSON(json));
  const el = document.createElement('canvas');
  const sc = new StaticCanvas(el, { width: design.width, height: design.height, enableRetinaScaling: false, renderOnAddRemove: false });
  await sc.loadFromJSON(json);
  if (transparent) sc.backgroundColor = '';
  else if (!sc.backgroundColor && forceBg) sc.backgroundColor = forceBg;
  sc.renderAll();
  return sc;
}

export async function pageToDataURL(design, pageJSON, { format = 'png', multiplier = 1, quality = 0.92, transparent = false } = {}) {
  const sc = await renderPage(design, pageJSON, { transparent: transparent && format === 'png', forceBg: format === 'png' ? null : '#ffffff' });
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
  for (const p of design.pages) imgs.push(await pageToDataURL(design, p.json, { format: 'png', multiplier: 2 }));
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
