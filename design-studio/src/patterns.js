// Built-in pattern / background library, generated as SVG (works offline, scales without blur).
const PALETTES = [
  ['#f5f3ff', '#7c5cff'], ['#ecfeff', '#0891b2'], ['#fff7ed', '#f97316'], ['#f0fdf4', '#16a34a'],
  ['#fdf2f8', '#db2777'], ['#1f2333', '#facc15'],
];

function rng(seed) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}

const KINDS = {
  dots: (bg, fg) => `<pattern id="p" width="40" height="40" patternUnits="userSpaceOnUse"><circle cx="20" cy="20" r="5" fill="${fg}" opacity=".55"/></pattern>`,
  grid: (bg, fg) => `<pattern id="p" width="50" height="50" patternUnits="userSpaceOnUse"><path d="M50 0H0V50" fill="none" stroke="${fg}" stroke-width="2" opacity=".35"/></pattern>`,
  stripes: (bg, fg) => `<pattern id="p" width="40" height="40" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="18" height="40" fill="${fg}" opacity=".35"/></pattern>`,
  waves: (bg, fg) => `<pattern id="p" width="120" height="40" patternUnits="userSpaceOnUse"><path d="M0 20 Q30 0 60 20 T120 20" fill="none" stroke="${fg}" stroke-width="4" opacity=".45"/></pattern>`,
  zigzag: (bg, fg) => `<pattern id="p" width="60" height="30" patternUnits="userSpaceOnUse"><path d="M0 25 L15 5 L30 25 L45 5 L60 25" fill="none" stroke="${fg}" stroke-width="4" stroke-linejoin="round" opacity=".45"/></pattern>`,
  checker: (bg, fg) => `<pattern id="p" width="60" height="60" patternUnits="userSpaceOnUse"><rect width="30" height="30" fill="${fg}" opacity=".22"/><rect x="30" y="30" width="30" height="30" fill="${fg}" opacity=".22"/></pattern>`,
  plus: (bg, fg) => `<pattern id="p" width="50" height="50" patternUnits="userSpaceOnUse"><path d="M25 15V35M15 25H35" stroke="${fg}" stroke-width="4" stroke-linecap="round" opacity=".5"/></pattern>`,
  triangles: (bg, fg) => `<pattern id="p" width="60" height="52" patternUnits="userSpaceOnUse"><path d="M30 6 L54 46 H6Z" fill="${fg}" opacity=".25"/></pattern>`,
  rings: (bg, fg) => `<pattern id="p" width="80" height="80" patternUnits="userSpaceOnUse"><circle cx="40" cy="40" r="28" fill="none" stroke="${fg}" stroke-width="5" opacity=".35"/></pattern>`,
  confetti: (bg, fg, seed) => {
    const r = rng(seed);
    let s = '';
    for (let i = 0; i < 90; i++) {
      const x = r() * 800, y = r() * 800, a = r() * 180, w = 8 + r() * 14;
      s += i % 3 ? `<rect x="${x}" y="${y}" width="${w}" height="${w / 3}" rx="2" fill="${fg}" opacity="${0.3 + r() * 0.5}" transform="rotate(${a} ${x} ${y})"/>` : `<circle cx="${x}" cy="${y}" r="${w / 3}" fill="${fg}" opacity="${0.3 + r() * 0.4}"/>`;
    }
    return { direct: s };
  },
  blobs: (bg, fg, seed) => {
    const r = rng(seed);
    let s = '';
    for (let i = 0; i < 5; i++) s += `<circle cx="${r() * 800}" cy="${r() * 800}" r="${120 + r() * 200}" fill="${fg}" opacity="${0.12 + r() * 0.18}"/>`;
    return { direct: s };
  },
  gradient: (bg, fg) => ({ direct: `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${bg}"/><stop offset="1" stop-color="${fg}" stop-opacity=".55"/></linearGradient></defs><rect width="800" height="800" fill="url(#g)"/>` }),
};

export const PATTERN_NAMES = { dots: 'จุด', grid: 'ตาราง', stripes: 'ลายทาง', waves: 'คลื่น', zigzag: 'ซิกแซก', checker: 'หมากรุก', plus: 'บวก', triangles: 'สามเหลี่ยม', rings: 'วงแหวน', confetti: 'คอนเฟตตี', blobs: 'วงกลมฟุ้ง', gradient: 'ไล่สี' };

/** All patterns: [{ id, name, url }] — 12 kinds × 6 palettes = 72. */
export const PATTERNS = Object.keys(KINDS).flatMap((k, ki) => PALETTES.map(([bg, fg], pi) => {
  const body = KINDS[k](bg, fg, 1000 + ki * 31 + pi * 7);
  const inner = typeof body === 'string' ? `<defs>${body}</defs><rect width="800" height="800" fill="url(#p)"/>` : body.direct;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800" viewBox="0 0 800 800"><rect width="800" height="800" fill="${bg}"/>${inner}</svg>`;
  return { id: `${k}-${pi}`, name: `${PATTERN_NAMES[k]} ${pi + 1}`, url: 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg) };
}));

// Lorem Picsum ids that do not exist (the rest of 0–1084 are valid photos)
