// Theme template sets built with the editor's own tools (text, shapes, gradients, photo frames, the
// Elements library incl. our own decorations and pixel icons). Run inside the editor page (16:9):
//   await (await import('/tools/theme_decks.js')).buildThemeDecks(__lai, ['proposal', 'mindmap', 'retro', 'company'])
// Original layouts, studied from the styles of popular Thai presentation templates:
//   proposal – corporate blue, diagonal bands, fading label ribbons, numbered timeline
//   mindmap  – cute hand-written notes on grid paper, brush highlight, hand-drawn arrows, animal stickers
//   retro    – cartoon people, retro pixel icons, folder cards, outlined rounded headings
//   company  – airy light blue, big arcs, halftone dots, circle photo, numbered cards
import { loadGraphics, makeElement, recolorGraphic } from '/src/elements.js';

const SH = (blur, y, a = 0.16, color = '15,23,42') => ({ color: `rgba(${color},${a})`, blur, offsetX: 0, offsetY: y });

export async function buildThemeDecks(L, which = ['proposal', 'mindmap', 'retro', 'company']) {
  const gfxData = await loadGraphics();
  const at = (o, x, y) => { o.setPositionByOrigin({ x, y }, 'left', 'top'); o.setCoords(); return o; };
  const atC = (o, x, y) => { o.setPositionByOrigin({ x, y }, 'center', 'center'); o.setCoords(); return o; };
  const text = async (t, x, y, o = {}) => {
    const tb = await L.addText('none', { text: t, fontFamily: 'Sarabun', fontSize: 28, fill: '#0f172a', textAlign: 'left', width: 600, lineHeight: 1.25, ...o });
    if (o.shadow) tb.set('shadow', o.shadow);
    tb.initDimensions();
    return o.center ? atC(tb, x, y) : at(tb, x, y);
  };
  const grad = (o, a, b, dir = 'h') => {
    L.canvas.setActiveObject(o);
    L.setProp('fill', [a, b], { commit: false });
    if (o.fill && o.fill.coords) o.fill.coords = dir === 'h' ? { x1: 0, y1: 0, x2: 1, y2: 0 } : dir === 'v' ? { x1: 0, y1: 0, x2: 0, y2: 1 } : { x1: 0, y1: 0, x2: 1, y2: 1 };
    o.set('dirty', true);
  };
  const rect = (x, y, w, h, o = {}) => {
    const r = L.addShape(0);
    r.set({ width: w, height: h, scaleX: 1, scaleY: 1, rx: o.rx || 0, ry: o.rx || 0, fill: o.fill || '#ffffff', stroke: o.stroke || null, strokeWidth: o.sw || 0, strokeDashArray: o.dash || null, opacity: o.opacity ?? 1, angle: 0, name: o.name || 'กล่อง' });
    if (Array.isArray(o.fill)) grad(r, o.fill[0], o.fill[1], o.dir);
    if (o.shadow) r.set('shadow', o.shadow);
    at(r, x, y);
    if (o.angle) { r.rotate(o.angle); r.setCoords(); }
    return r;
  };
  const circle = (cx, cy, rad, o = {}) => {
    const c = L.addShape(2);
    c.set({ radius: rad, scaleX: 1, scaleY: 1, fill: o.fill || '#ffffff', stroke: o.stroke || null, strokeWidth: o.sw || 0, opacity: o.opacity ?? 1, name: 'วงกลม' });
    if (Array.isArray(o.fill)) grad(c, o.fill[0], o.fill[1], o.dir || 'd');
    if (o.shadow) c.set('shadow', o.shadow);
    return atC(c, cx, cy);
  };
  const line = (x1, y1, x2, y2, color, w, dash) => {
    const r = rect(Math.min(x1, x2), Math.min(y1, y2) - w / 2, Math.max(Math.abs(x2 - x1), w), Math.max(Math.abs(y2 - y1), w), { fill: color, rx: w / 2 });
    if (dash) r.set({ fill: 'transparent', stroke: color, strokeWidth: w, strokeDashArray: dash, height: 0.01 });
    return r;
  };
  const icon = async (name, cx, cy, size, color, weight = 2) => {
    await L.addSmart('icon-' + name);
    let o = L.canvas.getActiveObject();
    o = (await L.rebuildSmart(o, { ...o.smart, color, size, weight }, { silent: true })) || L.canvas.getActiveObject();
    const k = size / Math.max(o.width, o.height);
    o.set({ scaleX: k, scaleY: k });
    return atC(o, cx, cy);
  };
  /** An Elements-library graphic: id 'collection|name'; w (and h to stretch); color for single-colour ones. */
  const gfx = async (id, x, y, w, o = {}) => {
    const [c, n] = id.split('|');
    const g = await makeElement(gfxData, `g|${c}|${n}`, 400);
    if (!g) throw new Error('graphic not found: ' + id);
    if (o.color) recolorGraphic(g, o.color);
    const bw = g.width, bh = g.height;
    g.set({ scaleX: w / bw, scaleY: (o.h ? o.h : (w * bh) / bw) / bh, opacity: o.opacity ?? 1, flipX: !!o.flipX, flipY: !!o.flipY });
    L.addObject(g);
    if (o.center) atC(g, x, y); else at(g, x, y);
    if (o.angle) { g.rotate(o.angle); g.setCoords(); }
    return g;
  };
  /** A replaceable photo frame (drag another picture onto it to swap): photo id from the library, or an empty frame. */
  const photo = async (pid, x, y, w, h, mask = 'none', o = {}) => {
    const img = await L.addImage(`photos/${pid}.webp`, 'กรอบรูป');
    if (!img) throw new Error('photo ' + pid);
    L.coverCrop(img, w, h);
    img.frame = true;
    L.applyMask(img, mask);
    if (o.shadow) img.set('shadow', o.shadow);
    return at(img, x, y);
  };
  const newSlide = async (bg) => {
    if (pages.length) { L.commit(); await L.addPage(); }
    pages.push(L.cur);
    L.setBackground(bg);
  };
  const pages = [];

  // ================================================================ A. project proposal (corporate blue)
  if (which.includes('proposal')) {
    const navy = '#0a2463', blue = '#1e5eff', sky = '#8fb3ff', pale = '#eef3ff', gray = '#5b6478';
    const label = async (t, x, y, w = 520, center = false) => {
      rect(x, y, w, 64, { fill: center ? ['rgba(30,94,255,0)', blue] : [blue, 'rgba(30,94,255,0)'] });
      if (center) { const r = rect(x + w, y, w, 64, { fill: [blue, 'rgba(30,94,255,0)'] }); r.set('name', 'แถบป้าย'); }
      await text(t, center ? x + w : x + 36, center ? y + 32 : y + 13, { fontFamily: 'Montserrat', fontWeight: 'bold', fontSize: 30, fill: '#ffffff', charSpacing: 120, width: w, ...(center ? { center: true, textAlign: 'center' } : {}) });
    };
    const corner = async () => {
      await gfx('decor|corner-triangle', 1920 - 300, 0, 300, { color: blue });
      await gfx('decor|corner-triangle', 1920 - 170, 0, 170, { color: navy });
      await gfx('decor|halftone-corner', 1920 - 360, 1080 - 360, 360, { color: sky, opacity: 0.5, flipX: true });
    };

    // A1 cover
    await newSlide('#ffffff');
    await photo('bf2c4403ff', 860, 0, 1060, 1080);
    await gfx('decor|corner-triangle', 858, -2, 520, { h: 1084, color: '#ffffff' });
    await gfx('decor|chevron-band', 760, 760, 300, { color: blue });
    await gfx('decor|chevron-band', 900, 820, 220, { color: sky, opacity: 0.9 });
    await gfx('decor|corner-triangle', 0, 1080 - 260, 260, { color: navy, flipY: true });
    await gfx('decor|halftone-corner', 0, 0, 380, { color: sky, opacity: 0.45, flipY: true });
    circle(152, 130, 32, { fill: blue });
    await icon('chart', 152, 130, 34, '#ffffff', 2.4);
    await text('LAI CORP', 200, 112, { fontFamily: 'Montserrat', fontWeight: 'bold', fontSize: 32, fill: navy, charSpacing: 80, width: 300 });
    await text('PROJECT PROPOSAL 2026', 120, 260, { fontFamily: 'Montserrat', fontWeight: 'bold', fontSize: 28, fill: blue, charSpacing: 260, width: 700 });
    await text('ข้อเสนอโครงการ', 116, 310, { fontFamily: 'Kanit', fontWeight: 'bold', fontSize: 118, fill: navy, width: 860, lineHeight: 1.05 });
    await text('เมืองอัจฉริยะ', 116, 450, { fontFamily: 'Kanit', fontWeight: 'bold', fontSize: 118, fill: blue, width: 860, lineHeight: 1.05 });
    await text('ระบบจัดการพลังงานและการจราจรสำหรับเทศบาลขนาดกลาง', 120, 610, { fontSize: 32, fill: gray, width: 840 });
    rect(0, 740, 760, 150, { fill: [blue, 'rgba(30,94,255,0)'] });
    rect(120, 772, 6, 86, { fill: '#ffffff', rx: 3 });
    await text('ผู้นำเสนอ', 148, 768, { fontSize: 26, fill: '#dbe6ff', width: 500 });
    await text('กานต์ธิดา ศรีสุข  ·  ผู้จัดการโครงการ', 148, 808, { fontFamily: 'Kanit', fontWeight: '600', fontSize: 36, fill: '#ffffff', width: 620 });

    // A2 objectives
    await newSlide('#f5f8ff');
    await corner();
    await text('วัตถุประสงค์ของโครงการ', 120, 96, { fontFamily: 'Kanit', fontWeight: 'bold', fontSize: 76, fill: navy, width: 1300 });
    await label('OBJECTIVES', 0, 214, 620);
    const objs = [
      ['chart', 'ลดค่าไฟฟ้าสาธารณะ', 'ติดตั้งไฟถนนอัจฉริยะที่ปรับความสว่างตามการใช้งาน ลดค่าไฟลง 30% ภายใน 2 ปี'],
      ['target', 'แก้ปัญหารถติด', 'สัญญาณไฟจราจรที่ปรับรอบตามปริมาณรถจริง ลดเวลาเดินทางช่วงเร่งด่วน 20%'],
      ['users', 'บริการประชาชน', 'แจ้งปัญหาและติดตามสถานะผ่าน LINE OA ได้ตลอด 24 ชั่วโมง'],
    ];
    for (let i = 0; i < 3; i++) {
      const x = 120 + i * 580, y = 400;
      rect(x, y, 520, 500, { fill: '#ffffff', rx: 28, shadow: SH(40, 16, 0.1) });
      rect(x + 48, y + 440, 120, 8, { fill: i === 1 ? blue : '#c9d8ff', rx: 4 });
      circle(x + 110, y + 120, 66, { fill: pale });
      await icon(objs[i][0], x + 110, y + 120, 64, blue, 2.2);
      await text('0' + (i + 1), x + 400, y + 72, { fontFamily: 'Montserrat', fontWeight: 'bold', fontSize: 64, fill: '#dbe6ff', width: 100, textAlign: 'right' });
      await text(objs[i][1], x + 48, y + 228, { fontFamily: 'Kanit', fontWeight: '600', fontSize: 40, fill: navy, width: 430 });
      await text(objs[i][2], x + 48, y + 296, { fontSize: 29, fill: gray, width: 430, lineHeight: 1.45 });
    }

    // A3 timeline
    await newSlide('#ffffff');
    await gfx('decor|corner-triangle', 0, 0, 240, { color: blue });
    await gfx('decor|corner-triangle', 0, 0, 130, { color: navy });
    await gfx('decor|halftone-fade', 0, 1080 - 150, 1920, { h: 150, color: sky, opacity: 0.35 });
    await text('แผนงานและระยะเวลา', 960, 150, { fontFamily: 'Kanit', fontWeight: 'bold', fontSize: 76, fill: navy, width: 1200, textAlign: 'center', center: true });
    await label('TIMELINE', 360, 226, 600, true);
    line(170, 640, 1750, 640, '#c9d8ff', 8);
    const phases = [['สำรวจและออกแบบ', 'ม.ค. – มี.ค. 2026', 'ลงพื้นที่ เก็บข้อมูล\nออกแบบระบบ'], ['ติดตั้งระยะแรก', 'เม.ย. – ก.ค. 2026', 'ไฟถนน 1,200 จุด\nย่านใจกลางเมือง'], ['เชื่อมต่อระบบ', 'ส.ค. – ต.ค. 2026', 'ศูนย์ควบคุมกลาง\nและแอปประชาชน'], ['ประเมินและขยายผล', 'พ.ย. – ธ.ค. 2026', 'วัดผลการประหยัด\nวางแผนเฟส 2']];
    for (let i = 0; i < 4; i++) {
      const cx = 330 + i * 420;
      circle(cx, 480, 92, { fill: '#ffffff', stroke: i === 3 ? navy : blue, sw: 10, shadow: SH(30, 12, 0.12) });
      await text('0' + (i + 1), cx, 480, { fontFamily: 'Montserrat', fontWeight: 'bold', fontSize: 66, fill: i === 3 ? navy : blue, width: 160, textAlign: 'center', center: true });
      rect(cx - 4, 572, 8, 60, { fill: i === 3 ? navy : blue });
      circle(cx, 640, 16, { fill: i === 3 ? navy : blue, stroke: '#ffffff', sw: 6 });
      await text(phases[i][0], cx, 712, { fontFamily: 'Kanit', fontWeight: '600', fontSize: 36, fill: navy, width: 380, textAlign: 'center', center: true });
      await text(phases[i][1], cx, 762, { fontSize: 26, fill: blue, width: 380, textAlign: 'center', center: true, fontWeight: 'bold' });
      await text(phases[i][2], cx, 838, { fontSize: 26, fill: gray, width: 380, textAlign: 'center', center: true, lineHeight: 1.4 });
    }

    // A4 contact
    await newSlide([navy, blue]);
    await gfx('decor|ring-quarter', 0, 1080 - 520, 520, { color: '#ffffff', opacity: 0.08, flipY: true });
    await gfx('decor|ring-quarter', 1920 - 420, 0, 420, { color: '#ffffff', opacity: 0.08, flipX: true });
    await gfx('decor|halftone-corner', 1920 - 420, 1080 - 420, 420, { color: sky, opacity: 0.35, flipX: true });
    await gfx('decor|chevron-band', 120, 120, 120, { color: sky, opacity: 0.6 });
    await text('ขอบคุณครับ/ค่ะ', 120, 300, { fontFamily: 'Kanit', fontWeight: 'bold', fontSize: 120, fill: '#ffffff', width: 1000 });
    await text('พร้อมรับฟังคำถามและข้อเสนอแนะ', 124, 460, { fontSize: 38, fill: '#cfe0ff', width: 900 });
    const rows = [['phone', '02-123-4567'], ['mail', 'contact@laicorp.co.th'], ['globe', 'www.laicorp.co.th']];
    for (let i = 0; i < 3; i++) {
      circle(150, 610 + i * 96, 32, { fill: 'rgba(255,255,255,0.14)' });
      await icon(rows[i][0], 150, 610 + i * 96, 30, '#ffffff', 2.2);
      await text(rows[i][1], 206, 590 + i * 96, { fontFamily: 'Montserrat', fontSize: 32, fill: '#ffffff', width: 700 });
    }
    rect(1290, 300, 440, 500, { fill: '#ffffff', rx: 32, shadow: SH(50, 20, 0.3, '2,8,40') });
    await L.addSmart('qr');
    {
      let q = L.canvas.getActiveObject();
      q = (await L.rebuildSmart(q, { ...q.smart, text: 'https://www.laicorp.co.th', fg: navy }, { silent: true })) || L.canvas.getActiveObject();
      const k = 320 / Math.max(q.width, q.height); q.set({ scaleX: k, scaleY: k });
      atC(q, 1510, 520);
    }
    await text('สแกนเพื่อดาวน์โหลดเอกสาร', 1510, 730, { fontSize: 26, fill: navy, width: 400, textAlign: 'center', center: true, fontWeight: 'bold' });
  }

  // ================================================================ B. mind map (cute, grid paper)
  if (which.includes('mindmap')) {
    const ink = '#2b3a67', soft = '#5c6784';
    const hand = { fontFamily: 'Itim' };
    // B1 mind map
    await newSlide('#fdfcf8');
    await gfx('decor|grid-paper-wide', 0, 0, 1920, { h: 1080, color: '#dde6f3' });
    await gfx('decor|brush-stroke', 640, 548, 640, { h: 96, color: '#ffe58a' });
    await text('Mind Map', 960, 420, { ...hand, fontSize: 110, fill: ink, width: 800, textAlign: 'center', center: true });
    await text('ขั้นตอนทำโครงงาน', 960, 590, { ...hand, fontSize: 78, fill: ink, width: 900, textAlign: 'center', center: true });
    await gfx('decor|wavy-line', 700, 668, 520, { color: '#f28bb0' });
    const nodes = [
      [330, 120, '1. ตั้งเป้าหมาย', 'กำหนดคำถามและสิ่งที่\nอยากรู้ให้ชัดเจน', '#cfe3ff', 'animals|rabbit-face'],
      [1590, 120, '2. ค้นหาข้อมูล', 'หนังสือ เว็บไซต์ และ\nสัมภาษณ์ผู้รู้', '#d8f5dc', 'animals|frog'],
      [1620, 470, '3. วิเคราะห์', 'จัดกลุ่มข้อมูล หาความ\nเชื่อมโยงและข้อสรุป', '#ffe0ec', 'animals|owl'],
      [1590, 810, '4. ลงมือทำ', 'แบ่งหน้าที่ในทีม\nทำตามแผนที่วางไว้', '#fff1c2', 'animals|turtle'],
      [330, 810, '5. ประเมินผล', 'ตรวจผลลัพธ์เทียบกับ\nเป้าหมายที่ตั้งไว้', '#e7dcff', 'animals|baby-chick'],
      [300, 470, '6. สรุปและนำเสนอ', 'เล่าสิ่งที่ค้นพบให้\nเพื่อน ๆ ฟัง', '#d4f3f5', 'animals|panda'],
    ];
    for (const [cx, y, h, t, c] of nodes) {
      await gfx('decor|washi-tape', cx - 170, y - 8, 340, { h: 62, color: c });
      await text(h, cx, y + 23, { ...hand, fontSize: 42, fill: ink, width: 420, textAlign: 'center', center: true });
      await text(t, cx, y + 124, { ...hand, fontSize: 33, fill: soft, width: 440, textAlign: 'center', center: true, lineHeight: 1.3 });
    }
    await gfx('animals|rabbit-face', 60, 70, 110, { angle: -10 });
    await gfx('animals|frog', 1790, 220, 100, { angle: 8 });
    await gfx('animals|owl', 1800, 600, 96);
    await gfx('animals|turtle', 1760, 960, 110);
    await gfx('animals|baby-chick', 70, 950, 100, { angle: -6 });
    await gfx('animals|panda', 60, 380, 96);
    await gfx('decor|curvy-arrow', 640, 270, 230, { color: ink, angle: 200, center: true });
    await gfx('decor|curvy-arrow', 1280, 270, 230, { color: ink, flipX: true, angle: -20, center: true });
    await gfx('decor|swirl-arrow', 1360, 520, 200, { color: ink, center: true });
    await gfx('decor|curvy-arrow', 1290, 790, 220, { color: ink, angle: 30, center: true });
    await gfx('decor|curvy-arrow', 630, 790, 220, { color: ink, flipX: true, angle: -30, center: true });
    await gfx('decor|swirl-arrow', 560, 520, 200, { color: ink, flipX: true, center: true });
    await gfx('decor|sparkles', 1200, 360, 90, { color: '#f7c948' });
    await gfx('decor|sparkles', 640, 640, 70, { color: '#9bc4ff' });

    // B2 what we learned (sticky notes)
    await newSlide('#fdfcf8');
    await gfx('decor|grid-paper-wide', 0, 0, 1920, { h: 1080, color: '#dde6f3' });
    await gfx('decor|brush-stroke-2', 560, 150, 800, { h: 92, color: '#cfe3ff' });
    await text('สิ่งที่ได้เรียนรู้วันนี้', 960, 190, { ...hand, fontSize: 84, fill: ink, width: 1100, textAlign: 'center', center: true });
    const notes = [['#fff1a8', -3, 'ทำงานเป็นทีม', 'ฟังความเห็นของเพื่อน\nแบ่งงานตามความถนัด\nช่วยกันแก้ปัญหา'], ['#ffd6e5', 2, 'วางแผนก่อนลงมือ', 'เขียนขั้นตอนให้ชัด\nกำหนดเวลาแต่ละช่วง\nเช็กความคืบหน้าทุกวัน'], ['#d4ecff', -2, 'สรุปให้เข้าใจง่าย', 'ใช้ภาพและแผนผัง\nเล่าเป็นเรื่องราว\nยกตัวอย่างใกล้ตัว']];
    for (let i = 0; i < 3; i++) {
      const x = 170 + i * 560, y = 350;
      const n = rect(x, y, 460, 500, { fill: notes[i][0], rx: 8, shadow: SH(24, 14, 0.14, '60,50,20') });
      n.rotate(notes[i][1]); n.setCoords();
      await gfx('decor|washi-tape', x + 130, y - 30, 200, { h: 50, color: i === 1 ? '#9bc4ff' : '#f6a6c1', opacity: 0.85, angle: notes[i][1] });
      await text(notes[i][2], x + 230, y + 110, { ...hand, fontSize: 46, fill: ink, width: 400, textAlign: 'center', center: true, angle: notes[i][1] });
      await text(notes[i][3], x + 230, y + 290, { ...hand, fontSize: 34, fill: soft, width: 400, textAlign: 'center', center: true, lineHeight: 1.55, angle: notes[i][1] });
    }
    await gfx('3d|light-bulb', 1700, 120, 130, { angle: 12 });
    await gfx('animals|hatching-chick', 90, 880, 130);
    await gfx('3d|sparkles', 1730, 880, 110);
    await gfx('decor|loop-arrow', 230, 120, 260, { color: ink, angle: 10 });
  }

  // ================================================================ C. retro cartoon briefing
  if (which.includes('retro')) {
    const paper = '#efeee9', ink = '#1f2a5a', tan = '#d8bd8a', rose = '#c4918c', taupe = '#857565', blue = '#4a6fd6';
    const outlined = { fontFamily: 'Mali', fontWeight: 'bold', fill: '#ffffff', stroke: ink, paintFirst: 'stroke', strokeLineJoin: 'round' };
    const people = async (list) => { for (const [n, x, y, s, f] of list) await gfx('people|' + n, x, y, s, { flipX: !!f }); };

    // C1 cover
    await newSlide(paper);
    await gfx('decor|dot-grid', 0, 0, 1920, { h: 1080, color: '#d9d7cf' });
    await gfx('decor|folder', 430, 150, 1060, { color: tan });
    await text('หัวข้อ', 960, 470, { ...outlined, fontSize: 190, strokeWidth: 18, width: 900, textAlign: 'center', center: true });
    await text('การบรรยาย', 960, 690, { ...outlined, fontSize: 150, strokeWidth: 16, width: 1000, textAlign: 'center', center: true });
    await gfx('pixel|pixel-info', 560, 210, 150);
    await gfx('pixel|pixel-folder', 1180, 190, 170);
    await gfx('pixel|pixel-hand', 330, 430, 150, { angle: -15 });
    await gfx('pixel|pixel-cursor', 1420, 380, 120);
    await gfx('pixel|pixel-computer', 880, 900, 160);
    await people([['woman-technologist', 30, 640, 400], ['man-tipping-hand', 1520, 620, 400, true], ['woman-raising-hand', 40, 40, 300], ['man-office-worker', 1610, 40, 280]]);

    // C2 agenda
    await newSlide(paper);
    await gfx('decor|dot-grid', 0, 0, 1920, { h: 1080, color: '#d9d7cf' });
    await gfx('decor|speech-round', 560, 70, 800, { h: 260, color: taupe });
    await text('หัวข้อนำเสนอ', 960, 190, { ...outlined, fontSize: 104, strokeWidth: 12, width: 800, textAlign: 'center', center: true });
    await gfx('pixel|pixel-info', 420, 90, 140, { angle: -8 });
    await gfx('pixel|pixel-hand', 1400, 150, 150, { angle: 12, flipX: true });
    const items = [['เรื่องเบื้องต้น', rose, 'pixel|pixel-printer'], ['กระบวนการทำงาน', tan, 'pixel|pixel-window'], ['สรุปสาระสำคัญ', '#c9c9c4', 'pixel|pixel-cd']];
    for (let i = 0; i < 3; i++) {
      const y = 420 + i * 190, x = 600 + (i % 2) * 110;
      rect(x, y, 700, 130, { fill: items[i][1], rx: 65, shadow: SH(0, 8, 0.12) });
      await text(items[i][0], x + 350, y + 65, { ...outlined, fontSize: 70, strokeWidth: 9, width: 680, textAlign: 'center', center: true });
      await gfx(items[i][2], i % 2 ? x - 170 : x + 740, y - 5, 140);
    }
    await people([['woman-tipping-hand', 30, 580, 420], ['man-raising-hand', 1480, 580, 420, true]]);

    // C3 content in folders
    await newSlide(paper);
    await gfx('decor|dot-grid', 0, 0, 1920, { h: 1080, color: '#d9d7cf' });
    rect(120, 90, 640, 120, { fill: rose, rx: 60 });
    await text('กระบวนการทำงาน', 440, 150, { ...outlined, fontSize: 66, strokeWidth: 9, width: 620, textAlign: 'center', center: true });
    const folders = [[120, tan, ink, 'ขั้นที่ 1  เตรียมตัว', 'สำรวจสิ่งที่ผู้ฟังอยากรู้\nรวบรวมข้อมูลและตัวอย่าง\nจัดลำดับเนื้อหาให้เข้าใจง่าย'], [1000, rose, '#ffffff', 'ขั้นที่ 2  นำเสนอ', 'เปิดด้วยคำถามชวนคิด\nเล่าทีละประเด็นพร้อมภาพ\nปิดท้ายด้วยข้อสรุปสั้น ๆ']];
    for (const [x, c, tc, h, t] of folders) {
      await gfx('decor|folder', x, 290, 800, { h: 620, color: c });
      await text(h, x + 70, 420, { fontFamily: 'Mali', fontWeight: 'bold', fontSize: 56, fill: tc, width: 660 });
      await text(t, x + 70, 540, { fontFamily: 'Mali', fontWeight: '600', fontSize: 42, fill: tc, width: 660, lineHeight: 1.75 });
    }
    await gfx('pixel|pixel-cursor', 880, 250, 120, { angle: -20 });
    await gfx('pixel|pixel-floppy', 1700, 160, 140, { angle: 10 });
    await gfx('pixel|pixel-notepad', 760, 860, 140, { angle: -8 });
    await gfx('pixel|pixel-computer', 1600, 820, 170);

    // C4 thank you
    await newSlide(paper);
    await gfx('decor|dot-grid', 0, 0, 1920, { h: 1080, color: '#d9d7cf' });
    await gfx('decor|folder', 430, 150, 1060, { color: tan });
    await text('ขอบคุณ', 960, 480, { ...outlined, fontSize: 190, strokeWidth: 18, width: 900, textAlign: 'center', center: true });
    await text('ทุกท่าน', 960, 700, { ...outlined, fontSize: 170, strokeWidth: 17, width: 900, textAlign: 'center', center: true });
    await gfx('pixel|pixel-hand', 560, 220, 140);
    await gfx('pixel|pixel-printer', 870, 190, 150);
    await gfx('pixel|pixel-info', 1170, 200, 150);
    await gfx('pixel|pixel-folder', 840, 890, 150);
    await gfx('pixel|pixel-heart', 1500, 420, 110);
    await people([['woman-gesturing-ok', 20, 620, 420], ['man-raising-hand', 1500, 620, 420, true], ['woman-office-worker', 40, 40, 300], ['man-technologist', 1600, 40, 280, true]]);
  }

  // ================================================================ D. company introduction (light blue)
  if (which.includes('company')) {
    const ink = '#111827', blue = '#4f86f7', deep = '#1f3fa8', mist = '#e8f0ff', gray = '#4b5563';
    const head = { fontFamily: 'Prompt', fontWeight: 'bold' };
    const en = { fontFamily: 'Poppins', fontWeight: 'bold' };
    const arcs = async () => {
      await gfx('decor|circle-quarter', 1920 - 520, 0, 520, { color: blue, flipX: true, opacity: 0.9 });
      await gfx('decor|halftone-diagonal', 1920 - 700, 0, 700, { color: blue, opacity: 0.5, flipX: true, flipY: true });
      await gfx('decor|circle-quarter', 0, 1080 - 380, 380, { color: '#bcd2ff', flipY: true });
      await gfx('decor|halftone-corner', 0, 1080 - 520, 520, { color: blue, opacity: 0.45 });
    };

    // D1 cover
    await newSlide('#f7f9fe');
    await gfx('decor|skyline-windows', 760, 700, 1160, { h: 380, color: '#dbe6fb' });
    await gfx('decor|halftone-diagonal', 1920 - 760, 0, 760, { color: blue, opacity: 0.45, flipX: true, flipY: true });
    circle(1450, 520, 330, { fill: ['#ffffff', '#cfe0ff'] });
    await photo('bf2c4403ff', 1150, 220, 600, 600, 'circle', { shadow: SH(40, 18, 0.18, '31,63,168') });
    circle(120 + 40, 160, 40, { fill: blue });
    await icon('globe', 160, 160, 44, '#ffffff', 2);
    await text('แนะนำบริษัท', 120, 260, { ...head, fontSize: 104, fill: ink, width: 1000, lineHeight: 1.1 });
    await text('และทำความรู้จัก', 120, 390, { ...head, fontSize: 104, fill: ink, width: 1000, lineHeight: 1.1 });
    await text('Lai Studio Co., Ltd.', 120, 530, { ...en, fontSize: 76, fill: blue, width: 1000 });
    await text('สตูดิโอออกแบบสื่อการเรียนรู้และงานนำเสนอสำหรับองค์กรไทย', 124, 650, { fontFamily: 'Prompt', fontSize: 30, fill: gray, width: 900 });
    rect(120, 820, 470, 72, { fill: blue, rx: 8 });
    await text('www.laistudio.co.th', 355, 856, { ...en, fontSize: 30, fill: '#ffffff', width: 460, textAlign: 'center', center: true });

    // D2 about
    await newSlide('#f7f9fe');
    await gfx('decor|circle-quarter', 1920 - 560, 1080 - 560, 560, { color: blue, opacity: 0.9 });
    await gfx('decor|halftone-corner', 1920 - 640, 1080 - 640, 640, { color: blue, opacity: 0.4, flipX: true });
    await text('Lai Studio', 120, 140, { ...en, fontSize: 60, fill: blue, width: 900 });
    await text('เกี่ยวกับบริษัท', 120, 220, { ...head, fontSize: 86, fill: ink, width: 900 });
    await text('เราเริ่มจากทีมครูและนักออกแบบ 5 คนในปี 2019 ด้วยความเชื่อว่าการสื่อสารที่ดีเริ่มจากงานออกแบบที่เข้าใจง่าย วันนี้เราดูแลงานนำเสนอ สื่อการสอน และอินโฟกราฟิกให้ลูกค้ากว่า 300 องค์กรทั่วประเทศ', 124, 370, { fontFamily: 'Prompt', fontSize: 31, fill: gray, width: 900, lineHeight: 1.6 });
    const stats = [['300+', 'องค์กรที่ไว้วางใจ'], ['12,000', 'ชิ้นงานที่ส่งมอบ'], ['98%', 'ลูกค้ากลับมาใช้ซ้ำ']];
    for (let i = 0; i < 3; i++) {
      const x = 124 + i * 320;
      await text(stats[i][0], x, 700, { ...en, fontSize: 64, fill: deep, width: 300 });
      await text(stats[i][1], x, 790, { fontFamily: 'Prompt', fontSize: 26, fill: gray, width: 300 });
      if (i) rect(x - 30, 712, 3, 120, { fill: '#c7d6f5' });
    }
    rect(124, 900, 470, 64, { fill: blue, rx: 8 });
    await text('www.laistudio.co.th', 359, 932, { ...en, fontSize: 27, fill: '#ffffff', width: 460, textAlign: 'center', center: true });
    circle(1440, 470, 345, { fill: '#ffffff', shadow: SH(50, 20, 0.16, '31,63,168') });
    await photo('6022dbf4b2', 1110, 140, 660, 660, 'circle');

    // D3 goals
    await newSlide('#f7f9fe');
    await gfx('decor|halftone-diagonal', 1920 - 620, 0, 620, { color: blue, opacity: 0.4, flipX: true, flipY: true });
    await gfx('decor|circle-quarter', 0, 1080 - 300, 300, { color: '#bcd2ff', flipY: true });
    await gfx('decor|halftone-corner', 0, 1080 - 420, 420, { color: blue, opacity: 0.4 });
    await text('เป้าหมายของบริษัท', 120, 110, { ...head, fontSize: 80, fill: ink, width: 900 });
    await text('Lai Studio', 900, 128, { ...en, fontSize: 64, fill: blue, width: 600 });
    const goals = [['ออกแบบให้ทุกคนเข้าใจ', 'งานทุกชิ้นต้องอ่านง่ายใน 5 วินาที ใช้ภาษาไทยที่กระชับ และภาพที่เล่าเรื่องได้เอง'], ['ส่งงานไวแต่ไม่ลดคุณภาพ', 'ระบบเทมเพลตและคลังภาพของเราเอง ทำให้ส่งงานได้ภายใน 3 วันทำการ'], ['เติบโตไปกับลูกค้า', 'สอนทีมลูกค้าให้แก้ไขงานเองได้ พร้อมคู่มือแบรนด์ที่ใช้ต่อได้ทันที']];
    for (let i = 0; i < 3; i++) {
      const x = 160 + i * 560, y = 430;
      rect(x, y, 480, 440, { fill: '#ffffff', rx: 36, stroke: '#9dbcf8', sw: 3, shadow: SH(30, 14, 0.08, '31,63,168') });
      circle(x + 240, y, 62, { fill: blue, stroke: '#f7f9fe', sw: 10 });
      await text('0' + (i + 1), x + 240, y + 2, { ...en, fontSize: 56, fill: '#ffffff', width: 120, textAlign: 'center', center: true });
      await text(goals[i][0], x + 240, y + 130, { ...head, fontSize: 36, fill: ink, width: 420, textAlign: 'center', center: true });
      await text(goals[i][1], x + 240, y + 270, { fontFamily: 'Prompt', fontSize: 27, fill: gray, width: 400, textAlign: 'center', center: true, lineHeight: 1.6 });
    }

    // D4 closing
    await newSlide('#f7f9fe');
    await arcs();
    await text('จบการนำเสนอ', 960, 380, { ...head, fontSize: 104, fill: ink, width: 1200, textAlign: 'center', center: true });
    await text('ขอบคุณที่รับชม', 960, 510, { ...head, fontSize: 104, fill: ink, width: 1200, textAlign: 'center', center: true });
    await text('Lai Studio Co., Ltd.', 960, 660, { ...en, fontSize: 70, fill: blue, width: 1200, textAlign: 'center', center: true });
    rect(725, 760, 470, 72, { fill: blue, rx: 8 });
    await text('www.laistudio.co.th', 960, 796, { ...en, fontSize: 30, fill: '#ffffff', width: 460, textAlign: 'center', center: true });
  }

  L.commit();
  L.canvas.discardActiveObject();
  return pages;
}
