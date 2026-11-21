import {
  Canvas, Point, Textbox, FabricImage, ActiveSelection, Group, PencilBrush, Shadow,
  Rect, Circle, Polygon, Path, Gradient, filters, util, InteractiveFabricObject, config, FabricText,
} from 'fabric';
import { icon, LIBRARY_ICONS } from './icons.js';
import { esc, h, toast, modal, confirmDialog, popover, closePopover, currentPopoverId } from './ui.js';
import { FONTS, ensureFont, ensureFonts, fontsInJSON, linkAllFonts } from './fonts.js';
import { SHAPES, LINES, STICKERS, makeSticker, shapePreviewSVG } from './shapes.js';
import { TEMPLATES, TEMPLATE_CATEGORIES, buildTemplate, templateFonts, pageGradient } from './templates.js';
import { exportDesign, printDesign, pageThumb, renderPage, safeURL } from './export.js';
export { safeURL };
import { saveDesign, listUploads, saveUpload, deleteUpload, uid } from './storage.js';
import { PRESETS } from './presets.js';
import { PATTERNS, PHOTO_LIBRARY } from './patterns.js';
import { loadGraphics, loadIllustrations, setIllustrations, elementsHomeHTML, elementsViewHTML, elementsSearchHTML, makeElement, recolorGraphic } from './elements.js';
import { docSettings, hasDoc, docDecorations, decorationObjects, decorationFonts, visibleNumber, PAGE_NUM_FORMATS, WATERMARK_PRESETS, BORDER_STYLES } from './docsetup.js';
import { Vignette, warmthMatrix, tintMatrix, duotoneMatrix, sharpen } from './filters.js';
import { fileToDataURL } from './imageutil.js';
import { features, SMART_LABEL, BRAND_FONT_KINDS } from './features.js';
import { rulers } from './rulers.js';
import { FRAMES, GRIDS, MOCKUPS, CHART_TYPES } from './smart.js';

const CHART_ICON = { bar: '📊', 'bar-group': '📊', 'bar-stack': '▥', 'bar-stack100': '▥', hbar: '☰', 'hbar-group': '☰', 'hbar-stack': '☰', waterfall: '⛲', lollipop: '🍭',
  line: '📈', 'line-multi': '📈', 'line-smooth': '〰', step: '⌐', area: '◭', 'area-stack': '◭', pie: '◔', donut: '◎', halfdonut: '◠', polar: '✿', radial: '◉',
  radar: '🕸', scatter: '⁘', bubble: '⚬', heatmap: '▦', funnel: '⏷', treemap: '▤', dotplot: '•', progress: '▰', ring: '◌', pictogram: '👥', gauge: '⏲', stat: '🔢' };

export { fileToDataURL };

config.textureSize = 4096;

Object.assign(InteractiveFabricObject.ownDefaults, {
  cornerStyle: 'circle',
  cornerColor: '#ffffff',
  cornerStrokeColor: '#7c5cff',
  borderColor: '#7c5cff',
  transparentCorners: false,
  cornerSize: 12,
  touchCornerSize: 30,
  borderScaleFactor: 1.6,
  padding: 2,
});

const EXTRA = ['name', 'locked', 'adj', 'crop', 'mask', 'smart', 'curve', 'listType', 'placeholder', 'link', 'alt', 'autoPage', 'shapeText', 'autoToc', 'graphic'];
export const BLANK_PAGE = (bg = '#ffffff') => JSON.stringify({ version: '6.9.1', objects: [], background: bg });

const COLORS = [
  '#000000', '#545454', '#737373', '#a6a6a6', '#d9d9d9', '#ffffff',
  '#ff3131', '#ff5757', '#ff66c4', '#cb6ce6', '#8c52ff', '#5e17eb',
  '#0097b2', '#0cc0df', '#5ce1e6', '#38b6ff', '#5170ff', '#004aad',
  '#00bf63', '#7ed957', '#c1ff72', '#ffde59', '#ffbd59', '#ff914d',
];
const GRADS = [
  ['#7c5cff', '#ff5fa2'], ['#ff9966', '#ff5e62'], ['#43cea2', '#185a9d'], ['#f6d365', '#fda085'],
  ['#a18cd1', '#fbc2eb'], ['#141e30', '#243b55'], ['#d4fc79', '#96e6a1'], ['#84fab0', '#8fd3f4'],
  ['#fa709a', '#fee140'], ['#30cfd0', '#330867'], ['#000000', '#434343'], ['#e0c3fc', '#8ec5fc'],
];

const isText = (o) => o && (o.type === 'textbox' || o.type === 'itext' || o.type === 'text');
const isImage = (o) => o && o.type === 'image';
const isLineLike = (o) => o && (o.type === 'line' || (o.type === 'path' && (!o.fill || o.fill === 'transparent' || o.fill === '')));
const round = (n, d = 0) => Math.round(n * 10 ** d) / 10 ** d;

function colorCss(v) {
  if (!v || v === 'transparent') return 'transparent';
  if (typeof v === 'object' && v.colorStops) {
    return `linear-gradient(135deg, ${v.colorStops.map((s) => `${s.color} ${s.offset * 100}%`).join(', ')})`;
  }
  return v;
}
function toHex(v) {
  if (typeof v !== 'string' || !v) return '#000000';
  if (/^#[0-9a-f]{6}$/i.test(v)) return v;
  if (/^#[0-9a-f]{3}$/i.test(v)) return '#' + [...v.slice(1)].map((c) => c + c).join('');
  const c = document.createElement('canvas').getContext('2d');
  c.fillStyle = v;
  return /^#/.test(c.fillStyle) ? c.fillStyle : '#000000';
}
function objGradient([a, b]) {
  return new Gradient({
    type: 'linear', gradientUnits: 'percentage',
    coords: { x1: 0, y1: 0, x2: 1, y2: 1 },
    colorStops: [{ offset: 0, color: a }, { offset: 1, color: b }],
  });
}

function samePages(a, b) {
  return a.length === b.length && a.every((p, i) => p.json === b[i].json && p.id === b[i].id && !!p.hidden === !!b[i].hidden && (p.title || '') === (b[i].title || '') && (p.notes || '') === (b[i].notes || '') && JSON.stringify(p.guides || null) === JSON.stringify(b[i].guides || null));
}

export class Editor {
  constructor(root, design, { onExit }) {
    this.root = root;
    this.design = design;
    this.onExit = onExit;
    this.cur = 0;
    this.zoom = 1;
    this.history = [];
    this.hIndex = -1;
    this.loading = false;
    this.thumbs = new Map();
    this.panel = 'templates';
    this.clipboard = null;
    this.guides = null;
    this.snapTargets = null;
    this.drawSettings = { color: '#7c5cff', width: 8, mode: 'pen' };
    this.listeners = [];
  }

  get W() { return this.design.width; }
  get H() { return this.design.height; }
  get U() { return Math.min(this.W, this.H); }

  // ---------------------------------------------------------------- setup
  async mount() {
    this.root.innerHTML = '';
    this.el = h(`
      <div class="editor">
        <header class="topbar">
          <button class="icon-btn" data-act="home" title="หน้าหลัก">${icon('home')}</button>
          <div class="brand small"><span class="logo">ล</span></div>
          <button class="tb-btn" data-act="file-menu">ไฟล์ ${icon('down', 16)}</button>
          <button class="tb-btn hide-sm" data-act="resize">${icon('resize', 18)} ปรับขนาด</button>
          <span class="sep"></span>
          <button class="icon-btn" data-act="undo" title="เลิกทำ (Ctrl+Z)">${icon('undo')}</button>
          <button class="icon-btn" data-act="redo" title="ทำซ้ำ (Ctrl+Y)">${icon('redo')}</button>
          <span class="save-status" data-status></span>
          <div class="grow"></div>
          <input class="name-input" data-name value="${esc(this.design.name)}" aria-label="ชื่องานออกแบบ" />
          <button class="tb-btn hide-sm" data-act="present" title="นำเสนอแบบเต็มจอ">▶ นำเสนอ</button>
          <button class="icon-btn hide-sm" data-act="print" title="พิมพ์">${icon('print')}</button>
          <button class="btn primary" data-act="export">${icon('download', 18)}<span class="hide-xs"> ดาวน์โหลด</span></button>
        </header>
        <div class="ed-body">
          <nav class="rail">
            ${[
              ['templates', 'template', 'เทมเพลต'], ['elements', 'elements', 'องค์ประกอบ'], ['text', 'text', 'ข้อความ'],
              ['uploads', 'upload', 'อัปโหลด'], ['brand', 'star', 'แบรนด์'], ['photos', 'photo', 'รูปภาพ'], ['background', 'background', 'พื้นหลัง'],
              ['draw', 'draw', 'วาด'], ['layers', 'layers', 'เลเยอร์'], ['outline', 'list', 'โครงร่าง'],
            ].map(([k, ic, label]) => `<button class="rail-btn" data-panel="${k}">${icon(ic, 22)}<span>${label}</span></button>`).join('')}
          </nav>
          <aside class="panel" data-panel-box>
            <div class="panel-head"><h3 data-panel-title></h3><button class="icon-btn" data-act="close-panel" title="ซ่อน">${icon('left')}</button></div>
            <div class="panel-body" data-panel-body></div>
          </aside>
          <main class="stage">
            <div class="ctxbar" data-ctx></div>
            <div class="ws-area" data-ws-area>
              <canvas class="ruler-h" data-ruler-h title="ลากลงมาเพื่อสร้างเส้นไกด์แนวนอน"></canvas>
              <canvas class="ruler-v" data-ruler-v title="ลากออกมาเพื่อสร้างเส้นไกด์แนวตั้ง"></canvas>
              <div class="ruler-corner" title="ดับเบิลคลิกเพื่อล้างเส้นไกด์"></div>
              <div class="workspace" data-ws>
                <div class="canvas-wrap" data-wrap><canvas data-canvas></canvas></div>
              </div>
            </div>
            <footer class="pagebar">
              <div class="pages" data-pages></div>
              <div class="page-actions">
                <button class="icon-btn" data-act="page-left" title="เลื่อนหน้าไปซ้าย">${icon('left', 18)}</button>
                <button class="icon-btn" data-act="page-right" title="เลื่อนหน้าไปขวา">${icon('right', 18)}</button>
                <button class="icon-btn" data-act="page-dup" title="ทำสำเนาหน้า">${icon('copy', 18)}</button>
                <button class="icon-btn" data-act="page-del" title="ลบหน้า">${icon('trash', 18)}</button>
                <button class="icon-btn" data-act="page-hide" title="ซ่อน/แสดงหน้า (หน้าที่ซ่อนจะไม่ถูกนำเสนอและดาวน์โหลด)">${icon('eyeOff', 18)}</button>
                <button class="icon-btn" data-act="page-notes" title="ชื่อหน้าและโน้ตผู้นำเสนอ">${icon('chat', 18)}</button>
                <button class="icon-btn" data-act="page-grid" title="ดูทุกหน้าแบบกริด (จัดลำดับได้)">${icon('template', 18)}</button>
              </div>
              <div class="zoom">
                <button class="icon-btn" data-act="zoom-out" title="ซูมออก">${icon('zoomOut', 18)}</button>
                <button class="zoom-label" data-act="zoom-fit" data-zoom title="พอดีหน้าจอ">100%</button>
                <button class="icon-btn" data-act="zoom-in" title="ซูมเข้า">${icon('zoomIn', 18)}</button>
              </div>
            </footer>
          </main>
        </div>
        <input type="file" accept="image/*" multiple hidden data-file-upload />
        <input type="file" accept="image/*" hidden data-file-bg />
        <input type="file" accept=".json,application/json" hidden data-file-project />
      </div>`);
    this.root.appendChild(this.el);
    this.$ = (sel) => this.el.querySelector(sel);

    const canvas = new Canvas(this.$('[data-canvas]'), {
      preserveObjectStacking: true,
      stopContextMenu: true,
      fireRightClick: true,
      selectionColor: 'rgba(124,92,255,0.08)',
      selectionBorderColor: '#7c5cff',
      selectionLineWidth: 1,
      backgroundColor: '#ffffff',
      targetFindTolerance: 6,
    });
    this.canvas = canvas;
    this.bindCanvas();
    this.bindUI();
    this.bindKeys();
    this.bindPanelDrag();
    this.bindRulers();

    // generate thumbnails of all pages in background
    await this.loadPage(0, { fit: true });
    this.pushHistory();
    this.renderPages();
    this.openPanel(window.innerWidth < 760 ? null : 'templates');
    this.design.pages.forEach((p, i) => {
      if (i !== this.cur) pageThumb(this.design, p, 200).then((u) => { this.thumbs.set(p.id, u); this.renderPages(); }).catch(() => {});
    });
    this.scheduleThumb(300);
    this.updateStatus('saved');
  }

  destroy() {
    closePopover();
    this.listeners.forEach(([t, ev, fn, opt]) => t.removeEventListener(ev, fn, opt));
    this.canvas.dispose();
    this.root.innerHTML = '';
  }

  on(target, ev, fn, opt) {
    target.addEventListener(ev, fn, opt);
    this.listeners.push([target, ev, fn, opt]);
  }

  // ---------------------------------------------------------------- canvas events
  bindCanvas() {
    const c = this.canvas;
    const sel = () => { this.renderCtx(); if (this.panel === 'layers') this.renderPanel(); };
    c.on('selection:created', () => { closePopover(); if (this._style) this.maybePasteStyle(); sel(); });
    c.on('selection:updated', () => { if (this.cropLeft()) return; closePopover(); if (this._style) this.maybePasteStyle(); sel(); });
    c.on('selection:cleared', () => { if (this.cropLeft()) return; if (currentPopoverId() !== 'color-bg') closePopover(); sel(); });
    c.on('object:modified', (e) => {
      const t = e.target;
      if (isText(t) && (t.scaleX !== 1 || t.scaleY !== 1)) this.normalizeTextScale(t);
      this.guides = null;
      this.snapTargets = null;
      this.commit();
    });
    c.on('object:moving', (e) => { if (e.target.cropUI) return this.clampCrop(e.target, 'move'); this.snap(e.target, e.e); });
    c.on('object:scaling', (e) => { if (e.target.cropUI) this.clampCrop(e.target, 'scale'); });
    c.on('object:rotating', (e) => {
      const t = e.target;
      const ang = ((t.angle % 360) + 360) % 360;
      let snapped = null;
      if (e.e && e.e.shiftKey) snapped = Math.round(ang / 15) * 15;
      else { const near = Math.round(ang / 45) * 45; if (Math.abs(near - ang) < 3) snapped = near; }
      if (snapped !== null) { t.rotate(snapped % 360); t.setCoords(); }
    });
    c.on('mouse:up', () => {
      if (this.guides) { this.guides = null; c.requestRenderAll(); }
      this.snapTargets = null;
    });
    c.on('text:changed', () => this.commit(true));
    c.on('text:editing:exited', (e) => {
      const t = e.target;
      if (this._shapeEdit && this._shapeEdit.text === t) { this.finishShapeText(); return this.commit(); }
      if (t && !t.text.trim()) c.remove(t);
      this.commit();
    });
    c.on('path:created', (e) => {
      e.path.set({ name: this.drawSettings.mode === 'highlighter' ? 'ปากกาไฮไลต์' : 'ลายเส้น' });
      this.commit();
    });
    c.on('after:render', ({ ctx }) => { this.drawDocDeco(ctx); this.drawMargins(ctx); this.drawUserGuides(ctx); this.drawGuides(ctx); });
    c.on('mouse:down', (e) => {
      if (e.e.button === 2) this.showContextMenu(e);
    });
    c.on('mouse:dblclick', (e) => {
      const t = e.target;
      if (t && t.cropUI) return this.endCrop(true);
      if (!t || t.locked) return;
      if (t.smart) this.openSmartEditor(t);
      else if (t.shapeText || this.canHoldText(t)) this.editShapeText(t);
      else if (isImage(t) && t.placeholder) this.pickReplaceImage();
      else if (isImage(t)) this.startCrop(t);
    });
  }

  // ---------------------------------------------------------------- drag-to-crop on canvas
  /** Enter crop mode: show the whole picture dimmed + a draggable crop frame. */
  startCrop(img) {
    if (!img || !isImage(img) || img.locked || img.placeholder) return;
    if (this._crop) return;
    const ang = ((img.angle % 360) + 360) % 360;
    if (img.group || ang > 0.01 || img.flipX || img.flipY || img.skewX || img.skewY) {
      toast('รูปที่หมุน/พลิกอยู่ ใช้การครอบตัดแบบสไลเดอร์แทน');
      return this.openImagePopover('crop', this.$('[data-ctx] [data-act="crop-mode"]'));
    }
    closePopover();
    const c = this.canvas;
    const sx = img.scaleX, sy = img.scaleY;
    const tl = util.transformPoint(new Point(-img.width / 2, -img.height / 2), img.calcTransformMatrix());
    const { width: nw, height: nh } = img.getOriginalSize();
    const saved = { cropX: img.cropX || 0, cropY: img.cropY || 0, width: img.width, height: img.height, left: img.left, top: img.top, crop: img.crop ? { ...img.crop } : undefined, evented: img.evented, selectable: img.selectable };
    const ui = { excludeFromExport: true, cropUI: true, originX: 'left', originY: 'top', hasRotatingPoint: false, lockRotation: true, objectCaching: false };
    const ghost = new FabricImage(img.getElement(), {
      ...ui, left: tl.x - saved.cropX * sx, top: tl.y - saved.cropY * sy, scaleX: sx, scaleY: sy,
      opacity: 0.4, hasControls: false, lockScalingX: true, lockScalingY: true, hoverCursor: 'move',
      borderColor: 'rgba(124,58,237,.6)', borderDashArray: [6, 4],
    });
    const frame = new Rect({
      ...ui, left: tl.x, top: tl.y, width: img.width * sx, height: img.height * sy,
      fill: 'rgba(0,0,0,0)', stroke: null, strokeWidth: 0, lockUniScaling: false,
      borderColor: '#7c3aed', cornerColor: '#ffffff', cornerStrokeColor: '#7c3aed', cornerStyle: 'rect',
      transparentCorners: false, cornerSize: 14, borderScaleFactor: 2, uniformScaling: false,
    });
    frame.setControlsVisibility({ mtr: false });
    ghost.ghost = true; frame.frame = true;
    img.set({ evented: false, selectable: false });
    c.discardActiveObject();
    this._crop = { img, ghost, frame, saved, sx, sy, nw, nh, ratio: 0 };
    c.insertAt(c.getObjects().indexOf(img), ghost);
    c.add(frame);
    c.setActiveObject(frame);
    c.requestRenderAll();
    this.renderCtx();
  }

  /** Keep the frame inside the picture (and the picture behind the frame). */
  clampCrop(t, mode = 'move') {
    const k = this._crop;
    if (!k) return;
    const { ghost: g, frame: f } = k;
    const gw = g.width * g.scaleX, gh = g.height * g.scaleY;
    if (t === g) {
      const fw = f.width * f.scaleX, fh = f.height * f.scaleY;
      g.set({ left: Math.min(f.left, Math.max(f.left + fw - gw, g.left)), top: Math.min(f.top, Math.max(f.top + fh - gh, g.top)) });
    } else {
      const min = 8;
      let x1 = f.left, y1 = f.top, x2 = f.left + f.width * f.scaleX, y2 = f.top + f.height * f.scaleY;
      const w = x2 - x1, h = y2 - y1;
      if (mode === 'move') {
        x1 = Math.max(g.left, Math.min(x1, g.left + gw - w)); y1 = Math.max(g.top, Math.min(y1, g.top + gh - h));
        x2 = x1 + w; y2 = y1 + h;
      } else {
        x1 = Math.max(x1, g.left); y1 = Math.max(y1, g.top);
        x2 = Math.min(x2, g.left + gw); y2 = Math.min(y2, g.top + gh);
        if (k.ratio && f.uniformScaling) {
          // keep the chosen ratio when an edge hits the picture border
          const r = k.ratio;
          if ((x2 - x1) / (y2 - y1) > r) { const nw = (y2 - y1) * r; if (x1 === f.left) x2 = x1 + nw; else x1 = x2 - nw; }
          else { const nh = (x2 - x1) / r; if (y1 === f.top) y2 = y1 + nh; else y1 = y2 - nh; }
        }
        if (x2 - x1 < 8) x2 = x1 + 8;
        if (y2 - y1 < 8) y2 = y1 + 8;
      }
      f.set({ left: x1, top: y1, scaleX: (x2 - x1) / f.width, scaleY: (y2 - y1) / f.height });
    }
    f.setCoords(); g.setCoords();
    this.syncCrop();
  }

  /** Copy the frame/ghost geometry into the real image's crop. */
  syncCrop() {
    const { img, ghost: g, frame: f, sx, sy, nw, nh } = this._crop;
    const fw = f.width * f.scaleX, fh = f.height * f.scaleY;
    const cropX = Math.max(0, (f.left - g.left) / sx), cropY = Math.max(0, (f.top - g.top) / sy);
    const width = Math.min(nw - cropX, fw / sx), height = Math.min(nh - cropY, fh / sy);
    img.set({ cropX, cropY, width, height });
    img.setPositionByOrigin(new Point(f.left + fw / 2, f.top + fh / 2), 'center', 'center');
    const pc = (v) => Math.round(v * 1000) / 10;
    img.crop = { l: pc(cropX / nw), t: pc(cropY / nh), r: pc((nw - cropX - width) / nw), b: pc((nh - cropY - height) / nh) };
    this.applyMask(img, img.mask);
    img.setCoords();
    img.set('dirty', true);
    this.canvas.requestRenderAll();
  }

  /** Fixed-ratio frame centred on the current frame, as large as fits. */
  cropRatio(ratio) {
    const k = this._crop;
    if (!k) return;
    k.ratio = ratio;
    const { ghost: g, frame: f } = k;
    const sides = (v) => f.setControlsVisibility({ ml: v, mr: v, mt: v, mb: v });
    if (!ratio) { f.uniformScaling = false; sides(true); this.canvas.setActiveObject(f); return this.canvas.requestRenderAll(); }
    sides(false);
    const gw = g.width * g.scaleX, gh = g.height * g.scaleY;
    let w = gw, h = gw / ratio;
    if (h > gh) { h = gh; w = gh * ratio; }
    const fw = f.width * f.scaleX, fh = f.height * f.scaleY;
    const cx = Math.max(g.left + w / 2, Math.min(g.left + gw - w / 2, f.left + fw / 2));
    const cy = Math.max(g.top + h / 2, Math.min(g.top + gh - h / 2, f.top + fh / 2));
    f.set({ left: cx - w / 2, top: cy - h / 2, width: w, height: h, scaleX: 1, scaleY: 1 });
    f.uniformScaling = true;
    f.setCoords();
    this.canvas.setActiveObject(f);
    this.syncCrop();
  }

  cropReset() {
    const k = this._crop;
    if (!k) return;
    const { ghost: g, frame: f } = k;
    f.set({ left: g.left, top: g.top, width: g.width * g.scaleX, height: g.height * g.scaleY, scaleX: 1, scaleY: 1 });
    f.uniformScaling = false;
    f.setControlsVisibility({ ml: true, mr: true, mt: true, mb: true });
    k.ratio = 0;
    f.setCoords();
    this.canvas.setActiveObject(f);
    this.syncCrop();
  }

  /** Selection moved away from the crop UI → apply (like Canva). Returns true when handled. */
  cropLeft() {
    const k = this._crop;
    if (!k || k.ending) return false;
    const a = this.canvas.getActiveObject();
    if (a === k.frame || a === k.ghost) { this.renderCtx(); return true; }
    this.endCrop(true, a);
    return true;
  }

  endCrop(apply = true, nextActive) {
    const k = this._crop;
    if (!k) return;
    k.ending = true;
    const c = this.canvas;
    const { img, ghost, frame, saved } = k;
    if (apply) this.syncCrop();
    else {
      img.set({ cropX: saved.cropX, cropY: saved.cropY, width: saved.width, height: saved.height, left: saved.left, top: saved.top });
      img.crop = saved.crop;
      this.applyMask(img, img.mask);
      img.set('dirty', true);
    }
    img.set({ evented: saved.evented, selectable: saved.selectable });
    img.setCoords();
    c.remove(ghost, frame);
    this._crop = null;
    c.discardActiveObject();
    c.setActiveObject(nextActive && nextActive.canvas ? nextActive : img);
    c.requestRenderAll();
    if (apply) this.commit();
    this.renderCtx();
    if (this.panel === 'layers') this.renderPanel();
  }

  // ---------------------------------------------------------------- document setup (header, footer, page numbers, watermark, border)
  /** Rebuild the decoration objects of the current page when settings, page number or page count change. */
  refreshDeco() {
    if (!this.design || !this.canvas) return;
    const num = visibleNumber(this.design, this.cur);
    const on = hasDoc(this.design);
    const key = on ? JSON.stringify([this.design.doc, num, this.W, this.H, this.design.mm]) : '';
    if (key === this._decoKey) return;
    this._decoKey = key;
    if (!on) { this._deco = []; this.canvas.requestRenderAll(); return; }
    const build = () => { this._deco = decorationObjects({ Rect, Text: FabricText, Textbox }, docDecorations(this.design, num.i, num.n)); this.canvas.requestRenderAll(); };
    build();
    Promise.race([ensureFonts(decorationFonts(this.design)), new Promise((r) => setTimeout(r, 3000))]).then(() => { if (this._decoKey === key) build(); });
  }

  drawDocDeco(ctx) {
    if (!this._deco || !this._deco.length) return;
    ctx.save();
    ctx.transform(...this.canvas.viewportTransform);
    for (const o of this._deco) o.render(ctx);
    ctx.restore();
  }

  setDoc(path, value, { history = true } = {}) {
    const d = this.design.doc ? JSON.parse(JSON.stringify(this.design.doc)) : {};
    const [k, f] = path.split('.');
    if (f) d[k] = { ...(d[k] || {}), [f]: value }; else d[k] = value;
    this.design.doc = d;
    this._decoKey = null;
    this.refreshDeco();
    this.scheduleSave();
    clearTimeout(this._docT);
    if (history) this._docT = setTimeout(() => { this.pushHistory(); this.scheduleThumb(0); this.design.pages.forEach((p, i) => { if (i !== this.cur) pageThumb(this.design, p, 200).then((u) => { this.thumbs.set(p.id, u); this.renderPages(); }).catch(() => {}); }); }, 350);
  }

  openDocSetup() {
    const s = docSettings(this.design);
    const fontOpts = (cur) => FONTS.map(([f]) => `<option ${f === cur ? 'selected' : ''}>${esc(f)}</option>`).join('');
    const alignSeg = (k, cur) => `<div class="seg sm" data-seg="${k}">${[['left', 'ซ้าย'], ['center', 'กลาง'], ['right', 'ขวา']].map(([v, l]) => `<button type="button" data-v="${v}" class="${cur === v ? 'on' : ''}">${l}</button>`).join('')}</div>`;
    const band = (k, label, ph) => `
      <fieldset class="ds-box"><legend>${label}</legend>
        <textarea class="input full" rows="1" data-doc="${k}.text" placeholder="${ph}">${esc(s[k].text)}</textarea>
        <div class="ds-row">${alignSeg(`${k}.align`, s[k].align)}
          <label class="chk"><input type="checkbox" data-doc="${k}.bold" ${s[k].bold ? 'checked' : ''}> <b>ตัวหนา</b></label>
          <label class="chk"><input type="checkbox" data-doc="${k}.italic" ${s[k].italic ? 'checked' : ''}> <i>ตัวเอียง</i></label>
          <label class="chk">สี <input type="color" data-doc="${k}.color" value="${s[k].color}"></label>
        </div>
        <div class="ds-row"><label>ฟอนต์ <select class="input" data-doc="${k}.font">${fontOpts(s[k].font)}</select></label>
          <label>ขนาด <input class="input num" type="number" min="6" max="48" step="0.5" data-doc="${k}.size" value="${s[k].size}"> pt</label></div>
      </fieldset>`;
    const m = modal({
      title: 'ตั้งค่าเอกสาร: หัว/ท้ายกระดาษ เลขหน้า ลายน้ำ',
      wide: true,
      body: `<div class="docsetup">
        <p class="hint">ใช้กับทุกหน้าของงานนี้ เห็นผลบนผืนงานทันที และส่งออกเป็นหัวกระดาษ ท้ายกระดาษ เลขหน้าอัตโนมัติ ลายน้ำ และขอบหน้ากระดาษของ Word จริง (แก้ไขต่อใน Word ได้)</p>
        <div class="ds-grid">
          <div>
            ${band('header', 'หัวกระดาษ', 'เช่น เอกสารลับ / ชื่อหน่วยงาน')}
            ${band('footer', 'ท้ายกระดาษ', 'เช่น โรงเรียน… ปีการศึกษา 2569')}
            <label class="ds-row">ระยะหัว/ท้ายจากขอบกระดาษ <input class="input num" type="number" min="3" max="40" step="1" data-doc="edge" value="${s.edge}"> มม.</label>
          </div>
          <div>
            <fieldset class="ds-box"><legend>เลขหน้า</legend>
              <div class="seg sm" data-seg="pageNum.pos">${[['none', 'ไม่ใส่'], ['header', 'หัวกระดาษ'], ['footer', 'ท้ายกระดาษ']].map(([v, l]) => `<button type="button" data-v="${v}" class="${s.pageNum.pos === v ? 'on' : ''}">${l}</button>`).join('')}</div>
              <div class="ds-row">${alignSeg('pageNum.align', s.pageNum.align)}
                <select class="input" data-doc="pageNum.fmt">${PAGE_NUM_FORMATS.map(([v, l]) => `<option value="${v}" ${s.pageNum.fmt === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
              <div class="ds-row"><label class="chk"><input type="checkbox" data-doc="pageNum.skipFirst" ${s.pageNum.skipFirst ? 'checked' : ''}> ไม่แสดงเลขหน้าในหน้าแรก (หน้าปก)</label>
                <label class="chk">สี <input type="color" data-doc="pageNum.color" value="${s.pageNum.color}"></label>
                <label>ขนาด <input class="input num" type="number" min="6" max="48" step="0.5" data-doc="pageNum.size" value="${s.pageNum.size}"> pt</label></div>
            </fieldset>
            <fieldset class="ds-box"><legend>ลายน้ำ</legend>
              <div class="chips">${['', ...WATERMARK_PRESETS].map((w) => `<button type="button" class="chip ${s.watermark.text === w ? 'on' : ''}" data-wm="${esc(w)}">${w || 'ไม่ใส่'}</button>`).join('')}</div>
              <input class="input full" data-doc="watermark.text" value="${esc(s.watermark.text)}" placeholder="หรือพิมพ์ข้อความลายน้ำเอง">
              <div class="ds-row"><label class="chk">สี <input type="color" data-doc="watermark.color" value="${s.watermark.color}"></label>
                <label>จาง <input type="range" min="0.05" max="0.6" step="0.01" data-doc="watermark.opacity" value="${s.watermark.opacity}"></label>
                <label class="chk"><input type="checkbox" data-doc="watermark.diagonal" ${s.watermark.diagonal ? 'checked' : ''}> แนวทแยง</label></div>
            </fieldset>
            <fieldset class="ds-box"><legend>ขอบหน้ากระดาษ</legend>
              <div class="ds-row"><select class="input" data-doc="border.style">${BORDER_STYLES.map(([v, l]) => `<option value="${v}" ${s.border.style === v ? 'selected' : ''}>${l}</option>`).join('')}</select>
                <label class="chk">สี <input type="color" data-doc="border.color" value="${s.border.color}"></label>
                <label>หนา <input class="input num" type="number" min="0.5" max="6" step="0.25" data-doc="border.width" value="${s.border.width}"> pt</label>
                <label>ห่างขอบ <input class="input num" type="number" min="2" max="10" step="0.5" data-doc="border.inset" value="${s.border.inset}"> มม.</label></div>
            </fieldset>
          </div>
        </div>
        <div class="ds-foot"><button class="btn" data-doc-clear>ล้างทั้งหมด</button><span class="grow"></span><button class="btn primary" data-doc-done>เสร็จสิ้น</button></div>
      </div>`,
    });
    const el = m.el;
    const val = (inp) => (inp.type === 'checkbox' ? inp.checked : inp.type === 'number' || inp.type === 'range' ? +inp.value : inp.value);
    el.querySelectorAll('[data-doc]').forEach((inp) => {
      const ev = inp.tagName === 'SELECT' || inp.type === 'checkbox' ? 'change' : 'input';
      inp.addEventListener(ev, () => {
        let v = val(inp);
        if (inp.type === 'number') { const mn = +inp.min, mx = +inp.max; if (!isFinite(v)) return; v = Math.max(mn, Math.min(mx, v)); }
        this.setDoc(inp.dataset.doc, v);
        if (inp.dataset.doc === 'watermark.text') el.querySelectorAll('[data-wm]').forEach((b) => b.classList.toggle('on', b.dataset.wm === v));
      });
    });
    el.querySelectorAll('[data-seg]').forEach((seg) => seg.addEventListener('click', (e) => {
      const b = e.target.closest('[data-v]');
      if (!b) return;
      seg.querySelectorAll('.on').forEach((x) => x.classList.remove('on'));
      b.classList.add('on');
      this.setDoc(seg.dataset.seg, b.dataset.v);
    }));
    el.querySelectorAll('[data-wm]').forEach((b) => b.addEventListener('click', () => {
      el.querySelectorAll('[data-wm]').forEach((x) => x.classList.toggle('on', x === b));
      el.querySelector('[data-doc="watermark.text"]').value = b.dataset.wm;
      this.setDoc('watermark.text', b.dataset.wm);
    }));
    el.querySelector('[data-doc-clear]').addEventListener('click', () => {
      this.design.doc = undefined;
      this._decoKey = null;
      this.refreshDeco();
      this.pushHistory();
      this.scheduleSave();
      m.close();
      this.openDocSetup();
    });
    el.querySelector('[data-doc-done]').addEventListener('click', () => m.close());
  }

  normalizeTextScale(t) {
    const s = t.scaleX;
    t.set({
      fontSize: round(t.fontSize * s, 1),
      width: t.width * s,
      strokeWidth: (t.strokeWidth || 0) * s,
      scaleX: 1,
      scaleY: 1,
    });
    if (t.shadow) t.shadow.blur *= s;
    t.setCoords();
  }

  // ---------------------------------------------------------------- snapping
  computeSnapTargets(target) {
    const skip = new Set(target.type === 'activeselection' ? target.getObjects() : [target]);
    const ug = this.pageGuides();
    const xs = [0, this.W / 2, this.W, ...ug.v];
    const ys = [0, this.H / 2, this.H, ...ug.h];
    for (const o of this.canvas.getObjects()) {
      if (skip.has(o) || !o.visible) continue;
      const b = o.getBoundingRect();
      xs.push(b.left, b.left + b.width / 2, b.left + b.width);
      ys.push(b.top, b.top + b.height / 2, b.top + b.height);
    }
    return { xs, ys };
  }

  snap(o, ev) {
    if (ev && ev.altKey) { this.guides = null; return; }
    if (!this.snapTargets) this.snapTargets = this.computeSnapTargets(o);
    const th = 6 / this.zoom;
    o.setCoords();
    const b = o.getBoundingRect();
    const pick = (vals, targets) => {
      let best = null;
      for (const v of vals) for (const t of targets) {
        const d = t - v;
        if (Math.abs(d) <= th && (!best || Math.abs(d) < Math.abs(best.d))) best = { d, t };
      }
      return best;
    };
    const bx = pick([b.left, b.left + b.width / 2, b.left + b.width], this.snapTargets.xs);
    const by = pick([b.top, b.top + b.height / 2, b.top + b.height], this.snapTargets.ys);
    const g = { x: [], y: [] };
    if (bx) { o.set('left', o.left + bx.d); g.x.push(bx.t); }
    if (by) { o.set('top', o.top + by.d); g.y.push(by.t); }
    o.setCoords();
    this.guides = g.x.length || g.y.length ? g : null;
  }

  drawGuides(ctx) {
    if (!this.guides) return;
    const v = this.canvas.viewportTransform;
    ctx.save();
    ctx.transform(v[0], v[1], v[2], v[3], v[4], v[5]);
    ctx.strokeStyle = '#ff3ea5';
    ctx.lineWidth = 1 / this.zoom;
    ctx.setLineDash([5 / this.zoom, 4 / this.zoom]);
    ctx.beginPath();
    for (const x of this.guides.x) { ctx.moveTo(x, 0); ctx.lineTo(x, this.H); }
    for (const y of this.guides.y) { ctx.moveTo(0, y); ctx.lineTo(this.W, y); }
    ctx.stroke();
    ctx.restore();
  }

  // ---------------------------------------------------------------- pages / history
  serialize() {
    return JSON.stringify(this.canvas.toObject(EXTRA));
  }

  async loadPage(i, { fit = false } = {}) {
    if (this._crop) this.endCrop(true);
    this.cur = Math.max(0, Math.min(i, this.design.pages.length - 1));
    const json = JSON.parse(this.design.pages[this.cur].json);
    const fontList = fontsInJSON(json);
    this.loading = true;
    const fontsReady = await Promise.race([ensureFonts(fontList).then(() => true), new Promise((r) => setTimeout(() => r(false), 1500))]);
    this.canvas.discardActiveObject();
    await this.canvas.loadFromJSON(json);
    this.canvas.getObjects().forEach((o) => this.applyLock(o));
    if (!this.canvas.backgroundColor && !this.canvas.backgroundImage) this.canvas.backgroundColor = '#ffffff';
    await this.rebuildDirtySmart();
    this.loading = false;
    if (fit) this.fitZoom();
    else this.setZoom(this.zoom);
    this.canvas.requestRenderAll();
    this.renderCtx();
    this.renderPages();
    if (this.panel === 'layers' || this.panel === 'background' || this.panel === 'outline') this.renderPanel();
    const pageId = this.design.pages[this.cur].id;
    ensureFonts(fontList).then(async () => {
      this.refreshTexts();
      // fonts arrived after the page was drawn: re-layout tables/charts so text fits their cells
      if (!fontsReady && this.design.pages[this.cur]?.id === pageId) {
        const smart = this.canvas.getObjects().filter((o) => o.smart && (o.smart.type === 'table' || o.smart.type === 'chart'));
        if (smart.length) { smart.forEach((o) => { o.smart._dirty = true; }); await this.rebuildDirtySmart(); this.canvas.requestRenderAll(); }
      }
    });
  }

  refreshTexts() {
    const walk = (o) => {
      if (isText(o)) { o.initDimensions(); o.setCoords(); o.set('dirty', true); }
      if (o.getObjects) o.getObjects().forEach(walk);
    };
    this.canvas.getObjects().forEach(walk);
    this.canvas.requestRenderAll();
  }

  /** Persist current page into the design + history. `soft` = coalesce typing. */
  commit(soft = false) {
    if (this.loading || this._crop) return;
    if (!soft && (this._hasToc || this.canvas.getObjects().some((o) => o.autoPage || o.autoToc))) {
      this.design.pages[this.cur].json = this.serialize();
      this.syncPageNumbers();
    }
    this.design.pages[this.cur].json = this.serialize();
    if (soft) {
      clearTimeout(this._softT);
      this._softT = setTimeout(() => this.pushHistory(), 600);
    } else {
      clearTimeout(this._softT);
      this.pushHistory();
    }
    this.scheduleSave();
    this.scheduleThumb();
    if (!soft) {
      this.renderCtx();
      if (this.panel === 'layers' || this.panel === 'outline') this.renderPanel();
    }
  }

  snapshot() {
    return {
      pages: this.design.pages.map((p) => ({ ...p })),
      cur: this.cur, width: this.W, height: this.H, mm: this.design.mm || null,
      doc: JSON.stringify(this.design.doc || null),
    };
  }

  pushHistory() {
    const s = this.snapshot();
    const last = this.history[this.hIndex];
    if (last && samePages(last.pages, s.pages) && last.width === s.width && last.height === s.height && last.doc === s.doc) return;
    this.history = this.history.slice(0, this.hIndex + 1);
    this.history.push(s);
    if (this.history.length > 60) this.history.shift();
    this.hIndex = this.history.length - 1;
    this.updateUndoButtons();
  }

  async restore(s) {
    const dimsChanged = s.width !== this.W || s.height !== this.H;
    // jump to the page the undone/redone change belongs to (page switches are not undo steps)
    const now = this.design.pages;
    let focus = s.cur;
    if (now.length === s.pages.length && now.every((p, i) => p.id === s.pages[i].id)) {
      const changed = s.pages.findIndex((p, i) => !samePages([p], [now[i]]));
      focus = changed >= 0 ? changed : Math.min(this.cur, s.pages.length - 1);
    }
    this.design.pages = s.pages.map((p) => ({ ...p }));
    this.design.width = s.width;
    this.design.height = s.height;
    this.design.mm = s.mm;
    if (s.doc !== undefined) this.design.doc = JSON.parse(s.doc) || undefined;
    this._decoKey = null;
    await this.loadPage(focus, { fit: dimsChanged });
    this.updateUndoButtons();
    this.scheduleSave();
    this.scheduleThumb(0);
  }

  undo() {
    if (this._crop) return this.endCrop(false);
    if (this.canvas.getActiveObject()?.isEditing) return;
    clearTimeout(this._softT);
    if (this.history[this.hIndex] && !samePages(this.design.pages, this.history[this.hIndex].pages)) this.pushHistory();
    if (this.hIndex <= 0) return;
    this.hIndex--;
    this.restore(this.history[this.hIndex]);
  }

  redo() {
    if (this._crop) return;
    if (this.hIndex >= this.history.length - 1) return;
    this.hIndex++;
    this.restore(this.history[this.hIndex]);
  }

  updateUndoButtons() {
    this.$('[data-act="undo"]').disabled = this.hIndex <= 0;
    this.$('[data-act="redo"]').disabled = this.hIndex >= this.history.length - 1;
  }

  scheduleSave() {
    this.updateStatus('saving');
    clearTimeout(this._saveT);
    this._saveT = setTimeout(() => this.saveNow(), 700);
  }

  async saveNow() {
    clearTimeout(this._saveT);
    this.design.updatedAt = Date.now();
    const first = this.thumbs.get(this.design.pages[0].id);
    if (first) this.design.thumb = first;
    try {
      await saveDesign(JSON.parse(JSON.stringify(this.design)));
      this.updateStatus('saved');
      if (this.hIndex > 0) this.maybeAutoVersion().catch(() => {});
    } catch (e) {
      console.error(e);
      this.updateStatus('error');
    }
  }

  updateStatus(s) {
    const el = this.$('[data-status]');
    if (!el) return;
    el.textContent = s === 'saving' ? 'กำลังบันทึก…' : s === 'error' ? 'บันทึกไม่สำเร็จ' : 'บันทึกแล้ว ✓';
    el.className = 'save-status ' + s;
  }

  scheduleThumb(delay = 400) {
    clearTimeout(this._thumbT);
    this._thumbT = setTimeout(() => {
      const p = this.design.pages[this.cur];
      if (!p) return;
      try {
        // with a document setup the thumbnail also shows header/footer/watermark (drawn outside the objects)
        if (hasDoc(this.design)) { pageThumb(this.design, p, 200).then((u) => { this.thumbs.set(p.id, u); this.renderPages(); }).catch(() => {}); if (this.cur === 0) this.scheduleSave(); return; }
        const m = 200 / (this.W * this.zoom);
        this.thumbs.set(p.id, this.canvas.toDataURL({ format: 'jpeg', quality: 0.75, multiplier: m }));
        this.renderPages();
        if (this.cur === 0) this.scheduleSave();
      } catch (e) { /* tainted canvas etc. */ }
    }, delay);
  }

  renderPages() {
    this.syncPageNumbers();
    this.refreshDeco();
    const box = this.$('[data-pages]');
    if (!box) return;
    const ratio = this.W / this.H;
    const th = 52;
    box.innerHTML = this.design.pages.map((p, i) => {
      const t = this.thumbs.get(p.id);
      return `<button class="page-thumb ${i === this.cur ? 'active' : ''} ${p.hidden ? 'is-hidden' : ''}" data-page="${i}" title="หน้า ${i + 1}${p.title ? ': ' + esc(p.title) : ''}${p.hidden ? ' (ซ่อนอยู่)' : ''}" style="width:${Math.round(th * ratio)}px;height:${th}px">
        ${t ? `<img src="${t}" alt="">` : ''}<span>${i + 1}${p.hidden ? ' 🚫' : ''}${p.notes ? ' 📝' : ''}</span></button>`;
    }).join('') + `<button class="page-add" data-act="page-add" title="เพิ่มหน้า" style="height:${th}px">${icon('plus', 20)}</button>`;
    const act = box.querySelector('.active');
    if (act) act.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }

  async gotoPage(i) {
    if (i === this.cur) return;
    this.flushText();
    await this.loadPage(i);
  }

  flushText() {
    const a = this.canvas.getActiveObject();
    if (a && a.isEditing) a.exitEditing();
  }

  async addPage(json = BLANK_PAGE(), select = true, meta = {}) {
    this.flushText();
    const p = { id: uid(), json, ...meta };
    this.design.pages.splice(this.cur + 1, 0, p);
    if (select) await this.loadPage(this.cur + 1);
    pageThumb(this.design, p, 200).then((u) => { this.thumbs.set(p.id, u); this.renderPages(); }).catch(() => {});
    this.pushHistory();
    this.scheduleSave();
    this.renderPages();
  }

  async duplicatePage() {
    const json = this.serialize();
    const { title, notes, hidden } = this.design.pages[this.cur];
    await this.addPage(json, true, { title: title ? title + ' (สำเนา)' : undefined, notes, hidden });
    toast('ทำสำเนาหน้าแล้ว');
  }

  async deletePage() {
    if (this.design.pages.length === 1) {
      if (!(await confirmDialog('ล้างทุกอย่างในหน้านี้?', 'ล้างหน้า', true))) return;
      this.canvas.clear();
      this.canvas.backgroundColor = '#ffffff';
      this.canvas.requestRenderAll();
      this.commit();
      return;
    }
    this.design.pages.splice(this.cur, 1);
    await this.loadPage(Math.min(this.cur, this.design.pages.length - 1));
    this.pushHistory();
    this.scheduleSave();
    this.scheduleThumb(0);
  }

  async movePage(dir) {
    const j = this.cur + dir;
    if (j < 0 || j >= this.design.pages.length) return;
    const pages = this.design.pages;
    [pages[this.cur], pages[j]] = [pages[j], pages[this.cur]];
    this.cur = j;
    this.renderPages();
    this.pushHistory();
    this.scheduleSave();
    this.scheduleThumb(0);
  }

  // ---------------------------------------------------------------- zoom
  setZoom(z) {
    this.zoom = Math.max(0.05, Math.min(4, z));
    this.canvas.setDimensions({ width: Math.round(this.W * this.zoom), height: Math.round(this.H * this.zoom) });
    this.canvas.setZoom(this.zoom);
    this.canvas.calcOffset();
    const zl = this.$('[data-zoom]');
    if (zl) zl.textContent = Math.round(this.zoom * 100) + '%';
    requestAnimationFrame(() => this.drawRulers());
  }

  fitZoom() {
    const ws = this.$('[data-ws]');
    const pad = window.innerWidth < 760 ? 24 : 72;
    const z = Math.min((ws.clientWidth - pad) / this.W, (ws.clientHeight - pad) / this.H);
    this.setZoom(z > 0 ? z : 0.3);
  }

  // ---------------------------------------------------------------- UI binding
  bindUI() {
    this.el.addEventListener('click', (e) => {
      const ev = e.target.closest('[data-el-view]');
      if (ev && this.el.contains(ev)) { this._elView = ev.dataset.elView; return this.renderPanel(); }
      const b = e.target.closest('[data-act]');
      if (b && this.el.contains(b)) return this.action(b.dataset.act, b, e);
      const pb = e.target.closest('[data-panel]');
      if (pb && pb.classList.contains('rail-btn')) return this.openPanel(this.panel === pb.dataset.panel && this.panelVisible() ? null : pb.dataset.panel);
      const pg = e.target.closest('[data-page]');
      if (pg) return this.gotoPage(+pg.dataset.page);
    });
    const name = this.$('[data-name]');
    name.addEventListener('change', () => {
      this.design.name = name.value.trim() || 'งานออกแบบไม่มีชื่อ';
      name.value = this.design.name;
      this.scheduleSave();
    });
    name.addEventListener('keydown', (e) => e.key === 'Enter' && name.blur());

    this.$('[data-file-upload]').addEventListener('change', async (e) => {
      const files = [...e.target.files];
      e.target.value = '';
      await this.handleFiles(files, this._uploadThenAdd !== false);
    });
    this.$('[data-file-bg]').addEventListener('change', async (e) => {
      const f = e.target.files[0];
      e.target.value = '';
      if (!f) return;
      const { url } = await fileToDataURL(f);
      await saveUpload({ id: uid(), url, createdAt: Date.now() });
      this.setBackgroundImage(url);
    });
    this.$('[data-file-project]').addEventListener('change', (e) => {
      const f = e.target.files[0];
      e.target.value = '';
      if (f) this.onExit({ importFile: f });
    });

    // drag & drop images
    const ws = this.$('[data-ws]');
    ws.addEventListener('dragover', (e) => { e.preventDefault(); ws.classList.add('drop'); });
    ws.addEventListener('dragleave', () => ws.classList.remove('drop'));
    ws.addEventListener('drop', (e) => {
      e.preventDefault();
      ws.classList.remove('drop');
      const act = e.dataTransfer?.getData('application/x-lai-act');
      if (act) return this.dropAct(act, e);
      const files = [...(e.dataTransfer?.files || [])].filter((f) => f.type.startsWith('image/'));
      if (!files.length) return;
      const dropPt = this.canvas.getScenePoint(e);
      const mock = files.length === 1 ? this.mockupAt(dropPt) : null;
      if (mock) {
        fileToDataURL(files[0]).then(async ({ url }) => {
          await saveUpload({ id: uid(), url, name: files[0].name, createdAt: Date.now() });
          this.rebuildSmart(mock, { ...mock.smart, src: url });
        });
        return;
      }
      const target = files.length === 1 ? this.imageAt(dropPt) : null;
      if (target) {
        fileToDataURL(files[0]).then(async ({ url }) => {
          await saveUpload({ id: uid(), url, name: files[0].name, createdAt: Date.now() });
          this.replaceImage(target, url);
        });
      } else this.handleFiles(files, true);
    });
    ws.addEventListener('wheel', (e) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        this.setZoom(this.zoom * (e.deltaY < 0 ? 1.1 : 0.9));
      }
    }, { passive: false });
    ws.addEventListener('mousedown', (e) => {
      if (e.target === ws || e.target.classList.contains('canvas-wrap')) { this.canvas.discardActiveObject(); this.canvas.requestRenderAll(); }
    });
    this.on(window, 'resize', () => {
      clearTimeout(this._rz);
      this._rz = setTimeout(() => this.fitZoom(), 150);
    });
    this.on(document, 'paste', (e) => this.onPaste(e));
  }

  panelVisible() {
    return !this.$('[data-panel-box]').classList.contains('hidden');
  }

  async handleFiles(files, addToCanvas) {
    for (const f of files) {
      if (!f.type.startsWith('image/')) continue;
      try {
        const { url } = await fileToDataURL(f);
        await saveUpload({ id: uid(), url, name: f.name, createdAt: Date.now() });
        if (addToCanvas) await this.addImage(url, f.name.replace(/\.[^.]+$/, ''));
      } catch (err) {
        console.error(err);
        toast('อ่านไฟล์รูปไม่สำเร็จ: ' + f.name, 'error');
      }
    }
    if (this.panel === 'uploads') this.renderPanel();
  }

  async onPaste(e) {
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    if (this.canvas.getActiveObject()?.isEditing) return;
    const items = [...(e.clipboardData?.items || [])];
    const img = items.find((i) => i.type.startsWith('image/'));
    if (img) {
      e.preventDefault();
      await this.handleFiles([img.getAsFile()], true);
      return;
    }
    e.preventDefault();
    this.paste();
  }

  bindKeys() {
    this.on(document, 'keydown', (e) => {
      const t = e.target;
      if (e.defaultPrevented || document.querySelector('.modal-back, .present')) return;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
      const a = this.canvas.getActiveObject();
      if (a && a.isEditing) return;
      const mod = e.ctrlKey || e.metaKey;
      const k = e.key.toLowerCase();
      if (this._crop) {
        if (k === 'enter') { e.preventDefault(); this.endCrop(true); }
        else if (k === 'escape') { e.preventDefault(); this.endCrop(false); }
        else if (mod && k === 'z') { e.preventDefault(); this.endCrop(false); }
        else if (k === 'delete' || k === 'backspace' || mod) e.preventDefault();
        return;
      }
      if (mod && k === 'z') { e.preventDefault(); return e.shiftKey ? this.redo() : this.undo(); }
      if (mod && k === 'y') { e.preventDefault(); return this.redo(); }
      if (mod && k === 'f') { e.preventDefault(); return this.openFindReplace(); }
      if (mod && (e.code === 'BracketRight' || e.code === 'BracketLeft') && a) {
        e.preventDefault();
        const up = e.code === 'BracketRight';
        return this.arrange(e.shiftKey ? (up ? 'front' : 'back') : up ? 'forward' : 'backward');
      }
      if (mod && ['b', 'i', 'u'].includes(k) && isText(a)) {
        e.preventDefault();
        return this.ctxAction({ b: 'toggle:bold', i: 'toggle:italic', u: 'toggle:underline' }[k]);
      }
      if (mod && e.shiftKey && k === 'l' && a) { e.preventDefault(); return this.toggleLock(); }
      if (mod && k === 's') { e.preventDefault(); this.saveNow(); return toast('บันทึกแล้ว'); }
      if (mod && k === 'c') { if (a) { e.preventDefault(); this.copy(); } return; }
      if (mod && k === 'x') { if (a) { e.preventDefault(); this.copy().then(() => this.deleteSelection()); } return; }
      if (mod && k === 'd') { e.preventDefault(); return this.duplicate(); }
      if (mod && k === 'a') { e.preventDefault(); return this.selectAll(); }
      if (mod && k === 'g') { e.preventDefault(); return e.shiftKey ? this.ungroup() : this.group(); }
      if (mod && (k === '=' || k === '+')) { e.preventDefault(); return this.setZoom(this.zoom * 1.15); }
      if (mod && k === '-') { e.preventDefault(); return this.setZoom(this.zoom / 1.15); }
      if (mod && k === '0') { e.preventDefault(); return this.fitZoom(); }
      if (k === 'delete' || k === 'backspace') { if (a) { e.preventDefault(); this.deleteSelection(); } return; }
      if (k === 'escape') { if (this._style) { this._style = null; this.$('[data-ws]').classList.remove('paint'); } this.canvas.discardActiveObject(); this.canvas.requestRenderAll(); return; }
      if (!mod && e.shiftKey && k === 'r') { e.preventDefault(); return this.toggleRulers(); }
      if (!mod && k === 't') { e.preventDefault(); return this.addText('body'); }
      if (!mod && k === 'r') { e.preventDefault(); return this.addShape(0); }
      if (!mod && k === 'c' && !a) { e.preventDefault(); return this.addShape(2); }
      if (['arrowleft', 'arrowright', 'arrowup', 'arrowdown'].includes(k) && a && !a.locked) {
        e.preventDefault();
        const d = e.shiftKey ? 10 : 1;
        if (k === 'arrowleft') a.left -= d;
        if (k === 'arrowright') a.left += d;
        if (k === 'arrowup') a.top -= d;
        if (k === 'arrowdown') a.top += d;
        a.setCoords();
        this.canvas.requestRenderAll();
        clearTimeout(this._nudgeT);
        this._nudgeT = setTimeout(() => this.commit(), 300);
      }
    });
  }

  async action(act, btn) {
    switch (act) {
      case 'home': await this.saveNow(); return this.onExit({});
      case 'undo': return this.undo();
      case 'redo': return this.redo();
      case 'export': return this.openExport();
      case 'print': toast('กำลังเตรียมพิมพ์…'); return printDesign(this.design);
      case 'present': return this.present();
      case 'resize': return this.openResize();
      case 'file-menu': return this.openFileMenu(btn);
      case 'close-panel': return this.openPanel(null);
      case 'zoom-in': return this.setZoom(this.zoom * 1.2);
      case 'zoom-out': return this.setZoom(this.zoom / 1.2);
      case 'zoom-fit': return this.fitZoom();
      case 'page-add': return this.addPage();
      case 'page-dup': return this.duplicatePage();
      case 'page-del': return this.deletePage();
      case 'page-left': return this.movePage(-1);
      case 'page-right': return this.movePage(1);
      case 'page-hide': return this.togglePageHidden();
      case 'page-notes': return this.openPageNotes();
      case 'page-grid': return this.openPageGrid();
      default:
        if (this.ctxAction(act, btn) !== false) return;
        if (this.panelAction(act, btn) !== false) return;
    }
  }

  openFileMenu(btn) {
    const el = popover(btn, `
      <div class="menu">
        <button data-m="new">${icon('plus', 18)} สร้างงานออกแบบใหม่</button>
        <button data-m="copy">${icon('copy', 18)} ทำสำเนางานนี้</button>
        <button data-m="resize">${icon('resize', 18)} ปรับขนาดงาน</button>
        <button data-m="docsetup">${icon('file', 18)} หัว/ท้ายกระดาษ เลขหน้า ลายน้ำ ขอบกระดาษ</button>
        <hr>
        <button data-m="save-project">${icon('download', 18)} บันทึกไฟล์โปรเจกต์ (.json)</button>
        <button data-m="open-project">${icon('folder', 18)} เปิดไฟล์โปรเจกต์</button>
        <button data-m="export">${icon('file', 18)} ดาวน์โหลดเป็น PNG / JPG / PDF / SVG</button>
        <button data-m="print">${icon('print', 18)} พิมพ์</button>
        <hr>
        <button data-m="versions">🕘 ประวัติเวอร์ชัน</button>
        <button data-m="find">🔍 ค้นหาและแทนที่ข้อความ <kbd>Ctrl+F</kbd></button>
        <button data-m="present">▶ นำเสนอแบบเต็มจอ</button>
        <button data-m="rulers">📏 ${this.showRulers ? 'ซ่อน' : 'แสดง'}ไม้บรรทัด <kbd>Shift+R</kbd></button>
        <button data-m="clear-guides">🧹 ล้างเส้นไกด์หน้านี้</button>
        <button data-m="bleed">✂️ ${this.showBleed ? 'ซ่อน' : 'แสดง'}ระยะตัดตก (งานพิมพ์)</button>
        <button data-m="margins">📐 ${this.showMargins ? 'ซ่อน' : 'แสดง'}ระยะขอบปลอดภัย</button>
        <button data-m="shortcuts">⌨️ ปุ่มลัดคีย์บอร์ด</button>
      </div>`, { key: 'file' });
    el.onclick = async (e) => {
      const m = e.target.closest('[data-m]')?.dataset.m;
      if (!m) return;
      closePopover();
      if (m === 'new') { await this.saveNow(); this.onExit({ newDesign: true }); }
      if (m === 'copy') { await this.saveNow(); this.onExit({ duplicate: this.design.id }); }
      if (m === 'resize') this.openResize();
      if (m === 'docsetup') this.openDocSetup();
      if (m === 'save-project') exportDesign(this.design, { format: 'json', pages: [] });
      if (m === 'open-project') this.$('[data-file-project]').click();
      if (m === 'export') this.openExport();
      if (m === 'print') printDesign(this.design);
      if (m === 'shortcuts') this.showShortcuts();
      if (m === 'present') this.present();
      if (m === 'find') this.openFindReplace();
      if (m === 'versions') this.openVersions();
      if (m === 'margins') this.toggleMargins();
      if (m === 'rulers') this.toggleRulers();
      if (m === 'clear-guides') this.clearGuides();
      if (m === 'bleed') this.toggleBleed();
    };
  }

  showShortcuts() {
    const rows = [
      ['Ctrl + Z / Ctrl + Y', 'เลิกทำ / ทำซ้ำ'], ['Ctrl + C / V / X', 'คัดลอก / วาง / ตัด'], ['Ctrl + D', 'ทำสำเนา'],
      ['Ctrl + G / Ctrl + Shift + G', 'จัดกลุ่ม / ยกเลิกกลุ่ม'], ['Ctrl + A', 'เลือกทั้งหมด'], ['Delete', 'ลบ'],
      ['ลูกศร (+Shift)', 'ขยับ 1px (10px)'], ['Ctrl + ] / Ctrl + [', 'เลื่อนขึ้น / เลื่อนลง หนึ่งชั้น'], ['Ctrl + Shift + ] / [', 'นำไปบนสุด / ล่างสุด'],
      ['Ctrl + B / I / U', 'ตัวหนา / เอียง / ขีดเส้นใต้ (ข้อความที่เลือก)'], ['Ctrl + Shift + L', 'ล็อก / ปลดล็อก'], ['Ctrl + F', 'ค้นหาและแทนที่'],
      ['Shift ขณะหมุน', 'หมุนทีละ 15°'], ['T / R / C', 'เพิ่มข้อความ / สี่เหลี่ยม / วงกลม'],
      ['Ctrl + เลื่อนล้อเมาส์', 'ซูม'], ['Ctrl + 0', 'พอดีหน้าจอ'], ['Alt ขณะลาก', 'ปิดการจัดแนวอัตโนมัติ'],
      ['ดับเบิลคลิกรูป', 'ครอบตัดรูป'], ['Ctrl + V รูปจากคลิปบอร์ด', 'วางรูปลงงาน'],
    ];
    modal({ title: 'ปุ่มลัดคีย์บอร์ด', body: `<table class="kbd-table">${rows.map(([k, v]) => `<tr><td><kbd>${k}</kbd></td><td>${v}</td></tr>`).join('')}</table>` });
  }

  // ---------------------------------------------------------------- object helpers
  applyLock(o) {
    const l = !!o.locked;
    o.set({ lockMovementX: l, lockMovementY: l, lockScalingX: l, lockScalingY: l, lockRotation: l, hasControls: !l, editable: !l });
  }

  defaultName(o) {
    if (isText(o)) return 'ข้อความ';
    if (isImage(o)) return 'รูปภาพ';
    if (o.type === 'group') return 'กลุ่ม';
    if (isLineLike(o)) return 'เส้น';
    return 'รูปทรง';
  }

  displayName(o) {
    if (isText(o)) return (o.text || '').replace(/\s+/g, ' ').slice(0, 28) || 'ข้อความ';
    if (o.smart) return SMART_LABEL[o.smart.type] || o.name;
    return o.name || this.defaultName(o);
  }

  addObject(o, { center = true, select = true } = {}) {
    if (!o.name) o.set('name', this.defaultName(o));
    if (center) {
      o.setPositionByOrigin(new Point(this.W / 2, this.H / 2), 'center', 'center');
    }
    this.canvas.add(o);
    o.setCoords();
    if (select) this.canvas.setActiveObject(o);
    this.canvas.requestRenderAll();
    this.commit();
    if (window.innerWidth < 760) this.openPanel(null);
    return o;
  }

  addShape(i, list = SHAPES) {
    const [label, make] = list[i];
    const o = make(this.U * 0.3);
    o.set({ name: label });
    return this.addObject(o);
  }

  async addText(kind, preset) {
    const U = this.U;
    const base = {
      heading: { text: 'เพิ่มหัวข้อ', fontSize: U * 0.09, fontWeight: 'bold', fontFamily: 'Kanit', width: this.W * 0.7 },
      sub: { text: 'เพิ่มหัวข้อย่อย', fontSize: U * 0.055, fontWeight: '600', fontFamily: 'Kanit', width: this.W * 0.6 },
      body: { text: 'เพิ่มเนื้อความ', fontSize: U * 0.035, fontWeight: 'normal', fontFamily: 'Sarabun', width: this.W * 0.5 },
    }[kind] || {};
    const opts = { fill: '#1f2333', textAlign: 'center', lineHeight: 1.2, ...base, ...(preset || {}) };
    if (opts.shadowCfg) {
      opts.shadow = new Shadow({ ...opts.shadowCfg, blur: opts.shadowCfg.blur * U, offsetX: (opts.shadowCfg.offsetX || 0) * U, offsetY: (opts.shadowCfg.offsetY || 0) * U });
      delete opts.shadowCfg;
    }
    if (opts.strokeRel) { opts.strokeWidth = opts.strokeRel * U; delete opts.strokeRel; }
    await Promise.race([ensureFont(opts.fontFamily), new Promise((r) => setTimeout(r, 1500))]);
    const t = new Textbox(opts.text, { ...opts, name: 'ข้อความ' });
    this.addObject(t);
    return t;
  }

  async addImage(src, name = 'รูปภาพ') {
    try {
      const img = await FabricImage.fromURL(src, { crossOrigin: 'anonymous' });
      const k = Math.min((this.W * 0.6) / img.width, (this.H * 0.6) / img.height, 1.5);
      img.set({ scaleX: k, scaleY: k, name });
      this.addObject(img);
      return img;
    } catch (e) {
      console.error(e);
      toast('เพิ่มรูปไม่สำเร็จ', 'error');
    }
  }

  async setBackgroundImage(src) {
    try {
      const img = await FabricImage.fromURL(src, { crossOrigin: 'anonymous' });
      const k = Math.max(this.W / img.width, this.H / img.height);
      img.set({ scaleX: k, scaleY: k, originX: 'left', originY: 'top', left: (this.W - img.width * k) / 2, top: (this.H - img.height * k) / 2 });
      this.canvas.backgroundImage = img;
      this.canvas.requestRenderAll();
      this.commit();
      if (this.panel === 'background') this.renderPanel();
    } catch {
      toast('ตั้งภาพพื้นหลังไม่สำเร็จ', 'error');
    }
  }

  setBackground(v) {
    if (Array.isArray(v)) this.canvas.backgroundColor = pageGradient(v[0], v[1], this.W, this.H);
    else this.canvas.backgroundColor = v;
    this.canvas.backgroundImage = null;
    this.canvas.requestRenderAll();
    this.commit();
  }

  async copy() {
    const a = this.canvas.getActiveObject();
    if (!a) return;
    this.clipboard = await a.clone(EXTRA);
    // share with other designs / tabs in this browser
    try {
      sessionStorage.removeItem('lai-clipboard');
      localStorage.setItem('lai-clipboard', JSON.stringify({ at: Date.now(), obj: this.clipboard.toObject(EXTRA) }));
      this._clipAt = Date.now();
    } catch { /* too large for storage: keep in-memory only */ }
  }

  /** Pick up an element copied in another design (newer than our own copy). */
  async loadSharedClipboard() {
    try {
      const raw = localStorage.getItem('lai-clipboard');
      if (!raw) return;
      const { at, obj } = JSON.parse(raw);
      if (this.clipboard && at <= (this._clipAt || 0)) return;
      const [o] = await util.enlivenObjects([obj]);
      if (o) { this.clipboard = o; this._clipAt = at; }
    } catch { /* ignore broken clipboard */ }
  }

  async paste({ shared = true } = {}) {
    if (shared) await this.loadSharedClipboard();
    if (!this.clipboard) return;
    const c = await this.clipboard.clone(EXTRA);
    this.canvas.discardActiveObject();
    const d = this.U * 0.03;
    c.set({ left: c.left + d, top: c.top + d, evented: true });
    if (c.type === 'activeselection') {
      c.canvas = this.canvas;
      c.forEachObject((o) => this.canvas.add(o));
      c.setCoords();
    } else {
      this.canvas.add(c);
    }
    this.clipboard.set({ left: this.clipboard.left + d, top: this.clipboard.top + d });
    this.canvas.setActiveObject(c);
    this.canvas.requestRenderAll();
    this.commit();
  }

  async duplicate() {
    const a = this.canvas.getActiveObject();
    if (!a) return;
    const saved = this.clipboard;
    this.clipboard = await a.clone(EXTRA);
    await this.paste({ shared: false });
    this.clipboard = saved;
  }

  deleteSelection() {
    const objs = this.canvas.getActiveObjects().filter((o) => !o.locked);
    if (!objs.length) return;
    this.canvas.discardActiveObject();
    this.canvas.remove(...objs);
    this.canvas.requestRenderAll();
    this.commit();
  }

  selectAll() {
    const objs = this.canvas.getObjects().filter((o) => o.visible && !o.locked);
    if (!objs.length) return;
    this.canvas.discardActiveObject();
    this.canvas.setActiveObject(objs.length === 1 ? objs[0] : new ActiveSelection(objs, { canvas: this.canvas }));
    this.canvas.requestRenderAll();
  }

  group() {
    const a = this.canvas.getActiveObject();
    if (!a || a.type !== 'activeselection') return;
    const all = this.canvas.getObjects();
    const objs = a.getObjects().slice().sort((x, y) => all.indexOf(x) - all.indexOf(y));
    const idx = all.indexOf(objs[objs.length - 1]) - objs.length + 1;
    this.canvas.discardActiveObject();
    this.canvas.remove(...objs);
    const g = new Group(objs, { name: 'กลุ่ม' });
    this.canvas.insertAt(Math.max(0, idx), g);
    this.canvas.setActiveObject(g);
    this.canvas.requestRenderAll();
    this.commit();
  }

  ungroup() {
    const g = this.canvas.getActiveObject();
    if (!g || g.type !== 'group') return;
    const idx = this.canvas.getObjects().indexOf(g);
    const objs = g.removeAll();
    this.canvas.remove(g);
    this.canvas.insertAt(idx, ...objs);
    objs.forEach((o) => o.setCoords());
    this.canvas.setActiveObject(new ActiveSelection(objs, { canvas: this.canvas }));
    this.canvas.requestRenderAll();
    this.commit();
  }

  /** Set a property on every selected object (or selected characters while editing). */
  setProp(prop, value, { commit = true } = {}) {
    const a = this.canvas.getActiveObject();
    if (!a) return;
    const charProps = ['fill', 'fontWeight', 'fontStyle', 'underline', 'linethrough', 'fontFamily', 'fontSize', 'textBackgroundColor', 'stroke', 'strokeWidth'];
    if (isText(a) && a.isEditing && a.selectionStart !== a.selectionEnd && charProps.includes(prop) && !(value && value.colorStops)) {
      a.setSelectionStyles({ [prop]: value });
    } else {
      const targets = a.type === 'activeselection' ? a.getObjects() : [a];
      for (const o of targets) {
        if (o.locked) continue;
        if (o.shapeText && ['fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'underline', 'linethrough', 'textAlign', 'charSpacing', 'lineHeight'].includes(prop)) {
          const tx = o.getObjects()[1];
          tx.set(prop, value);
          tx.initDimensions();
          o.triggerLayout?.();
          o.set('dirty', true);
          continue;
        }
        let v = value;
        if (Array.isArray(value) && (prop === 'fill' || prop === 'stroke')) v = objGradient(value);
        if (prop === 'fill' && isLineLike(o)) { o.set('stroke', v); continue; }
        if (isText(o) && charProps.includes(prop) && o.styles && Object.keys(o.styles).length) {
          // clear per-character overrides for this property so the change is visible
          for (const line of Object.values(o.styles)) for (const ch of Object.values(line)) delete ch[prop];
        }
        o.set(prop, v);
        if (prop === 'rx') o.set('ry', v);
        if (isText(o)) o.initDimensions?.();
        o.setCoords();
      }
      if (a.type === 'activeselection') a.setCoords();
    }
    a.set('dirty', true);
    this.canvas.requestRenderAll();
    if (commit) this.commit();
    else { clearTimeout(this._propT); this._propT = setTimeout(() => this.commit(), 400); }
  }

  // ---------------------------------------------------------------- arrange / align
  arrange(kind) {
    const a = this.canvas.getActiveObject();
    if (!a) return;
    const c = this.canvas;
    if (kind === 'front') c.bringObjectToFront(a);
    if (kind === 'back') c.sendObjectToBack(a);
    if (kind === 'forward') c.bringObjectForward(a);
    if (kind === 'backward') c.sendObjectBackwards(a);
    c.requestRenderAll();
    this.commit();
  }

  align(kind) {
    const a = this.canvas.getActiveObject();
    if (!a) return;
    const move = (o, box) => {
      o.setCoords();
      const b = o.getBoundingRect();
      let dx = 0, dy = 0;
      if (kind === 'left') dx = box.left - b.left;
      if (kind === 'center') dx = box.left + box.width / 2 - (b.left + b.width / 2);
      if (kind === 'right') dx = box.left + box.width - (b.left + b.width);
      if (kind === 'top') dy = box.top - b.top;
      if (kind === 'middle') dy = box.top + box.height / 2 - (b.top + b.height / 2);
      if (kind === 'bottom') dy = box.top + box.height - (b.top + b.height);
      o.set({ left: o.left + dx, top: o.top + dy });
      o.setCoords();
    };
    if (a.type === 'activeselection') {
      const objs = a.getObjects();
      const box = a.getBoundingRect();
      this.canvas.discardActiveObject();
      objs.forEach((o) => move(o, box));
      this.canvas.setActiveObject(new ActiveSelection(objs, { canvas: this.canvas }));
    } else {
      move(a, { left: 0, top: 0, width: this.W, height: this.H });
    }
    this.canvas.requestRenderAll();
    this.commit();
  }

  toggleLock() {
    const a = this.canvas.getActiveObject();
    if (!a) return;
    const targets = a.type === 'activeselection' ? a.getObjects() : [a];
    const l = !targets.every((o) => o.locked);
    targets.forEach((o) => { o.locked = l; this.applyLock(o); });
    if (a.type === 'activeselection') this.applyLock(Object.assign(a, { locked: l }));
    this.canvas.requestRenderAll();
    this.commit();
  }

  flip(axis) {
    const a = this.canvas.getActiveObject();
    if (!a) return;
    a.set(axis, !a[axis]);
    this.canvas.requestRenderAll();
    this.commit();
  }

  // ---------------------------------------------------------------- context bar
  selectionKind() {
    const a = this.canvas.getActiveObject();
    if (!a) return 'page';
    if (a.type === 'activeselection') return 'multi';
    if (a.locked) return 'locked';
    if (isText(a)) return 'text';
    if (a.smart) return 'smart';
    if (isImage(a)) return 'image';
    if (a.shapeText) return 'shapeText';
    if (a.type === 'group') return 'group';
    if (isLineLike(a)) return 'line';
    return 'shape';
  }

  renderCtx() {
    const bar = this.$('[data-ctx]');
    if (!bar) return;
    const a = this.canvas.getActiveObject();
    const kind = this.selectionKind();
    const sw = (prop, v, title) => `<button class="swatch-btn" data-act="color:${prop}" title="${title}"><span style="background:${colorCss(v)}"></span></button>`;
    const btn = (act, ic, title, active = false, label = '') => `<button class="tool ${active ? 'on' : ''}" data-act="${act}" title="${title}">${icon(ic, 18)}${label ? `<span>${label}</span>` : ''}</button>`;
    const common = () => `
      <span class="grow"></span>
      ${a && a.type !== 'activeselection' ? btn('copy-style', 'paint', 'คัดลอกสไตล์ แล้วคลิกวัตถุอื่นเพื่อวาง') : ''}
      ${a && a.type !== 'activeselection' ? btn('pop:link', 'link', a.link ? 'ลิงก์: ' + a.link : 'ใส่ลิงก์', !!a.link) : ''}
      ${btn('pop:opacity', 'opacity', 'ความโปร่งใส')}
      ${btn('pop:position', 'position', 'ตำแหน่ง', false, 'ตำแหน่ง')}
      ${btn('duplicate', 'copy', 'ทำสำเนา (Ctrl+D)')}
      ${btn('lock', a && a.locked ? 'lock' : 'unlock', a && a.locked ? 'ปลดล็อก' : 'ล็อก')}
      ${btn('delete', 'trash', 'ลบ (Delete)')}`;
    let html = '';
    if (this._crop) {
      bar.innerHTML = `<span class="ctx-label">✂ ลากขอบกรอบเพื่อครอบตัด · ลากรูปจางเพื่อเลื่อนตำแหน่งรูป</span>
        ${btn('crop-ratio:0', 'crop', 'อิสระ', false, 'อิสระ')}
        <button class="tool" data-act="crop-ratio:1" title="จัตุรัส"><span>1:1</span></button>
        <button class="tool" data-act="crop-ratio:1.7778" title="16:9"><span>16:9</span></button>
        <button class="tool" data-act="crop-ratio:0.8" title="4:5"><span>4:5</span></button>
        <button class="tool" data-act="crop-reset" title="กลับเป็นรูปเต็ม"><span>รีเซ็ต</span></button>
        <button class="tool" data-act="crop-pct" title="ปรับเป็นเปอร์เซ็นต์ด้วยสไลเดอร์"><span>%</span></button>
        <span class="grow"></span>
        <button class="tool" data-act="crop-cancel" title="ยกเลิก (Esc)"><span>ยกเลิก</span></button>
        <button class="btn primary sm" data-act="crop-done" title="เสร็จสิ้น (Enter)">เสร็จสิ้น</button>`;
      bar.dataset.kind = 'crop';
      return;
    }
    if (kind === 'page') {
      const bg = this.canvas.backgroundImage ? 'transparent' : this.canvas.backgroundColor;
      html = `${sw('bg', bg, 'สีพื้นหลัง')}<span class="ctx-label">สีพื้นหลัง</span>
        ${this.canvas.backgroundImage ? `<button class="tool" data-act="bg-remove-image">${icon('close', 16)}<span>ลบภาพพื้นหลัง</span></button>` : ''}
        <span class="grow"></span>
        <span class="ctx-hint hide-sm">${this.W} × ${this.H} px · หน้า ${this.cur + 1}/${this.design.pages.length}</span>`;
    } else if (kind === 'locked') {
      html = `<span class="ctx-label">🔒 ล็อกอยู่</span><span class="grow"></span>${btn('lock', 'lock', 'ปลดล็อก', false, 'ปลดล็อก')}`;
    } else if (kind === 'multi') {
      html = `${btn('group', 'group', 'จัดกลุ่ม (Ctrl+G)', false, 'จัดกลุ่ม')}
        ${btn('align:left', 'alignLeft', 'ชิดซ้าย')}${btn('align:center', 'alignCenter', 'กึ่งกลางแนวนอน')}${btn('align:right', 'alignRight', 'ชิดขวา')}
        ${btn('align:top', 'alignTop', 'ชิดบน')}${btn('align:middle', 'alignMiddle', 'กึ่งกลางแนวตั้ง')}${btn('align:bottom', 'alignBottom', 'ชิดล่าง')}
        ${btn('distribute:h', 'distH', 'เว้นระยะแนวนอนเท่ากัน')}${btn('distribute:v', 'distV', 'เว้นระยะแนวตั้งเท่ากัน')}
        ${common()}`;
    } else if (kind === 'smart') {
      const label = SMART_LABEL[a.smart.type] || 'องค์ประกอบ';
      html = a.smart.type === 'mockup' ? `${btn('mock-img', 'replace', 'เปลี่ยนรูปในม็อกอัป', false, 'เปลี่ยนรูป')}
        <select class="select" data-mock-device aria-label="อุปกรณ์">${MOCKUPS.map(([k, , l]) => `<option value="${k}" ${a.smart.device === k ? 'selected' : ''}>${l}</option>`).join('')}</select>
        ${btn('pop:effects', 'effects', 'เงา', false, 'เอฟเฟกต์')}${common()}` : a.smart.type === 'icon' ? `${sw('iconColor', a.smart.color, 'สีไอคอน')}
        <label class="mini">เส้นหนา <input type="range" min="0.5" max="4" step="0.1" value="${a.smart.weight || 1.8}" data-icon-weight></label>
        ${btn('flip:flipX', 'flipH', 'พลิกแนวนอน')}${common()}` : `<button class="btn sm primary-soft" data-act="smart-edit">${icon('pen', 16)} แก้ไข${label}</button>
        ${btn('pop:effects', 'effects', 'เงา', false, 'เอฟเฟกต์')}
        ${common()}`;
    } else if (kind === 'shapeText') {
      const [sh, tx] = a.getObjects();
      html = `<button class="btn sm primary-soft" data-act="shape-text-edit">${icon('text', 16)} แก้ไขข้อความ</button>
        ${sw('shapeFill', sh.fill, 'สีรูปทรง')}${sw('textFill', tx.fill, 'สีตัวอักษร')}
        <button class="font-btn" data-act="pop:font" title="แบบอักษร" style="font-family:'${esc(tx.fontFamily)}'">${esc(tx.fontFamily)} ${icon('down', 14)}</button>
        ${btn('ungroup', 'ungroup', 'แยกข้อความออกจากรูปทรง', false, 'แยก')}
        ${common()}`;
    } else if (kind === 'group') {
      html = `${a.graphic && a.graphic.mono ? sw('graphic', a.graphic.color, 'สีกราฟิก') : ''}${btn('ungroup', 'ungroup', 'ยกเลิกกลุ่ม (Ctrl+Shift+G)', false, 'ยกเลิกกลุ่ม')}
        ${btn('flip:flipX', 'flipH', 'พลิกแนวนอน')}${btn('flip:flipY', 'flipV', 'พลิกแนวตั้ง')}${common()}`;
    } else if (kind === 'text') {
      const fam = a.fontFamily;
      const align = a.textAlign || 'left';
      const alignIc = { left: 'alignLeft', center: 'alignCenter', right: 'alignRight', justify: 'alignJustify' }[align] || 'alignLeft';
      html = `
        <button class="font-btn" data-act="pop:font" title="แบบอักษร" style="font-family:'${esc(fam)}'">${esc(fam)} ${icon('down', 14)}</button>
        <div class="num">
          <button data-act="fs:-" title="ลดขนาด">−</button>
          <input data-fs type="number" min="1" value="${round(a.fontSize)}" aria-label="ขนาดตัวอักษร" />
          <button data-act="fs:+" title="เพิ่มขนาด">+</button>
        </div>
        ${sw('fill', a.fill, 'สีตัวอักษร')}
        ${btn('toggle:bold', 'bold', 'ตัวหนา', a.fontWeight === 'bold' || +a.fontWeight >= 600)}
        ${btn('toggle:italic', 'italic', 'ตัวเอียง', a.fontStyle === 'italic')}
        ${btn('toggle:underline', 'underline', 'ขีดเส้นใต้', a.underline)}
        ${btn('toggle:linethrough', 'strike', 'ขีดฆ่า', a.linethrough)}
        ${btn('text-align', alignIc, 'จัดตำแหน่งข้อความ')}
        ${btn('text-case', 'case', 'ตัวพิมพ์ใหญ่/เล็ก')}
        ${btn('list', 'list', 'รายการ: จุด → ตัวเลข → เช็กบ็อกซ์ → ปกติ', !!a.listType)}
        ${a.listType === 'check' ? btn('check-item', 'check', 'ติ๊กถูก/เอาออก (บรรทัดที่เคอร์เซอร์อยู่ หรือทั้งหมด)') : ''}
        ${btn('pop:spacing', 'spacing', 'ระยะห่าง')}
        ${btn('pop:effects', 'effects', 'เอฟเฟกต์', false, 'เอฟเฟกต์')}
        ${common()}`;
    } else if (kind === 'image') {
      html = `
        ${btn('replace-img', 'replace', 'แทนที่รูป (คงขนาดและกรอบเดิม)', false, 'แทนที่รูป')}
        ${btn('pop:adjust', 'adjust', 'ปรับแต่งรูป', false, 'ปรับแต่ง')}
        ${btn('crop-mode', 'crop', 'ครอบตัด (ลากขอบบนรูป · ดับเบิลคลิกรูปก็ได้)', false, 'ครอบตัด')}
        ${btn('pop:mask', 'border', 'รูปทรงกรอบ', false, 'กรอบ')}
        ${btn('flip:flipX', 'flipH', 'พลิกแนวนอน')}${btn('flip:flipY', 'flipV', 'พลิกแนวตั้ง')}
        ${btn('pop:effects', 'effects', 'เงา/ขอบ', false, 'เอฟเฟกต์')}
        ${btn('img-bg', 'image', 'ตั้งเป็นพื้นหลัง', false, 'เป็นพื้นหลัง')}
        ${btn('pop:alt', 'info', a.alt ? 'ข้อความแทนรูป: ' + a.alt : 'ข้อความแทนรูป (Alt text) สำหรับผู้พิการทางสายตา', !!a.alt, 'Alt')}
        ${common()}`;
    } else if (kind === 'line') {
      const dash = a.strokeDashArray ? (a.strokeDashArray[0] < 1 ? 'dot' : 'dash') : 'solid';
      html = `${sw('stroke', a.stroke, 'สีเส้น')}
        <label class="mini">หนา <input type="range" min="1" max="${Math.round(this.U * 0.05)}" value="${a.strokeWidth}" data-range="strokeWidth"></label>
        <select class="select" data-select="dash" aria-label="รูปแบบเส้น">
          <option value="solid" ${dash === 'solid' ? 'selected' : ''}>เส้นทึบ</option>
          <option value="dash" ${dash === 'dash' ? 'selected' : ''}>เส้นประ</option>
          <option value="dot" ${dash === 'dot' ? 'selected' : ''}>เส้นจุด</option>
        </select>
        ${btn('flip:flipX', 'flipH', 'พลิกแนวนอน')}
        ${common()}`;
    } else {
      html = `${sw('fill', a.fill, 'สีพื้น')}
        ${sw('stroke', a.stroke, 'สีเส้นขอบ')}
        <label class="mini">ขอบ <input type="range" min="0" max="${Math.round(this.U * 0.04)}" value="${a.strokeWidth || 0}" data-range="strokeWidth"></label>
        ${a.type === 'rect' ? `<label class="mini">มุมมน <input type="range" min="0" max="${Math.round(Math.min(a.width, a.height) / 2)}" value="${a.rx || 0}" data-range="rx"></label>` : ''}
        ${btn('flip:flipX', 'flipH', 'พลิกแนวนอน')}${btn('flip:flipY', 'flipV', 'พลิกแนวตั้ง')}
        ${btn('pop:effects', 'effects', 'เงา', false, 'เอฟเฟกต์')}
        ${common()}`;
    }
    bar.innerHTML = html;
    bar.dataset.kind = kind;

    const fs = bar.querySelector('[data-fs]');
    if (fs) fs.addEventListener('change', () => this.setProp('fontSize', Math.max(1, +fs.value || 1)));
    bar.querySelectorAll('[data-range]').forEach((r) => {
      r.addEventListener('input', () => this.setProp(r.dataset.range, +r.value, { commit: false }));
    });
    const md = bar.querySelector('[data-mock-device]');
    if (md) md.addEventListener('change', () => this.rebuildSmart(a, { ...a.smart, device: md.value }));
    const iw = bar.querySelector('[data-icon-weight]');
    if (iw) iw.addEventListener('change', () => this.rebuildSmart(a, { ...a.smart, weight: +iw.value }));
    const ds = bar.querySelector('[data-select="dash"]');
    if (ds) ds.addEventListener('change', () => {
      const w = a.strokeWidth || 4;
      this.setProp('strokeDashArray', ds.value === 'solid' ? null : ds.value === 'dash' ? [w * 3, w * 2] : [0.1, w * 2]);
      if (ds.value === 'dot') this.setProp('strokeLineCap', 'round');
    });
  }

  ctxAction(act, btn) {
    const a = this.canvas.getActiveObject();
    const [k, arg] = act.split(':');
    switch (k) {
      case 'color': return this.openColorPopover(btn, arg);
      case 'pop': return this.openPop(arg, btn);
      case 'duplicate': return this.duplicate();
      case 'crop-mode': return this.startCrop(a);
      case 'crop-done': return this.endCrop(true);
      case 'crop-cancel': return this.endCrop(false);
      case 'crop-reset': return this.cropReset();
      case 'crop-pct': {
        this.endCrop(true);
        return this.openImagePopover('crop', this.$('[data-ctx] [data-act="crop-mode"]'));
      }
      case 'crop-ratio': return this.cropRatio(+arg);
      case 'smart-edit': return this.openSmartEditor();
      case 'shape-text-edit': return this.editShapeText(this.canvas.getActiveObject());
      case 'replace-img': return this.pickReplaceImage();
      case 'mock-img': return this.pickMockupImage();
      case 'list': return this.toggleList();
      case 'check-item': return this.toggleCheck();
      case 'distribute': return this.distribute(arg);
      case 'copy-style': return this.copyStyle();
      case 'delete': return this.deleteSelection();
      case 'lock': return this.toggleLock();
      case 'group': return this.group();
      case 'ungroup': return this.ungroup();
      case 'flip': return this.flip(arg);
      case 'align': return this.align(arg);
      case 'arrange': return this.arrange(arg);
      case 'bg-remove-image':
        this.canvas.backgroundImage = null;
        if (!this.canvas.backgroundColor) this.canvas.backgroundColor = '#ffffff';
        this.canvas.requestRenderAll();
        return this.commit();
      case 'img-bg': {
        if (!isImage(a)) return;
        const src = a.getSrc();
        this.canvas.remove(a);
        return this.setBackgroundImage(src);
      }
      case 'fs': {
        if (!a) return;
        const s = a.fontSize;
        const step = s < 24 ? 1 : s < 80 ? 2 : 4;
        return this.setProp('fontSize', Math.max(1, round(s + (arg === '+' ? step : -step))));
      }
      case 'toggle': {
        if (!a) return;
        if (arg === 'bold') return this.setProp('fontWeight', a.fontWeight === 'bold' || +a.fontWeight >= 600 ? 'normal' : 'bold');
        if (arg === 'italic') return this.setProp('fontStyle', a.fontStyle === 'italic' ? 'normal' : 'italic');
        return this.setProp(arg, !a[arg]);
      }
      case 'text-align': {
        const order = ['left', 'center', 'right', 'justify'];
        return this.setProp('textAlign', order[(order.indexOf(a.textAlign) + 1) % order.length]);
      }
      case 'text-case': {
        const t = a.text;
        const up = t.toUpperCase();
        return this.setProp('text', t === up ? t.toLowerCase() : up);
      }
      default: return false;
    }
  }

  // ---------------------------------------------------------------- popovers
  openColorPopover(btn, prop) {
    const a = this.canvas.getActiveObject();
    const isBg = prop === 'bg';
    let cur;
    if (isBg) cur = this.canvas.backgroundColor;
    else if (prop === 'iconColor') cur = a?.smart?.color;
    else if (prop === 'shapeFill') cur = a?.getObjects?.()[0]?.fill;
    else if (prop === 'textFill') cur = a?.getObjects?.()[1]?.fill;
    else if (prop === 'shadow') cur = a?.shadow?.color;
    else cur = a?.[prop];
    const allowNone = prop === 'stroke' || prop === 'textBackgroundColor' || prop === 'fill';
    const iconTarget = prop === 'iconColor' ? a : null;
    const allowGrad = (prop === 'fill' && !isLineLike(a)) || isBg;
    const docColors = this.documentColors();
    const el = popover(btn, `
      <div class="color-pop">
        <div class="cp-title">ชุดสีแบรนด์ของฉัน <button class="link" data-brand-clear ${this.brandColors().length ? '' : 'hidden'}>ล้าง</button></div>
        <div class="swatches">${this.brandColors().map((c) => `<button class="sw" data-c="${c}" style="background:${c}" title="${c}"></button>`).join('')}<button class="sw add" data-brand-add title="เพิ่มสีที่เลือกอยู่ลงชุดสีแบรนด์">+</button></div>
        ${docColors.length ? `<div class="cp-title">สีในงานนี้</div><div class="swatches">${docColors.map((c) => `<button class="sw" data-c="${c}" style="background:${c}" title="${c}"></button>`).join('')}</div>` : ''}
        <div class="cp-title">สีพื้นฐาน</div>
        <div class="swatches">
          ${allowNone ? `<button class="sw none" data-c="" title="ไม่มีสี"></button>` : ''}
          ${COLORS.map((c) => `<button class="sw" data-c="${c}" style="background:${c}" title="${c}"></button>`).join('')}
        </div>
        ${allowGrad ? `<div class="cp-title">ไล่เฉดสี</div><div class="swatches">${GRADS.map((g, i) => `<button class="sw" data-g="${i}" style="background:linear-gradient(135deg,${g[0]},${g[1]})"></button>`).join('')}</div>` : ''}
        <div class="cp-custom">
          <input type="color" data-picker value="${toHex(typeof cur === 'string' ? cur : '#7c5cff')}" aria-label="เลือกสีเอง" />
          <input class="input" data-hex value="${typeof cur === 'string' ? esc(cur) : ''}" placeholder="#RRGGBB" aria-label="รหัสสี" />
        </div>
      </div>`, { key: isBg ? 'color-bg' : 'color' });
    const apply = (v, final = true) => {
      if (isBg) {
        if (Array.isArray(v)) this.setBackground(v);
        else if (final) this.setBackground(v || '#ffffff');
        else { this.canvas.backgroundColor = v; this.canvas.backgroundImage = null; this.canvas.requestRenderAll(); }
      } else if (prop === 'shapeFill' || prop === 'textFill') {
        const child = a.getObjects()[prop === 'shapeFill' ? 0 : 1];
        child.set('fill', Array.isArray(v) ? objGradient(v) : v || 'transparent');
        a.set('dirty', true);
        this.canvas.requestRenderAll();
        if (final) this.commit();
      } else if (prop === 'iconColor') {
        if (final && v && iconTarget && iconTarget.canvas) this.rebuildSmart(iconTarget, { ...iconTarget.smart, color: v }).then((n) => { if (n) this.renderCtx(); });
      } else if (prop === 'graphic') {
        if (v && !Array.isArray(v)) { recolorGraphic(a, v); this.canvas.requestRenderAll(); if (final) this.commit(); }
      } else if (prop === 'shadow') {
        const sh = a.shadow;
        if (sh) { sh.color = v; a.set('dirty', true); this.canvas.requestRenderAll(); if (final) this.commit(); }
      } else {
        this.setProp(prop, v === '' ? (prop === 'fill' ? 'transparent' : null) : v, { commit: final });
        if (prop === 'stroke' && v && !(a.strokeWidth > 0) && !isLineLike(a)) this.setProp('strokeWidth', Math.max(2, round(this.U * 0.006)));
      }
      const span = btn.querySelector('span');
      if (span) span.style.background = colorCss(Array.isArray(v) ? { colorStops: [{ color: v[0], offset: 0 }, { color: v[1], offset: 1 }] } : v);
    };
    el.addEventListener('click', (e) => {
      if (e.target.closest('[data-brand-add]')) {
        this.addBrandColor(el.querySelector('[data-picker]').value);
        toast('เพิ่มสีลงชุดสีแบรนด์แล้ว');
        return this.openColorPopover(btn, prop);
      }
      if (e.target.closest('[data-brand-clear]')) { this.clearBrandColors(); return this.openColorPopover(btn, prop); }
      const s = e.target.closest('[data-c],[data-g]');
      if (!s) return;
      if (s.dataset.g !== undefined) apply(GRADS[+s.dataset.g]);
      else apply(s.dataset.c);
    });
    const picker = el.querySelector('[data-picker]');
    const hex = el.querySelector('[data-hex]');
    picker.addEventListener('input', () => { hex.value = picker.value; apply(picker.value, false); });
    picker.addEventListener('change', () => apply(picker.value, true));
    hex.addEventListener('change', () => { const v = hex.value.trim(); if (/^#?[0-9a-f]{3,8}$/i.test(v)) apply(v.startsWith('#') ? v : '#' + v); });
  }

  documentColors() {
    const set = new Set();
    const walk = (o) => {
      for (const p of ['fill', 'stroke']) if (typeof o[p] === 'string' && /^#/.test(o[p])) set.add(o[p].toLowerCase());
      if (o.getObjects) o.getObjects().forEach(walk);
    };
    this.canvas.getObjects().forEach(walk);
    if (typeof this.canvas.backgroundColor === 'string') set.add(this.canvas.backgroundColor.toLowerCase());
    return [...set].slice(0, 18);
  }

  openPop(kind, btn) {
    const a = this.canvas.getActiveObject();
    if (!a && kind !== 'opacity') return;
    if (kind === 'font') return this.openFontPopover(btn);
    if (kind === 'opacity') {
      const el = popover(btn, `<div class="pad"><label class="slider-row">ความโปร่งใส <input type="range" min="0" max="100" value="${Math.round((a.opacity ?? 1) * 100)}" data-r><output>${Math.round((a.opacity ?? 1) * 100)}</output></label></div>`, { key: 'opacity', align: 'right' });
      const r = el.querySelector('[data-r]');
      r.addEventListener('input', () => { el.querySelector('output').textContent = r.value; this.setProp('opacity', r.value / 100, { commit: false }); });
      return;
    }
    if (kind === 'spacing') {
      const el = popover(btn, `<div class="pad">
        <label class="slider-row">ระยะห่างตัวอักษร <input type="range" min="-100" max="800" value="${a.charSpacing || 0}" data-p="charSpacing"><output>${a.charSpacing || 0}</output></label>
        <label class="slider-row">ระยะห่างบรรทัด <input type="range" min="0.5" max="3" step="0.05" value="${a.lineHeight}" data-p="lineHeight"><output>${a.lineHeight}</output></label>
      </div>`, { key: 'spacing' });
      el.querySelectorAll('[data-p]').forEach((r) => r.addEventListener('input', () => {
        r.nextElementSibling.textContent = r.value;
        this.setProp(r.dataset.p, +r.value, { commit: false });
      }));
      return;
    }
    if (kind === 'position') return this.openPositionPopover(btn);
    if (kind === 'link') return this.openLinkPopover(btn);
    if (kind === 'alt') return this.openAltPopover(btn);
    if (kind === 'effects') return this.openEffectsPopover(btn);
    if (kind === 'adjust' || kind === 'crop' || kind === 'mask') return this.openImagePopover(kind, btn);
  }

  openFontPopover(btn) {
    linkAllFonts();
    const a = this.canvas.getActiveObject();
    const groups = ['ไทย', 'อังกฤษ'];
    const el = popover(btn, `
      <div class="font-pop">
        <input class="input full" data-q placeholder="ค้นหาแบบอักษร…" aria-label="ค้นหาแบบอักษร" />
        <div class="font-list" data-list>
          ${(() => { const bf = [...new Set(Object.values(this.brandFonts()))]; return bf.length ? `<div class="cp-title">★ ฟอนต์แบรนด์</div>` + bf.map((f) => `<button class="font-item brand ${f === a.fontFamily ? 'on' : ''}" data-f="${esc(f)}" style="font-family:'${esc(f)}'">${esc(f)} <small>แบรนด์</small></button>`).join('') : ''; })()}
          ${groups.map((g) => `<div class="cp-title">${g === 'ไทย' ? 'รองรับภาษาไทย' : 'ภาษาอังกฤษ'}</div>` +
            FONTS.filter((f) => f[2] === g).map(([f]) => `<button class="font-item ${f === a.fontFamily ? 'on' : ''}" data-f="${esc(f)}" style="font-family:'${esc(f)}'">${esc(f)} <small>${g === 'ไทย' ? 'สวัสดี' : 'Hello'}</small></button>`).join('')).join('')}
        </div>
      </div>`, { key: 'font' });
    const q = el.querySelector('[data-q]');
    q.focus();
    q.addEventListener('input', () => {
      const s = q.value.toLowerCase();
      el.querySelectorAll('[data-f]').forEach((b) => { b.hidden = !b.dataset.f.toLowerCase().includes(s); });
    });
    el.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-f]');
      if (!b) return;
      el.querySelectorAll('.font-item.on').forEach((x) => x.classList.remove('on'));
      b.classList.add('on');
      const f = b.dataset.f;
      await Promise.race([ensureFont(f), new Promise((r) => setTimeout(r, 3000))]);
      this.setProp('fontFamily', f);
      ensureFont(f).then(() => this.refreshTexts());
    });
  }

  openPositionPopover(btn) {
    const a = this.canvas.getActiveObject();
    a.setCoords();
    const b = a.getBoundingRect();
    const el = popover(btn, `
      <div class="pad pos-pop">
        <div class="cp-title">ลำดับชั้น</div>
        <div class="grid2">
          <button class="btn sm" data-a="arrange:forward">${icon('up', 16)} เลื่อนขึ้น</button>
          <button class="btn sm" data-a="arrange:backward">${icon('down', 16)} เลื่อนลง</button>
          <button class="btn sm" data-a="arrange:front">⤒ บนสุด</button>
          <button class="btn sm" data-a="arrange:back">⤓ ล่างสุด</button>
        </div>
        <div class="cp-title">จัดแนว${a.type === 'activeselection' ? 'ภายในกลุ่มที่เลือก' : 'กับหน้า'}</div>
        <div class="grid3">
          <button class="btn sm" data-a="align:left">${icon('alignLeft', 16)} ซ้าย</button>
          <button class="btn sm" data-a="align:center">${icon('alignCenter', 16)} กึ่งกลาง</button>
          <button class="btn sm" data-a="align:right">${icon('alignRight', 16)} ขวา</button>
          <button class="btn sm" data-a="align:top">บน</button>
          <button class="btn sm" data-a="align:middle">กลาง</button>
          <button class="btn sm" data-a="align:bottom">ล่าง</button>
        </div>
        ${a.type === 'activeselection' ? `<div class="cp-title">เว้นระยะเท่ากัน</div><div class="grid2"><button class="btn sm" data-a="distribute:h">↔ แนวนอน</button><button class="btn sm" data-a="distribute:v">↕ แนวตั้ง</button></div>` : ''}
        <div class="cp-title">ขนาดและตำแหน่ง (px)</div>
        <div class="grid2 fields">
          <label>กว้าง <input class="input" type="number" data-f="w" value="${round(b.width)}"></label>
          <label>สูง <input class="input" type="number" data-f="h" value="${round(b.height)}"></label>
          <label>X <input class="input" type="number" data-f="x" value="${round(b.left)}"></label>
          <label>Y <input class="input" type="number" data-f="y" value="${round(b.top)}"></label>
          <label>หมุน° <input class="input" type="number" data-f="angle" value="${round(a.angle || 0)}"></label>
        </div>
      </div>`, { key: 'position', align: 'right' });
    el.addEventListener('click', (e) => {
      const x = e.target.closest('[data-a]');
      if (!x) return;
      const [k, v] = x.dataset.a.split(':');
      if (k === 'arrange') this.arrange(v);
      else if (k === 'distribute') this.distribute(v);
      else this.align(v);
    });
    el.querySelectorAll('[data-f]').forEach((inp) => inp.addEventListener('change', () => {
      const o = this.canvas.getActiveObject();
      if (!o) return;
      o.setCoords();
      const bb = o.getBoundingRect();
      const v = +inp.value;
      const f = inp.dataset.f;
      if (f === 'x') o.set('left', o.left + (v - bb.left));
      if (f === 'y') o.set('top', o.top + (v - bb.top));
      if (f === 'angle') o.rotate(v);
      if (f === 'w' && v > 0) { const k = v / bb.width; if (isText(o)) { o.set('width', o.width * k); } else o.set('scaleX', o.scaleX * k); }
      if (f === 'h' && v > 0) { const k = v / bb.height; if (isText(o)) o.set('fontSize', o.fontSize * k); else o.set('scaleY', o.scaleY * k); }
      if (isText(o)) o.initDimensions();
      o.setCoords();
      this.canvas.requestRenderAll();
      this.commit();
    }));
  }

  openEffectsPopover(btn) {
    const a = this.canvas.getActiveObject();
    const sh = a.shadow;
    const U = this.U;
    const text = isText(a);
    const el = popover(btn, `
      <div class="pad fx-pop">
        <div class="cp-title">สไตล์สำเร็จรูป</div>
        <div class="fx-presets">
          <button data-fx="none">ไม่มี</button>
          <button data-fx="shadow">เงา</button>
          <button data-fx="lift">ยกลอย</button>
          ${text ? '<button data-fx="outline">ขอบ</button><button data-fx="hollow">กลวง</button><button data-fx="splice">ตัดซ้อน</button><button data-fx="echo">เงาสะท้อน</button><button data-fx="glitch">กลิตช์</button><button data-fx="neon">นีออน</button><button data-fx="highlight">ไฮไลต์</button>' : ''}
        </div>
        <div class="cp-title">เงา</div>
        <label class="toggle-row"><input type="checkbox" data-sh-on ${sh ? 'checked' : ''}> เปิดเงา <button class="swatch-btn sm" data-sh-color title="สีเงา"><span style="background:${sh ? sh.color : 'rgba(0,0,0,.35)'}"></span></button></label>
        <label class="slider-row">ความเบลอ <input type="range" min="0" max="${Math.round(U * 0.08)}" value="${sh ? sh.blur : U * 0.02}" data-sh="blur"></label>
        <label class="slider-row">เลื่อน X <input type="range" min="${-Math.round(U * 0.05)}" max="${Math.round(U * 0.05)}" value="${sh ? sh.offsetX : U * 0.008}" data-sh="offsetX"></label>
        <label class="slider-row">เลื่อน Y <input type="range" min="${-Math.round(U * 0.05)}" max="${Math.round(U * 0.05)}" value="${sh ? sh.offsetY : U * 0.008}" data-sh="offsetY"></label>
        ${text ? `
        <div class="cp-title">ขอบตัวอักษร</div>
        <label class="toggle-row">สีขอบ <button class="swatch-btn sm" data-act-color="stroke"><span style="background:${colorCss(a.stroke)}"></span></button></label>
        <label class="slider-row">ความหนา <input type="range" min="0" max="${Math.max(10, Math.round(a.fontSize * 0.15))}" step="0.5" value="${a.strokeWidth || 0}" data-p="strokeWidth"></label>
        <div class="cp-title">ข้อความโค้ง</div>
        <label class="slider-row">ความโค้ง <input type="range" min="-100" max="100" value="${a.curve || 0}" data-curve><output>${a.curve || 0}</output></label>
        <div class="cp-title">พื้นหลังข้อความ</div>
        <label class="toggle-row">สีไฮไลต์ <button class="swatch-btn sm" data-act-color="textBackgroundColor"><span style="background:${colorCss(a.textBackgroundColor)}"></span></button></label>` : ''}
      </div>`, { key: 'effects', align: 'right' });

    const ensureShadow = () => {
      if (!a.shadow) a.set('shadow', new Shadow({ color: 'rgba(0,0,0,0.35)', blur: U * 0.02, offsetX: U * 0.008, offsetY: U * 0.008 }));
      return a.shadow;
    };
    el.querySelector('[data-sh-on]').addEventListener('change', (e) => {
      if (e.target.checked) ensureShadow(); else a.set('shadow', null);
      a.set('dirty', true); this.canvas.requestRenderAll(); this.commit();
    });
    el.querySelectorAll('[data-sh]').forEach((r) => r.addEventListener('input', () => {
      const s = ensureShadow();
      s[r.dataset.sh] = +r.value;
      el.querySelector('[data-sh-on]').checked = true;
      a.set('dirty', true); this.canvas.requestRenderAll();
      clearTimeout(this._propT); this._propT = setTimeout(() => this.commit(), 400);
    }));
    el.querySelector('[data-sh-color]').addEventListener('click', (e) => { e.preventDefault(); ensureShadow(); this.openColorPopover(e.currentTarget, 'shadow'); });
    el.querySelectorAll('[data-act-color]').forEach((b) => b.addEventListener('click', (e) => { e.preventDefault(); this.openColorPopover(b, b.dataset.actColor); }));
    const cv = el.querySelector('[data-curve]');
    if (cv) cv.addEventListener('input', () => {
      cv.nextElementSibling.textContent = cv.value;
      this.setCurve(a, +cv.value);
      clearTimeout(this._propT); this._propT = setTimeout(() => this.commit(), 400);
    });
    el.querySelectorAll('[data-p]').forEach((r) => r.addEventListener('input', () => {
      this.setProp(r.dataset.p, +r.value, { commit: false });
      if (+r.value > 0 && !a.stroke) this.setProp('stroke', '#000000', { commit: false });
      if (text) this.setProp('paintFirst', 'stroke', { commit: false });
    }));
    el.querySelector('.fx-presets').addEventListener('click', (e) => {
      const fx = e.target.closest('[data-fx]')?.dataset.fx;
      if (!fx) return;
      const fs = text ? a.fontSize : U * 0.2;
      const set = (o) => { Object.entries(o).forEach(([k, v]) => a.set(k, v)); };
      const reset = { shadow: null };
      if (text) Object.assign(reset, { stroke: null, strokeWidth: 0, textBackgroundColor: '', paintFirst: 'fill' });
      set(reset);
      if (fx === 'shadow') set({ shadow: new Shadow({ color: 'rgba(0,0,0,0.35)', blur: fs * 0.1, offsetX: fs * 0.04, offsetY: fs * 0.04 }) });
      if (fx === 'lift') set({ shadow: new Shadow({ color: 'rgba(0,0,0,0.25)', blur: fs * 0.35, offsetX: 0, offsetY: fs * 0.12 }) });
      if (fx === 'outline') set({ stroke: '#ffffff', strokeWidth: fs * 0.06, paintFirst: 'stroke' });
      if (fx === 'hollow') set({ stroke: typeof a.fill === 'string' && a.fill !== 'transparent' ? a.fill : '#1f2333', strokeWidth: Math.max(1, fs * 0.025), fill: 'transparent' });
      const base = typeof a.fill === 'string' && a.fill !== 'transparent' ? a.fill : '#1f2333';
      if (fx === 'splice') set({ stroke: base, strokeWidth: Math.max(1, fs * 0.03), fill: 'transparent', shadow: new Shadow({ color: '#ffb020', blur: 0, offsetX: fs * 0.06, offsetY: fs * 0.06 }) });
      if (fx === 'echo') set({ shadow: new Shadow({ color: base.length === 7 ? base + '66' : 'rgba(0,0,0,0.4)', blur: 0, offsetX: fs * 0.08, offsetY: fs * 0.08 }) });
      if (fx === 'glitch') set({ shadow: new Shadow({ color: '#00e5ff', blur: 0, offsetX: -fs * 0.05, offsetY: 0 }), stroke: '#ff2bd6', strokeWidth: Math.max(1, fs * 0.015), paintFirst: 'stroke' });
      if (fx === 'neon') set({ fill: '#ffffff', shadow: new Shadow({ color: '#ff2bd6', blur: fs * 0.35, offsetX: 0, offsetY: 0 }) });
      if (fx === 'highlight') set({ textBackgroundColor: '#ffe066' });
      if (text) a.initDimensions();
      a.set('dirty', true);
      this.canvas.requestRenderAll();
      this.commit();
      closePopover();
    });
  }

  openImagePopover(kind, btn) {
    const a = this.canvas.getActiveObject();
    if (!isImage(a)) return;
    btn = btn || this.$(`[data-act="pop:${kind}"]`);
    if (!btn) return;
    if (kind === 'adjust') {
      const ADJ0 = { brightness: 0, contrast: 0, saturation: 0, blur: 0, hue: 0, warmth: 0, tint: 0, sharpen: 0, vignette: 0, pixelate: 0, grayscale: false, sepia: false, invert: false, duotone: false, duoDark: '#1d2b64', duoLight: '#f8cdda' };
      const adj = { ...ADJ0, ...(a.adj || {}) };
      const sl = (k, label, min = -100, max = 100) => `<label class="slider-row">${label} <input type="range" min="${min}" max="${max}" value="${adj[k]}" data-k="${k}"><output>${adj[k]}</output></label>`;
      const el = popover(btn, `
        <div class="pad">
          <div class="cp-title">ฟิลเตอร์</div>
          <div class="fx-presets">
            <button data-pre="none">ต้นฉบับ</button><button data-pre="bw">ขาวดำ</button><button data-pre="sepia">ซีเปีย</button>
            <button data-pre="vivid">สดใส</button><button data-pre="fade">ซีดจาง</button><button data-pre="dramatic">ดราม่า</button>
            <button data-pre="warm">อบอุ่น</button><button data-pre="cool">เย็นตา</button><button data-pre="retro">ย้อนยุค</button>
          </div>
          <div class="cp-title">ปรับแต่ง</div>
          ${sl('brightness', 'ความสว่าง')}${sl('contrast', 'คอนทราสต์')}${sl('saturation', 'ความอิ่มสี')}${sl('warmth', 'อุณหภูมิสี')}${sl('tint', 'ทินต์ (เขียว–ม่วง)')}${sl('hue', 'โทนสี', -180, 180)}
          ${sl('sharpen', 'ความคมชัด', 0, 100)}${sl('blur', 'เบลอ', 0, 100)}${sl('vignette', 'ขอบมืด (วิกเน็ต)', 0, 100)}${sl('pixelate', 'พิกเซล', 0, 40)}
          <div class="cp-title">ทูโทน (Duotone)</div>
          <label class="toggle-row"><input type="checkbox" data-t="duotone" ${adj.duotone ? 'checked' : ''}> เปิดทูโทน
            <input type="color" data-duo="duoDark" value="${adj.duoDark}" aria-label="สีเงา"> <input type="color" data-duo="duoLight" value="${adj.duoLight}" aria-label="สีสว่าง"></label>
          <label class="toggle-row"><input type="checkbox" data-t="grayscale" ${adj.grayscale ? 'checked' : ''}> ขาวดำ</label>
          <label class="toggle-row"><input type="checkbox" data-t="sepia" ${adj.sepia ? 'checked' : ''}> ซีเปีย</label>
          <label class="toggle-row"><input type="checkbox" data-t="invert" ${adj.invert ? 'checked' : ''}> กลับสี</label>
        </div>`, { key: 'adjust' });
      const apply = (final) => {
        a.adj = { ...adj };
        const f = [];
        if (adj.brightness) f.push(new filters.Brightness({ brightness: adj.brightness / 100 }));
        if (adj.contrast) f.push(new filters.Contrast({ contrast: adj.contrast / 100 }));
        if (adj.saturation) f.push(new filters.Saturation({ saturation: adj.saturation / 100 }));
        if (adj.hue) f.push(new filters.HueRotation({ rotation: adj.hue / 180 }));
        if (adj.warmth) f.push(warmthMatrix(adj.warmth / 100));
        if (adj.tint) f.push(tintMatrix(adj.tint / 100));
        if (adj.sharpen) f.push(sharpen(adj.sharpen));
        if (adj.blur) f.push(new filters.Blur({ blur: adj.blur / 200 }));
        if (adj.pixelate) f.push(new filters.Pixelate({ blocksize: Math.max(2, Math.round(adj.pixelate)) }));
        if (adj.duotone) f.push(duotoneMatrix(adj.duoDark, adj.duoLight));
        if (adj.vignette) f.push(new Vignette({ amount: adj.vignette / 100 }));
        if (adj.grayscale) f.push(new filters.Grayscale());
        if (adj.sepia) f.push(new filters.Sepia());
        if (adj.invert) f.push(new filters.Invert());
        a.filters = f;
        a.applyFilters();
        this.canvas.requestRenderAll();
        if (final) this.commit();
        else { clearTimeout(this._propT); this._propT = setTimeout(() => this.commit(), 400); }
      };
      const sync = () => {
        el.querySelectorAll('[data-k]').forEach((r) => { r.value = adj[r.dataset.k]; r.nextElementSibling.textContent = adj[r.dataset.k]; });
        el.querySelectorAll('[data-t]').forEach((c) => { c.checked = adj[c.dataset.t]; });
      };
      el.querySelectorAll('[data-k]').forEach((r) => r.addEventListener('input', () => { adj[r.dataset.k] = +r.value; r.nextElementSibling.textContent = r.value; apply(false); }));
      el.querySelectorAll('[data-t]').forEach((c) => c.addEventListener('change', () => { adj[c.dataset.t] = c.checked; apply(true); }));
      el.querySelectorAll('[data-duo]').forEach((c) => c.addEventListener('input', () => { adj[c.dataset.duo] = c.value; adj.duotone = true; el.querySelector('[data-t="duotone"]').checked = true; apply(false); }));
      el.querySelector('.fx-presets').addEventListener('click', (e) => {
        const p = e.target.closest('[data-pre]')?.dataset.pre;
        if (!p) return;
        Object.assign(adj, { ...ADJ0, duoDark: adj.duoDark, duoLight: adj.duoLight });
        if (p === 'warm') Object.assign(adj, { warmth: 45, saturation: 10 });
        if (p === 'cool') Object.assign(adj, { warmth: -45, tint: -10 });
        if (p === 'retro') Object.assign(adj, { sepia: true, vignette: 55, contrast: -10 });
        if (p === 'bw') Object.assign(adj, { grayscale: true, contrast: 10 });
        if (p === 'sepia') Object.assign(adj, { sepia: true });
        if (p === 'vivid') Object.assign(adj, { saturation: 40, contrast: 15, brightness: 3 });
        if (p === 'fade') Object.assign(adj, { saturation: -35, contrast: -20, brightness: 8 });
        if (p === 'dramatic') Object.assign(adj, { contrast: 45, saturation: -15, brightness: -8 });
        sync();
        apply(true);
      });
      return;
    }
    if (kind === 'crop') {
      const crop = { l: 0, r: 0, t: 0, b: 0, ...(a.crop || {}) };
      const sl = (k, label) => `<label class="slider-row">${label} <input type="range" min="0" max="90" value="${crop[k]}" data-k="${k}"><output>${crop[k]}%</output></label>`;
      const el = popover(btn, `<div class="pad">
        <div class="cp-title">ครอบตัดรูป (%)</div>
        ${sl('l', 'ซ้าย')}${sl('r', 'ขวา')}${sl('t', 'บน')}${sl('b', 'ล่าง')}
        <div class="fx-presets"><button data-ratio="1">จัตุรัส 1:1</button><button data-ratio="1.7778">16:9</button><button data-ratio="0.8">4:5</button><button data-ratio="0">รีเซ็ต</button></div>
      </div>`, { key: 'crop' });
      const apply = (final) => {
        const { width: nw, height: nh } = a.getOriginalSize();
        if (crop.l + crop.r > 95) crop.r = 95 - crop.l;
        if (crop.t + crop.b > 95) crop.b = 95 - crop.t;
        const ncx = (nw * crop.l) / 100, ncy = (nh * crop.t) / 100;
        const nw2 = nw * (1 - (crop.l + crop.r) / 100), nh2 = nh * (1 - (crop.t + crop.b) / 100);
        // keep the visible content anchored
        const m = a.calcTransformMatrix();
        const local = new Point(-a.width / 2 + (ncx - (a.cropX || 0)), -a.height / 2 + (ncy - (a.cropY || 0)));
        const anchor = util.transformPoint(local, m);
        a.set({ cropX: ncx, cropY: ncy, width: nw2, height: nh2 });
        a.crop = { ...crop };
        a.setPositionByOrigin(anchor, 'left', 'top');
        this.applyMask(a, a.mask);
        a.setCoords();
        a.set('dirty', true);
        this.canvas.requestRenderAll();
        if (final) this.commit();
        else { clearTimeout(this._propT); this._propT = setTimeout(() => this.commit(), 400); }
      };
      const sync = () => el.querySelectorAll('[data-k]').forEach((r) => { r.value = crop[r.dataset.k]; r.nextElementSibling.textContent = Math.round(crop[r.dataset.k]) + '%'; });
      el.querySelectorAll('[data-k]').forEach((r) => r.addEventListener('input', () => { crop[r.dataset.k] = +r.value; apply(false); sync(); }));
      el.querySelector('.fx-presets').addEventListener('click', (e) => {
        const r = e.target.closest('[data-ratio]')?.dataset.ratio;
        if (r === undefined) return;
        const ratio = +r;
        Object.assign(crop, { l: 0, r: 0, t: 0, b: 0 });
        if (ratio) {
          const { width: nw, height: nh } = a.getOriginalSize();
          if (nw / nh > ratio) { const cut = (1 - (nh * ratio) / nw) * 50; crop.l = crop.r = cut; }
          else { const cut = (1 - nw / ratio / nh) * 50; crop.t = crop.b = cut; }
        }
        sync();
        apply(true);
      });
      return;
    }
    if (kind === 'mask') {
      const el = popover(btn, `<div class="pad">
        <div class="cp-title">รูปทรงกรอบรูป</div>
        <div class="mask-grid">
          ${[['none', '▢', 'ไม่มี'], ['rounded', '▢', 'มุมมน'], ['circle', '●', 'วงกลม'], ['star', '★', 'ดาว'], ['heart', '♥', 'หัวใจ'], ['hexagon', '⬢', 'หกเหลี่ยม']]
            .map(([k, s, l]) => `<button class="${(a.mask || 'none') === k ? 'on' : ''}" data-m="${k}"><b>${s}</b>${l}</button>`).join('')}
        </div>
        <div class="cp-title">กรอบเส้น</div>
        <label class="toggle-row">สีกรอบ <button class="swatch-btn sm" data-act-color="stroke"><span style="background:${colorCss(a.stroke)}"></span></button></label>
        <label class="slider-row">ความหนา <input type="range" min="0" max="${Math.round(Math.min(a.width, a.height) * 0.1)}" value="${a.strokeWidth || 0}" data-p="strokeWidth"></label>
      </div>`, { key: 'mask' });
      el.querySelector('.mask-grid').addEventListener('click', (e) => {
        const m = e.target.closest('[data-m]')?.dataset.m;
        if (!m) return;
        el.querySelectorAll('.mask-grid .on').forEach((x) => x.classList.remove('on'));
        e.target.closest('[data-m]').classList.add('on');
        this.applyMask(a, m);
        this.canvas.requestRenderAll();
        this.commit();
      });
      el.querySelectorAll('[data-act-color]').forEach((b) => b.addEventListener('click', (e) => { e.preventDefault(); this.openColorPopover(b, b.dataset.actColor); }));
      el.querySelector('[data-p]').addEventListener('input', (e) => {
        if (!a.stroke) a.set('stroke', '#ffffff');
        this.setProp('strokeWidth', +e.target.value, { commit: false });
      });
    }
  }

  applyMask(img, kind) {
    img.mask = kind && kind !== 'none' ? kind : null;
    const w = img.width, hh = img.height, s = Math.min(w, hh);
    let cp = null;
    const base = { originX: 'center', originY: 'center', left: 0, top: 0 };
    if (kind === 'circle') cp = new Circle({ ...base, radius: s / 2 });
    if (kind === 'rounded') cp = new Rect({ ...base, width: w, height: hh, rx: s * 0.12, ry: s * 0.12 });
    if (kind === 'star' || kind === 'hexagon') {
      const n = kind === 'star' ? 10 : 6;
      const pts = Array.from({ length: n }, (_, i) => {
        const r = kind === 'star' && i % 2 ? s * 0.22 : s / 2;
        const ang = -Math.PI / 2 + (i * 2 * Math.PI) / n + (kind === 'hexagon' ? Math.PI / 6 : 0);
        return { x: r * Math.cos(ang), y: r * Math.sin(ang) };
      });
      cp = new Polygon(pts, base);
    }
    if (kind === 'heart') {
      cp = new Path('M50 90 C20 70 0 52 0 30 C0 12 14 0 30 0 C40 0 47 6 50 14 C53 6 60 0 70 0 C86 0 100 12 100 30 C100 52 80 70 50 90 Z', base);
      const k = s / 100;
      cp.set({ scaleX: k, scaleY: k });
    }
    img.set({ clipPath: cp, dirty: true });
  }

  // ---------------------------------------------------------------- context menu
  showContextMenu(e) {
    const t = e.target;
    if (t && !this.canvas.getActiveObjects().includes(t)) this.canvas.setActiveObject(t);
    this.canvas.requestRenderAll();
    const a = this.canvas.getActiveObject();
    const anchor = h(`<div style="position:fixed;left:${e.e.clientX}px;top:${e.e.clientY}px;width:1px;height:1px"></div>`);
    document.body.appendChild(anchor);
    const items = a
      ? [['copy', 'คัดลอก', 'Ctrl+C'], ['paste', 'วาง', 'Ctrl+V'], ['duplicate', 'ทำสำเนา', 'Ctrl+D'], ['delete', 'ลบ', 'Del'], ['-'],
         ['arrange:front', 'นำไปไว้บนสุด'], ['arrange:forward', 'เลื่อนขึ้น'], ['arrange:backward', 'เลื่อนลง'], ['arrange:back', 'ส่งไปไว้ล่างสุด'], ['-'],
         [a.type === 'activeselection' ? 'group' : a.type === 'group' ? 'ungroup' : null, a.type === 'activeselection' ? 'จัดกลุ่ม' : 'ยกเลิกกลุ่ม'],
         ['copy-style', 'คัดลอกสไตล์'], ['lock', a.locked ? 'ปลดล็อก' : 'ล็อก']].filter((x) => x[0] !== null)
      : [['paste', 'วาง', 'Ctrl+V'], ['selectall', 'เลือกทั้งหมด', 'Ctrl+A'], ['-'], ['page-add', 'เพิ่มหน้าใหม่']];
    const el = popover(anchor, `<div class="menu">${items.map(([k, l, s]) => (k === '-' ? '<hr>' : `<button data-m="${k}">${l}${s ? `<kbd>${s}</kbd>` : ''}</button>`)).join('')}</div>`, { key: 'ctx', onClose: () => anchor.remove() });
    el.onclick = (ev) => {
      const m = ev.target.closest('[data-m]')?.dataset.m;
      if (!m) return;
      closePopover();
      if (m === 'copy') this.copy();
      else if (m === 'paste') this.paste();
      else if (m === 'selectall') this.selectAll();
      else if (m === 'page-add') this.addPage();
      else this.ctxAction(m);
    };
  }

  // ---------------------------------------------------------------- side panels
  openPanel(name) {
    const box = this.$('[data-panel-box]');
    if (this.canvas.isDrawingMode && name !== 'draw') this.setDrawing(false);
    this.el.querySelectorAll('.rail-btn').forEach((b) => b.classList.toggle('active', b.dataset.panel === name));
    if (!name) {
      box.classList.add('hidden');
      this.panelHidden = true;
      requestAnimationFrame(() => this.fitZoomIfNeeded());
      return;
    }
    this.panel = name;
    box.classList.remove('hidden');
    this.renderPanel();
    if (name === 'draw') this.setDrawing(true);
    requestAnimationFrame(() => this.fitZoomIfNeeded());
  }

  fitZoomIfNeeded() {
    const ws = this.$('[data-ws]');
    if (this.W * this.zoom > ws.clientWidth || this.H * this.zoom > ws.clientHeight) this.fitZoom();
  }

  async renderPanel() {
    const titles = { outline: 'โครงร่างเอกสาร', templates: 'เทมเพลต', elements: 'องค์ประกอบ', text: 'ข้อความ', uploads: 'อัปโหลด', brand: 'ชุดแบรนด์ (Brand Kit)', photos: 'รูปภาพฟรี', background: 'พื้นหลัง', draw: 'วาดอิสระ', layers: 'เลเยอร์' };
    const body = this.$('[data-panel-body]');
    this.$('[data-panel-title]').textContent = titles[this.panel] || '';
    const p = this.panel;
    if (p === 'outline') {
      this.renderOutline(body);
    } else if (p === 'templates') {
      body.innerHTML = `<p class="hint">คลิกเทมเพลตเพื่อใช้กับหน้านี้ (ถ้าหน้ามีของอยู่แล้วจะเพิ่มเป็นหน้าใหม่) ทุกเทมเพลตปรับตามขนาดงานอัตโนมัติ</p>
        <input class="input full search" data-tpl-search placeholder="ค้นหาเทมเพลต เช่น ใบงาน, เมนู, ไทม์ไลน์ (${TEMPLATES.length} แบบ)" aria-label="ค้นหาเทมเพลต" />
        <div class="chip-row" data-tpl-cats>${TEMPLATE_CATEGORIES.map((c, i) => `<button class="chip ${i === 0 ? 'on' : ''}" data-cat="${esc(c)}">${esc(c)}</button>`).join('')}</div>
        <div class="tpl-grid">${TEMPLATES.map((t, i) => `<button class="tpl" data-act="tpl:${i}" data-cat="${esc(t.cat || '')}" title="${esc(t.name)} · ${esc(t.cat || '')}"><div class="tpl-img" data-tpl-img="${i}" style="aspect-ratio:${this.W}/${this.H}"></div><span>${esc(t.name)}</span></button>`).join('')}</div>
        <p class="empty" data-tpl-empty hidden>ไม่พบเทมเพลตที่ค้นหา</p>`;
      let cat = 'ทั้งหมด';
      const filter = () => {
        const q = body.querySelector('[data-tpl-search]').value.trim().toLowerCase();
        let n = 0;
        body.querySelectorAll('.tpl').forEach((b) => { b.hidden = (cat !== 'ทั้งหมด' && b.dataset.cat !== cat) || (q && !b.title.toLowerCase().includes(q)); if (!b.hidden) n++; });
        body.querySelector('[data-tpl-empty]').hidden = n > 0;
      };
      body.querySelector('[data-tpl-search]').addEventListener('input', filter);
      body.querySelector('[data-tpl-cats]').addEventListener('click', (e) => {
        const c = e.target.closest('[data-cat]');
        if (!c) return;
        cat = c.dataset.cat;
        body.querySelectorAll('[data-tpl-cats] .chip').forEach((x) => x.classList.toggle('on', x === c));
        filter();
      });
      this.renderTemplateThumbs();
    } else if (p === 'elements') {
      const gfx = this._gfx || null;
      if (!gfx) loadGraphics().then((g) => { this._gfx = g; if (this.panel === 'elements') this.renderPanel(); }).catch((e) => console.error('graphics', e));
      if (!this._illLoaded) { this._illLoaded = true; loadIllustrations().then((items) => { setIllustrations(items); if (items.length && this.panel === 'elements') this.renderPanel(); }); }
      const view = this._elView || '';
      if (view && gfx) {
        body.innerHTML = `<div class="el-view">${elementsViewHTML(gfx, view)}</div>`;
        body.scrollTop = 0;
        this.markDraggable(body);
        return;
      }
      body.innerHTML = `
        <input class="input full search" data-el-search placeholder="ค้นหาองค์ประกอบ เช่น ดอกไม้ แมว หัวใจ ตาราง กราฟ" aria-label="ค้นหาองค์ประกอบ" value="${esc(this._elQ || '')}" />
        <div data-el-results-box></div>
        <div data-el-home>${elementsHomeHTML(gfx)}</div>
        <div class="sec-title">ตาราง QR สมการ</div>
        <div class="smart-grid">
          ${[['table', '▦', 'ตาราง'], ['qr', '▣', 'QR Code'], ['equation', '∑', 'สมการ']]
            .map(([k, ic, l]) => `<button class="smart-btn" data-act="smart:${k}" title="${l}"><b>${ic}</b><span>${l}</span></button>`).join('')}
        </div>
        <div class="sec-title">กราฟ (${CHART_TYPES.length} แบบ)</div>
        <div class="smart-grid charts">
          ${CHART_TYPES.map(([k, l, g]) => `<button class="smart-btn" data-act="smart:${k}" title="กราฟ ${l} ${g}"><b>${CHART_ICON[k] || '📊'}</b><span>${l}</span></button>`).join('')}
        </div>
        <div class="sec-title">ไอคอน</div>
        <div class="el-grid icons">${LIBRARY_ICONS.map(([n, l]) => `<button class="el" data-act="smart:icon-${n}" title="ไอคอน ${l}">${icon(n, 26)}</button>`).join('')}</div>
        <div class="sec-title">ม็อกอัป (ใส่รูปในอุปกรณ์)</div>
        <div class="smart-grid">${MOCKUPS.map(([k, ic, l]) => `<button class="smart-btn" data-act="smart:mockup-${k}" title="ม็อกอัป ${l}"><b>${ic}</b><span>${l}</span></button>`).join('')}</div>
        <div class="sec-title">กรอบรูป</div>
        <div class="el-grid">${FRAMES.map(([l, m, r], i) => `<button class="el" data-act="frame:${i}" title="กรอบรูป ${l}"><span class="frame-prev ${m}" style="aspect-ratio:${r}"></span></button>`).join('')}</div>
        <div class="sec-title">ตารางรูป (กริด)</div>
        <div class="el-grid">${GRIDS.map(([l, cells], i) => `<button class="el" data-act="grid:${i}" title="กริด ${l}"><svg viewBox="0 0 60 60" width="100%" height="100%">${cells.map(([x, y, w, hh]) => `<rect x="${x * 52 + 5}" y="${y * 52 + 5}" width="${w * 52 - 2}" height="${hh * 52 - 2}" rx="2" fill="#cfc8ec"/>`).join('')}</svg></button>`).join('')}</div>
        <div class="sec-title">เส้น</div>
        <div class="el-grid">${LINES.map(([l], i) => `<button class="el" data-act="line:${i}" title="${l}">${shapePreviewSVG(l)}</button>`).join('')}</div>
        <div class="sec-title">รูปทรง</div>
        <div class="el-grid">${SHAPES.map(([l], i) => `<button class="el" data-act="shape:${i}" title="${l}">${shapePreviewSVG(l)}</button>`).join('')}</div>
        <div class="sec-title">สติกเกอร์</div>
        <div class="el-grid stickers">${STICKERS.map((s, i) => `<button class="el" data-act="sticker:${i}" title="สติกเกอร์ ${s}">${s}</button>`).join('')}</div>`;
      const q = body.querySelector('[data-el-search]');
      const runSearch = () => {
        const v = q.value.trim().toLowerCase();
        this._elQ = q.value;
        body.querySelector('[data-el-results-box]').innerHTML = v ? elementsSearchHTML(this._gfx, v) : '';
        body.querySelector('[data-el-home]').hidden = !!v;
        this.markDraggable(body);
        body.querySelectorAll('.el, .smart-btn').forEach((b) => { b.hidden = !!v && !(b.title || '').toLowerCase().includes(v); });
        body.querySelectorAll('.sec-title').forEach((t) => { const g = t.nextElementSibling; t.hidden = g && [...g.children].every((c) => c.hidden); });
      };
      q.addEventListener('input', runSearch);
      if (q.value) runSearch();
    } else if (p === 'text') {
      body.innerHTML = `
        <button class="btn primary full" data-act="text:heading">${icon('text', 18)} เพิ่มกล่องข้อความ</button>
        <div class="sec-title">สไตล์ข้อความเริ่มต้น</div>
        <button class="text-add h1" data-act="text:heading">เพิ่มหัวข้อ</button>
        <button class="text-add h2" data-act="text:sub">เพิ่มหัวข้อย่อย</button>
        <button class="text-add body" data-act="text:body">เพิ่มเนื้อความ</button>
        <div class="sec-title">เอกสาร / รายงาน</div>
        <button class="btn sm full" data-act="docsetup">📄 หัวกระดาษ ท้ายกระดาษ เลขหน้า ลายน้ำ ขอบกระดาษ</button>
        <div class="sec-title">เลขหน้าอัตโนมัติ (วางเองบนหน้า)</div>
        <div class="grid2"><button class="btn sm" data-act="pagenum:n"># เลขหน้า</button><button class="btn sm" data-act="pagenum:nN"># หน้า / ทั้งหมด</button></div>
        <button class="btn sm full" data-act="toc-add">☰ สารบัญอัตโนมัติ</button>
        <div class="sec-title">ชุดข้อความสำเร็จรูป</div>
        <div class="combo-grid">
          <button class="combo" data-act="combo:0"><b style="font-family:Kanit;font-weight:700;text-shadow:2px 3px 6px rgba(0,0,0,.3)">ลดราคา!</b></button>
          <button class="combo" data-act="combo:1"><b style="font-family:Anton;color:#fff;-webkit-text-stroke:1.5px #1f2333;font-size:26px">BIG SALE</b></button>
          <button class="combo" data-act="combo:2"><b style="font-family:Prompt;background:#ffe066;padding:2px 6px">ไฮไลต์</b></button>
          <button class="combo dark" data-act="combo:3"><b style="font-family:Mitr;color:#fff;text-shadow:0 0 8px #ff2bd6,0 0 14px #ff2bd6">นีออน</b></button>
          <button class="combo" data-act="combo:4"><b style="font-family:Pacifico;color:#e85d9f;font-size:22px">Lovely</b></button>
          <button class="combo" data-act="combo:5"><b style="font-family:'Playfair Display';font-style:italic;letter-spacing:3px">Elegant</b></button>
          <button class="combo" data-act="combo:6"><b style="font-family:Charm;font-size:26px;color:#8a6d10">เกียรติบัตร</b></button>
          <button class="combo" data-act="combo:7"><b style="font-family:Itim;color:#2563eb">ลายมือน่ารัก</b></button>
        </div>`;
      linkAllFonts();
    } else if (p === 'uploads') {
      const ups = (await listUploads()).filter((u) => !u.brand);
      if (this.panel !== 'uploads') return;
      body.innerHTML = `
        <button class="btn primary full" data-act="upload">${icon('upload', 18)} อัปโหลดรูปภาพ</button>
        <p class="hint">หรือลากไฟล์รูปมาวางบนผืนงาน / กด Ctrl+V เพื่อวางรูปจากคลิปบอร์ด รูปจะเก็บไว้ในเบราว์เซอร์นี้</p>
        <div class="up-grid">${ups.map((u) => `<div class="up"><button class="up-img" data-act="up-add:${u.id}"><img src="${u.url}" alt="" loading="lazy"></button><button class="up-del" data-act="up-del:${u.id}" title="ลบ">${icon('close', 14)}</button></div>`).join('') || '<p class="empty">ยังไม่มีรูปที่อัปโหลด</p>'}</div>`;
      this._uploads = ups;
    } else if (p === 'brand') {
      const logos = (await listUploads()).filter((u) => u.brand);
      if (this.panel !== 'brand') return;
      const cols = this.brandColors(), bf = this.brandFonts();
      const fontOpts = (cur) => `<option value="">— ไม่กำหนด —</option>` + ['ไทย', 'อังกฤษ'].map((g) => `<optgroup label="${g === 'ไทย' ? 'รองรับภาษาไทย' : 'ภาษาอังกฤษ'}">${FONTS.filter((f) => f[2] === g).map(([f]) => `<option ${f === cur ? 'selected' : ''}>${esc(f)}</option>`).join('')}</optgroup>`).join('');
      body.innerHTML = `
        <p class="hint">เก็บสี ฟอนต์ และโลโก้ของแบรนด์ไว้ใช้ซ้ำได้ทุกงาน (บันทึกในเบราว์เซอร์นี้)</p>
        <div class="sec-title">สีแบรนด์</div>
        <div class="brand-colors" data-brand-colors>${cols.map((c) => `<div class="bc"><button class="sw" data-act="brand-color:${c}" style="background:${c}" title="${c} — คลิกเพื่อใช้กับวัตถุที่เลือก (ไม่ได้เลือก = พื้นหลัง)"></button><button class="bc-del" data-act="brand-color-del:${c}" title="ลบสี ${c}">×</button></div>`).join('')}
          <label class="sw add" title="เพิ่มสีแบรนด์">+<input type="color" data-brand-color-input value="#7c3aed"></label></div>
        <p class="hint">คลิกสีเพื่อใช้กับวัตถุที่เลือก ถ้าไม่ได้เลือกจะเปลี่ยนสีพื้นหลัง</p>
        <div class="sec-title">ฟอนต์แบรนด์</div>
        ${BRAND_FONT_KINDS.map(([k, label]) => `<label class="brand-font-row">${label}<select class="input" data-brand-font="${k}">${fontOpts(bf[k])}</select></label>`).join('')}
        <div class="brand-text">
          ${BRAND_FONT_KINDS.map(([k, label]) => `<button class="text-add ${k === 'heading' ? 'h1' : k === 'sub' ? 'h2' : 'body'}" data-act="brand-text:${k}" style="${bf[k] ? `font-family:'${esc(bf[k])}'` : ''}">เพิ่ม${label}</button>`).join('')}
        </div>
        <button class="btn sm full" data-act="brand-apply-fonts" ${Object.keys(bf).length ? '' : 'disabled'}>ใช้ฟอนต์แบรนด์กับข้อความทุกหน้า</button>
        <div class="sec-title">โลโก้</div>
        <button class="btn full" data-act="brand-logo-upload">${icon('upload', 18)} อัปโหลดโลโก้</button>
        <input type="file" accept="image/*" multiple hidden data-brand-logo-file />
        <div class="up-grid logos">${logos.map((u) => `<div class="up"><button class="up-img" data-act="logo-add:${u.id}" title="${esc(u.name || 'โลโก้')}"><img src="${u.url}" alt="${esc(u.name || 'โลโก้')}" loading="lazy"></button><button class="up-del" data-act="up-del:${u.id}" title="ลบโลโก้">${icon('close', 14)}</button></div>`).join('') || '<p class="empty">ยังไม่มีโลโก้</p>'}</div>`;
      this._logos = logos;
      const ci = body.querySelector('[data-brand-color-input]');
      ci.addEventListener('change', () => { this.addBrandColor(ci.value.toLowerCase()); this.renderPanel(); });
      body.querySelectorAll('[data-brand-font]').forEach((sel) => sel.addEventListener('change', () => {
        this.setBrandFont(sel.dataset.brandFont, sel.value);
        if (sel.value) ensureFont(sel.value);
        this.renderPanel();
      }));
      const lf = body.querySelector('[data-brand-logo-file]');
      lf.addEventListener('change', async () => {
        for (const f of lf.files) {
          if (!f.type.startsWith('image/')) continue;
          try {
            const { url } = await fileToDataURL(f, 1024);
            await saveUpload({ id: uid(), url, name: f.name.replace(/\.[^.]+$/, ''), createdAt: Date.now(), brand: true });
          } catch { toast('อ่านไฟล์โลโก้ไม่สำเร็จ: ' + f.name, 'error'); }
        }
        lf.value = '';
        this.renderPanel();
      });
    } else if (p === 'photos') {
      const tab = this._photoTab || 'photos';
      body.innerHTML = `
        <div class="seg sm" data-photo-tabs><button class="${tab === 'photos' ? 'on' : ''}" data-tab="photos">รูปถ่าย (${PHOTO_LIBRARY.length})</button><button class="${tab === 'patterns' ? 'on' : ''}" data-tab="patterns">ลวดลาย (${PATTERNS.length})</button></div>
        ${tab === 'photos' ? `<p class="hint">รูปถ่ายฟรีจาก Lorem Picsum (ใช้งานได้ฟรี ต้องต่ออินเทอร์เน็ต) คลิกเพื่อเพิ่มลงงาน</p>
          <div class="photo-grid" data-photo-grid></div><button class="btn full" data-more-photos>แสดงเพิ่ม</button>`
        : `<p class="hint">ลวดลายเวกเตอร์ ใช้ได้แม้ไม่มีอินเทอร์เน็ต คลิกเพื่อเพิ่ม หรือกด ⤢ เพื่อตั้งเป็นพื้นหลัง</p>
          <div class="photo-grid">${PATTERNS.map((pt, i) => `<div class="up"><button class="photo" data-act="pattern:${i}" title="${esc(pt.name)}"><img src="${pt.url}" alt="${esc(pt.name)}" loading="lazy"></button><button class="up-del set-bg" data-act="bgpattern:${i}" title="ตั้งเป็นพื้นหลัง">⤢</button></div>`).join('')}</div>`}`;
      body.querySelector('[data-photo-tabs]').addEventListener('click', (e) => { const t = e.target.closest('[data-tab]'); if (t) { this._photoTab = t.dataset.tab; this.renderPanel(); } });
      const grid = body.querySelector('[data-photo-grid]');
      if (grid) {
        let shown = 0;
        const more = () => {
          const next = PHOTO_LIBRARY.slice(shown, shown + 60);
          grid.insertAdjacentHTML('beforeend', next.map((id) => `<button class="photo" data-act="photo:${id}" title="รูปที่ ${id}"><img src="https://picsum.photos/id/${id}/240/180" alt="" loading="lazy" onerror="this.closest('.photo').remove()"></button>`).join(''));
          shown += next.length;
          body.querySelector('[data-more-photos]').hidden = shown >= PHOTO_LIBRARY.length;
          this.markDraggable(grid);
        };
        body.querySelector('[data-more-photos]').addEventListener('click', more);
        more();
      }
    } else if (p === 'background') {
      const bg = this.canvas.backgroundColor;
      body.innerHTML = `
        <div class="sec-title">สีพื้น</div>
        <div class="swatches big">${COLORS.map((c) => `<button class="sw ${bg === c ? 'on' : ''}" data-act="bg:${c}" style="background:${c}" title="${c}"></button>`).join('')}
          <label class="sw custom" title="เลือกสีเอง"><input type="color" data-bg-picker value="${toHex(typeof bg === 'string' ? bg : '#ffffff')}">+</label></div>
        <div class="sec-title">ไล่เฉดสี</div>
        <div class="swatches big">${GRADS.map((g, i) => `<button class="sw" data-act="bggrad:${i}" style="background:linear-gradient(135deg,${g[0]},${g[1]})"></button>`).join('')}</div>
        <div class="sec-title">ภาพพื้นหลัง</div>
        <button class="btn full" data-act="bg-upload">${icon('upload', 18)} อัปโหลดภาพเป็นพื้นหลัง</button>
        ${this.canvas.backgroundImage ? `<button class="btn full" data-act="bg-remove-image">${icon('trash', 18)} ลบภาพพื้นหลัง</button>` : ''}
        <p class="hint">หรือเลือกรูปบนงานแล้วกด “เป็นพื้นหลัง” ในแถบเครื่องมือ</p>
        <div class="sec-title">ลวดลายพื้นหลัง</div>
        <div class="photo-grid">${PATTERNS.filter((_, i) => i % 3 === 0).map((pt) => `<button class="photo" data-act="bgpattern:${PATTERNS.indexOf(pt)}" title="${esc(pt.name)}"><img src="${pt.url}" alt="" loading="lazy"></button>`).join('')}</div>
        <div class="sec-title">รูปถ่ายพื้นหลัง</div>
        <div class="photo-grid">${PHOTO_LIBRARY.slice(0, 12).map((id) => `<button class="photo" data-act="bgphoto:${id}"><img src="https://picsum.photos/id/${id}/240/180" alt="" loading="lazy" onerror="this.closest('.photo').remove()"></button>`).join('')}</div>`;
      const pk = body.querySelector('[data-bg-picker]');
      pk.addEventListener('input', () => { this.canvas.backgroundColor = pk.value; this.canvas.backgroundImage = null; this.canvas.requestRenderAll(); });
      pk.addEventListener('change', () => this.setBackground(pk.value));
    } else if (p === 'draw') {
      const d = this.drawSettings;
      body.innerHTML = `
        <div class="seg">
          <button class="${d.mode === 'pen' ? 'on' : ''}" data-act="draw-mode:pen">${icon('pen', 18)} ปากกา</button>
          <button class="${d.mode === 'highlighter' ? 'on' : ''}" data-act="draw-mode:highlighter">${icon('highlighter', 18)} ไฮไลต์</button>
        </div>
        <div class="sec-title">สี</div>
        <div class="swatches big">${COLORS.map((c) => `<button class="sw ${d.color === c ? 'on' : ''}" data-act="draw-color:${c}" style="background:${c}"></button>`).join('')}</div>
        <label class="slider-row">ขนาดหัวปากกา <input type="range" min="1" max="80" value="${d.width}" data-draw-width><output>${d.width}</output></label>
        <p class="hint">ลากบนผืนงานเพื่อวาด เส้นที่วาดจะเป็นวัตถุที่เลือก ย้าย หรือลบได้</p>
        <button class="btn full" data-act="draw-stop">${icon('pointer', 18)} เลิกวาด (กลับไปโหมดเลือก)</button>`;
      const r = body.querySelector('[data-draw-width]');
      r.addEventListener('input', () => { d.width = +r.value; r.nextElementSibling.textContent = r.value; this.setDrawing(true); });
    } else if (p === 'layers') {
      const objs = this.canvas.getObjects().filter((o) => !o.cropUI).slice().reverse();
      const active = new Set(this.canvas.getActiveObjects());
      const all = this.canvas.getObjects();
      body.innerHTML = objs.length ? `<p class="hint">บนสุดอยู่ด้านบนของรายการ</p><div class="layers">${objs.map((o) => {
        const i = all.indexOf(o);
        return `<div class="layer ${active.has(o) ? 'on' : ''}">
          <button class="layer-name" data-act="layer-sel:${i}">${esc(this.displayName(o))}</button>
          <button class="icon-btn sm" data-act="layer-up:${i}" title="เลื่อนขึ้น">${icon('up', 16)}</button>
          <button class="icon-btn sm" data-act="layer-down:${i}" title="เลื่อนลง">${icon('down', 16)}</button>
          <button class="icon-btn sm ${o.visible ? '' : 'on'}" data-act="layer-vis:${i}" title="${o.visible ? 'ซ่อน' : 'แสดง'}">${icon(o.visible ? 'eye' : 'eyeOff', 16)}</button>
          <button class="icon-btn sm ${o.locked ? 'on' : ''}" data-act="layer-lock:${i}" title="${o.locked ? 'ปลดล็อก' : 'ล็อก'}">${icon(o.locked ? 'lock' : 'unlock', 16)}</button>
        </div>`;
      }).join('')}</div>` : '<p class="empty">หน้านี้ยังว่างอยู่ ลองเพิ่มข้อความหรือรูปทรงดูสิ</p>';
    }
    this.markDraggable(body);
  }

  /** Thumbnails are rendered lazily, only for templates scrolled into view. */
  renderTemplateThumbs() {
    const W = this.W, H = this.H;
    const key = `${W}x${H}`;
    this._tplCache = this._tplCache || {};
    const cache = (this._tplCache[key] = this._tplCache[key] || {});
    const queue = [];
    let busy = false;
    const pump = async () => {
      if (busy) return;
      busy = true;
      while (queue.length) {
        const i = queue.shift();
        const el = this.$(`[data-tpl-img="${i}"]`);
        if (!el) continue;
        if (!cache[i]) {
          const t = TEMPLATES[i];
          await ensureFonts(templateFonts(t));
          const { objects, background } = buildTemplate(t, W, H);
          const json = { version: '6.9.1', objects: objects.map((o) => o.toObject()), background: background.toObject ? background.toObject() : background };
          try {
            const sc = await renderPage(this.design, json);
            cache[i] = sc.toDataURL({ format: 'jpeg', quality: 0.8, multiplier: 260 / W });
            sc.dispose();
          } catch (e) { console.error(e); continue; }
        }
        el.style.backgroundImage = `url(${cache[i]})`;
        el.dataset.ready = '1';
      }
      busy = false;
    };
    const io = new IntersectionObserver((entries) => {
      for (const en of entries) {
        if (!en.isIntersecting) continue;
        io.unobserve(en.target);
        const i = +en.target.dataset.tplImg;
        if (cache[i]) { en.target.style.backgroundImage = `url(${cache[i]})`; en.target.dataset.ready = '1'; } else queue.push(i);
      }
      pump();
    }, { root: this.$('[data-panel-body]'), rootMargin: '300px' });
    this.el.querySelectorAll('[data-tpl-img]').forEach((el) => io.observe(el));
    this._tplObserver?.disconnect();
    this._tplObserver = io;
  }

  async applyTemplate(i) {
    const t = TEMPLATES[i];
    toast('กำลังใช้เทมเพลต…');
    await Promise.race([ensureFonts(templateFonts(t)), new Promise((r) => setTimeout(r, 3000))]);
    const { objects, background } = buildTemplate(t, this.W, this.H);
    const json = JSON.stringify({ version: '6.9.1', objects: objects.map((o) => o.toObject(EXTRA)), background: background.toObject ? background.toObject() : background });
    if (this.canvas.getObjects().length === 0) {
      this.design.pages[this.cur].json = json;
      await this.loadPage(this.cur);
      this.pushHistory();
      this.scheduleSave();
      this.scheduleThumb(0);
    } else {
      await this.addPage(json);
      toast('เพิ่มเทมเพลตเป็นหน้าใหม่แล้ว');
    }
    if (window.innerWidth < 760) this.openPanel(null);
  }

  setDrawing(on) {
    const c = this.canvas;
    c.isDrawingMode = on;
    if (on) {
      const d = this.drawSettings;
      const b = new PencilBrush(c);
      const hl = d.mode === 'highlighter';
      let color = d.color;
      if (hl) {
        const hx = toHex(color);
        color = `rgba(${parseInt(hx.slice(1, 3), 16)},${parseInt(hx.slice(3, 5), 16)},${parseInt(hx.slice(5, 7), 16)},0.4)`;
      }
      b.color = color;
      b.width = hl ? d.width * 3 : d.width;
      b.decimate = 2;
      if (hl) b.strokeLineCap = 'square';
      c.freeDrawingBrush = b;
      c.discardActiveObject();
    }
    this.$('[data-ws]').classList.toggle('drawing', on);
    c.requestRenderAll();
  }

  panelAction(act) {
    const [k, arg] = act.split(/:(.*)/s);
    const objAt = (i) => this.canvas.getObjects()[+i];
    switch (k) {
      case 'tpl': return this.applyTemplate(+arg);
      case 'smart': return this.addSmart(arg);
      case 'frame': return this.addFrame(+arg);
      case 'grid': return this.addGrid(+arg);
      case 'shape': return this.addShape(+arg);
      case 'gfx': {
        const id = act.slice(4);
        return makeElement(this._gfx, id, this.U * 0.35).then((o) => {
          if (!o) return;
          if (o.sceneURL) return this.setBackgroundImage(o.sceneURL);
          return this.addObject(o);
        }).catch((e) => { console.error(e); toast('เพิ่มกราฟิกไม่สำเร็จ', 'error'); });
      }
      case 'line': return this.addShape(+arg, LINES);
      case 'sticker': return this.addObject(Object.assign(makeSticker(STICKERS[+arg], this.U * 0.25), { name: 'สติกเกอร์' }));
      case 'text': return this.addText(arg);
      case 'docsetup': return this.openDocSetup();
      case 'pagenum': return this.addPageNumber(arg);
      case 'toc-add': return this.addTableOfContents();
      case 'ol-go': { const [pg, ix] = arg.split(':').map(Number); return this.outlineGo(pg, ix); }
      case 'combo': {
        const presets = [
          { text: 'ลดราคา!', fontFamily: 'Kanit', fontWeight: 'bold', fontSize: this.U * 0.12, fill: '#ff3131', shadowCfg: { color: 'rgba(0,0,0,0.3)', blur: 0.02, offsetX: 0.006, offsetY: 0.01 } },
          { text: 'BIG SALE', fontFamily: 'Anton', fontSize: this.U * 0.16, fill: '#ffffff', stroke: '#1f2333', strokeRel: 0.008, paintFirst: 'stroke' },
          { text: 'ข้อความไฮไลต์', fontFamily: 'Prompt', fontSize: this.U * 0.06, fill: '#1f2333', textBackgroundColor: '#ffe066' },
          { text: 'นีออน', fontFamily: 'Mitr', fontSize: this.U * 0.12, fill: '#ffffff', shadowCfg: { color: '#ff2bd6', blur: 0.04 } },
          { text: 'Lovely', fontFamily: 'Pacifico', fontSize: this.U * 0.12, fill: '#e85d9f' },
          { text: 'Elegant', fontFamily: 'Playfair Display', fontStyle: 'italic', fontSize: this.U * 0.1, fill: '#1f2333', charSpacing: 200 },
          { text: 'เกียรติบัตร', fontFamily: 'Charm', fontWeight: 'bold', fontSize: this.U * 0.12, fill: '#8a6d10' },
          { text: 'ลายมือน่ารัก', fontFamily: 'Itim', fontSize: this.U * 0.08, fill: '#2563eb' },
        ];
        return this.addText('none', { width: this.W * 0.7, ...presets[+arg] });
      }
      case 'upload': return this.$('[data-file-upload]').click();
      case 'up-add': { const u = (this._uploads || []).find((x) => x.id === arg); return u && this.addImage(u.url, u.name || 'รูปภาพ'); }
      case 'up-del': return deleteUpload(arg).then(() => this.renderPanel());
      case 'logo-add': { const u = (this._logos || []).find((x) => x.id === arg); return u && this.addImage(u.url, 'โลโก้ ' + (u.name || '')); }
      case 'brand-logo-upload': return this.$('[data-brand-logo-file]').click();
      case 'brand-color-del': this.removeBrandColor(arg); return this.renderPanel();
      case 'brand-color': {
        const a = this.canvas.getActiveObject();
        if (!a) return this.setBackground(arg);
        if (isImage(a)) return toast('รูปภาพเปลี่ยนสีไม่ได้ เลือกข้อความหรือรูปทรง', 'error');
        if (a.shapeText) { a.getObjects()[0].set('fill', arg); a.set('dirty', true); this.canvas.requestRenderAll(); return this.commit(); }
        return this.setProp('fill', arg);
      }
      case 'brand-text': { const f = this.brandFonts()[arg]; return this.addText(arg, f ? { fontFamily: f } : undefined); }
      case 'brand-apply-fonts': return this.applyBrandFonts();
      case 'photo': case 'bgphoto': return this.addPhoto(+arg, k === 'bgphoto');
      case 'pattern': return this.addImage(PATTERNS[+arg].url, 'ลวดลาย ' + PATTERNS[+arg].name);
      case 'bgpattern': return this.setBackgroundImage(PATTERNS[+arg].url);
      case 'bg': this.setBackground(arg); return this.renderPanel();
      case 'bggrad': this.setBackground(GRADS[+arg]); return this.renderPanel();
      case 'bg-upload': return this.$('[data-file-bg]').click();
      case 'draw-mode': this.drawSettings.mode = arg; this.setDrawing(true); return this.renderPanel();
      case 'draw-color': this.drawSettings.color = arg; this.setDrawing(true); return this.renderPanel();
      case 'draw-stop': return this.openPanel(null);
      case 'layer-sel': { const o = objAt(arg); if (o && o.visible) { this.canvas.setActiveObject(o); this.canvas.requestRenderAll(); } return; }
      case 'layer-up': { const o = objAt(arg); if (o) { this.canvas.bringObjectForward(o); this.commit(); } return; }
      case 'layer-down': { const o = objAt(arg); if (o) { this.canvas.sendObjectBackwards(o); this.commit(); } return; }
      case 'layer-vis': { const o = objAt(arg); if (o) { o.visible = !o.visible; if (!o.visible) this.canvas.discardActiveObject(); this.canvas.requestRenderAll(); this.commit(); } return; }
      case 'layer-lock': { const o = objAt(arg); if (o) { o.locked = !o.locked; this.applyLock(o); this.canvas.requestRenderAll(); this.commit(); } return; }
      default: return false;
    }
  }

  async addPhoto(id, asBg) {
    toast('กำลังโหลดรูป…');
    try {
      const res = await fetch(`https://picsum.photos/id/${id}/1600/1200`);
      if (!res.ok) throw new Error(res.status);
      const blob = await res.blob();
      const url = await new Promise((r) => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(blob); });
      if (asBg) await this.setBackgroundImage(url);
      else await this.addImage(url, 'รูปภาพ');
    } catch (e) {
      console.error(e);
      toast('โหลดรูปไม่สำเร็จ (ต้องต่ออินเทอร์เน็ต)', 'error');
    }
  }

  // ---------------------------------------------------------------- export & resize dialogs
  openExport() {
    this.flushText();
    const n = this.design.pages.length;
    const formats = [
      ['png', 'PNG', 'ภาพคมชัด รองรับพื้นโปร่งใส'],
      ['jpg', 'JPG', 'ไฟล์เล็ก เหมาะแชร์โซเชียล'],
      ['pdf', 'PDF', 'สำหรับพิมพ์ / เอกสาร หลายหน้า'],
      ['svg', 'SVG', 'ภาพเวกเตอร์ ขยายได้ไม่แตก'],
      ['webp', 'WEBP', 'ภาพเว็บ ไฟล์เล็กมาก'],
      ['pptx', 'PowerPoint', 'ไฟล์ .pptx แก้ข้อความ ตาราง กราฟ ได้'],
      ['docx', 'Word', 'ไฟล์ .docx แก้ข้อความ ตาราง กราฟ ได้'],
      ['json', 'โปรเจกต์', 'ไฟล์ .json เปิดแก้ไขต่อได้'],
    ];
    const m = modal({
      title: 'ดาวน์โหลด',
      body: `
        <div class="fmt-grid">${formats.map(([k, l, d], i) => `<label class="fmt"><input type="radio" name="fmt" value="${k}" ${i === 0 ? 'checked' : ''}><b>${l}</b><small>${d}</small></label>`).join('')}</div>
        <div class="ex-opts">
          <label data-opt="scale">ขนาด
            <select class="select" data-scale>
              <option value="0.5">0.5× (${Math.round(this.W / 2)}×${Math.round(this.H / 2)})</option>
              <option value="1" selected>1× (${this.W}×${this.H})</option>
              <option value="2">2× (${this.W * 2}×${this.H * 2})</option>
              <option value="3">3× (${this.W * 3}×${this.H * 3})</option>
            </select>
          </label>
          <label data-opt="quality" hidden>คุณภาพ <input type="range" min="40" max="100" value="92" data-quality><output>92</output></label>
          <label data-opt="docxmode" hidden>รูปแบบไฟล์ Word <select class="input" data-docxmode>
            <option value="flow" ${this.design.mm || hasDoc(this.design) ? 'selected' : ''}>เอกสาร / รายงาน: ข้อความไหลต่อกัน แก้ไขแบบ Word ปกติ</option>
            <option value="layout" ${this.design.mm || hasDoc(this.design) ? '' : 'selected'}>ตรงตามงานออกแบบ: วางข้อความในกรอบตามตำแหน่งเดิม</option>
          </select></label>
          <label data-opt="editable" class="toggle-row" hidden><input type="checkbox" data-editable checked> แก้ไขได้ (ข้อความ ตาราง กราฟ รูปทรง เป็นวัตถุจริง) — ถ้าไม่ติ๊ก แต่ละหน้าจะเป็นภาพเดียว</label>
          <label data-opt="transparent" class="toggle-row"><input type="checkbox" data-transparent> พื้นหลังโปร่งใส</label>
          <label data-opt="print" class="toggle-row"><input type="checkbox" data-print> PDF สำหรับโรงพิมพ์ (300 dpi + ระยะตัดตก 3 มม. + เครื่องหมายตัด)</label>
          <label data-opt="searchable" class="toggle-row" hidden><input type="checkbox" data-searchable checked> ค้นหา/เลือก/คัดลอกข้อความในไฟล์ PDF ได้</label>
          <label data-opt="cmyk" class="toggle-row" hidden><input type="checkbox" data-cmyk> โหมดสี CMYK (สำหรับโรงพิมพ์ระบบออฟเซ็ต)</label>
          <label data-opt="pages">หน้า
            <select class="select" data-pages-sel>
              <option value="all">ทุกหน้า (${this.visiblePageIndexes().length} หน้า${n - this.visiblePageIndexes().length ? ` ไม่รวม ${n - this.visiblePageIndexes().length} หน้าที่ซ่อน` : ''})</option>
              <option value="cur">เฉพาะหน้าปัจจุบัน (หน้า ${this.cur + 1})</option>
              <option value="custom">เลือกเอง…</option>
            </select>
            <input class="input" data-pages-custom placeholder="เช่น 1-3,5" hidden>
          </label>
        </div>
        <p class="hint" data-ex-hint></p>
        <div class="modal-actions"><button class="btn" data-no>ยกเลิก</button><button class="btn primary" data-go>${icon('download', 18)} ดาวน์โหลด</button></div>`,
    });
    const el = m.el;
    const fmt = () => el.querySelector('[name=fmt]:checked').value;
    const sync = () => {
      const f = fmt();
      const print = f === 'pdf' && el.querySelector('[data-print]').checked;
      el.querySelector('[data-opt="scale"]').hidden = f === 'svg' || f === 'json' || print;
      el.querySelector('[data-opt="print"]').hidden = f !== 'pdf';
      el.querySelector('[data-opt="cmyk"]').hidden = !print;
      el.querySelector('[data-opt="searchable"]').hidden = f !== 'pdf' || (print && el.querySelector('[data-cmyk]').checked);
      el.querySelector('[data-opt="editable"]').hidden = f !== 'pptx';
      el.querySelector('[data-opt="docxmode"]').hidden = f !== 'docx';
      if (f === 'docx') el.querySelector('[data-opt="scale"]').hidden = true;
      el.querySelector('[data-opt="quality"]').hidden = !(f === 'jpg' || f === 'webp');
      el.querySelector('[data-opt="transparent"]').hidden = f !== 'png';
      el.querySelector('[data-opt="pages"]').hidden = f === 'json';
      const multi = n > 1 && el.querySelector('[data-pages-sel]').value !== 'cur';
      el.querySelector('[data-ex-hint]').textContent =
        f === 'pdf' ? `ทุกหน้าที่เลือกจะรวมเป็นไฟล์ PDF ไฟล์เดียว${this.design.mm ? ` ขนาด ${this.design.mm[0]}×${this.design.mm[1]} มม.` : ''}` :
        f === 'pptx' ? 'แต่ละหน้าเป็น 1 สไลด์ ข้อความ ตาราง กราฟ รูปทรงแก้ไขได้ โน้ตผู้นำเสนอติดไปด้วย · ฟอนต์ไทยต้องติดตั้งในเครื่องที่เปิดไฟล์ (ดาวน์โหลดฟรีจาก Google Fonts)' :
        f === 'docx' ? 'แต่ละหน้าเป็น 1 หน้า Word ข้อความ ตาราง กราฟ แก้ไขได้ จัดวางตำแหน่งเหมือนงานออกแบบ · ฟอนต์ไทยต้องติดตั้งในเครื่องที่เปิดไฟล์' :
        f === 'json' ? 'เก็บไฟล์นี้ไว้ แล้วเปิดด้วยเมนู “เปิดไฟล์โปรเจกต์” เพื่อแก้ไขต่อได้ทุกเครื่อง' :
        multi ? 'หลายหน้าจะถูกรวมเป็นไฟล์ .zip' : '';
    };
    el.addEventListener('change', sync);
    el.querySelector('[data-pages-sel]').addEventListener('change', (e) => { el.querySelector('[data-pages-custom]').hidden = e.target.value !== 'custom'; });
    const q = el.querySelector('[data-quality]');
    q.addEventListener('input', () => { q.nextElementSibling.textContent = q.value; });
    sync();
    el.querySelector('[data-no]').onclick = () => m.close();
    el.querySelector('[data-go]').onclick = async () => {
      const f = fmt();
      const sel = el.querySelector('[data-pages-sel]').value;
      let pages = this.visiblePageIndexes();
      if (sel === 'all' && !pages.length) return toast('ทุกหน้าถูกซ่อนอยู่ เลือก “เฉพาะหน้าปัจจุบัน” หรือ “เลือกเอง” แทน', 'error');
      if (sel === 'cur') pages = [this.cur];
      if (sel === 'custom') {
        const out = new Set();
        for (const part of el.querySelector('[data-pages-custom]').value.split(',')) {
          const [x, y] = part.split('-').map((s) => parseInt(s, 10));
          if (!x) continue;
          for (let i = x; i <= (y || x); i++) if (i >= 1 && i <= n) out.add(i - 1);
        }
        pages = [...out].sort((a, b) => a - b);
        if (!pages.length) return toast('ระบุหน้าที่ต้องการให้ถูกต้อง เช่น 1-3,5', 'error');
      }
      const go = el.querySelector('[data-go]');
      go.disabled = true;
      this.design.pages[this.cur].json = this.serialize();
      try {
        await exportDesign(this.design, {
          format: f, pages,
          scale: +el.querySelector('[data-scale]').value,
          quality: +q.value / 100,
          transparent: el.querySelector('[data-transparent]').checked,
          print: el.querySelector('[data-print]').checked,
          cmyk: el.querySelector('[data-cmyk]').checked,
          searchable: el.querySelector('[data-searchable]').checked,
          editable: el.querySelector('[data-editable]').checked,
          docxMode: el.querySelector('[data-docxmode]').value,
          onProgress: (i, total) => { go.textContent = total > 1 ? `กำลังสร้าง ${Math.min(i + 1, total)}/${total}…` : 'กำลังสร้าง…'; },
        });
        m.close();
        toast('ดาวน์โหลดเรียบร้อย ✓', 'ok');
      } catch (e) {
        console.error(e);
        toast('ดาวน์โหลดไม่สำเร็จ: ' + (e.message || e), 'error', 5000);
        go.disabled = false;
        go.textContent = 'ลองอีกครั้ง';
      }
    };
  }

  openResize() {
    const m = modal({
      title: 'ปรับขนาดงานออกแบบ',
      body: `
        <div class="preset-list">${PRESETS.map((p, i) => `<label class="preset-row"><input type="radio" name="rs" value="${i}"><span>${p.icon} ${esc(p.name)}</span><small>${p.w} × ${p.h} px</small></label>`).join('')}
          <label class="preset-row"><input type="radio" name="rs" value="custom" checked><span>✏️ กำหนดเอง</span>
            <small><input class="input xs" type="number" data-w value="${this.W}" min="16" max="8000"> × <input class="input xs" type="number" data-h value="${this.H}" min="16" max="8000"> px</small></label>
        </div>
        <label class="toggle-row"><input type="checkbox" data-scale checked> ย่อ/ขยายเนื้อหาให้พอดีขนาดใหม่</label>
        <div class="modal-actions"><button class="btn" data-no>ยกเลิก</button><button class="btn primary" data-go>ปรับขนาด</button></div>`,
    });
    const el = m.el;
    el.querySelectorAll('[data-w],[data-h]').forEach((i) => i.addEventListener('focus', () => { el.querySelector('[name=rs][value=custom]').checked = true; }));
    el.querySelector('[data-no]').onclick = () => m.close();
    el.querySelector('[data-go]').onclick = async () => {
      const v = el.querySelector('[name=rs]:checked').value;
      let w, hh, mm = null;
      if (v === 'custom') { w = Math.round(+el.querySelector('[data-w]').value); hh = Math.round(+el.querySelector('[data-h]').value); }
      else { const p = PRESETS[+v]; w = p.w; hh = p.h; mm = p.mm || null; }
      if (!(w >= 16 && hh >= 16 && w <= 8000 && hh <= 8000)) return toast('ขนาดต้องอยู่ระหว่าง 16 – 8000 px', 'error');
      m.close();
      await this.resizeDesign(w, hh, mm, el.querySelector('[data-scale]').checked);
    };
  }

  async resizeDesign(nw, nh, mm, scaleContent) {
    this.flushText();
    this.design.pages[this.cur].json = this.serialize();
    const W = this.W, H = this.H;
    const s = Math.min(nw / W, nh / H);
    const ox = (nw - W * s) / 2, oy = (nh - H * s) / 2;
    for (const p of this.design.pages) {
      const j = JSON.parse(p.json);
      if (scaleContent) {
        for (const o of j.objects || []) {
          o.left = o.left * s + ox;
          o.top = o.top * s + oy;
          o.scaleX = (o.scaleX || 1) * s;
          o.scaleY = (o.scaleY || 1) * s;
        }
      } else {
        const dx = (nw - W) / 2, dy = (nh - H) / 2;
        for (const o of j.objects || []) { o.left += dx; o.top += dy; }
      }
      if (j.background && typeof j.background === 'object' && j.background.coords && j.background.gradientUnits !== 'percentage') {
        j.background.coords = { x1: 0, y1: 0, x2: nw, y2: nh };
      }
      if (j.backgroundImage) {
        const b = j.backgroundImage;
        const k = Math.max(nw / b.width, nh / b.height);
        Object.assign(b, { scaleX: k, scaleY: k, originX: 'left', originY: 'top', left: (nw - b.width * k) / 2, top: (nh - b.height * k) / 2 });
      }
      p.json = JSON.stringify(j);
    }
    this.design.width = nw;
    this.design.height = nh;
    this.design.mm = mm;
    this._tplCache = {};
    await this.loadPage(this.cur, { fit: true });
    // normalize scaled text so fonts sizes stay editable
    this.canvas.getObjects().forEach((o) => { if (isText(o) && o.scaleX !== 1) this.normalizeTextScale(o); });
    this.commit();
    this.thumbs.clear();
    this.design.pages.forEach((p) => pageThumb(this.design, p, 200).then((u) => { this.thumbs.set(p.id, u); this.renderPages(); }));
    if (this.panel === 'templates') this.renderPanel();
    toast(`ปรับขนาดเป็น ${nw} × ${nh} px แล้ว`, 'ok');
  }
}

Object.assign(Editor.prototype, features, rulers);
