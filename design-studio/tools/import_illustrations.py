"""Import checked AND visually approved illustrations into the app's library.

    python3 tools/import_illustrations.py illustrations/inbox/batch-01 [--out public/illustrations]

Needs <batch>/_check/results.json (from check_illustrations.py, newer than every image) and <batch>/review.json:
    { "s1-students-boy-waving.png": {"ok": true},
      "s1-students-girl-reading.png": {"ok": false, "reason": "มือมี 6 นิ้ว"} }
Stickers: background removed (white / fake checker / solid), trimmed with a small margin, max 1024 px, WebP with alpha.
Scenes: max 1600 px WebP. Writes <out>/<id>.webp, <out>/thumbs/<id>.webp and <out>/manifest.json.
Rejected images get a ready-to-paste "regenerate" prompt in <batch>/_check/regenerate.md.
"""
import argparse
import datetime
import json
import os
import sys

import numpy as np
from PIL import Image, ImageFilter

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from illus_common import ROOT, background_kind, dhash, load_prompts, rgba, subject_mask  # noqa: E402


def cut_out(im):
    a = np.asarray(im).copy()
    kind, colors = background_kind(a)
    if kind in ('white', 'checker', 'solid'):
        mask = subject_mask(a, kind, colors)
        alpha = Image.fromarray((mask * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.8))
        a[:, :, 3] = np.minimum(a[:, :, 3], np.asarray(alpha))
    out = Image.fromarray(a)
    bbox = out.getchannel('A').point(lambda v: 255 if v > 24 else 0).getbbox()
    if bbox:
        x0, y0, x1, y1 = bbox
        m = int(max(x1 - x0, y1 - y0) * 0.04)
        out = out.crop((max(0, x0 - m), max(0, y0 - m), min(out.width, x1 + m), min(out.height, y1 + m)))
    return out, kind


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('batch')
    ap.add_argument('--out', default=os.path.join(ROOT, 'public', 'illustrations'))
    args = ap.parse_args()
    batch = args.batch.rstrip('/')
    res_path = os.path.join(batch, '_check', 'results.json')
    rev_path = os.path.join(batch, 'review.json')
    if not os.path.exists(res_path):
        sys.exit('ยังไม่ได้ตรวจ: รัน check_illustrations.py ก่อน')
    if not os.path.exists(rev_path):
        sys.exit('ยังไม่มีผลตรวจด้วยตา: สร้าง review.json ก่อน (ดูรายละเอียดด้านบนไฟล์นี้)')
    results = json.load(open(res_path))['results']
    review = json.load(open(rev_path))
    prompts = load_prompts()
    newest = max(os.path.getmtime(os.path.join(batch, f)) for f in results)
    if os.path.getmtime(res_path) < newest:
        sys.exit('มีภาพใหม่หลังการตรวจ: รัน check_illustrations.py ซ้ำก่อน')
    os.makedirs(os.path.join(args.out, 'thumbs'), exist_ok=True)
    man_path = os.path.join(args.out, 'manifest.json')
    manifest = json.load(open(man_path)) if os.path.exists(man_path) else {'items': []}
    by_id = {it['id']: it for it in manifest['items']}
    done, skipped, regen = [], [], []
    for f, r in results.items():
        meta = prompts.get(f)
        rv = review.get(f)
        if not meta:
            skipped.append((f, 'ไม่อยู่ในรายการคำสั่ง')); continue
        if r['status'] == 'fail':
            reason = '; '.join(i['msg'] for i in r['issues'] if i['level'] == 'fail')
            skipped.append((f, 'ไม่ผ่านการตรวจอัตโนมัติ: ' + reason)); regen.append((f, meta, reason)); continue
        if not rv or not rv.get('ok'):
            reason = (rv or {}).get('reason', 'ยังไม่ได้อนุมัติ')
            skipped.append((f, 'ไม่ผ่านการตรวจด้วยตา: ' + reason))
            if rv: regen.append((f, meta, reason))
            continue
        im = rgba(os.path.join(batch, f))
        iid = os.path.splitext(f)[0]
        if meta['kind'] == 'sticker':
            im, bgk = cut_out(im)
            im.thumbnail((1024, 1024), Image.LANCZOS)
            im.save(os.path.join(args.out, iid + '.webp'), 'WEBP', quality=86, method=6)
        else:
            bgk = 'full'
            im = im.convert('RGB')
            im.thumbnail((1600, 1600), Image.LANCZOS)
            im.save(os.path.join(args.out, iid + '.webp'), 'WEBP', quality=82, method=6)
        th = im.copy(); th.thumbnail((256, 256), Image.LANCZOS)
        th.save(os.path.join(args.out, 'thumbs', iid + '.webp'), 'WEBP', quality=80)
        by_id[iid] = {
            'id': iid, 'file': f, 'src': iid + '.webp', 'thumb': 'thumbs/' + iid + '.webp', 'w': im.width, 'h': im.height,
            'kind': meta['kind'], 'aspect': meta['aspect'], 'style': meta['style'], 'cat': meta['cat'], 'catTh': meta['catTh'], 'th': meta['th'],
            'keywords': ' '.join([meta['th'], meta['catTh'], meta['subject'].lower()]),
            'hash': dhash(im), 'bgRemoved': bgk if bgk != 'transparent' else '', 'source': 'ChatGPT (สร้างตามคำสั่งของโปรเจกต์นี้)',
            'added': datetime.date.today().isoformat(),
        }
        done.append(f)
    manifest['items'] = sorted(by_id.values(), key=lambda x: (x['cat'], x['id']))
    manifest['updated'] = datetime.datetime.now().isoformat(timespec='seconds')
    json.dump(manifest, open(man_path, 'w'), ensure_ascii=False, indent=1)
    if regen:
        md = ['# คำสั่งสร้างภาพใหม่ (ภาพที่ไม่ผ่าน)', '', 'ส่งในแชตเดิมของชุดนี้ทีละข้อ', '']
        for f, meta, reason in regen:
            md += [f'## {meta["th"]} → `{f}`', '', '```text', f'Please regenerate this image. Problems to fix: {reason}. Keep exactly the same style and all the original rules (one subject, transparent or white background, no text at all).', '```', '']
        open(os.path.join(batch, '_check', 'regenerate.md'), 'w').write('\n'.join(md))
    print(f'นำเข้า {len(done)} ภาพ · ข้าม {len(skipped)} ภาพ · คลังมีทั้งหมด {len(manifest["items"])} ภาพ')
    for f, why in skipped:
        print(f'  ข้าม {f}: {why}')


if __name__ == '__main__':
    main()
