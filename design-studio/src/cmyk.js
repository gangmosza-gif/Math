// Print-ready CMYK PDF writer (no external PDF library): each page is a DeviceCMYK image
// at 300 dpi with 3 mm bleed and crop marks drawn as vector lines in 100% black.
import { zlibSync } from 'fflate';

const enc = new TextEncoder();

/** RGBA pixels → CMYK bytes (simple device conversion, no ICC profile). */
export function rgbaToCmyk(rgba) {
  const out = new Uint8Array((rgba.length / 4) * 4);
  for (let i = 0, j = 0; i < rgba.length; i += 4, j += 4) {
    const a = rgba[i + 3] / 255;
    // composite onto white first
    const r = (rgba[i] * a + 255 * (1 - a)) / 255, g = (rgba[i + 1] * a + 255 * (1 - a)) / 255, b = (rgba[i + 2] * a + 255 * (1 - a)) / 255;
    const k = 1 - Math.max(r, g, b);
    if (k >= 1) { out[j + 3] = 255; continue; }
    out[j] = Math.round(((1 - r - k) / (1 - k)) * 255);
    out[j + 1] = Math.round(((1 - g - k) / (1 - k)) * 255);
    out[j + 2] = Math.round(((1 - b - k) / (1 - k)) * 255);
    out[j + 3] = Math.round(k * 255);
  }
  return out;
}

/**
 * pages: [{ canvas: HTMLCanvasElement (incl. bleed), trimW, trimH (mm), bleed (mm), slug (mm) }]
 * returns Blob (application/pdf)
 */
export function buildCmykPdf(pages, title = 'Lai Studio') {
  const pt = (mm) => (mm * 72) / 25.4;
  const chunks = [];
  const offsets = [];
  let pos = 0;
  const push = (data) => { const b = typeof data === 'string' ? enc.encode(data) : data; chunks.push(b); pos += b.length; };
  const obj = (n, body) => { offsets[n] = pos; push(`${n} 0 obj\n`); body(); push('\nendobj\n'); };
  push('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
  const n = pages.length;
  // object numbers: 1 catalog, 2 pages, 3 info, then per page: page, content, image
  const pageObj = (i) => 4 + i * 3;
  obj(1, () => push('<< /Type /Catalog /Pages 2 0 R >>'));
  obj(2, () => push(`<< /Type /Pages /Count ${n} /Kids [${pages.map((_, i) => `${pageObj(i)} 0 R`).join(' ')}] >>`));
  obj(3, () => push(`<< /Producer (Lai Studio CMYK) /Title (${title.replace(/[()\\\\]/g, '').replace(/[^\x20-\x7e]/g, '')}) >>`));
  pages.forEach((p, i) => {
    const W = pt(p.trimW + 2 * (p.bleed + p.slug)), H = pt(p.trimH + 2 * (p.bleed + p.slug));
    const iw = pt(p.trimW + 2 * p.bleed), ih = pt(p.trimH + 2 * p.bleed), ix = pt(p.slug), iy = pt(p.slug);
    const x0 = pt(p.slug + p.bleed), y0 = pt(p.slug + p.bleed), x1 = x0 + pt(p.trimW), y1 = y0 + pt(p.trimH);
    const L = pt(p.slug - 1.5), e = pt(0.5);
    let marks = '';
    for (const x of [x0, x1]) marks += `${x.toFixed(2)} ${e.toFixed(2)} m ${x.toFixed(2)} ${(e + L).toFixed(2)} l S ${x.toFixed(2)} ${(H - e - L).toFixed(2)} m ${x.toFixed(2)} ${(H - e).toFixed(2)} l S `;
    for (const y of [y0, y1]) marks += `${e.toFixed(2)} ${y.toFixed(2)} m ${(e + L).toFixed(2)} ${y.toFixed(2)} l S ${(W - e - L).toFixed(2)} ${y.toFixed(2)} m ${(W - e).toFixed(2)} ${y.toFixed(2)} l S `;
    const content = `q ${iw.toFixed(3)} 0 0 ${ih.toFixed(3)} ${ix.toFixed(3)} ${iy.toFixed(3)} cm /Im0 Do Q\n0 0 0 1 K 0.25 w ${marks}\n`;
    const ctx = p.canvas.getContext('2d');
    const { data } = ctx.getImageData(0, 0, p.canvas.width, p.canvas.height);
    const img = zlibSync(rgbaToCmyk(data), { level: 6 });
    obj(pageObj(i), () => push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W.toFixed(3)} ${H.toFixed(3)}] /TrimBox [${x0.toFixed(3)} ${y0.toFixed(3)} ${x1.toFixed(3)} ${y1.toFixed(3)}] /BleedBox [${ix.toFixed(3)} ${iy.toFixed(3)} ${(ix + iw).toFixed(3)} ${(iy + ih).toFixed(3)}] /Resources << /XObject << /Im0 ${pageObj(i) + 2} 0 R >> >> /Contents ${pageObj(i) + 1} 0 R >>`));
    obj(pageObj(i) + 1, () => { push(`<< /Length ${enc.encode(content).length} >>\nstream\n`); push(content); push('\nendstream'); });
    obj(pageObj(i) + 2, () => {
      push(`<< /Type /XObject /Subtype /Image /Width ${p.canvas.width} /Height ${p.canvas.height} /ColorSpace /DeviceCMYK /BitsPerComponent 8 /Filter /FlateDecode /Length ${img.length} >>\nstream\n`);
      push(img);
      push('\nendstream');
    });
  });
  const total = 4 + n * 3;
  const xref = pos;
  push(`xref\n0 ${total}\n0000000000 65535 f \n`);
  for (let k = 1; k < total; k++) push(`${String(offsets[k]).padStart(10, '0')} 00000 n \n`);
  push(`trailer\n<< /Size ${total} /Root 1 0 R /Info 3 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  return new Blob(chunks, { type: 'application/pdf' });
}
