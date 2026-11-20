// Rulers, user guides (drag from rulers) and print-bleed preview. Mixed into Editor.prototype.
import { toast } from './ui.js';

const RULER = 22;
const STEPS = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000];

export const rulers = {
  pageGuides() {
    const g = this.design.pages[this.cur]?.guides;
    return { h: g?.h || [], v: g?.v || [] };
  },

  setPageGuides(g) {
    const p = this.design.pages[this.cur];
    if (!g.h.length && !g.v.length) delete p.guides;
    else p.guides = { h: [...g.h], v: [...g.v] };
    this.pushHistory();
    this.scheduleSave();
  },

  toggleRulers(force) {
    this.showRulers = force ?? !this.showRulers;
    this.$('[data-ws-area]').classList.toggle('rulers', this.showRulers);
    try { localStorage.setItem('lai-rulers', this.showRulers ? '1' : '0'); } catch { /* ignore */ }
    requestAnimationFrame(() => this.drawRulers());
  },

  toggleBleed() {
    this.showBleed = !this.showBleed;
    this.canvas.requestRenderAll();
    toast(this.showBleed ? 'แสดงระยะตัดตก 3 มม. (พื้นที่นอกเส้นประสีแดงอาจถูกตัดตอนพิมพ์)' : 'ซ่อนระยะตัดตกแล้ว');
  },

  clearGuides() {
    this.setPageGuides({ h: [], v: [] });
    this.canvas.requestRenderAll();
    this.drawRulers();
    toast('ล้างเส้นไกด์ของหน้านี้แล้ว');
  },

  bindRulers() {
    const area = this.$('[data-ws-area]');
    const rh = this.$('[data-ruler-h]');
    const rv = this.$('[data-ruler-v]');
    try { if (localStorage.getItem('lai-rulers') === '1') this.toggleRulers(true); } catch { /* ignore */ }
    this.$('[data-ws]').addEventListener('scroll', () => this.drawRulers());
    this.on(window, 'resize', () => requestAnimationFrame(() => this.drawRulers()));
    // top ruler: new horizontal guide, or drag an existing vertical guide by its marker
    // left ruler: new vertical guide, or drag an existing horizontal guide by its marker
    const start = (ruler) => (e) => {
      e.preventDefault();
      const z = this.zoom;
      const r = this.canvas.lowerCanvasEl.getBoundingClientRect();
      const g = this.pageGuides();
      const alongX = (e.clientX - r.left) / z, alongY = (e.clientY - r.top) / z;
      let axis = ruler === 'top' ? 'h' : 'v';
      const markAxis = ruler === 'top' ? 'v' : 'h';
      const along = ruler === 'top' ? alongX : alongY;
      const hit = g[markAxis].findIndex((p) => Math.abs(p - along) * z < 6);
      const lists = { h: [...g.h], v: [...g.v] };
      if (hit >= 0) { axis = markAxis; lists[axis].splice(hit, 1); }
      const posOf = (ev) => (axis === 'h' ? (ev.clientY - r.top) / z : (ev.clientX - r.left) / z);
      this.dragGuide = { axis, pos: posOf(e) };
      const move = (ev) => { this.dragGuide.pos = posOf(ev); this.canvas.requestRenderAll(); this.drawRulers(); };
      const up = (ev) => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        const pos = Math.round(posOf(ev));
        const max = axis === 'h' ? this.H : this.W;
        const el = document.elementFromPoint(ev.clientX, ev.clientY);
        const overRuler = rh.contains(el) || rv.contains(el);
        if (pos >= 0 && pos <= max && !overRuler) lists[axis].push(pos);
        this.dragGuide = null;
        this.setPageGuides({ h: lists.h.sort((a, b) => a - b), v: lists.v.sort((a, b) => a - b) });
        this.canvas.requestRenderAll();
        this.drawRulers();
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
    };
    rh.addEventListener('pointerdown', start('top'));
    rv.addEventListener('pointerdown', start('left'));
    area.querySelector('.ruler-corner').addEventListener('dblclick', () => this.clearGuides());
  },

  drawRulers() {
    if (!this.showRulers || !this.canvas) return;
    const rh = this.$('[data-ruler-h]'), rv = this.$('[data-ruler-v]');
    const cr = this.canvas.lowerCanvasEl.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const css = getComputedStyle(this.el);
    const fg = css.getPropertyValue('--muted').trim() || '#888';
    const bg = css.getPropertyValue('--surface').trim() || '#fff';
    const acc = '#18b7d6';
    const z = this.zoom;
    let step = STEPS.find((s) => s * z >= 60) || 2000;
    // dir 'x' = top ruler (measures x, shows vertical guides); 'y' = left ruler
    const draw = (cv, dir) => {
      const r = cv.getBoundingClientRect();
      if (!r.width || !r.height) return;
      cv.width = Math.round(r.width * dpr);
      cv.height = Math.round(r.height * dpr);
      const c = cv.getContext('2d');
      c.scale(dpr, dpr);
      c.fillStyle = bg;
      c.fillRect(0, 0, r.width, r.height);
      const origin = dir === 'x' ? cr.left - r.left : cr.top - r.top;
      const len = dir === 'x' ? r.width : r.height;
      const pageLen = (dir === 'x' ? this.W : this.H) * z;
      c.fillStyle = 'rgba(124,92,255,0.12)';
      if (dir === 'x') c.fillRect(origin, 0, pageLen, RULER); else c.fillRect(0, origin, RULER, pageLen);
      c.strokeStyle = fg;
      c.fillStyle = fg;
      c.font = '10px sans-serif';
      c.lineWidth = 1;
      const minor = step / 5;
      const first = Math.floor(-origin / z / minor) * minor;
      c.beginPath();
      for (let v = first; origin + v * z < len; v += minor) {
        const p = Math.round(origin + v * z) + 0.5;
        const major = Math.abs(Math.round(v / step) * step - v) < 1e-6;
        const t = major ? RULER * 0.6 : RULER * 0.25;
        if (dir === 'x') { c.moveTo(p, RULER); c.lineTo(p, RULER - t); } else { c.moveTo(RULER, p); c.lineTo(RULER - t, p); }
        if (major) {
          if (dir === 'x') c.fillText(String(Math.round(v)), p + 2, 9);
          else { c.save(); c.translate(9, p - 2); c.rotate(-Math.PI / 2); c.fillText(String(Math.round(v)), 0, 0); c.restore(); }
        }
      }
      c.stroke();
      const axis = dir === 'x' ? 'v' : 'h';
      const marks = [...this.pageGuides()[axis]];
      if (this.dragGuide && this.dragGuide.axis === axis) marks.push(this.dragGuide.pos);
      c.fillStyle = acc;
      for (const m of marks) {
        const p = origin + m * z;
        c.beginPath();
        if (dir === 'x') { c.moveTo(p, RULER); c.lineTo(p - 5, RULER - 8); c.lineTo(p + 5, RULER - 8); }
        else { c.moveTo(RULER, p); c.lineTo(RULER - 8, p - 5); c.lineTo(RULER - 8, p + 5); }
        c.fill();
      }
    };
    draw(rh, 'x');
    draw(rv, 'y');
  },

  drawUserGuides(ctx) {
    const g = this.pageGuides();
    const dg = this.dragGuide;
    const bleed = this.showBleed;
    if (!g.h.length && !g.v.length && !dg && !bleed) return;
    const v = this.canvas.viewportTransform;
    ctx.save();
    ctx.transform(v[0], v[1], v[2], v[3], v[4], v[5]);
    ctx.lineWidth = 1 / this.zoom;
    ctx.strokeStyle = '#18b7d6';
    ctx.beginPath();
    const H = [...g.h, ...(dg && dg.axis === 'h' ? [dg.pos] : [])];
    const V = [...g.v, ...(dg && dg.axis === 'v' ? [dg.pos] : [])];
    for (const y of H) { ctx.moveTo(0, y); ctx.lineTo(this.W, y); }
    for (const x of V) { ctx.moveTo(x, 0); ctx.lineTo(x, this.H); }
    ctx.stroke();
    if (bleed) {
      const b = this.bleedPx();
      ctx.strokeStyle = '#e5484d';
      ctx.setLineDash([6 / this.zoom, 4 / this.zoom]);
      ctx.strokeRect(b, b, this.W - 2 * b, this.H - 2 * b);
    }
    ctx.restore();
  },

  bleedPx() {
    const pxPerMM = this.design.mm ? this.W / this.design.mm[0] : 96 / 25.4;
    return 3 * pxPerMM;
  },
};
