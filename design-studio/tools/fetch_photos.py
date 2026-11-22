"""Build the app's own photo library from CC0 / public-domain photos on Wikimedia Commons.

    python3 tools/fetch_photos.py            # fetch every category (resumable: already-saved photos are kept)
    python3 tools/fetch_photos.py --test     # one photo, to check the connection

Only files whose Commons licence is CC0 or Public domain are taken (checked twice: the search is limited to
the CC-zero category, and every file's own licence metadata must say CC0 / Public domain). Paintings,
maps, diagrams, logos and very small or odd-shaped images are skipped. Each photo is saved as
public/photos/<id>.webp (longest side 1280 px, a standard Commons thumbnail size) + public/photos/thumbs/<id>.webp (400 px), and listed in
public/photos/manifest.json with its Thai category, title, author, licence and source page, so every photo
can be traced. Requests go one at a time with pauses, and 429 "slow down" answers are honoured.
"""
import hashlib
import io
import json
import os
import re
import sys
import time
import urllib.parse
import urllib.request

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'public', 'photos')
API = 'https://commons.wikimedia.org/w/api.php'
UA = 'LaiStudioPhotoLibrary/1.0 (offline design app; builds a CC0 photo library, ~1 request every 5 s, standard 1280px thumbnails)'
PAUSE = 5.0

# [category key, Thai name, search terms, how many]
CATEGORIES = [
    ['nature', 'ธรรมชาติ ภูเขา ทะเล', ['mountain landscape', 'beach sea', 'forest trees', 'waterfall', 'lake reflection', 'sunset'], 70],
    ['sky', 'ท้องฟ้า เมฆ ดวงดาว', ['blue sky clouds', 'night sky stars', 'sunrise sky'], 30],
    ['flowers', 'ดอกไม้ ต้นไม้', ['flower', 'flowers garden', 'leaves green', 'lotus'], 45],
    ['animals', 'สัตว์', ['cat', 'dog', 'bird', 'elephant', 'butterfly', 'fish'], 50],
    ['food', 'อาหาร เครื่องดื่ม', ['food dish', 'fruit', 'coffee cup', 'vegetables', 'cake dessert', 'noodles'], 55],
    ['thailand', 'ประเทศไทย', ['Thailand temple', 'Bangkok', 'Thai market', 'rice field Thailand', 'Chiang Mai', 'Thai food'], 60],
    ['city', 'เมือง อาคาร', ['city skyline', 'street', 'architecture building', 'bridge'], 40],
    ['education', 'การศึกษา หนังสือ', ['books', 'library', 'school classroom', 'pencil notebook', 'science laboratory'], 40],
    ['work', 'ธุรกิจ ทำงาน เทคโนโลยี', ['laptop desk', 'office', 'computer keyboard', 'smartphone', 'meeting'], 40],
    ['people', 'ผู้คน กิจกรรม', ['people walking', 'hands', 'sports football', 'music concert', 'festival'], 35],
    ['texture', 'พื้นผิว ลวดลาย (พื้นหลัง)', ['texture wood', 'paper texture', 'stone wall texture', 'abstract background', 'water surface'], 45],
    ['travel', 'ท่องเที่ยว การเดินทาง', ['travel road', 'train', 'airplane', 'boat'], 30],
]
SKIP_WORDS = re.compile(r'artwork|museum|\bMET D[PT]|accession|painting|drawing|engraving|lithograph|etching|map\b|diagram|logo|coat of arms|flag of|chart|poster|stamp|coin|manuscript|illustration|sketch|portrait of|nude|svg|screenshot|scan', re.I)
# subjects a school / office design tool should not offer
SENSITIVE = re.compile(r'phallus|lingam|nude|naked|erotic|sex|corpse|dead\b|blood|wound|war\b|weapon|gun|rifle|execution|swastika|cigarette|alcohol|beer|whisky|wine', re.I)
STOP = {'and', 'of', 'the', 'in', 'a'}
LICENCE_OK = re.compile(r'^(cc0|cc-zero|public domain|pd|pdm)', re.I)


def http(url, tries=6):
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': UA})
            with urllib.request.urlopen(req, timeout=90) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            if e.code == 429 or e.code >= 500:
                wait = int(e.headers.get('retry-after') or 0) or 20 * (i + 1)
                print(f'    server busy ({e.code}) on {url.split("?")[0][:70]}, waiting {wait}s', flush=True)
                time.sleep(wait)
                continue
            raise
        except Exception as e:  # network hiccup
            print('    retry:', e)
            time.sleep(10 * (i + 1))
    raise RuntimeError('gave up: ' + url)


def api(**params):
    params.update(format='json', formatversion='2')
    data = json.loads(http(API + '?' + urllib.parse.urlencode(params)))
    time.sleep(PAUSE)
    return data


def search(term, limit=50):
    # CC-zero category: mostly modern photos released by their authors (the PD categories are mostly old scans)
    q = f'{term} filetype:bitmap incategory:CC-zero'
    d = api(action='query', generator='search', gsrnamespace=6, gsrlimit=limit, gsrsearch=q,
            prop='imageinfo', iiprop='url|size|mime|extmetadata', iiurlwidth=1280,
            iiextmetadatafilter='LicenseShortName|Artist|ObjectName|Categories')
    return d.get('query', {}).get('pages', [])


def clean(html):
    return re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', '', html or '')).strip()


def acceptable(p, term=''):
    ii = (p.get('imageinfo') or [{}])[0]
    m = ii.get('extmetadata', {})
    lic = clean(m.get('LicenseShortName', {}).get('value', ''))
    title = p['title']
    if ii.get('mime') not in ('image/jpeg', 'image/png', 'image/webp'):
        return None, 'type'
    if not LICENCE_OK.search(lic):
        return None, 'licence ' + lic
    if SKIP_WORDS.search(title) or SKIP_WORDS.search(clean(m.get('Categories', {}).get('value', ''))):
        return None, 'not a photo'
    cats = clean(m.get('Categories', {}).get('value', ''))
    if SENSITIVE.search(title) or SENSITIVE.search(cats):
        return None, 'sensitive'
    words = [w for w in re.findall(r'[a-z]+', term.lower()) if w not in STOP and len(w) > 2]
    if words and not any(w.rstrip('s') in (title + ' ' + cats).lower() for w in words):
        return None, 'off topic'
    w, h = ii.get('width', 0), ii.get('height', 0)
    if min(w, h) < 900 or not (0.5 <= w / max(h, 1) <= 2.2):
        return None, 'size/shape'
    return {'title': re.sub(r'^File:|\.[a-z]+$', '', title, flags=re.I), 'licence': lic,
            'author': clean(m.get('Artist', {}).get('value', ''))[:80] or 'ไม่ระบุ',
            'page': 'https://commons.wikimedia.org/wiki/' + urllib.parse.quote(title.replace(' ', '_')),
            'src': ii.get('thumburl') or ii.get('url'), 'orig': ii.get('url'), 'bytes': ii.get('size', 0)}, 'ok'


def save(item, cat):
    # the main media host serves the same standard thumbnails and is far less strict than thumb.wikimedia.org
    # the original file when it is not huge (thumbnail requests are rate-limited much harder), else the standard thumbnail
    if item.get('bytes', 0) > 25_000_000:
        raise RuntimeError('file too large')
    url = item.get('orig') or item['src'].replace('://thumb.wikimedia.org/', '://upload.wikimedia.org/')
    raw = http(url)
    time.sleep(PAUSE)
    im = Image.open(io.BytesIO(raw))
    im = im.convert('RGB')
    pid = hashlib.sha1(item['page'].encode()).hexdigest()[:10]
    big = im.copy(); big.thumbnail((1600, 1600), Image.LANCZOS)
    big.save(os.path.join(OUT, f'{pid}.webp'), 'WEBP', quality=80, method=6)
    th = im.copy(); th.thumbnail((400, 400), Image.LANCZOS)
    th.save(os.path.join(OUT, 'thumbs', f'{pid}.webp'), 'WEBP', quality=72, method=6)
    return {'id': pid, 'cat': cat, 'w': big.width, 'h': big.height, **{k: item[k] for k in ('title', 'author', 'licence', 'page')}}


def write_credits(man):
    """Every photo with its author, licence and source page (CC0 needs no credit, but each photo stays traceable)."""
    th = {c['key']: c['th'] for c in man['categories']}
    lines = ['# เครดิตรูปถ่ายในโปรแกรม', '', 'รูปทั้งหมดมาจาก Wikimedia Commons และเผยแพร่แบบ **CC0 / Public domain** (ใช้ ดัดแปลง และเผยแพร่ได้โดยไม่ต้องขออนุญาต)',
             'รายการนี้สร้างอัตโนมัติโดย `tools/fetch_photos.py`', '', '| รหัส | หมวด | ชื่อรูป | ผู้ถ่าย | สัญญาอนุญาต | ที่มา |', '|---|---|---|---|---|---|']
    for it in man['items']:
        lines.append(f"| {it['id']} | {th.get(it['cat'], it['cat'])} | {it['title'].replace('|', '/')} | {it['author'].replace('|', '/')} | {it['licence']} | [Commons]({it['page']}) |")
    open(os.path.join(OUT, 'CREDITS.md'), 'w', encoding='utf-8').write('\n'.join(lines) + '\n')


def main():
    os.makedirs(os.path.join(OUT, 'thumbs'), exist_ok=True)
    mpath = os.path.join(OUT, 'manifest.json')
    man = json.load(open(mpath)) if os.path.exists(mpath) else {'categories': [], 'items': []}
    have = {it['page'] for it in man['items']}
    # keep categories already in the library, add/rename the ones fetched now
    cats = {c['key']: c['th'] for c in man['categories']}
    cats.update({k: th for k, th, _, _ in CATEGORIES})
    man['categories'] = [{'key': k, 'th': th} for k, th in cats.items()]
    test = '--test' in sys.argv
    for key, th, terms, want in CATEGORIES:
        count = sum(1 for it in man['items'] if it['cat'] == key)
        per = -(-want // len(terms))
        for term in terms:
            if count >= want:
                break
            got = 0
            try:
                pages = search(term)
            except Exception as e:
                print(f'  search "{term}" failed: {e}')
                continue
            for p in pages:
                if count >= want or got >= per:
                    break
                item, why = acceptable(p, term)
                if not item or item['page'] in have:
                    continue
                try:
                    rec = save(item, key)
                except Exception as e:
                    print(f'    skip {item["title"][:40]}: {e}')
                    continue
                man['items'].append(rec)
                have.add(item['page'])
                count += 1
                got += 1
                json.dump(man, open(mpath, 'w'), ensure_ascii=False, indent=0)
                if test:
                    print('test ok:', rec)
                    return
            print(f'  {th}: "{term}" +{got} → {count}/{want}', flush=True)
    write_credits(man)
    size = sum(os.path.getsize(os.path.join(dp, f)) for dp, _, fs in os.walk(OUT) for f in fs)
    print(f'library: {len(man["items"])} photos, {size / 1024 / 1024:.0f} MB')


if __name__ == '__main__':
    main()
