/*
 * Lai Studio – fidelity test for editable PowerPoint (.pptx) and Word (.docx) export.
 *
 *   npm run build && npm run test:office
 *
 * Needs: Playwright + Chromium, LibreOffice (soffice), poppler-utils (pdftoppm, pdftotext, pdffonts, pdfinfo),
 * ImageMagick (convert) and network access to Google Fonts (fonts are installed for LibreOffice to render with).
 *
 * For each sample design it exports PNG/PDF (reference), PPTX and DOCX, then:
 *  1. checks the files are valid and open in LibreOffice with the right number of pages
 *  2. checks every text is present and editable in the file XML (no lost or garbled Thai)
 *  3. checks the text extracted from the rendered pages contains every text (nothing missing / no strange characters)
 *  4. checks the design fonts are really used (embedded in the rendered PDF, not substituted)
 *  5. compares each rendered page with the original design pixel by pixel and writes side-by-side images
 * Report: tests/report-office/REPORT.md
 */
const { spawn, execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { chromium } = require('playwright');
const JSZip = require(path.join(__dirname, '../node_modules/jszip'));

const ROOT = path.join(__dirname, '..');
const OUT = path.join(__dirname, 'report-office');
const PORT = 4181;
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

// ---------------------------------------------------------------- fonts for LibreOffice
const FONT_DIR = path.join(os.homedir(), '.local/share/fonts/lai-studio');
function ensureFonts(families) {
  fs.mkdirSync(FONT_DIR, { recursive: true });
  let added = 0;
  for (const fam of families) {
    const mark = path.join(FONT_DIR, fam.replace(/ /g, '_') + '.ok');
    if (fs.existsSync(mark)) continue;
    const specs = [':ital,wght@0,400;0,700;1,400;1,700', ':wght@400;700', ''];
    let css = '';
    for (const sp of specs) {
      try { css = run('curl', ['-sf', `https://fonts.googleapis.com/css2?family=${fam.replace(/ /g, '+')}${sp}`]); if (css.includes('@font-face')) break; } catch { /* try next */ }
    }
    const urls = [...css.matchAll(/url\((https:[^)]+\.ttf)\)/g)].map((m) => m[1]);
    urls.forEach((u, i) => { run('curl', ['-sfL', '-o', path.join(FONT_DIR, `${fam.replace(/ /g, '_')}-${i}.ttf`), u]); added++; });
    fs.writeFileSync(mark, String(urls.length));
  }
  if (added) run('fc-cache', ['-f', FONT_DIR]);
  return added;
}

// ---------------------------------------------------------------- image helpers
function pdfPages(pdf) { return +run('pdfinfo', [pdf]).match(/Pages:\s+(\d+)/)[1]; }
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
/** Pixel difference; `mask` rectangles (native charts) are measured separately. */
function diff(a, b, mask = []) {
  if (a.w !== b.w || a.h !== b.h) return { mean: 255, changed: 1, chart: 255 };
  let s = 0, changed = 0, n = 0, cs = 0, cn = 0;
  for (let y = 0; y < a.h; y++) for (let x = 0; x < a.w; x++) {
    const i = (y * a.w + x) * 3;
    const d = (Math.abs(a.data[i] - b.data[i]) + Math.abs(a.data[i + 1] - b.data[i + 1]) + Math.abs(a.data[i + 2] - b.data[i + 2])) / 3;
    if (mask.some((m) => x >= m.x && x < m.x + m.w && y >= m.y && y < m.y + m.h)) { cs += d; cn++; continue; }
    s += d; n++;
    if (d > 48) changed++;
  }
  return { mean: s / n, changed: changed / n, chart: cn ? cs / cn : null };
}
const norm = (s) => String(s).normalize('NFC').replace(/[\s​ ]+/g, '');
const decodeXml = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16))).replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d)).replace(/&amp;/g, '&');

// ---------------------------------------------------------------- sample designs (built in the app)
const PRO = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'src', 'protemplates.json'), 'utf8'));
const SAMPLES = [
  { key: 'mixed', preset: 0, title: 'ทุกองค์ประกอบ (IG 1080×1080)', build: 'mixed' },
  { key: 'a4', preset: 6, title: 'เอกสาร A4: ใบงาน + ประกาศ + เกียรติบัตร', build: ['tpl:2', 'tpl:6', 'tpl:3'] },
  { key: 'charts', preset: 5, title: 'กราฟหลายชุดข้อมูล 16:9 (แท่งกลุ่ม แท่งซ้อน แท่งซ้อน 100% แนวนอน เส้น เส้นโค้ง พื้นที่ซ้อน เรดาร์)', build: 'charts' },
  { key: 'pro', preset: 5, title: 'พรีเซนต์มืออาชีพ 16:9: การเงินผู้บริหาร + เปิดตัวผลิตภัณฑ์ + ผลแคมเปญการตลาด', build: ['tpl:pro-finance', 'tpl:pro-product', 'tpl:pro-marketing'] },
  { key: 'slides', preset: 5, title: 'สไลด์ 16:9: หน้าแรก + เชิญร่วมงาน + โปรโมชัน + เมนู', build: ['tpl:7', 'tpl:5', 'tpl:0', 'tpl:9'] },
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

  await step('ติดตั้งฟอนต์ที่ใช้ในงานให้ LibreOffice (จาก Google Fonts)', async () => {
    const list = [...fs.readFileSync(path.join(ROOT, 'src/fonts.js'), 'utf8').matchAll(/^\s*\['([^']+)', '[ib]?', '/gm)].map((m) => m[1]);
    const n = ensureFonts(list);
    return `${list.length} ตระกูลฟอนต์ (ดาวน์โหลดใหม่ ${n} ไฟล์)`;
  });

  const exportFile = async (fmt, opts = {}) => {
    await page.click('[data-act="export"]');
    await page.click(`.fmt:has(input[value="${fmt}"])`);
    if (opts.editable === false) await page.uncheck('[data-editable]');
    // this suite measures how exactly the design is kept: Word in 'layout' mode (text frames at their exact places)
    if (fmt === 'docx') await page.selectOption('[data-docxmode]', 'layout');
    const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 120000 }), page.click('[data-go]')]);
    const f = path.join(OUT, `${opts.base}.${fmt === 'pdf' ? 'ref.pdf' : fmt}`);
    await dl.saveAs(f);
    return f;
  };

  const summary = [];
  for (const S of SAMPLES) {
    group(`${summary.length + 1}. ${S.title}`);
    // ---- build the sample in the editor
    await page.goto(URL);
    await page.waitForSelector('.preset');
    await page.click(`.preset[data-preset="${S.preset}"]`);
    await page.waitForFunction(() => window.__lai && document.querySelector('.canvas-container'));
    await page.waitForTimeout(500);
    if (S.build === 'mixed') {
      await ev(async () => {
        const L = __lai;
        const cv = document.createElement('canvas'); cv.width = 400; cv.height = 300;
        const g = cv.getContext('2d'); const gr = g.createLinearGradient(0, 0, 400, 300); gr.addColorStop(0, '#1d4ed8'); gr.addColorStop(1, '#f472b6');
        g.fillStyle = gr; g.fillRect(0, 0, 400, 300); g.fillStyle = '#fff'; g.beginPath(); g.arc(200, 150, 60, 0, 7); g.fill();
        const img = cv.toDataURL('image/png');
        const T = (txt, o) => L.addText('none', { text: txt, width: L.W * 0.8, ...o });
        let t = await T('รายงานผลการเรียน ภาคเรียนที่ 1', { fontFamily: 'Kanit', fontWeight: 'bold', fontSize: 64, fill: '#5b3df5', textAlign: 'center' });
        t.setPositionByOrigin({ x: 540, y: 70 }, 'center', 'center');
        t = await T('นักเรียนทุกคนตั้งใจเรียน\nคะแนนเฉลี่ยเพิ่มขึ้น ร้อยละ 12.5', { fontFamily: 'Sarabun', fontSize: 32, fill: '#1f2333', textAlign: 'left', width: 520 });
        t.setSelectionStyles({ fill: '#e5484d', fontWeight: 'bold' }, 11, 22);
        t.set({ left: 40, top: 130 });
        t = await T('Lai Studio · 2026', { fontFamily: 'Montserrat', fontSize: 26, fill: '#64748b', textAlign: 'right', width: 420 });
        t.set({ left: 620, top: 140 });
        t = await T('• ข้อที่หนึ่ง ทำการบ้าน\n• ข้อที่สอง อ่านหนังสือ', { fontFamily: 'Prompt', fontSize: 28, fill: '#0f766e', textAlign: 'left', width: 420 });
        t.set({ left: 40, top: 250 });
        await L.addShape(0); let o = L.canvas.getActiveObject(); o.set({ left: 520, top: 230, scaleX: 0.5, scaleY: 0.3, fill: '#ffde59', stroke: '#1f2333', strokeWidth: 6 });
        await L.addShape(2); o = L.canvas.getActiveObject(); o.set({ left: 720, top: 230, scaleX: 0.3, scaleY: 0.3, fill: '#22c3e6' });
        await L.addShape(4); o = L.canvas.getActiveObject(); o.set({ left: 860, top: 230, scaleX: 0.3, scaleY: 0.3, fill: '#2ecc71' });
        await L.addShape(10); o = L.canvas.getActiveObject(); o.set({ left: 960, top: 230, scaleX: 0.3, scaleY: 0.3, fill: '#ff9f1c' });
        await L.addShape(14); o = L.canvas.getActiveObject(); o.set({ left: 860, top: 330, scaleX: 0.9, scaleY: 0.9 });
        await L.panelAction('line:1'); o = L.canvas.getActiveObject(); o.set({ left: 560, top: 380 });
        await L.addSmart('table'); o = L.canvas.getActiveObject(); o.set({ left: 40, top: 420, scaleX: 0.62, scaleY: 0.62 });
        await L.addSmart('bar'); o = L.canvas.getActiveObject(); o.set({ left: 560, top: 430, scaleX: 0.65, scaleY: 0.65 });
        await L.addSmart('pie'); o = L.canvas.getActiveObject(); o.set({ left: 560, top: 640, scaleX: 0.6, scaleY: 0.6 });
        await L.addSmart('icon-star'); o = L.canvas.getActiveObject(); o.set({ left: 60, top: 680 });
        await L.addSmart('qr'); o = L.canvas.getActiveObject(); o.set({ left: 900, top: 880, scaleX: 0.45, scaleY: 0.45 });
        await L.addSmart('equation'); o = L.canvas.getActiveObject(); o.setPositionByOrigin({ x: 300, y: 760 }, 'center', 'center');
        await L.addImage(img, 'รูปทดสอบ'); o = L.canvas.getActiveObject(); o.set({ left: 300, top: 860, scaleX: 0.5, scaleY: 0.5 });
        await L.addShape(0); o = L.canvas.getActiveObject(); o.set({ left: 40, top: 900, scaleX: 0.7, scaleY: 0.25, fill: '#7c5cff', rx: 30, ry: 30 });
        await L.editShapeText(o); const st = L.canvas.getActiveObject(); st.insertChars('กดที่นี่', undefined, 0); st.exitEditing();
        t = await T('ลดราคา!', { fontFamily: 'Kanit', fontWeight: 'bold', fontSize: 40, fill: '#e5484d', width: 200, textAlign: 'center' });
        t.set({ left: 820, top: 560, angle: -12 });
        L.canvas.getObjects().forEach((x) => x.setCoords());
        L.canvas.discardActiveObject();
        L.canvas.requestRenderAll();
        L.commit();
      }, null);
    } else if (S.build === 'charts') {
      await ev(async () => {
        const L = __lai;
        const pages = [['bar-group', 'bar-stack', 'bar-stack100', 'hbar-group'], ['hbar-stack', 'line-multi', 'line-smooth', 'area-stack'], ['radar']];
        for (let p = 0; p < pages.length; p++) {
          if (p > 0) await L.addPage();
          const list = pages[p];
          for (let i = 0; i < list.length; i++) {
            await L.addSmart(list[i]);
            const o = L.canvas.getActiveObject();
            const k = list.length === 1 ? 1.25 : 0.62;
            o.set({ scaleX: k, scaleY: k });
            const cx = list.length === 1 ? L.W / 2 : (i % 2 ? 0.74 : 0.26) * L.W, cy = list.length === 1 ? L.H / 2 : (i < 2 ? 0.27 : 0.75) * L.H;
            o.setPositionByOrigin({ x: cx, y: cy }, 'center', 'center');
            o.setCoords();
          }
          L.canvas.discardActiveObject();
          L.commit();
        }
      });
    } else {
      for (let i = 0; i < S.build.length; i++) {
        if (i > 0) { await page.click('[data-act="page-add"]'); await page.waitForTimeout(300); }
        // 'tpl:<number>' or 'tpl:<id of a pro template>' (found by its name in the templates panel)
        let k = S.build[i].split(':')[1];
        if (!/^\d+$/.test(k)) {
          const name = PRO.find((t) => t.id === k).name;
          if (!(await page.$('[data-tpl-cats]'))) await page.click('.rail-btn[data-panel="templates"]');
          k = (await page.getAttribute(`.tpl[title^="${name} ·"]`, 'data-act')).split(':')[1];
        }
        await ev(async (k) => { await __lai.applyTemplate(k); }, +k);
        await page.waitForTimeout(400);
      }
    }
    await page.waitForTimeout(1500); // fonts
    await ev(() => __lai.saveNow());
    const base = S.key;
    const nPages = await ev(() => __lai.visiblePageIndexes().length);
    await page.screenshot({ path: path.join(OUT, `${base}-editor.png`) });

    // expected texts per page & format (pictures replace text Office cannot reproduce)
    const expected = await ev(() => {
      const L = __lai;
      const out = { pptx: [], docx: [] };
      for (const p of L.design.pages.filter((x) => !x.hidden)) {
        const j = JSON.parse(p.json);
        const ps = { pptx: [], docx: [] };
        for (const o of j.objects || []) {
          const isTxt = /text/i.test(o.type);
          if (isTxt) {
            const grad = o.fill && typeof o.fill === 'object';
            if (o.path || grad) continue;
            const rotated = (o.angle || 0) % 360 || o.flipX || o.flipY;
            o.text.split('\n').filter((l) => l.trim()).forEach((l) => { ps.pptx.push(rotated ? '↻' + l : l); if (!rotated) ps.docx.push(l); });
          }
          if (o.shapeText) { const t = o.objects[1].text; ps.pptx.push(t); ps.docx.push(t); }
          if (o.smart?.type === 'table') o.smart.rows.flat().filter((c) => String(c).trim()).forEach((c) => { ps.pptx.push(String(c)); ps.docx.push(String(c)); });
          if (o.smart?.type === 'chart' && ['bar', 'hbar', 'line', 'area', 'pie', 'donut', 'bar-group', 'bar-stack', 'bar-stack100', 'hbar-group', 'hbar-stack', 'line-multi', 'line-smooth', 'area-stack', 'radar'].includes(o.smart.chart)) {
            [o.smart.title, ...o.smart.labels, ...((o.smart.series && o.smart.series.length > 1) ? o.smart.series.map((x) => x.name) : [])].filter(Boolean).forEach((c) => { ps.pptx.push(String(c)); ps.docx.push(String(c)); });
          }
        }
        out.pptx.push(ps.pptx);
        out.docx.push(ps.docx);
      }
      return out;
    });
    const fonts = await ev(() => [...new Set(__lai.design.pages.flatMap((p) => { const f = []; const w = (os) => (os || []).forEach((o) => { if (o.fontFamily) f.push(o.fontFamily); if (o.smart?.fontFamily) f.push(o.smart.fontFamily); w(o.objects); }); w(JSON.parse(p.json).objects); return f; }))].filter((f) => f !== 'sans-serif'));
    ensureFonts(fonts);

    // reference: our own PDF (exact rendering of the design)
    const ref = await exportFile('pdf', { base });
    const W = 900, H = Math.round((900 * (await ev(() => __lai.H))) / (await ev(() => __lai.W)));
    const refImgs = renderPdf(ref, path.join(OUT, `${base}-ref`), W, H);
    await step('[PDF] ไฟล์ PDF ค้นหา/คัดลอกข้อความได้ครบทุกจุด', async () => {
      const missing = [];
      expected.pptx.forEach((list, pi) => {
        const txt = run('pdftotext', ['-raw', '-f', String(pi + 1), '-l', String(pi + 1), '-enc', 'UTF-8', ref, '-']);
        const hay = norm(txt);
        list.forEach((t) => {
          t = t.replace(/^↻/, '').replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{2300}-\u{23FF}\u{FE0F}\u{200D}]/gu, '');
          if (norm(t) && !hay.includes(norm(t))) missing.push(`หน้า ${pi + 1}: “${t}”`);
        });
      });
      assert(!missing.length, 'ค้นหาไม่พบ: ' + missing.slice(0, 6).join(' | '));
      return `${expected.pptx.flat().length} ข้อความ`;
    });
    // native chart areas per page (scaled to the comparison size)
    const chartBoxes = await ev((W) => { const k = W / __lai.W; return __lai.design.pages.filter((p) => !p.hidden).map((p) => (JSON.parse(p.json).objects || []).filter((o) => o.smart?.type === 'chart' && ['bar', 'hbar', 'line', 'area', 'pie', 'donut', 'bar-group', 'bar-stack', 'bar-stack100', 'hbar-group', 'hbar-stack', 'line-multi', 'line-smooth', 'area-stack', 'radar'].includes(o.smart.chart)).map((o) => { const w = o.width * o.scaleX, h = o.height * o.scaleY; const cx = o.left + (o.originX === 'center' ? 0 : w / 2), cy = o.top + (o.originY === 'center' ? 0 : h / 2); return { x: (cx - w / 2) * k, y: (cy - h / 2) * k, w: w * k, h: h * k }; })); }, W);
    const row = { sample: S.title, pages: nPages };

    for (const fmt of ['pptx', 'docx']) {
      let file, pdf;
      await step(`[${fmt.toUpperCase()}] ส่งออกได้ และเป็นไฟล์ที่ถูกต้อง`, async () => {
        file = await exportFile(fmt, { base });
        const z = await JSZip.loadAsync(fs.readFileSync(file));
        const need = fmt === 'pptx' ? 'ppt/presentation.xml' : 'word/document.xml';
        assert(z.file(need), 'missing ' + need);
        return `${(fs.statSync(file).size / 1024).toFixed(0)} KB`;
      });
      if (!file) continue;
      const zip = await JSZip.loadAsync(fs.readFileSync(file));
      const parts = fmt === 'pptx'
        ? Object.keys(zip.files).filter((f) => /^ppt\/slides\/slide\d+\.xml$/.test(f)).sort((a, b) => +a.match(/(\d+)\.xml/)[1] - +b.match(/(\d+)\.xml/)[1])
        : ['word/document.xml'];
      const xmls = await Promise.all(parts.map((p) => zip.file(p).async('string')));
      const charts = await Promise.all(Object.keys(zip.files).filter((f) => /charts\/chart\d+\.xml$/.test(f)).map((p) => zip.file(p).async('string')));

      await step(`[${fmt.toUpperCase()}] ข้อความครบทุกจุด และแก้ไขได้ (อยู่ในไฟล์เป็นข้อความจริง ไม่ใช่ภาพ)`, async () => {
        const tag = fmt === 'pptx' ? /<a:t>([^<]*)<\/a:t>/g : /<w:t(?: [^>]*)?>([^<]*)<\/w:t>/g;
        const chartText = charts.map((c) => [...c.matchAll(/<c:v>([^<]*)<\/c:v>|<a:t>([^<]*)<\/a:t>/g)].map((m) => decodeXml(m[1] || m[2])).join('')).join('');
        const missing = [];
        const pagesText = fmt === 'pptx' ? xmls.map((x) => norm([...x.matchAll(tag)].map((m) => decodeXml(m[1])).join(''))) : [norm([...xmls[0].matchAll(tag)].map((m) => decodeXml(m[1])).join(''))];
        expected[fmt].forEach((list, pi) => {
          const hay = (fmt === 'pptx' ? pagesText[pi] : pagesText[0]) + norm(chartText);
          list.forEach((t) => { t = t.replace(/^↻/, ''); if (!hay.includes(norm(t))) missing.push(`หน้า ${pi + 1}: “${t}”`); });
        });
        assert(!missing.length, 'ข้อความหาย: ' + missing.slice(0, 6).join(' | '));
        const all = xmls.join('');
        assert(!all.includes('�'), 'พบอักขระเสีย (�)');
        return `${expected[fmt].flat().length} ข้อความ`;
      });

      await step(`[${fmt.toUpperCase()}] ใช้ฟอนต์ตามงานออกแบบ (รวมฟอนต์ภาษาไทยแบบ complex script)`, async () => {
        const all = xmls.join('');
        const missing = fonts.filter((f) => !all.includes(`"${f}"`) && !charts.join('').includes(`"${f}"`));
        assert(!missing.length, 'ไม่พบฟอนต์: ' + missing.join(', '));
        if (/[ก-๙]/.test(all.replace(/<[^>]+>/g, ''))) {
          if (fmt === 'docx') assert(/w:cs="[^"]+"/.test(all), 'ไม่มีฟอนต์ complex script สำหรับภาษาไทย');
          else assert(/<a:cs typeface=/.test(all), 'ไม่มีฟอนต์ cs');
        }
        // Thai chart labels need a complex-script font too
        for (const c of charts) {
          for (const m of c.matchAll(/<a:latin typeface="([^"]+)"[^>]*\/>/g)) assert(c.includes(`<a:cs typeface="${m[1]}"/>`), `กราฟไม่มีฟอนต์ภาษาไทย (cs) สำหรับ ${m[1]}`);
        }
        return fonts.join(', ');
      });

      await step(`[${fmt.toUpperCase()}] ตาราง/กราฟ/รูปทรงเป็นวัตถุที่แก้ไขได้ใน Office`, async () => {
        const all = xmls.join('');
        const nTables = (all.match(fmt === 'pptx' ? /<a:tbl>/g : /<w:tbl>/g) || []).length;
        const wantTables = await ev(() => __lai.design.pages.filter((p) => !p.hidden).reduce((n, p) => n + (JSON.parse(p.json).objects || []).filter((o) => o.smart?.type === 'table').length, 0));
        const wantCharts = await ev(() => __lai.design.pages.filter((p) => !p.hidden).reduce((n, p) => n + (JSON.parse(p.json).objects || []).filter((o) => o.smart?.type === 'chart' && ['bar', 'hbar', 'line', 'area', 'pie', 'donut', 'bar-group', 'bar-stack', 'bar-stack100', 'hbar-group', 'hbar-stack', 'line-multi', 'line-smooth', 'area-stack', 'radar'].includes(o.smart.chart)).length, 0));
        assert(nTables === wantTables, `ตาราง ${nTables}/${wantTables}`);
        assert(charts.length === wantCharts, `กราฟ ${charts.length}/${wantCharts}`);
        const shapes = fmt === 'pptx' ? (all.match(/<a:prstGeom prst="(rect|roundRect|ellipse|triangle|line)"|<a:custGeom>/g) || []).length : 0;
        return `ตาราง ${nTables}, กราฟ ${charts.length}${fmt === 'pptx' ? `, รูปทรง ${shapes}` : ''}`;
      });

      await step(`[${fmt.toUpperCase()}] เปิดด้วย LibreOffice ได้ จำนวนหน้าตรง`, async () => {
        run('soffice', ['--headless', '--convert-to', 'pdf', '--outdir', OUT, file], { timeout: 240000 });
        pdf = file.replace(/\.(pptx|docx)$/, '.pdf');
        fs.renameSync(pdf, pdf.replace(/\.pdf$/, `.${fmt}.pdf`));
        pdf = pdf.replace(/\.pdf$/, `.${fmt}.pdf`);
        const n = pdfPages(pdf);
        assert(n === nPages, `ได้ ${n} หน้า ควรเป็น ${nPages}`);
        return `${n} หน้า`;
      });
      if (!pdf || !fs.existsSync(pdf)) continue;

      await step(`[${fmt.toUpperCase()}] ข้อความที่แสดงผลจริงครบ ไม่เพี้ยน ไม่เป็นภาษาแปลก ๆ`, async () => {
        const missing = [];
        let bad = '';
        expected[fmt].forEach((list, pi) => {
          const txt = run('pdftotext', ['-f', String(pi + 1), '-l', String(pi + 1), '-enc', 'UTF-8', pdf, '-']);
          if (/[�□]/.test(txt)) bad += ` หน้า ${pi + 1} มีอักขระเสีย`;
          const hay = norm(txt);
          // rotated text is split into pieces by text extraction: check that every character is there instead
          const bag = (x) => { const m = new Map(); for (const ch of norm(x)) m.set(ch, (m.get(ch) || 0) + 1); return m; };
          const hayBag = bag(txt);
          list.forEach((t) => {
            if (t.startsWith('↻')) { const need = bag(t.slice(1)); for (const [ch, n] of need) if ((hayBag.get(ch) || 0) < n) { missing.push(`หน้า ${pi + 1}: “${t.slice(1)}” (หมุน)`); break; } }
            else if (!hay.includes(norm(t))) missing.push(`หน้า ${pi + 1}: “${t}”`);
          });
        });
        assert(!bad, bad);
        assert(!missing.length, 'ไม่พบเมื่อแสดงผล: ' + missing.slice(0, 6).join(' | '));
      });

      await step(`[${fmt.toUpperCase()}] ฟอนต์ถูกใช้จริงตอนแสดงผล (ไม่ถูกแทนที่ด้วยฟอนต์อื่น)`, async () => {
        const list = run('pdffonts', [pdf]);
        const used = fonts.filter((f) => list.replace(/\s/g, '').toLowerCase().includes(f.replace(/\s/g, '').toLowerCase()));
        const textFonts = fonts.filter((f) => !['Anton', 'Bebas Neue'].includes(f) || used.includes(f));
        const missing = textFonts.filter((f) => !used.includes(f));
        assert(!missing.length, 'ฟอนต์ถูกแทนที่: ' + missing.join(', '));
        return used.join(', ');
      });

      await step(`[${fmt.toUpperCase()}] หน้าตาเหมือนต้นฉบับ (เทียบภาพทีละหน้า)`, async () => {
        const imgs = renderPdf(pdf, path.join(OUT, `${base}-${fmt}`), W, H);
        const scores = [];
        imgs.forEach((f, i) => {
          if (!refImgs[i]) return;
          const d = diff(readPPM(refImgs[i]), readPPM(f), chartBoxes[i] || []);
          scores.push(d);
          run('convert', [refImgs[i], f, '+append', '-resize', '1400x', path.join(OUT, `compare-${base}-${fmt}-p${i + 1}.png`)]);
        });
        row[fmt] = scores.map((s) => `${s.mean.toFixed(1)} / ${(s.changed * 100).toFixed(1)}%${s.chart !== null ? ` (กราฟ ${s.chart.toFixed(1)})` : ''}`).join(' · ');
        const worst = Math.max(...scores.map((s) => s.mean));
        const worstChanged = Math.max(...scores.map((s) => s.changed));
        const worstChart = Math.max(0, ...scores.map((s) => s.chart || 0));
        assert(worst < 8 && worstChanged < 0.06, `ต่างจากต้นฉบับมากเกินไป: ${row[fmt]}`);
        assert(worstChart < 45, `กราฟต่างจากต้นฉบับมากเกินไป: ${row[fmt]}`);
        return `ค่าต่างเฉลี่ย/พิกเซลที่ต่างชัด ต่อหน้า: ${row[fmt]}`;
      });
    }
    summary.push(row);
  }

  group('สรุป');
  await step('ไม่มี JavaScript error ระหว่างส่งออก', async () => { assert(!errors.length, errors.slice(0, 3).join(' | ')); });

  await browser.close();
  server.kill();
  const pass = results.filter((r) => r.ok).length;
  let md = `# รายงานทดสอบการส่งออก PowerPoint / Word แบบแก้ไขได้\n\nวันที่: ${new Date().toISOString()}\n\n**ผ่าน ${pass} / ${results.length}**\n\n`;
  md += '## ความเหมือนของหน้าตา (ค่าต่างเฉลี่ย 0–255 / % พิกเซลที่ต่างชัดเจน ต่อหน้า — ยิ่งน้อยยิ่งเหมือน; เกณฑ์ผ่าน: < 8 และ < 6%)\n\nพื้นที่กราฟวัดแยก (ในวงเล็บ) เพราะกราฟถูกส่งออกเป็นกราฟจริงที่แก้ข้อมูลได้ PowerPoint/Word จึงวาดแกนและป้ายตัวเลขด้วยรูปแบบของตัวเอง (เกณฑ์ < 45)\n\n| งานตัวอย่าง | PowerPoint | Word |\n|---|---|---|\n';
  for (const r of summary) md += `| ${r.sample} | ${r.pptx || '-'} | ${r.docx || '-'} |\n`;
  for (const s of [...new Set(results.map((r) => r.section))]) {
    md += `\n## ${s}\n\n| ผล | รายการ | หมายเหตุ |\n|---|---|---|\n`;
    for (const r of results.filter((x) => x.section === s)) md += `| ${r.ok ? '✅' : '❌'} | ${r.name} | ${r.note.replace(/\|/g, '/')} |\n`;
  }
  md += '\nภาพเทียบ (ซ้าย = ต้นฉบับ, ขวา = ไฟล์ที่ส่งออกเปิดด้วย LibreOffice): `compare-*.png`\n';
  fs.writeFileSync(path.join(OUT, 'REPORT.md'), md);
  console.log(`\n${pass}/${results.length} passed. Report: tests/report-office/REPORT.md`);
  process.exit(pass === results.length ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(2); });
