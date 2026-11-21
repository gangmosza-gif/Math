"""Shared helpers for the illustration checker and importer."""
import json
import os
from collections import deque

import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROMPTS = os.path.join(ROOT, 'illustrations', 'prompts.json')
ASPECTS = {'1:1': 1.0, '3:2': 1.5, '2:3': 2 / 3}


def load_prompts():
    with open(PROMPTS) as fh:
        data = json.load(fh)
    return {it['file']: it for it in data['items']}


def rgba(path):
    im = Image.open(path)
    im.load()
    return im.convert('RGBA')


def border_pixels(a, w=6):
    """Pixels of the outer `w`-pixel frame, shape (n, 4)."""
    return np.concatenate([a[:w].reshape(-1, 4), a[-w:].reshape(-1, 4), a[:, :w].reshape(-1, 4), a[:, -w:].reshape(-1, 4)])


def background_kind(a):
    """'transparent' | 'white' | 'checker' | 'solid' | 'busy' — what surrounds the subject."""
    b = border_pixels(a)
    if (b[:, 3] < 20).mean() > 0.9:
        return 'transparent', []
    rgb = b[:, :3].astype(int)
    q = (rgb // 6) * 6
    colors, counts = np.unique(q, axis=0, return_counts=True)
    order = np.argsort(-counts)
    top = [(colors[i], counts[i] / len(q)) for i in order[:3]]
    light = lambda c: c.min() > 175
    if top[0][1] > 0.85 and light(top[0][0]) and top[0][0].min() > 238:
        return 'white', [top[0][0]]
    if len(top) >= 2 and top[0][1] > 0.25 and top[1][1] > 0.25 and light(top[0][0]) and light(top[1][0]) and abs(int(top[0][0].mean()) - int(top[1][0].mean())) > 6:
        return 'checker', [top[0][0], top[1][0]]
    if top[0][1] > 0.85:
        return 'solid', [top[0][0]]
    return 'busy', []


def subject_mask(a, bg_kind, bg_colors, tol=26):
    """True where the subject is. Transparent images use alpha; others flood-fill the background from the edges."""
    if bg_kind == 'transparent':
        return a[:, :, 3] > 32
    if bg_kind not in ('white', 'checker', 'solid'):
        return np.ones(a.shape[:2], bool)
    rgb = a[:, :, :3].astype(int)
    near = np.zeros(a.shape[:2], bool)
    for c in bg_colors:
        near |= (np.abs(rgb - np.array(c, int)).max(axis=2) <= tol)
    if bg_kind == 'checker':  # the checker squares are any light, low-saturation grey
        mx, mn = rgb.max(axis=2), rgb.min(axis=2)
        near |= (mn > 170) & (mx - mn < 14)
    h, w = near.shape
    bg = np.zeros_like(near)
    dq = deque()
    for x in range(w):
        for y in (0, h - 1):
            if near[y, x] and not bg[y, x]:
                bg[y, x] = True; dq.append((y, x))
    for y in range(h):
        for x in (0, w - 1):
            if near[y, x] and not bg[y, x]:
                bg[y, x] = True; dq.append((y, x))
    while dq:
        y, x = dq.popleft()
        for yy, xx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
            if 0 <= yy < h and 0 <= xx < w and near[yy, xx] and not bg[yy, xx]:
                bg[yy, xx] = True; dq.append((yy, xx))
    return ~bg


def dhash(img, size=8):
    g = img.convert('L').resize((size + 1, size), Image.LANCZOS)
    a = np.asarray(g, dtype=int)
    bits = (a[:, 1:] > a[:, :-1]).flatten()
    return ''.join('1' if b else '0' for b in bits)


def hamming(a, b):
    return sum(x != y for x, y in zip(a, b))


def on_checker(im, sq=16):
    """Composite RGBA on a light checkerboard (for previews of transparent images)."""
    w, h = im.size
    bg = Image.new('RGB', (w, h), (255, 255, 255))
    px = bg.load()
    for y in range(h):
        for x in range(w):
            if ((x // sq) + (y // sq)) % 2:
                px[x, y] = (226, 226, 232)
    bg.paste(im, (0, 0), im)
    return bg
