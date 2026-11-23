# CLAUDE.md — คู่มือสำหรับ Claude Code ที่ทำงานต่อในโปรเจกต์นี้

> อ่านไฟล์นี้ก่อนทุกครั้ง แล้วอ่านสถานะงานล่าสุดที่ `design-studio/docs/PROJECT-STATUS.md`
> (บันทึกทุกอย่างที่ตกลงกับเจ้าของโปรเจกต์ งานที่ทำแล้ว และงานที่ค้างอยู่)

## โปรเจกต์คืออะไร

**Lai Studio** — โปรแกรมออกแบบกราฟิกภาษาไทยแบบ Canva ทำงานในเบราว์เซอร์ทั้งหมด (ไม่มีเซิร์ฟเวอร์)
อยู่ในโฟลเดอร์ `design-studio/` · Vite + JavaScript ล้วน (ไม่มี framework) + Fabric.js v6.9.1
งานผู้ใช้บันทึกใน IndexedDB ของเบราว์เซอร์ · ใช้งานจริงที่สำนักงานแบบ "ดับเบิลคลิกไฟล์ HTML เดียว" (ออฟไลน์)

ไฟล์ `TEST.html` ที่รากเป็นเกมคณิต ป.2 คนละงาน ไม่เกี่ยวกับ Lai Studio

## วิธีทำงานที่เจ้าของโปรเจกต์ต้องการ (สำคัญ)

1. **ตอบและรายงานเป็นภาษาไทย** สั้น ตรง บอกผลจริง (ทดสอบไม่ผ่านก็บอกว่าไม่ผ่าน)
2. **แก้ทีละจุด แล้วทดสอบทุกครั้ง** ก่อนบอกว่าเสร็จ — ทั้งเฉพาะส่วนที่แก้และทดสอบรวม (regression)
3. **100% local**: ห้ามให้โปรแกรมดึงอะไรจากอินเทอร์เน็ตตอนใช้งาน (ฟอนต์ รูป ไอคอน อยู่ในโปรเจกต์ทั้งหมด)
   ชุดทดสอบ e2e มีตัวจับ request ออกนอกเครื่อง — ต้องว่างเสมอ
4. **ใช้แต่ของที่มีสัญญาอนุญาตใช้ได้** (CC0 / MIT / OFL / CC BY พร้อมเครดิต) และบันทึกเครดิตไว้เสมอ
5. ห้ามใส่อีเมลหรือข้อมูลส่วนตัวของเจ้าของในคำขอไปบริการภายนอก (เคยปฏิเสธการใส่อีเมลใน User-Agent ของ Wikimedia)
6. ออกแบบเทมเพลต/ดีไซน์: ออกแบบเอง "ได้แรงบันดาลใจ" ห้ามลอกงานของ Canva ตรง ๆ ใช้เนื้อหาไทยจริง ไม่ใช้ Lorem ipsum
7. ไม่ deploy สาธารณะโดยไม่ถามก่อน · ไม่สร้าง PR ถ้าไม่ได้ขอ
8. ข้อความ commit ภาษาอังกฤษสั้น ๆ ไม่ใส่ชื่อโมเดล AI

## คำสั่งที่ใช้บ่อย (รันใน `design-studio/`)

```bash
npm install                      # ครั้งแรก
npm run dev                      # พัฒนา: http://localhost:5173
npm run build                    # dist/        เว็บปกติ (ต้อง build ก่อนรันชุดทดสอบ — ทดสอบใช้ vite preview ของ dist)
npm run build:single             # dist-single/ HTML ไฟล์เดียว + photos/ (ใช้ทำ claude.ai Artifact, จำกัด 16 MB)
npm run build:offline            # dist-offline/index.html ไฟล์เดียว ~16.5 MB ฝังฟอนต์+รูปทั้งหมด → ส่งให้ผู้ใช้ (ดับเบิลคลิกได้)

# ชุดทดสอบ (Playwright + Chromium; office/docs ต้องมี LibreOffice + poppler-utils)
node tests/e2e.cjs               # ระบบทั้งหมด 150 ข้อ แบ่ง 15 ส่วน — ONLY=7 node tests/e2e.cjs รันเฉพาะส่วนที่ 7
node tests/journey.cjs           # ใช้งานแบบผู้ใช้จริงต่อเนื่อง 10 ขั้น 83 ขั้นตอน — STAGE=5 หยุดที่ขั้น 5
node tests/office.cjs            # ส่งออก PowerPoint/Word เทียบภาพกับต้นฉบับ 104 ข้อ
node tests/docs.cjs              # เอกสาร Word (หัว/ท้ายกระดาษ เลขหน้า ลายน้ำ) 157 ข้อ
python3 tests/illustrations_test.py   # ตัวตรวจภาพประกอบ 26 ข้อ
```
ผลล่าสุด (23 พ.ย. 2026): e2e 150/150 · journey 83/83 · office 104/104 · docs 157/157 · illustrations 26/26

เครื่องมือสร้างข้อมูล (ใน `tools/`):
- `build-graphics.mjs` → `src/graphics-data.js` (คลังกราฟิก 22 คอลเลกชัน; ดาวน์โหลด @iconify-json ด้วย npm pack)
- `decor.mjs` ลายตกแต่ง 33 แบบ + ไอคอนพิกเซล 16 แบบ (วาดเองด้วยโค้ด)
- `build_pro_templates.cjs` (ต้องรัน `npx vite --port 5199` ก่อน) → `src/protemplates.json` + `protemplates-index.json`
  จาก `pro_deck.js` (3 สไลด์ธุรกิจ) และ `theme_decks.js` (4 ชุด 14 สไลด์)
- `fetch_fonts.py` → `public/fonts/` (34 ตระกูล) · `fetch_photos.py` → `public/photos/` (CC0 จาก Wikimedia, ถูกจำกัดความถี่หนัก)

## โครงสร้างโค้ด (`design-studio/src/`)

| ไฟล์ | หน้าที่ |
|---|---|
| `main.js` | หน้าแรก (ขนาดงาน เทมเพลตแนะนำ รายการงาน โฟลเดอร์ นำเข้า) และ routing `#/d/<id>` |
| `editor.js` | ตัวแก้ไขหลัก (คลาส `Editor`): canvas, แถบเครื่องมือตามชนิดวัตถุ (`renderCtx`/`selectionKind`), แผงซ้าย, ป๊อปอัป, คลิกขวา, หน้า, ซูม, บันทึก |
| `features.js` | ส่วนขยายของ Editor: ตัวแก้ตาราง/กราฟ/QR/สมการ, กรอบรูป, โหมดนำเสนอ, โน้ต, ลิงก์ ฯลฯ |
| `thaiwrap.js` | ตัดบรรทัดภาษาไทยตามคำ (Intl.Segmenter) ต้อง import ก่อนอย่างอื่น |
| `templates.js` / `templates2.js` | เทมเพลตแบบปรับตามขนาด + เทมเพลต "พรีเซนต์มืออาชีพ" (หน้า JSON โหลดเมื่อใช้ครั้งแรก) |
| `elements.js` / `graphics-data.js` | แผงองค์ประกอบ คลังกราฟิก ค้นหาไทย/อังกฤษ |
| `frames.js` `shapes*.js` `smart.js` `charts.js` | กรอบรูป รูปทรง องค์ประกอบอัจฉริยะ (ตาราง กราฟ 32 แบบ QR สมการ) |
| `export.js` / `office.js` | ส่งออก PNG JPG WEBP SVG PDF (มีชั้นข้อความค้นหาได้) / PPTX DOCX ที่แก้ไขได้ |
| `fonts.js` `photos.js` | ฟอนต์และคลังรูปในเครื่อง (`virtual:inline-fonts` / `virtual:inline-photos` ใน vite.config.js สำหรับ build ไฟล์เดียว) |
| `storage.js` | IndexedDB, ป้องกันเขียนทับงานจากอีกแท็บ (rev) |

เปิดตัวแก้ไขจากคอนโซล/ทดสอบได้ผ่าน `window.__lai` (อินสแตนซ์ Editor)

## เรื่องที่เรียนรู้แล้ว (อย่าพลาดซ้ำ)

- พื้นที่วาดมี **ขอบรอบหน้า** (`Editor.pad` 36px, มือถือ 12px) viewport offset = pad และ `canvas.clipPath` = ขอบหน้า
  → แปลงพิกัดจอ↔หน้าต้องบวก `viewportTransform[4/5]` เสมอ (ไม้บรรทัด ภาพย่อ ทดสอบ)
- เปิดจากไฟล์ (`file://`): ห้ามอ่าน `sheet.cssRules` ตรง ๆ (ใช้ try/catch), ห้าม fetch ไฟล์ข้าง ๆ, รูปจากโฟลเดอร์ทำ canvas tainted
  → build แบบ offline ฝังทุกอย่างเป็น data URL
- คลิกขวา: ตัว anchor ของเมนูต้อง `pointer-events:none` ไม่งั้นเมนูเบราว์เซอร์โผล่ทับ · editor ปิดเมนูเบราว์เซอร์ทุกที่ ยกเว้นช่องพิมพ์
- เส้นตรง (Line) แสดงจุดจับแค่ปลายสองข้าง · กราฟิกสีเดียว (`graphic.mono`) ใช้ `selectionKind` = 'graphic'
- ฟิลเตอร์ความสว่าง/คอนทราสต์ย่อช่วงลง (×0.3 / ×0.35) ไม่งั้นรูปขาวทั้งรูป
- เทมเพลต JSON เก็บรูปเป็น `photos/<id>.webp` แล้วแปลงด้วย `libraryPhotoSrc()` ตาม build
- Bash safety check บางครั้งบล็อก heredoc ยาว ๆ → เขียนสคริปต์ด้วย Write tool แล้วค่อยรัน
- เทสต์ office/docs/e2e ต้องเปิดเบราว์เซอร์ด้วย `LANG=C.UTF-8` (ชื่อไฟล์ดาวน์โหลดภาษาไทย)

## Git

- branch งาน: `claude/upbeat-cerf-2evbgk` (ยังไม่ได้ merge เข้า `main` — `main` มีแค่ TEST.html)
- เอกสารสถานะ: `design-studio/docs/PROJECT-STATUS.md` — **อัปเดตทุกครั้งที่จบงานแต่ละรอบ**
- เช็กลิสต์: `design-studio/CHECKLIST.md` (ฟีเจอร์เทียบ Canva), `tests/SYSTEM-CHECKLIST.md`, `tests/USER-JOURNEY.md`
