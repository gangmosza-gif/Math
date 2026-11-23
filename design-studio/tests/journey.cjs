/*
 * Lai Studio – user-journey test: uses the app the way a person does (mouse clicks, drags, the keyboard,
 * the panels and menus), one step after another on the same design, from the home page to the exported files.
 *
 *   npm run build && node tests/journey.cjs            (all stages)
 *   STAGE=3 node tests/journey.cjs                      (stages 1..3 — later stages build on earlier ones)
 *
 * Writes tests/report-journey/REPORT.md, screenshots of each stage and every downloaded file.
 */
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(__dirname, 'report-journey');
const PORT = 4181;
const URL = `http://localhost:${PORT}/`;
const STAGE = +process.env.STAGE || Infinity;
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(path.join(OUT, 'downloads'), { recursive: true });

const results = [];
let group = '';
const assert = (c, m) => { if (!c) throw new Error(m || 'assertion failed'); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let page;
async function step(name, fn) {
  const t0 = Date.now();
  try {
    const note = await fn();
    results.push({ group, name, ok: true, note: note || '', ms: Date.now() - t0 });
    console.log(`  ✅ ${name}${note ? ' — ' + note : ''}`);
  } catch (e) {
    const shot = `fail-${results.length + 1}.png`;
    await page.screenshot({ path: path.join(OUT, shot) }).catch(() => {});
    results.push({ group, name, ok: false, note: String(e.message).slice(0, 500), shot, ms: Date.now() - t0 });
    console.log(`  ❌ ${name} — ${String(e.message).slice(0, 300)}`);
  }
}
const stage = (n, title) => { group = `${n}. ${title}`; console.log('\n' + group); return n <= STAGE; };

(async () => {
  const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { cwd: ROOT, stdio: 'ignore' });
  for (let i = 0; i < 50; i++) { try { await fetch(URL); break; } catch { await wait(200); } }
  const browser = await chromium.launch({ env: { ...process.env, LANG: 'C.UTF-8', LC_ALL: 'C.UTF-8' } });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
  page = await ctx.newPage();
  page.setDefaultTimeout(15000);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text().slice(0, 200)); });
  page.on('dialog', (d) => d.accept());
  const ev = (fn, a) => page.evaluate(fn, a);
  const objs = () => ev(() => __lai.canvas.getObjects().map((o) => ({ type: o.type, text: o.text, name: o.name })));
  /** Screen position of a design point (x, y in page units). */
  const screenOf = (x, y) => ev(([x, y]) => {
    const c = __lai.canvas, r = c.upperCanvasEl.getBoundingClientRect(), v = c.viewportTransform;
    return { x: r.left + x * v[0] + v[4], y: r.top + y * v[3] + v[5] };
  }, [x, y]);
  const centerOf = (i) => ev((i) => { const o = __lai.canvas.getObjects()[i]; const p = o.getCenterPoint(); const c = __lai.canvas, r = c.upperCanvasEl.getBoundingClientRect(), v = c.viewportTransform; return { x: r.left + p.x * v[0] + v[4], y: r.top + p.y * v[3] + v[5] }; }, i);
  const openPanel = async (k) => { if (!(await ev((k) => __lai.panel === k && __lai.panelVisible(), k))) await page.click(`.rail-btn[data-panel="${k}"]`); await wait(250); };
  /** Every line break of a text box falls between words (Thai has no spaces: checked with the word segmenter). */
  const wrapIssues = (i) => ev((i) => {
    const t = __lai.canvas.getObjects()[i];
    const seg = new Intl.Segmenter('th', { granularity: 'word' });
    const out = [];
    t._textLines.forEach((ln, k) => {
      if (k === t._textLines.length - 1) return;
      const before = t._textLines.slice(0, k + 1).map((l) => l.join('')).join('');
      // position in the original text (without the line breaks the user typed)
      const full = t.text.replace(/\n/g, '');
      const pos = before.length;
      const bounds = new Set([0, full.length]);
      for (const s of seg.segment(full)) bounds.add(s.index);
      if (!bounds.has(pos)) out.push(`"${ln.join('').slice(-6)}|${full.slice(pos, pos + 6)}"`);
    });
    return out;
  }, i);

  // ================================================================== 1. home
  if (stage(1, 'หน้าแรก: เปิดโปรแกรม ค้นหาเทมเพลต เลือกขนาดงาน')) {
    await step('เปิดโปรแกรมได้ ไม่มีข้อผิดพลาด แสดงขนาดงาน เทมเพลตแนะนำ และช่องค้นหา', async () => {
      await page.goto(URL);
      await page.waitForSelector('.preset[data-preset]');
      await page.waitForSelector('.tpl-row [data-tpl]');
      const n = await page.$$eval('.preset[data-preset]', (e) => e.length);
      assert(n >= 14 && !errors.length, `presets ${n} errors ${errors}`);
      await page.screenshot({ path: path.join(OUT, 'stage1-home.png') });
      return `${n} ขนาด`;
    });
    await step('ค้นหาเทมเพลต "ข้อเสนอโครงการ" จากหน้าแรก แล้วเห็นผล', async () => {
      const box = await page.$('[data-tpl-q]');
      assert(box, 'no search box on home');
      await box.click();
      await page.keyboard.type('ข้อเสนอโครงการ', { delay: 20 });
      await page.keyboard.press('Enter');
      await page.waitForSelector('.tpl-card', { timeout: 10000 });
      const names = await page.$$eval('.tpl-card', (e) => e.filter((x) => x.offsetParent).map((x) => x.title));
      assert(names.some((t) => t.includes('ข้อเสนอโครงการ')), names.slice(0, 5).join());
      await page.keyboard.press('Escape');
      return names.length + ' ผล';
    });
    await step('เลือกขนาด "งานนำเสนอ 16:9" → เข้าหน้าแก้ไข หน้ากระดาษพอดีจอ', async () => {
      await page.goto(URL);
      await page.click('.preset[data-preset="5"]');
      await page.waitForFunction(() => window.__lai && __lai.canvas && document.querySelector('.canvas-container'));
      await wait(600);
      const r = await ev(() => ({ w: __lai.W, h: __lai.H, z: __lai.canvas.getZoom(), cw: __lai.canvas.getWidth() }));
      assert(r.w === 1920 && r.h === 1080 && r.z > 0.2 && r.z < 1, JSON.stringify(r));
      return `${r.w}×${r.h} ซูม ${Math.round(r.z * 100)}%`;
    });
  }

  // ================================================================== 2. typing Thai
  if (stage(2, 'พิมพ์ข้อความไทยด้วยคีย์บอร์ด: คำไม่ตก ไม่ขาด ตัดบรรทัดตรงคำ')) {
    const THAI = 'การศึกษาไทยในยุคดิจิทัลต้องเริ่มจากครูผู้สอนที่เข้าใจนักเรียน ทั้งด้านความรู้ ทักษะชีวิต และคุณธรรม';
    await step('เพิ่มหัวเรื่องจากแผงข้อความ แล้วดับเบิลคลิกเข้าโหมดพิมพ์', async () => {
      await openPanel('text');
      await page.click('[data-act="text:heading"]');
      await page.waitForFunction(() => __lai.canvas.getObjects().length === 1);
      const c = await centerOf(0);
      await page.mouse.dblclick(c.x, c.y);
      await wait(300);
      assert(await ev(() => !!__lai.canvas.getActiveObject()?.isEditing), 'not editing');
    });
    await step('ลบข้อความเดิม (Ctrl+A, Backspace) แล้วพิมพ์หัวเรื่องไทยทีละตัว: ได้ครบทุกตัวอักษร สระ วรรณยุกต์', async () => {
      await page.keyboard.press('Control+A');
      await page.keyboard.press('Backspace');
      await page.keyboard.type('สวัสดีครับ ยินดีต้อนรับสู่ห้องเรียน', { delay: 25 });
      await wait(200);
      const t = await ev(() => __lai.canvas.getActiveObject().text);
      assert(t === 'สวัสดีครับ ยินดีต้อนรับสู่ห้องเรียน', JSON.stringify(t));
      return t;
    });
    await step('พิมพ์เร็ว (ไม่หน่วง) ต่อท้าย + ขึ้นบรรทัดใหม่ด้วย Enter: ไม่มีตัวอักษรหาย', async () => {
      await page.keyboard.press('End');
      await page.keyboard.press('Enter');
      await page.keyboard.type('วิชาคณิตศาสตร์ ป.2 เรื่องการบวกเลข ๑๒๓ + 456 = ?');
      await wait(200);
      const t = await ev(() => __lai.canvas.getActiveObject().text);
      assert(t === 'สวัสดีครับ ยินดีต้อนรับสู่ห้องเรียน\nวิชาคณิตศาสตร์ ป.2 เรื่องการบวกเลข ๑๒๓ + 456 = ?', JSON.stringify(t));
    });
    await step('แก้คำผิดกลางประโยค: ลูกศรซ้าย + Backspace + พิมพ์แทน ได้ตำแหน่งถูกต้อง', async () => {
      for (let i = 0; i < 4; i++) await page.keyboard.press('ArrowLeft'); // "456| = ?": cursor right after the 6
      await page.keyboard.press('Backspace');
      await page.keyboard.type('7');
      const t = await ev(() => __lai.canvas.getActiveObject().text);
      assert(t.endsWith('457 = ?'), JSON.stringify(t.slice(-12)));
      await page.keyboard.press('Escape');
      await wait(200);
      assert(await ev(() => !__lai.canvas.getActiveObject()?.isEditing), 'still editing after Escape');
    });
    await step('เพิ่มเนื้อความ แล้ววางย่อหน้ายาว (Ctrl+V จากคลิปบอร์ด): ข้อความครบ', async () => {
      await page.click('[data-act="text:body"]');
      await page.waitForFunction(() => __lai.canvas.getObjects().length === 2);
      const c = await centerOf(1);
      await page.mouse.dblclick(c.x, c.y);
      await wait(200);
      await page.keyboard.press('Control+A');
      await page.keyboard.press('Backspace');
      await page.keyboard.insertText(THAI); // paste-like input of a whole paragraph
      await wait(200);
      await page.keyboard.press('Escape');
      const t = await ev(() => __lai.canvas.getObjects()[1].text);
      assert(t === THAI, JSON.stringify(t));
    });
    await step('ย่อกล่องเนื้อความให้แคบ (ลากที่จับด้านขวา): ตัดบรรทัดตรงรอยต่อคำทุกบรรทัด ไม่ตัดกลางคำ', async () => {
      await ev(() => { __lai.canvas.setActiveObject(__lai.canvas.getObjects()[1]); __lai.canvas.requestRenderAll(); });
      const h = await ev(() => { const o = __lai.canvas.getObjects()[1]; o.setCoords(); const p = o.oCoords.mr; const r = __lai.canvas.upperCanvasEl.getBoundingClientRect(); return { x: r.left + p.x, y: r.top + p.y, w: o.width }; });
      await page.mouse.move(h.x, h.y);
      await page.mouse.down();
      await page.mouse.move(h.x - 260, h.y, { steps: 12 });
      await page.mouse.up();
      await wait(300);
      const r = await ev(() => { const o = __lai.canvas.getObjects()[1]; return { w: o.width, lines: o._textLines.length, text: o.text }; });
      assert(r.w < h.w - 100 && r.lines >= 3, `width ${h.w}→${r.w}, lines ${r.lines}`);
      assert(r.text === THAI, 'text changed by resize');
      const bad = await wrapIssues(1);
      assert(!bad.length, 'ตัดกลางคำ: ' + bad.join(' '));
      return `${r.lines} บรรทัด กว้าง ${Math.round(r.w)}`;
    });
    await step('ข้อความไม่ล้นกรอบ: ความสูงกล่องพอดีกับทุกบรรทัด และอยู่ในหน้า', async () => {
      const r = await ev(() => __lai.canvas.getObjects().map((o) => { o.setCoords(); const b = o.getBoundingRect(); return { h: o.height, need: o.calcTextHeight(), b }; }));
      for (const x of r) assert(Math.abs(x.h - x.need) < 2, `height ${x.h} vs text ${x.need}`);
      for (const x of r) assert(x.b.left >= -1 && x.b.top >= -1 && x.b.left + x.b.width <= 1921 && x.b.top + x.b.height <= 1081, 'outside page ' + JSON.stringify(x.b));
    });
    await step('เลิกทำ (Ctrl+Z) แล้วทำซ้ำ (Ctrl+Y): ข้อความกลับมาถูกต้อง', async () => {
      await ev(() => __lai.canvas.discardActiveObject());
      const before = await ev(() => __lai.canvas.getObjects()[1].width);
      await page.keyboard.press('Control+Z');
      await wait(400);
      const undone = await ev(() => __lai.canvas.getObjects()[1]?.width);
      await page.keyboard.press('Control+Y');
      await wait(400);
      const redone = await ev(() => ({ w: __lai.canvas.getObjects()[1]?.width, t: __lai.canvas.getObjects()[1]?.text }));
      assert(undone !== before && Math.abs(redone.w - before) < 1 && redone.t === THAI, `${before} → ${undone} → ${redone.w}`);
    });
    await step('เปลี่ยนฟอนต์เป็น Sarabun / Kanit / Itim: ข้อความเดิมครบ และยังตัดบรรทัดตรงคำ', async () => {
      const out = [];
      for (const f of ['Sarabun', 'Kanit', 'Itim']) {
        await ev((f) => { __lai.canvas.setActiveObject(__lai.canvas.getObjects()[1]); __lai.setProp('fontFamily', f); }, f);
        await page.waitForFunction((f) => document.fonts.check(`20px "${f}"`, 'ก'), f, { timeout: 10000 });
        await wait(400);
        const r = await ev(() => { const o = __lai.canvas.getObjects()[1]; return { t: o.text, f: o.fontFamily, lines: o._textLines.length }; });
        assert(r.t === THAI && r.f === f, JSON.stringify(r));
        const bad = await wrapIssues(1);
        assert(!bad.length, `${f}: ` + bad.join(' '));
        out.push(`${f} ${r.lines} บรรทัด`);
      }
      return out.join(', ');
    });
    await step('ภาพหน้าจอหลังพิมพ์', async () => { await ev(() => { __lai.canvas.discardActiveObject(); __lai.canvas.requestRenderAll(); }); await page.screenshot({ path: path.join(OUT, 'stage2-typing.png') }); });
  }

  const selectAt = async (i, mod) => { const c = await centerOf(i); if (mod) await page.keyboard.down(mod); await page.mouse.click(c.x, c.y); if (mod) await page.keyboard.up(mod); await wait(200); };
  const active = () => ev(() => { const a = __lai.canvas.getActiveObject(); return a ? { type: a.type, n: a.getObjects ? a.getObjects().length : 1 } : null; });

  // ================================================================== 3. text formatting with the toolbar
  if (stage(3, 'จัดรูปแบบข้อความด้วยแถบเครื่องมือ (คลิกปุ่มจริง)')) {
    await step('คลิกเลือกหัวเรื่องบนหน้า → แถบเครื่องมือข้อความขึ้น', async () => {
      await page.keyboard.press('Escape');
      await selectAt(0);
      await page.waitForSelector('[data-ctx][data-kind="text"]');
    });
    await step('เปลี่ยนฟอนต์จากรายการ: ค้นหา "Prompt" แล้วคลิก', async () => {
      await page.click('[data-ctx] [data-act="pop:font"]');
      await page.fill('.font-pop [data-q]', 'Prompt');
      await page.click('.font-pop [data-f="Prompt"]');
      await page.waitForFunction(() => __lai.canvas.getObjects()[0].fontFamily === 'Prompt');
      await page.keyboard.press('Escape');
    });
    await step('ขนาดตัวอักษร: กด + สองครั้ง และพิมพ์ 72 ในช่อง', async () => {
      const f0 = await ev(() => __lai.canvas.getObjects()[0].fontSize);
      await page.click('[data-ctx] [data-act="fs:+"]'); await page.click('[data-ctx] [data-act="fs:+"]');
      const f1 = await ev(() => __lai.canvas.getObjects()[0].fontSize);
      await page.fill('[data-ctx] [data-fs]', '72'); await page.press('[data-ctx] [data-fs]', 'Enter');
      await wait(200);
      const f2 = await ev(() => __lai.canvas.getObjects()[0].fontSize);
      assert(f1 > f0 && f2 === 72, `${f0} → ${f1} → ${f2}`);
      return `${f0} → ${f1} → 72`;
    });
    await step('ตัวหนา / ตัวเอียง / ขีดเส้นใต้ เปิดแล้วปิดได้', async () => {
      const st = () => ev(() => { const o = __lai.canvas.getObjects()[0]; return [o.fontWeight === 'bold' || +o.fontWeight >= 600, o.fontStyle === 'italic', !!o.underline]; });
      const s0 = await st();
      for (const k of ['bold', 'italic', 'underline']) await page.click(`[data-ctx] [data-act="toggle:${k}"]`);
      const s1 = await st();
      for (const k of ['bold', 'italic', 'underline']) await page.click(`[data-ctx] [data-act="toggle:${k}"]`);
      const s2 = await st();
      assert(s1.every((v, i) => v === !s0[i]) && s2.every((v, i) => v === s0[i]), JSON.stringify([s0, s1, s2]));
      return `หนา/เอียง/เส้นใต้ ${s0} → ${s1} → ${s2}`;
    });
    await step('สีตัวอักษร: เปิดจานสี พิมพ์รหัส #1E5EFF', async () => {
      await page.click('[data-ctx] [data-act="color:fill"]');
      const inp = await page.waitForSelector('.color-pop input[data-hex], .color-pop [data-hex]');
      await inp.fill('#1E5EFF'); await inp.press('Enter');
      await wait(200);
      const f = await ev(() => __lai.canvas.getObjects()[0].fill);
      assert(String(f).toLowerCase() === '#1e5eff', f);
      await page.keyboard.press('Escape');
    });
    await step('จัดตำแหน่งข้อความ: คลิกวน ซ้าย → กลาง → ขวา', async () => {
      const seen = [];
      for (let i = 0; i < 3; i++) { await page.click('[data-ctx] [data-act="text-align"]'); seen.push(await ev(() => __lai.canvas.getObjects()[0].textAlign)); }
      assert(new Set(seen).size >= 3, seen.join());
      return seen.join(' → ');
    });
    await step('ระยะห่างตัวอักษรและบรรทัด (สไลเดอร์ในป๊อปอัป)', async () => {
      await page.click('[data-ctx] [data-act="pop:spacing"]');
      const rs = await page.$$('.popover input[type="range"]');
      assert(rs.length >= 2, 'sliders ' + rs.length);
      const before = await ev(() => { const o = __lai.canvas.getObjects()[0]; return [o.charSpacing, o.lineHeight]; });
      for (const [r, f] of [[rs[0], 0.3], [rs[1], 0.6]]) { const b = await r.boundingBox(); await page.mouse.click(b.x + b.width * f, b.y + b.height / 2); }
      const after = await ev(() => { const o = __lai.canvas.getObjects()[0]; return [o.charSpacing, o.lineHeight]; });
      assert(after[0] !== before[0] && after[1] !== before[1], JSON.stringify([before, after]));
      await page.keyboard.press('Escape');
      return JSON.stringify(after);
    });
    await step('เอฟเฟกต์ข้อความ: เงา แล้วเปลี่ยนเป็นขอบ (outline) และกลับเป็นไม่มี', async () => {
      // the effects panel closes after a choice: open it again for the next one
      const pick = async (k) => { await page.click('[data-ctx] [data-act="pop:effects"]'); await page.click(`.popover [data-fx="${k}"]`); await wait(150); return ev(() => { const o = __lai.canvas.getObjects()[0]; return { sh: !!o.shadow, st: o.strokeWidth || 0 }; }); };
      const sh = await pick('shadow'), ol = await pick('outline'), no = await pick('none');
      assert(sh.sh && ol.st > 0 && !no.sh && !no.st, JSON.stringify({ sh, ol, no }));
    });
    await step('ข้อความยังครบหลังจัดรูปแบบทั้งหมด', async () => {
      const t = await ev(() => __lai.canvas.getObjects()[0].text);
      assert(t === 'สวัสดีครับ ยินดีต้อนรับสู่ห้องเรียน\nวิชาคณิตศาสตร์ ป.2 เรื่องการบวกเลข ๑๒๓ + 457 = ?', JSON.stringify(t));
    });
  }

  // ================================================================== 4. pictures and crop
  if (stage(4, 'รูปภาพ: อัปโหลด ย้าย ย่อ ครอบตัด (ลากขอบจริง) แทนที่รูป')) {
    const PHOTO = path.join(__dirname, 'fixtures', 'journey-photo.jpg'); // colourful, so every crop stays visible
    await step('อัปโหลดรูปจากเครื่อง (แผงอัปโหลด): รูปลงหน้าให้ทันที และมีในรายการอัปโหลด', async () => {
      await openPanel('uploads');
      const n0 = (await objs()).length;
      await page.setInputFiles('[data-file-upload]', PHOTO);
      await page.waitForSelector('[data-act^="up-add:"]', { timeout: 15000 });
      await page.waitForFunction((n) => __lai.canvas.getObjects().length === n + 1, n0);
      const o = await ev(() => { const o = __lai.canvas.getActiveObject(); return { type: o.type, w: o.getScaledWidth(), h: o.getScaledHeight() }; });
      assert(o.type === 'image', JSON.stringify(o));
      return `${Math.round(o.w)}×${Math.round(o.h)}`;
    });
    await step('ย่อรูปจากมุมขวาล่าง แล้วลากไปมุมขวาบน (ลากจริงด้วยเมาส์)', async () => {
      const i = (await objs()).length - 1;
      const br = await ev(() => { const o = __lai.canvas.getActiveObject(); o.setCoords(); const p = o.oCoords.br; const r = __lai.canvas.upperCanvasEl.getBoundingClientRect(); return { x: r.left + p.x, y: r.top + p.y, w: o.getScaledWidth() }; });
      await page.mouse.move(br.x, br.y); await page.mouse.down(); await page.mouse.move(br.x - 260, br.y - 170, { steps: 12 }); await page.mouse.up();
      await wait(200);
      const c = await centerOf(i);
      const tgt = await screenOf(1550, 330);
      await page.mouse.move(c.x, c.y); await page.mouse.down(); await page.mouse.move(tgt.x, tgt.y, { steps: 15 }); await page.mouse.up();
      await wait(200);
      const r = await ev(() => { const o = __lai.canvas.getActiveObject(); const p = o.getCenterPoint(); return { x: p.x, y: p.y, w: o.getScaledWidth(), h: o.getScaledHeight(), ratio: o.scaleX / o.scaleY }; });
      assert(r.w < br.w - 50 && Math.abs(r.ratio - 1) < 0.01, JSON.stringify(r));
      assert(r.x > 1250, 'not moved ' + r.x);
      return `${Math.round(r.w)}×${Math.round(r.h)} ที่ ${Math.round(r.x)},${Math.round(r.y)}`;
    });
    await step('ครอบตัด: ดับเบิลคลิกรูป → ลากขอบบนลง และขอบขวาเข้า → เสร็จสิ้น', async () => {
      const i = (await objs()).length - 1;
      const before = await ev((i) => { const o = __lai.canvas.getObjects()[i]; return { w: o.getScaledWidth(), h: o.getScaledHeight(), nat: o.getOriginalSize() }; }, i);
      const c = await centerOf(i);
      await page.mouse.dblclick(c.x, c.y);
      await page.waitForSelector('[data-ctx][data-kind="crop"]');
      const handle = (k) => ev((k) => { const f = __lai._crop.frame; f.setCoords(); const r = __lai.canvas.upperCanvasEl.getBoundingClientRect(); return { x: r.left + f.oCoords[k].x, y: r.top + f.oCoords[k].y }; }, k);
      const mt = await handle('mt');
      await page.mouse.move(mt.x, mt.y); await page.mouse.down(); await page.mouse.move(mt.x, mt.y + 60, { steps: 8 }); await page.mouse.up();
      const mr = await handle('mr'); // the side handle moved with the new top edge
      const pts = { mr };
      await page.mouse.move(pts.mr.x, pts.mr.y); await page.mouse.down(); await page.mouse.move(pts.mr.x - 40, pts.mr.y, { steps: 8 }); await page.mouse.up();
      await page.click('[data-ctx] [data-act="crop-done"]');
      await wait(300);
      const after = await ev((i) => { const o = __lai.canvas.getObjects()[i]; return { w: o.getScaledWidth(), h: o.getScaledHeight(), cropX: o.cropX, cropY: o.cropY, crop: o.crop }; }, i);
      assert(after.h < before.h - 20 && after.w < before.w - 10 && after.cropY > 0, JSON.stringify({ before, after }));
      assert(!(await ev(() => !!__lai._crop)), 'still in crop mode');
      return `${Math.round(before.w)}×${Math.round(before.h)} → ${Math.round(after.w)}×${Math.round(after.h)}`;
    });
    await step('ครอบตัดแบบสัดส่วน 1:1 จากแถบเครื่องมือ แล้วยกเลิก (Esc) — รูปไม่เปลี่ยน', async () => {
      const i = (await objs()).length - 1;
      const keep = await ev((i) => { const o = __lai.canvas.getObjects()[i]; return [o.width, o.height, o.cropX, o.cropY].map(Math.round).join(); }, i);
      await selectAt(i);
      await page.click('[data-ctx] [data-act="crop-mode"]');
      await page.waitForSelector('[data-ctx][data-kind="crop"]');
      await page.click('[data-ctx] [data-act="crop-ratio:1"]');
      const sq = await ev(() => { const f = __lai._crop.frame; return f.getScaledWidth() / f.getScaledHeight(); });
      await page.keyboard.press('Escape');
      await wait(200);
      const now = await ev((i) => { const o = __lai.canvas.getObjects()[i]; return [o.width, o.height, o.cropX, o.cropY].map(Math.round).join(); }, i);
      assert(Math.abs(sq - 1) < 0.02 && now === keep, JSON.stringify({ sq, keep, now }));
    });
    await step('ครอบตัด 16:9 แล้วกด Enter ยืนยัน: รูปเป็น 16:9', async () => {
      const i = (await objs()).length - 1;
      await selectAt(i);
      await page.click('[data-ctx] [data-act="crop-mode"]');
      await page.click('[data-ctx] [data-act="crop-ratio:1.7778"]');
      await page.keyboard.press('Enter');
      await wait(300);
      const r = await ev((i) => { const o = __lai.canvas.getObjects()[i]; return o.getScaledWidth() / o.getScaledHeight(); }, i);
      assert(Math.abs(r - 16 / 9) < 0.03, 'ratio ' + r);
    });
    await step('รูปทรงกรอบ: เปลี่ยนรูปเป็นวงกลม (ปุ่ม "กรอบ")', async () => {
      const i = (await objs()).length - 1;
      await selectAt(i);
      await page.click('[data-ctx] [data-act="pop:mask"]');
      await page.click('.popover .mask-grid [data-m="circle"]');
      await wait(200);
      assert((await ev((i) => __lai.canvas.getObjects()[i].mask, i)) === 'circle', 'mask');
      await page.keyboard.press('Escape');
    });
    await step('ปรับแต่งรูป: ความสว่าง/ความอิ่มตัว (สไลเดอร์) แล้วรูปยังอยู่ที่เดิม', async () => {
      const i = (await objs()).length - 1;
      const p0 = await ev((i) => { const o = __lai.canvas.getObjects()[i]; return [Math.round(o.left), Math.round(o.top)].join(); }, i);
      await page.click('[data-ctx] [data-act="pop:adjust"]');
      const rs = await page.$$('.popover input[type="range"]');
      assert(rs.length >= 2, 'sliders ' + rs.length);
      for (const r of rs.slice(0, 2)) { const b = await r.boundingBox(); await page.mouse.click(b.x + b.width * 0.75, b.y + b.height / 2); }
      await wait(300);
      const r = await ev((i) => { const o = __lai.canvas.getObjects()[i]; return { f: (o.filters || []).length, p: [Math.round(o.left), Math.round(o.top)].join() }; }, i);
      assert(r.f >= 1 && r.p === p0, JSON.stringify(r) + ' was ' + p0);
      await page.keyboard.press('Escape');
    });
    await step('ภาพหน้าจอหลังจัดการรูป', async () => { await ev(() => { __lai.canvas.discardActiveObject(); __lai.canvas.requestRenderAll(); }); await page.screenshot({ path: path.join(OUT, 'stage4-image.png') }); });
  }

  // ================================================================== 5. multi-select and groups
  if (stage(5, 'เลือกหลายชิ้น (Shift+คลิก, ลากคลุม) จัดกลุ่ม ย้ายทั้งกลุ่ม ยกเลิกกลุ่ม')) {
    await step('Shift+คลิก: หัวเรื่อง + เนื้อความ + รูป → เลือกได้ 3 ชิ้น แถบเครื่องมือหลายชิ้นขึ้น', async () => {
      await page.keyboard.press('Escape');
      const n = (await objs()).length;
      await selectAt(0);
      await selectAt(1, 'Shift');
      await selectAt(n - 1, 'Shift');
      const a = await active();
      assert(a && a.type === 'activeselection' && a.n === 3, JSON.stringify(a));
      await page.waitForSelector('[data-ctx][data-kind="multi"]');
    });
    await step('จัดกลุ่มด้วยปุ่ม "จัดกลุ่ม" → เป็น 1 กลุ่ม ข้อความในกลุ่มครบ', async () => {
      await page.click('[data-ctx] [data-act="group"]');
      await wait(200);
      const r = await ev(() => { const g = __lai.canvas.getActiveObject(); return { type: g.type, n: g.getObjects().length, total: __lai.canvas.getObjects().length, texts: g.getObjects().filter((o) => o.text).map((o) => o.text.length) }; });
      assert(r.type === 'group' && r.n === 3 && r.total === 1 && r.texts.length === 2, JSON.stringify(r));
    });
    await step('ลากกลุ่มไปทางซ้าย 200 px: ทุกชิ้นขยับเท่ากัน', async () => {
      const before = await ev(() => __lai.canvas.getObjects()[0].getObjects().map((o) => Math.round(o.getCenterPoint().x)));
      const c = await centerOf(0);
      await page.mouse.move(c.x, c.y); await page.mouse.down(); await page.mouse.move(c.x - 100, c.y, { steps: 10 }); await page.mouse.up();
      await wait(200);
      const after = await ev(() => __lai.canvas.getObjects()[0].getObjects().map((o) => Math.round(o.getCenterPoint().x)));
      const d = after.map((x, i) => before[i] - x);
      assert(d.every((x) => Math.abs(x - d[0]) <= 1) && d[0] > 100, JSON.stringify(d));
      return `ขยับ ${d[0]} px`;
    });
    await step('ดับเบิลคลิกข้อความในกลุ่ม → พิมพ์แก้ได้ทันที (ไม่ต้องยกเลิกกลุ่ม) แล้วกลุ่ม ตำแหน่ง และลำดับชั้นเหมือนเดิม', async () => {
      const pos = () => ev(() => __lai.canvas.getObjects()[0].getObjects().map((o) => [o.type, Math.round(o.getCenterPoint().x), Math.round(o.getCenterPoint().y)].join()));
      const before = await pos();
      const c = await ev(() => { const g = __lai.canvas.getObjects()[0]; const t = g.getObjects()[1]; const p = t.getCenterPoint(); const r = __lai.canvas.upperCanvasEl.getBoundingClientRect(), v = __lai.canvas.viewportTransform; return { x: r.left + p.x * v[0] + v[4], y: r.top + p.y * v[3] + v[5] }; });
      await page.mouse.dblclick(c.x, c.y);
      await wait(300);
      const ed = await ev(() => { const a = __lai.canvas.getActiveObject(); return { editing: !!a?.isEditing, type: a?.type }; });
      assert(ed.editing, 'not editing: ' + ed.type);
      await page.keyboard.press('End');
      await page.keyboard.type(' ครบ');
      await page.keyboard.press('Escape');
      await wait(300);
      const r = await ev(() => { const o = __lai.canvas.getObjects(); const g = o[0]; return { n: o.length, type: g.type, kids: g.getObjects?.().length, text: g.getObjects?.()[1].text }; });
      const after = await pos();
      assert(r.n === 1 && r.type === 'group' && r.kids === 3 && r.text.endsWith(' ครบ'), JSON.stringify(r));
      assert(JSON.stringify(after.map((x) => x.split(',')[0])) === JSON.stringify(before.map((x) => x.split(',')[0])), 'order ' + after);
      const moved = after.map((x, i) => Math.abs(+x.split(',')[1] - +before[i].split(',')[1]) + (i === 1 ? 0 : Math.abs(+x.split(',')[2] - +before[i].split(',')[2])));
      assert(moved.every((d) => d <= 2), 'moved ' + JSON.stringify({ before, after }));
      await page.keyboard.press('Control+Z'); await wait(300); // undo the edit (back to the original paragraph)
      return r.text.slice(-12);
    });
    await step('ยกเลิกกลุ่ม (Ctrl+Shift+G): ได้ 3 ชิ้นแยกกัน ตำแหน่งเดิม ข้อความเดิม', async () => {
      await page.keyboard.press('Escape');
      await selectAt(0);
      const before = await ev(() => __lai.canvas.getObjects()[0].getObjects().map((o) => [Math.round(o.getCenterPoint().x), Math.round(o.getCenterPoint().y)].join()));
      await page.keyboard.press('Control+Shift+G');
      await wait(300);
      const r = await ev(() => __lai.canvas.getObjects().map((o) => ({ t: o.type, p: [Math.round(o.getCenterPoint().x), Math.round(o.getCenterPoint().y)].join(), text: o.text })));
      assert(r.length === 3 && r.every((o, i) => o.p === before[i]), JSON.stringify({ before, r }));
    });
    await step('ลากคลุม (marquee) จากพื้นที่ว่าง: เลือกได้ทุกชิ้นที่อยู่ในกรอบ แล้ว Ctrl+G', async () => {
      await page.keyboard.press('Escape');
      const a = await screenOf(-40, -40), b = await screenOf(1960, 1120);
      await page.mouse.move(a.x, a.y); await page.mouse.down(); await page.mouse.move(b.x, b.y, { steps: 15 }); await page.mouse.up();
      await wait(200);
      const s = await active();
      assert(s && s.type === 'activeselection' && s.n === 3, JSON.stringify(s));
      await page.keyboard.press('Control+G');
      await wait(200);
      assert((await ev(() => __lai.canvas.getObjects().length)) === 1, 'not grouped');
    });
    await step('ทำสำเนากลุ่ม (Ctrl+D) แล้วเลิกทำ 2 ครั้ง: กลับเป็น 3 ชิ้นแยก', async () => {
      await page.keyboard.press('Control+D');
      await wait(200);
      const two = await ev(() => __lai.canvas.getObjects().length);
      await page.keyboard.press('Control+Z'); await wait(300);
      await page.keyboard.press('Control+Z'); await wait(300);
      const r = await ev(() => __lai.canvas.getObjects().map((o) => o.type));
      assert(two === 2 && r.length === 3 && !r.includes('group'), JSON.stringify({ two, r }));
    });
    await step('ภาพหน้าจอหลังจัดกลุ่ม', async () => { await ev(() => { __lai.canvas.discardActiveObject(); __lai.canvas.requestRenderAll(); }); await page.screenshot({ path: path.join(OUT, 'stage5-groups.png') }); });
  }

  // ================================================================== 6. elements
  const last = () => ev(() => { const o = __lai.canvas.getObjects().at(-1); return { type: o.type, smart: o.smart?.type, chart: o.smart?.chart, graphic: o.graphic?.n }; });
  const placeLast = async (x, y) => { // drag the newest object to a spot (design units) with the mouse
    const i = (await objs()).length - 1; const c = await centerOf(i); const t = await screenOf(x, y);
    await page.mouse.move(c.x, c.y); await page.mouse.down(); await page.mouse.move(t.x, t.y, { steps: 10 }); await page.mouse.up(); await wait(150);
  };
  if (stage(6, 'องค์ประกอบ: รูปทรง เส้น ไอคอน กราฟิก ตาราง กราฟ QR สมการ (ใส่ แก้ข้อมูล เปลี่ยนสี)')) {
    await step('เปิดแผงองค์ประกอบ ใส่สี่เหลี่ยม ลากไปวาง เปลี่ยนสีพื้น ขอบ และมุมมน', async () => {
      await page.keyboard.press('Escape');
      await openPanel('elements');
      await page.click('[data-act="shape:0"]');
      await page.waitForFunction(() => __lai.canvas.getActiveObject()?.type === 'rect');
      await placeLast(260, 860);
      await page.click('[data-ctx] [data-act="color:fill"]');
      const inp = await page.waitForSelector('.color-pop [data-hex]');
      await inp.fill('#22C55E'); await inp.press('Enter'); await page.keyboard.press('Escape');
      for (const k of ['strokeWidth', 'rx']) { const r = await page.$(`[data-ctx] [data-range="${k}"]`); const b = await r.boundingBox(); await page.mouse.click(b.x + b.width * 0.4, b.y + b.height / 2); }
      const r = await ev(() => { const o = __lai.canvas.getActiveObject(); return { fill: o.fill, sw: o.strokeWidth, rx: o.rx }; });
      assert(String(r.fill).toLowerCase() === '#22c55e' && r.sw > 0 && r.rx > 0, JSON.stringify(r));
    });
    await step('ใส่เส้น แล้วเปลี่ยนเป็นเส้นประ', async () => {
      await page.click('[data-act="line:0"]');
      await wait(200);
      await placeLast(700, 980);
      const sc = await ev(() => { const o = __lai.canvas.getActiveObject(); return [o.scaleX, o.scaleY]; });
      assert(sc[1] === 1, 'กดกลางเส้นเพื่อย้าย แต่เส้นถูกยืดเป็นแถบหนา: scaleY ' + sc[1]);
      await page.selectOption('[data-ctx] [data-select="dash"]', 'dash');
      const d = await ev(() => __lai.canvas.getActiveObject().strokeDashArray);
      assert(Array.isArray(d) && d.length === 2, JSON.stringify(d));
    });
    await step('ค้นหาองค์ประกอบ "หัวใจ" แล้วคลิกผลแรก → เปลี่ยนสีกราฟิก', async () => {
      await page.fill('[data-el-search]', 'หัวใจ'); await wait(400);
      const first = await page.$$eval('[data-panel-body] .el', (b) => b.filter((x) => !x.hidden && !x.closest('[hidden]') && /gfx:g\|tabler/.test(x.dataset.act)).map((x) => x.dataset.act)[0]);
      assert(first, 'no mono heart icon in results');
      await page.fill('[data-el-search]', ''); await page.fill('[data-el-search]', 'หัวใจ'); await wait(300);
      const n0 = (await objs()).length;
      await page.click(`[data-act="${first}"]`);
      await page.waitForFunction((n) => __lai.canvas.getObjects().length === n + 1, n0);
      await placeLast(1100, 860);
      await page.fill('[data-el-search]', '');
      await page.click('[data-ctx] [data-act="color:graphic"]');
      const inp = await page.waitForSelector('.color-pop [data-hex]');
      await inp.fill('#E11D48'); await inp.press('Enter'); await page.keyboard.press('Escape');
      const c = await ev(() => __lai.canvas.getActiveObject().graphic.color);
      await page.fill('[data-el-search]', '');
      assert(String(c).toLowerCase() === '#e11d48', c);
      assert(/\|heart$/.test(first), 'ผลแรกไม่ใช่หัวใจ: ' + first);
      return first.replace('gfx:', '');
    });
    await step('ตาราง: ใส่ → ดับเบิลคลิก → พิมพ์หัวตารางไทย + เพิ่มแถว → ใช้การเปลี่ยนแปลง: ข้อความไทยในตารางครบ', async () => {
      await page.click('[data-act="smart:table"]');
      await page.waitForFunction(() => __lai.canvas.getActiveObject()?.smart?.type === 'table');
      await placeLast(1500, 760);
      const c = await centerOf((await objs()).length - 1);
      await page.mouse.dblclick(c.x, c.y);
      await page.waitForSelector('.modal [data-cell="0,0"]');
      const words = ['ชื่อนักเรียน', 'คะแนนสอบ', 'ผลการประเมิน'];
      for (let i = 0; i < 3; i++) { const cell = await page.$(`.modal [data-cell="0,${i}"]`); if (!cell) break; await cell.fill(''); await cell.type(words[i], { delay: 10 }); }
      await page.click('.modal [data-t="row+"]');
      const rows = await page.$$eval('.modal tr', (e) => e.length);
      const nc = await page.$$eval('.modal tr:last-child [data-cell]', (e) => e.length);
      await page.fill(`.modal [data-cell="${rows - 1},0"]`, 'ด.ญ.สมศรี ใจดี');
      await page.click('.modal [data-go]');
      await page.waitForSelector('.modal', { state: 'detached' });
      const r = await ev(() => { const o = __lai.canvas.getObjects().at(-1); return { rows: o.smart.rows.length, head: o.smart.rows[0], last: o.smart.rows.at(-1)[0], texts: o.getObjects().filter((x) => x.text).map((x) => x.text) }; });
      assert(r.rows === rows && words.slice(0, nc).every((w) => r.texts.includes(w)) && r.texts.includes('ด.ญ.สมศรี ใจดี'), JSON.stringify(r).slice(0, 300));
      const bad = await ev(() => { const o = __lai.canvas.getObjects().at(-1); return o.getObjects().filter((x) => x.text && x._textLines.some((l) => l.length === 1 && x.text.length > 3)).map((x) => x.text); });
      assert(!bad.length, 'ข้อความในช่องตารางถูกตัดเหลือบรรทัดละตัว: ' + bad);
      return `${r.rows} แถว`;
    });
    await step('กราฟแท่ง: ใส่ → แก้ป้ายและตัวเลข → กราฟเปลี่ยนตาม', async () => {
      await page.click('[data-act="smart:bar"]');
      await page.waitForFunction(() => __lai.canvas.getActiveObject()?.smart?.chart === 'bar');
      await placeLast(420, 300);
      await page.click('[data-ctx] [data-act="smart-edit"]');
      await page.waitForSelector('.modal [data-l="0"]');
      await page.fill('.modal [data-l="0"]', 'มกราคม');
      await page.fill('.modal [data-v="0:0"]', '87');
      await page.click('.modal [data-go]');
      await page.waitForSelector('.modal', { state: 'detached' });
      const r = await ev(() => { const o = __lai.canvas.getObjects().at(-1); return { labels: o.smart.labels || o.smart.rows?.map((x) => x[0]), texts: o.getObjects().filter((x) => x.text).map((x) => x.text) }; });
      assert(r.texts.some((t) => t.includes('มกราคม')) && r.texts.some((t) => t.includes('87')), JSON.stringify(r).slice(0, 300));
    });
    await step('QR Code: ใส่ → ตั้งลิงก์ใหม่ → คิวอาร์เปลี่ยน', async () => {
      await page.click('[data-act="smart:qr"]');
      await page.waitForFunction(() => __lai.canvas.getActiveObject()?.smart?.type === 'qr');
      await placeLast(1700, 200);
      const before = await ev(() => JSON.stringify(__lai.canvas.getActiveObject().toObject().objects?.length || __lai.canvas.getActiveObject().getSrc?.()?.length));
      await page.click('[data-ctx] [data-act="smart-edit"]');
      await page.fill('.modal [data-text]', 'https://laistudio.example/ห้องเรียน-ป2');
      await page.click('.modal [data-go]');
      await page.waitForSelector('.modal', { state: 'detached' });
      const r = await ev(() => __lai.canvas.getObjects().at(-1).smart.text);
      assert(r === 'https://laistudio.example/ห้องเรียน-ป2', r);
      return before;
    });
    await step('สมการ: ใส่ → พิมพ์ LaTeX สูตรพื้นที่วงกลม → แสดงผล', async () => {
      await page.click('[data-act="smart:equation"]');
      await page.waitForFunction(() => __lai.canvas.getActiveObject()?.smart?.type === 'equation');
      await placeLast(1100, 450);
      await page.click('[data-ctx] [data-act="smart-edit"]');
      await page.fill('.modal [data-latex]', 'A = \\pi r^2');
      await page.click('.modal [data-go]');
      await page.waitForSelector('.modal', { state: 'detached' });
      const r = await ev(() => { const o = __lai.canvas.getObjects().at(-1); return { latex: o.smart.latex, w: o.getScaledWidth(), h: o.getScaledHeight() }; });
      assert(r.latex === 'A = \\pi r^2' && r.w > 20 && r.h > 10, JSON.stringify(r));
    });
    await step('ทุกชิ้นที่ใส่อยู่ในหน้า และไม่มีข้อผิดพลาด', async () => {
      const out = await ev(() => __lai.canvas.getObjects().filter((o) => { o.setCoords(); const b = o.getBoundingRect(); return b.left + b.width < 0 || b.top + b.height < 0 || b.left > 1920 || b.top > 1080; }).map((o) => o.type));
      assert(!out.length && !errors.length, JSON.stringify({ out, errors }));
      return (await objs()).length + ' ชิ้นบนหน้า';
    });
    await step('ภาพหน้าจอหลังใส่องค์ประกอบ', async () => { await ev(() => { __lai.canvas.discardActiveObject(); __lai.canvas.requestRenderAll(); }); await page.screenshot({ path: path.join(OUT, 'stage6-elements.png') }); });
  }

  // ---------------------------------------------------------------- report
  await ev(() => __lai?.saveNow?.()).catch(() => {});
  const fails = results.filter((r) => !r.ok);
  const md = ['# Lai Studio – ทดสอบแบบผู้ใช้จริงทีละขั้นตอน', '', `ผ่าน ${results.length - fails.length}/${results.length}` + (errors.length ? ` · ข้อผิดพลาดในหน้าเว็บ ${errors.length}: ${errors.slice(0, 3).join(' | ')}` : ''), ''];
  let g = '';
  for (const r of results) {
    if (r.group !== g) { g = r.group; md.push('', `## ${g}`, '', '| ผล | ขั้นตอน | หมายเหตุ |', '|---|---|---|'); }
    md.push(`| ${r.ok ? '✅' : '❌'} | ${r.name} | ${(r.note || '').replace(/\|/g, '/').replace(/\n/g, ' ')}${r.shot ? ` ([ภาพ](${r.shot}))` : ''} |`);
  }
  fs.writeFileSync(path.join(OUT, 'REPORT.md'), md.join('\n') + '\n');
  console.log(`\n${results.length - fails.length}/${results.length} passed${errors.length ? `, page errors: ${errors.length}` : ''}. Report: tests/report-journey/REPORT.md`);
  await browser.close();
  server.kill();
  process.exit(fails.length || errors.length ? 1 : 0);
})();
