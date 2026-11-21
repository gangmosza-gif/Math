"""Tests the illustration checker and importer with synthetic images that each carry one known problem.

    python3 tests/illustrations_test.py
"""
import json
import os
import subprocess
import sys
import tempfile

import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
ok = fail = 0


def check(cond, name):
    global ok, fail
    print(('  ✓ ' if cond else '  ✗ ') + name)
    if cond: ok += 1
    else: fail += 1


def doodle(size=1024, bg=(0, 0, 0, 0), box=(250, 220, 774, 820), checker=False):
    im = Image.new('RGBA', (size, size) if isinstance(size, int) else size, bg)
    if checker:
        d = ImageDraw.Draw(im)
        for y in range(0, im.height, 32):
            for x in range(0, im.width, 32):
                d.rectangle([x, y, x + 31, y + 31], fill=(255, 255, 255, 255) if (x // 32 + y // 32) % 2 else (204, 204, 204, 255))
    d = ImageDraw.Draw(im)
    x0, y0, x1, y1 = box
    d.ellipse([x0, y0, x1, y1], fill=(175, 216, 242, 255), outline=(0, 0, 0, 255), width=12)
    d.ellipse([x0 + 120, y0 + 160, x0 + 200, y0 + 240], fill=(0, 0, 0, 255))
    d.ellipse([x1 - 200, y0 + 160, x1 - 120, y0 + 240], fill=(0, 0, 0, 255))
    d.arc([x0 + 140, y0 + 260, x1 - 140, y1 - 140], 20, 160, fill=(0, 0, 0, 255), width=12)
    return im


with tempfile.TemporaryDirectory() as tmp:
    batch = os.path.join(tmp, 'batch-01')
    out = os.path.join(tmp, 'lib')
    os.makedirs(batch)
    good = doodle()
    good.save(os.path.join(batch, 's1-students-boy-waving.png'))                                     # ok
    doodle(bg=(255, 255, 255, 255), box=(200, 200, 820, 840)).save(os.path.join(batch, 's1-students-girl-reading.png'))   # white bg → fix
    doodle(checker=True, box=(260, 150, 760, 860)).save(os.path.join(batch, 's1-students-boy-raise-hand.png'))  # fake checker → fix
    doodle(box=(-80, 300, 600, 980)).save(os.path.join(batch, 's1-students-girl-writing.png'))        # cropped → fail
    t = doodle(box=(300, 420, 724, 900))
    ImageDraw.Draw(t).text((90, 90), 'HAPPY SCHOOL DAY', fill=(20, 20, 20, 255), font=ImageFont.truetype(FONT, 90))
    t.save(os.path.join(batch, 's1-students-two-high-five.png'))                                     # text → fail
    doodle(size=(1024, 700), box=(260, 80, 760, 640)).save(os.path.join(batch, 's1-students-boy-backpack.png'))  # aspect → fail
    doodle(size=640, box=(100, 80, 540, 560)).save(os.path.join(batch, 's1-students-girl-laptop.png'))       # small → warn
    good.save(os.path.join(batch, 's1-students-girl-certificate.png'))                               # duplicate → warn
    good.save(os.path.join(batch, 'my-random-name.png'))                                              # unknown name → fail
    # scenes
    sc = Image.new('RGB', (1536, 1024), (200, 230, 250))
    d = ImageDraw.Draw(sc)
    rng = np.random.default_rng(1)
    for _ in range(900):
        x, y = rng.integers(0, 1536), rng.integers(0, 330)
        d.line([x, y, x + 20, y + 12], fill=(30, 60, 30), width=3)                                  # busy sky
    d.rectangle([0, 700, 1536, 1024], fill=(120, 180, 90))
    sc.save(os.path.join(batch, 's1-slide-bg-hills.png'))                                            # busy text area → warn
    calm = Image.new('RGB', (1536, 1024), (250, 228, 200))
    ImageDraw.Draw(calm).polygon([(0, 1024), (0, 640), (500, 560), (1000, 760), (1536, 600), (1536, 1024)], fill=(210, 120, 80))
    for i in range(30):
        ImageDraw.Draw(calm).ellipse([40 * i + 20, 720, 40 * i + 50, 760], fill=(60, 120, 50))
    calm.save(os.path.join(batch, 's1-slide-bg-playground.png'))                                     # ok scene
    Image.new('RGBA', (1536, 1024), (0, 0, 0, 0)).save(os.path.join(batch, 's1-slide-bg-library.png'))  # transparent scene → fail

    r = subprocess.run([sys.executable, os.path.join(ROOT, 'tools', 'check_illustrations.py'), batch], capture_output=True, text=True)
    print(r.stdout.strip()); print(r.stderr.strip()[-800:])
    res = json.load(open(os.path.join(batch, '_check', 'results.json')))['results']
    st = lambda f: res[f]['status']
    codes = lambda f: {i['code'] for i in res[f]['issues']}
    print('ตรวจอัตโนมัติ')
    check(st('s1-students-boy-waving.png') == 'ok', 'ภาพดี พื้นโปร่งใส → ผ่าน')
    check(st('s1-students-girl-reading.png') == 'fix' and 'white-bg' in codes('s1-students-girl-reading.png'), 'พื้นขาว → แก้อัตโนมัติได้')
    check('fake-checker' in codes('s1-students-boy-raise-hand.png') and st('s1-students-boy-raise-hand.png') != 'fail', 'ลายตารางปลอม → แก้อัตโนมัติได้')
    check(st('s1-students-girl-writing.png') == 'fail' and 'cropped' in codes('s1-students-girl-writing.png'), 'วัตถุชนขอบ → ไม่ผ่าน')
    check(st('s1-students-two-high-five.png') == 'fail' and 'text' in codes('s1-students-two-high-five.png'), 'มีตัวอักษร → ไม่ผ่าน (OCR)')
    check('aspect' in codes('s1-students-boy-backpack.png'), 'สัดส่วนผิด → ไม่ผ่าน')
    check('smallish' in codes('s1-students-girl-laptop.png'), 'ภาพเล็ก → เตือน')
    check('duplicate' in codes('s1-students-girl-certificate.png'), 'ภาพซ้ำ → เตือน')
    check(st('my-random-name.png') == 'fail', 'ชื่อไฟล์ไม่อยู่ในรายการ → ไม่ผ่าน')
    check('busy-space' in codes('s1-slide-bg-hills.png'), 'ฉาก: พื้นที่ใส่ข้อความไม่โล่ง → เตือน')
    check(st('s1-slide-bg-playground.png') == 'ok', 'ฉากโล่งตามสั่ง → ผ่าน')
    check(st('s1-slide-bg-library.png') == 'fail', 'ฉากโปร่งใส → ไม่ผ่าน')
    check(os.path.getsize(os.path.join(batch, '_check', 'contact.png')) > 10000, 'มีภาพรวมสำหรับตรวจด้วยตา (contact.png)')
    if os.environ.get('ILLUS_KEEP'):
        import shutil
        shutil.copy(os.path.join(batch, '_check', 'contact.png'), os.environ['ILLUS_KEEP'])

    print('นำเข้า')
    r = subprocess.run([sys.executable, os.path.join(ROOT, 'tools', 'import_illustrations.py'), batch, '--out', out], capture_output=True, text=True)
    check(r.returncode != 0 and 'review.json' in (r.stdout + r.stderr), 'ไม่มีผลตรวจด้วยตา → ไม่ยอมนำเข้า')
    review = {f: {'ok': True} for f in res}
    review['s1-students-girl-certificate.png'] = {'ok': False, 'reason': 'ซ้ำกับภาพนักเรียนชายโบกมือ'}
    json.dump(review, open(os.path.join(batch, 'review.json'), 'w'), ensure_ascii=False)
    r = subprocess.run([sys.executable, os.path.join(ROOT, 'tools', 'import_illustrations.py'), batch, '--out', out], capture_output=True, text=True)
    print(r.stdout.strip()[:600]); print(r.stderr.strip()[-600:])
    man = json.load(open(os.path.join(out, 'manifest.json')))
    ids = {it['id'] for it in man['items']}
    check(ids == {'s1-students-boy-waving', 's1-students-girl-reading', 's1-students-boy-raise-hand', 's1-students-girl-laptop', 's1-slide-bg-hills', 's1-slide-bg-playground'}, 'นำเข้าเฉพาะภาพที่ผ่านทั้งสองขั้น: ' + ', '.join(sorted(ids)))
    for iid in ('s1-students-girl-reading', 's1-students-boy-raise-hand'):
        a = np.asarray(Image.open(os.path.join(out, iid + '.webp')).convert('RGBA'))
        corners = [a[2, 2, 3], a[2, -3, 3], a[-3, 2, 3], a[-3, -3, 3]]
        centre = a[a.shape[0] // 2, a.shape[1] // 2, 3]
        check(max(corners) < 10 and centre > 240, f'{iid}: ลบพื้นหลังแล้ว มุมโปร่งใส ตรงกลางทึบ')
    a = Image.open(os.path.join(out, 's1-students-boy-waving.webp'))
    check(a.width < 1000 and a.height < 1000, f'ตัดขอบว่างรอบวัตถุ ({a.width}×{a.height})')
    check(all(os.path.exists(os.path.join(out, it['thumb'])) for it in man['items']), 'มีภาพย่อทุกภาพ')
    it = next(x for x in man['items'] if x['id'] == 's1-students-boy-waving')
    check(it['th'] == 'นักเรียนชายโบกมือ' and 'นักเรียน' in it['catTh'] and it['kind'] == 'sticker', 'ข้อมูลภาษาไทยและหมวดครบ')
    regen = open(os.path.join(batch, '_check', 'regenerate.md')).read()
    check('s1-students-girl-writing.png' in regen and 's1-students-two-high-five.png' in regen and 'ซ้ำกับ' in regen, 'สร้างคำสั่งให้สั่งภาพที่ไม่ผ่านใหม่')
    # re-running is idempotent
    subprocess.run([sys.executable, os.path.join(ROOT, 'tools', 'import_illustrations.py'), batch, '--out', out], capture_output=True, text=True)
    check(len(json.load(open(os.path.join(out, 'manifest.json')))['items']) == 6, 'นำเข้าซ้ำไม่เกิดรายการซ้ำ')

print(f'\n{ok}/{ok + fail} passed')
sys.exit(1 if fail else 0)
