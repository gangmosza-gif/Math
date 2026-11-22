// Builds the "pro presentation" templates with the app's own tools (tools/pro_deck.js) and saves the
// resulting pages to src/protemplates.json, which the template panel loads.
//
//   npx vite --port 5199 &      (dev server)
//   node tools/build_pro_templates.cjs
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const URL = process.env.URL || 'http://localhost:5199/';
// [builder module, its function, argument, [id, name] for each page it makes]
const DECKS = [
  ['/tools/pro_deck.js', 'buildProDeck', undefined, [['pro-finance', 'สรุปผลการเงินสำหรับผู้บริหาร'], ['pro-product', 'เปิดตัวผลิตภัณฑ์'], ['pro-marketing', 'ผลแคมเปญการตลาด']]],
  ['/tools/theme_decks.js', 'buildThemeDecks', ['proposal'], [['proposal-cover', 'ข้อเสนอโครงการ · หน้าปก'], ['proposal-objectives', 'ข้อเสนอโครงการ · วัตถุประสงค์'], ['proposal-timeline', 'ข้อเสนอโครงการ · แผนงานและระยะเวลา'], ['proposal-contact', 'ข้อเสนอโครงการ · ขอบคุณและติดต่อ']]],
  ['/tools/theme_decks.js', 'buildThemeDecks', ['mindmap'], [['mindmap-steps', 'Mind Map น่ารัก · ขั้นตอนการทำงาน'], ['mindmap-notes', 'Mind Map น่ารัก · กระดาษโน้ตสรุป']]],
  ['/tools/theme_decks.js', 'buildThemeDecks', ['retro'], [['retro-cover', 'การ์ตูนย้อนยุค · หน้าปก'], ['retro-agenda', 'การ์ตูนย้อนยุค · หัวข้อนำเสนอ'], ['retro-folders', 'การ์ตูนย้อนยุค · เนื้อหาในแฟ้ม'], ['retro-thanks', 'การ์ตูนย้อนยุค · ขอบคุณ']]],
  ['/tools/theme_decks.js', 'buildThemeDecks', ['company'], [['company-cover', 'แนะนำบริษัท · หน้าปก'], ['company-about', 'แนะนำบริษัท · เกี่ยวกับเรา'], ['company-goals', 'แนะนำบริษัท · เป้าหมาย'], ['company-closing', 'แนะนำบริษัท · ปิดท้าย']]],
];

(async () => {
  const b = await chromium.launch();
  const page = await b.newPage({ viewport: { width: 1600, height: 1000 } });
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  const out = [];
  for (const [mod, fn, arg, names] of DECKS) {
    await page.goto(URL);
    await page.click('.preset[data-preset="5"]'); // 16:9, 1920×1080
    await page.waitForFunction(() => window.__lai && __lai.canvas);
    await page.waitForTimeout(800);
    await page.evaluate(async ([mod, fn, arg]) => (await import(mod))[fn](__lai, arg), [mod, fn, arg]);
    await page.waitForTimeout(1500);
    const d = await page.evaluate(async () => { await __lai.saveNow?.(); return __lai.design; });
    if (errs.length) throw new Error(errs.join('\n'));
    if (d.width !== 1920 || d.height !== 1080 || d.pages.length !== names.length) throw new Error(`unexpected deck ${mod} ${arg}: ${d.width}x${d.height} / ${d.pages.length}`);
    // library photos: a path next to the app (works in the dev server, the build and the single-file page)
    names.forEach(([id, name], i) => out.push({ id, name, w: 1920, h: 1080, page: JSON.parse(d.pages[i].json.replace(/https?:\/\/[^/"]+\/(photos\/)/g, '$1')) }));
  }
  await b.close();
  const round = (k, v) => (typeof v === 'number' && !Number.isInteger(v) ? Math.round(v * 1000) / 1000 : v);
  const file = path.join(__dirname, '..', 'src', 'protemplates.json');
  fs.writeFileSync(file, JSON.stringify(out, round));
  // small index (always loaded): names and fonts; the pages themselves load when a template is first shown
  const fontsOf = (objs, set = new Set()) => { for (const o of objs || []) { if (o.fontFamily) set.add(o.fontFamily); fontsOf(o.objects, set); } return set; };
  const index = out.map(({ id, name, w, h, page }) => ({ id, name, w, h, fonts: [...fontsOf(page.objects)].filter((f) => f !== 'sans-serif') }));
  fs.writeFileSync(path.join(__dirname, '..', 'src', 'protemplates-index.json'), JSON.stringify(index));
  console.log('saved', file, Math.round(fs.statSync(file).size / 1024) + ' KB', '+ index of', index.length);
})().catch((e) => { console.error(e); process.exit(1); });
