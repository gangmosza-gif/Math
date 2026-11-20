/*
 * Lai Studio – end-to-end test of every system and feature.
 *
 *   npm run build && npm test
 *
 * Needs Playwright with Chromium (`npm i -D playwright && npx playwright install chromium`).
 * Starts `vite preview`, drives the real app in a browser, checks every feature step by step,
 * verifies every downloaded file, and writes tests/report/REPORT.md + screenshots of failures.
 */
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { chromium, devices } = require('playwright');
const JSZip = require(path.join(__dirname, '../node_modules/jszip'));

const ROOT = path.join(__dirname, '..');
const OUT = path.join(__dirname, 'report');
const PORT = 4179;
const URL = `http://localhost:${PORT}/`;
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(path.join(OUT, 'downloads'), { recursive: true });

// ---------------------------------------------------------------- helpers
function makePNG(w, h, file) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 3 + 1)] = 0;
    for (let x = 0; x < w; x++) {
      const o = y * (w * 3 + 1) + 1 + x * 3;
      raw[o] = (x * 255) / w; raw[o + 1] = (y * 255) / h; raw[o + 2] = 160;
    }
  }
  const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = (b) => { let c = 0xffffffff; for (const x of b) c = crcTable[(c ^ x) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (t, d) => { const len = Buffer.alloc(4); len.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  fs.writeFileSync(file, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
}
const IMG = path.join(OUT, 'sample.png');
const IMG2 = path.join(OUT, 'sample2.png');
makePNG(400, 300, IMG);
makePNG(300, 500, IMG2);

const results = [];
let page, ctx, browser;
const pageErrors = [];
let section = '';

const UNTIL = +process.env.UNTIL || Infinity; // run only sections <= UNTIL (debugging)
async function step(name, fn) {
  if (parseInt(section, 10) > UNTIL) return;
  const t0 = Date.now();
  try {
    await fn();
    results.push({ section, name, ok: true, ms: Date.now() - t0 });
    process.stdout.write(`  ✓ ${name}\n`);
  } catch (e) {
    const shot = `fail-${results.length + 1}.png`;
    try { await page.screenshot({ path: path.join(OUT, shot) }); } catch { /* ignore */ }
    let msg = String(e && e.message || e);
    try { msg += ' | dom: ' + await page.evaluate(() => `popovers=${document.querySelectorAll('.popover').length} modals=${document.querySelectorAll('.modal-back').length} active=${__lai?.canvas.getActiveObject()?.type} kind=${document.querySelector('.ctxbar')?.dataset.kind} style=${!!__lai?._style}`); } catch { /* ignore */ }
    results.push({ section, name, ok: false, ms: Date.now() - t0, error: msg.split('\n')[0], shot });
    process.stdout.write(`  ✗ ${name}\n      ${msg.split('\n').filter((l) => !/^\s*-\s*(retrying|waiting \d)/.test(l)).slice(0, 8).join('\n      ')}\n`);
    // recover: close modals/popovers
    try { await page.keyboard.press('Escape'); await page.keyboard.press('Escape'); } catch { /* ignore */ }
  }
}
function group(n) { section = n; process.stdout.write(`\n${n}\n`); }
function assert(c, msg) { if (!c) throw new Error(msg); }
const ev = (fn, arg) => page.evaluate(fn, arg);
const wait = (ms) => page.waitForTimeout(ms);
const objCount = () => ev(() => __lai.canvas.getObjects().length);
const active = () => ev(() => { const a = __lai.canvas.getActiveObject(); return a ? { type: a.type, smart: a.smart && a.smart.type, name: a.name, n: a.getObjects ? a.getObjects().length : 0 } : null; });
const panel = async (name) => {
  const isActive = await page.$(`.rail-btn.active[data-panel="${name}"]`);
  if (!isActive) await page.click(`.rail-btn[data-panel="${name}"]`);
  await wait(150);
};
async function selectIndex(i) {
  await ev((i) => { const c = __lai.canvas; const o = c.getObjects().at(i); c.setActiveObject(o); c.requestRenderAll(); }, i);
  await wait(80);
}
async function clearPage() {
  await ev(() => { const c = __lai.canvas; c.discardActiveObject(); c.remove(...c.getObjects()); c.backgroundColor = '#ffffff'; c.backgroundImage = null; c.requestRenderAll(); __lai.commit(); });
}
async function screenPoint(i) {
  return ev((i) => {
    const c = __lai.canvas; const o = c.getObjects().at(i); const p = o.getCenterPoint(); const v = c.viewportTransform;
    const r = c.upperCanvasEl.getBoundingClientRect();
    return { x: r.left + p.x * v[0] + v[4], y: r.top + p.y * v[3] + v[5] };
  }, i);
}
async function download(trigger) {
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 60000 }), trigger()]);
  const file = path.join(OUT, 'downloads', `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`);
  await dl.saveAs(file);
  return fs.readFileSync(file);
}
async function exportAs(fmt, opts = {}) {
  await page.click('[data-act="export"]');
  await page.click(`.fmt:has(input[value="${fmt}"])`);
  if (opts.scale) await page.selectOption('[data-scale]', String(opts.scale));
  if (opts.transparent) await page.check('[data-transparent]');
  if (opts.print) await page.check('[data-print]');
  if (opts.pages) {
    await page.selectOption('[data-pages-sel]', opts.pages === 'cur' ? 'cur' : 'custom');
    if (opts.pages !== 'cur') await page.fill('[data-pages-custom]', opts.pages);
  }
  return download(() => page.click('[data-go]'));
}
const isPNG = (b) => b.slice(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
const isJPG = (b) => b[0] === 0xff && b[1] === 0xd8;
const isWEBP = (b) => b.slice(0, 4).toString() === 'RIFF' && b.slice(8, 12).toString() === 'WEBP';
const isZIP = (b) => b[0] === 0x50 && b[1] === 0x4b;
const pdfPages = (b) => (b.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
const pngSize = (b) => [b.readUInt32BE(16), b.readUInt32BE(20)];

// ---------------------------------------------------------------- main
(async () => {
  const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { cwd: ROOT, stdio: 'ignore' });
  for (let i = 0; i < 50; i++) {
    try { await fetch(URL); break; } catch { await new Promise((r) => setTimeout(r, 200)); }
  }
  const proxy = process.env.HTTPS_PROXY || process.env.https_proxy;
  browser = await chromium.launch(proxy ? { proxy: { server: proxy, bypass: 'localhost,127.0.0.1' } } : {});
  ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, ignoreHTTPSErrors: true, acceptDownloads: true });
  page = await ctx.newPage();
  page.setDefaultTimeout(10000);
  page.on('pageerror', (e) => pageErrors.push(e.message));
  if (process.env.DBG) page.on('console', (m) => { if (m.text().startsWith('DBG')) console.log('      ', m.text().slice(0, 300)); });
  page.on('dialog', (d) => d.dismiss());

  // =============================================================== HOME
  group('1. หน้าแรก (Home)');
  await step('เปิดหน้าแรก แสดงขนาดสำเร็จรูปครบ 14 แบบ + กำหนดเอง', async () => {
    await page.goto(URL);
    await page.waitForSelector('.preset');
    const n = await page.$$eval('.preset[data-preset]', (e) => e.length);
    assert(n === 14, `presets=${n}`);
    assert(await page.$('.preset[data-act="custom"]'), 'no custom size card');
  });
  await step('กำหนดขนาดเอง: ขนาดผิดต้องแจ้งเตือน ไม่สร้างงาน', async () => {
    await page.click('.preset[data-act="custom"]');
    await page.fill('[data-w]', '5');
    await page.click('[data-go]');
    await page.waitForSelector('.toast.error');
    assert(await page.$('.modal'), 'modal closed on invalid size');
    await page.keyboard.press('Escape');
  });
  await step('กำหนดขนาดเอง 800×600 แล้วเปิดตัวแก้ไข', async () => {
    await page.click('.preset[data-act="custom"]');
    await page.fill('[data-w]', '800');
    await page.fill('[data-h]', '600');
    await page.click('[data-go]');
    await page.waitForSelector('.canvas-container');
    await wait(300);
    const d = await ev(() => [__lai.W, __lai.H]);
    assert(d[0] === 800 && d[1] === 600, `size ${d}`);
    await page.click('[data-act="home"]');
    await page.waitForSelector('.design-card');
  });
  await step('สร้างงานจากขนาด Instagram 1080×1080', async () => {
    await page.click('.preset[data-preset="0"]');
    await page.waitForSelector('.canvas-container');
    await wait(600);
    const d = await ev(() => [__lai.W, __lai.H, __lai.design.name]);
    assert(d[0] === 1080 && d[1] === 1080, `size ${d}`);
  });

  // =============================================================== TEMPLATES
  group('2. เทมเพลต');
  await step('แผงเทมเพลตแสดงภาพตัวอย่างครบ 12 แบบ', async () => {
    await panel('templates');
    await page.waitForFunction(() => [...document.querySelectorAll('[data-tpl-img]')].filter((e) => e.style.backgroundImage).length === 12, null, { timeout: 30000 });
  });
  await step('ใช้เทมเพลตกับหน้าว่าง → ใส่ลงหน้าเดิม', async () => {
    await page.click('[data-act="tpl:0"]');
    await page.waitForFunction(() => __lai.canvas.getObjects().length > 3);
    assert((await ev(() => __lai.design.pages.length)) === 1, 'page added unexpectedly');
  });
  await step('ใช้เทมเพลตตอนหน้ามีของ → เพิ่มเป็นหน้าใหม่', async () => {
    await page.click('[data-act="tpl:2"]');
    await page.waitForFunction(() => __lai.design.pages.length === 2);
  });
  await step('ทุกเทมเพลตใช้ได้ไม่มี error (12 แบบ)', async () => {
    for (let i = 0; i < 12; i++) { await page.click(`[data-act="tpl:${i}"]`); await wait(250); }
    await page.waitForFunction(() => __lai.design.pages.length === 14, null, { timeout: 30000 });
  });
  await step('ลบหน้าที่เกินจนเหลือ 1 หน้า', async () => {
    for (let i = 0; i < 13; i++) { await page.click('[data-act="page-del"]'); await wait(120); }
    assert((await ev(() => __lai.design.pages.length)) === 1, 'pages not deleted');
    await clearPage();
  });

  // =============================================================== TEXT
  group('3. ข้อความ');
  await step('เพิ่มหัวข้อ / หัวข้อย่อย / เนื้อความ', async () => {
    await panel('text');
    for (const k of ['heading', 'sub', 'body']) await page.click(`.text-add[data-act="text:${k}"]`);
    await wait(300);
    assert((await objCount()) === 3, 'expected 3 texts');
  });
  await step('ชุดข้อความสำเร็จรูปทั้ง 8 แบบ', async () => {
    for (let i = 0; i < 8; i++) { await page.click(`[data-act="combo:${i}"]`); await wait(120); }
    await wait(300);
    assert((await objCount()) === 11, `count ${await objCount()}`);
  });
  await step('ดับเบิลคลิกแก้ข้อความแล้วพิมพ์ภาษาไทย', async () => {
    await clearPage();
    await page.click('.text-add[data-act="text:heading"]');
    await wait(300);
    const p = await screenPoint(0);
    await page.mouse.dblclick(p.x, p.y);
    await page.keyboard.press('Control+a');
    await page.keyboard.type('ทดสอบข้อความ');
    await page.keyboard.press('Escape');
    await wait(200);
    const t = await ev(() => __lai.canvas.getObjects()[0].text);
    assert(t === 'ทดสอบข้อความ', `text=${t}`);
  });
  await step('เปลี่ยนแบบอักษร (Prompt) + ค้นหาฟอนต์', async () => {
    await selectIndex(0);
    await page.click('[data-act="pop:font"]');
    await page.fill('.font-pop [data-q]', 'prom');
    const visible = await page.$$eval('.font-item', (b) => b.filter((x) => !x.hidden).length);
    assert(visible === 1, `search results ${visible}`);
    await page.click('.font-item[data-f="Prompt"]');
    await page.waitForFunction(() => __lai.canvas.getObjects()[0].fontFamily === 'Prompt');
    await page.keyboard.press('Escape');
  });
  await step('ขนาดตัวอักษร: ปุ่ม + / − และพิมพ์ตัวเลข', async () => {
    const s0 = await ev(() => __lai.canvas.getObjects()[0].fontSize);
    await page.click('[data-act="fs:+"]');
    const s1 = await ev(() => __lai.canvas.getObjects()[0].fontSize);
    await page.click('[data-act="fs:-"]');
    await page.fill('[data-fs]', '64');
    await page.press('[data-fs]', 'Enter');
    await wait(100);
    const s2 = await ev(() => __lai.canvas.getObjects()[0].fontSize);
    assert(s1 > s0 && s2 === 64, `${s0} ${s1} ${s2}`);
  });
  await step('ตัวหนา / เอียง / ขีดเส้นใต้ / ขีดฆ่า', async () => {
    for (const k of ['bold', 'italic', 'underline', 'linethrough']) await page.click(`[data-act="toggle:${k}"]`);
    const o = await ev(() => { const t = __lai.canvas.getObjects()[0]; return [t.fontWeight, t.fontStyle, t.underline, t.linethrough]; });
    assert(o[0] === 'normal' && o[1] === 'italic' && o[2] && o[3], JSON.stringify(o));
  });
  await step('จัดตำแหน่งข้อความวน 4 แบบ และสลับตัวพิมพ์ใหญ่/เล็ก', async () => {
    const seen = new Set();
    for (let i = 0; i < 4; i++) { await page.click('[data-act="text-align"]'); seen.add(await ev(() => __lai.canvas.getObjects()[0].textAlign)); }
    assert(seen.size === 4, [...seen].join());
    await ev(() => { __lai.canvas.getObjects()[0].set('text', 'Hello'); });
    await page.click('[data-act="text-case"]');
    assert((await ev(() => __lai.canvas.getObjects()[0].text)) === 'HELLO', 'uppercase');
    await page.click('[data-act="text-case"]');
    assert((await ev(() => __lai.canvas.getObjects()[0].text)) === 'hello', 'lowercase');
  });
  await step('ระยะห่างตัวอักษรและบรรทัด', async () => {
    await page.click('[data-act="pop:spacing"]');
    await page.$eval('[data-p="charSpacing"]', (r) => { r.value = 200; r.dispatchEvent(new Event('input', { bubbles: true })); });
    await page.$eval('[data-p="lineHeight"]', (r) => { r.value = 1.8; r.dispatchEvent(new Event('input', { bubbles: true })); });
    const o = await ev(() => { const t = __lai.canvas.getObjects()[0]; return [t.charSpacing, t.lineHeight]; });
    assert(o[0] === 200 && o[1] === 1.8, JSON.stringify(o));
    await page.keyboard.press('Escape');
  });
  await step('เอฟเฟกต์ข้อความสำเร็จรูป 10 แบบ [C2: ตัดซ้อน เงาสะท้อน กลิตช์]', async () => {
    for (const fx of ['shadow', 'lift', 'outline', 'hollow', 'splice', 'echo', 'glitch', 'neon', 'highlight', 'none']) {
      await page.click('[data-act="pop:effects"]');
      await page.click(`[data-fx="${fx}"]`);
      const o = await ev(() => { const t = __lai.canvas.getObjects()[0]; return { sh: !!t.shadow, st: t.strokeWidth, bg: t.textBackgroundColor }; });
      if (fx === 'shadow' || fx === 'lift' || fx === 'neon') assert(o.sh, fx + ' shadow');
      if (fx === 'outline' || fx === 'hollow' || fx === 'splice' || fx === 'glitch') assert(o.st > 0, fx + ' stroke');
      if (fx === 'splice' || fx === 'echo' || fx === 'glitch') assert(o.sh, fx + ' shadow');
      if (fx === 'highlight') assert(o.bg, 'highlight');
      if (fx === 'none') assert(!o.sh && !o.st && !o.bg, 'none');
    }
  });
  await step('เงาปรับเอง (เปิด/ปิด และสไลเดอร์)', async () => {
    await page.click('[data-act="pop:effects"]');
    await page.check('[data-sh-on]');
    await page.$eval('[data-sh="blur"]', (r) => { r.value = 30; r.dispatchEvent(new Event('input', { bubbles: true })); });
    assert((await ev(() => __lai.canvas.getObjects()[0].shadow.blur)) === 30, 'blur');
    await page.uncheck('[data-sh-on]');
    assert(!(await ev(() => __lai.canvas.getObjects()[0].shadow)), 'shadow off');
    await page.keyboard.press('Escape');
  });
  await step('ข้อความโค้ง (โค้งขึ้น/ลง/คืนค่า) และบันทึก-โหลดได้', async () => {
    await page.click('[data-act="pop:effects"]');
    for (const v of [60, -60, 0]) {
      await page.$eval('[data-curve]', (r, v) => { r.value = v; r.dispatchEvent(new Event('input', { bubbles: true })); }, v);
      const o = await ev(() => { const t = __lai.canvas.getObjects()[0]; return { c: t.curve, p: !!t.path, w: t.width }; });
      assert(o.c === v && o.p === (v !== 0), JSON.stringify(o));
    }
    await page.$eval('[data-curve]', (r) => { r.value = 50; r.dispatchEvent(new Event('input', { bubbles: true })); });
    await page.keyboard.press('Escape');
    await wait(500);
    await ev(() => __lai.commit());
    const json = await ev(() => __lai.serialize());
    assert(json.includes('"curve":50') && json.includes('"path"'), 'curve not serialized');
    await ev(() => __lai.loadPage(__lai.cur));
    await wait(300);
    assert(await ev(() => !!__lai.canvas.getObjects()[0].path), 'curve lost after reload');
    await selectIndex(0);
    await page.click('[data-act="pop:effects"]');
    await page.$eval('[data-curve]', (r) => { r.value = 0; r.dispatchEvent(new Event('input', { bubbles: true })); });
    await page.keyboard.press('Escape');
  });
  await step('รายการแบบจุด → ตัวเลข → เช็กบ็อกซ์ [C3] (ติ๊กทั้งหมด/ทีละบรรทัด) → ปกติ', async () => {
    await ev(() => { __lai.canvas.getObjects()[0].set('text', 'หนึ่ง\nสอง\nสาม'); });
    await page.click('[data-act="list"]');
    assert((await ev(() => __lai.canvas.getObjects()[0].text)).startsWith('• หนึ่ง\n• สอง'), 'bullet');
    await page.click('[data-act="list"]');
    assert((await ev(() => __lai.canvas.getObjects()[0].text)).includes('2. สอง'), 'number');
    await page.click('[data-act="list"]');
    assert((await ev(() => __lai.canvas.getObjects()[0].text)) === '☐ หนึ่ง\n☐ สอง\n☐ สาม', 'check');
    await page.click('[data-act="check-item"]');
    assert((await ev(() => __lai.canvas.getObjects()[0].text)) === '☑ หนึ่ง\n☑ สอง\n☑ สาม', 'tick all');
    await ev(() => { const t = __lai.canvas.getObjects()[0]; t.enterEditing(); t.selectionStart = t.selectionEnd = 8; __lai.toggleCheck(); t.exitEditing(); });
    assert((await ev(() => __lai.canvas.getObjects()[0].text)) === '☑ หนึ่ง\n☐ สอง\n☑ สาม', 'untick line 2: ' + (await ev(() => __lai.canvas.getObjects()[0].text)));
    await page.click('[data-act="list"]');
    assert((await ev(() => __lai.canvas.getObjects()[0].text)) === 'หนึ่ง\nสอง\nสาม', 'none');
  });
  await step('จัดสไตล์เฉพาะตัวอักษรที่เลือกขณะพิมพ์ (สีแดงเฉพาะบางคำ)', async () => {
    await ev(() => { const t = __lai.canvas.getObjects()[0]; t.set('text', 'abcdef'); t.enterEditing(); t.selectionStart = 0; t.selectionEnd = 3; __lai.setProp('fill', '#ff0000'); t.exitEditing(); });
    const st = await ev(() => { const t = __lai.canvas.getObjects()[0]; return [t.getStyleAtPosition(0).fill, t.getStyleAtPosition(4).fill]; });
    assert(st[0] === '#ff0000' && st[1] !== '#ff0000', JSON.stringify(st));
  });

  // =============================================================== COLORS
  group('4. สี');
  await step('สีพื้นฐาน / ไล่เฉดสี / รหัสสี / ไม่มีสี', async () => {
    await clearPage();
    await panel('elements');
    await page.click('[data-act="shape:0"]');
    await page.click('[data-act="color:fill"]');
    await page.click('.popover [data-c="#ff3131"]');
    assert((await ev(() => __lai.canvas.getObjects()[0].fill)) === '#ff3131', 'preset');
    await page.click('.popover [data-g="2"]');
    assert(await ev(() => !!__lai.canvas.getObjects()[0].fill.colorStops), 'gradient');
    await page.fill('.popover [data-hex]', '#123456');
    await page.press('.popover [data-hex]', 'Enter');
    assert((await ev(() => __lai.canvas.getObjects()[0].fill)) === '#123456', 'hex');
    await page.click('.popover [data-c=""]');
    assert((await ev(() => __lai.canvas.getObjects()[0].fill)) === 'transparent', 'none');
    await page.keyboard.press('Escape');
  });
  await step('ชุดสีแบรนด์: เพิ่ม ใช้ และล้าง', async () => {
    await page.click('[data-act="color:fill"]');
    await page.$eval('.popover [data-picker]', (i) => { i.value = '#00aa88'; });
    await page.click('.popover [data-brand-add]');
    await page.waitForSelector('.popover .swatches [data-c="#00aa88"]');
    await page.click('.popover .swatches [data-c="#00aa88"] >> nth=0');
    assert((await ev(() => __lai.canvas.getObjects()[0].fill)) === '#00aa88', 'brand color apply');
    await page.click('.popover [data-brand-clear]');
    await wait(100);
    assert((await ev(() => JSON.parse(localStorage.getItem('lai-brand-colors') || '[]').length)) === 0, 'clear');
    await page.keyboard.press('Escape');
  });
  await step('สีในงานนี้ (document colors) แสดงสีที่ใช้อยู่', async () => {
    await ev(() => { __lai.canvas.getObjects()[0].set('fill', '#abcdef'); });
    await page.click('[data-act="color:fill"]');
    assert(await page.$('.popover [data-c="#abcdef"]'), 'doc color missing');
    await page.keyboard.press('Escape');
  });

  // =============================================================== ELEMENTS
  group('5. องค์ประกอบ');
  await step('รูปทรงทั้ง 24 แบบ', async () => {
    await clearPage();
    for (let i = 0; i < 24; i++) await page.click(`[data-act="shape:${i}"]`);
    assert((await objCount()) === 24, `count ${await objCount()}`);
  });
  await step('เส้นทั้ง 7 แบบ และสติกเกอร์ 48 แบบ', async () => {
    await clearPage();
    for (let i = 0; i < 7; i++) await page.click(`[data-act="line:${i}"]`);
    const n = await page.$$eval('[data-act^="sticker:"]', (e) => e.length);
    for (let i = 0; i < n; i++) await page.click(`[data-act="sticker:${i}"]`);
    assert(n === 48 && (await objCount()) === 55, `stickers ${n} count ${await objCount()}`);
  });
  await step('ค้นหาองค์ประกอบ ("ดาว") กรองผลถูกต้อง', async () => {
    await page.fill('[data-el-search]', 'ดาว');
    const vis = await page.$$eval('.el, .smart-btn', (b) => b.filter((x) => !x.hidden).map((x) => x.title));
    assert(vis.length >= 2 && vis.every((t) => t.includes('ดาว')), vis.join());
    await page.fill('[data-el-search]', '');
  });
  await step('รูปทรง: เส้นขอบ ความหนาขอบ มุมมน', async () => {
    await clearPage();
    await page.click('[data-act="shape:0"]');
    await page.click('[data-act="color:stroke"]');
    await page.click('.popover [data-c="#000000"]');
    await page.keyboard.press('Escape');
    await page.$eval('[data-range="strokeWidth"]', (r) => { r.value = 12; r.dispatchEvent(new Event('input', { bubbles: true })); });
    await page.$eval('[data-range="rx"]', (r) => { r.value = 40; r.dispatchEvent(new Event('input', { bubbles: true })); });
    const o = await ev(() => { const s = __lai.canvas.getObjects()[0]; return [s.stroke, s.strokeWidth, s.rx, s.ry]; });
    assert(o[0] === '#000000' && o[1] === 12 && o[2] === 40 && o[3] === 40, JSON.stringify(o));
  });
  await step('เส้น: สี ความหนา รูปแบบ ทึบ/ประ/จุด', async () => {
    await page.click('[data-act="line:0"]');
    await page.selectOption('[data-select="dash"]', 'dash');
    assert(await ev(() => !!__lai.canvas.getActiveObject().strokeDashArray), 'dash');
    await page.selectOption('[data-select="dash"]', 'solid');
    assert(await ev(() => !__lai.canvas.getActiveObject().strokeDashArray), 'solid');
  });

  // =============================================================== SMART
  group('6. ตาราง กราฟ QR สมการ');
  await step('เพิ่มตาราง แล้วแก้ไข: เพิ่มแถว/คอลัมน์ แก้ช่อง เปลี่ยนสี', async () => {
    await clearPage();
    await page.click('[data-act="smart:table"]');
    await page.waitForFunction(() => __lai.canvas.getActiveObject()?.smart?.type === 'table');
    await page.click('[data-act="smart-edit"]');
    await page.click('[data-t="row+"]');
    await page.click('[data-t="col+"]');
    await page.fill('[data-cell="0,0"]', 'ชื่อนักเรียน');
    await page.$eval('[data-o="headerFill"]', (i) => { i.value = '#ff0000'; });
    await page.click('[data-go]');
    await wait(400);
    const d = await ev(() => __lai.canvas.getActiveObject().smart);
    assert(d.rows.length === 5 && d.rows[0].length === 4 && d.rows[0][0] === 'ชื่อนักเรียน' && d.headerFill === '#ff0000', JSON.stringify(d.rows));
    assert((await objCount()) === 1, 'table duplicated');
  });
  await step('ตาราง: ลบแถว/คอลัมน์ และดับเบิลคลิกเปิดตัวแก้ไข', async () => {
    const p = await screenPoint(0);
    await page.mouse.dblclick(p.x, p.y);
    await page.waitForSelector('.tbl-edit');
    await page.click('[data-t="row-"]');
    await page.click('[data-t="col-"]');
    await page.click('[data-go]');
    await wait(400);
    const d = await ev(() => __lai.canvas.getActiveObject().smart);
    assert(d.rows.length === 4 && d.rows[0].length === 3, `${d.rows.length}x${d.rows[0].length}`);
  });
  await step('กราฟ 4 ชนิด: แท่ง เส้น วงกลม โดนัท', async () => {
    for (const k of ['bar', 'line', 'pie', 'donut']) {
      await page.click(`[data-act="smart:${k}"]`);
      await page.waitForFunction((k) => __lai.canvas.getActiveObject()?.smart?.chart === k, k);
    }
  });
  await step('แก้กราฟ: เปลี่ยนชนิด เพิ่ม/ลบข้อมูล ชุดสี ชื่อกราฟ', async () => {
    await page.click('[data-act="smart-edit"]');
    await page.selectOption('[data-o="chart"]', 'bar');
    await page.click('[data-add]');
    await page.fill('[data-l="5"]', 'มิ.ย.');
    await page.fill('[data-v="5"]', '30');
    await page.click('[data-del="0"]');
    await page.click('[data-pal="2"]');
    await page.fill('[data-o="title"]', 'คะแนนสอบ');
    await page.click('[data-go]');
    await wait(400);
    const d = await ev(() => __lai.canvas.getActiveObject().smart);
    assert(d.chart === 'bar' && d.labels.length === 5 && d.labels[4] === 'มิ.ย.' && d.values[4] === 30 && d.title === 'คะแนนสอบ' && d.colors[0] === '#ff6b4a', JSON.stringify(d));
  });
  await step('[C4] กราฟอินโฟกราฟิก 5 แบบ: แท่งแนวนอน พื้นที่ แถบความคืบหน้า วงแหวน ภาพสัญลักษณ์', async () => {
    for (const k of ['hbar', 'area', 'progress', 'ring', 'pictogram']) {
      await page.click(`[data-act="smart:${k}"]`);
      await page.waitForFunction((k) => __lai.canvas.getActiveObject()?.smart?.chart === k, k);
      const n = await ev(() => __lai.canvas.getActiveObject().getObjects().length);
      assert(n > 4, `${k} has ${n} parts`);
    }
  });
  await step('[C4] นำเข้าข้อมูลกราฟ: วางจาก Excel (TSV) และไฟล์ CSV', async () => {
    await page.click('[data-act="smart-edit"]');
    await page.click('[data-import-toggle]');
    await page.fill('[data-paste]', 'วิชา\tคะแนน\nคณิต\t85\nไทย\t72\nอังกฤษ\t64%');
    await page.click('[data-import-go]');
    assert((await page.$$eval('.data-row', (e) => e.length)) === 3, 'tsv rows');
    const csv = path.join(OUT, 'data.csv');
    fs.writeFileSync(csv, 'name,value\n"ก, ข",10\nค,20\nง,30\nจ,40\n');
    await page.click('[data-import-toggle]');
    await page.setInputFiles('[data-csv-file]', csv);
    await page.click('[data-import-go]');
    await page.click('[data-go]');
    await wait(400);
    const d = await ev(() => __lai.canvas.getActiveObject().smart);
    assert(d.labels.join('|') === 'ก, ข|ค|ง|จ' && d.values.join() === '10,20,30,40', JSON.stringify(d.labels) + d.values);
  });
  await step('[C4] นำเข้าตารางจาก CSV', async () => {
    await page.click('[data-act="smart:table"]');
    await page.waitForFunction(() => __lai.canvas.getActiveObject()?.smart?.type === 'table');
    await page.click('[data-act="smart-edit"]');
    await page.click('[data-t="import"]');
    await page.fill('.import-box [data-paste]', 'ชื่อ,อายุ,ห้อง\nเอ,10,1/1\nบี,11,1/2');
    await page.click('[data-t="import-go"]');
    await page.click('[data-go]');
    await wait(400);
    const rows = await ev(() => __lai.canvas.getActiveObject().smart.rows);
    assert(rows.length === 3 && rows[0].join() === 'ชื่อ,อายุ,ห้อง' && rows[2][2] === '1/2', JSON.stringify(rows));
  });
  await step('[C5] คลังไอคอน 48 แบบ: เพิ่มทุกแบบ ค้นหา เปลี่ยนสีและความหนาเส้น', async () => {
    const n0 = await objCount();
    const n = await page.$$eval('[data-act^="smart:icon-"]', (e) => e.length);
    assert(n === 48, `icons ${n}`);
    for (let i = 0; i < n; i++) await page.click(`[data-act^="smart:icon-"] >> nth=${i}`);
    await page.waitForFunction((t) => __lai.canvas.getObjects().length === t, n0 + n);
    const empty = await ev(() => __lai.canvas.getObjects().filter((o) => o.smart?.type === 'icon' && o.getObjects().length < 2).map((o) => o.smart.name));
    assert(!empty.length, 'icons without paths: ' + empty);
    await page.fill('[data-el-search]', 'กล้อง');
    const vis = await page.$$eval('.el, .smart-btn', (b) => b.filter((x) => !x.hidden).length);
    assert(vis === 1, `search ${vis}`);
    await page.fill('[data-el-search]', '');
    await page.click('[data-act="color:iconColor"]');
    await page.click('.popover [data-c="#ff3131"]');
    await page.waitForFunction(() => __lai.canvas.getActiveObject()?.smart?.color === '#ff3131');
    const strokes = await ev(() => __lai.canvas.getActiveObject().getObjects().slice(1).map((o) => o.stroke));
    assert(strokes.every((c) => c === '#ff3131'), strokes.join());
    const w0 = await ev(() => Math.round(__lai.canvas.getActiveObject().getScaledWidth()));
    await page.$eval('[data-icon-weight]', (r) => { r.value = 3; r.dispatchEvent(new Event('change', { bubbles: true })); });
    await page.waitForFunction(() => __lai.canvas.getActiveObject()?.smart?.weight === 3);
    const w1 = await ev(() => Math.round(__lai.canvas.getActiveObject().getScaledWidth()));
    assert(Math.abs(w1 - w0) <= 2 && (await objCount()) === n0 + n, `size ${w0}->${w1}`);
    await ev(() => { const c = __lai.canvas; c.discardActiveObject(); c.remove(...c.getObjects().filter((o) => o.smart?.type === 'icon')); __lai.commit(); });
  });
  await step('QR Code: เพิ่ม แก้ลิงก์ สี พื้นโปร่งใส', async () => {
    await page.click('[data-act="smart:qr"]');
    await page.click('[data-act="smart-edit"]');
    await page.fill('.modal [data-text]', 'https://www.example.org/ทดสอบ');
    await page.check('.modal [data-nobg]');
    await page.click('[data-go]');
    await wait(300);
    const d = await ev(() => __lai.canvas.getActiveObject().smart);
    assert(d.text === 'https://www.example.org/ทดสอบ' && d.bg === '', JSON.stringify(d));
  });
  await step('QR Code: ข้อความว่างต้องแจ้งเตือน', async () => {
    await page.click('[data-act="smart-edit"]');
    await page.fill('.modal [data-text]', '');
    await page.click('[data-go]');
    await page.waitForSelector('.toast.error');
    await page.keyboard.press('Escape');
  });
  await step('สมการ: เพิ่ม แก้ไข ใช้ปุ่มแทรก ดูตัวอย่าง', async () => {
    await page.click('[data-act="smart:equation"]');
    await page.waitForFunction(() => __lai.canvas.getActiveObject()?.smart?.type === 'equation', null, { timeout: 30000 });
    await page.click('[data-act="smart-edit"]');
    await page.fill('[data-latex]', '');
    await page.click('[data-s="\\\\frac{a}{b}"]');
    await page.waitForSelector('.eq-preview svg');
    await page.fill('[data-latex]', 'a^2 + b^2 = c^2');
    await page.click('[data-go]');
    await page.waitForFunction(() => __lai.canvas.getActiveObject()?.smart?.latex === 'a^2 + b^2 = c^2');
  });
  await step('สมการผิดต้องแจ้งเตือนและไม่เปลี่ยนสมการเดิม', async () => {
    await page.click('[data-act="smart-edit"]');
    await page.fill('[data-latex]', '\\frac{1}{');
    await page.waitForSelector('.eq-preview.err');
    await page.click('[data-go]');
    await page.waitForSelector('.toast.error');
    await page.keyboard.press('Escape');
    assert((await ev(() => __lai.canvas.getActiveObject().smart.latex)) === 'a^2 + b^2 = c^2', 'equation changed');
  });
  await step('องค์ประกอบอัจฉริยะบันทึกและโหลดกลับมาแก้ไขได้', async () => {
    await ev(() => __lai.commit());
    await ev(() => __lai.loadPage(__lai.cur));
    await wait(500);
    const types = await ev(() => __lai.canvas.getObjects().map((o) => o.smart && o.smart.type));
    assert(['table', 'chart', 'qr', 'equation'].every((t) => types.includes(t)), types.join());
  });

  // =============================================================== IMAGES
  group('7. รูปภาพ กรอบรูป กริด');
  await step('อัปโหลดรูปผ่านแผงอัปโหลด → อยู่บนงานและในคลัง', async () => {
    await clearPage();
    await panel('uploads');
    await page.setInputFiles('[data-file-upload]', IMG);
    await page.waitForFunction(() => __lai.canvas.getObjects().some((o) => o.type === 'image'));
    await page.waitForSelector('.up-img');
  });
  await step('คลิกรูปในคลังเพื่อเพิ่ม และลบรูปจากคลัง', async () => {
    const n0 = await objCount();
    await page.click('.up-img >> nth=0');
    await wait(300);
    assert((await objCount()) === n0 + 1, 'add from library');
    const u0 = await page.$$eval('.up', (e) => e.length);
    await page.click('.up-del >> nth=0', { force: true });
    await wait(300);
    assert((await page.$$eval('.up', (e) => e.length)) === u0 - 1, 'delete upload');
  });
  await step('ปรับแต่งรูป: ฟิลเตอร์ 6 แบบ + สไลเดอร์ + ขาวดำ/ซีเปีย/กลับสี', async () => {
    await selectIndex(0);
    await page.click('[data-act="pop:adjust"]');
    for (const p of ['bw', 'sepia', 'vivid', 'fade', 'dramatic', 'none']) await page.click(`[data-pre="${p}"]`);
    await page.$eval('[data-k="brightness"]', (r) => { r.value = 20; r.dispatchEvent(new Event('input', { bubbles: true })); });
    await page.$eval('[data-k="blur"]', (r) => { r.value = 30; r.dispatchEvent(new Event('input', { bubbles: true })); });
    await page.check('[data-t="grayscale"]');
    const f = await ev(() => __lai.canvas.getObjects()[0].filters.map((x) => x.type));
    assert(f.includes('Brightness') && f.includes('Blur') && f.includes('Grayscale'), f.join());
    await page.keyboard.press('Escape');
  });
  await step('[C1] ปรับรูปเพิ่ม: อุณหภูมิสี ทินต์ คมชัด วิกเน็ต พิกเซล ทูโทน + ฟิลเตอร์อบอุ่น/เย็น/ย้อนยุค และโหลดกลับได้', async () => {
    await page.click('[data-act="pop:adjust"]');
    for (const p of ['warm', 'cool', 'retro', 'none']) await page.click(`[data-pre="${p}"]`);
    for (const [k, v] of [['warmth', 40], ['tint', -30], ['sharpen', 50], ['vignette', 60], ['pixelate', 8]]) {
      await page.$eval(`[data-k="${k}"]`, (r, v) => { r.value = v; r.dispatchEvent(new Event('input', { bubbles: true })); }, v);
    }
    await page.check('[data-t="duotone"]');
    const f = await ev(() => __lai.canvas.getObjects()[0].filters.map((x) => x.type));
    for (const t of ['ColorMatrix', 'Convolute', 'Pixelate', 'Vignette']) assert(f.includes(t), `${t} missing: ${f}`);
    assert(f.filter((x) => x === 'ColorMatrix').length === 3, `colormatrix count ${f}`);
    await page.keyboard.press('Escape');
    await ev(() => __lai.commit());
    await ev(() => __lai.loadPage(__lai.cur));
    await wait(400);
    const f2 = await ev(() => __lai.canvas.getObjects()[0].filters.map((x) => x.type));
    assert(f2.join() === f.join(), `reload ${f2}`);
    const png = await ev(() => __lai.canvas.toDataURL({ format: 'png' }).length);
    assert(png > 1000, 'render');
    await selectIndex(0);
    await page.click('[data-act="pop:adjust"]');
    await page.click('[data-pre="none"]');
    assert((await ev(() => __lai.canvas.getObjects()[0].filters.length)) === 0, 'reset');
    await page.keyboard.press('Escape');
  });
  await step('ครอบตัด: สไลเดอร์และอัตราส่วน 1:1 / 16:9 / รีเซ็ต', async () => {
    await page.click('[data-act="pop:crop"]');
    await page.click('[data-ratio="1"]');
    let o = await ev(() => { const i = __lai.canvas.getObjects()[0]; return [Math.round(i.width), Math.round(i.height)]; });
    assert(o[0] === o[1], `1:1 ${o}`);
    await page.click('[data-ratio="1.7778"]');
    o = await ev(() => { const i = __lai.canvas.getObjects()[0]; return i.width / i.height; });
    assert(Math.abs(o - 1.7778) < 0.02, `16:9 ${o}`);
    await page.$eval('[data-k="l"]', (r) => { r.value = 20; r.dispatchEvent(new Event('input', { bubbles: true })); });
    await page.click('[data-ratio="0"]');
    o = await ev(() => { const i = __lai.canvas.getObjects()[0]; return [i.width, i.height, i.cropX]; });
    assert(o[0] === 400 && o[1] === 300 && o[2] === 0, `reset ${o}`);
    await page.keyboard.press('Escape');
  });
  await step('กรอบรูปทรง 6 แบบ + เส้นขอบรูป', async () => {
    for (const m of ['circle', 'rounded', 'star', 'heart', 'hexagon', 'none']) {
      await page.click('[data-act="pop:mask"]');
      await page.click(`[data-m="${m}"]`);
      const mk = await ev(() => { const i = __lai.canvas.getObjects()[0]; return [i.mask, !!i.clipPath]; });
      assert(m === 'none' ? !mk[0] && !mk[1] : mk[0] === m && mk[1], `${m} ${mk}`);
      await page.keyboard.press('Escape');
    }
    await page.click('[data-act="pop:mask"]');
    await page.$eval('.popover [data-p="strokeWidth"]', (r) => { r.value = 10; r.dispatchEvent(new Event('input', { bubbles: true })); });
    assert((await ev(() => __lai.canvas.getObjects()[0].strokeWidth)) === 10, 'image border');
    await page.keyboard.press('Escape');
  });
  await step('พลิกรูปแนวนอน/แนวตั้ง', async () => {
    await page.click('[data-act="flip:flipX"]');
    await page.click('[data-act="flip:flipY"]');
    assert(await ev(() => { const i = __lai.canvas.getObjects()[0]; return i.flipX && i.flipY; }), 'flip');
  });
  await step('แทนที่รูป (คงขนาดและกรอบเดิม)', async () => {
    await page.click('[data-act="pop:mask"]');
    await page.click('[data-m="circle"]');
    await page.keyboard.press('Escape');
    const before = await ev(() => { const i = __lai.canvas.getObjects()[0]; return [Math.round(i.getScaledWidth()), Math.round(i.getScaledHeight())]; });
    const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('[data-act="replace-img"]')]);
    await fc.setFiles(IMG2);
    await page.waitForFunction(() => __lai.canvas.getObjects()[0].getOriginalSize().height === 500);
    const after = await ev(() => { const i = __lai.canvas.getObjects()[0]; return [Math.round(i.getScaledWidth()), Math.round(i.getScaledHeight()), i.mask]; });
    assert(after[0] === before[0] && after[1] === before[1] && after[2] === 'circle', `${before} -> ${after}`);
  });
  await step('[C15] ข้อความแทนรูป (Alt text): บันทึก โหลดกลับ และใช้ในโหมดนำเสนอ', async () => {
    await selectIndex(0);
    await page.click('[data-act="pop:alt"]');
    await page.fill('.popover [data-alt]', 'ภาพไล่สีทดสอบ');
    await page.click('.popover [data-save]');
    await ev(() => __lai.loadPage(__lai.cur));
    await wait(300);
    assert((await ev(() => __lai.canvas.getObjects()[0].alt)) === 'ภาพไล่สีทดสอบ', 'alt saved');
    await page.click('[data-act="present"]');
    await page.waitForSelector('.present img[src^="data:"]', { timeout: 20000 });
    assert((await page.getAttribute('.present img[data-img]', 'alt')).includes('รูป: ภาพไล่สีทดสอบ'), 'present alt');
    await page.keyboard.press('Escape');
    await page.waitForSelector('.present', { state: 'detached' });
  });
  await step('ตั้งรูปเป็นพื้นหลัง และลบภาพพื้นหลัง', async () => {
    await selectIndex(0);
    await page.click('[data-act="img-bg"]');
    await page.waitForFunction(() => !!__lai.canvas.backgroundImage);
    await ev(() => { __lai.canvas.discardActiveObject(); __lai.renderCtx(); });
    await page.click('.ctxbar [data-act="bg-remove-image"]');
    assert(await ev(() => !__lai.canvas.backgroundImage), 'bg image removed');
  });
  await step('กรอบรูป 8 แบบ (placeholder)', async () => {
    await clearPage();
    await panel('elements');
    for (let i = 0; i < 8; i++) await page.click(`[data-act="frame:${i}"]`);
    await wait(500);
    assert((await ev(() => __lai.canvas.getObjects().filter((o) => o.placeholder).length)) === 8, 'frames');
  });
  await step('ตารางรูป (กริด) 6 แบบ ช่องไม่ล้นหน้า', async () => {
    await clearPage();
    const expect = [2, 2, 3, 4, 6, 4];
    for (let i = 0; i < 6; i++) {
      await clearPage();
      await page.click(`[data-act="grid:${i}"]`);
      await wait(300);
      const r = await ev(() => { const os = __lai.canvas.getObjects(); return { n: os.length, inside: os.every((o) => { o.setCoords(); const b = o.getBoundingRect(); return b.left >= -1 && b.top >= -1 && b.left + b.width <= __lai.W + 1 && b.top + b.height <= __lai.H + 1; }) }; });
      assert(r.n === expect[i] && r.inside, `grid ${i}: ${JSON.stringify(r)}`);
    }
  });
  await step('ลากไฟล์รูปมาวางบนช่องรูป → แทนที่รูปในช่อง', async () => {
    const p = await screenPoint(0);
    const b64 = fs.readFileSync(IMG2).toString('base64');
    await page.evaluate(({ p, b64 }) => {
      const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const dt = new DataTransfer();
      dt.items.add(new File([bin], 'drop.png', { type: 'image/png' }));
      const ws = document.querySelector('[data-ws]');
      ws.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, clientX: p.x, clientY: p.y, bubbles: true, cancelable: true }));
    }, { p, b64 });
    await page.waitForFunction(() => __lai.canvas.getObjects().filter((o) => !o.placeholder).length === 1);
    assert((await objCount()) === 4, 'grid cell count changed');
  });
  await step('ลากองค์ประกอบจากแผงมาวางตรงตำแหน่งที่ปล่อย', async () => {
    await clearPage();
    const box = await page.locator('.upper-canvas').boundingBox();
    await page.evaluate(({ x, y }) => {
      const dt = new DataTransfer();
      dt.setData('application/x-lai-act', 'shape:2');
      document.querySelector('[data-ws]').dispatchEvent(new DragEvent('drop', { dataTransfer: dt, clientX: x, clientY: y, bubbles: true, cancelable: true }));
    }, { x: box.x + box.width * 0.25, y: box.y + box.height * 0.25 });
    await page.waitForFunction(() => __lai.canvas.getObjects().length === 1);
    const c = await ev(() => { const p = __lai.canvas.getObjects()[0].getCenterPoint(); return [p.x / __lai.W, p.y / __lai.H]; });
    assert(Math.abs(c[0] - 0.25) < 0.03 && Math.abs(c[1] - 0.25) < 0.03, `center ${c}`);
  });
  await step('วางรูปจากคลิปบอร์ด (Ctrl+V)', async () => {
    const n0 = await objCount();
    const b64 = fs.readFileSync(IMG).toString('base64');
    await page.evaluate((b64) => {
      const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const dt = new DataTransfer();
      dt.items.add(new File([bin], 'clip.png', { type: 'image/png' }));
      document.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
    }, b64);
    await page.waitForFunction((n0) => __lai.canvas.getObjects().length === n0 + 1, n0);
  });
  await step('แผงรูปภาพฟรีแสดงรายการรูป', async () => {
    await panel('photos');
    assert((await page.$$eval('[data-act^="photo:"]', (e) => e.length)) > 0, 'no photos listed');
  });

  // =============================================================== BACKGROUND / DRAW
  group('8. พื้นหลัง และวาดอิสระ');
  await step('พื้นหลัง: สีพื้น ไล่เฉด ตัวเลือกสี', async () => {
    await panel('background');
    await page.click('[data-act="bg:#ffde59"]');
    assert((await ev(() => __lai.canvas.backgroundColor)) === '#ffde59', 'solid');
    await page.click('[data-act="bggrad:0"]');
    assert(await ev(() => !!__lai.canvas.backgroundColor.colorStops), 'gradient');
    await page.$eval('[data-bg-picker]', (i) => { i.value = '#112233'; i.dispatchEvent(new Event('change', { bubbles: true })); });
    assert((await ev(() => __lai.canvas.backgroundColor)) === '#112233', 'picker');
  });
  await step('อัปโหลดภาพเป็นพื้นหลัง', async () => {
    await page.setInputFiles('[data-file-bg]', IMG);
    await page.waitForFunction(() => !!__lai.canvas.backgroundImage);
    const cover = await ev(() => { const b = __lai.canvas.backgroundImage; return b.getScaledWidth() >= __lai.W - 1 && b.getScaledHeight() >= __lai.H - 1; });
    assert(cover, 'background does not cover page');
    await page.click('[data-act="bg:#ffffff"]');
  });
  await step('วาดด้วยปากกาและปากกาไฮไลต์ แล้วเลิกวาด', async () => {
    await clearPage();
    await panel('draw');
    const box = await page.locator('.upper-canvas').boundingBox();
    const drawLine = async (y) => { await page.mouse.move(box.x + 60, box.y + y); await page.mouse.down(); for (let i = 0; i < 15; i++) await page.mouse.move(box.x + 60 + i * 20, box.y + y + (i % 2) * 15); await page.mouse.up(); };
    await drawLine(80);
    await page.click('[data-act="draw-mode:highlighter"]');
    await page.click('[data-act="draw-color:#ff3131"]');
    await drawLine(200);
    const paths = await ev(() => __lai.canvas.getObjects().map((o) => [o.type, o.name, o.stroke]));
    assert(paths.length === 2 && paths[1][2].startsWith('rgba(255,49,49'), JSON.stringify(paths));
    await page.click('[data-act="draw-stop"]');
    assert(await ev(() => !__lai.canvas.isDrawingMode), 'still drawing');
  });

  // =============================================================== ARRANGE
  group('9. จัดวาง เลเยอร์ กลุ่ม');
  const three = async () => {
    await clearPage();
    await panel('elements');
    for (let i = 0; i < 3; i++) await page.click('[data-act="shape:0"]');
    await ev(() => { __lai.canvas.getObjects().forEach((o, i) => { o.set({ left: 100 + i * 150 + i * i * 40, top: 100 + i * 120, scaleX: 0.5, scaleY: 0.5 }); o.setCoords(); }); __lai.commit(); });
  };
  await step('เลือกหลายชิ้น (Ctrl+A) แล้วจัดแนว 6 ทิศ', async () => {
    await three();
    await ev(() => __lai.canvas.discardActiveObject());
    await page.keyboard.press('Control+a');
    for (const k of ['left', 'center', 'right', 'top', 'middle', 'bottom']) await page.click(`.ctxbar [data-act="align:${k}"]`);
    const tops = await ev(() => __lai.canvas.getObjects().map((o) => Math.round(o.getBoundingRect().top + o.getBoundingRect().height)));
    assert(new Set(tops).size === 1, `bottom-aligned ${tops}`);
  });
  await step('เว้นระยะเท่ากันแนวนอนและแนวตั้ง', async () => {
    await three();
    await page.keyboard.press('Control+a');
    await page.click('.ctxbar [data-act="distribute:h"]');
    const gaps = await ev(() => { const b = __lai.canvas.getObjects().map((o) => o.getBoundingRect()).sort((a, c) => a.left - c.left); return [b[1].left - (b[0].left + b[0].width), b[2].left - (b[1].left + b[1].width)]; });
    assert(Math.abs(gaps[0] - gaps[1]) < 1, `gaps ${gaps}`);
    await page.click('.ctxbar [data-act="distribute:v"]');
  });
  await step('จัดกลุ่ม / ยกเลิกกลุ่ม (Ctrl+G / Ctrl+Shift+G)', async () => {
    await page.keyboard.press('Control+a');
    await page.keyboard.press('Control+g');
    let a = await active();
    assert(a.type === 'group' && a.n === 3 && (await objCount()) === 1, JSON.stringify(a));
    await page.keyboard.press('Control+Shift+g');
    a = await active();
    assert(a.type === 'activeselection' && (await objCount()) === 3, JSON.stringify(a));
  });
  await step('ลำดับชั้น: บนสุด ล่างสุด เลื่อนขึ้น เลื่อนลง', async () => {
    await ev(() => { const c = __lai.canvas; c.getObjects().forEach((o, i) => { o.name = 'S' + i; }); c.discardActiveObject(); });
    await selectIndex(0);
    await page.click('[data-act="pop:position"]');
    await page.click('[data-a="arrange:front"]');
    assert((await ev(() => __lai.canvas.getObjects().map((o) => o.name).join())) === 'S1,S2,S0', 'front');
    await page.click('[data-a="arrange:back"]');
    assert((await ev(() => __lai.canvas.getObjects().map((o) => o.name).join())) === 'S0,S1,S2', 'back');
    await page.click('[data-a="arrange:forward"]');
    assert((await ev(() => __lai.canvas.getObjects().map((o) => o.name).join())) === 'S1,S0,S2', 'forward');
    await page.click('[data-a="arrange:backward"]');
    assert((await ev(() => __lai.canvas.getObjects().map((o) => o.name).join())) === 'S0,S1,S2', 'backward');
  });
  await step('ตำแหน่ง: ใส่ความกว้าง X Y และองศาการหมุน', async () => {
    await page.fill('[data-f="w"]', '300'); await page.press('[data-f="w"]', 'Enter');
    await page.fill('[data-f="x"]', '50'); await page.press('[data-f="x"]', 'Enter');
    await page.fill('[data-f="y"]', '60'); await page.press('[data-f="y"]', 'Enter');
    const b = await ev(() => { const o = __lai.canvas.getActiveObject(); o.setCoords(); const r = o.getBoundingRect(); return [Math.round(r.width), Math.round(r.left), Math.round(r.top)]; });
    assert(b[0] === 300 && b[1] === 50 && b[2] === 60, JSON.stringify(b));
    await page.fill('[data-f="angle"]', '30'); await page.press('[data-f="angle"]', 'Enter');
    assert((await ev(() => __lai.canvas.getActiveObject().angle)) === 30, 'angle');
    await page.keyboard.press('Escape');
  });
  await step('ความโปร่งใส', async () => {
    await selectIndex(0);
    await page.click('[data-act="pop:opacity"]');
    await page.$eval('.popover [data-r]', (r) => { r.value = 40; r.dispatchEvent(new Event('input', { bubbles: true })); });
    assert((await ev(() => __lai.canvas.getObjects()[0].opacity)) === 0.4, 'opacity');
    await page.keyboard.press('Escape');
  });
  await step('คัดลอกสไตล์ไปวางให้วัตถุอื่น', async () => {
    await ev(() => { const o = __lai.canvas.getObjects(); o[0].set({ fill: '#ff00aa', stroke: '#000000', strokeWidth: 9 }); o[1].set({ fill: '#00ff00', strokeWidth: 0 }); });
    await selectIndex(0);
    await page.click('[data-act="copy-style"]');
    const p = await screenPoint(1);
    await page.mouse.click(p.x, p.y);
    await wait(300);
    const s = await ev(() => { const o = __lai.canvas.getObjects()[1]; return [o.fill, o.strokeWidth]; });
    assert(s[0] === '#ff00aa' && s[1] === 9, JSON.stringify(s));
  });
  await step('แผงเลเยอร์: เลือก ซ่อน/แสดง ล็อก/ปลดล็อก เลื่อนลำดับ', async () => {
    await panel('layers');
    assert((await page.$$eval('.layer', (e) => e.length)) === 3, 'layer count');
    await page.click('[data-act="layer-sel:0"]');
    assert((await ev(() => __lai.canvas.getActiveObject() === __lai.canvas.getObjects()[0])), 'select');
    await page.click('[data-act="layer-vis:0"]');
    assert(await ev(() => !__lai.canvas.getObjects()[0].visible), 'hide');
    await page.click('[data-act="layer-vis:0"]');
    await page.click('[data-act="layer-lock:0"]');
    assert(await ev(() => __lai.canvas.getObjects()[0].locked && __lai.canvas.getObjects()[0].lockMovementX), 'lock');
    await page.click('[data-act="layer-lock:0"]');
    await page.click('[data-act="layer-up:0"]');
    assert((await ev(() => __lai.canvas.getObjects()[1].name)) === 'S0', 'layer up');
  });
  await step('ล็อกแล้วลบไม่ได้ ปลดล็อกแล้วลบได้', async () => {
    await selectIndex(0);
    await page.click('[data-act="lock"]');
    await page.keyboard.press('Delete');
    assert((await objCount()) === 3, 'locked object deleted');
    await page.click('[data-act="lock"]');
    await page.keyboard.press('Delete');
    assert((await objCount()) === 2, 'unlock+delete');
  });
  await step('เมนูคลิกขวา: ทำสำเนา ลบ วาง เลือกทั้งหมด', async () => {
    const p = await screenPoint(0);
    await page.mouse.click(p.x, p.y, { button: 'right' });
    await page.click('.popover [data-m="duplicate"]');
    await wait(200);
    assert((await objCount()) === 3, 'ctx duplicate');
    const p2 = await screenPoint(2);
    await page.mouse.click(p2.x, p2.y, { button: 'right' });
    await page.click('.popover [data-m="delete"]');
    assert((await objCount()) === 2, 'ctx delete');
    const box = await page.locator('.upper-canvas').boundingBox();
    await page.mouse.click(box.x + 5, box.y + box.height - 5, { button: 'right' });
    await page.click('.popover [data-m="selectall"]');
    assert((await active()).type === 'activeselection', 'select all');
  });

  // =============================================================== KEYBOARD / HISTORY
  group('10. ปุ่มลัด และเลิกทำ/ทำซ้ำ');
  await step('Ctrl+C / Ctrl+V / Ctrl+D / Ctrl+X', async () => {
    await clearPage();
    await page.click('.workspace', { position: { x: 5, y: 5 } });
    await page.keyboard.press('r');
    await page.keyboard.press('Control+c');
    await page.keyboard.press('Control+v');
    assert((await objCount()) === 2, 'paste');
    await page.keyboard.press('Control+d');
    assert((await objCount()) === 3, 'duplicate');
    await page.keyboard.press('Control+x');
    await wait(100);
    assert((await objCount()) === 2, 'cut');
    await page.keyboard.press('Control+v');
    assert((await objCount()) === 3, 'paste after cut');
  });
  await step('[C12] คัดลอกจากงานหนึ่งไปวางอีกงาน (ข้ามงานออกแบบ) และ Ctrl+D ไม่ถูกคลิปบอร์ดรบกวน', async () => {
    const designId = await ev(() => __lai.design.id);
    await ev(() => { const c = __lai.canvas; const r = c.getObjects().find((o) => o.type === 'rect'); r.set({ fill: '#13579b', name: 'ข้ามงาน' }); c.setActiveObject(r); __lai.commit(); });
    await page.keyboard.press('Control+c');
    await page.click('[data-act="home"]');
    await page.waitForSelector('.preset');
    await page.click('.preset[data-preset="1"]');
    await page.waitForSelector('.canvas-container');
    await wait(400);
    await page.keyboard.press('Control+v');
    await page.waitForFunction(() => __lai.canvas.getObjects().length === 1);
    assert((await ev(() => __lai.canvas.getObjects()[0].fill)) === '#13579b', 'pasted fill');
    await page.keyboard.press('r');
    await page.keyboard.press('Control+d');
    const fills = await ev(() => __lai.canvas.getObjects().map((o) => o.fill));
    assert(fills.length === 3 && fills[2] === fills[1] && fills[1] !== '#13579b', 'duplicate used clipboard: ' + fills);
    const otherId = await ev(() => __lai.design.id);
    // remove the scratch design so later counts are not affected
    await page.click('[data-act="home"]');
    await page.waitForSelector('.design-card');
    await page.click(`[data-menu="${otherId}"]`);
    await page.click('.popover [data-m="del"]');
    await page.click('.modal [data-yes]');
    await page.waitForFunction((id) => !document.querySelector(`[data-menu="${id}"]`), otherId);
    await page.click(`[data-open="${designId}"]`);
    await page.waitForSelector('.canvas-container');
    await wait(400);
    await selectIndex(-1);
  });
  await step('ปุ่มลูกศรขยับ 1px และ Shift 10px', async () => {
    const x0 = await ev(() => __lai.canvas.getActiveObject().left);
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Shift+ArrowRight');
    const x1 = await ev(() => __lai.canvas.getActiveObject().left);
    assert(Math.round(x1 - x0) === 11, `${x0} -> ${x1}`);
  });
  await step('T / R / C เพิ่มข้อความ สี่เหลี่ยม วงกลม และ Esc ยกเลิกเลือก', async () => {
    await clearPage();
    await page.keyboard.press('Escape');
    await page.keyboard.press('t');
    await wait(400);
    await page.keyboard.press('Escape');
    await page.keyboard.press('r');
    await page.keyboard.press('Escape');
    await page.keyboard.press('c');
    const types = await ev(() => __lai.canvas.getObjects().map((o) => o.type));
    assert(types.join() === 'textbox,rect,circle', types.join());
    await page.keyboard.press('Escape');
    assert(!(await active()), 'escape');
  });
  await step('เลิกทำ/ทำซ้ำหลายขั้น (ปุ่มและ Ctrl+Z / Ctrl+Y)', async () => {
    await page.keyboard.press('Control+z');
    await wait(150);
    assert((await objCount()) === 2, 'undo 1');
    await page.click('[data-act="undo"]');
    await wait(150);
    assert((await objCount()) === 1, 'undo 2');
    await page.keyboard.press('Control+y');
    await wait(150);
    assert((await objCount()) === 2, 'redo 1');
    await page.click('[data-act="redo"]');
    await wait(150);
    assert((await objCount()) === 3, 'redo 2');
  });
  await step('[C13] ปุ่มลัด: Ctrl+] [ ลำดับชั้น, Ctrl+B/I/U ข้อความ, Ctrl+Shift+L ล็อก, หมุนสแนปมุม', async () => {
    await ev(() => { const c = __lai.canvas; c.getObjects().forEach((o, i) => { o.name = 'K' + i; }); });
    const order = () => ev(() => __lai.canvas.getObjects().map((o) => o.name).join());
    const o0 = await order();
    await selectIndex(0);
    await page.keyboard.press('Control+BracketRight');
    assert((await order()) !== o0 && (await order()).split(',')[1] === 'K0', 'forward ' + (await order()));
    await page.keyboard.press('Control+Shift+BracketRight');
    assert((await order()).split(',').at(-1) === 'K0', 'front');
    await page.keyboard.press('Control+Shift+BracketLeft');
    assert((await order()).split(',')[0] === 'K0', 'back');
    await page.keyboard.press('Control+Shift+KeyL');
    assert(await ev(() => __lai.canvas.getActiveObject().locked), 'lock');
    await page.keyboard.press('Control+Shift+KeyL');
    assert(!(await ev(() => __lai.canvas.getActiveObject().locked)), 'unlock');
    const ti = await ev(() => __lai.canvas.getObjects().findIndex((o) => o.type === 'textbox'));
    await selectIndex(ti);
    await page.keyboard.press('Control+b');
    await page.keyboard.press('Control+i');
    await page.keyboard.press('Control+u');
    const st = await ev((i) => { const t = __lai.canvas.getObjects()[i]; return [t.fontWeight, t.fontStyle, t.underline]; }, ti);
    assert(st[1] === 'italic' && st[2] === true, JSON.stringify(st));
    // rotation snapping via the rotate control
    await selectIndex(0);
    const pts = await ev(() => { const c = __lai.canvas; const o = c.getActiveObject(); o.setCoords(); const m = o.oCoords.mtr, ctr = o.getCenterPoint(), v = c.viewportTransform, r = c.upperCanvasEl.getBoundingClientRect(); return { mx: r.left + m.x, my: r.top + m.y, cx: r.left + ctr.x * v[0] + v[4], cy: r.top + ctr.y * v[3] + v[5] }; });
    await page.mouse.move(pts.mx, pts.my);
    await page.mouse.down();
    const rad = (deg) => (deg - 90) * Math.PI / 180;
    const R = Math.hypot(pts.mx - pts.cx, pts.my - pts.cy);
    await page.keyboard.down('Shift');
    for (const d of [10, 20, 33]) await page.mouse.move(pts.cx + R * Math.cos(rad(d)), pts.cy + R * Math.sin(rad(d)), { steps: 3 });
    await page.mouse.up();
    await page.keyboard.up('Shift');
    const ang = await ev(() => __lai.canvas.getActiveObject().angle);
    assert(Math.round(ang) % 15 === 0 && ang > 0, 'shift-rotate angle ' + ang);
    await page.click('[data-act="undo"]');
    await wait(200);
  });
  await step('Delete ลบ และหน้าต่างปุ่มลัดเปิดได้', async () => {
    await selectIndex(2);
    await page.keyboard.press('Delete');
    assert((await objCount()) === 2, 'delete');
    await page.click('[data-act="file-menu"]');
    await page.click('.popover [data-m="shortcuts"]');
    await page.waitForSelector('.kbd-table');
    await page.keyboard.press('Escape');
  });

  // =============================================================== PAGES / VIEW
  group('11. หลายหน้า ซูม มุมมอง');
  await step('เพิ่ม ทำสำเนา เลื่อน ลบ และสลับหน้า', async () => {
    await page.click('[data-act="page-add"]');
    await wait(300);
    assert((await ev(() => [__lai.design.pages.length, __lai.cur])).join() === '2,1', 'add');
    await page.click('[data-act="page-dup"]');
    await wait(300);
    assert((await ev(() => __lai.design.pages.length)) === 3, 'dup');
    await page.click('[data-act="page-left"]');
    assert((await ev(() => __lai.cur)) === 1, 'move left');
    await page.click('[data-act="page-right"]');
    assert((await ev(() => __lai.cur)) === 2, 'move right');
    await page.click('.page-thumb[data-page="0"]');
    await wait(300);
    assert((await ev(() => [__lai.cur, __lai.canvas.getObjects().length])).join() === '0,2', 'goto page 1');
    await page.waitForFunction(() => document.querySelectorAll('.page-thumb img').length === 3, null, { timeout: 10000 });
  });
  await step('ซูมเข้า ออก พอดีจอ และ Ctrl+เลื่อนล้อเมาส์', async () => {
    const z0 = await ev(() => __lai.zoom);
    await page.click('[data-act="zoom-in"]');
    assert((await ev(() => __lai.zoom)) > z0, 'zoom in');
    await page.click('[data-act="zoom-out"]');
    await page.click('[data-act="zoom-out"]');
    assert((await ev(() => __lai.zoom)) < z0, 'zoom out');
    await page.click('[data-act="zoom-fit"]');
    assert(Math.abs((await ev(() => __lai.zoom)) - z0) < 0.01, 'fit');
    await page.mouse.move(700, 450);
    await page.keyboard.down('Control');
    await page.mouse.wheel(0, -100);
    await page.keyboard.up('Control');
    assert((await ev(() => __lai.zoom)) > z0, 'wheel zoom');
    await page.click('[data-act="zoom-fit"]');
  });
  await step('แสดง/ซ่อนระยะขอบปลอดภัย (ไม่ติดไปในไฟล์ส่งออก)', async () => {
    await page.click('[data-act="file-menu"]');
    await page.click('.popover [data-m="margins"]');
    assert(await ev(() => __lai.showMargins), 'margins on');
    await page.click('[data-act="file-menu"]');
    await page.click('.popover [data-m="margins"]');
    assert(await ev(() => !__lai.showMargins), 'margins off');
  });
  await step('โหมดนำเสนอ: เปิด เลื่อนสไลด์ ออก', async () => {
    await page.click('[data-act="present"]');
    await page.waitForSelector('.present img[src^="data:"]', { timeout: 20000 });
    assert((await page.textContent('.present [data-n]')).trim() === '1 / 3', 'start');
    await page.keyboard.press('ArrowRight');
    await page.waitForFunction(() => document.querySelector('.present [data-n]').textContent.trim() === '2 / 3');
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('Escape');
    await page.waitForSelector('.present', { state: 'detached' });
  });
  await step('[C7] ซ่อนหน้า: ไม่ถูกนำเสนอ/ดาวน์โหลด, เลิกทำได้', async () => {
    await page.click('.page-thumb[data-page="1"]');
    await wait(300);
    await page.click('[data-act="page-hide"]');
    assert(await page.$('.page-thumb[data-page="1"].is-hidden'), 'thumb not marked hidden');
    const b = await exportAs('png');
    const z = await JSZip.loadAsync(b);
    assert(Object.keys(z.files).length === 2, 'hidden page exported: ' + Object.keys(z.files));
    await page.click('[data-act="present"]');
    await page.waitForSelector('.present img[src^="data:"]', { timeout: 20000 });
    assert((await page.textContent('.present [data-n]')).trim().endsWith('/ 2'), 'present count');
    await page.keyboard.press('Escape');
    await page.waitForSelector('.present', { state: 'detached' });
    await page.click('[data-act="undo"]');
    await wait(300);
    assert(!(await ev(() => __lai.design.pages[1].hidden)), 'undo unhide');
    await page.click('[data-act="redo"]');
    await wait(300);
    assert(await ev(() => __lai.design.pages[1].hidden), 'redo hide');
    await page.click('.page-thumb[data-page="1"]');
    await wait(200);
    await page.click('[data-act="page-hide"]');
    assert(!(await ev(() => __lai.design.pages[1].hidden)), 'unhide');
  });
  await step('[C7] ชื่อหน้าและโน้ตผู้นำเสนอ บันทึกได้และติดไปกับการทำสำเนาหน้า', async () => {
    await page.click('[data-act="page-notes"]');
    await page.fill('.modal [data-title]', 'บทนำ');
    await page.fill('.modal [data-notes]', 'ทักทายผู้ฟัง');
    await page.click('.modal [data-go]');
    const p = await ev(() => __lai.design.pages[1]);
    assert(p.title === 'บทนำ' && p.notes === 'ทักทายผู้ฟัง', JSON.stringify(p).slice(0, 80));
    await page.click('[data-act="page-dup"]');
    await wait(400);
    assert((await ev(() => __lai.design.pages[2].notes)) === 'ทักทายผู้ฟัง', 'notes not duplicated');
    await page.click('[data-act="page-del"]');
    await wait(300);
    assert((await ev(() => __lai.design.pages.length)) === 3, 'pages');
  });
  await step('[C8] มุมมองผู้นำเสนอ: โน้ต ชื่อหน้า ตัวจับเวลา สไลด์ถัดไป และเล่นอัตโนมัติ', async () => {
    await page.click('.page-thumb[data-page="0"]');
    await wait(200);
    await ev(() => { __lai.autoplayMs = 800; });
    await page.click('[data-act="present"]');
    await page.waitForSelector('.present img[src^="data:"]', { timeout: 20000 });
    await page.keyboard.press('n');
    assert(await page.isVisible('.present-notes'), 'notes panel');
    await page.waitForFunction(() => document.querySelector('[data-next]').src.startsWith('data:'), null, { timeout: 15000 });
    await page.keyboard.press('ArrowRight');
    await page.waitForFunction(() => document.querySelector('[data-pnotes]').textContent === 'ทักทายผู้ฟัง');
    assert((await page.textContent('[data-ptitle]')).includes('บทนำ'), 'title');
    await page.waitForFunction(() => document.querySelector('[data-timer]').textContent !== '00:00', null, { timeout: 5000 });
    await page.click('[data-p="auto"]');
    await page.waitForFunction(() => document.querySelector('.present [data-n]').textContent.trim() === '3 / 3', null, { timeout: 8000 });
    await page.keyboard.press('Escape');
    await page.waitForSelector('.present', { state: 'detached' });
    await ev(() => { __lai.autoplayMs = 5000; });
  });
  await step('[C7] มุมมองทุกหน้าแบบกริด: ลากจัดลำดับ และคลิกไปหน้านั้น', async () => {
    const ids = await ev(() => __lai.design.pages.map((p) => p.id));
    await page.click('[data-act="page-grid"]');
    await page.waitForSelector('.pg-card');
    assert((await page.$$eval('.pg-card', (e) => e.length)) === 3, 'grid count');
    await page.dragAndDrop('.pg-card[data-i="0"]', '.pg-card[data-i="2"]');
    await wait(200);
    const ids2 = await ev(() => __lai.design.pages.map((p) => p.id));
    assert(ids2[2] === ids[0] && ids2[0] === ids[1], 'reorder failed');
    await page.click('.pg-card[data-i="1"] [data-go]');
    await wait(400);
    assert((await ev(() => __lai.cur)) === 1 && !(await page.$('.modal')), 'goto');
    await page.click('[data-act="undo"]');
    await wait(300);
    const ids3 = await ev(() => __lai.design.pages.map((p) => p.id));
    assert(ids3.join() === ids.join(), 'undo reorder');
    await page.click('.page-thumb[data-page="0"]');
    await wait(300);
  });
  await step('[C9] เลขหน้าอัตโนมัติ: เปลี่ยนตามการเพิ่ม/ย้าย/ลบหน้า, วางข้ามหน้า, และถูกต้องในไฟล์ส่งออก', async () => {
    await page.click('.page-thumb[data-page="0"]');
    await wait(200);
    await panel('text');
    await page.click('[data-act="pagenum:nN"]');
    await wait(300);
    const txt = () => ev(() => __lai.design.pages.map((p) => (JSON.parse(p.json).objects.find((o) => o.autoPage) || {}).text || '-').join('|'));
    assert((await txt()) === '1 / 3|-|-', await txt());
    await page.keyboard.press('Control+c');
    await page.click('.page-thumb[data-page="2"]');
    await wait(300);
    await page.keyboard.press('Control+v');
    await wait(300);
    assert((await txt()) === '1 / 3|-|3 / 3', 'paste: ' + (await txt()));
    await page.click('[data-act="page-left"]');
    await wait(300);
    assert((await txt()) === '1 / 3|2 / 3|-', 'move: ' + (await txt()));
    await page.click('[data-act="page-add"]');
    await wait(300);
    assert((await txt()) === '1 / 4|2 / 4|-|-', 'add: ' + (await txt()));
    await page.click('[data-act="page-del"]');
    await wait(300);
    assert((await txt()) === '1 / 3|2 / 3|-', 'delete: ' + (await txt()));
    const svg = (await exportAs('svg', { pages: '2' })).toString();
    assert(svg.includes('2 / 3'), 'export number');
    await page.click('[data-act="undo"]'); await wait(200);
    await page.click('[data-act="undo"]'); await wait(200);
    await page.click('[data-act="undo"]'); await wait(200);
    await page.click('[data-act="undo"]'); await wait(200);
    await page.click('[data-act="undo"]'); await wait(300);
    assert((await txt()) === '-|-|-', 'undo all: ' + (await txt()));
    await page.click('.page-thumb[data-page="0"]');
    await wait(300);
  });
  await step('[C9] เลิกทำไม่นับการเปลี่ยนหน้า และพาไปหน้าที่แก้ไข', async () => {
    await page.click('.page-thumb[data-page="0"]');
    await wait(200);
    const n0 = await objCount();
    await panel('elements');
    await page.click('[data-act="shape:0"]');
    await page.click('.page-thumb[data-page="2"]');
    await wait(200);
    await page.click('.page-thumb[data-page="1"]');
    await wait(200);
    await page.click('[data-act="undo"]');
    await wait(300);
    assert((await ev(() => __lai.cur)) === 0 && (await objCount()) === n0, `cur=${await ev(() => __lai.cur)} count=${await objCount()}`);
  });
  await step('[C10] ค้นหาและแทนที่ทุกหน้า (ข้อความ ตาราง กราฟ) และเลิกทำได้', async () => {
    await page.click('.page-thumb[data-page="0"]');
    await wait(200);
    await ev(async () => {
      const L = __lai;
      L.canvas.getObjects().forEach((o) => { if (o.type === 'textbox') o.set('text', 'แมวน้ำ แมว'); });
      L.commit();
      await L.addSmart('table');
      const t = L.canvas.getActiveObject();
      await L.rebuildSmart(t, { ...t.smart, rows: [['สัตว์', 'จำนวน'], ['แมว', '3']] });
    });
    await page.click('.page-thumb[data-page="2"]');
    await wait(200);
    await ev(async () => { const L = __lai; await L.addSmart('bar'); const c = L.canvas.getActiveObject(); await L.rebuildSmart(c, { ...c.smart, labels: ['แมว', 'หมา'], values: [3, 5] }); });
    await page.keyboard.press('Control+f');
    await page.fill('.modal [data-q]', 'แมว');
    const info = await page.textContent('.modal [data-info]');
    assert(/พบ 4 จุด ใน 2 หน้า/.test(info), info);
    await page.fill('.modal [data-r]', 'สุนัข');
    await page.click('.modal [data-all]');
    await page.waitForSelector('.toast.ok');
    assert((await page.textContent('.modal [data-info]')).includes('ไม่พบ'), 'still found after replace');
    await page.keyboard.press('Escape');
    const chart = await ev(() => __lai.canvas.getObjects().find((o) => o.smart?.type === 'chart').smart.labels.join());
    assert(chart === 'สุนัข,หมา', 'chart labels ' + chart);
    await page.click('.page-thumb[data-page="0"]');
    await wait(400);
    const r = await ev(() => { const os = __lai.canvas.getObjects(); const t = os.find((o) => o.smart?.type === 'table'); return { txt: os.find((o) => o.type === 'textbox')?.text, rows: t.smart.rows, dirty: !!t.smart._dirty, cell: t.getObjects().filter((x) => x.type === 'textbox').map((x) => x.text).join() }; });
    assert(r.txt === 'สุนัขน้ำ สุนัข' && r.rows[1][0] === 'สุนัข' && !r.dirty && r.cell.includes('สุนัข'), JSON.stringify(r));
    await page.click('[data-act="undo"]');
    await wait(400);
    assert((await ev(() => __lai.canvas.getObjects().find((o) => o.type === 'textbox')?.text)) === 'แมวน้ำ แมว', 'undo replace');
    await page.click('[data-act="redo"]');
    await wait(300);
    await ev(() => { const c = __lai.canvas; c.remove(...c.getObjects().filter((o) => o.smart)); __lai.commit(); });
    await page.click('.page-thumb[data-page="2"]');
    await wait(300);
    await ev(() => { const c = __lai.canvas; c.remove(...c.getObjects().filter((o) => o.smart)); __lai.commit(); });
    await page.click('.page-thumb[data-page="0"]');
    await wait(300);
  });
  await step('[C11] ประวัติเวอร์ชัน: บันทึก กู้คืน เลิกทำการกู้คืน และลบเวอร์ชัน', async () => {
    await page.click('.page-thumb[data-page="0"]');
    await wait(200);
    const n0 = await objCount();
    await page.click('[data-act="file-menu"]');
    await page.click('.popover [data-m="versions"]');
    await page.fill('.modal [data-label]', 'ก่อนเพิ่มรูปทรง');
    await page.click('.modal [data-save]');
    await page.waitForSelector('.modal [data-restore]');
    await page.keyboard.press('Escape');
    await panel('elements');
    await page.click('[data-act="shape:2"]');
    await page.click('[data-act="shape:3"]');
    assert((await objCount()) === n0 + 2, 'added');
    await page.click('[data-act="file-menu"]');
    await page.click('.popover [data-m="versions"]');
    await page.waitForSelector('.ver');
    const labels = await page.$$eval('.ver-info b', (e) => e.map((x) => x.textContent));
    const idx = labels.indexOf('ก่อนเพิ่มรูปทรง');
    assert(idx >= 0, labels.join());
    await page.click(`.ver >> nth=${idx} >> [data-restore]`);
    await page.waitForSelector('.modal', { state: 'detached' });
    await wait(400);
    assert((await objCount()) === n0, `restored count ${await objCount()}`);
    await page.click('[data-act="undo"]');
    await wait(400);
    assert((await objCount()) === n0 + 2, 'undo restore');
    await page.click('[data-act="file-menu"]');
    await page.click('.popover [data-m="versions"]');
    await page.waitForSelector('.ver');
    const l2 = await page.$$eval('.ver-info b', (e) => e.map((x) => x.textContent));
    assert(l2.includes('ก่อนกู้คืน'), 'auto version before restore: ' + l2);
    const c0 = l2.length;
    await page.click('.ver >> nth=0 >> [data-del]');
    await page.waitForFunction((c) => document.querySelectorAll('.ver').length === c - 1, c0);
    await page.keyboard.press('Escape');
    await page.click('[data-act="undo"]');
    await page.click('[data-act="undo"]');
    await wait(300);
  });
  await step('ปรับขนาดงาน: สำเร็จรูป และกำหนดเอง (ย่อ/ขยายเนื้อหา)', async () => {
    await ev(() => { const o = __lai.canvas.getObjects()[0]; o.set({ left: 540, top: 540, originX: 'center', originY: 'center' }); o.setCoords(); __lai.commit(); });
    await page.click('[data-act="resize"]');
    await page.click('.preset-row:has(input[value="5"])');
    await page.click('.modal [data-go]');
    await wait(800);
    let r = await ev(() => { const o = __lai.canvas.getObjects()[0].getCenterPoint(); return [__lai.W, __lai.H, Math.round(o.x), Math.round(o.y)]; });
    assert(r.join() === '1920,1080,960,540', `preset resize ${r}`);
    await page.click('[data-act="resize"]');
    await page.fill('.modal [data-w]', '1000');
    await page.fill('.modal [data-h]', '1000');
    await page.click('.modal [data-go]');
    await wait(800);
    r = await ev(() => [__lai.W, __lai.H, __lai.design.pages.length]);
    assert(r.join() === '1000,1000,3', `custom ${r}`);
  });
  await step('เปลี่ยนชื่องาน และบันทึกอัตโนมัติ (รีโหลดแล้วงานยังอยู่)', async () => {
    await page.fill('[data-name]', 'งานทดสอบระบบ');
    await page.press('[data-name]', 'Enter');
    await ev(() => __lai.saveNow());
    const before = await ev(() => [__lai.design.pages.length, __lai.canvas.getObjects().length]);
    await page.reload();
    await page.waitForSelector('.canvas-container');
    await wait(800);
    const after = await ev(() => [__lai.design.pages.length, __lai.canvas.getObjects().length, __lai.design.name]);
    assert(after[0] === before[0] && after[1] === before[1] && after[2] === 'งานทดสอบระบบ', `${before} vs ${after}`);
  });

  // =============================================================== EXPORT
  group('12. ดาวน์โหลด / ส่งออกไฟล์');
  await ev(() => __lai.resizeDesign(1080, 1080, null, true));
  await wait(500);
  await step('PNG หน้าเดียว 1× ขนาดถูกต้อง', async () => {
    const b = await exportAs('png', { pages: 'cur' });
    assert(isPNG(b) && pngSize(b).join() === '1080,1080', `png ${pngSize(b)}`);
  });
  await step('PNG 2× พื้นโปร่งใส (มีช่อง alpha)', async () => {
    await ev(() => { __lai.canvas.backgroundColor = '#ffffff'; __lai.commit(); });
    const b = await exportAs('png', { pages: 'cur', scale: 2, transparent: true });
    assert(isPNG(b) && pngSize(b).join() === '2160,2160' && b[25] === 6, `colorType=${b[25]} size=${pngSize(b)}`);
  });
  await step('PNG ทุกหน้า → ZIP มี 3 ไฟล์', async () => {
    const b = await exportAs('png');
    assert(isZIP(b), 'not zip');
    const z = await JSZip.loadAsync(b);
    assert(Object.keys(z.files).length === 3, Object.keys(z.files).join());
  });
  await step('JPG และ WEBP', async () => {
    assert(isJPG(await exportAs('jpg', { pages: 'cur' })), 'jpg');
    assert(isWEBP(await exportAs('webp', { pages: 'cur' })), 'webp');
  });
  await step('SVG (เวกเตอร์) มีฟอนต์ฝังลิงก์', async () => {
    await page.click('.page-thumb[data-page="0"]');
    await panel('text');
    await page.click('.text-add[data-act="text:heading"]');
    await wait(400);
    const b = (await exportAs('svg', { pages: 'cur' })).toString();
    assert(b.includes('<svg') && b.includes('<text') && b.includes('fonts.googleapis.com'), 'svg content');
  });
  await step('[C6] ใส่ลิงก์ให้วัตถุ → คลิกได้ในไฟล์ PDF (ปกติและโรงพิมพ์) และโหมดนำเสนอ แล้วลบลิงก์ได้', async () => {
    await selectIndex(-1);
    await page.click('[data-act="pop:link"]');
    await page.fill('.popover [data-url]', 'example.com/ทดสอบ');
    await page.press('.popover [data-url]', 'Enter');
    assert((await ev(() => __lai.canvas.getObjects().at(-1).link)) === 'https://example.com/' + encodeURIComponent('ทดสอบ'), 'link set');
    let b = await exportAs('pdf', { pages: 'cur' });
    assert(/\/URI\s*\(https:\/\/example\.com/.test(b.toString('latin1')), 'no link annotation in PDF');
    b = await exportAs('pdf', { pages: 'cur', print: true });
    assert(/\/URI\s*\(https:\/\/example\.com/.test(b.toString('latin1')), 'no link annotation in print PDF');
    await page.click('[data-act="present"]');
    await page.waitForSelector('.present .present-link', { timeout: 20000 });
    assert((await page.getAttribute('.present .present-link', 'href')).startsWith('https://example.com'), 'present link');
    await page.keyboard.press('Escape');
    await page.waitForSelector('.present', { state: 'detached' });
    await selectIndex(-1);
    await page.click('[data-act="pop:link"]');
    await page.click('.popover [data-remove]');
    assert(!(await ev(() => __lai.canvas.getObjects().at(-1).link)), 'link removed');
  });
  await step('PDF หลายหน้า (เลือกหน้า 1,3)', async () => {
    const b = await exportAs('pdf', { pages: '1,3' });
    assert(b.slice(0, 4).toString() === '%PDF' && pdfPages(b) === 2, `pages=${pdfPages(b)}`);
  });
  await step('PDF สำหรับโรงพิมพ์ (ระยะตัดตก + เครื่องหมายตัด) ขนาดกระดาษใหญ่ขึ้น', async () => {
    const b = await exportAs('pdf', { pages: 'cur', print: true });
    const s = b.toString('latin1');
    const box = s.match(/\/MediaBox \[([\d. ]+)\]/)[1].split(' ').map(Number);
    // 1080px @96dpi = 285.75mm; + 2*(3+8)mm = 307.75mm = 872.4pt
    assert(b.slice(0, 4).toString() === '%PDF' && Math.abs(box[2] - 872.4) < 2, `mediabox ${box}`);
  });
  await step('PowerPoint (.pptx) 3 สไลด์', async () => {
    const b = await exportAs('pptx');
    const z = await JSZip.loadAsync(b);
    const slides = Object.keys(z.files).filter((f) => /^ppt\/slides\/slide\d+\.xml$/.test(f));
    assert(slides.length === 3, slides.join());
  });
  await step('ไฟล์โปรเจกต์ .json แล้วนำเข้ากลับได้ครบ', async () => {
    const b = await exportAs('json');
    const j = JSON.parse(b.toString());
    assert(j.app === 'lai-studio' && j.design.pages.length === 3, 'json');
    const file = path.join(OUT, 'project.lai.json');
    fs.writeFileSync(file, b);
    await page.click('[data-act="home"]');
    await page.waitForSelector('[data-file]', { state: 'attached' });
    await page.setInputFiles('.home [data-file]', file);
    await page.waitForSelector('.canvas-container');
    await wait(500);
    assert((await ev(() => __lai.design.pages.length)) === 3, 'imported pages');
  });
  await step('พิมพ์: สร้างเอกสารสำหรับพิมพ์ครบทุกหน้า', async () => {
    await page.click('[data-act="print"]');
    await page.waitForFunction(() => { const f = [...document.querySelectorAll('iframe')].pop(); return f && f.contentDocument && f.contentDocument.querySelectorAll('img').length === 3; }, null, { timeout: 20000 });
  });

  // =============================================================== HOME MGMT
  group('13. จัดการงานในหน้าแรก');
  await step('ค้นหางาน ทำสำเนา เปลี่ยนชื่อ ลบ', async () => {
    await page.click('[data-act="home"]');
    await page.waitForSelector('.design-card');
    const n0 = await page.$$eval('.design-card', (e) => e.length);
    await page.fill('[data-search]', 'งานทดสอบระบบ');
    const vis = await page.$$eval('.design-card', (e) => e.filter((x) => !x.hidden).length);
    assert(vis >= 1 && vis < n0, `search ${vis}/${n0}`);
    await page.fill('[data-search]', '');
    await page.click('.design-card [data-menu] >> nth=0');
    await page.click('.popover [data-m="dup"]');
    await page.waitForFunction((n) => document.querySelectorAll('.design-card').length === n + 1, n0);
    await page.click('.design-card [data-menu] >> nth=0');
    await page.click('.popover [data-m="rename"]');
    await page.fill('.modal [data-v]', 'ชื่อใหม่');
    await page.click('.modal [data-yes]');
    await page.waitForSelector('.design-card b[title="ชื่อใหม่"]');
    await page.click('.design-card [data-menu] >> nth=0');
    await page.click('.popover [data-m="del"]');
    await page.click('.modal [data-yes]');
    await page.waitForFunction((n) => document.querySelectorAll('.design-card').length === n, n0);
  });
  await step('[C14] ติดดาวงาน และกรองเฉพาะงานติดดาว (คงอยู่หลังแก้ไขงาน)', async () => {
    const total = await page.$$eval('.design-card', (e) => e.length);
    const id = await page.$eval('.design-card [data-star]', (b) => b.dataset.star);
    await page.click(`[data-star="${id}"]`);
    await page.waitForSelector(`[data-star="${id}"].on`);
    await page.click('[data-filter="star"]');
    await page.waitForFunction(() => document.querySelector('[data-filter="star"]')?.classList.contains('on') && [...document.querySelectorAll('.design-card')].filter((x) => !x.hidden).length === 1, null, { timeout: 5000 });
    await page.click(`[data-open="${id}"]`);
    await page.waitForSelector('.canvas-container');
    await page.keyboard.press('r');
    await ev(() => __lai.saveNow());
    await page.click('[data-act="home"]');
    await page.waitForSelector('.design-card');
    assert(await page.$(`[data-star="${id}"].on`), 'star lost after editing');
    await page.click('[data-filter="all"]');
    await page.waitForFunction((t) => [...document.querySelectorAll('.design-card')].filter((x) => !x.hidden).length === t, total, { timeout: 5000 });
    await page.click(`[data-star="${id}"]`);
    await page.waitForSelector(`[data-star="${id}"]:not(.on)`);
  });
  await step('นำเข้าไฟล์ที่ไม่ใช่โปรเจกต์ต้องแจ้งเตือน', async () => {
    const bad = path.join(OUT, 'bad.json');
    fs.writeFileSync(bad, '{"hello":1}');
    await page.setInputFiles('.home [data-file]', bad);
    await page.waitForSelector('.toast.error');
  });

  // =============================================================== MOBILE & DARK
  group('14. มือถือ และโหมดมืด');
  await step('มือถือ: ไม่มีการเลื่อนด้านข้าง เปิดแผงและเพิ่มองค์ประกอบได้', async () => {
    const m = await browser.newContext({ ...devices['iPhone 13'], ignoreHTTPSErrors: true });
    const mp = await m.newPage();
    mp.on('pageerror', (e) => pageErrors.push('mobile: ' + e.message));
    await mp.goto(URL);
    await mp.waitForSelector('.preset');
    assert((await mp.evaluate(() => document.documentElement.scrollWidth)) <= 390, 'home overflow');
    await mp.click('.preset[data-preset="1"]');
    await mp.waitForSelector('.canvas-container');
    await mp.click('.rail-btn[data-panel="elements"]');
    await mp.click('[data-act="shape:2"]');
    await mp.waitForTimeout(300);
    assert((await mp.evaluate(() => __lai.canvas.getObjects().length)) === 1, 'mobile add');
    assert((await mp.evaluate(() => document.documentElement.scrollWidth)) <= 390, 'editor overflow');
    await mp.screenshot({ path: path.join(OUT, 'mobile.png') });
    await m.close();
  });
  await step('โหมดมืด: เปิดหน้าแรกและตัวแก้ไขได้ พื้นหลังเป็นสีมืด', async () => {
    const d = await browser.newContext({ colorScheme: 'dark', viewport: { width: 1280, height: 800 }, ignoreHTTPSErrors: true });
    const dp = await d.newPage();
    dp.on('pageerror', (e) => pageErrors.push('dark: ' + e.message));
    await dp.goto(URL);
    await dp.waitForSelector('.preset');
    const bg = await dp.evaluate(() => getComputedStyle(document.body).backgroundColor);
    assert(bg === 'rgb(20, 21, 27)', bg);
    await d.close();
  });

  await step('[A1] ฟอนต์โหลดช้า: ตารางจัดเรียงใหม่อัตโนมัติเมื่อฟอนต์มาถึง และไม่เพิ่มขั้นเลิกทำ', async () => {
    const c2 = await browser.newContext({ viewport: { width: 1280, height: 800 }, ignoreHTTPSErrors: true });
    const p2 = await c2.newPage();
    p2.on('pageerror', (e) => pageErrors.push('slowfont: ' + e.message));
    await p2.goto(URL);
    await p2.waitForSelector('.preset');
    await p2.click('.preset[data-preset="0"]');
    await p2.waitForSelector('.canvas-container');
    await p2.evaluate(async () => {
      const L = __lai; await L.addSmart('table'); const t = L.canvas.getActiveObject();
      await L.rebuildSmart(t, { ...t.smart, fontFamily: 'Taviraj', rows: [['ทดสอบฟอนต์ที่โหลดช้า', 'ข้อมูล'], ['ก', 'ข']] });
      await L.saveNow();
    });
    // reload with the font stylesheet delayed by 4 s
    const cdp = await c2.newCDPSession(p2);
    await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
    await p2.route(/family=Taviraj/, async (route) => { await new Promise((r) => setTimeout(r, 4000)); route.continue().catch(() => {}); });
    await p2.reload();
    await p2.waitForFunction(() => window.__lai && __lai.canvas.getObjects().length === 1, null, { timeout: 15000 });
    const before = await p2.evaluate(() => { window.__t0 = __lai.canvas.getObjects()[0]; return { h: __lai.history.length, fontOk: [...document.fonts].some((f) => f.family.includes('Taviraj') && f.status === 'loaded') }; });
    assert(!before.fontOk, 'font should still be loading');
    await p2.waitForFunction(() => __lai.canvas.getObjects()[0] !== window.__t0, null, { timeout: 15000 });
    const after = await p2.evaluate(() => ({ h: __lai.history.length, dirty: __lai.canvas.getObjects().some((o) => o.smart?._dirty), font: __lai.canvas.getObjects()[0].smart.fontFamily }));
    assert(after.h === before.h && !after.dirty && after.font === 'Taviraj', JSON.stringify({ before, after }));
    await c2.close();
  });
  group('15. ความเสถียร');
  await step('ไม่มี JavaScript error ตลอดการทดสอบ', async () => {
    assert(pageErrors.length === 0, pageErrors.slice(0, 3).join(' | '));
  });

  // =============================================================== REPORT
  await browser.close();
  server.kill();
  const pass = results.filter((r) => r.ok).length;
  const fail = results.length - pass;
  const sections = [...new Set(results.map((r) => r.section))];
  let md = `# รายงานผลการทดสอบ Lai Studio\n\nวันที่: ${new Date().toISOString()}\n\n**ผ่าน ${pass} / ${results.length}**${fail ? ` · ไม่ผ่าน ${fail}` : ''}\n\n`;
  for (const s of sections) {
    md += `## ${s}\n\n| ผล | รายการทดสอบ | เวลา |\n|---|---|---|\n`;
    for (const r of results.filter((x) => x.section === s)) md += `| ${r.ok ? '✅' : '❌'} | ${r.name}${r.ok ? '' : `<br><small>${r.error}</small>`} | ${r.ms} ms |\n`;
    md += '\n';
  }
  fs.writeFileSync(path.join(OUT, 'REPORT.md'), md);
  console.log(`\n${pass}/${results.length} passed${fail ? `, ${fail} failed` : ''}. Report: tests/report/REPORT.md`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
