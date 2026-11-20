// Extra editor features, mixed into Editor.prototype.
import { FabricImage, Path, Point, ActiveSelection } from 'fabric';
import { icon } from './icons.js';
import { esc, toast, modal } from './ui.js';
import { FONTS, ensureFont } from './fonts.js';
import {
  buildTable, buildChart, buildQR, buildEquation, latexToSVG, placeholderImage,
  defaultTable, defaultChart, defaultQR, defaultEquation, FRAMES, GRIDS, CHART_COLORS,
} from './smart.js';
import { pageToDataURL } from './export.js';
import { fileToDataURL } from './imageutil.js';
import { saveUpload, uid } from './storage.js';

const isText = (o) => o && (o.type === 'textbox' || o.type === 'itext' || o.type === 'text');
const isImage = (o) => o && o.type === 'image';

const PALETTES = [
  CHART_COLORS,
  ['#0b3d91', '#1f6fd1', '#4f9df0', '#8cc4ff', '#c4e0ff', '#2a2f45'],
  ['#ff6b4a', '#ffb020', '#ffd84d', '#7bd389', '#2ec4b6', '#3d5a80'],
  ['#264653', '#2a9d8f', '#e9c46a', '#f4a261', '#e76f51', '#8d99ae'],
];

export const SMART_LABEL = { table: 'ตาราง', chart: 'กราฟ', qr: 'QR Code', equation: 'สมการ' };

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
      else if (['bar', 'line', 'pie', 'donut'].includes(kind)) { const d = defaultChart(kind, U); await ensureFont(d.fontFamily); obj = buildChart(d); }
      else if (kind === 'qr') obj = buildQR(defaultQR(U));
      else if (kind === 'equation') { toast('กำลังเตรียมตัวเขียนสมการ…'); obj = await buildEquation(defaultEquation(U)); }
    } catch (e) {
      console.error(e);
      return toast('สร้างองค์ประกอบไม่สำเร็จ: ' + e.message, 'error');
    }
    if (!obj) return;
    this.addObject(obj);
    return obj;
  },

  async rebuildSmart(old, data) {
    let neu;
    if (data.type === 'table') { await ensureFont(data.fontFamily); neu = buildTable(data); }
    if (data.type === 'chart') { await ensureFont(data.fontFamily); neu = buildChart(data); }
    if (data.type === 'qr') neu = buildQR(data);
    if (data.type === 'equation') {
      data.height = old.getScaledHeight();
      neu = await buildEquation(data);
    }
    if (data.type !== 'equation') neu.set({ scaleX: old.scaleX, scaleY: old.scaleY });
    neu.set({ angle: old.angle, opacity: old.opacity, flipX: old.flipX, flipY: old.flipY, shadow: old.shadow, name: old.name || neu.name });
    const c = old.getCenterPoint();
    const idx = this.canvas.getObjects().indexOf(old);
    this.canvas.remove(old);
    this.canvas.insertAt(Math.max(0, idx), neu);
    neu.setPositionByOrigin(c, 'center', 'center');
    neu.setCoords();
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
            ${[['bar', 'กราฟแท่ง'], ['line', 'กราฟเส้น'], ['pie', 'กราฟวงกลม'], ['donut', 'กราฟโดนัท']].map(([k, l]) => `<option value="${k}" ${d.chart === k ? 'selected' : ''}>${l}</option>`).join('')}
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
        <button class="btn sm" data-add>${icon('plus', 16)} เพิ่มข้อมูล</button>
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
    const order = [null, 'bullet', 'number'];
    const next = order[(order.indexOf(t.listType || null) + 1) % order.length];
    const lines = t.text.split('\n').map((l) => l.replace(/^(•\s|\d+\.\s)/, ''));
    t.set('text', lines.map((l, i) => (next === 'bullet' ? '• ' : next === 'number' ? `${i + 1}. ` : '') + l).join('\n'));
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
    ov.innerHTML = `<div class="present-stage"><img alt="" data-img><div class="present-loading">กำลังเตรียมสไลด์…</div></div>
      <div class="present-bar"><button class="icon-btn" data-p="prev" title="ก่อนหน้า (←)">${icon('left')}</button><span data-n></span><button class="icon-btn" data-p="next" title="ถัดไป (→)">${icon('right')}</button><button class="icon-btn" data-p="exit" title="ออก (Esc)">${icon('close')}</button></div>`;
    document.body.appendChild(ov);
    try { await ov.requestFullscreen?.(); } catch { /* not allowed */ }
    const n = this.design.pages.length;
    const mult = Math.min(3, (Math.max(window.screen.width, window.innerWidth) * (window.devicePixelRatio || 1)) / this.W);
    const cache = new Map();
    let i = start;
    const img = ov.querySelector('[data-img]');
    const show = async () => {
      ov.querySelector('[data-n]').textContent = `${i + 1} / ${n}`;
      if (!cache.has(i)) cache.set(i, pageToDataURL(this.design, this.design.pages[i].json, { format: 'jpeg', multiplier: mult, quality: 0.92 }));
      const want = i;
      const url = await cache.get(i);
      if (want !== i) return;
      img.src = url;
      ov.querySelector('.present-loading')?.remove();
      if (i + 1 < n && !cache.has(i + 1)) cache.set(i + 1, pageToDataURL(this.design, this.design.pages[i + 1].json, { format: 'jpeg', multiplier: mult, quality: 0.92 }));
    };
    const go = (d) => { const j = Math.max(0, Math.min(n - 1, i + d)); if (j !== i) { i = j; show(); } };
    const close = () => {
      document.removeEventListener('keydown', key, true);
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
      ov.remove();
    };
    const key = (e) => {
      e.stopPropagation();
      if (['ArrowRight', 'ArrowDown', ' ', 'PageDown', 'Enter'].includes(e.key)) { e.preventDefault(); go(1); }
      if (['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace'].includes(e.key)) { e.preventDefault(); go(-1); }
      if (e.key === 'Escape') close();
    };
    document.addEventListener('keydown', key, true);
    ov.addEventListener('click', (e) => {
      const p = e.target.closest('[data-p]')?.dataset.p;
      if (p === 'prev') go(-1);
      else if (p === 'next') go(1);
      else if (p === 'exit') close();
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
