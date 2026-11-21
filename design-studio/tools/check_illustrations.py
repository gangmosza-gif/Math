"""Check a batch of AI-generated illustrations before they go into the library.

    python3 tools/check_illustrations.py illustrations/inbox/batch-01

Writes <batch>/_check/report.md, results.json and contact.png (a sheet to review every image by eye).
Status per image:  ok | fix (problem the importer repairs by itself, e.g. white background) | warn (look closely) | fail.
An image is imported only when its status is not 'fail' AND it is approved in <batch>/review.json after a visual review.
"""
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile

import numpy as np
from PIL import Image, ImageDraw, ImageFont

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from illus_common import (ASPECTS, ROOT, background_kind, dhash, hamming, load_prompts, on_checker, rgba,  # noqa: E402
                          subject_mask)

EXT = ('.png', '.jpg', '.jpeg', '.webp')
LIB_MANIFEST = os.path.join(ROOT, 'public', 'illustrations', 'manifest.json')
FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
for cand in [os.path.join(ROOT, 'src', 'assets', 'Sarabun-Regular.ttf'), '/usr/share/fonts/truetype/tlwg/Garuda.ttf']:
    if os.path.exists(cand):
        FONT = cand
        break


def ocr_words(img):
    """Words tesseract reads with good confidence (eng + tha). Empty if tesseract is missing."""
    if not shutil.which('tesseract'):
        return None
    flat = Image.new('RGB', img.size, (255, 255, 255))
    flat.paste(img, (0, 0), img)
    with tempfile.TemporaryDirectory() as d:
        p = os.path.join(d, 'i.png')
        flat.save(p)
        try:
            out = subprocess.run(['tesseract', p, '-', '-l', 'eng+tha', '--psm', '11', 'tsv'], capture_output=True, text=True, timeout=120).stdout
        except Exception:  # noqa: BLE001
            return None
    words = []
    for line in out.splitlines()[1:]:
        f = line.split('\t')
        if len(f) < 12:
            continue
        try:
            conf = float(f[10])
        except ValueError:
            continue
        txt = f[11].strip()
        core = re.sub(r'[^0-9A-Za-z฀-๿]', '', txt)
        # real words: 3+ characters with at least 2 different ones (repeated shapes read as "OOO" or "SS" are ignored)
        if conf >= 75 and len(core) >= 3 and len(set(core.lower())) >= 2:
            words.append(txt)
    return words


def edge_density(gray):
    gx = np.abs(np.diff(gray, axis=1))[:-1, :]
    gy = np.abs(np.diff(gray, axis=0))[:, :-1]
    return float(((gx + gy) > 40).mean())


def calm_region(subject, h, w):
    s = subject.lower()
    if 'upper third' in s:
        return (0, 0, w, h // 3)
    if 'upper half' in s or 'upper two thirds' in s:
        return (0, 0, w, h // 2)
    if 'upper-left' in s:
        return (0, 0, w // 2, h // 2)
    if 'centre' in s or 'center' in s:
        return (int(w * 0.3), int(h * 0.3), int(w * 0.7), int(h * 0.7))
    return None


def check(path, meta, hashes):
    issues = []
    add = lambda level, code, msg: issues.append({'level': level, 'code': code, 'msg': msg})
    try:
        im = rgba(path)
    except Exception as e:  # noqa: BLE001
        return {'status': 'fail', 'issues': [{'level': 'fail', 'code': 'unreadable', 'msg': f'เปิดไฟล์ไม่ได้: {e}'}]}, None
    w, h = im.size
    a = np.asarray(im)
    info = {'w': w, 'h': h}
    # size and aspect
    if min(w, h) < 512:
        add('fail', 'small', f'ภาพเล็กเกินไป {w}×{h} (ต้องอย่างน้อย 1024 px)')
    elif min(w, h) < 1024:
        add('warn', 'smallish', f'ภาพค่อนข้างเล็ก {w}×{h} (แนะนำ 1024 px ขึ้นไป)')
    want = ASPECTS[meta['aspect']]
    if abs(w / h - want) / want > 0.04:
        add('fail', 'aspect', f'สัดส่วนภาพ {w}×{h} ไม่ตรงกับที่สั่ง {meta["aspect"]}')
    bg, bgc = background_kind(a)
    info['background'] = bg
    small = np.asarray(im.resize((256, int(256 * h / w)), Image.BILINEAR))
    if meta['kind'] == 'sticker':
        if bg == 'white':
            add('fix', 'white-bg', 'พื้นหลังสีขาว (ระบบจะลบพื้นหลังให้ตอนนำเข้า)')
        elif bg == 'checker':
            add('fix', 'fake-checker', 'พื้นหลังเป็นลายตารางปลอม ไม่ใช่โปร่งใสจริง (ระบบจะลบให้ แต่ควรตรวจขอบภาพ)')
        elif bg == 'solid':
            add('fix', 'solid-bg', 'พื้นหลังเป็นสีพื้นเรียบ (ระบบจะลบให้ตอนนำเข้า)')
        elif bg == 'busy':
            add('fail', 'busy-bg', 'พื้นหลังมีลวดลาย/ฉาก ลบอัตโนมัติไม่ได้ (สั่งใหม่ให้เป็นพื้นโปร่งใสหรือสีขาว)')
        mask = subject_mask(a, bg, bgc)
        ys, xs = np.nonzero(mask)
        if len(xs) == 0:
            add('fail', 'empty', 'ไม่พบวัตถุในภาพ')
        else:
            x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max()
            m = min(x0 / w, y0 / h, (w - 1 - x1) / w, (h - 1 - y1) / h)
            info['margin'] = round(float(m), 3)
            if m < 0.01:
                add('fail', 'cropped', 'วัตถุชนขอบภาพ (ถูกตัด) ต้องมีที่ว่างรอบวัตถุ')
            elif m < 0.04:
                add('warn', 'tight', 'ระยะว่างรอบวัตถุน้อย')
            cov = mask.mean()
            info['coverage'] = round(float(cov), 3)
            if cov < 0.05:
                add('warn', 'tiny-subject', 'วัตถุเล็กมากเมื่อเทียบกับภาพ')
            # scattered specks
            sm = np.asarray(Image.fromarray(mask.astype(np.uint8) * 255).resize((256, 256), Image.NEAREST)) > 0
            from collections import deque
            seen = np.zeros_like(sm); specks = 0
            for y in range(256):
                for x in range(256):
                    if sm[y, x] and not seen[y, x]:
                        q = deque([(y, x)]); seen[y, x] = True; n = 0
                        while q:
                            cy, cx = q.popleft(); n += 1
                            for yy, xx in ((cy - 1, cx), (cy + 1, cx), (cy, cx - 1), (cy, cx + 1)):
                                if 0 <= yy < 256 and 0 <= xx < 256 and sm[yy, xx] and not seen[yy, xx]:
                                    seen[yy, xx] = True; q.append((yy, xx))
                        if n < 4:
                            specks += 1
            if specks > 15:
                add('warn', 'specks', f'มีจุดเล็ก ๆ กระจัดกระจาย {specks} จุด (อาจเป็นเศษพื้นหลัง)')
            # style heuristics on the subject
            sub = a[mask][:, :3].astype(int)
            lum = sub.mean(axis=1)
            dark = float((lum < 55).mean())
            info['dark'] = round(dark, 3)
            uniq = len(np.unique((sub[::7] // 8), axis=0))
            info['colors'] = uniq
            if meta['style'] == 'S1' and dark < 0.02:
                add('warn', 'style-outline', 'ไม่ค่อยมีเส้นขอบดำ อาจไม่ใช่สไตล์ S1 (ลายเส้นน่ารัก)')
            if meta['style'] == 'S2' and dark > 0.12:
                add('warn', 'style-outline', 'มีเส้นขอบดำมาก สไตล์ S2 ไม่ควรมีเส้นขอบ')
            if meta['style'] == 'S3' and uniq < 120:
                add('warn', 'style-3d', 'สีมีน้อยเกินกว่าจะเป็นภาพ 3 มิติที่มีแสงเงา')
    else:
        if bg == 'transparent':
            add('fail', 'scene-transparent', 'ภาพฉากต้องเต็มพื้นที่ แต่ขอบภาพโปร่งใส')
        reg = calm_region(meta.get('space') or meta['subject'], h, w)
        if reg:
            gray = np.asarray(im.convert('L'), dtype=int)
            x0, y0, x1, y1 = reg
            d_reg, d_all = edge_density(gray[y0:y1, x0:x1]), edge_density(gray)
            info['calm'] = round(d_reg / max(d_all, 1e-6), 2)
            if d_reg > d_all * 0.7 and d_reg > 0.02:
                add('warn', 'busy-space', 'พื้นที่ที่เว้นไว้สำหรับข้อความยังมีรายละเอียดมาก')
    # text
    words = ocr_words(im)
    if words is None:
        add('info', 'no-ocr', 'ไม่ได้ตรวจตัวอักษร (ไม่มี tesseract)')
    else:
        allowed = set()
        m = re.match(r'.*number-(\d)\.png$', os.path.basename(path))
        if m:
            allowed.add(m.group(1))
        words = [x for x in words if re.sub(r'\W', '', x) not in allowed]
        info['ocr'] = words
        if len(words) >= 3 and meta['kind'] == 'sticker':
            add('fail', 'text', 'พบตัวอักษรในภาพ: ' + ' '.join(words[:6]))
        elif words:
            add('warn', 'text', 'อาจมีตัวอักษรในภาพ: ' + ' '.join(words))
    # duplicates
    hsh = dhash(im)
    info['hash'] = hsh
    for other, oh in hashes.items():
        if hamming(hsh, oh) <= 6:
            add('warn', 'duplicate', f'ภาพคล้ายกับ {other} มาก')
    status = 'fail' if any(i['level'] == 'fail' for i in issues) else 'warn' if any(i['level'] == 'warn' for i in issues) else 'fix' if any(i['level'] == 'fix' for i in issues) else 'ok'
    return {'status': status, 'issues': issues, **info}, hsh


def contact_sheet(batch, files, results, prompts, out):
    cell, pad, cols = 260, 14, 4
    rows = (len(files) + cols - 1) // cols
    sheet = Image.new('RGB', (cols * (cell + pad) + pad, rows * (cell + 92 + pad) + pad), (246, 246, 250))
    d = ImageDraw.Draw(sheet)
    font = ImageFont.truetype(FONT, 13)
    color = {'ok': (34, 160, 90), 'fix': (40, 120, 220), 'warn': (230, 150, 20), 'fail': (210, 50, 60)}
    from illus_common import subject_mask as sm
    for i, f in enumerate(files):
        x = pad + (i % cols) * (cell + pad)
        y = pad + (i // cols) * (cell + 92 + pad)
        r = results[f]
        try:
            im = rgba(os.path.join(batch, f))
            a = np.asarray(im)
            meta = prompts.get(f)
            if meta and meta['kind'] == 'sticker' and r.get('background') in ('white', 'checker', 'solid'):
                bgk, bgc = background_kind(a)
                mask = sm(a, bgk, bgc)
                a2 = a.copy(); a2[:, :, 3] = np.where(mask, a[:, :, 3], 0)
                im = Image.fromarray(a2)  # preview after automatic background removal
            im.thumbnail((cell, cell))
            prev = on_checker(im) if (meta and meta['kind'] == 'sticker') or im.getchannel('A').getextrema()[0] < 255 else im.convert('RGB')
            sheet.paste(prev, (x + (cell - prev.width) // 2, y + (cell - prev.height) // 2))
        except Exception:  # noqa: BLE001
            pass
        d.rectangle([x, y + cell + 2, x + cell, y + cell + 8], fill=color[r['status']])
        d.text((x, y + cell + 12), f, fill=(30, 30, 40), font=font)
        meta = prompts.get(f)
        d.text((x, y + cell + 30), (meta['th'] if meta else 'ไม่อยู่ในรายการ')[:30], fill=(80, 80, 95), font=font)
        msgs = [m['msg'] for m in r['issues'] if m['level'] != 'info']
        d.text((x, y + cell + 48), (r['status'].upper() + ': ' + (msgs[0] if msgs else 'ผ่าน'))[:40], fill=color[r['status']], font=font)
        if len(msgs) > 1:
            d.text((x, y + cell + 66), msgs[1][:40], fill=color[r['status']], font=font)
    sheet.save(out)


def main():
    if len(sys.argv) < 2:
        print(__doc__); sys.exit(2)
    batch = sys.argv[1].rstrip('/')
    prompts = load_prompts()
    files = sorted(f for f in os.listdir(batch) if f.lower().endswith(EXT))
    lib = {}
    if os.path.exists(LIB_MANIFEST):
        lib = {it['file']: it['hash'] for it in json.load(open(LIB_MANIFEST)).get('items', []) if it.get('hash')}
    results, hashes = {}, dict(lib)
    for f in files:
        meta = prompts.get(f)
        if not meta:
            results[f] = {'status': 'fail', 'issues': [{'level': 'fail', 'code': 'unknown', 'msg': 'ชื่อไฟล์ไม่ตรงกับรายการคำสั่ง (ตั้งชื่อตามที่ระบุในชุดคำสั่ง)'}]}
            continue
        r, hsh = check(os.path.join(batch, f), meta, hashes)
        results[f] = r
        if hsh:
            hashes[f] = hsh
    # which prompts of this batch have no image yet
    bname = os.path.basename(batch)
    expected = [k for k, v in prompts.items() if v['batch'] == bname]
    missing = [k for k in expected if k not in files]
    out = os.path.join(batch, '_check')
    os.makedirs(out, exist_ok=True)
    json.dump({'results': results, 'missing': missing}, open(os.path.join(out, 'results.json'), 'w'), ensure_ascii=False, indent=1)
    if files:
        contact_sheet(batch, files, results, prompts, os.path.join(out, 'contact.png'))
    cnt = {s: sum(1 for r in results.values() if r['status'] == s) for s in ('ok', 'fix', 'warn', 'fail')}
    md = [f'# ผลตรวจภาพ {bname}', '', f"ผ่าน {cnt['ok']} · แก้อัตโนมัติได้ {cnt['fix']} · ต้องดูอีกครั้ง {cnt['warn']} · ไม่ผ่าน {cnt['fail']} · ยังไม่มีภาพ {len(missing)}", '',
          '| ไฟล์ | ภาพ | ผล | ปัญหา |', '|---|---|---|---|']
    for f in files:
        r = results[f]
        th = prompts.get(f, {}).get('th', '-')
        md.append(f"| `{f}` | {th} | {r['status']} | {'<br>'.join(m['msg'] for m in r['issues'] if m['level'] != 'info') or '-'} |")
    if missing:
        md += ['', '**ยังไม่มีภาพ:** ' + ', '.join(f'`{m}`' for m in missing)]
    md += ['', 'ขั้นต่อไป: ตรวจภาพด้วยตาใน `contact.png` แล้วบันทึกผลใน `review.json` (approve / reject + เหตุผล) จากนั้นรัน `npm run illus:import -- ' + batch + '`']
    open(os.path.join(out, 'report.md'), 'w').write('\n'.join(md) + '\n')
    print('\n'.join(md[:3]))
    print(f'report: {out}/report.md  contact sheet: {out}/contact.png')


if __name__ == '__main__':
    main()
