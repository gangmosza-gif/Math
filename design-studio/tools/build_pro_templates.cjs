// Builds the "pro presentation" templates with the app's own tools (tools/pro_deck.js) and saves the
// resulting pages to src/protemplates.json, which the template panel loads.
//
//   npx vite --port 5199 &      (dev server)
//   node tools/build_pro_templates.cjs
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const URL = process.env.URL || 'http://localhost:5199/';
const NAMES = [
  ['pro-finance', 'สรุปผลการเงินสำหรับผู้บริหาร'],
  ['pro-product', 'เปิดตัวผลิตภัณฑ์'],
  ['pro-marketing', 'ผลแคมเปญการตลาด'],
];

(async () => {
  const b = await chromium.launch();
  const page = await b.newPage({ viewport: { width: 1600, height: 1000 } });
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(URL);
  await page.click('.preset[data-preset="5"]'); // 16:9, 1920×1080
  await page.waitForFunction(() => window.__lai && __lai.canvas);
  await page.waitForTimeout(800);
  await page.evaluate(async () => (await import('/tools/pro_deck.js')).buildProDeck(__lai));
  await page.waitForTimeout(1500);
  const d = await page.evaluate(async () => { await __lai.saveNow?.(); return __lai.design; });
  await b.close();
  if (errs.length) throw new Error(errs.join('\n'));
  if (d.width !== 1920 || d.height !== 1080 || d.pages.length !== NAMES.length) throw new Error('unexpected deck ' + d.width + 'x' + d.height + ' / ' + d.pages.length);
  const round = (k, v) => (typeof v === 'number' && !Number.isInteger(v) ? Math.round(v * 1000) / 1000 : v);
  const out = NAMES.map(([id, name], i) => ({ id, name, w: 1920, h: 1080, page: JSON.parse(d.pages[i].json) }));
  const file = path.join(__dirname, '..', 'src', 'protemplates.json');
  fs.writeFileSync(file, JSON.stringify(out, round));
  console.log('saved', file, Math.round(fs.statSync(file).size / 1024) + ' KB');
})().catch((e) => { console.error(e); process.exit(1); });
