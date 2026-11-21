/*
 * Lai Studio – Word (.docx) test for documents and reports.
 *
 *   npm run build && npm run test:docs
 *
 * Builds report-style documents in the app with different document setups
 * (no page numbers / page numbers in header or footer / number formats / no number on the cover,
 *  watermark or not, header & footer text in bold or colour, page borders of every style, headings),
 * exports each one to Word and checks:
 *   1. Word structure: real header & footer, PAGE / NUMPAGES fields, Word watermark, page border, heading styles
 *   2. rendered with LibreOffice: page count, header/footer/page number text in the right place on every page,
 *      watermark and border visible, page looks like the design
 *   3. editable: python-docx edits header, footer, a heading, a table cell, makes text bold and adds a new page;
 *      the edits show after rendering and the page numbers update by themselves
 *   4. survives open-and-save in LibreOffice (header/footer, page fields and watermark are kept)
 * Needs what tests/office.cjs needs, plus python3 with python-docx.
 * Report: tests/report-docs/REPORT.md
 */
const { spawn, execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { chromium } = require('playwright');
const JSZip = require(path.join(__dirname, '../node_modules/jszip'));

const ROOT = path.join(__dirname, '..');
const OUT = path.join(__dirname, 'report-docs');
const PORT = 4183;
const URL = `http://localhost:${PORT}/`;
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

const results = [];
let section = '';
const group = (n) => { section = n; console.log('\n' + n); };
async function step(name, fn) {
  try {
    const note = await fn();
    results.push({ section, name, ok: true, note: note || '' });
    console.log(`  ✓ ${name}${note ? '  — ' + note : ''}`);
  } catch (e) {
    results.push({ section, name, ok: false, note: String(e.message || e).split('\n')[0] });
    console.log(`  ✗ ${name}\n      ${String(e.message || e).split('\n').slice(0, 6).join('\n      ')}`);
  }
}
const assert = (c, m) => { if (!c) throw new Error(m); };
const run = (cmd, args, opts = {}) => execFileSync(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'], timeout: 180000, ...opts }).toString();
const norm = (s) => String(s).normalize('NFC').replace(/[\s​ ]+/g, '');

// ---------------------------------------------------------------- fonts for LibreOffice (same as office.cjs)
const FONT_DIR = path.join(os.homedir(), '.local/share/fonts/lai-studio');
function ensureFonts(families) {
  fs.mkdirSync(FONT_DIR, { recursive: true });
  let added = 0;
  for (const fam of families) {
    const mark = path.join(FONT_DIR, fam.replace(/ /g, '_') + '.ok');
    if (fs.existsSync(mark)) continue;
    let css = '';
    for (const sp of [':ital,wght@0,400;0,700;1,400;1,700', ':wght@400;700', '']) {
      try { css = run('curl', ['-sf', `https://fonts.googleapis.com/css2?family=${fam.replace(/ /g, '+')}${sp}`]); if (css.includes('@font-face')) break; } catch { /* next */ }
    }
    const urls = [...css.matchAll(/url\((https:[^)]+\.ttf)\)/g)].map((m) => m[1]);
    urls.forEach((u, i) => { run('curl', ['-sfL', '-o', path.join(FONT_DIR, `${fam.replace(/ /g, '_')}-${i}.ttf`), u]); added++; });
    fs.writeFileSync(mark, String(urls.length));
  }
  if (added) run('fc-cache', ['-f', FONT_DIR]);
  return added;
}

// ---------------------------------------------------------------- pdf / image helpers
const pdfPages = (pdf) => +run('pdfinfo', [pdf]).match(/Pages:\s+(\d+)/)[1];
function pdfSize(pdf) { const m = run('pdfinfo', [pdf]).match(/Page size:\s+([\d.]+) x ([\d.]+)/); return { w: +m[1], h: +m[2] }; }
function toPdf(file, dir) {
  fs.mkdirSync(dir, { recursive: true });
  run('soffice', ['--headless', '--convert-to', 'pdf', '--outdir', dir, file], { timeout: 240000 });
  return path.join(dir, path.basename(file).replace(/\.\w+$/, '.pdf'));
}
function renderPdf(pdf, prefix, w, h) {
  run('pdftoppm', ['-r', '72', '-scale-to-x', String(w), '-scale-to-y', String(h), pdf, prefix]);
  return fs.readdirSync(path.dirname(prefix)).filter((f) => f.startsWith(path.basename(prefix) + '-') && f.endsWith('.ppm')).sort().map((f) => path.join(path.dirname(prefix), f));
}
function readPPM(f) {
  const b = fs.readFileSync(f);
  const head = b.toString('latin1', 0, 40).split(/\s+/);
  const w = +head[1], h = +head[2];
  return { w, h, data: b.subarray(b.length - w * h * 3) };
}
function diff(a, b, mask = []) {
  if (a.w !== b.w || a.h !== b.h) return { mean: 255, changed: 1 };
  let s = 0, changed = 0, n = 0;
  for (let y = 0; y < a.h; y++) for (let x = 0; x < a.w; x++) {
    if (mask.some((m) => x >= m.x && x < m.x + m.w && y >= m.y && y < m.y + m.h)) continue;
    const i = (y * a.w + x) * 3;
    const d = (Math.abs(a.data[i] - b.data[i]) + Math.abs(a.data[i + 1] - b.data[i + 1]) + Math.abs(a.data[i + 2] - b.data[i + 2])) / 3;
    s += d; n++;
    if (d > 48) changed++;
  }
  return { mean: s / n, changed: changed / n };
}
/** Share of light pixels tinted towards the watermark colour inside the central box. */
function tint(img, hex) {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const dom = c.indexOf(Math.max(...c)); // dominant channel of the watermark colour
  let hit = 0, n = 0;
  for (let y = Math.round(img.h * 0.3); y < img.h * 0.7; y++) for (let x = Math.round(img.w * 0.2); x < img.w * 0.8; x++) {
    const i = (y * img.w + x) * 3;
    const p = [img.data[i], img.data[i + 1], img.data[i + 2]];
    n++;
    const others = p.filter((_, k) => k !== dom);
    if ((p[0] + p[1] + p[2]) / 3 > 150 && p[dom] - Math.max(...others) > 10) hit++;
  }
  return hit / n;
}
/** Share of pixels along the four border lines (at `inset` px from the edge) that differ from white. */
function borderCoverage(img, inset) {
  let hit = 0, n = 0;
  const dark = (x, y) => { const i = (y * img.w + x) * 3; return (765 - img.data[i] - img.data[i + 1] - img.data[i + 2]) / 3 > 50; };
  const near = (x, y, horiz) => { for (let d = -3; d <= 3; d++) { const xx = horiz ? x : x + d, yy = horiz ? y + d : y; if (xx >= 0 && yy >= 0 && xx < img.w && yy < img.h && dark(xx, yy)) return true; } return false; };
  for (let x = Math.round(img.w * 0.3); x < img.w * 0.7; x++) { n += 2; hit += near(x, Math.round(inset), true) + near(x, Math.round(img.h - 1 - inset), true); }
  for (let y = Math.round(img.h * 0.3); y < img.h * 0.7; y++) { n += 2; hit += near(Math.round(inset), y, false) + near(Math.round(img.w - 1 - inset), y, false); }
  return hit / n;
}
/** Words with their boxes on one PDF page (pdftotext -bbox). */
function words(pdf, page) {
  const x = run('pdftotext', ['-bbox', '-f', String(page), '-l', String(page), '-enc', 'UTF-8', pdf, '-']);
  const dec = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&');
  return [...x.matchAll(/<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">([^<]*)<\/word>/g)].map((m) => ({ x: +m[1], y: +m[2], x2: +m[3], y2: +m[4], t: dec(m[5]) }));
}
/** Text in the header band and footer band of a page (above / below the given margins in pt; default 11%). */
function bands(pdf, page, top, bottom) {
  const { h } = pdfSize(pdf);
  const ws = words(pdf, page).filter((w) => w.t.trim());
  const pick = (f) => {
    // reading order: group words into lines (overlapping vertical ranges), then left to right
    const lines = [];
    for (const w of ws.filter(f).sort((a, b) => a.y - b.y)) {
      // words of one line share their box top (same font size) or their box bottom (mixed sizes)
      const line = lines.find((l) => l.ws.some((o) => Math.abs(o.y - w.y) < 2 || Math.abs(o.y2 - w.y2) < 2));
      if (line) { line.ws.push(w); line.y = Math.min(line.y, w.y); } else lines.push({ y: w.y, ws: [w] });
    }
    return norm(lines.sort((a, b) => a.y - b.y).map((l) => l.ws.sort((a, b) => a.x - b.x).map((w) => w.t).join('')).join(''));
  };
  const t = top ?? h * 0.11, b = bottom ?? h * 0.11;
  return { header: pick((w) => w.y2 < t + 1), footer: pick((w) => w.y > h - b - 1), all: pick(() => true) };
}
/** Reading-order text of a page (pdftotext -raw), whitespace removed. */
const rawText = (pdf, page) => norm(run('pdftotext', ['-raw', '-f', String(page), '-l', String(page), '-enc', 'UTF-8', pdf, '-']));
const pageNumberText = (fmt, i, n) => ({ n: `${i + 1}`, nN: `${i + 1} / ${n}`, th: `หน้า ${i + 1}`, thN: `หน้า ${i + 1} จาก ${n}`, dash: `- ${i + 1} -` }[fmt]);
/** What the header/footer band of page i must read. */
function expectedBands(doc, i, n) {
  const out = { header: '', footer: '' };
  for (const where of ['header', 'footer']) {
    const parts = [];
    if (doc[where] && doc[where].text) parts.push(doc[where].text);
    const pn = doc.pageNum || {};
    if (pn.pos === where && !(pn.skipFirst && i === 0)) parts.push(pageNumberText(pn.fmt || 'n', i, n));
    out[where] = norm(parts.join(''));
  }
  return out;
}

// ---------------------------------------------------------------- document variants
const RED = '#c62828', BLUE = '#1d4ed8';
const VARIANTS = [
  { key: 'plain', title: 'รายงานธรรมดา: ไม่มีเลขหน้า ไม่มีลายน้ำ ไม่มีหัว/ท้ายกระดาษ', preset: 6, doc: null },
  { key: 'pagenum', title: 'ใส่เลขหน้าอย่างเดียว (ท้ายกระดาษ กึ่งกลาง แบบ 1)', preset: 6, doc: { pageNum: { pos: 'footer', align: 'center', fmt: 'n' } } },
  { key: 'cover', title: 'มีหน้าปก: เลขหน้าบนหัวกระดาษชิดขวา “หน้า 1 จาก 3” ไม่แสดงในหน้าแรก + หัวกระดาษชิดซ้าย', preset: 6,
    doc: { header: { text: 'รายงานประจำปี 2569', align: 'left' }, pageNum: { pos: 'header', align: 'right', fmt: 'thN', skipFirst: true } } },
  { key: 'watermark', title: 'ใส่ลายน้ำ “ร่าง” แนวทแยงอย่างเดียว ไม่มีเลขหน้า', preset: 6, doc: { watermark: { text: 'ร่าง', color: '#e5484d', opacity: 0.2, diagonal: true } } },
  { key: 'secret', title: 'เอกสารลับ: หัวกระดาษ “ลับ” ตัวหนาสีแดง ท้ายกระดาษสีแดง เลขหน้า - 1 - ลายน้ำ “ลับมาก” ขอบกระดาษเส้นเดี่ยวสีแดง', preset: 6,
    doc: {
      header: { text: 'ลับ', align: 'center', bold: true, color: RED, size: 18, font: 'Sarabun' },
      footer: { text: 'ห้ามเผยแพร่โดยไม่ได้รับอนุญาต', align: 'left', bold: true, color: RED, size: 11 },
      pageNum: { pos: 'footer', align: 'right', fmt: 'dash' },
      watermark: { text: 'ลับมาก', color: '#e5484d', opacity: 0.2, diagonal: true },
      border: { style: 'single', color: RED, width: 1.5, inset: 8 },
    } },
  { key: 'full', title: 'A4 แนวนอนครบทุกอย่าง: หัวกระดาษตัวเอียงสีน้ำเงิน ท้ายกระดาษชิดขวา เลขหน้า 1 / 3 ลายน้ำ DRAFT แนวนอน ขอบเส้นคู่ + เลขหน้าที่วางเองบนหน้า', preset: 7,
    doc: {
      header: { text: 'บริษัท ตัวอย่าง จำกัด', align: 'left', italic: true, color: BLUE, size: 12, font: 'Prompt' },
      footer: { text: 'โทร 02-000-0000', align: 'right', size: 10 },
      pageNum: { pos: 'footer', align: 'center', fmt: 'nN' },
      watermark: { text: 'DRAFT', color: '#2563eb', opacity: 0.15, diagonal: false },
      border: { style: 'double', color: '#1f2333', width: 1, inset: 7 },
    }, placedNumber: true },
  { key: 'dotted', title: 'ขอบกระดาษเส้นจุด + หัวกระดาษชิดขวา ไม่มีเลขหน้า', preset: 6, doc: { header: { text: 'ฝ่ายบุคคล', align: 'right' }, border: { style: 'dotted', color: '#0f766e', width: 2, inset: 9 } } },
  { key: 'thick', title: 'ขอบกระดาษเส้นหนาสีม่วง + เลขหน้า “หน้า 1” ท้ายกระดาษชิดซ้าย', preset: 6, doc: { pageNum: { pos: 'footer', align: 'left', fmt: 'th' }, border: { style: 'thick', color: '#6d28d9', width: 1.5, inset: 6 } } },
  { key: 'dashed', title: 'ขอบกระดาษเส้นประ + ท้ายกระดาษสองบรรทัด', preset: 6, doc: { footer: { text: 'สำนักงานเขตพื้นที่การศึกษา\nโทร 0-2000-0000', align: 'center' }, border: { style: 'dashed', color: '#334155', width: 1.25, inset: 8 } } },
];

(async () => {
  group('0. เตรียมระบบทดสอบ');
  const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { cwd: ROOT, stdio: 'ignore' });
  for (let i = 0; i < 50; i++) { try { await fetch(URL); break; } catch { await new Promise((r) => setTimeout(r, 200)); } }
  const proxy = process.env.HTTPS_PROXY || process.env.https_proxy;
  const browser = await chromium.launch({ env: { ...process.env, LANG: 'C.UTF-8', LC_ALL: 'C.UTF-8' }, ...(proxy ? { proxy: { server: proxy, bypass: 'localhost,127.0.0.1' } } : {}) });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, ignoreHTTPSErrors: true, acceptDownloads: true });
  const page = await ctx.newPage();
  page.setDefaultTimeout(30000);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const ev = (fn, a) => page.evaluate(fn, a);
  await step('ติดตั้งฟอนต์ให้ LibreOffice และตรวจว่ามี python-docx', async () => {
    ensureFonts(['Sarabun', 'Kanit', 'Prompt']);
    return run('python3', ['-c', 'import docx; print("python-docx", docx.__version__)']).trim();
  });

  const exportFile = async (fmt, base) => {
    await page.click('[data-act="export"]');
    await page.click(`.fmt:has(input[value="${fmt}"])`);
    if (fmt === 'docx') {
      // documents default to the flowing Word layout
      assert((await page.$eval('[data-docxmode]', (s) => s.value)) === 'flow', 'flow is not the default for documents');
    }
    const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 120000 }), page.click('[data-go]')]);
    const f = path.join(OUT, `${base}.${fmt === 'pdf' ? 'ref.pdf' : fmt}`);
    await dl.saveAs(f);
    return f;
  };

  const summary = [];
  for (const V of VARIANTS) {
    group(`${summary.length + 1}. ${V.title}`);
    await page.goto(URL);
    await page.waitForSelector('.preset');
    await page.click(`.preset[data-preset="${V.preset}"]`);
    await page.waitForFunction(() => window.__lai && document.querySelector('.canvas-container'));
    await page.waitForTimeout(400);
    // ---- 3-page report: cover / chapter 1 (headings, styled words, list) / chapter 2 (table)
    await ev(async ({ doc, placedNumber }) => {
      const L = __lai;
      const W = L.W, H = L.H;
      const put = async (kind, text, top, o = {}) => {
        const t = await L.addText(kind, { text, width: W * 0.76, textAlign: 'left', ...o });
        t.set({ left: o.left ?? W * 0.12, top: H * top });
        t.setCoords();
        return t;
      };
      await put('heading', 'รายงานประจำปี', 0.3, { textAlign: 'center' });
      await put('sub', 'ประจำปีงบประมาณ 2569', 0.42, { textAlign: 'center' });
      await put('body', 'จัดทำโดย ฝ่ายวิชาการ', 0.55, { textAlign: 'center' });
      L.commit();
      await L.addPage();
      await put('heading', 'บทที่ 1 บทนำ', 0.15);
      await put('sub', '1.1 ที่มาและความสำคัญ', 0.27);
      const p = await put('body', 'โครงการนี้มีความสำคัญมากต่อการพัฒนาคุณภาพการเรียนรู้ และมีบางเรื่องที่ต้องแก้ไขด่วนก่อนสิ้นปี', 0.36);
      // Fabric indexes characters by grapheme cluster (Thai vowels/tone marks join their consonant)
      const g = (str) => p.graphemeSplit(str).length;
      const mark = (word, style) => { const i = p.text.indexOf(word); p.setSelectionStyles(style, g(p.text.slice(0, i)), g(p.text.slice(0, i)) + g(word)); };
      mark('สำคัญมาก', { fontWeight: 'bold' });
      mark('ต้องแก้ไขด่วน', { fill: '#c62828', fontWeight: 'bold' });
      await put('sub', '1.2 วัตถุประสงค์', 0.55);
      await put('body', '• เพื่อพัฒนาผู้เรียน\n• เพื่อปรับปรุงหลักสูตร', 0.64);
      L.commit();
      await L.addPage();
      await put('heading', 'บทที่ 2 ผลการศึกษา', 0.15);
      await put('body', 'ผลการศึกษาพบว่าผู้เรียนมีผลสัมฤทธิ์สูงขึ้น', 0.27);
      await L.addSmart('table');
      const tb = L.canvas.getActiveObject();
      const k = (W * 0.6) / tb.width;
      tb.set({ scaleX: k, scaleY: k, left: W * 0.12, top: H * 0.38 });
      tb.setCoords();
      if (placedNumber) {
        const n = await L.addPageNumber('n');
        n.set({ left: W * 0.85, top: H * 0.15 });
        n.setCoords();
      }
      L.canvas.discardActiveObject();
      L.commit();
      if (doc) for (const [k1, v] of Object.entries(doc)) for (const [k2, val] of Object.entries(v)) L.setDoc(`${k1}.${k2}`, val, { history: false });
      L.pushHistory();
      await L.loadPage(0);
    }, { doc: V.doc, placedNumber: !!V.placedNumber });
    await page.waitForTimeout(1500);
    await ev(() => __lai.saveNow());
    await page.screenshot({ path: path.join(OUT, `${V.key}-editor.png`) });
    const info = await ev(() => ({ W: __lai.W, H: __lai.H, doc: __lai.design.doc || null, pages: __lai.design.pages.length, edgeMm: (__lai.design.doc && __lai.design.doc.edge) || 10 }));
    const doc = info.doc || {};
    const N = info.pages;

    const ref = await exportFile('pdf', V.key);
    const docx = await exportFile('docx', V.key);
    const zip = await JSZip.loadAsync(fs.readFileSync(docx));
    const xml = async (f) => (zip.file(f) ? zip.file(f).async('string') : '');
    const documentXml = await xml('word/document.xml');
    const headers = await Promise.all(Object.keys(zip.files).filter((f) => /^word\/header\d*\.xml$/.test(f)).sort().map(xml));
    const footers = await Promise.all(Object.keys(zip.files).filter((f) => /^word\/footer\d*\.xml$/.test(f)).sort().map(xml));
    const allHF = headers.join('') + footers.join('');
    const textOf = (x) => norm([...x.matchAll(/<w:t(?: [^>]*)?>([^<]*)<\/w:t>/g)].map((m) => m[1]).join(''));
    const hasNum = doc.pageNum && doc.pageNum.pos && doc.pageNum.pos !== 'none';
    const wm = doc.watermark && doc.watermark.text;
    const bd = doc.border && doc.border.style && doc.border.style !== 'none' ? doc.border.style : null;

    // ---------------- 1. Word structure
    await step('[โครงสร้าง Word] หัวกระดาษ/ท้ายกระดาษเป็นส่วนหัว-ท้ายของ Word จริง ข้อความและรูปแบบถูกต้อง', async () => {
      for (const where of ['header', 'footer']) {
        const want = doc[where] && doc[where].text;
        const parts = where === 'header' ? headers : footers;
        if (!want) { assert(!parts.some((x) => textOf(x).includes(norm('ลับ')) && !wm), `${where} should be empty`); continue; }
        assert(parts.length > 0 && parts.every((x) => textOf(x).includes(norm(want))), `${where} text "${want}" missing: ${parts.map(textOf)}`);
        const x = parts[0];
        if (doc[where].bold) assert(/<w:b\/>/.test(x) && /<w:bCs\/>/.test(x), `${where} not bold`);
        if (doc[where].italic) assert(/<w:i\/>/.test(x), `${where} not italic`);
        if (doc[where].color) assert(x.includes(`w:val="${doc[where].color.slice(1).toUpperCase()}"`), `${where} colour`);
      }
      assert(/w:headerReference/.test(documentXml) === !!((doc.header && doc.header.text) || wm || (doc.footer && doc.footer.text) || hasNum || bd), 'header references');
      return `หัว ${headers.length} ส่วน, ท้าย ${footers.length} ส่วน`;
    });
    await step(`[โครงสร้าง Word] เลขหน้า${hasNum ? 'เป็นฟิลด์ PAGE ของ Word (นับเองอัตโนมัติ)' : ': ไม่มีเลขหน้า'}`, async () => {
      const pageField = /PAGE/.test(allHF) && /(fldSimple|instrText)/.test(allHF) && /(w:instr="\s*PAGE|>\s*PAGE\s*<)/.test(allHF);
      const total = /NUMPAGES/.test(allHF);
      if (!hasNum) { assert(!pageField && !total, 'unexpected PAGE field'); return 'ไม่มีฟิลด์เลขหน้า ถูกต้อง'; }
      assert(pageField, 'no PAGE field');
      const wantTotal = ['nN', 'thN'].includes(doc.pageNum.fmt);
      assert(total === wantTotal, `NUMPAGES ${total} vs ${wantTotal}`);
      const title = /<w:titlePg\/>/.test(documentXml);
      assert(title === !!doc.pageNum.skipFirst, `titlePg ${title}`);
      if (V.placedNumber) assert(/(w:instr="\s*PAGE|>\s*PAGE\s*<)/.test(documentXml), 'page number placed on the page is not a field');
      return `PAGE${total ? ' + NUMPAGES' : ''}${title ? ', หน้าแรกไม่มีเลขหน้า' : ''}${V.placedNumber ? ', เลขหน้าบนหน้ากระดาษเป็นฟิลด์ด้วย' : ''}`;
    });
    await step(`[โครงสร้าง Word] ลายน้ำ${wm ? ` “${wm}” เป็นลายน้ำของ Word (แก้ได้ที่ ออกแบบ → ลายน้ำ)` : ': ไม่มี'}`, async () => {
      const n = headers.filter((x) => x.includes('PowerPlusWaterMarkObject')).length;
      if (!wm) { assert(n === 0, 'unexpected watermark'); return 'ไม่มีลายน้ำ ถูกต้อง'; }
      assert(n === headers.length && n > 0, `watermark in ${n}/${headers.length} headers`);
      assert(headers.every((x) => x.includes(`string="${wm}"`) && x.includes('_x0000_t136') && /xmlns:v=/.test(x)), 'watermark markup');
      return `อยู่ในหัวกระดาษทั้ง ${n} ส่วน`;
    });
    await step(`[โครงสร้าง Word] ขอบหน้ากระดาษ${bd ? ` แบบ ${bd}` : ': ไม่มี'}`, async () => {
      const m = documentXml.match(/<w:pgBorders[^>]*>[\s\S]*?<\/w:pgBorders>/g) || [];
      if (!bd) { assert(!m.length, 'unexpected border'); return 'ไม่มีขอบ ถูกต้อง'; }
      const want = { single: 'single', thick: 'single', double: 'double', dashed: 'dashed', dotted: 'dotted' }[bd];
      assert(m.length === N && m.every((b) => (b.match(new RegExp(`w:val="${want}"`, 'g')) || []).length === 4), `borders ${m.length}`);
      assert(m[0].includes(`w:color="${doc.border.color.slice(1).toUpperCase()}"`), 'border colour');
      return `${m.length} หน้า × 4 ด้าน`;
    });
    await step('[โครงสร้าง Word] เป็นเอกสาร Word ปกติ: ไม่มีกล่องข้อความ ย่อหน้าไหลต่อกันตามลำดับการอ่าน ตารางอยู่ในเนื้อความ', async () => {
      assert(!/w:framePr/.test(documentXml), 'text frames found');
      assert(!/w:tblpPr/.test(documentXml), 'floating table found');
      const body = textOf(documentXml);
      const order = ['รายงานประจำปี', 'ประจำปีงบประมาณ2569', 'บทที่1บทนำ', '1.1ที่มาและความสำคัญ', 'โครงการนี้', '1.2วัตถุประสงค์', 'เพื่อพัฒนาผู้เรียน', 'บทที่2ผลการศึกษา', 'ผลการศึกษาพบว่า', 'หัวข้อ', 'รายการ1'];
      const pos = order.map((t) => body.indexOf(norm(t)));
      assert(pos.every((p, i) => p >= 0 && (i === 0 || p > pos[i - 1])), `reading order ${order.map((t, i) => t + ':' + pos[i]).join(' ')}`);
      const bullets = (documentXml.match(/<w:numPr>/g) || []).length;
      assert(bullets === 2 && !body.includes('•เพื่อ'), `bullet list ${bullets}`);
      return 'ไม่มีกรอบข้อความ, ลำดับถูก, รายการเป็นบูลเล็ตของ Word';
    });
    await step('[อ่านแบบง่าย] โปรแกรมอ่านไฟล์ Word ที่ไม่สนตำแหน่ง (pandoc) ได้รายงานเรียงถูก หัวข้อ รายการ และตารางครบ', async () => {
      let md;
      try { md = run('pandoc', [docx, '-t', 'markdown']); } catch { return 'ข้าม: ไม่มี pandoc ในเครื่อง'; }
      const lines = md.split('\n');
      const at = (re) => lines.findIndex((l) => re.test(l));
      const seq = [/^# .*บทที่ 1 บทนำ/, /^## .*1\.1 ที่มาและความสำคัญ/, /สำคัญมาก/, /^## .*1\.2 วัตถุประสงค์/, /^-\s+เพื่อพัฒนาผู้เรียน/, /^-\s+เพื่อปรับปรุงหลักสูตร/, /^# .*บทที่ 2 ผลการศึกษา/, /^ผลการศึกษาพบว่า/, /หัวข้อ.*ค่า A.*ค่า B/, /รายการ 3\s+12\s+30/];
      const pos = seq.map(at);
      assert(pos.every((p, i) => p >= 0 && (i === 0 || p > pos[i - 1])), 'order/structure: ' + seq.map((r, i) => `${r.source}:${pos[i]}`).join(' '));
      fs.writeFileSync(path.join(OUT, `${V.key}.md`), md);
      return 'หัวข้อ # / ##, รายการ -, ตาราง และลำดับถูกต้อง';
    });
    await step('[โครงสร้าง Word] หัวข้อเป็นสไตล์ Heading 1 / Heading 2 (แสดงในบานหน้าต่างนำทางและสร้างสารบัญได้)', async () => {
      const h1 = (documentXml.match(/<w:pStyle w:val="Heading1"\/>/g) || []).length;
      const h2 = (documentXml.match(/<w:pStyle w:val="Heading2"\/>/g) || []).length;
      assert(h1 === 3 && h2 === 3, `Heading1 ${h1}, Heading2 ${h2}`);
      const styles = await xml('word/styles.xml');
      assert(/w:styleId="Heading1"[\s\S]*?w:outlineLvl w:val="0"/.test(styles), 'outline level');
      return `Heading 1 × ${h1}, Heading 2 × ${h2}`;
    });
    await step('[โครงสร้าง Word] ตัวหนาและตัวสีในเนื้อความเป็นรูปแบบของข้อความจริง', async () => {
      const paras = documentXml.split('</w:p>');
      const runOf = (word) => { for (const p of paras) { const m = p.match(new RegExp(`<w:r>(?:(?!<w:r>)[\\s\\S])*?<w:t[^>]*>[^<]*${word}[^<]*</w:t>`)); if (m) return m[0]; } return ''; };
      const b = runOf('สำคัญมาก'), r = runOf('ต้องแก้ไขด่วน');
      assert(/<w:b\/>/.test(b), 'bold run'); assert(/<w:b\/>/.test(r) && /w:val="C62828"/.test(r), 'red bold run');
    });

    // ---------------- 2. LibreOffice rendering
    const lo = toPdf(docx, path.join(OUT, `${V.key}-lo`));
    const W = 760, H = Math.round((W * info.H) / info.W);
    const refImgs = renderPdf(ref, path.join(OUT, `${V.key}-ref`), W, H);
    const loImgs = renderPdf(lo, path.join(OUT, `${V.key}-docx`), W, H);
    await step('[LibreOffice] เปิดไฟล์ได้ จำนวนหน้าตรง (3 หน้า) และขนาดกระดาษถูกต้อง', async () => {
      assert(pdfPages(lo) === N, `pages ${pdfPages(lo)} vs ${N}`);
      const a = pdfSize(lo), b = pdfSize(ref);
      assert(Math.abs(a.w - b.w) < 2 && Math.abs(a.h - b.h) < 2, `size ${a.w}x${a.h} vs ${b.w}x${b.h}`);
      return `${N} หน้า ${Math.round(a.w)}×${Math.round(a.h)} pt`;
    });
    await step('[LibreOffice] หัวกระดาษ/ท้ายกระดาษ/เลขหน้าแสดงตรงตำแหน่งและถูกต้องทุกหน้า (เทียบกับ PDF ต้นฉบับด้วย)', async () => {
      const got = [];
      for (let i = 0; i < N; i++) {
        const want = expectedBands(doc, i, N);
        for (const [name, pdf] of [['Word', lo], ['PDF', ref]]) {
          const b = bands(pdf, i + 1);
          assert(b.header === want.header, `${name} p${i + 1} header "${b.header}" ≠ "${want.header}"`);
          assert(b.footer === want.footer, `${name} p${i + 1} footer "${b.footer}" ≠ "${want.footer}"`);
        }
        got.push([want.header, want.footer].filter(Boolean).join(' | ') || '(ว่าง)');
      }
      return got.join(' ; ');
    });
    await step('[LibreOffice] เนื้อหา หัวข้อ และตารางครบ ไม่มีอักขระเพี้ยน', async () => {
      const all = [1, 2, 3].map((p) => rawText(lo, p)).join('');
      for (const t of ['รายงานประจำปี', 'บทที่1บทนำ', '1.1ที่มาและความสำคัญ', 'ต้องแก้ไขด่วน', 'บทที่2ผลการศึกษา', 'ผลการศึกษาพบว่า']) assert(all.includes(t), `missing ${t}`);
      assert(!/[�]/.test(all), 'replacement characters');
    });
    await step(`[LibreOffice] ลายน้ำ${wm ? 'มองเห็นได้ทุกหน้า' : 'ไม่มี (ถูกต้อง)'}`, async () => {
      const vals = loImgs.map((f) => tint(readPPM(f), (doc.watermark && doc.watermark.color) || '#e5484d'));
      const refVals = refImgs.map((f) => tint(readPPM(f), (doc.watermark && doc.watermark.color) || '#e5484d'));
      if (wm) assert(vals.every((v) => v > 0.01) && refVals.every((v) => v > 0.01), `tint Word ${vals.map((v) => v.toFixed(3))} PDF ${refVals.map((v) => v.toFixed(3))}`);
      else assert(vals.every((v) => v < 0.004), `unexpected tint ${vals.map((v) => v.toFixed(4))}`);
      return 'สัดส่วนพิกเซลสีลายน้ำกลางหน้า: ' + vals.map((v) => (v * 100).toFixed(1) + '%').join(', ');
    });
    await step(`[LibreOffice] ขอบหน้ากระดาษ${bd ? 'แสดงครบ 4 ด้านทุกหน้า' : 'ไม่มี (ถูกต้อง)'}`, async () => {
      const insetPx = bd ? (doc.border.inset / (info.W > info.H ? 297 : 210)) * W : (8 / 210) * W;
      const vals = loImgs.map((f) => borderCoverage(readPPM(f), insetPx));
      const refVals = refImgs.map((f) => borderCoverage(readPPM(f), insetPx));
      const min = bd === 'dotted' || bd === 'dashed' ? 0.25 : 0.85;
      if (bd) assert(vals.every((v) => v > min) && refVals.every((v) => v > min), `coverage Word ${vals.map((v) => v.toFixed(2))} PDF ${refVals.map((v) => v.toFixed(2))}`);
      else assert(vals.every((v) => v < 0.05), `unexpected border ${vals.map((v) => v.toFixed(2))}`);
      return 'เส้นขอบครอบคลุม: ' + vals.map((v) => (v * 100).toFixed(0) + '%').join(', ');
    });
    await step('[LibreOffice] หน้าตาเหมือนต้นฉบับ (เทียบภาพทีละหน้า ไม่นับบริเวณลายน้ำและเส้นขอบที่ตรวจแยกแล้ว)', async () => {
      const mask = wm ? [{ x: W * 0.12, y: H * 0.2, w: W * 0.76, h: H * 0.6 }] : [];
      if (bd) {
        // the border line itself is measured by the border check; programs draw its thickness a little differently
        const ip = (doc.border.inset / (info.W > info.H ? 297 : 210)) * W, b = 7;
        mask.push({ x: 0, y: ip - b, w: W, h: 2 * b }, { x: 0, y: H - ip - b, w: W, h: 2 * b }, { x: ip - b, y: 0, w: 2 * b, h: H }, { x: W - ip - b, y: 0, w: 2 * b, h: H });
      }
      const out = [];
      for (let i = 0; i < N; i++) {
        const a = readPPM(refImgs[i]), b = readPPM(loImgs[i]);
        const d = diff(a, b, mask);
        out.push(d);
        run('convert', [refImgs[i], loImgs[i], '+append', path.join(OUT, `compare-${V.key}-${i + 1}.png`)]);
      }
      const bad = out.map((d, i) => ({ ...d, i })).filter((d) => d.mean > 8 || d.changed > 0.06);
      summary.push({ v: V.key, title: V.title, diff: out.map((d) => `${d.mean.toFixed(1)}/${(d.changed * 100).toFixed(1)}%`).join(', ') });
      assert(!bad.length, bad.map((d) => `p${d.i + 1} mean ${d.mean.toFixed(1)} changed ${(d.changed * 100).toFixed(1)}%`).join('; '));
      return out.map((d) => d.mean.toFixed(1)).join(', ');
    });

    // ---------------- 3. editable
    const edited = path.join(OUT, `${V.key}-edited.docx`);
    let changes;
    await step('[แก้ไขได้] แก้หัว/ท้ายกระดาษ หัวข้อ ช่องตาราง ทำตัวหนา และเพิ่มหน้าใหม่ ด้วยโปรแกรมแก้ไฟล์ Word (python-docx)', async () => {
      changes = JSON.parse(run('python3', [path.join(__dirname, 'docx_edit.py'), docx, edited]));
      assert(changes.heading && changes.table && changes.bold && changes.added, JSON.stringify(changes));
      if (doc.header && doc.header.text) assert(changes.header >= 1, 'header not edited');
      if (doc.footer && doc.footer.text) assert(changes.footer >= 1, 'footer not edited');
      assert(changes.styles[0] === 'Heading 1', `heading style ${changes.styles}`);
      return `หัว ${changes.header} ส่วน, ท้าย ${changes.footer} ส่วน, หัวข้อ (สไตล์ ${changes.styles[0]}), ตาราง, ตัวหนา, หน้าใหม่`;
    });
    await step('[แก้ไขได้] เปิดไฟล์ที่แก้แล้ว: เห็นการแก้ไขครบ มี 4 หน้า และเลขหน้าเปลี่ยนตามเอง', async () => {
      const pdf = toPdf(edited, path.join(OUT, `${V.key}-edited`));
      const n2 = pdfPages(pdf);
      assert(n2 === N + 1, `pages after edit ${n2}`);
      const docE = JSON.parse(JSON.stringify(doc));
      if (docE.header && docE.header.text) docE.header.text = 'แก้ไขหัวกระดาษแล้ว';
      if (docE.footer && docE.footer.text) docE.footer.text = 'แก้ไขท้ายกระดาษแล้ว';
      // body text added in Word starts at the top margin, so the bands are taken from the real margins
      const mar = documentXml.match(/<w:pgMar w:top="(\d+)" w:right="\d+" w:bottom="(\d+)"/);
      const topPt = +mar[1] / 20, botPt = +mar[2] / 20;
      for (let i = 0; i < n2; i++) {
        const want = expectedBands(docE, i, n2);
        const b = bands(pdf, i + 1, topPt, botPt);
        assert(b.header === want.header && b.footer === want.footer, `p${i + 1}: "${b.header}" / "${b.footer}" ≠ "${want.header}" / "${want.footer}"`);
      }
      const all = [...Array(n2)].map((_, i) => rawText(pdf, i + 1)).join('');
      for (const t of [changes.heading, 'แก้ในตาราง', changes.added]) assert(all.includes(norm(t)), `missing edit "${t}"`);
      assert(rawText(pdf, n2).includes(norm(changes.added)), 'new paragraph not on the new page');
      // the longer heading wraps and pushes the following text down (no overlap)
      const ws = words(pdf, 2);
      const head = ws.filter((w) => /Word\)|\(แก้ไข|ใน/.test(w.t) && w.y < 300);
      const next = ws.find((w) => w.t === '1.1');
      // (word boxes of a big heading are taller than its line spacing, so compare where the lines start)
      const lastLine = Math.max(...head.map((w) => w.y));
      assert(head.length && next && next.y > lastLine + 10, `overlap: last heading line starts ${lastLine} vs 1.1 starts ${next && next.y}`);
      run('pdftoppm', ['-r', '40', '-png', pdf, path.join(OUT, `${V.key}-edited`, 'p')]);
      return `${n2} หน้า${hasNum ? ', เลขหน้าหน้าสุดท้าย: ' + pageNumberText(doc.pageNum.fmt, n2 - 1, n2) : ''}`;
    });
    await step('[แก้ไขได้] เปิดแล้วบันทึกซ้ำด้วย LibreOffice: หัว/ท้ายกระดาษ ฟิลด์เลขหน้า และลายน้ำยังอยู่', async () => {
      const dir = path.join(OUT, `${V.key}-resave`);
      fs.mkdirSync(dir, { recursive: true });
      run('soffice', ['--headless', '--convert-to', 'docx:MS Word 2007 XML', '--outdir', dir, docx], { timeout: 240000 });
      const z2 = await JSZip.loadAsync(fs.readFileSync(path.join(dir, `${V.key}.docx`)));
      const hf = (await Promise.all(Object.keys(z2.files).filter((f) => /^word\/(header|footer)\d*\.xml$/.test(f)).map((f) => z2.file(f).async('string')))).join('');
      if (doc.header && doc.header.text) assert(textOfAll(hf).includes(norm(doc.header.text)), 'header lost');
      if (doc.footer && doc.footer.text) assert(textOfAll(hf).includes(norm(doc.footer.text.replace(/\n/g, ''))), 'footer lost');
      if (hasNum) assert(/PAGE/.test(hf), 'page field lost');
      if (wm) assert(hf.includes(wm), 'watermark lost');
      const pdf = toPdf(path.join(dir, `${V.key}.docx`), path.join(dir, 'pdf'));
      assert(pdfPages(pdf) === N, `pages after re-save ${pdfPages(pdf)}`);
      for (let i = 0; i < N; i++) {
        const want = expectedBands(doc, i, N), b = bands(pdf, i + 1);
        assert(b.header === want.header && b.footer === want.footer, `re-saved p${i + 1}: "${b.header}" / "${b.footer}"`);
      }
    });
  }

  group(`${VARIANTS.length + 1}. เทมเพลตเอกสาร A4 (ใบงาน, ประกาศ, เกียรติบัตร) ส่งออกแบบเอกสารไหลต่อกัน`);
  {
    await page.goto(URL);
    await page.waitForSelector('.preset');
    await page.click('.preset[data-preset="6"]');
    await page.waitForFunction(() => window.__lai && document.querySelector('.canvas-container'));
    for (const [i, t] of [2, 6, 3].entries()) {
      if (i > 0) { await page.click('[data-act="page-add"]'); await page.waitForTimeout(300); }
      await ev(async (k) => { await __lai.applyTemplate(k); }, t);
      await page.waitForTimeout(400);
    }
    await page.waitForTimeout(1500);
    const info = await ev(() => ({ W: __lai.W, H: __lai.H, texts: __lai.design.pages.map((p) => JSON.parse(p.json).objects.filter((o) => /text/i.test(o.type) && !((o.angle || 0) % 360) && !o.path && typeof o.fill === 'string').map((o) => o.text)) }));
    const ref = await exportFile('pdf', 'templates');
    const docx = await exportFile('docx', 'templates');
    const xml = await (await JSZip.loadAsync(fs.readFileSync(docx))).file('word/document.xml').async('string');
    const lo = toPdf(docx, path.join(OUT, 'templates-lo'));
    await step('[เทมเพลต] ไม่มีกล่องข้อความ จำนวนหน้าเท่าเดิม ข้อความครบ', async () => {
      assert(!/w:framePr/.test(xml), 'text frames found');
      assert(pdfPages(lo) === 3, `pages ${pdfPages(lo)}`);
      const missing = [];
      info.texts.forEach((list, pi) => { const t = rawText(lo, pi + 1); list.forEach((x) => x.split('\n').forEach((l) => { if (l.trim() && !t.includes(norm(l))) missing.push(`p${pi + 1}: ${l}`); })); });
      assert(!missing.length, 'missing ' + missing.slice(0, 4).join(' | '));
    });
    await step('[เทมเพลต] หน้าตาใกล้ต้นฉบับ (ภาพตกแต่งอยู่หลังข้อความ ข้อความไหลตามลำดับ)', async () => {
      const W = 760, H = Math.round((W * info.H) / info.W);
      const a = renderPdf(ref, path.join(OUT, 'templates-ref'), W, H), b = renderPdf(lo, path.join(OUT, 'templates-docx'), W, H);
      const out = a.map((f, i) => { run('convert', [f, b[i], '+append', path.join(OUT, `compare-templates-${i + 1}.png`)]); return diff(readPPM(f), readPPM(b[i])); });
      summary.push({ v: 'templates', title: 'เทมเพลต A4: ใบงาน / ประกาศ / เกียรติบัตร', diff: out.map((d) => `${d.mean.toFixed(1)}/${(d.changed * 100).toFixed(1)}%`).join(', ') });
      const bad = out.map((d, i) => ({ ...d, i })).filter((d) => d.mean > 12 || d.changed > 0.08); // flowing text cannot be pixel-exact: looser than the layout mode (8)
      assert(!bad.length, bad.map((d) => `p${d.i + 1} mean ${d.mean.toFixed(1)} changed ${(d.changed * 100).toFixed(1)}%`).join('; '));
      return out.map((d) => d.mean.toFixed(1)).join(', ');
    });
  }

  group(`${VARIANTS.length + 2}. อื่น ๆ`);
  await step('ไม่มี JavaScript error ระหว่างสร้างและส่งออกเอกสาร', async () => { assert(!errors.length, errors.slice(0, 3).join(' | ')); });

  await browser.close();
  server.kill();
  const pass = results.filter((r) => r.ok).length;
  let md = `# รายงานทดสอบไฟล์ Word สำหรับงานเอกสาร / รายงาน\n\nวันที่: ${new Date().toISOString()}\n\n**ผ่าน ${pass} / ${results.length}**\n\n`;
  md += 'แต่ละแบบเป็นรายงาน 3 หน้า (หน้าปก, บทที่ 1 มีหัวข้อ หัวข้อย่อย ตัวหนา ตัวสี รายการ, บทที่ 2 มีตาราง) ส่งออกเป็น Word แล้วเปิดด้วย LibreOffice\n\n';
  md += '## ความเหมือนของหน้าตา (ค่าต่างเฉลี่ย / % พิกเซลที่ต่างชัด ต่อหน้า; เกณฑ์ < 8 และ < 6%)\n\n| แบบ | หน้า 1, 2, 3 |\n|---|---|\n';
  for (const r of summary) md += `| ${r.title} | ${r.diff} |\n`;
  for (const s of [...new Set(results.map((r) => r.section))]) {
    md += `\n## ${s}\n\n| ผล | รายการ | หมายเหตุ |\n|---|---|---|\n`;
    for (const r of results.filter((x) => x.section === s)) md += `| ${r.ok ? '✅' : '❌'} | ${r.name} | ${r.note.replace(/\|/g, '/')} |\n`;
  }
  md += '\nภาพเทียบ (ซ้าย = ต้นฉบับ, ขวา = ไฟล์ Word เปิดด้วย LibreOffice): `compare-*.png` · ไฟล์ที่แก้ด้วย python-docx: `*-edited.docx`\n';
  fs.writeFileSync(path.join(OUT, 'REPORT.md'), md);
  console.log(`\n${pass}/${results.length} passed. Report: tests/report-docs/REPORT.md`);
  process.exit(pass === results.length ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(2); });

function textOfAll(x) { return norm([...x.matchAll(/<w:t(?: [^>]*)?>([^<]*)<\/w:t>/g)].map((m) => m[1]).join('')); }
