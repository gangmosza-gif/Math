import './style.css';
import { Editor, BLANK_PAGE } from './editor.js';
import { PRESETS } from './presets.js';
import { listDesigns, getDesign, saveDesign, deleteDesign, deleteVersionsOf, uid } from './storage.js';
import { icon } from './icons.js';
import { hostDownloadsReady, renderPage } from './export.js';
import { TEMPLATES, TEMPLATE_CATEGORIES, buildTemplate, templateFonts } from './templates.js';
import { ensureFonts } from './fonts.js';

// as a claude.ai Artifact, get the platform's file-save ready early (no-op in a normal browser)
hostDownloadsReady();
import { esc, h, toast, modal, confirmDialog, promptDialog, popover, closePopover } from './ui.js';

const app = document.getElementById('app');
let editor = null;

function newDesign({ w, h: hh, mm = null, name }) {
  return {
    id: uid(),
    name: name || 'งานออกแบบไม่มีชื่อ',
    width: w,
    height: hh,
    mm,
    pages: [{ id: uid(), json: BLANK_PAGE() }],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

async function createAndOpen(spec, then = null) {
  const d = newDesign(spec);
  await saveDesign(d);
  if (then) { try { sessionStorage.setItem('lai-pending', JSON.stringify({ id: d.id, ...then })); } catch { /* storage blocked */ } }
  location.hash = `#/d/${d.id}`;
}
const fromPreset = (i, then) => { const p = PRESETS[i]; return createAndOpen({ w: p.w, h: p.h, mm: p.mm, name: p.name }, then); };

// ---------------------------------------------------------------- home: start points, shortcuts, templates
const CATS = [
  { k: 'social', label: 'โซเชียลมีเดีย', color: '#ef4f5a', ic: 'heart', sizes: [0, 1, 2, 3, 4], tcats: ['โซเชียล', 'โปรโมชัน', 'คำคม'] },
  { k: 'present', label: 'งานนำเสนอ', color: '#f2762e', ic: 'chart', sizes: [5, 7], tcats: ['นำเสนอ', 'อินโฟกราฟิก'] },
  { k: 'print', label: 'งานพิมพ์', color: '#8b3cf7', ic: 'print', sizes: [10, 6, 7, 11, 9], tcats: ['ประกาศ', 'กิจกรรม', 'ร้านอาหาร'] },
  { k: 'open', label: 'เปิดไฟล์', color: '#e9e7f3', ic: 'cloud', light: true },
  { k: 'doc', label: 'เอกสาร / รายงาน', color: '#3a9fb0', ic: 'file', sizes: [6, 7, 8], tcats: ['การศึกษา', 'ประกาศ', 'อินโฟกราฟิก'] },
  { k: 'edu', label: 'การศึกษา', color: '#2fa35a', ic: 'school', sizes: [8, 9, 6, 5], tcats: ['การศึกษา'] },
  { k: 'biz', label: 'ธุรกิจ', color: '#2f6fe0', ic: 'money', sizes: [11, 12, 13, 2], tcats: ['ธุรกิจ', 'โปรโมชัน'] },
  { k: 'custom', label: 'กำหนดขนาดเอง', color: '#e9e7f3', ic: 'resize', light: true },
];
const SHORTCUTS = [
  { label: 'ใบงาน', ic: 'calculator', g: ['#a78bfa', '#6366f1'], go: () => fromPreset(8, { tpl: 2 }) },
  { label: 'เกียรติบัตร', ic: 'trophy', g: ['#fcd34d', '#f59e0b'], go: () => fromPreset(9, { tpl: 3 }) },
  { label: 'รายงาน', ic: 'book', g: ['#5eead4', '#0d9488'], go: () => fromPreset(6, { act: 'docsetup' }) },
  { label: 'กราฟ', ic: 'chart', g: ['#fda4af', '#e11d48'], go: () => fromPreset(5, { act: 'smart:bar' }) },
  { label: 'ตาราง', ic: 'pages', g: ['#93c5fd', '#2563eb'], go: () => fromPreset(6, { act: 'smart:table' }) },
  { label: 'QR Code', ic: 'link', g: ['#86efac', '#16a34a'], go: () => fromPreset(0, { act: 'smart:qr' }) },
  { label: 'สมการ', ic: 'bulb', g: ['#f0abfc', '#c026d3'], go: () => fromPreset(6, { act: 'smart:equation' }) },
  { label: 'ชุดแบรนด์', ic: 'star', g: ['#fdba74', '#ea580c'], go: () => fromPreset(0, { panel: 'brand' }) },
];
const PICKS = [0, 3, 2, 9, 4, 6, 37, 17, 1, 5, 82, 67];
const CAT_TINT = ['#efe7ff', '#ffe8dc', '#dff3ef', '#ffe3ef', '#e3edff', '#fff4d6', '#e8f6e0', '#f3e8ff', '#ffe9e9', '#e1f4fb', '#f1f1f1'];

/** Size a template is shown and created in: slides 16:9, school/notice/infographic A4, others square. */
function tplPreset(t) {
  if (t.cat === 'นำเสนอ') return 5;
  if (['การศึกษา', 'ประกาศ', 'อินโฟกราฟิก'].includes(t.cat)) return 6;
  return 0;
}

// template thumbnails, rendered one at a time and kept for this visit
const thumbCache = new Map();
let thumbQueue = Promise.resolve();
function templateThumb(i, preset) {
  const key = `${i}:${preset}`;
  if (!thumbCache.has(key)) {
    thumbCache.set(key, (thumbQueue = thumbQueue.then(async () => {
      const t = TEMPLATES[i], p = PRESETS[preset];
      await Promise.race([ensureFonts(templateFonts(t)), new Promise((r) => setTimeout(r, 2500))]);
      const { objects, background } = buildTemplate(t, p.w, p.h);
      const json = { version: '6.9.1', objects: objects.map((o) => o.toObject()), background: background.toObject ? background.toObject() : background };
      const sc = await renderPage({ width: p.w, height: p.h, pages: [] }, json, { deco: false });
      const url = sc.toDataURL({ format: 'jpeg', quality: 0.82, multiplier: 360 / Math.max(p.w, p.h) });
      sc.dispose();
      return url;
    }).catch(() => '')));
  }
  return thumbCache.get(key);
}
/** Fill <img data-tthumb="i:preset"> when they scroll into view. */
function lazyThumbs(root) {
  const io = new IntersectionObserver((ents) => ents.forEach((en) => {
    if (!en.isIntersecting) return;
    io.unobserve(en.target);
    const [i, pr] = en.target.dataset.tthumb.split(':').map(Number);
    templateThumb(i, pr).then((u) => { if (u) { en.target.src = u; en.target.classList.add('ready'); } });
  }), { rootMargin: '200px' });
  root.querySelectorAll('img[data-tthumb]').forEach((im) => io.observe(im));
}
const tplCard = (i, preset = tplPreset(TEMPLATES[i])) => {
  const p = PRESETS[preset];
  return `<button class="tpl-card" data-tpl="${i}" data-tpl-size="${preset}" title="${esc(TEMPLATES[i].name)}">
    <span class="tpl-img" style="aspect-ratio:${p.w}/${p.h}"><img data-tthumb="${i}:${preset}" alt=""></span>
    <span class="tpl-name">${esc(TEMPLATES[i].name)}</span><small>${esc(p.name)}</small></button>`;
};

function templateBrowser(cat = 'ทั้งหมด', q = '') {
  const m = modal({
    title: 'เทมเพลต',
    wide: true,
    body: `<div class="tb">
      <input class="input full" data-tb-q placeholder="ค้นหาเทมเพลต เช่น ใบงาน เมนู ไทม์ไลน์" value="${esc(q)}">
      <div class="chip-row" data-tb-cats>${TEMPLATE_CATEGORIES.map((c) => `<button class="chip ${c === cat ? 'on' : ''}" data-c="${esc(c)}">${esc(c)}</button>`).join('')}</div>
      <div class="tb-grid" data-tb-grid></div></div>`,
  });
  const grid = m.el.querySelector('[data-tb-grid]');
  const draw = () => {
    const qq = m.el.querySelector('[data-tb-q]').value.trim().toLowerCase();
    const list = TEMPLATES.map((t, i) => i).filter((i) => (cat === 'ทั้งหมด' || TEMPLATES[i].cat === cat) && (!qq || `${TEMPLATES[i].name} ${TEMPLATES[i].cat}`.toLowerCase().includes(qq)));
    grid.innerHTML = list.map((i) => tplCard(i)).join('') || '<p class="empty">ไม่พบเทมเพลต</p>';
    lazyThumbs(grid);
  };
  m.el.querySelector('[data-tb-q]').addEventListener('input', draw);
  m.el.querySelector('[data-tb-cats]').addEventListener('click', (e) => {
    const b = e.target.closest('[data-c]');
    if (!b) return;
    cat = b.dataset.c;
    m.el.querySelectorAll('[data-tb-cats] .on').forEach((x) => x.classList.remove('on'));
    b.classList.add('on');
    draw();
  });
  grid.addEventListener('click', (e) => {
    const b = e.target.closest('[data-tpl]');
    if (!b) return;
    m.close();
    fromPreset(+b.dataset.tplSize, { tpl: +b.dataset.tpl });
  });
  draw();
}

/** "What to make" sheet of one start category: its sizes and matching templates. */
function categorySheet(c) {
  const tpls = TEMPLATES.map((t, i) => i).filter((i) => c.tcats.includes(TEMPLATES[i].cat)).slice(0, 12);
  const m = modal({
    title: c.label,
    wide: true,
    body: `<div class="sheet">
      <div class="sec-title">เลือกขนาด</div>
      <div class="size-list">${c.sizes.map((i) => { const p = PRESETS[i]; const r = p.w / p.h; return `<button class="size-opt" data-size="${i}"><span class="size-shape" style="${r >= 1 ? `width:44px;height:${Math.round(44 / r)}px` : `height:44px;width:${Math.round(44 * r)}px`}">${p.icon}</span><b>${esc(p.name)}</b><small>${p.mm ? `${p.mm[0]}×${p.mm[1]} มม.` : `${p.w}×${p.h} px`}</small></button>`; }).join('')}</div>
      <div class="sec-title">เริ่มจากเทมเพลต</div>
      <div class="tb-grid">${tpls.map((i) => tplCard(i, c.sizes.includes(tplPreset(TEMPLATES[i])) ? tplPreset(TEMPLATES[i]) : c.sizes[0])).join('')}</div>
    </div>`,
  });
  lazyThumbs(m.el);
  m.el.addEventListener('click', (e) => {
    const s2 = e.target.closest('[data-size]');
    const t = e.target.closest('[data-tpl]');
    if (s2) { m.close(); fromPreset(+s2.dataset.size); }
    if (t) { m.close(); fromPreset(+t.dataset.tplSize, { tpl: +t.dataset.tpl }); }
  });
}

/** Floating "+" / create button: every size. */
function createSheet() {
  const m = modal({
    title: 'สร้างงานออกแบบ',
    wide: true,
    body: `<div class="sheet"><div class="size-list">${PRESETS.map((p, i) => { const r = p.w / p.h; return `<button class="size-opt" data-size="${i}"><span class="size-shape" style="${r >= 1 ? `width:44px;height:${Math.round(44 / r)}px` : `height:44px;width:${Math.round(44 * r)}px`}">${p.icon}</span><b>${esc(p.name)}</b><small>${p.mm ? `${p.mm[0]}×${p.mm[1]} มม.` : `${p.w}×${p.h} px`}</small></button>`; }).join('')}
      <button class="size-opt" data-size-custom><span class="size-shape" style="width:44px;height:44px">✏️</span><b>กำหนดขนาดเอง</b><small>ระบุกว้าง × สูง</small></button></div></div>`,
  });
  m.el.addEventListener('click', (e) => {
    const s2 = e.target.closest('[data-size]');
    if (s2) { m.close(); fromPreset(+s2.dataset.size); }
    if (e.target.closest('[data-size-custom]')) { m.close(); customSizeDialog(); }
  });
}

async function importProjectFile(file) {
  try {
    const data = JSON.parse(await file.text());
    const d = data.design || data;
    if (!d || !Array.isArray(d.pages) || !d.width || !d.height) throw new Error('bad file');
    d.id = uid();
    d.pages = d.pages.map((p) => ({ id: uid(), json: typeof p.json === 'string' ? p.json : JSON.stringify(p.json) }));
    d.updatedAt = Date.now();
    d.createdAt = d.createdAt || Date.now();
    await saveDesign(d);
    toast('เปิดไฟล์โปรเจกต์แล้ว', 'ok');
    location.hash = `#/d/${d.id}`;
  } catch (e) {
    console.error(e);
    toast('ไฟล์นี้ไม่ใช่ไฟล์โปรเจกต์ Lai Studio', 'error');
  }
}

async function duplicateDesign(id) {
  const d = await getDesign(id);
  if (!d) return;
  const c = { ...d, id: uid(), name: d.name + ' (สำเนา)', createdAt: Date.now(), updatedAt: Date.now(), pages: d.pages.map((p) => ({ ...p, id: uid() })) };
  await saveDesign(c);
  return c;
}

function customSizeDialog() {
  const m = modal({
    title: 'กำหนดขนาดเอง',
    body: `
      <div class="size-form">
        <label>กว้าง <input class="input" type="number" data-w value="1080" min="16" max="8000"></label>
        <span>×</span>
        <label>สูง <input class="input" type="number" data-h value="1080" min="16" max="8000"></label>
        <span>px</span>
      </div>
      <div class="modal-actions"><button class="btn" data-no>ยกเลิก</button><button class="btn primary" data-go>สร้างงานออกแบบ</button></div>`,
  });
  m.el.querySelector('[data-no]').onclick = () => m.close();
  m.el.querySelector('[data-go]').onclick = () => {
    const w = Math.round(+m.el.querySelector('[data-w]').value);
    const hh = Math.round(+m.el.querySelector('[data-h]').value);
    if (!(w >= 16 && hh >= 16 && w <= 8000 && hh <= 8000)) return toast('ขนาดต้องอยู่ระหว่าง 16 – 8000 px', 'error');
    m.close();
    createAndOpen({ w, h: hh });
  };
}

function relTime(t) {
  const s = (Date.now() - t) / 1000;
  if (s < 60) return 'เมื่อสักครู่';
  if (s < 3600) return `${Math.floor(s / 60)} นาทีที่แล้ว`;
  if (s < 86400) return `${Math.floor(s / 3600)} ชั่วโมงที่แล้ว`;
  return new Date(t).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
}

let homeFilter = 'all';

function storedFolders() {
  try { return JSON.parse(localStorage.getItem('lai-folders') || '[]'); } catch { return []; }
}
function saveFolders(list) {
  try { localStorage.setItem('lai-folders', JSON.stringify(list)); } catch { /* storage blocked */ }
}
function folderList(designs) {
  return [...new Set([...storedFolders(), ...designs.map((d) => d.folder).filter(Boolean)])].sort((a, b) => a.localeCompare(b, 'th'));
}

async function moveToFolderDialog(d) {
  const folders = folderList(await listDesigns());
  const m = modal({
    title: `ย้าย “${d.name}” ไปโฟลเดอร์`,
    body: `<label class="field">โฟลเดอร์ <select class="select" data-f>
        <option value="">(ไม่อยู่ในโฟลเดอร์)</option>
        ${folders.map((f) => `<option ${f === d.folder ? 'selected' : ''}>${esc(f)}</option>`).join('')}
      </select></label>
      <label class="field">หรือสร้างโฟลเดอร์ใหม่ <input class="input full" data-new placeholder="ชื่อโฟลเดอร์ใหม่"></label>
      <div class="modal-actions"><button class="btn" data-no>ยกเลิก</button><button class="btn primary" data-go>ย้าย</button></div>`,
  });
  m.el.querySelector('[data-no]').onclick = () => m.close();
  m.el.querySelector('[data-go]').onclick = async () => {
    const nf = m.el.querySelector('[data-new]').value.trim();
    const f = nf || m.el.querySelector('[data-f]').value;
    if (nf) saveFolders([...new Set([...storedFolders(), nf])]);
    const full = await getDesign(d.id);
    if (f) full.folder = f; else delete full.folder;
    await saveDesign(full);
    m.close();
    toast(f ? `ย้ายไปโฟลเดอร์ “${f}” แล้ว` : 'ย้ายออกจากโฟลเดอร์แล้ว', 'ok');
    renderHome();
  };
}
async function renderHome(filter = homeFilter) {
  homeFilter = filter;
  const designs = await listDesigns();
  const folders = folderList(designs);
  if (filter.startsWith('f:') && !folders.includes(filter.slice(2))) filter = homeFilter = 'all';
  const cur = filter.startsWith('f:') ? filter.slice(2) : null;
  app.innerHTML = '';
  const el = h(`
    <div class="home home2">
      <nav class="home-nav" aria-label="เมนูหลัก">
        <div class="brand"><span class="logo">ล</span><b>Lai Studio</b></div>
        <button class="hn on" data-nav="top">${icon('home', 22)}<span>หน้าหลัก</span></button>
        <button class="hn" data-nav="designs">${icon('folder', 22)}<span>ดีไซน์ของฉัน</span></button>
        <button class="hn" data-nav="templates">${icon('template', 22)}<span>เทมเพลต</span></button>
        <button class="hn" data-act="import">${icon('upload', 22)}<span>เปิดไฟล์</span></button>
      </nav>
      <main class="home-main">
      <header class="home-top">
        <h1 class="ht-title"><span class="logo sm">ล</span>หน้าหลัก</h1>
        <div class="grow"></div>
        <button class="btn hide-xs" data-act="import">${icon('folder', 18)} เปิดไฟล์โปรเจกต์</button>
        <button class="glow-btn" data-act="create">${icon('plus', 18)} สร้างงานออกแบบ</button>
        <input type="file" accept=".json,application/json" hidden data-file>
      </header>
      <section class="home-hero">
        <h2>วันนี้จะออกแบบอะไรดี?</h2>
        <label class="hero-search">${icon('search', 20)}<input data-tpl-q placeholder="ค้นหาเทมเพลต ${TEMPLATES.length} แบบ เช่น ใบงาน เมนู โปสเตอร์" aria-label="ค้นหาเทมเพลต"></label>
      </section>
      <section class="home-sec">
        <h2>เลือกว่าจะเริ่มดีไซน์ยังไง</h2>
        <div class="start-grid">${CATS.map((c, i) => `<button class="start" data-cat="${i}"><span class="start-ic ${c.light ? 'light' : ''}" style="background:${c.color}">${icon(c.ic, 34)}</span><span>${esc(c.label)}</span></button>`).join('')}</div>
      </section>
      <section class="home-sec">
        <div class="sec-head"><h2>ยอดนิยม</h2><button class="link" data-act="create">ดูขนาดทั้งหมด</button></div>
        <div class="hscroll preset-grid">
          ${PRESETS.map((p, i) => {
            const r = p.w / p.h;
            const bw = r >= 1 ? 64 : Math.round(64 * r);
            const bh = r >= 1 ? Math.round(64 / r) : 64;
            return `<button class="preset" data-preset="${i}"><div class="preset-shape"><div style="width:${bw}px;height:${bh}px">${p.icon}</div></div><b>${esc(p.name)}</b><small>${p.mm ? `${p.mm[0]}×${p.mm[1]} มม.` : `${p.w}×${p.h} px`}</small></button>`;
          }).join('')}
          <button class="preset" data-act="custom"><div class="preset-shape"><div style="width:56px;height:56px">✏️</div></div><b>กำหนดขนาดเอง</b><small>ระบุกว้าง × สูง</small></button>
        </div>
      </section>
      <section class="home-sec">
        <h2>ปุ่มลัด</h2>
        <div class="hscroll shortcut-row">${SHORTCUTS.map((t, i) => `<button class="shortcut" data-short="${i}"><span class="sc-ic" style="background:linear-gradient(135deg,${t.g[0]},${t.g[1]})">${icon(t.ic, 34)}</span><span>${esc(t.label)}</span></button>`).join('')}</div>
      </section>
      <section class="home-sec">
        <div class="sec-head"><h2>เทมเพลตที่คุณอาจชอบ</h2><button class="link" data-act="all-templates">ดูทั้งหมด</button></div>
        <div class="hscroll tpl-row">${PICKS.filter((i) => TEMPLATES[i]).map((i) => tplCard(i)).join('')}</div>
      </section>
      <section class="home-sec">
        <h2>เลือกดูหมวดหมู่เทมเพลต</h2>
        <div class="hscroll tcat-row">${TEMPLATE_CATEGORIES.slice(1).map((c, k) => { const first = TEMPLATES.findIndex((t) => t.cat === c); return `<button class="tcat" data-tcat="${esc(c)}"><span class="tcat-card" style="background:${CAT_TINT[k % CAT_TINT.length]}"><img data-tthumb="${first}:${tplPreset(TEMPLATES[first])}" alt=""></span><span>${esc(c)}</span><small>${TEMPLATES.filter((t) => t.cat === c).length} แบบ</small></button>`; }).join('')}</div>
      </section>
      <section class="home-sec my-designs">
        <div class="sec-head"><h2>งานออกแบบของฉัน <small>${designs.length ? `(${designs.length})` : ''}</small></h2>
        ${designs.length ? `<div class="row-gap"><div class="seg sm"><button class="on" data-filter="all">ทั้งหมด</button><button data-filter="star">★ ติดดาว (${designs.filter((d) => d.starred).length})</button></div><input class="input" data-search placeholder="ค้นหางานออกแบบ…" aria-label="ค้นหางานออกแบบ"></div>` : ''}</div>
        <div class="folder-bar">
          ${folders.map((f) => `<button class="chip" data-filter="f:${esc(f)}">📁 ${esc(f)} <small>${designs.filter((d) => d.folder === f).length}</small></button>`).join('')}
          <button class="chip add" data-act="new-folder">+ โฟลเดอร์ใหม่</button>
          ${cur ? `<span class="grow"></span><button class="btn sm" data-act="rename-folder">เปลี่ยนชื่อโฟลเดอร์</button><button class="btn sm" data-act="delete-folder">ลบโฟลเดอร์</button>` : ''}
        </div>
        ${designs.length ? `<div class="design-grid">${designs.map((d) => `
          <div class="design-card" data-name="${esc(d.name.toLowerCase())}" data-starred="${d.starred ? 1 : 0}" data-folder="${esc(d.folder || '')}">
            <button class="design-thumb" data-open="${d.id}" style="aspect-ratio:${d.width}/${d.height}">${d.thumb ? `<img src="${d.thumb}" alt="">` : ''}</button>
            <div class="design-meta">
              <div><b title="${esc(d.name)}">${esc(d.name)}</b><small>${d.width}×${d.height} · ${d.pages.length} หน้า · ${relTime(d.updatedAt)}</small></div>
              <button class="icon-btn sm star ${d.starred ? 'on' : ''}" data-star="${d.id}" title="${d.starred ? 'เลิกติดดาว' : 'ติดดาว'}" aria-pressed="${!!d.starred}">${d.starred ? '★' : '☆'}</button>
              <button class="icon-btn sm" data-menu="${d.id}" title="ตัวเลือก">${icon('more', 18)}</button>
            </div>
          </div>`).join('')}</div>` : `<div class="empty-state">ยังไม่มีงานออกแบบ เลือกขนาดด้านบนเพื่อเริ่มได้เลย ✨<br><small>งานทั้งหมดจะบันทึกอัตโนมัติไว้ในเบราว์เซอร์นี้</small></div>`}
      </section>
      <footer class="home-foot">Lai Studio · งานบันทึกไว้ในเบราว์เซอร์ของคุณ ใช้เมนู “บันทึกไฟล์โปรเจกต์” เพื่อสำรองหรือย้ายเครื่อง</footer>
      </main>
      <button class="fab" data-act="create" title="สร้างงานออกแบบ" aria-label="สร้างงานออกแบบ">${icon('plus', 30)}</button>
    </div>`);
  app.appendChild(el);
  lazyThumbs(el);
  const heroQ = el.querySelector('[data-tpl-q]');
  heroQ.addEventListener('keydown', (e) => { if (e.key === 'Enter') templateBrowser('ทั้งหมด', heroQ.value); });

  el.addEventListener('click', async (e) => {
    const st = e.target.closest('[data-star]');
    if (st) {
      const d = await getDesign(st.dataset.star);
      if (!d) return;
      d.starred = !d.starred;
      await saveDesign(d);
      return renderHome(filter);
    }
    const fb = e.target.closest('[data-filter]');
    if (fb) return renderHome(fb.dataset.filter);
    const cat = e.target.closest('[data-cat]');
    if (cat) {
      const c = CATS[+cat.dataset.cat];
      if (c.k === 'open') return el.querySelector('[data-file]').click();
      if (c.k === 'custom') return customSizeDialog();
      return categorySheet(c);
    }
    const sc = e.target.closest('[data-short]');
    if (sc) return SHORTCUTS[+sc.dataset.short].go();
    const tp = e.target.closest('[data-tpl]');
    if (tp) return fromPreset(+tp.dataset.tplSize, { tpl: +tp.dataset.tpl });
    const tc = e.target.closest('[data-tcat]');
    if (tc) return templateBrowser(tc.dataset.tcat);
    const nav = e.target.closest('[data-nav]');
    if (nav) {
      if (nav.dataset.nav === 'templates') return templateBrowser();
      el.querySelectorAll('.hn').forEach((b) => b.classList.toggle('on', b === nav));
      const target = nav.dataset.nav === 'designs' ? el.querySelector('.my-designs') : null;
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' }); else window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    const t = e.target.closest('[data-act],[data-preset],[data-open],[data-menu]');
    if (!t) return;
    if (t.dataset.preset !== undefined) {
      const p = PRESETS[+t.dataset.preset];
      return createAndOpen({ w: p.w, h: p.h, mm: p.mm, name: p.name });
    }
    if (t.dataset.open) return (location.hash = `#/d/${t.dataset.open}`);
    if (t.dataset.menu) return designMenu(t, t.dataset.menu);
    if (t.dataset.act === 'custom') return customSizeDialog();
    if (t.dataset.act === 'create') return createSheet();
    if (t.dataset.act === 'all-templates') return templateBrowser();
    if (t.dataset.act === 'new-folder') {
      const n = (await promptDialog('ชื่อโฟลเดอร์ใหม่', ''))?.trim();
      if (!n) return;
      saveFolders([...new Set([...storedFolders(), n])]);
      return renderHome('f:' + n);
    }
    if (t.dataset.act === 'rename-folder') {
      const n = (await promptDialog('เปลี่ยนชื่อโฟลเดอร์', cur))?.trim();
      if (!n || n === cur) return;
      for (const d of designs.filter((x) => x.folder === cur)) await saveDesign({ ...(await getDesign(d.id)), folder: n });
      saveFolders(storedFolders().map((f) => (f === cur ? n : f)));
      return renderHome('f:' + n);
    }
    if (t.dataset.act === 'delete-folder') {
      if (!(await confirmDialog(`ลบโฟลเดอร์ “${cur}”? (งานในโฟลเดอร์จะไม่ถูกลบ แค่ย้ายออกจากโฟลเดอร์)`, 'ลบโฟลเดอร์', true))) return;
      for (const d of designs.filter((x) => x.folder === cur)) { const full = await getDesign(d.id); delete full.folder; await saveDesign(full); }
      saveFolders(storedFolders().filter((f) => f !== cur));
      return renderHome('all');
    }
    if (t.dataset.act === 'import') return el.querySelector('[data-file]').click();
  });
  const search = el.querySelector('[data-search]');
  const applyFilter = () => {
    const q = search ? search.value.trim().toLowerCase() : '';
    el.querySelectorAll('.design-card').forEach((c) => { c.hidden = (!!q && !c.dataset.name.includes(q)) || (filter === 'star' && c.dataset.starred !== '1') || (cur !== null && c.dataset.folder !== cur); });
    el.querySelectorAll('[data-filter]').forEach((b) => b.classList.toggle('on', b.dataset.filter === filter));
  };
  if (search) search.addEventListener('input', applyFilter);
  applyFilter();
  el.querySelector('[data-file]').addEventListener('change', (e) => {
    const f = e.target.files[0];
    e.target.value = '';
    if (f) importProjectFile(f);
  });
}

function designMenu(anchor, id) {
  const pop = popover(anchor, `<div class="menu">
    <button data-m="open">เปิด</button>
    <button data-m="rename">เปลี่ยนชื่อ</button>
    <button data-m="dup">ทำสำเนา</button>
    <button data-m="move">📁 ย้ายไปโฟลเดอร์…</button>
    <hr><button data-m="del" class="danger-text">ลบ</button></div>`, { key: 'design-menu', align: 'right' });
  pop.onclick = async (e) => {
    const m = e.target.closest('[data-m]')?.dataset.m;
    if (!m) return;
    closePopover();
    const d = await getDesign(id);
    if (!d) return;
    if (m === 'open') location.hash = `#/d/${id}`;
    if (m === 'rename') {
      const n = await promptDialog('เปลี่ยนชื่องานออกแบบ', d.name);
      if (n && n.trim()) { d.name = n.trim(); await saveDesign(d); renderHome(); }
    }
    if (m === 'dup') { await duplicateDesign(id); toast('ทำสำเนาแล้ว', 'ok'); renderHome(); }
    if (m === 'move') moveToFolderDialog(d);
    if (m === 'del') {
      if (await confirmDialog(`ลบ “${d.name}” ถาวร?`, 'ลบ', true)) { await deleteDesign(id); await deleteVersionsOf(id); renderHome(); }
    }
  };
}

async function route() {
  closePopover();
  if (editor) {
    editor.destroy();
    editor = null;
  }
  const m = location.hash.match(/^#\/d\/([\w-]+)/);
  if (!m) {
    document.title = 'Lai Studio';
    return renderHome();
  }
  const d = await getDesign(m[1]);
  if (!d) {
    toast('ไม่พบงานออกแบบนี้', 'error');
    location.hash = '';
    return;
  }
  document.title = `${d.name} · Lai Studio`;
  app.innerHTML = '';
  editor = new Editor(app, d, {
    onExit: async (opts = {}) => {
      if (opts.importFile) return importProjectFile(opts.importFile);
      if (opts.duplicate) {
        const c = await duplicateDesign(opts.duplicate);
        toast('ทำสำเนาแล้ว – กำลังเปิดสำเนา', 'ok');
        location.hash = `#/d/${c.id}`;
        return;
      }
      location.hash = '';
    },
  });
  await editor.mount();
  window.__lai = editor; // handle for automated tests
  let pending = null;
  try { pending = JSON.parse(sessionStorage.getItem('lai-pending') || 'null'); sessionStorage.removeItem('lai-pending'); } catch { /* storage blocked */ }
  if (pending && pending.id === d.id) {
    try {
      if (pending.tpl !== undefined) await editor.applyTemplate(pending.tpl);
      if (pending.act) await editor.panelAction(pending.act);
      if (pending.panel) editor.openPanel(pending.panel);
    } catch (e) { console.error(e); }
  }
}

window.addEventListener('hashchange', route);
window.addEventListener('beforeunload', () => editor && editor.saveNow());
route();
