// Adaptive templates: positions are fractions of the page (x, y = center),
// sizes are fractions of the page's short side (u) so they fit any format.
import { Rect, Circle, Textbox, Polygon, Line, Gradient } from 'fabric';

import { GENERATED_TEMPLATES } from './templates2.js';
// pro presentation slides built with the app's own tools (tools/build_pro_templates.cjs)
import PRO_TEMPLATES from './protemplates.json';

export const PRO_CATEGORY = 'พรีเซนต์มืออาชีพ';

export const TEMPLATES = [
  {
    id: 'sale', cat: 'โปรโมชัน', name: 'โปรโมชันลดราคา', bg: ['#ff5e62', '#ff9966'],
    items: [
      { t: 'circle', x: 0.85, y: 0.15, r: 0.28, fill: '#ffffff', opacity: 0.15 },
      { t: 'circle', x: 0.1, y: 0.9, r: 0.22, fill: '#ffffff', opacity: 0.12 },
      { t: 'text', x: 0.5, y: 0.25, w: 0.8, text: 'โปรพิเศษ!', size: 0.07, font: 'Kanit', color: '#fff3e0' },
      { t: 'text', x: 0.5, y: 0.45, w: 0.95, text: 'SALE 50%', size: 0.2, font: 'Anton', color: '#ffffff', shadow: true },
      { t: 'rect', x: 0.5, y: 0.66, w: 0.55, h: 0.1, fill: '#1f2333', rx: 0.05 },
      { t: 'text', x: 0.5, y: 0.66, w: 0.55, text: 'วันนี้ – 31 ธ.ค. เท่านั้น', size: 0.045, font: 'Kanit', color: '#ffffff' },
      { t: 'text', x: 0.5, y: 0.85, w: 0.8, text: 'ร้านของคุณ · @yourshop', size: 0.035, font: 'Prompt', color: '#fff3e0' },
    ],
  },
  {
    id: 'quote', cat: 'คำคม', name: 'คำคม', bg: '#f6f1e9',
    items: [
      { t: 'text', x: 0.5, y: 0.25, w: 0.3, text: '“', size: 0.3, font: 'Playfair Display', color: '#d4a373' },
      { t: 'text', x: 0.5, y: 0.5, w: 0.8, text: 'ความสำเร็จไม่ใช่จุดหมาย\nแต่คือการเดินทาง', size: 0.065, font: 'Pridi', color: '#3d2c1e', lh: 1.4 },
      { t: 'line', x: 0.5, y: 0.7, w: 0.15, stroke: '#d4a373', sw: 0.006 },
      { t: 'text', x: 0.5, y: 0.77, w: 0.8, text: 'ชื่อผู้กล่าว', size: 0.035, font: 'Sarabun', color: '#7f6a55' },
    ],
  },
  {
    id: 'math', cat: 'การศึกษา', name: 'ใบงานคณิตศาสตร์', bg: '#ffffff',
    items: [
      { t: 'rect', x: 0.5, y: 0.07, w: 1, h: 0.14, fill: ['#4f8cff', '#7c5cff'] },
      { t: 'text', x: 0.5, y: 0.07, w: 0.9, text: 'ใบงานคณิตศาสตร์ เรื่อง การบวกและการลบ', size: 0.05, font: 'Kanit', color: '#ffffff', bold: true },
      { t: 'text', x: 0.08, y: 0.19, w: 0.84, text: 'ชื่อ ..................................................  ชั้น ............  เลขที่ ........', size: 0.03, font: 'Sarabun', color: '#333', align: 'left', ax: 'left' },
      { t: 'text', x: 0.08, y: 0.27, w: 0.84, text: 'คำชี้แจง: หาผลลัพธ์ให้ถูกต้อง', size: 0.032, font: 'Sarabun', color: '#4f8cff', bold: true, align: 'left', ax: 'left' },
      { t: 'text', x: 0.08, y: 0.36, w: 0.4, text: '1)  25 + 17 = ..........', size: 0.04, font: 'Sarabun', color: '#222', align: 'left', ax: 'left' },
      { t: 'text', x: 0.55, y: 0.36, w: 0.4, text: '2)  48 − 19 = ..........', size: 0.04, font: 'Sarabun', color: '#222', align: 'left', ax: 'left' },
      { t: 'text', x: 0.08, y: 0.46, w: 0.4, text: '3)  36 + 45 = ..........', size: 0.04, font: 'Sarabun', color: '#222', align: 'left', ax: 'left' },
      { t: 'text', x: 0.55, y: 0.46, w: 0.4, text: '4)  90 − 34 = ..........', size: 0.04, font: 'Sarabun', color: '#222', align: 'left', ax: 'left' },
      { t: 'text', x: 0.08, y: 0.56, w: 0.4, text: '5)  12 × 3 = ..........', size: 0.04, font: 'Sarabun', color: '#222', align: 'left', ax: 'left' },
      { t: 'text', x: 0.55, y: 0.56, w: 0.4, text: '6)  56 ÷ 7 = ..........', size: 0.04, font: 'Sarabun', color: '#222', align: 'left', ax: 'left' },
      { t: 'rect', x: 0.5, y: 0.76, w: 0.84, h: 0.2, fill: '#f1f5ff', stroke: '#4f8cff', sw: 0.003, rx: 0.02 },
      { t: 'text', x: 0.5, y: 0.71, w: 0.76, text: 'โจทย์ปัญหา: แม่มีส้ม 24 ผล ซื้อเพิ่มอีก 18 ผล แม่มีส้มทั้งหมดกี่ผล', size: 0.032, font: 'Sarabun', color: '#222', align: 'left' },
      { t: 'text', x: 0.5, y: 0.8, w: 0.76, text: 'ตอบ ..................................................', size: 0.032, font: 'Sarabun', color: '#222', align: 'left' },
      { t: 'text', x: 0.88, y: 0.94, w: 0.2, text: '⭐⭐⭐', size: 0.04, font: 'sans-serif', color: '#222' },
    ],
  },
  {
    id: 'certificate', cat: 'การศึกษา', name: 'เกียรติบัตร', bg: '#fffdf6',
    items: [
      { t: 'rect', x: 0.5, y: 0.5, w: 0.94, h: 0.92, fill: 'transparent', stroke: '#c9a227', sw: 0.012 },
      { t: 'rect', x: 0.5, y: 0.5, w: 0.9, h: 0.86, fill: 'transparent', stroke: '#c9a227', sw: 0.003 },
      { t: 'text', x: 0.5, y: 0.2, w: 0.8, text: 'เกียรติบัตร', size: 0.13, font: 'Charm', color: '#8a6d10', bold: true },
      { t: 'text', x: 0.5, y: 0.34, w: 0.8, text: 'ขอมอบให้ไว้เพื่อแสดงว่า', size: 0.045, font: 'Sarabun', color: '#444' },
      { t: 'text', x: 0.5, y: 0.47, w: 0.8, text: 'เด็กหญิงใจดี  มีความรู้', size: 0.09, font: 'Pridi', color: '#1f2333', bold: true },
      { t: 'text', x: 0.5, y: 0.6, w: 0.75, text: 'ได้รับรางวัลชนะเลิศ การแข่งขันคิดเลขเร็ว ประจำปีการศึกษา 2569', size: 0.042, font: 'Sarabun', color: '#444' },
      { t: 'line', x: 0.5, y: 0.8, w: 0.3, stroke: '#444', sw: 0.002 },
      { t: 'text', x: 0.5, y: 0.85, w: 0.5, text: '(ผู้อำนวยการโรงเรียน)', size: 0.035, font: 'Sarabun', color: '#444' },
      { t: 'circle', x: 0.85, y: 0.78, r: 0.09, fill: ['#f6d365', '#c9a227'] },
      { t: 'text', x: 0.85, y: 0.78, w: 0.15, text: '🏆', size: 0.08, font: 'sans-serif', color: '#000' },
    ],
  },
  {
    id: 'birthday', cat: 'เฉลิมฉลอง', name: 'สุขสันต์วันเกิด', bg: ['#a18cd1', '#fbc2eb'],
    items: [
      { t: 'text', x: 0.5, y: 0.2, w: 0.6, text: '🎈🎂🎉', size: 0.12, font: 'sans-serif', color: '#000' },
      { t: 'text', x: 0.5, y: 0.42, w: 0.9, text: 'Happy Birthday', size: 0.13, font: 'Pacifico', color: '#ffffff', shadow: true },
      { t: 'text', x: 0.5, y: 0.6, w: 0.8, text: 'สุขสันต์วันเกิดนะ!', size: 0.07, font: 'Mitr', color: '#4a2a6b' },
      { t: 'text', x: 0.5, y: 0.75, w: 0.75, text: 'ขอให้มีความสุขมาก ๆ สุขภาพแข็งแรง\nสมหวังทุกสิ่งที่ปรารถนา', size: 0.04, font: 'Mali', color: '#4a2a6b', lh: 1.4 },
    ],
  },
  {
    id: 'event', cat: 'กิจกรรม', name: 'เชิญร่วมงาน', bg: '#0f172a',
    items: [
      { t: 'circle', x: 0.9, y: 0.1, r: 0.35, fill: ['#7c5cff', '#22d3ee'], opacity: 0.6 },
      { t: 'circle', x: 0.05, y: 0.95, r: 0.25, fill: ['#ff5fa2', '#7c5cff'], opacity: 0.5 },
      { t: 'text', x: 0.5, y: 0.22, w: 0.8, text: 'ขอเชิญร่วมงาน', size: 0.05, font: 'Prompt', color: '#94a3b8' },
      { t: 'text', x: 0.5, y: 0.38, w: 0.9, text: 'งานสัมมนาประจำปี', size: 0.1, font: 'Kanit', color: '#ffffff', bold: true },
      { t: 'text', x: 0.5, y: 0.5, w: 0.8, text: 'นวัตกรรมการเรียนรู้ 2026', size: 0.055, font: 'Kanit', color: '#22d3ee' },
      { t: 'rect', x: 0.5, y: 0.68, w: 0.7, h: 0.16, fill: '#ffffff', opacity: 0.08, rx: 0.03 },
      { t: 'text', x: 0.5, y: 0.68, w: 0.65, text: '📅 15 ธันวาคม 2569  ·  ⏰ 09:00 น.\n📍 หอประชุมใหญ่', size: 0.038, font: 'Prompt', color: '#e2e8f0', lh: 1.5 },
      { t: 'text', x: 0.5, y: 0.88, w: 0.8, text: 'ลงทะเบียนฟรี!', size: 0.04, font: 'Prompt', color: '#ffffff', bold: true },
    ],
  },
  {
    id: 'announce', cat: 'ประกาศ', name: 'ประกาศ', bg: '#fff8e1',
    items: [
      { t: 'rect', x: 0.5, y: 0.14, w: 1, h: 0.28, fill: '#ffc107' },
      { t: 'text', x: 0.5, y: 0.14, w: 0.9, text: '📣 ประกาศ', size: 0.12, font: 'Kanit', color: '#1f2333', bold: true },
      { t: 'text', x: 0.5, y: 0.45, w: 0.85, text: 'ร้านปิดปรับปรุงชั่วคราว', size: 0.07, font: 'Kanit', color: '#1f2333', bold: true },
      { t: 'text', x: 0.5, y: 0.6, w: 0.8, text: 'ตั้งแต่วันที่ 1 – 7 มกราคม\nขออภัยในความไม่สะดวก', size: 0.045, font: 'Sarabun', color: '#444', lh: 1.4 },
      { t: 'text', x: 0.5, y: 0.85, w: 0.8, text: 'โทร 08X-XXX-XXXX', size: 0.04, font: 'Prompt', color: '#b8860b', bold: true },
    ],
  },
  {
    id: 'slide', cat: 'นำเสนอ', name: 'สไลด์หน้าแรก', bg: '#ffffff',
    items: [
      { t: 'rect', x: 0.04, y: 0.5, w: 0.08, h: 1, fill: ['#7c5cff', '#ff5fa2'] },
      { t: 'text', x: 0.55, y: 0.4, w: 0.75, text: 'หัวข้อการนำเสนอ', size: 0.13, font: 'Kanit', color: '#1f2333', bold: true, align: 'left' },
      { t: 'text', x: 0.55, y: 0.56, w: 0.75, text: 'คำอธิบายสั้น ๆ เกี่ยวกับเนื้อหา', size: 0.055, font: 'Prompt', color: '#64748b', align: 'left' },
      { t: 'line', x: 0.25, y: 0.67, w: 0.12, stroke: '#7c5cff', sw: 0.012 },
      { t: 'text', x: 0.55, y: 0.78, w: 0.75, text: 'ชื่อผู้นำเสนอ · วันที่', size: 0.04, font: 'Prompt', color: '#1f2333', align: 'left' },
    ],
  },
  {
    id: 'thanks', cat: 'เฉลิมฉลอง', name: 'ขอบคุณ', bg: ['#d4fc79', '#96e6a1'],
    items: [
      { t: 'text', x: 0.5, y: 0.4, w: 0.9, text: 'Thank You', size: 0.17, font: 'Dancing Script', color: '#1d4d2b', bold: true },
      { t: 'text', x: 0.5, y: 0.58, w: 0.8, text: 'ขอบคุณที่อุดหนุนนะคะ 💚', size: 0.06, font: 'Itim', color: '#1d4d2b' },
      { t: 'text', x: 0.5, y: 0.8, w: 0.8, text: '@yourshop', size: 0.04, font: 'Poppins', color: '#2f6b3f' },
    ],
  },
  {
    id: 'menu', cat: 'ร้านอาหาร', name: 'เมนูร้านกาแฟ', bg: '#2b1d14',
    items: [
      { t: 'text', x: 0.5, y: 0.1, w: 0.8, text: 'COFFEE MENU', size: 0.09, font: 'Bebas Neue', color: '#f4e1c1' },
      { t: 'line', x: 0.5, y: 0.17, w: 0.5, stroke: '#c8a27a', sw: 0.004 },
      { t: 'text', x: 0.12, y: 0.28, w: 0.55, text: 'เอสเปรสโซ', size: 0.05, font: 'Kanit', color: '#f4e1c1', align: 'left', ax: 'left' },
      { t: 'text', x: 0.88, y: 0.28, w: 0.25, text: '55.-', size: 0.05, font: 'Kanit', color: '#c8a27a', align: 'right', ax: 'right' },
      { t: 'text', x: 0.12, y: 0.4, w: 0.55, text: 'อเมริกาโน่', size: 0.05, font: 'Kanit', color: '#f4e1c1', align: 'left', ax: 'left' },
      { t: 'text', x: 0.88, y: 0.4, w: 0.25, text: '60.-', size: 0.05, font: 'Kanit', color: '#c8a27a', align: 'right', ax: 'right' },
      { t: 'text', x: 0.12, y: 0.52, w: 0.55, text: 'ลาเต้', size: 0.05, font: 'Kanit', color: '#f4e1c1', align: 'left', ax: 'left' },
      { t: 'text', x: 0.88, y: 0.52, w: 0.25, text: '65.-', size: 0.05, font: 'Kanit', color: '#c8a27a', align: 'right', ax: 'right' },
      { t: 'text', x: 0.12, y: 0.64, w: 0.55, text: 'คาปูชิโน่', size: 0.05, font: 'Kanit', color: '#f4e1c1', align: 'left', ax: 'left' },
      { t: 'text', x: 0.88, y: 0.64, w: 0.25, text: '65.-', size: 0.05, font: 'Kanit', color: '#c8a27a', align: 'right', ax: 'right' },
      { t: 'text', x: 0.12, y: 0.76, w: 0.55, text: 'ชาไทย', size: 0.05, font: 'Kanit', color: '#f4e1c1', align: 'left', ax: 'left' },
      { t: 'text', x: 0.88, y: 0.76, w: 0.25, text: '50.-', size: 0.05, font: 'Kanit', color: '#c8a27a', align: 'right', ax: 'right' },
      { t: 'text', x: 0.5, y: 0.9, w: 0.8, text: '☕ เปิดทุกวัน 07:00 – 18:00', size: 0.035, font: 'Prompt', color: '#c8a27a' },
    ],
  },
  {
    id: 'thumb', cat: 'โซเชียล', name: 'ปกวิดีโอ', bg: ['#141e30', '#243b55'],
    items: [
      // text keeps clear of the yellow stripe on every page shape (it shrinks to fit its column)
      { t: 'rect', x: 0.8, y: 0.5, w: 0.5, h: 1.2, fill: '#ffd400', angle: 12 },
      { t: 'text', x: 0.25, y: 0.32, w: 0.42, text: 'สอนเทคนิค', size: 0.1, font: 'Kanit', color: '#ffffff', bold: true, align: 'left' },
      { t: 'text', x: 0.25, y: 0.5, w: 0.42, text: 'คิดเลขเร็ว', size: 0.17, font: 'Kanit', color: '#ffd400', bold: true, align: 'left', shadow: true },
      { t: 'text', x: 0.25, y: 0.68, w: 0.42, text: 'ใน 5 นาที!', size: 0.1, font: 'Kanit', color: '#ffffff', bold: true, align: 'left' },
      { t: 'text', x: 0.8, y: 0.5, w: 0.3, text: '🧮', size: 0.3, font: 'sans-serif', color: '#000' },
    ],
  },
  {
    id: 'minimal', cat: 'คำคม', name: 'มินิมอล', bg: '#ffffff',
    items: [
      { t: 'rect', x: 0.5, y: 0.5, w: 0.86, h: 0.86, fill: 'transparent', stroke: '#1f2333', sw: 0.004 },
      { t: 'text', x: 0.5, y: 0.42, w: 0.7, text: 'LESS IS MORE', size: 0.08, font: 'Montserrat', color: '#1f2333', bold: true, spacing: 300 },
      { t: 'text', x: 0.5, y: 0.55, w: 0.7, text: 'เรียบง่าย แต่มีความหมาย', size: 0.04, font: 'Prompt', color: '#64748b' },
    ],
  },
  ...GENERATED_TEMPLATES,
  ...PRO_TEMPLATES.map((t) => ({ ...t, cat: PRO_CATEGORY, items: [] })),
];

export const TEMPLATE_CATEGORIES = ['ทั้งหมด', PRO_CATEGORY, ...new Set(TEMPLATES.map((t) => t.cat).filter((c) => c !== PRO_CATEGORY))];

function fillOf(v, angle = 135) {
  if (!Array.isArray(v)) return v;
  const rad = (angle * Math.PI) / 180;
  const x = Math.cos(rad) / 2;
  const y = Math.sin(rad) / 2;
  return new Gradient({
    type: 'linear',
    gradientUnits: 'percentage',
    coords: { x1: 0.5 - x, y1: 0.5 - y, x2: 0.5 + x, y2: 0.5 + y },
    colorStops: [{ offset: 0, color: v[0] }, { offset: 1, color: v[1] }],
  });
}

export function pageGradient(a, b, W, H) {
  return new Gradient({
    type: 'linear',
    gradientUnits: 'pixels',
    coords: { x1: 0, y1: 0, x2: W, y2: H },
    colorStops: [{ offset: 0, color: a }, { offset: 1, color: b }],
  });
}

/** Build the fabric objects of a template for a W×H page. */
export function buildTemplate(tpl, W, H) {
  if (tpl.page) return buildPageTemplate(tpl, W, H);
  const u = Math.min(W, H);
  const objs = [];
  for (const it of tpl.items) {
    let o;
    const common = { originX: it.ax || 'center', originY: 'center', left: it.x * W, top: it.y * H, opacity: it.opacity ?? 1, angle: it.angle || 0 };
    if (it.t === 'text') {
      o = new Textbox(it.text, {
        ...common,
        width: it.w * W,
        fontSize: it.size * u,
        fontFamily: it.font,
        fill: it.color,
        fontWeight: it.bold ? 'bold' : 'normal',
        textAlign: it.align || 'center',
        lineHeight: it.lh || 1.16,
        charSpacing: it.spacing || 0,
        name: 'ข้อความ',
      });
      if (it.shadow) o.set('shadow', { color: 'rgba(0,0,0,0.3)', blur: u * 0.02, offsetX: u * 0.006, offsetY: u * 0.008 });
      // the template's designed lines break only at spaces; a word longer than the box (common in Thai,
      // which has no spaces) widens the box in that layout: shrink to fit
      o.set('splitByGrapheme', false);
      o.initDimensions();
      const target = it.w * W;
      if (o.width > target + 1) {
        const k = target / o.width;
        o.set({ fontSize: o.fontSize * k, width: target });
        o.initDimensions();
      }
      // Thai word wrapping must not add lines the design did not have (a heading stays one line)
      const designed = o._textLines.length;
      o.set('splitByGrapheme', true);
      o.initDimensions();
      for (let k = 0; k < 16 && o._textLines.length > designed; k++) {
        o.set('fontSize', o.fontSize * 0.96);
        o.initDimensions();
      }
    } else if (it.t === 'rect') {
      const w = it.w * W, h = it.h * H;
      o = new Rect({
        ...common,
        width: w,
        height: h,
        fill: fillOf(it.fill),
        stroke: it.stroke || null,
        strokeWidth: it.sw ? it.sw * u : 0,
        rx: it.rx ? it.rx * u : 0,
        ry: it.rx ? it.rx * u : 0,
        name: 'สี่เหลี่ยม',
      });
      if (it.shadow) o.set('shadow', { color: 'rgba(0,0,0,0.12)', blur: u * 0.04, offsetX: 0, offsetY: u * 0.012 });
    } else if (it.t === 'circle') {
      o = new Circle({ ...common, radius: it.r * u, fill: fillOf(it.fill), stroke: it.stroke || null, strokeWidth: it.sw ? it.sw * u : 0, name: 'วงกลม' });
    } else if (it.t === 'line') {
      const w = it.w * W;
      o = new Line([0, 0, w, 0], { ...common, stroke: it.stroke, strokeWidth: it.sw * u, strokeLineCap: 'round', name: 'เส้น' });
    } else if (it.t === 'poly') {
      o = new Polygon(it.points.map(([x, y]) => ({ x: x * W, y: y * H })), { fill: fillOf(it.fill), name: 'รูปทรง' });
    }
    if (o) {
      // Textbox in a left/right anchored column: anchor by the given edge
      if (it.ax === 'right') o.set({ originX: 'right' });
      objs.push(o);
    }
  }
  const bg = Array.isArray(tpl.bg) ? pageGradient(tpl.bg[0], tpl.bg[1], W, H) : tpl.bg;
  return { objects: objs, background: bg };
}

/**
 * A template stored as a finished page (designed at tpl.w×tpl.h): scaled uniformly to fit the
 * W×H page and centred. Objects come back as plain JSON wrapped in { toObject } like fabric objects.
 */
function buildPageTemplate(tpl, W, H) {
  const s = Math.min(W / tpl.w, H / tpl.h);
  const dx = (W - tpl.w * s) / 2, dy = (H - tpl.h * s) / 2;
  const objects = tpl.page.objects.map((o) => {
    const c = structuredClone(o);
    c.left = (o.left || 0) * s + dx;
    c.top = (o.top || 0) * s + dy;
    c.scaleX = (o.scaleX ?? 1) * s;
    c.scaleY = (o.scaleY ?? 1) * s;
    return { toObject: () => structuredClone(c) };
  });
  return { objects, background: structuredClone(tpl.page.background) };
}

function pageFonts(objs, out = new Set()) {
  for (const o of objs || []) {
    if (o.fontFamily) out.add(o.fontFamily);
    pageFonts(o.objects, out);
  }
  return out;
}

export function templateFonts(tpl) {
  if (tpl.page) return [...pageFonts(tpl.page.objects)].filter((f) => f !== 'sans-serif');
  return [...new Set(tpl.items.filter((i) => i.font && i.font !== 'sans-serif').map((i) => i.font))];
}

