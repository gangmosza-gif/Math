// Extra editor features, mixed into Editor.prototype.
import { FabricImage, Path, Point, ActiveSelection, Group } from 'fabric';
import { icon } from './icons.js';
import { esc, toast, modal, popover, closePopover } from './ui.js';
import { FONTS, ensureFont } from './fonts.js';
import {
  buildMockup, defaultMockup,
  buildIcon,
  buildTable, buildChart, buildQR, buildEquation, latexToSVG, placeholderImage,
  defaultTable, defaultChart, defaultQR, defaultEquation, FRAMES, GRIDS, CHART_COLORS, CHART_TYPES, parseDelimited, rowsToSeries,
} from './smart.js';
import { pageToDataURL, pageLinks, safeURL } from './export.js';
import { fileToDataURL } from './imageutil.js';
import { saveUpload, uid, saveVersion, listVersions, deleteVersion } from './storage.js';

const isText = (o) => o && (o.type === 'textbox' || o.type === 'itext' || o.type === 'text');
const isImage = (o) => o && o.type === 'image';

const PALETTES = [
  CHART_COLORS,
  ['#0b3d91', '#1f6fd1', '#4f9df0', '#8cc4ff', '#c4e0ff', '#2a2f45'],
  ['#ff6b4a', '#ffb020', '#ffd84d', '#7bd389', '#2ec4b6', '#3d5a80'],
  ['#264653', '#2a9d8f', '#e9c46a', '#f4a261', '#e76f51', '#8d99ae'],
];

export const SMART_LABEL = { table: 'ตาราง', chart: 'กราฟ', qr: 'QR Code', equation: 'สมการ', icon: 'ไอคอน', mockup: 'ม็อกอัป' };

function brandColors() {
  try { return JSON.parse(localStorage.getItem('lai-brand-colors') || '[]'); } catch { return []; }
}
function setBrandColors(list) {
  try { localStorage.setItem('lai-brand-colors', JSON.stringify(list.slice(0, 24))); } catch { /* storage blocked */ }
}

export const features = {
  // ------------------------------------------------------------ smart elements
  async addSmart(kind) {
    const U = this.U;
    let obj;
    try {
      if (kind === 'table') { const d = defaultTable(U); await ensureFont(d.fontFamily); obj = buildTable(d); }
      else if (CHART_TYPES.some(([k]) => k === kind)) { const d = defaultChart(kind, U); await ensureFont(d.fontFamily); obj = buildChart(d); }
      else if (kind === 'qr') obj = buildQR(defaultQR(U));
      else if (kind.startsWith('mockup-')) obj = await buildMockup(defaultMockup(kind.slice(7), U, placeholderImage()));
      else if (kind.startsWith('icon-')) obj = await buildIcon({ type: 'icon', name: kind.slice(5), color: '#1f2333', weight: 1.8, size: Math.round(U * 0.2) });
      else if (kind === 'equation') { toast('กำลังเตรียมตัวเขียนสมการ…'); obj = await buildEquation(defaultEquation(U)); }
    } catch (e) {
      console.error(e);
      return toast('สร้างองค์ประกอบไม่สำเร็จ: ' + e.message, 'error');
    }
    if (!obj) return;
    this.addObject(obj);
    return obj;
  },

  /** Rebuild tables/charts whose data was edited outside the canvas (find & replace). */
  async rebuildDirtySmart() {
    const dirty = this.canvas.getObjects().filter((o) => o.smart && o.smart._dirty);
    if (!dirty.length) return;
    const page = this.design.pages[this.cur];
    const before = page.json;
    for (const o of dirty) {
      const d = { ...o.smart };
      delete d._dirty;
      await this.rebuildSmart(o, d, { silent: true });
    }
    this.canvas.discardActiveObject();
    page.json = this.serialize();
    // the rebuild is not a user edit: update history snapshots in place instead of adding an undo step
    for (const snap of this.history) for (const sp of snap.pages) if (sp.id === page.id && sp.json === before) sp.json = page.json;
  },

  async rebuildSmart(old, data, { silent = false } = {}) {
    let neu;
    if (data.type === 'table') { await ensureFont(data.fontFamily); neu = buildTable(data); }
    if (data.type === 'chart') { await ensureFont(data.fontFamily); neu = buildChart(data); }
    if (data.type === 'qr') neu = buildQR(data);
    if (data.type === 'icon') { data.size = old.getScaledWidth(); neu = await buildIcon(data); }
    if (data.type === 'mockup') { data.width = old.getScaledWidth(); neu = await buildMockup(data); }
    if (data.type === 'equation') {
      data.height = old.getScaledHeight();
      neu = await buildEquation(data);
    }
    if (!['equation', 'icon', 'mockup'].includes(data.type)) neu.set({ scaleX: old.scaleX, scaleY: old.scaleY });
    neu.set({ angle: old.angle, opacity: old.opacity, flipX: old.flipX, flipY: old.flipY, shadow: old.shadow, name: old.name || neu.name });
    const c = old.getCenterPoint();
    const idx = this.canvas.getObjects().indexOf(old);
    this.canvas.remove(old);
    this.canvas.insertAt(Math.max(0, idx), neu);
    neu.setPositionByOrigin(c, 'center', 'center');
    neu.setCoords();
    if (silent) return neu;
    this.canvas.setActiveObject(neu);
    this.canvas.requestRenderAll();
    this.commit();
    return neu;
  },

  openSmartEditor(obj) {
    obj = obj || this.canvas.getActiveObject();
    if (!obj || !obj.smart || obj.locked) return;
    const t = obj.smart.type;
    if (t === 'table') return this.openTableEditor(obj);
    if (t === 'chart') return this.openChartEditor(obj);
    if (t === 'qr') return this.openQREditor(obj);
    if (t === 'equation') return this.openEquationEditor(obj);
    if (t === 'mockup') return this.pickMockupImage(obj);
  },

  openTableEditor(obj) {
    const d = JSON.parse(JSON.stringify(obj.smart));
    const m = modal({ title: 'แก้ไขตาราง', wide: true, body: '<div data-tbl></div>' });
    const box = m.el.querySelector('[data-tbl]');
    const render = () => {
      const cols = Math.max(...d.rows.map((r) => r.length));
      box.innerHTML = `
        <div class="tbl-tools">
          <button class="btn sm" data-t="row+">${icon('plus', 16)} แถว</button>
          <button class="btn sm" data-t="row-">− แถว</button>
          <button class="btn sm" data-t="col+">${icon('plus', 16)} คอลัมน์</button>
          <button class="btn sm" data-t="col-">− คอลัมน์</button>
          <button class="btn sm" data-t="import">${icon('upload', 16)} นำเข้า CSV / วางจาก Excel</button>
        </div>
        <div class="import-box" data-import hidden>
          <textarea class="input full code" rows="4" data-paste placeholder="วางตารางที่คัดลอกจาก Excel / Google Sheets ที่นี่"></textarea>
          <div class="row-gap"><input type="file" accept=".csv,.tsv,.txt,text/csv" data-csv-file><button class="btn sm primary" data-t="import-go">ใช้ข้อมูลนี้</button></div>
        </div>
        <div class="tbl-wrap"><table class="tbl-edit">${d.rows.map((r, ri) => `<tr>${Array.from({ length: cols }, (_, ci) => `<td><input class="input" data-cell="${ri},${ci}" value="${esc(r[ci] ?? '')}" aria-label="แถว ${ri + 1} คอลัมน์ ${ci + 1}"></td>`).join('')}</tr>`).join('')}</table></div>
        <div class="opt-grid">
          <label class="toggle-row"><input type="checkbox" data-o="header" ${d.header ? 'checked' : ''}> แถวหัวตาราง</label>
          <label>สีหัวตาราง <input type="color" data-o="headerFill" value="${d.headerFill}"></label>
          <label>สีตัวอักษรหัว <input type="color" data-o="headerColor" value="${d.headerColor}"></label>
          <label>สีพื้น <input type="color" data-o="fill" value="${d.fill}"></label>
          <label>สีแถวสลับ <input type="color" data-o="stripe" value="${d.stripe || '#ffffff'}"></label>
          <label>สีเส้น <input type="color" data-o="border" value="${d.border}"></label>
          <label>สีตัวอักษร <input type="color" data-o="color" value="${d.color}"></label>
          <label>แบบอักษร <select class="select" data-o="fontFamily">${FONTS.map(([f]) => `<option ${f === d.fontFamily ? 'selected' : ''}>${f}</option>`).join('')}</select></label>
          <label>ขนาดตัวอักษร <input class="input" type="number" min="6" data-o="fontSize" value="${d.fontSize}"></label>
          <label>ความกว้างช่อง <input class="input" type="number" min="20" data-o="cellWidth" value="${d.cellWidth}"></label>
          <label>จัดข้อความ <select class="select" data-o="align"><option value="left" ${d.align === 'left' ? 'selected' : ''}>ซ้าย</option><option value="center" ${d.align === 'center' ? 'selected' : ''}>กลาง</option><option value="right" ${d.align === 'right' ? 'selected' : ''}>ขวา</option></select></label>
        </div>
        <div class="modal-actions"><button class="btn" data-no>ยกเลิก</button><button class="btn primary" data-go>ใช้การเปลี่ยนแปลง</button></div>`;
    };
    const read = () => {
      box.querySelectorAll('[data-cell]').forEach((i) => {
        const [r, c] = i.dataset.cell.split(',').map(Number);
        d.rows[r][c] = i.value;
      });
      box.querySelectorAll('[data-o]').forEach((i) => {
        d[i.dataset.o] = i.type === 'checkbox' ? i.checked : i.type === 'number' ? +i.value : i.value;
      });
    };
    render();
    box.addEventListener('click', async (e) => {
      const t = e.target.closest('[data-t]')?.dataset.t;
      if (t === 'import') { box.querySelector('[data-import]').hidden = !box.querySelector('[data-import]').hidden; return; }
      if (t === 'import-go') {
        const f = box.querySelector('[data-csv-file]').files[0];
        const rows = parseDelimited(f ? await f.text() : box.querySelector('[data-paste]').value);
        if (!rows.length) return toast('ไม่พบข้อมูลตาราง', 'error');
        const cols = Math.max(...rows.map((r) => r.length));
        read();
        d.rows = rows.slice(0, 200).map((r) => Array.from({ length: Math.min(cols, 30) }, (_, i) => r[i] ?? ''));
        toast(`นำเข้า ${d.rows.length} แถว × ${d.rows[0].length} คอลัมน์`, 'ok');
        return render();
      }
      if (t) {
        read();
        const cols = Math.max(...d.rows.map((r) => r.length));
        if (t === 'row+') d.rows.push(Array(cols).fill(''));
        if (t === 'row-' && d.rows.length > 1) d.rows.pop();
        if (t === 'col+') d.rows.forEach((r) => { while (r.length < cols) r.push(''); r.push(''); });
        if (t === 'col-' && cols > 1) d.rows.forEach((r) => r.splice(cols - 1, 1));
        render();
        return;
      }
      if (e.target.closest('[data-no]')) return m.close();
      if (e.target.closest('[data-go]')) {
        read();
        d.fontSize = Math.max(6, d.fontSize || 12);
        d.cellWidth = Math.max(20, d.cellWidth || 100);
        m.close();
        await this.rebuildSmart(obj, d);
      }
    });
  },

  openChartEditor(obj) {
    const d = JSON.parse(JSON.stringify(obj.smart));
    const m = modal({ title: 'แก้ไขกราฟ', wide: true, body: '<div data-ch></div>' });
    const box = m.el.querySelector('[data-ch]');
    const render = () => {
      box.innerHTML = `
        <div class="opt-grid">
          <label>ชนิดกราฟ <select class="select" data-o="chart">
            ${CHART_TYPES.map(([k, l]) => `<option value="${k}" ${d.chart === k ? 'selected' : ''}>${l}</option>`).join('')}
          </select></label>
          <label>ชื่อกราฟ <input class="input" data-o="title" value="${esc(d.title)}"></label>
          <label class="toggle-row"><input type="checkbox" data-o="showValues" ${d.showValues ? 'checked' : ''}> แสดงตัวเลข</label>
          <label>สีตัวอักษร <input type="color" data-o="color" value="${d.color}"></label>
        </div>
        <div class="cp-title">ชุดสี</div>
        <div class="pal-row">${PALETTES.map((p, i) => `<button class="pal" data-pal="${i}" title="ชุดสี ${i + 1}">${p.slice(0, 5).map((c) => `<i style="background:${c}"></i>`).join('')}</button>`).join('')}</div>
        <div class="cp-title">ข้อมูล</div>
        <div class="data-rows">${d.labels.map((l, i) => `
          <div class="data-row">
            <i class="dot" style="background:${d.colors[i % d.colors.length]}"></i>
            <input class="input" data-l="${i}" value="${esc(l)}" aria-label="ชื่อข้อมูล ${i + 1}">
            <input class="input" type="number" step="any" data-v="${i}" value="${d.values[i]}" aria-label="ค่า ${i + 1}">
            <button class="icon-btn sm" data-del="${i}" title="ลบแถว">${icon('trash', 16)}</button>
          </div>`).join('')}</div>
        <div class="row-gap"><button class="btn sm" data-add>${icon('plus', 16)} เพิ่มข้อมูล</button>
        <button class="btn sm" data-import-toggle>${icon('upload', 16)} นำเข้าจาก CSV / Excel</button></div>
        <div class="import-box" data-import hidden>
          <p class="hint">วางข้อมูลที่คัดลอกจาก Excel / Google Sheets (คอลัมน์แรก = ชื่อ, คอลัมน์สอง = ตัวเลข) หรือเลือกไฟล์ .csv</p>
          <textarea class="input full code" rows="4" data-paste placeholder="ม.ค.	12&#10;ก.พ.	19"></textarea>
          <div class="row-gap"><input type="file" accept=".csv,.tsv,.txt,text/csv" data-csv-file><button class="btn sm primary" data-import-go>ใช้ข้อมูลนี้</button></div>
        </div>
        <div class="modal-actions"><button class="btn" data-no>ยกเลิก</button><button class="btn primary" data-go>ใช้การเปลี่ยนแปลง</button></div>`;
    };
    const read = () => {
      box.querySelectorAll('[data-l]').forEach((i) => { d.labels[+i.dataset.l] = i.value; });
      box.querySelectorAll('[data-v]').forEach((i) => { d.values[+i.dataset.v] = +i.value || 0; });
      box.querySelectorAll('[data-o]').forEach((i) => { d[i.dataset.o] = i.type === 'checkbox' ? i.checked : i.value; });
    };
    render();
    box.addEventListener('click', async (e) => {
      const t = e.target;
      if (t.closest('[data-pal]')) { read(); d.colors = PALETTES[+t.closest('[data-pal]').dataset.pal]; return render(); }
      if (t.closest('[data-add]')) { read(); d.labels.push(`ข้อมูล ${d.labels.length + 1}`); d.values.push(10); return render(); }
      if (t.closest('[data-import-toggle]')) { box.querySelector('[data-import]').hidden = !box.querySelector('[data-import]').hidden; return; }
      if (t.closest('[data-import-go]')) {
        read();
        const f = box.querySelector('[data-csv-file]').files[0];
        const text = f ? await f.text() : box.querySelector('[data-paste]').value;
        const { labels, values } = rowsToSeries(parseDelimited(text));
        if (!labels.length) return toast('ไม่พบข้อมูลที่ใช้ได้ (ต้องมีคอลัมน์ชื่อ และคอลัมน์ตัวเลข)', 'error');
        d.labels = labels; d.values = values;
        toast(`นำเข้า ${labels.length} แถวแล้ว`, 'ok');
        return render();
      }
      if (t.closest('[data-del]')) {
        read();
        if (d.labels.length <= 1) return toast('กราฟต้องมีข้อมูลอย่างน้อย 1 แถว', 'error');
        const i = +t.closest('[data-del]').dataset.del;
        d.labels.splice(i, 1); d.values.splice(i, 1);
        return render();
      }
      if (t.closest('[data-no]')) return m.close();
      if (t.closest('[data-go]')) { read(); m.close(); await this.rebuildSmart(obj, d); }
    });
  },

  openQREditor(obj) {
    const d = { ...obj.smart };
    const m = modal({
      title: 'แก้ไข QR Code',
      body: `
        <label class="field">ลิงก์ หรือข้อความ <input class="input full" data-text value="${esc(d.text)}" placeholder="https://..."></label>
        <div class="opt-grid">
          <label>สี QR <input type="color" data-color value="${d.color}"></label>
          <label>สีพื้น <input type="color" data-bg value="${d.bg || '#ffffff'}"></label>
          <label class="toggle-row"><input type="checkbox" data-nobg ${d.bg ? '' : 'checked'}> พื้นโปร่งใส</label>
        </div>
        <p class="hint">สแกนทดสอบด้วยมือถือทุกครั้งก่อนพิมพ์ สีเข้มบนพื้นสว่างจะสแกนง่ายที่สุด</p>
        <div class="modal-actions"><button class="btn" data-no>ยกเลิก</button><button class="btn primary" data-go>สร้าง QR Code</button></div>`,
    });
    const el = m.el;
    el.querySelector('[data-text]').focus();
    el.querySelector('[data-no]').onclick = () => m.close();
    el.querySelector('[data-go]').onclick = async () => {
      d.text = el.querySelector('[data-text]').value.trim();
      if (!d.text) return toast('ใส่ลิงก์หรือข้อความก่อน', 'error');
      d.color = el.querySelector('[data-color]').value;
      d.bg = el.querySelector('[data-nobg]').checked ? '' : el.querySelector('[data-bg]').value;
      m.close();
      try { await this.rebuildSmart(obj, d); } catch (e) { toast('ข้อความยาวเกินไปสำหรับ QR Code', 'error'); }
    };
  },

  openEquationEditor(obj) {
    const d = { ...obj.smart };
    const snippets = [
      ['\\frac{a}{b}', 'เศษส่วน'], ['x^{2}', 'ยกกำลัง'], ['x_{1}', 'ตัวห้อย'], ['\\sqrt{x}', 'รากที่สอง'], ['\\sqrt[3]{x}', 'รากที่สาม'],
      ['\\times', '×'], ['\\div', '÷'], ['\\pm', '±'], ['\\neq', '≠'], ['\\leq', '≤'], ['\\geq', '≥'], ['\\approx', '≈'],
      ['\\pi', 'π'], ['\\theta', 'θ'], ['\\infty', '∞'], ['\\sum_{i=1}^{n}', 'ผลรวม'], ['\\int_{a}^{b}', 'อินทิกรัล'],
      ['\\angle', '∠'], ['^{\\circ}', 'องศา'], ['\\triangle', '△'], ['\\begin{bmatrix} a & b \\\\ c & d \\end{bmatrix}', 'เมทริกซ์'],
    ];
    const m = modal({
      title: 'สมการคณิตศาสตร์',
      wide: true,
      body: `
        <div class="snip">${snippets.map(([s, l]) => `<button class="btn sm" data-s="${esc(s)}" title="${esc(s)}">${esc(l)}</button>`).join('')}</div>
        <label class="field">เขียนสมการแบบ LaTeX <textarea class="input full code" rows="3" data-latex spellcheck="false">${esc(d.latex)}</textarea></label>
        <div class="eq-preview" data-prev></div>
        <p class="hint">ตัวอย่าง: <code>\\frac{1}{2} + \\frac{1}{3} = \\frac{5}{6}</code> · <code>a^2 + b^2 = c^2</code> · <code>3 \\times 4 = 12</code></p>
        <div class="opt-grid"><label>สี <input type="color" data-color value="${d.color}"></label></div>
        <div class="modal-actions"><button class="btn" data-no>ยกเลิก</button><button class="btn primary" data-go>ใช้สมการ</button></div>`,
    });
    const el = m.el;
    const ta = el.querySelector('[data-latex]');
    const prev = el.querySelector('[data-prev]');
    let timer;
    const preview = () => {
      clearTimeout(timer);
      timer = setTimeout(async () => {
        try {
          prev.innerHTML = await latexToSVG(ta.value, el.querySelector('[data-color]').value);
          prev.classList.remove('err');
        } catch (e) {
          prev.textContent = '⚠️ ' + e.message;
          prev.classList.add('err');
        }
      }, 250);
    };
    preview();
    ta.addEventListener('input', preview);
    el.querySelector('[data-color]').addEventListener('input', preview);
    el.querySelector('.snip').addEventListener('click', (e) => {
      const s = e.target.closest('[data-s]')?.dataset.s;
      if (!s) return;
      const a = ta.selectionStart, b = ta.selectionEnd;
      ta.value = ta.value.slice(0, a) + s + ta.value.slice(b);
      ta.focus();
      ta.selectionStart = ta.selectionEnd = a + s.length;
      preview();
    });
    el.querySelector('[data-no]').onclick = () => m.close();
    el.querySelector('[data-go]').onclick = async () => {
      d.latex = ta.value.trim();
      d.color = el.querySelector('[data-color]').value;
      try {
        await latexToSVG(d.latex);
      } catch (e) {
        return toast('สมการยังไม่ถูกต้อง: ' + e.message, 'error', 4000);
      }
      m.close();
      await this.rebuildSmart(obj, d);
    };
  },

  // ------------------------------------------------------------ frames, grids, replace image
  async addFrame(i) {
    const [label, mask, ratio] = FRAMES[i];
    const img = await FabricImage.fromURL(placeholderImage());
    const s = this.U * 0.4;
    const w = ratio >= 1 ? s : s * ratio, h = ratio >= 1 ? s / ratio : s;
    this.coverCrop(img, w, h);
    img.set({ name: 'กรอบรูป ' + label, placeholder: true });
    this.applyMask(img, mask);
    this.addObject(img);
    return img;
  },

  async addGrid(i) {
    const [, cells] = GRIDS[i];
    const gap = this.U * 0.015;
    const url = placeholderImage();
    const imgs = [];
    for (const [x, y, w, h] of cells) {
      const img = await FabricImage.fromURL(url);
      const bw = w * this.W - gap, bh = h * this.H - gap;
      this.coverCrop(img, bw, bh);
      img.set({ left: x * this.W + gap / 2, top: y * this.H + gap / 2, name: 'ช่องรูป', placeholder: true });
      img.setCoords();
      this.canvas.add(img);
      imgs.push(img);
    }
    this.canvas.setActiveObject(new ActiveSelection(imgs, { canvas: this.canvas }));
    this.canvas.requestRenderAll();
    this.commit();
    toast('คลิกช่องรูปแล้วกด “แทนที่รูป” หรือลากรูปมาวางบนช่อง');
    if (window.innerWidth < 760) this.openPanel(null);
  },

  /** Scale + center-crop an image so it exactly covers a w×h box. */
  coverCrop(img, w, h) {
    const { width: nw, height: nh } = img.getOriginalSize();
    const s = Math.max(w / nw, h / nh);
    const cw = w / s, ch = h / s;
    const cropX = (nw - cw) / 2, cropY = (nh - ch) / 2;
    img.set({ cropX, cropY, width: cw, height: ch, scaleX: s, scaleY: s });
    img.crop = { l: (cropX / nw) * 100, r: (cropX / nw) * 100, t: (cropY / nh) * 100, b: (cropY / nh) * 100 };
  },

  async replaceImage(old, url) {
    try {
      const img = await FabricImage.fromURL(url, { crossOrigin: 'anonymous' });
      // target box = the old picture without its border; keep the border's visual thickness
      this.coverCrop(img, old.width * old.scaleX, old.height * old.scaleY);
      const sw = old.strokeWidth ? (old.strokeWidth * old.scaleX) / img.scaleX : 0;
      img.set({ angle: old.angle, flipX: old.flipX, flipY: old.flipY, opacity: old.opacity, shadow: old.shadow, stroke: old.stroke, strokeWidth: sw, name: old.placeholder ? 'รูปภาพ' : old.name });
      this.applyMask(img, old.mask);
      const c = old.getCenterPoint();
      const idx = this.canvas.getObjects().indexOf(old);
      this.canvas.remove(old);
      this.canvas.insertAt(idx, img);
      img.setPositionByOrigin(c, 'center', 'center');
      img.setCoords();
      this.canvas.setActiveObject(img);
      this.canvas.requestRenderAll();
      this.commit();
      return img;
    } catch (e) {
      console.error(e);
      toast('แทนที่รูปไม่สำเร็จ', 'error');
    }
  },

  pickReplaceImage() {
    const a = this.canvas.getActiveObject();
    if (!isImage(a)) return;
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = 'image/*';
    inp.onchange = async () => {
      const f = inp.files[0];
      if (!f) return;
      const { url } = await fileToDataURL(f);
      await saveUpload({ id: uid(), url, name: f.name, createdAt: Date.now() });
      await this.replaceImage(a, url);
    };
    inp.click();
  },

  imageAt(pt) {
    return this.canvas.getObjects().slice().reverse().find((o) => isImage(o) && o.visible && !o.locked && o.containsPoint(pt));
  },

  // ------------------------------------------------------------ text extras
  setCurve(t, v) {
    v = Math.max(-100, Math.min(100, Math.round(v)));
    t.curve = v;
    t.set('path', null);
    t.initDimensions();
    if (v) {
      const lines = t._textLines.map((_, i) => t.getLineWidth(i));
      const L = Math.max(10, ...lines);
      const theta = (Math.abs(v) / 100) * Math.PI * 1.9;
      const R = L / theta;
      const sx = R * Math.sin(theta / 2);
      const large = theta > Math.PI ? 1 : 0;
      const d = v > 0
        ? `M ${-sx} ${R - R * Math.cos(theta / 2)} A ${R} ${R} 0 ${large} 1 ${sx} ${R - R * Math.cos(theta / 2)}`
        : `M ${-sx} ${-R + R * Math.cos(theta / 2)} A ${R} ${R} 0 ${large} 0 ${sx} ${-R + R * Math.cos(theta / 2)}`;
      t.set({ path: new Path(d, { fill: '', stroke: '', strokeWidth: 0 }), pathAlign: 'center', pathSide: 'left', pathStartOffset: 0 });
      t.initDimensions();
    }
    t.setCoords();
    t.set('dirty', true);
    this.canvas.requestRenderAll();
  },

  toggleList() {
    const t = this.canvas.getActiveObject();
    if (!isText(t)) return;
    const order = [null, 'bullet', 'number', 'check'];
    const next = order[(order.indexOf(t.listType || null) + 1) % order.length];
    const lines = t.text.split('\n').map((l) => l.replace(/^(•\s|\d+\.\s|[☐☑]\s)/, ''));
    const prefix = (i) => (next === 'bullet' ? '• ' : next === 'number' ? `${i + 1}. ` : next === 'check' ? '☐ ' : '');
    t.set('text', lines.map((l, i) => prefix(i) + l).join('\n'));
    t.listType = next;
    if (next && t.textAlign === 'center') t.set('textAlign', 'left');
    t.initDimensions();
    t.setCoords();
    this.canvas.requestRenderAll();
    this.commit();
  },

  // ------------------------------------------------------------ distribute & copy style
  distribute(axis) {
    const a = this.canvas.getActiveObject();
    if (!a || a.type !== 'activeselection') return;
    const objs = a.getObjects();
    if (objs.length < 3) return toast('เลือกอย่างน้อย 3 ชิ้นเพื่อเว้นระยะเท่ากัน');
    this.canvas.discardActiveObject();
    const boxes = objs.map((o) => { o.setCoords(); return { o, b: o.getBoundingRect() }; });
    const k = axis === 'h' ? 'left' : 'top', s = axis === 'h' ? 'width' : 'height';
    boxes.sort((p, q) => p.b[k] - q.b[k]);
    const first = boxes[0].b, last = boxes[boxes.length - 1].b;
    const span = last[k] + last[s] - first[k];
    const total = boxes.reduce((n, x) => n + x.b[s], 0);
    const gap = (span - total) / (boxes.length - 1);
    let pos = first[k];
    for (const { o, b } of boxes) {
      o.set(k, o[k] + (pos - b[k]));
      o.setCoords();
      pos += b[s] + gap;
    }
    this.canvas.setActiveObject(new ActiveSelection(objs, { canvas: this.canvas }));
    this.canvas.requestRenderAll();
    this.commit();
  },

  copyStyle() {
    const a = this.canvas.getActiveObject();
    if (!a || a.type === 'activeselection') return;
    const props = ['fill', 'stroke', 'strokeWidth', 'strokeDashArray', 'opacity', 'shadow', 'fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'underline', 'linethrough', 'charSpacing', 'lineHeight', 'textAlign', 'textBackgroundColor', 'paintFirst', 'rx', 'ry'];
    const style = {};
    for (const p of props) if (a[p] !== undefined) style[p] = p === 'shadow' && a.shadow ? a.shadow.toObject() : a[p] && a[p].toObject ? a[p].toObject() : a[p];
    style._text = isText(a);
    style._adj = isImage(a) ? a.adj : null;
    this._style = style;
    this.$('[data-ws]').classList.add('paint');
    toast('คัดลอกสไตล์แล้ว คลิกวัตถุที่ต้องการวางสไตล์ (กด Esc เพื่อยกเลิก)');
  },

  async maybePasteStyle() {
    const st = this._style;
    if (!st) return false;
    const targets = this.canvas.getActiveObjects();
    if (!targets.length) return false;
    this._style = null;
    this.$('[data-ws]').classList.remove('paint');
    const { Shadow, Gradient } = await import('fabric');
    const textOnly = ['fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'underline', 'linethrough', 'charSpacing', 'lineHeight', 'textAlign', 'textBackgroundColor', 'paintFirst'];
    for (const o of targets) {
      if (o.locked) continue;
      for (const [k, v] of Object.entries(st)) {
        if (k.startsWith('_')) continue;
        if (textOnly.includes(k) && !isText(o)) continue;
        if ((k === 'rx' || k === 'ry') && o.type !== 'rect') continue;
        if (k === 'fill' && isImage(o)) continue;
        if (k === 'shadow') o.set('shadow', v ? new Shadow(v) : null);
        else if (v && typeof v === 'object' && v.colorStops) o.set(k, new Gradient(v));
        else o.set(k, v);
      }
      if (isText(o)) { if (o.fontFamily) ensureFont(o.fontFamily).then(() => this.refreshTexts()); o.initDimensions(); }
      o.setCoords();
      o.set('dirty', true);
    }
    this.canvas.requestRenderAll();
    this.commit();
    toast('วางสไตล์แล้ว', 'ok');
    return true;
  },

  // ------------------------------------------------------------ view: margins
  toggleMargins() {
    this.showMargins = !this.showMargins;
    this.canvas.requestRenderAll();
    toast(this.showMargins ? 'แสดงระยะขอบปลอดภัยแล้ว' : 'ซ่อนระยะขอบแล้ว');
  },

  drawMargins(ctx) {
    if (!this.showMargins) return;
    const v = this.canvas.viewportTransform;
    const m = Math.min(this.W, this.H) * 0.05;
    ctx.save();
    ctx.transform(v[0], v[1], v[2], v[3], v[4], v[5]);
    ctx.strokeStyle = '#18b7d6';
    ctx.lineWidth = 1.2 / this.zoom;
    ctx.setLineDash([6 / this.zoom, 4 / this.zoom]);
    ctx.strokeRect(m, m, this.W - 2 * m, this.H - 2 * m);
    ctx.setLineDash([]);
    ctx.globalAlpha = 0.35;
    ctx.beginPath();
    ctx.moveTo(this.W / 2, 0); ctx.lineTo(this.W / 2, this.H);
    ctx.moveTo(0, this.H / 2); ctx.lineTo(this.W, this.H / 2);
    ctx.stroke();
    ctx.restore();
  },

  // ------------------------------------------------------------ present
  async present(start = this.cur) {
    this.flushText();
    this.design.pages[this.cur].json = this.serialize();
    const ov = document.createElement('div');
    ov.className = 'present';
    ov.innerHTML = `<div class="present-main"><div class="present-stage"><img alt="" data-img><div class="present-loading">กำลังเตรียมสไลด์…</div></div>
        <aside class="present-notes" data-notes hidden>
          <div class="pn-head"><b data-ptitle></b><span class="pn-timer" data-timer>00:00</span></div>
          <div class="pn-notes" data-pnotes></div>
          <div class="pn-next"><small>สไลด์ถัดไป</small><img alt="" data-next></div>
        </aside></div>
      <div class="present-bar"><button class="icon-btn" data-p="prev" title="ก่อนหน้า (←)">${icon('left')}</button><span data-n></span><button class="icon-btn" data-p="next" title="ถัดไป (→)">${icon('right')}</button>
        <button class="tb-btn" data-p="notes" title="มุมมองผู้นำเสนอ: โน้ต เวลา สไลด์ถัดไป (N)">📝 โน้ต</button>
        <button class="tb-btn" data-p="auto" title="เล่นอัตโนมัติทุก 5 วินาที (A)">⏯ อัตโนมัติ</button>
        <button class="icon-btn" data-p="exit" title="ออก (Esc)">${icon('close')}</button></div>`;
    const order = this.visiblePageIndexes();
    if (!order.length) return toast('ทุกหน้าถูกซ่อนอยู่ ไม่มีหน้าให้นำเสนอ', 'error');
    document.body.appendChild(ov);
    try { await ov.requestFullscreen?.(); } catch { /* not allowed */ }
    const n = order.length;
    let pos = order.findIndex((x) => x >= start);
    if (pos < 0) pos = 0;
    const mult = Math.min(3, (Math.max(window.screen.width, window.innerWidth) * (window.devicePixelRatio || 1)) / this.W);
    const cache = new Map();
    let i = order[pos];
    const img = ov.querySelector('[data-img]');
    const show = async () => {
      ov.querySelector('[data-n]').textContent = `${pos + 1} / ${n}`;
      const pg = this.design.pages[i];
      ov.querySelector('[data-ptitle]').textContent = `หน้า ${i + 1}${pg.title ? ' · ' + pg.title : ''}`;
      ov.querySelector('[data-pnotes]').textContent = pg.notes || 'ไม่มีโน้ตสำหรับหน้านี้';
      const nxImg = ov.querySelector('[data-next]');
      const nxi = order[pos + 1];
      nxImg.hidden = nxi === undefined;
      if (nxi !== undefined) {
        if (!cache.has(nxi)) cache.set(nxi, pageToDataURL(this.design, this.design.pages[nxi].json, { format: 'jpeg', multiplier: mult, quality: 0.92 }));
        cache.get(nxi).then((u) => { if (order[pos + 1] === nxi) nxImg.src = u; });
      }
      if (!cache.has(i)) cache.set(i, pageToDataURL(this.design, this.design.pages[i].json, { format: 'jpeg', multiplier: mult, quality: 0.92 }));
      const want = i;
      const url = await cache.get(i);
      if (want !== i) return;
      img.src = url;
      img.alt = this.pageDescription(i);
      ov.querySelector('.present-loading')?.remove();
      ov.querySelectorAll('.present-link').forEach((x) => x.remove());
      const links = await pageLinks(this.design, this.design.pages[i].json);
      if (want !== i) return;
      const stage = ov.querySelector('.present-stage');
      const place = () => {
        const r = img.getBoundingClientRect(), sr = stage.getBoundingClientRect(), f = r.width / this.W;
        stage.querySelectorAll('.present-link').forEach((x, n) => {
          const l = links[n];
          Object.assign(x.style, { left: r.left - sr.left + l.left * f + 'px', top: r.top - sr.top + l.top * f + 'px', width: l.width * f + 'px', height: l.height * f + 'px' });
        });
      };
      links.forEach((l) => { const aEl = document.createElement('a'); aEl.className = 'present-link'; aEl.href = l.url; aEl.target = '_blank'; aEl.rel = 'noopener'; aEl.title = l.url; aEl.addEventListener('click', (e) => e.stopPropagation()); stage.appendChild(aEl); });
      if (img.complete) place(); else img.onload = place;
      const nx = order[pos + 1];
      if (nx !== undefined && !cache.has(nx)) cache.set(nx, pageToDataURL(this.design, this.design.pages[nx].json, { format: 'jpeg', multiplier: mult, quality: 0.92 }));
    };
    const go = (d) => { const q = Math.max(0, Math.min(n - 1, pos + d)); if (q !== pos) { pos = q; i = order[pos]; show(); } };
    const t0 = Date.now();
    const timer = setInterval(() => {
      const sec = Math.floor((Date.now() - t0) / 1000);
      ov.querySelector('[data-timer]').textContent = `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;
    }, 500);
    let auto = null;
    const toggleAuto = () => {
      if (auto) { clearInterval(auto); auto = null; }
      else auto = setInterval(() => { if (pos < n - 1) go(1); else { clearInterval(auto); auto = null; ov.querySelector('[data-p="auto"]').classList.remove('on'); } }, this.autoplayMs || 5000);
      ov.querySelector('[data-p="auto"]').classList.toggle('on', !!auto);
    };
    const toggleNotes = () => { const nb = ov.querySelector('[data-notes]'); nb.hidden = !nb.hidden; ov.querySelector('[data-p="notes"]').classList.toggle('on', !nb.hidden); };
    const close = () => {
      clearInterval(timer);
      if (auto) clearInterval(auto);
      document.removeEventListener('keydown', key, true);
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
      ov.remove();
    };
    const key = (e) => {
      e.stopPropagation();
      if (['ArrowRight', 'ArrowDown', ' ', 'PageDown', 'Enter'].includes(e.key)) { e.preventDefault(); go(1); }
      if (['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace'].includes(e.key)) { e.preventDefault(); go(-1); }
      if (e.key === 'Escape') close();
      if (e.key === 'n' || e.key === 'N') toggleNotes();
      if (e.key === 'a' || e.key === 'A') toggleAuto();
    };
    document.addEventListener('keydown', key, true);
    ov.addEventListener('click', (e) => {
      const p = e.target.closest('[data-p]')?.dataset.p;
      if (p === 'prev') go(-1);
      else if (p === 'next') go(1);
      else if (p === 'exit') close();
      else if (p === 'notes') toggleNotes();
      else if (p === 'auto') toggleAuto();
      else if (e.target.closest('.present-stage')) go(1);
    });
    show();
    this._presentOverlay = ov;
  },

  // ------------------------------------------------------------ brand colors
  brandColors,
  addBrandColor(c) {
    const list = brandColors().filter((x) => x !== c);
    list.unshift(c);
    setBrandColors(list);
  },
  clearBrandColors() { setBrandColors([]); },

  // ------------------------------------------------------------ drag from side panel
  bindPanelDrag() {
    const body = this.$('[data-panel-body]');
    body.addEventListener('dragstart', (e) => {
      const el = e.target.closest('[data-act]');
      if (!el || !el.draggable) return;
      e.dataTransfer.setData('application/x-lai-act', el.dataset.act);
      e.dataTransfer.effectAllowed = 'copy';
    });
  },

  markDraggable(root) {
    root.querySelectorAll('[data-act]').forEach((el) => {
      if (/^(shape|line|sticker|text|combo|up-add|photo|smart|frame):/.test(el.dataset.act)) {
        el.draggable = true;
        el.querySelectorAll('img').forEach((i) => { i.draggable = false; });
      }
    });
  },

  async dropAct(act, e) {
    const pt = this.canvas.getScenePoint(e);
    const before = new Set(this.canvas.getObjects());
    await this.panelAction(act);
    const o = this.canvas.getActiveObject();
    if (o && !before.has(o)) {
      o.setPositionByOrigin(new Point(pt.x, pt.y), 'center', 'center');
      o.setCoords();
      this.canvas.requestRenderAll();
      this.commit();
    }
  },
};

/** Tick / untick the checklist line under the text cursor (or all lines when not editing). */
features.toggleCheck = function () {
  const t = this.canvas.getActiveObject();
  if (!isText(t) || t.listType !== 'check') return;
  const lines = t.text.split('\n');
  let target = null;
  if (t.isEditing) target = t.get2DCursorLocation(t.selectionStart).lineIndex;
  const flip = (l) => (l.startsWith('☐ ') ? '☑ ' + l.slice(2) : l.startsWith('☑ ') ? '☐ ' + l.slice(2) : l);
  const allDone = lines.every((l) => l.startsWith('☑ '));
  const out = lines.map((l, i) => (target === null ? (allDone ? l.replace(/^☑ /, '☐ ') : l.replace(/^☐ /, '☑ ')) : i === target ? flip(l) : l));
  t.set('text', out.join('\n'));
  t.initDimensions();
  this.canvas.requestRenderAll();
  this.commit();
};

features.openLinkPopover = function (btn) {
  const a = this.canvas.getActiveObject();
  if (!a) return;
  const el = popover(btn, `<div class="pad">
    <div class="cp-title">ลิงก์ (คลิกได้ในไฟล์ PDF และโหมดนำเสนอ)</div>
    <input class="input full" data-url placeholder="https://… หรืออีเมล" value="${esc(a.link || '')}" aria-label="ที่อยู่ลิงก์">
    <div class="row-gap"><button class="btn sm primary" data-save>บันทึกลิงก์</button>${a.link ? '<button class="btn sm" data-remove>ลบลิงก์</button>' : ''}</div>
  </div>`, { key: 'link', align: 'right' });
  const inp = el.querySelector('[data-url]');
  inp.focus();
  const save = () => {
    const u = safeURL(inp.value);
    a.link = u || undefined;
    closePopover();
    this.commit();
    toast(u ? 'ใส่ลิงก์แล้ว' : 'ลบลิงก์แล้ว');
  };
  inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') save(); });
  el.querySelector('[data-save]').onclick = save;
  const rm = el.querySelector('[data-remove]');
  if (rm) rm.onclick = () => { inp.value = ''; save(); };
};

// ------------------------------------------------------------ pages: hide, notes, grid view
features.visiblePageIndexes = function () {
  return this.design.pages.map((p, i) => (p.hidden ? -1 : i)).filter((i) => i >= 0);
};

features.togglePageHidden = function () {
  const p = this.design.pages[this.cur];
  p.hidden = !p.hidden;
  if (!p.hidden) delete p.hidden;
  this.pushHistory();
  this.scheduleSave();
  this.renderPages();
  toast(p.hidden ? 'ซ่อนหน้านี้แล้ว (จะไม่ถูกนำเสนอและดาวน์โหลด)' : 'แสดงหน้านี้แล้ว');
};

features.openPageNotes = function () {
  const p = this.design.pages[this.cur];
  const m = modal({
    title: `หน้า ${this.cur + 1}: ชื่อหน้าและโน้ต`,
    body: `
      <label class="field">ชื่อหน้า <input class="input full" data-title value="${esc(p.title || '')}" placeholder="เช่น บทนำ"></label>
      <label class="field">โน้ตผู้นำเสนอ (แสดงเฉพาะในมุมมองผู้นำเสนอ) <textarea class="input full" rows="6" data-notes placeholder="สิ่งที่จะพูดในหน้านี้…">${esc(p.notes || '')}</textarea></label>
      <div class="modal-actions"><button class="btn" data-no>ยกเลิก</button><button class="btn primary" data-go>บันทึก</button></div>`,
  });
  m.el.querySelector('[data-no]').onclick = () => m.close();
  m.el.querySelector('[data-go]').onclick = () => {
    const t = m.el.querySelector('[data-title]').value.trim();
    const n = m.el.querySelector('[data-notes]').value.trim();
    if (t) p.title = t; else delete p.title;
    if (n) p.notes = n; else delete p.notes;
    m.close();
    this.pushHistory();
    this.scheduleSave();
    this.renderPages();
    toast('บันทึกโน้ตแล้ว', 'ok');
  };
};

features.openPageGrid = function () {
  this.flushText();
  this.design.pages[this.cur].json = this.serialize();
  const ratio = this.W / this.H;
  const m = modal({ title: 'ทุกหน้า (ลากเพื่อจัดลำดับ คลิกเพื่อไปหน้านั้น)', wide: true, body: '<div class="page-grid" data-grid></div>' });
  const grid = m.el.querySelector('[data-grid]');
  const render = () => {
    grid.innerHTML = this.design.pages.map((p, i) => `
      <div class="pg-card ${i === this.cur ? 'active' : ''} ${p.hidden ? 'is-hidden' : ''}" draggable="true" data-i="${i}">
        <button class="pg-img" data-go="${i}" style="aspect-ratio:${ratio}">${this.thumbs.get(p.id) ? `<img src="${this.thumbs.get(p.id)}" alt="">` : ''}</button>
        <div class="pg-meta"><b>${i + 1}</b> ${esc(p.title || '')} ${p.hidden ? '<small>ซ่อนอยู่</small>' : ''}</div>
      </div>`).join('');
  };
  render();
  let from = null;
  grid.addEventListener('dragstart', (e) => { from = +e.target.closest('[data-i]').dataset.i; e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', String(from)); });
  grid.addEventListener('dragover', (e) => { if (e.target.closest('[data-i]')) e.preventDefault(); });
  grid.addEventListener('drop', (e) => {
    const card = e.target.closest('[data-i]');
    if (!card) return;
    e.preventDefault();
    const src = from ?? +e.dataTransfer.getData('text/plain');
    const to = +card.dataset.i;
    if (src === to || isNaN(src)) return;
    this.movePageTo(src, to);
    render();
  });
  grid.addEventListener('click', (e) => {
    const g = e.target.closest('[data-go]');
    if (!g) return;
    m.close();
    this.gotoPage(+g.dataset.go);
  });
};

features.movePageTo = function (from, to) {
  const pages = this.design.pages;
  const curId = pages[this.cur].id;
  const [p] = pages.splice(from, 1);
  pages.splice(to, 0, p);
  this.cur = pages.findIndex((x) => x.id === curId);
  this.renderPages();
  this.pushHistory();
  this.scheduleSave();
};

// ------------------------------------------------------------ automatic page numbers
const pageNumText = (fmt, i, n) => (fmt === 'nN' ? `${i + 1} / ${n}` : String(i + 1));

features.addPageNumber = async function (fmt = 'n') {
  const { Textbox } = await import('fabric');
  const n = this.design.pages.length;
  await ensureFont('Prompt');
  const t = new Textbox(pageNumText(fmt, this.cur, n), {
    fontFamily: 'Prompt', fontSize: Math.round(this.U * 0.035), fill: '#64748b', textAlign: 'center', width: this.U * 0.25,
    autoPage: fmt, name: 'เลขหน้า', editable: false,
  });
  t.setPositionByOrigin(new Point(this.W / 2, this.H - this.U * 0.05), 'center', 'center');
  this.addObject(t, { center: false });
  toast('เลขหน้าจะเปลี่ยนเองเมื่อเพิ่ม ลบ หรือย้ายหน้า (คัดลอกไปวางหน้าอื่นได้)');
  return t;
};

/** Keep every automatic page-number text in sync with its page position. */
features.syncPageNumbers = function () {
  const n = this.design.pages.length;
  this.design.pages.forEach((p, i) => {
    if (!p.json.includes('"autoPage"')) return;
    const j = JSON.parse(p.json);
    let changed = false;
    for (const o of j.objects || []) {
      if (o.autoPage) {
        const want = pageNumText(o.autoPage, i, n);
        if (o.text !== want) { o.text = want; changed = true; }
      }
    }
    if (changed) p.json = JSON.stringify(j);
  });
  if (this.canvas) {
    let live = false;
    for (const o of this.canvas.getObjects()) {
      if (o.autoPage) {
        const want = pageNumText(o.autoPage, this.cur, n);
        if (o.text !== want) { o.set('text', want); o.initDimensions(); live = true; }
      }
    }
    if (live) this.canvas.requestRenderAll();
  }
};

// ------------------------------------------------------------ find & replace (all pages)
function walkTexts(objs, fn) {
  for (const o of objs || []) {
    if (o.smart && (o.smart.type === 'table' || o.smart.type === 'chart')) {
      // edit the source data; the element is rebuilt from it when the page is opened
      const before = JSON.stringify(o.smart);
      if (o.smart.type === 'table') o.smart.rows = o.smart.rows.map((r) => r.map((c) => fn(String(c))));
      else { o.smart.title = fn(o.smart.title || ''); o.smart.labels = o.smart.labels.map((l) => fn(String(l))); }
      if (JSON.stringify(o.smart) !== before) o.smart._dirty = true;
      continue;
    }
    if (typeof o.text === 'string' && /text/i.test(o.type)) {
      const t = fn(o.text);
      if (t !== o.text) { if (o.styles && t.length !== o.text.length) o.styles = []; o.text = t; }
    }
    if (o.objects && !o.smart) walkTexts(o.objects, fn);
  }
}

features.findInDesign = function (q, matchCase) {
  if (!q) return { total: 0, pages: [] };
  const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), matchCase ? 'g' : 'gi');
  const pages = [];
  let total = 0;
  this.design.pages.forEach((p, i) => {
    let n = 0;
    walkTexts(JSON.parse(p.json).objects, (t) => { n += (t.match(re) || []).length; return t; });
    // a table's cell text is counted once (its child textboxes mirror smart.rows)
    if (n) { pages.push(i); total += n; }
  });
  return { total, pages, re };
};

features.openFindReplace = function () {
  this.flushText();
  this.design.pages[this.cur].json = this.serialize();
  const m = modal({
    title: 'ค้นหาและแทนที่',
    body: `
      <label class="field">ค้นหา <input class="input full" data-q placeholder="ข้อความที่ต้องการค้นหา"></label>
      <label class="field">แทนที่ด้วย <input class="input full" data-r placeholder="(เว้นว่าง = ลบข้อความที่พบ)"></label>
      <label class="toggle-row"><input type="checkbox" data-case> ตรงตัวพิมพ์เล็ก/ใหญ่</label>
      <p class="hint" data-info>พิมพ์คำที่ต้องการค้นหา</p>
      <div class="modal-actions"><button class="btn" data-next>ไปหน้าที่พบถัดไป</button><button class="btn primary" data-all>แทนที่ทั้งหมด</button></div>`,
  });
  const el = m.el;
  const q = el.querySelector('[data-q]'), r = el.querySelector('[data-r]'), mc = el.querySelector('[data-case]'), info = el.querySelector('[data-info]');
  let res = { total: 0, pages: [] };
  const update = () => {
    res = this.findInDesign(q.value, mc.checked);
    info.textContent = !q.value ? 'พิมพ์คำที่ต้องการค้นหา' : res.total ? `พบ ${res.total} จุด ใน ${res.pages.length} หน้า (หน้า ${res.pages.map((x) => x + 1).join(', ')})` : 'ไม่พบข้อความนี้';
  };
  q.focus();
  q.addEventListener('input', update);
  mc.addEventListener('change', update);
  el.querySelector('[data-next]').onclick = () => {
    if (!res.pages.length) return;
    const nx = res.pages.find((x) => x > this.cur) ?? res.pages[0];
    this.gotoPage(nx);
  };
  el.querySelector('[data-all]').onclick = async () => {
    if (!res.total) return toast('ไม่พบข้อความที่จะแทนที่', 'error');
    const rep = r.value;
    const count = res.total;
    for (const i of res.pages) {
      const j = JSON.parse(this.design.pages[i].json);
      walkTexts(j.objects, (t) => t.replace(res.re, () => rep));
      this.design.pages[i].json = JSON.stringify(j);
    }
    await this.loadPage(this.cur);
    this.pushHistory();
    this.scheduleSave();
    this.design.pages.forEach((p, i) => { if (i !== this.cur && res.pages.includes(i)) pageThumbFor(this, p); });
    this.scheduleThumb(0);
    update();
    toast(`แทนที่แล้ว ${count} จุด`, 'ok');
  };
};

function pageThumbFor(ed, p) {
  import('./export.js').then(({ pageThumb }) => pageThumb(ed.design, p.json, 200).then((u) => { ed.thumbs.set(p.id, u); ed.renderPages(); }));
}

// ------------------------------------------------------------ version history
const VERSION_EVERY_MS = 10 * 60 * 1000;

features.maybeAutoVersion = async function () {
  if (Date.now() - (this._lastVersionAt || 0) < VERSION_EVERY_MS) return;
  this._lastVersionAt = Date.now();
  await saveVersion(this.design, 'บันทึกอัตโนมัติ');
};

features.saveVersionNow = async function (label) {
  this.flushText();
  this.design.pages[this.cur].json = this.serialize();
  await this.saveNow();
  await saveVersion(this.design, label || 'บันทึกด้วยตนเอง');
  this._lastVersionAt = Date.now();
};

features.openVersions = async function () {
  const m = modal({ title: 'ประวัติเวอร์ชัน', wide: true, body: '<div data-vers><p class="hint">กำลังโหลด…</p></div>' });
  const box = m.el.querySelector('[data-vers]');
  const fmtTime = (t) => new Date(t).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' });
  const render = async () => {
    const list = await listVersions(this.design.id);
    box.innerHTML = `
      <div class="row-gap"><input class="input" data-label placeholder="ชื่อเวอร์ชัน (ไม่บังคับ)" style="flex:1"><button class="btn primary" data-save>บันทึกเวอร์ชันนี้</button></div>
      <p class="hint">ระบบบันทึกเวอร์ชันอัตโนมัติทุก 10 นาทีที่แก้ไข และก่อนกู้คืนทุกครั้ง (เก็บล่าสุด 30 เวอร์ชัน)</p>
      ${list.length ? `<div class="ver-list">${list.map((v) => `
        <div class="ver">
          <div class="ver-thumb">${v.thumb ? `<img src="${v.thumb}" alt="">` : ''}</div>
          <div class="ver-info"><b>${esc(v.label || 'เวอร์ชัน')}</b><small>${fmtTime(v.createdAt)} · ${v.snapshot.pages.length} หน้า · ${v.snapshot.width}×${v.snapshot.height}</small></div>
          <button class="btn sm" data-restore="${v.id}">กู้คืน</button>
          <button class="icon-btn sm" data-del="${v.id}" title="ลบเวอร์ชันนี้">${icon('trash', 16)}</button>
        </div>`).join('')}</div>` : '<p class="empty">ยังไม่มีเวอร์ชันที่บันทึกไว้</p>'}`;
    box._list = list;
  };
  await render();
  box.addEventListener('click', async (e) => {
    if (e.target.closest('[data-save]')) {
      await this.saveVersionNow(box.querySelector('[data-label]').value.trim());
      toast('บันทึกเวอร์ชันแล้ว', 'ok');
      return render();
    }
    const d = e.target.closest('[data-del]');
    if (d) { await deleteVersion(d.dataset.del); return render(); }
    const r = e.target.closest('[data-restore]');
    if (r) {
      const v = box._list.find((x) => x.id === r.dataset.restore);
      if (!v) return;
      await this.saveVersionNow('ก่อนกู้คืน');
      const snap = JSON.parse(JSON.stringify(v.snapshot));
      Object.assign(this.design, { name: snap.name, width: snap.width, height: snap.height, mm: snap.mm, pages: snap.pages });
      this.$('[data-name]').value = this.design.name;
      this.thumbs.clear();
      await this.loadPage(0, { fit: true });
      this.pushHistory();
      await this.saveNow();
      this.design.pages.forEach((p) => pageThumbFor(this, p));
      m.close();
      toast(`กู้คืนเวอร์ชัน ${fmtTime(v.createdAt)} แล้ว (กดเลิกทำเพื่อย้อนกลับได้)`, 'ok', 4000);
    }
  });
};

// ------------------------------------------------------------ alt text
features.openAltPopover = function (btn) {
  const a = this.canvas.getActiveObject();
  if (!a) return;
  const el = popover(btn, `<div class="pad">
    <div class="cp-title">ข้อความแทนรูป (Alt text)</div>
    <p class="hint">อธิบายสั้น ๆ ว่ารูปนี้คืออะไร โปรแกรมอ่านหน้าจอจะอ่านข้อความนี้ในโหมดนำเสนอ</p>
    <textarea class="input full" rows="3" data-alt placeholder="เช่น นักเรียนกำลังทำการทดลองวิทยาศาสตร์">${esc(a.alt || '')}</textarea>
    <div class="row-gap"><button class="btn sm primary" data-save>บันทึก</button></div>
  </div>`, { key: 'alt', align: 'right' });
  const ta = el.querySelector('[data-alt]');
  ta.focus();
  el.querySelector('[data-save]').onclick = () => {
    const v = ta.value.trim();
    a.alt = v || undefined;
    closePopover();
    this.commit();
    toast(v ? 'บันทึกข้อความแทนรูปแล้ว' : 'ลบข้อความแทนรูปแล้ว');
  };
};

/** Accessible description of a page for present mode: title + alt texts + text content. */
features.pageDescription = function (i) {
  const p = this.design.pages[i];
  const parts = [p.title ? `หน้า ${i + 1}: ${p.title}` : `หน้า ${i + 1}`];
  const walk = (objs) => (objs || []).forEach((o) => { if (o.alt) parts.push('รูป: ' + o.alt); else if (typeof o.text === 'string' && o.text.trim()) parts.push(o.text.trim()); if (o.objects && !o.smart) walk(o.objects); });
  walk(JSON.parse(p.json).objects);
  return parts.join(' · ').slice(0, 1000);
};

// ------------------------------------------------------------ text inside shapes
const HOLDS_TEXT = ['rect', 'circle', 'ellipse', 'triangle', 'polygon'];
function isDark(c) {
  if (typeof c !== 'string' || !/^#[0-9a-f]{6}$/i.test(c)) return false;
  const n = parseInt(c.slice(1), 16);
  return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) < 150;
}

features.canHoldText = function (o) {
  return !!o && !o.locked && (HOLDS_TEXT.includes(o.type) || (o.type === 'path' && o.fill && o.fill !== 'transparent'));
};

/** Double-click a shape (or a shape+text group) to type inside it. */
features.editShapeText = async function (target) {
  if (!target || target.locked) return;
  const { Textbox } = await import('fabric');
  const c = this.canvas;
  let idx = c.getObjects().indexOf(target);
  let shape, text;
  this.loading = true; // structural juggling below is not an undo step
  if (target.shapeText) {
    [shape, text] = target.removeAll();
    c.remove(target);
    c.insertAt(idx, shape, text);
  } else {
    shape = target;
    shape.setCoords();
    const w = shape.getScaledWidth(), h = shape.getScaledHeight();
    text = new Textbox('', {
      width: Math.max(40, w * 0.78), fontSize: Math.max(12, Math.round(Math.min(w, h) * 0.14)), fontFamily: 'Prompt',
      textAlign: 'center', fill: isDark(shape.fill) || (shape.fill && shape.fill.colorStops) ? '#ffffff' : '#1f2333', angle: shape.angle, name: 'ข้อความในรูปทรง',
    });
    text.setPositionByOrigin(shape.getCenterPoint(), 'center', 'center');
    c.insertAt(idx + 1, text);
  }
  this.loading = false;
  this._shapeEdit = { shape, text, idx };
  shape.set({ selectable: false, evented: false });
  c.setActiveObject(text);
  text.enterEditing();
  text.selectAll();
  c.requestRenderAll();
};

features.finishShapeText = function () {
  const { shape, text, idx } = this._shapeEdit;
  this._shapeEdit = null;
  const c = this.canvas;
  shape.set({ selectable: true, evented: true });
  c.remove(text);
  if (!text.text.trim()) { c.setActiveObject(shape); return; }
  // keep the text centred on the shape
  text.setPositionByOrigin(shape.getCenterPoint(), 'center', 'center');
  c.remove(shape);
  const group = new Group([shape, text], { shapeText: true, name: 'รูปทรง + ข้อความ' });
  c.insertAt(Math.min(idx, c.getObjects().length), group);
  c.setActiveObject(group);
  c.requestRenderAll();
};

features.pickMockupImage = function (obj) {
  obj = obj || this.canvas.getActiveObject();
  if (!obj || obj.smart?.type !== 'mockup') return;
  const inp = document.createElement('input');
  inp.type = 'file';
  inp.accept = 'image/*';
  inp.onchange = async () => {
    const f = inp.files[0];
    if (!f) return;
    const { url } = await fileToDataURL(f);
    await saveUpload({ id: uid(), url, name: f.name, createdAt: Date.now() });
    await this.rebuildSmart(obj, { ...obj.smart, src: url });
  };
  inp.click();
};

features.mockupAt = function (pt) {
  return this.canvas.getObjects().slice().reverse().find((o) => o.smart?.type === 'mockup' && o.visible && !o.locked && o.containsPoint(pt));
};
