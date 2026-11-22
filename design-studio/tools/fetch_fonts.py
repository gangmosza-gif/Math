"""Download every font the app offers from Google Fonts into public/fonts/ so the app works offline.

    python3 tools/fetch_fonts.py

For each family in src/fonts.js: fetch the Google Fonts CSS (woff2, split per script by unicode-range,
so a page only downloads the Thai or Latin part it uses), save the .woff2 files, and write
public/fonts/<slug>.css whose @font-face rules point at the local files. All these fonts are under the
SIL Open Font License 1.1 (or Apache 2.0), which allows bundling them with an application.
Re-running skips files that are already there.
"""
import json
import os
import re
import sys
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'public', 'fonts')
UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'


def fonts():
    src = open(os.path.join(ROOT, 'src', 'fonts.js'), encoding='utf-8').read()
    return re.findall(r"\['([^']+)',\s*'([^']*)',\s*'[^']*'\]", src)


def get(url):
    req = urllib.request.Request(url, headers={'User-Agent': UA})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read()


def slug(family):
    return re.sub(r'[^a-z0-9]+', '-', family.lower()).strip('-')


def main():
    os.makedirs(OUT, exist_ok=True)
    index = {}
    total = 0
    # the app's own interface font needs the in-between weights too
    jobs = [(f, {'i': ':ital,wght@0,400;0,700;1,400;1,700', 'b': ':wght@400;700'}.get(sp, ''), slug(f)) for f, sp in fonts()]
    jobs.append(('IBM Plex Sans Thai', ':wght@400;500;600;700', 'ui-ibm-plex-sans-thai'))
    for family, axes, s in jobs:
        name = family.replace(' ', '+')
        css = get(f'https://fonts.googleapis.com/css2?family={name}{axes}&display=swap').decode('utf-8')
        os.makedirs(os.path.join(OUT, s), exist_ok=True)
        files = []

        def local(m):
            url = m.group(1)
            fn = os.path.basename(url.split('?')[0])
            path = os.path.join(OUT, s, fn)
            if not os.path.exists(path):
                open(path, 'wb').write(get(url))
            files.append(fn)
            return f'url({s}/{fn})'

        css = re.sub(r'url\((https://fonts\.gstatic\.com/[^)]+)\)', local, css)
        open(os.path.join(OUT, f'{s}.css'), 'w', encoding='utf-8').write(
            f'/* {family} — Google Fonts, SIL Open Font License 1.1 / Apache 2.0 (bundled for offline use) */\n' + css)
        size = sum(os.path.getsize(os.path.join(OUT, s, f)) for f in set(files))
        total += size
        index[s] = {'family': family, 'css': f'{s}.css', 'files': len(set(files)), 'kb': round(size / 1024)}
        print(f'{family:20s} {len(set(files)):3d} files {size / 1024:8.0f} KB')
    json.dump(index, open(os.path.join(OUT, 'index.json'), 'w'), ensure_ascii=False, indent=1)
    print(f'total {total / 1024 / 1024:.1f} MB in {len(index)} families')


if __name__ == '__main__':
    sys.exit(main())
