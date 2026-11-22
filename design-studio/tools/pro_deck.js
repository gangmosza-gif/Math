// Builds the "Pro" business presentation slides with the editor's own tools (text, shapes, gradients,
// shadows, charts, icons) — the same things a user can do by hand. Run inside the editor page:
//   await (await import('./tools/pro_deck.js')).buildProDeck(__lai)
// Design rules (professional business decks): one idea per slide, two type families
// (Kanit headings / Sarabun body, Montserrat for numbers), at most four colours with one accent that
// points at what matters, generous whitespace, heading → big number → explanation.

const SH = (blur, y, a = 0.18, color = '15,23,42') => ({ color: `rgba(${color},${a})`, blur, offsetX: 0, offsetY: y });

export async function buildProDeck(L, which = [0, 1, 2]) {
  const W = L.W, H = L.H;
  const at = (o, x, y) => { o.setPositionByOrigin({ x, y }, 'left', 'top'); o.setCoords(); return o; };
  const text = async (t, x, y, o = {}) => {
    const tb = await L.addText('none', { text: t, fontFamily: 'Sarabun', fontSize: 28, fill: '#0f172a', textAlign: 'left', width: 900, lineHeight: 1.25, ...o });
    if (o.shadow) tb.set('shadow', o.shadow);
    tb.initDimensions();
    return at(tb, x, y);
  };
  const rect = (x, y, w, h, o = {}) => {
    const r = L.addShape(0);
    r.set({ width: w, height: h, scaleX: 1, scaleY: 1, rx: o.rx || 0, ry: o.rx || 0, fill: o.fill || '#ffffff', stroke: o.stroke || null, strokeWidth: o.sw || 0, opacity: o.opacity ?? 1, name: o.name || 'กล่อง' });
    if (Array.isArray(o.fill)) { L.canvas.setActiveObject(r); L.setProp('fill', o.fill, { commit: false }); }
    if (o.shadow) r.set('shadow', o.shadow);
    return at(r, x, y);
  };
  const circle = (cx, cy, rad, o = {}) => {
    const c = L.addShape(2);
    c.set({ radius: rad, scaleX: 1, scaleY: 1, fill: o.fill || '#ffffff', stroke: o.stroke || null, strokeWidth: o.sw || 0, opacity: o.opacity ?? 1, name: 'วงกลม' });
    if (Array.isArray(o.fill)) { L.canvas.setActiveObject(c); L.setProp('fill', o.fill, { commit: false }); }
    c.setPositionByOrigin({ x: cx, y: cy }, 'center', 'center'); c.setCoords();
    return c;
  };
  const icon = async (name, x, y, size, color) => {
    await L.addSmart('icon-' + name);
    let o = L.canvas.getActiveObject();
    o = (await L.rebuildSmart(o, { ...o.smart, color, size, weight: 2 }, { silent: true })) || L.canvas.getActiveObject();
    const k = size / Math.max(o.width, o.height); // the rebuild keeps the old on-page size: set it exactly
    o.set({ scaleX: k, scaleY: k });
    o.setPositionByOrigin({ x, y }, 'center', 'center'); o.setCoords();
    return o;
  };
  const chart = async (type, x, y, w, h, data) => {
    await L.addSmart(type);
    let o = L.canvas.getActiveObject();
    o = (await L.rebuildSmart(o, { ...o.smart, width: w, height: h, ...data }, { silent: true })) || L.canvas.getActiveObject();
    o.set({ scaleX: 1, scaleY: 1 });
    return at(o, x, y);
  };
  const pages = [];

  // ---------------------------------------------------------------- 1. Executive financial summary
  if (which.includes(0)) {
    L.setBackground('#0b1426');
    const navy = '#0b1426', card = '#111c33', line = '#1e2a44', muted = '#94a3b8', blue = '#3b82f6', sky = '#60a5fa';
    circle(W - 60, 40, 380, { fill: ['#1d4ed8', navy], opacity: 0.28 });
    await text('Q3 2026  ·  FINANCIAL HIGHLIGHTS', 120, 96, { fontFamily: 'Montserrat', fontSize: 22, fontWeight: 'bold', fill: sky, charSpacing: 220 });
    await text('ผลประกอบการไตรมาส 3 เติบโตเกินเป้าหมาย', 120, 140, { fontFamily: 'Kanit', fontWeight: 'bold', fontSize: 66, fill: '#ffffff', width: 1300 });
    await text('รายได้เพิ่มขึ้น 18.2% จากปีก่อน ขับเคลื่อนโดยลูกค้าองค์กรและบริการแบบสมาชิกรายเดือน', 120, 240, { fontSize: 28, fill: muted, width: 1300 });
    const kpis = [
      ['รายได้รวม', '฿128.4M', '▲ 18.2%', true],
      ['อัตรากำไรขั้นต้น', '42.6%', '▲ 3.1 pt', true],
      ['EBITDA', '฿31.2M', '▲ 24.5%', true],
      ['กระแสเงินสดสุทธิ', '฿56.8M', '▼ 2.4%', false],
    ];
    const cw = 390, gap = 36;
    for (let i = 0; i < 4; i++) {
      const [label, value, delta, up] = kpis[i];
      const x = 120 + i * (cw + gap), y = 340;
      rect(x, y, cw, 210, { fill: card, rx: 22, stroke: line, sw: 1.5 });
      if (i === 0) rect(x, y, 6, 210, { fill: blue, rx: 3 });
      await text(label, x + 34, y + 30, { fontSize: 24, fill: muted, width: cw - 60 });
      await text(value, x + 34, y + 72, { fontFamily: 'Montserrat', fontWeight: 'bold', fontSize: 58, fill: '#ffffff', width: cw - 60 });
      const c = up ? '#22c55e' : '#f87171';
      rect(x + 34, y + 152, 132, 38, { fill: c, rx: 19, opacity: 0.16 });
      await text(delta, x + 34, y + 157, { fontFamily: 'Montserrat', fontWeight: 'bold', fontSize: 21, fill: c, width: 132, textAlign: 'center' });
    }
    // revenue trend: the latest quarter is the only bright bar
    rect(120, 600, 1100, 380, { fill: card, rx: 22, stroke: line, sw: 1.5 });
    await text('รายได้รายไตรมาส (ล้านบาท)', 160, 630, { fontFamily: 'Kanit', fontWeight: '600', fontSize: 26, fill: '#ffffff' });
    await chart('bar', 150, 680, 1040, 280, { title: '', labels: ["Q1'25", "Q2'25", "Q3'25", "Q4'25", "Q1'26", "Q2'26", "Q3'26"], values: [92, 98, 108.6, 112, 117, 121, 128.4], colors: ['#334155', '#334155', '#334155', '#334155', '#334155', '#475569', sky], color: '#cbd5e1', fontFamily: 'Montserrat', showValues: true });
    // takeaways
    rect(1256, 600, 544, 380, { fill: card, rx: 22, stroke: line, sw: 1.5 });
    await text('ประเด็นสำคัญ', 1296, 630, { fontFamily: 'Kanit', fontWeight: '600', fontSize: 26, fill: '#ffffff', width: 460 });
    const notes = ['ลูกค้าองค์กรใหม่ 46 ราย\nมูลค่าสัญญารวม ฿38M', 'ต้นทุนต่อหน่วยลดลง 7%\nจากระบบอัตโนมัติ', 'เงินสดลดลงจากการลงทุน\nศูนย์ข้อมูลแห่งใหม่'];
    for (let i = 0; i < 3; i++) {
      const y = 696 + i * 92;
      circle(1316, y + 18, 18, { fill: i === 2 ? '#7f1d1d' : '#1e3a8a' });
      await text(String(i + 1), 1298, y + 4, { fontFamily: 'Montserrat', fontWeight: 'bold', fontSize: 20, fill: i === 2 ? '#fca5a5' : '#bfdbfe', width: 36, textAlign: 'center' });
      await text(notes[i], 1352, y, { fontSize: 24, fill: '#e2e8f0', width: 410 });
    }
    await text('Lai Studio Co., Ltd.  ·  รายงานผู้บริหาร  ·  ข้อมูลเพื่อการตัดสินใจภายใน', 120, 1016, { fontSize: 18, fill: '#475569', width: 1200 });
    pages.push(L.cur);
  }

  // ---------------------------------------------------------------- 2. Product launch
  if (which.includes(1)) {
    if (pages.length) { L.commit(); await L.addPage(); } // keep the last move of the previous slide
    L.setBackground('#f7f7fb');
    const ink = '#0f172a', violet = '#6d28d9', soft = '#ede9fe', muted = '#64748b';
    // hero panel with the "app" built from shapes
    rect(1010, 70, 840, 940, { fill: ['#6d28d9', '#db2777'], rx: 44 });
    circle(1650, 230, 260, { fill: '#ffffff', opacity: 0.08 });
    circle(1130, 900, 200, { fill: '#ffffff', opacity: 0.07 });
    rect(1250, 150, 380, 780, { fill: '#0b1020', rx: 56, shadow: SH(60, 30, 0.35) });
    rect(1266, 166, 348, 748, { fill: ['#1e1b4b', '#312e81'], rx: 44 });
    rect(1400, 184, 80, 22, { fill: '#0b1020', rx: 11 });
    await text('ยอดเงินคงเหลือ', 1296, 240, { fontSize: 20, fill: '#c7d2fe', width: 290 });
    await text('฿24,580.00', 1296, 268, { fontFamily: 'Montserrat', fontWeight: 'bold', fontSize: 44, fill: '#ffffff', width: 300 });
    const btns = [['โอน', 'send'], ['สแกน', 'camera'], ['เติม', 'plus']];
    for (let i = 0; i < 3; i++) {
      rect(1296 + i * 100, 350, 84, 84, { fill: '#ffffff', rx: 22, opacity: 0.12 });
      await icon(btns[i][1] === 'send' ? 'mail' : btns[i][1], 1338 + i * 100, 382, 34, '#ffffff');
      await text(btns[i][0], 1296 + i * 100, 404, { fontSize: 17, fill: '#e0e7ff', width: 84, textAlign: 'center' });
    }
    await text('รายการล่าสุด', 1296, 470, { fontFamily: 'Kanit', fontWeight: '600', fontSize: 22, fill: '#ffffff', width: 290 });
    const tx = [['ร้านกาแฟ', '-฿85'], ['เงินเดือน', '+฿32,000'], ['ค่าไฟ', '-฿1,240']];
    for (let i = 0; i < 3; i++) {
      const y = 512 + i * 92;
      rect(1290, y, 300, 78, { fill: '#ffffff', rx: 18, opacity: 0.1 });
      circle(1326, y + 39, 20, { fill: i === 1 ? '#34d399' : '#a78bfa' });
      await text(tx[i][0], 1358, y + 24, { fontSize: 20, fill: '#ffffff', width: 130 });
      await text(tx[i][1], 1470, y + 24, { fontFamily: 'Montserrat', fontWeight: 'bold', fontSize: 19, fill: i === 1 ? '#6ee7b7' : '#ffffff', width: 106, textAlign: 'right' });
    }
    // monthly budget bar at the bottom of the screen
    await text('ใช้จ่ายเดือนนี้', 1296, 800, { fontSize: 19, fill: '#c7d2fe', width: 160 });
    await text('฿8,240 / ฿12,000', 1426, 800, { fontFamily: 'Montserrat', fontWeight: 'bold', fontSize: 17, fill: '#ffffff', width: 160, textAlign: 'right' });
    rect(1296, 838, 290, 12, { fill: '#ffffff', rx: 6, opacity: 0.15 });
    rect(1296, 838, 200, 12, { fill: ['#a78bfa', '#f472b6'], rx: 6 });
    // floating rating chip
    rect(1060, 860, 250, 120, { fill: '#ffffff', rx: 24, shadow: SH(40, 18, 0.22) });
    await text('4.9', 1090, 878, { fontFamily: 'Montserrat', fontWeight: 'bold', fontSize: 46, fill: ink, width: 90 });
    await icon('star', 1210, 908, 34, '#f59e0b');
    await text('รีวิว 12,400+', 1090, 936, { fontSize: 20, fill: muted, width: 200 });
    // copy
    rect(120, 150, 248, 46, { fill: soft, rx: 23 });
    await text('NEW  ·  เปิดตัวสินค้าใหม่', 120, 159, { fontFamily: 'Kanit', fontWeight: '600', fontSize: 20, fill: violet, width: 248, textAlign: 'center' });
    await text('Lumi Pay', 116, 220, { fontFamily: 'Montserrat', fontWeight: 'bold', fontSize: 120, fill: ink, width: 840 });
    await text('จ่ายง่าย ปลอดภัย ในแตะเดียว', 120, 370, { fontFamily: 'Kanit', fontWeight: '600', fontSize: 46, fill: violet, width: 840 });
    await text('แอปการเงินสำหรับครอบครัวและร้านค้ารายย่อย\nโอน รับ และติดตามรายจ่ายได้ในที่เดียว', 120, 446, { fontSize: 27, fill: muted, width: 780 });
    const feats = [['clock', 'โอนเงินภายใน 1 วินาที', 'ทุกธนาคาร ตลอด 24 ชั่วโมง'], ['check', 'ปลอดภัยสองชั้น', 'ยืนยันด้วยใบหน้าและรหัสส่วนตัว'], ['users', 'บัญชีครอบครัว', 'แบ่งงบประมาณให้สมาชิกได้ 5 คน']];
    for (let i = 0; i < 3; i++) {
      const y = 570 + i * 112;
      rect(120, y, 76, 76, { fill: soft, rx: 20 });
      await icon(feats[i][0], 158, y + 38, 36, violet);
      await text(feats[i][1], 222, y + 2, { fontFamily: 'Kanit', fontWeight: '600', fontSize: 28, fill: ink, width: 640 });
      await text(feats[i][2], 222, y + 42, { fontSize: 23, fill: muted, width: 640 });
    }
    rect(120, 920, 330, 82, { fill: ink, rx: 41, shadow: SH(30, 14, 0.25) });
    await text('เริ่มใช้ฟรี 30 วัน', 120, 942, { fontFamily: 'Kanit', fontWeight: '600', fontSize: 28, fill: '#ffffff', width: 330, textAlign: 'center' });
    await text('ไม่มีค่าธรรมเนียม\nในปีแรก', 482, 928, { fontSize: 22, fill: muted, width: 300, lineHeight: 1.2 });
    pages.push(L.cur);
  }

  // ---------------------------------------------------------------- 3. Marketing campaign results
  if (which.includes(2)) {
    if (pages.length) { L.commit(); await L.addPage(); } // keep the last move of the previous slide
    L.setBackground('#fffaf5');
    const ink = '#1c1917', coral = '#f97316', muted = '#78716c', line = '#e7e5e4';
    rect(0, 0, 20, H, { fill: coral });
    await text('CAMPAIGN PERFORMANCE  ·  Q3 2026', 120, 96, { fontFamily: 'Montserrat', fontWeight: 'bold', fontSize: 22, fill: coral, charSpacing: 220, width: 900 });
    await text('แคมเปญ “Summer Glow” เข้าถึงลูกค้าได้มากที่สุดของปี', 120, 140, { fontFamily: 'Kanit', fontWeight: 'bold', fontSize: 62, fill: ink, width: 1500 });
    // hero number
    const hero = await text('2.4M', 112, 270, { fontFamily: 'Montserrat', fontWeight: 'bold', fontSize: 210, fill: coral, width: 760 });
    L.canvas.setActiveObject(hero); L.setProp('fill', ['#f97316', '#db2777'], { commit: false });
    await text('ยอดการเข้าถึง (Reach)', 124, 520, { fontFamily: 'Kanit', fontWeight: '600', fontSize: 32, fill: ink, width: 700 });
    rect(124, 572, 300, 44, { fill: '#16a34a', rx: 22, opacity: 0.12 });
    await text('▲ 64% จากแคมเปญก่อน', 124, 580, { fontFamily: 'Kanit', fontWeight: '600', fontSize: 22, fill: '#15803d', width: 300, textAlign: 'center' });
    const stats = [['3.8%', 'อัตราการคลิก (CTR)'], ['18,420', 'คำสั่งซื้อ'], ['4.6×', 'ผลตอบแทนค่าโฆษณา']];
    for (let i = 0; i < 3; i++) {
      const x = 124 + i * 270;
      if (i) rect(x - 30, 676, 2, 110, { fill: line });
      await text(stats[i][0], x, 676, { fontFamily: 'Montserrat', fontWeight: 'bold', fontSize: 52, fill: ink, width: 240 });
      await text(stats[i][1], x, 744, { fontSize: 22, fill: muted, width: 240 });
    }
    // channel mix
    rect(1000, 270, 800, 520, { fill: '#ffffff', rx: 26, stroke: '#f5f5f4', sw: 1.5, shadow: SH(40, 12, 0.08) });
    await text('สัดส่วนยอดเข้าถึงตามช่องทาง', 1044, 304, { fontFamily: 'Kanit', fontWeight: '600', fontSize: 28, fill: ink, width: 700 });
    await chart('donut', 1030, 360, 740, 400, { title: '', labels: ['TikTok', 'Facebook', 'Instagram', 'LINE OA'], values: [38, 27, 21, 14], colors: ['#f97316', '#fb923c', '#fdba74', '#fed7aa'], color: ink, fontFamily: 'Sarabun', showValues: true });
    // timeline
    const steps = [['1–7 ก.ค.', 'ทีเซอร์'], ['8 ก.ค.', 'เปิดตัว'], ['15–31 ก.ค.', 'อินฟลูเอนเซอร์'], ['ส.ค.', 'รีทาร์เก็ตติ้ง']];
    rect(160, 900, 1600, 4, { fill: line, rx: 2 });
    for (let i = 0; i < 4; i++) {
      const x = 160 + i * (1600 / 3);
      circle(x, 902, i === 3 ? 14 : 16, { fill: i === 3 ? '#ffffff' : coral, stroke: coral, sw: 4 });
      const tx = Math.min(Math.max(x - 150, 120), 1500);
      await text(steps[i][1], tx, 842, { fontFamily: 'Kanit', fontWeight: '600', fontSize: 26, fill: ink, width: 300, textAlign: i === 0 ? 'left' : i === 3 ? 'right' : 'center' });
      await text(steps[i][0], tx, 928, { fontSize: 21, fill: muted, width: 300, textAlign: i === 0 ? 'left' : i === 3 ? 'right' : 'center' });
    }
    pages.push(L.cur);
  }
  L.canvas.discardActiveObject();
  L.canvas.requestRenderAll();
  L.commit();
  return pages;
}
