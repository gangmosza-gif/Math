// Generated template library: 16 layout archetypes × 5 colour/font themes = 80 templates.
// Coordinates follow templates.js: x/y = centre as a fraction of the page, sizes as a fraction
// of the page's short side, so every template adapts to any page size.

const THEMES = [
  { key: 'violet', name: 'ม่วง', bg: '#f5f3ff', card: '#ffffff', pri: '#6d28d9', acc: '#f59e0b', text: '#1f1b2e', muted: '#6b7280', head: 'Kanit', body: 'Sarabun' },
  { key: 'ocean', name: 'ทะเล', bg: '#ecfeff', card: '#ffffff', pri: '#0e7490', acc: '#f43f5e', text: '#0f172a', muted: '#64748b', head: 'Prompt', body: 'Sarabun' },
  { key: 'forest', name: 'ป่าเขียว', bg: '#f0fdf4', card: '#ffffff', pri: '#15803d', acc: '#eab308', text: '#14281d', muted: '#4b5563', head: 'Mitr', body: 'Niramit' },
  { key: 'night', name: 'ค่ำคืน', bg: '#1c1917', card: '#292524', pri: '#f97316', acc: '#facc15', text: '#fafaf9', muted: '#a8a29e', head: 'Chakra Petch', body: 'Bai Jamjuree' },
  { key: 'rose', name: 'กุหลาบ', bg: '#fff1f2', card: '#ffffff', pri: '#be123c', acc: '#0ea5e9', text: '#3f0d1b', muted: '#6b7280', head: 'Pridi', body: 'Taviraj' },
];

const T = (t, x, y, w, text, size, extra = {}) => ({ t: 'text', x, y, w, text, size, font: t.body, color: t.text, ...extra });
const H = (t, x, y, w, text, size, extra = {}) => ({ t: 'text', x, y, w, text, size, font: t.head, color: t.text, bold: true, ...extra });

const ARCHETYPES = [
  { key: 'hero', name: 'เปิดตัวสินค้า', cat: 'โปรโมชัน', items: (t) => [
    { t: 'circle', x: 0.88, y: 0.12, r: 0.3, fill: t.pri, opacity: 0.15 },
    { t: 'circle', x: 0.08, y: 0.92, r: 0.18, fill: t.acc, opacity: 0.25 },
    T(t, 0.5, 0.26, 0.8, 'สินค้าใหม่ล่าสุด', 0.045, { color: t.pri, bold: true, spacing: 150 }),
    H(t, 0.5, 0.42, 0.86, 'เปิดตัวแล้ววันนี้', 0.11),
    T(t, 0.5, 0.58, 0.72, 'ดีไซน์ใหม่ ใช้งานง่าย ราคาพิเศษสำหรับลูกค้า 100 ท่านแรก', 0.038, { color: t.muted, lh: 1.4 }),
    { t: 'rect', x: 0.5, y: 0.76, w: 0.42, h: 0.085, fill: t.pri, rx: 0.045 },
    T(t, 0.5, 0.76, 0.4, 'สั่งซื้อเลย', 0.04, { color: '#ffffff', bold: true }),
  ] },
  { key: 'split', name: 'แบ่งครึ่งหน้า', cat: 'ธุรกิจ', items: (t) => [
    { t: 'rect', x: 0.22, y: 0.5, w: 0.44, h: 1, fill: t.pri },
    H(t, 0.22, 0.4, 0.38, 'บริการ\nของเรา', 0.09, { color: '#ffffff', lh: 1.15 }),
    T(t, 0.22, 0.62, 0.36, 'ครบ จบ ในที่เดียว', 0.04, { color: '#ffffff', opacity: 0.85 }),
    T(t, 0.73, 0.3, 0.46, '✔ ออกแบบกราฟิก', 0.042, { align: 'left' }),
    T(t, 0.73, 0.42, 0.46, '✔ ทำเว็บไซต์', 0.042, { align: 'left' }),
    T(t, 0.73, 0.54, 0.46, '✔ ดูแลโซเชียลมีเดีย', 0.042, { align: 'left' }),
    T(t, 0.73, 0.66, 0.46, '✔ ถ่ายภาพสินค้า', 0.042, { align: 'left' }),
    T(t, 0.73, 0.84, 0.46, 'ติดต่อ 08X-XXX-XXXX', 0.035, { color: t.pri, bold: true, align: 'left' }),
  ] },
  { key: 'band', name: 'หัวกระดาษแถบสี', cat: 'การศึกษา', items: (t) => [
    { t: 'rect', x: 0.5, y: 0.08, w: 1, h: 0.16, fill: t.pri },
    H(t, 0.5, 0.08, 0.9, 'สรุปบทเรียน วิทยาศาสตร์', 0.065, { color: '#ffffff' }),
    T(t, 0.08, 0.24, 0.84, 'หัวข้อ: วัฏจักรของน้ำ', 0.045, { color: t.pri, bold: true, align: 'left', ax: 'left' }),
    T(t, 0.08, 0.4, 0.84, '1. การระเหย – น้ำได้รับความร้อนกลายเป็นไอ\n2. การควบแน่น – ไอน้ำเย็นตัวกลายเป็นเมฆ\n3. หยาดน้ำฟ้า – ฝน หิมะ ลูกเห็บตกลงมา\n4. การรวมตัว – น้ำไหลกลับสู่แหล่งน้ำ', 0.036, { align: 'left', ax: 'left', lh: 1.7 }),
    { t: 'rect', x: 0.5, y: 0.75, w: 0.84, h: 0.16, fill: t.bg, stroke: t.pri, sw: 0.004, rx: 0.02 },
    T(t, 0.5, 0.75, 0.76, '💡 จำง่าย ๆ : ระเหย → ควบแน่น → ตก → รวมตัว', 0.035, { color: t.text }),
    { t: 'rect', x: 0.5, y: 0.97, w: 1, h: 0.06, fill: t.acc },
  ] },
  { key: 'frame', name: 'กรอบเกียรติบัตร', cat: 'การศึกษา', items: (t) => [
    { t: 'rect', x: 0.5, y: 0.5, w: 0.93, h: 0.91, fill: 'transparent', stroke: t.pri, sw: 0.014 },
    { t: 'rect', x: 0.5, y: 0.5, w: 0.88, h: 0.85, fill: 'transparent', stroke: t.acc, sw: 0.004 },
    H(t, 0.5, 0.2, 0.8, 'ใบประกาศเกียรติคุณ', 0.085, { color: t.pri }),
    T(t, 0.5, 0.33, 0.8, 'มอบให้แก่', 0.04, { color: t.muted }),
    H(t, 0.5, 0.46, 0.8, 'นายรักเรียน ขยันยิ่ง', 0.08),
    T(t, 0.5, 0.6, 0.72, 'เป็นผู้มีจิตอาสาและบำเพ็ญประโยชน์ต่อส่วนรวมดีเด่น', 0.04, { color: t.muted }),
    { t: 'line', x: 0.5, y: 0.8, w: 0.3, stroke: t.text, sw: 0.002 },
    T(t, 0.5, 0.85, 0.5, 'ผู้อำนวยการ', 0.035, { color: t.muted }),
  ] },
  { key: 'diagonal', name: 'แถบเฉียง', cat: 'โปรโมชัน', items: (t) => [
    // text stays left of the stripe on every page shape (square, 16:9, A4): narrow boxes that wrap
    { t: 'rect', x: 0.8, y: 0.5, w: 0.6, h: 1.4, fill: t.pri, angle: 14 },
    { t: 'rect', x: 0.99, y: 0.5, w: 0.1, h: 1.4, fill: t.acc, angle: 14 },
    H(t, 0.27, 0.32, 0.46, 'FLASH\nSALE', 0.15, { color: t.pri, align: 'left', lh: 1 }),
    T(t, 0.22, 0.58, 0.36, 'ลดสูงสุด 70% เฉพาะ 3 วันนี้', 0.045, { align: 'left', bold: true }),
    T(t, 0.22, 0.73, 0.36, 'ช้อปเลยที่หน้าร้านและออนไลน์', 0.035, { align: 'left', color: t.muted }),
    T(t, 0.8, 0.5, 0.3, '🛍️', 0.25, { font: 'sans-serif' }),
  ] },
  { key: 'bignum', name: 'ตัวเลขเด่น', cat: 'อินโฟกราฟิก', items: (t) => [
    T(t, 0.5, 0.18, 0.8, 'ผลสำรวจความพึงพอใจ', 0.045, { color: t.muted }),
    H(t, 0.5, 0.42, 0.9, '92%', 0.3, { color: t.pri }),
    T(t, 0.5, 0.64, 0.76, 'ของผู้ปกครองพอใจกับกิจกรรมของโรงเรียน', 0.045, { lh: 1.4 }),
    { t: 'line', x: 0.5, y: 0.78, w: 0.2, stroke: t.acc, sw: 0.01 },
    T(t, 0.5, 0.86, 0.8, 'สำรวจจากผู้ปกครอง 1,200 คน ปีการศึกษา 2569', 0.03, { color: t.muted }),
  ] },
  { key: 'steps', name: 'ขั้นตอน 3 ขั้น', cat: 'อินโฟกราฟิก', items: (t) => [
    H(t, 0.5, 0.13, 0.86, 'สมัครเรียนออนไลน์ ง่ายใน 3 ขั้นตอน', 0.06),
    ...[0, 1, 2].flatMap((i) => [
      { t: 'circle', x: 0.2 + i * 0.3, y: 0.42, r: 0.1, fill: i === 1 ? t.acc : t.pri },
      H(t, 0.2 + i * 0.3, 0.42, 0.16, String(i + 1), 0.09, { color: '#ffffff' }),
      H(t, 0.2 + i * 0.3, 0.62, 0.27, ['กรอกข้อมูล', 'ชำระเงิน', 'เริ่มเรียน'][i], 0.045),
      T(t, 0.2 + i * 0.3, 0.73, 0.27, ['ลงทะเบียนผ่านเว็บไซต์', 'โอนหรือจ่ายผ่าน QR', 'รับรหัสเข้าห้องเรียน'][i], 0.03, { color: t.muted, lh: 1.4 }),
    ]),
    { t: 'line', x: 0.35, y: 0.42, w: 0.1, stroke: t.muted, sw: 0.004 },
    { t: 'line', x: 0.65, y: 0.42, w: 0.1, stroke: t.muted, sw: 0.004 },
  ] },
  { key: 'timeline', name: 'ไทม์ไลน์', cat: 'อินโฟกราฟิก', items: (t) => [
    H(t, 0.5, 0.14, 0.86, 'เส้นทางโครงการ 2569', 0.065),
    { t: 'line', x: 0.5, y: 0.5, w: 0.84, stroke: t.pri, sw: 0.008 },
    ...[0, 1, 2, 3].flatMap((i) => [
      { t: 'circle', x: 0.14 + i * 0.24, y: 0.5, r: 0.03, fill: t.card, stroke: t.pri, sw: 0.008 },
      H(t, 0.14 + i * 0.24, i % 2 ? 0.66 : 0.34, 0.22, ['ม.ค.', 'เม.ย.', 'ก.ค.', 'ต.ค.'][i], 0.045, { color: t.pri }),
      T(t, 0.14 + i * 0.24, i % 2 ? 0.75 : 0.25, 0.22, ['วางแผน', 'เริ่มพัฒนา', 'ทดลองใช้', 'เปิดตัว'][i], 0.035, { color: t.muted }),
    ]),
  ] },
  { key: 'quote', name: 'คำคมการ์ด', cat: 'คำคม', items: (t) => [
    { t: 'rect', x: 0.5, y: 0.5, w: 0.84, h: 0.76, fill: t.card, rx: 0.04, shadow: true },
    T(t, 0.5, 0.28, 0.3, '❝', 0.16, { color: t.acc }),
    H(t, 0.5, 0.5, 0.7, 'การเรียนรู้ไม่มีวันสิ้นสุด\nทุกวันคือโอกาสใหม่', 0.06, { lh: 1.4 }),
    T(t, 0.5, 0.72, 0.6, '— ครูใจดี', 0.038, { color: t.muted }),
  ] },
  { key: 'checklist', name: 'รายการตรวจสอบ', cat: 'การศึกษา', items: (t) => [
    H(t, 0.5, 0.12, 0.86, 'เตรียมตัวก่อนสอบ ✅', 0.065, { color: t.pri }),
    ...['อ่านทบทวนบทเรียนทุกวัน', 'ทำแบบฝึกหัดท้ายบท', 'นอนหลับให้เพียงพอ', 'เตรียมเครื่องเขียนให้พร้อม', 'ไปถึงห้องสอบก่อนเวลา'].flatMap((x, i) => [
      { t: 'rect', x: 0.5, y: 0.28 + i * 0.13, w: 0.84, h: 0.1, fill: t.card, stroke: t.pri, sw: 0.002, rx: 0.02 },
      T(t, 0.13, 0.28 + i * 0.13, 0.75, `☐  ${x}`, 0.04, { align: 'left', ax: 'left' }),
    ]),
  ] },
  { key: 'compare', name: 'เปรียบเทียบ', cat: 'อินโฟกราฟิก', items: (t) => [
    H(t, 0.5, 0.11, 0.86, 'ก่อน VS หลัง ใช้แอปของเรา', 0.06),
    { t: 'rect', x: 0.27, y: 0.55, w: 0.42, h: 0.68, fill: t.card, stroke: t.muted, sw: 0.003, rx: 0.03 },
    { t: 'rect', x: 0.73, y: 0.55, w: 0.42, h: 0.68, fill: t.pri, rx: 0.03 },
    H(t, 0.27, 0.3, 0.38, 'ก่อน 😩', 0.055, { color: t.muted }),
    H(t, 0.73, 0.3, 0.38, 'หลัง 😄', 0.055, { color: '#ffffff' }),
    T(t, 0.27, 0.58, 0.36, 'ใช้เวลา 3 ชั่วโมง\nเอกสารกระจัดกระจาย\nผิดพลาดบ่อย', 0.036, { color: t.muted, lh: 1.8 }),
    T(t, 0.73, 0.58, 0.36, 'เสร็จใน 15 นาที\nทุกอย่างอยู่ที่เดียว\nแม่นยำ 100%', 0.036, { color: '#ffffff', lh: 1.8 }),
  ] },
  { key: 'tiles', name: 'ตาราง 4 ช่อง', cat: 'โซเชียล', items: (t) => [
    H(t, 0.5, 0.1, 0.86, '4 นิสัยดี ที่ควรทำทุกวัน', 0.06),
    ...[['📚', 'อ่านหนังสือ'], ['🏃', 'ออกกำลังกาย'], ['💧', 'ดื่มน้ำ 8 แก้ว'], ['😴', 'นอนให้พอ']].flatMap(([e, l], i) => {
      const x = i % 2 ? 0.72 : 0.28, y = i < 2 ? 0.38 : 0.74;
      return [
        { t: 'rect', x, y, w: 0.4, h: 0.32, fill: i % 3 === 0 ? t.pri : t.card, stroke: t.pri, sw: 0.003, rx: 0.03 },
        T(t, x, y - 0.05, 0.3, e, 0.1, { font: 'sans-serif' }),
        H(t, x, y + 0.09, 0.36, l, 0.045, { color: i % 3 === 0 ? '#ffffff' : t.text }),
      ];
    }),
  ] },
  { key: 'agenda', name: 'กำหนดการ', cat: 'กิจกรรม', items: (t) => [
    { t: 'rect', x: 0.5, y: 0.1, w: 1, h: 0.2, fill: t.pri },
    H(t, 0.5, 0.1, 0.86, 'กำหนดการงานกีฬาสี', 0.07, { color: '#ffffff' }),
    ...[['08:00', 'พิธีเปิดและเดินพาเหรด'], ['09:30', 'แข่งขันกรีฑา'], ['12:00', 'พักรับประทานอาหาร'], ['13:00', 'แข่งขันกีฬาประเภททีม'], ['16:00', 'มอบรางวัลและพิธีปิด']].flatMap(([tm, x], i) => [
      H(t, 0.17, 0.3 + i * 0.13, 0.22, tm, 0.045, { color: t.pri }),
      T(t, 0.62, 0.3 + i * 0.13, 0.62, x, 0.042, { align: 'left' }),
      { t: 'line', x: 0.5, y: 0.36 + i * 0.13, w: 0.84, stroke: t.muted, sw: 0.0015, opacity: 0.5 },
    ]),
  ] },
  { key: 'stats', name: 'สถิติ 3 กล่อง', cat: 'ธุรกิจ', items: (t) => [
    H(t, 0.5, 0.15, 0.86, 'ผลงานปีนี้', 0.07),
    ...[['1,250', 'ลูกค้าใหม่'], ['98%', 'ความพึงพอใจ'], ['24/7', 'บริการ']].flatMap(([n, l], i) => [
      { t: 'rect', x: 0.2 + i * 0.3, y: 0.52, w: 0.26, h: 0.36, fill: t.card, stroke: i === 1 ? t.acc : t.pri, sw: 0.005, rx: 0.03 },
      H(t, 0.2 + i * 0.3, 0.48, 0.24, n, 0.075, { color: i === 1 ? t.acc : t.pri }),
      T(t, 0.2 + i * 0.3, 0.6, 0.24, l, 0.035, { color: t.muted }),
    ]),
    T(t, 0.5, 0.84, 0.8, 'ขอบคุณทุกความไว้วางใจ', 0.04, { color: t.muted }),
  ] },
  { key: 'menu', name: 'รายการอาหาร', cat: 'ร้านอาหาร', items: (t) => [
    H(t, 0.5, 0.1, 0.8, 'เมนูแนะนำ', 0.08, { color: t.pri }),
    T(t, 0.5, 0.18, 0.8, 'อร่อยทุกจาน ปรุงสดใหม่', 0.035, { color: t.muted }),
    ...[['ข้าวผัดกระเพรา', '60'], ['ต้มยำกุ้ง', '120'], ['ผัดไทย', '70'], ['ส้มตำไทย', '50'], ['ข้าวเหนียวมะม่วง', '80']].flatMap(([n, p], i) => [
      T(t, 0.1, 0.32 + i * 0.12, 0.6, n, 0.045, { align: 'left', ax: 'left', bold: true }),
      T(t, 0.9, 0.32 + i * 0.12, 0.2, `${p}.-`, 0.045, { align: 'right', ax: 'right', color: t.pri, bold: true }),
      { t: 'line', x: 0.5, y: 0.37 + i * 0.12, w: 0.8, stroke: t.muted, sw: 0.0015, opacity: 0.4 },
    ]),
  ] },
  { key: 'ticket', name: 'บัตรเชิญ', cat: 'กิจกรรม', items: (t) => [
    { t: 'rect', x: 0.5, y: 0.5, w: 0.86, h: 0.6, fill: t.card, rx: 0.04, shadow: true },
    { t: 'rect', x: 0.24, y: 0.5, w: 0.3, h: 0.6, fill: t.pri, rx: 0.04 },
    H(t, 0.24, 0.42, 0.26, '25', 0.16, { color: '#ffffff' }),
    T(t, 0.24, 0.6, 0.26, 'ธันวาคม', 0.045, { color: '#ffffff' }),
    T(t, 0.64, 0.33, 0.46, 'ขอเชิญร่วมงาน', 0.035, { color: t.muted, align: 'left' }),
    H(t, 0.64, 0.45, 0.46, 'ปาร์ตี้ปีใหม่', 0.07, { align: 'left' }),
    T(t, 0.64, 0.6, 0.46, '18:00 น. · หอประชุม', 0.036, { align: 'left', color: t.pri }),
    T(t, 0.64, 0.7, 0.46, 'แต่งกายธีมสีขาว', 0.032, { align: 'left', color: t.muted }),
  ] },
];

export const GENERATED_TEMPLATES = ARCHETYPES.flatMap((a) => THEMES.map((t) => ({
  id: `${a.key}-${t.key}`,
  cat: a.cat,
  name: `${a.name} · ${t.name}`,
  bg: t.bg,
  items: a.items(t),
})));
