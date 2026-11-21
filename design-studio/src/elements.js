// Elements library: shape families + open-licensed graphics collections (loaded on demand).
import { FabricImage, loadSVGFromString, util } from 'fabric';
import { esc } from './ui.js';
import { icon } from './icons.js';
import { SHAPE_FAMILIES, makeFamilyShape, familyPreview } from './shapes2.js';

let gfxPromise = null;
/** The graphics collections (a separate chunk, ~3 MB, fetched the first time the Elements panel opens). */
export const loadGraphics = () => (gfxPromise ||= import('./graphics-data.js').then((m) => m.default));

const svgString = (col, it, { size = 0, color } = {}) => {
  const [, body, w, h, , brand] = it;
  let b = body;
  if (col.kind === 'mono') b = b.replace(/currentColor/g, color || brand || '#1f2333');
  const fill = col.kind === 'mono' && col.mode === 'fill' && !/fill=/.test(b.slice(0, 40)) ? ` fill="${color || brand || '#1f2333'}"` : '';
  const dim = size ? ` width="${Math.round((size * w) / Math.max(w, h))}" height="${Math.round((size * h) / Math.max(w, h))}"` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}"${dim}${fill}>${b}</svg>`;
};
const svgURL = (s) => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s);
export const graphicThumb = (col, it) => `<img src="${svgURL(svgString(col, it, { size: 96 }))}" alt="" loading="lazy" decoding="async">`;

// ---------------------------------------------------------------- recents
const RKEY = 'lai-el-recent';
const recents = () => { try { return JSON.parse(localStorage.getItem(RKEY) || '[]'); } catch { return []; } };
const pushRecent = (id) => { try { localStorage.setItem(RKEY, JSON.stringify([id, ...recents().filter((x) => x !== id)].slice(0, 24))); } catch { /* storage blocked */ } };

// ---------------------------------------------------------------- lookups
export function findItem(gfx, id) {
  const [kind, a, b] = id.split('|');
  if (kind === 'sf') { const f = SHAPE_FAMILIES.find((x) => x.k === a); return f && f.items[+b] ? { kind: 'shape', fam: f, item: f.items[+b] } : null; }
  const col = gfx && gfx.find((c) => c.k === a);
  const it = col && col.items.find((x) => x[0] === b);
  return it ? { kind: 'gfx', col, item: it } : null;
}
const tile = (id, inner, title) => `<button class="el gfx" data-act="gfx:${esc(id)}" title="${esc(title)}">${inner}</button>`;
const shapeTile = (f, i) => tile(`sf|${f.k}|${i}`, familyPreview(f.items[i]), `รูปทรง ${f.title} ${f.items[i].label}`);
const gfxTile = (c, it) => tile(`g|${c.k}|${it[0]}`, graphicThumb(c, it), `${c.title} ${it[0].replace(/-/g, ' ')} ${it[4] || ''}`);
const row = (title, view, tiles, n) => `<div class="el-row-head"><b>${esc(title)}</b>${view ? `<button class="link" data-el-view="${esc(view)}">ดูทั้งหมด${n ? ` (${n})` : ''}</button>` : ''}</div><div class="el-row">${tiles}</div>`;

/** Top of the Elements panel: recents, shapes, collections, icons, social … (rows of 6 with "see all"). */
export function elementsHomeHTML(gfx) {
  const rec = recents().map((id) => ({ id, f: findItem(gfx, id) })).filter((x) => x.f).slice(0, 8);
  const byKey = Object.fromEntries((gfx || []).map((c) => [c.k, c]));
  const take = (k, n = 6) => (byKey[k] ? byKey[k].items.slice(0, n).map((it) => gfxTile(byKey[k], it)).join('') : '');
  const recentTiles = rec.map(({ f }) => (f.kind === 'shape' ? shapeTile(f.fam, f.fam.items.indexOf(f.item)) : gfxTile(f.col, f.item))).join('');
  const shapeRow = SHAPE_FAMILIES.map((f) => shapeTile(f, 0)).slice(0, 6).join('');
  const colCards = (gfx || []).filter((c) => !['3d', 'social', 'hand', 'kameleon', 'business'].includes(c.k) && !c.k.startsWith('tabler')).map((c) => `
    <button class="col-card" data-el-view="col:${c.k}" title="คอลเลกชัน ${esc(c.title)}">
      <span class="col-prev">${c.items.slice(0, 6).map((it) => graphicThumb(c, it)).join('')}</span>
      <b>${esc(c.title)}</b><small>${c.items.length} กราฟิก</small></button>`).join('');
  return `
    ${rec.length ? row('ใช้งานล่าสุด', '', recentTiles) : ''}
    ${row('รูปทรง', 'shapes', shapeRow, SHAPE_FAMILIES.reduce((a, f) => a + f.items.length, 0))}
    ${gfx ? `
      ${row('สติกเกอร์ 3 มิติ', 'col:3d', take('3d'), byKey['3d']?.items.length)}
      ${row('โซเชียลมีเดีย', 'col:social', take('social'), byKey.social?.items.length)}
      ${row('ไอคอน', 'icons', take('tabler-0', 3) + take('tabler-2', 3), gfx.filter((c) => c.k.startsWith('tabler')).reduce((a, c) => a + c.items.length, 0))}
      ${row('ภาพวาดลายมือ', 'col:hand', take('hand'), byKey.hand?.items.length)}
      ${row('ภาพประกอบธุรกิจและการศึกษา', 'col:business', take('business'), byKey.business?.items.length)}
      ${row('ภาพประกอบวงกลม', 'col:kameleon', take('kameleon'), byKey.kameleon?.items.length)}
      <div class="el-row-head"><b>คอลเลกชันกราฟิก</b></div>
      <div class="col-grid">${colCards}</div>` : '<p class="hint" data-gfx-loading>กำลังโหลดคลังกราฟิก…</p>'}`;
}

/** Full view of one collection / all shapes / all icons, with a back button. */
export function elementsViewHTML(gfx, view) {
  const back = (title, sub = '') => `<div class="el-view-head"><button class="icon-btn" data-el-view="" title="กลับ">${icon('left', 20)}</button><b>${esc(title)}</b>${sub}</div>`;
  if (view === 'shapes') {
    return back('รูปทรง') + SHAPE_FAMILIES.map((f) => `<div class="el-row-head"><b>${esc(f.title)}</b></div><div class="el-grid shapes2">${f.items.map((_, i) => shapeTile(f, i)).join('')}</div>`).join('');
  }
  if (view === 'icons') {
    return back('ไอคอน', '<small class="hint">เปลี่ยนสีได้</small>') + gfx.filter((c) => c.k.startsWith('tabler')).map((c) => `<div class="el-row-head"><b>${esc(c.title)}</b></div><div class="el-grid gfx-grid">${c.items.map((it) => gfxTile(c, it)).join('')}</div>`).join('');
  }
  const c = gfx.find((x) => 'col:' + x.k === view);
  if (!c) return back('ไม่พบ');
  return back(c.title, `<small class="hint">${c.items.length} กราฟิก</small>`) + `<div class="el-grid gfx-grid ${c.k === '3d' || c.k === 'hand' ? 'big' : ''}">${c.items.map((it) => gfxTile(c, it)).join('')}</div>
    <p class="credit">ที่มา: ${esc(c.credit)}</p>`;
}

/** Search across shapes and graphics (English names + Thai keywords + collection titles). */
export function elementsSearchHTML(gfx, q) {
  const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
  const hit = (txt) => terms.every((t) => txt.includes(t));
  const shapes = SHAPE_FAMILIES.flatMap((f) => f.items.map((it, i) => ({ f, i, txt: `${f.title} ${it.label} รูปทรง`.toLowerCase() }))).filter((x) => hit(x.txt));
  const g = (gfx || []).flatMap((c) => c.items.map((it) => ({ c, it, txt: `${c.title} ${it[0].replace(/-/g, ' ')} ${it[4] || ''}`.toLowerCase() }))).filter((x) => hit(x.txt));
  const n = shapes.length + g.length;
  if (!n) return '';
  return `<div class="el-row-head"><b>ผลการค้นหา</b><small class="hint">${n} รายการ</small></div>
    <div class="el-grid gfx-grid" data-el-results>${[...shapes.slice(0, 40).map((x) => shapeTile(x.f, x.i)), ...g.slice(0, 160).map((x) => gfxTile(x.c, x.it))].join('')}</div>`;
}

/** Make the Fabric object for an element id. */
export async function makeElement(gfx, id, size) {
  const f = findItem(gfx, id);
  if (!f) return null;
  pushRecent(id);
  if (f.kind === 'shape') return makeFamilyShape(f.item, size);
  const { col, item } = f;
  const [name, , w, h] = item;
  if (col.kind === 'mono') {
    // vector, recolourable
    const { objects, options } = await loadSVGFromString(svgString(col, item));
    const o = util.groupSVGElements(objects.filter(Boolean), options);
    const k = size / Math.max(o.width, o.height);
    o.set({ scaleX: k, scaleY: k, name: `${col.title}: ${name}` });
    o.graphic = { c: col.k, n: name, mono: true, color: item[5] || '#1f2333' };
    return o;
  }
  // full colour (gradients, soft shadows): a sharp picture rendered from the SVG
  const px = 1024;
  const img = await FabricImage.fromURL(svgURL(svgString(col, item, { size: px })));
  const k = size / Math.max(img.width, img.height);
  img.set({ scaleX: k, scaleY: k, name: `${col.title}: ${name}` });
  img.graphic = { c: col.k, n: name };
  return img;
}

/** Recolour a single-colour (vector) graphic. */
export function recolorGraphic(o, color) {
  const parts = o.getObjects ? o.getObjects() : [o];
  for (const p of parts) {
    const has = (v) => v && v !== 'none' && v !== 'transparent';
    if (has(p.fill)) p.set('fill', color);
    if (has(p.stroke)) p.set('stroke', color);
  }
  o.graphic = { ...o.graphic, color };
  o.set('dirty', true);
}
