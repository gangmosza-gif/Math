import './style.css';
import { Editor, BLANK_PAGE } from './editor.js';
import { PRESETS } from './presets.js';
import { listDesigns, getDesign, saveDesign, deleteDesign, deleteVersionsOf, uid } from './storage.js';
import { icon } from './icons.js';
import { hostDownloadsReady } from './export.js';

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

async function createAndOpen(spec) {
  const d = newDesign(spec);
  await saveDesign(d);
  location.hash = `#/d/${d.id}`;
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
    <div class="home">
      <header class="home-top">
        <div class="brand"><span class="logo">ล</span><b>Lai Studio</b></div>
        <div class="grow"></div>
        <button class="btn" data-act="import">${icon('folder', 18)}<span class="hide-xs"> เปิดไฟล์โปรเจกต์</span></button>
        <button class="btn primary" data-act="custom">${icon('plus', 18)} สร้างงานออกแบบ</button>
        <input type="file" accept=".json,application/json" hidden data-file>
      </header>
      <section class="hero">
        <h1>วันนี้จะออกแบบอะไรดี?</h1>
        <p>ทำโพสต์ โปสเตอร์ ใบงาน เกียรติบัตร สไลด์ แล้วดาวน์โหลดเป็น PNG, JPG, PDF, SVG ได้เลย</p>
      </section>
      <section class="home-sec">
        <h2>เริ่มงานใหม่</h2>
        <div class="preset-grid">
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
    </div>`);
  app.appendChild(el);

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
    const t = e.target.closest('[data-act],[data-preset],[data-open],[data-menu]');
    if (!t) return;
    if (t.dataset.preset !== undefined) {
      const p = PRESETS[+t.dataset.preset];
      return createAndOpen({ w: p.w, h: p.h, mm: p.mm, name: p.name });
    }
    if (t.dataset.open) return (location.hash = `#/d/${t.dataset.open}`);
    if (t.dataset.menu) return designMenu(t, t.dataset.menu);
    if (t.dataset.act === 'custom') return customSizeDialog();
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
}

window.addEventListener('hashchange', route);
window.addEventListener('beforeunload', () => editor && editor.saveNow());
route();
