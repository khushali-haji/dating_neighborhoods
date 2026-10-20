// Original illustrated "photos" for profile cards (inline SVG, no network).
// Teammates: to use real photos instead, add `photos: ['img/x.jpg']` support in app.js slides().
(function (root) {
  'use strict';

  function rng(seed) {
    let s = (seed >>> 0) || 1;
    return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
  }
  // darken/lighten a hex colour
  function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    const f = (v) => Math.max(0, Math.min(255, Math.round(v + amt * (amt < 0 ? v : 255 - v))));
    const r = f(n >> 16), g = f((n >> 8) & 255), b = f(n & 255);
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }

  const W = 400, H = 500, GROUND = 330;

  const SCENES = {
    skyline(R, c, ac) {
      let s = '';
      let x = -10;
      while (x < W) {
        const w = 28 + R() * 30, h = 90 + R() * 150, col = shade(ac, -0.35 - R() * 0.3);
        s += `<rect x="${x}" y="${GROUND - h}" width="${w}" height="${h + 2}" fill="${col}"/>`;
        for (let wy = GROUND - h + 10; wy < GROUND - 10; wy += 14) for (let wx = x + 5; wx < x + w - 7; wx += 10) if (R() > 0.45) s += `<rect x="${wx}" y="${wy}" width="4" height="6" fill="#ffe9a8" opacity=".9"/>`;
        x += w + 2 + R() * 6;
      }
      return s;
    },
    towers(R, c, ac) {
      let s = '';
      [30, 100, 170, 240, 305].forEach((x, i) => {
        const w = 52 + R() * 14, h = 150 + R() * 120, col = shade(ac, -0.25 - i * 0.07);
        s += `<rect x="${x}" y="${GROUND - h}" width="${w}" height="${h + 2}" fill="${col}"/><rect x="${x + w / 2 - 1}" y="${GROUND - h - 28}" width="2" height="28" fill="${col}"/>`;
        for (let wy = GROUND - h + 8; wy < GROUND - 8; wy += 12) for (let wx = x + 6; wx < x + w - 6; wx += 9) if (R() > 0.4) s += `<rect x="${wx}" y="${wy}" width="4" height="6" fill="#fff5c8" opacity=".85"/>`;
      });
      return s;
    },
    brownstones(R, c, ac) {
      let s = '';
      const cols = ['#9b5b3f', '#b5694a', '#7d4a37', '#a86c52', '#8a5440', '#c07a56'];
      for (let i = 0; i < 6; i++) {
        const x = i * 68 - 6, h = 140 + R() * 40, col = cols[i % cols.length];
        s += `<rect x="${x}" y="${GROUND - h}" width="66" height="${h + 2}" fill="${col}"/><rect x="${x - 2}" y="${GROUND - h - 8}" width="70" height="10" fill="${shade(col, -0.25)}"/>`;
        for (let r = 0; r < 3; r++) for (let k = 0; k < 2; k++) s += `<rect x="${x + 10 + k * 28}" y="${GROUND - h + 14 + r * 36}" width="16" height="24" rx="8" fill="${R() > 0.35 ? '#ffe9a8' : '#3b2a40'}"/>`;
        s += `<rect x="${x + 24}" y="${GROUND - 40}" width="20" height="40" rx="3" fill="#3b2a40"/>`;
        for (let st = 0; st < 4; st++) s += `<rect x="${x + 18 - st * 2}" y="${GROUND - 10 + st * 3}" width="${32 + st * 4}" height="3" fill="${shade(col, 0.3)}"/>`;
      }
      return s;
    },
    rowhouses(R, c, ac) {
      let s = '';
      const cols = ['#d98e73', '#c4755c', '#e0a589', '#b86a52', '#d4977d'];
      for (let i = 0; i < 6; i++) {
        const x = i * 68 - 6, h = 120 + R() * 40, col = cols[i % cols.length];
        s += `<rect x="${x}" y="${GROUND - h}" width="66" height="${h + 2}" fill="${col}"/><polygon points="${x - 2},${GROUND - h} ${x + 33},${GROUND - h - 34} ${x + 68},${GROUND - h}" fill="${shade(col, -0.35)}"/>`;
        for (let r = 0; r < 2; r++) for (let k = 0; k < 2; k++) s += `<rect x="${x + 12 + k * 28}" y="${GROUND - h + 18 + r * 38}" width="14" height="22" fill="${R() > 0.4 ? '#ffe9a8' : '#4a3440'}"/>`;
        s += `<rect x="${x + 26}" y="${GROUND - 34}" width="16" height="34" fill="#4a3440"/>`;
      }
      return s;
    },
    park(R, c, ac) {
      let s = `<ellipse cx="90" cy="${GROUND + 20}" rx="220" ry="90" fill="${shade(ac, 0.15)}"/><ellipse cx="320" cy="${GROUND + 30}" rx="230" ry="85" fill="${ac}"/>`;
      for (let i = 0; i < 11; i++) {
        const x = 20 + i * 36 + R() * 12, y = GROUND - 8 + R() * 22, r = 16 + R() * 12;
        s += `<rect x="${x - 2}" y="${y}" width="5" height="${22 + R() * 8}" fill="#6b4a32"/><circle cx="${x}" cy="${y - 6}" r="${r}" fill="${shade(ac, -0.2 - R() * 0.25)}"/><circle cx="${x - r / 3}" cy="${y - r / 2}" r="${r / 2}" fill="${shade(ac, 0.1)}" opacity=".5"/>`;
      }
      return s;
    },
    beach(R, c, ac) {
      let s = `<rect x="0" y="${GROUND - 40}" width="${W}" height="60" fill="${shade(ac, -0.1)}"/>`;
      for (let r = 0; r < 3; r++) { let d = `M0 ${GROUND - 30 + r * 12}`; for (let x = 0; x <= W; x += 40) d += ` q10 -10 20 0 t20 0`; s += `<path d="${d}" fill="none" stroke="#fff" stroke-width="3" opacity="${0.7 - r * 0.15}"/>`; }
      s += `<rect x="0" y="${GROUND + 10}" width="${W}" height="190" fill="#f6dfaa"/>`;
      s += `<line x1="280" y1="${GROUND + 10}" x2="262" y2="${GROUND - 60}" stroke="#6b4a32" stroke-width="4"/><path d="M230 ${GROUND - 54} q32 -44 66 0z" fill="#ff4f6d"/><path d="M262 ${GROUND - 54} q18 -44 34 0z" fill="#ffd23f"/>`;
      s += `<circle cx="80" cy="${GROUND - 70}" r="26" fill="none" stroke="${shade(ac, -0.3)}" stroke-width="4"/><g stroke="${shade(ac, -0.3)}" stroke-width="2">${[0, 45, 90, 135].map((a) => `<line x1="${80 + 26 * Math.cos(a * Math.PI / 180)}" y1="${GROUND - 70 + 26 * Math.sin(a * Math.PI / 180)}" x2="${80 - 26 * Math.cos(a * Math.PI / 180)}" y2="${GROUND - 70 - 26 * Math.sin(a * Math.PI / 180)}"/>`).join('')}</g><line x1="80" y1="${GROUND - 44}" x2="66" y2="${GROUND + 10}" stroke="${shade(ac, -0.3)}" stroke-width="4"/>`;
      return s;
    },
    bridge(R, c, ac) {
      const col = shade(ac, -0.45);
      let s = `<rect x="0" y="${GROUND - 10}" width="${W}" height="30" fill="${shade(ac, 0.05)}"/>`;
      [90, 310].forEach((x) => { s += `<rect x="${x - 7}" y="${GROUND - 190}" width="14" height="195" fill="${col}"/><rect x="${x - 11}" y="${GROUND - 140}" width="22" height="6" fill="${col}"/><rect x="${x - 11}" y="${GROUND - 90}" width="22" height="6" fill="${col}"/>`; });
      s += `<path d="M-10 ${GROUND - 30} Q 20 ${GROUND - 60} 90 ${GROUND - 185} Q 200 ${GROUND - 30} 310 ${GROUND - 185} Q 380 ${GROUND - 60} 410 ${GROUND - 30}" fill="none" stroke="${col}" stroke-width="4"/>`;
      for (let x = 100; x < 310; x += 12) { const t = (x - 90) / 220, y = GROUND - 185 + 2 * (1 - t) * t * 155; s += `<line x1="${x}" y1="${y}" x2="${x}" y2="${GROUND - 34}" stroke="${col}" stroke-width="1" opacity=".5"/>`; }
      s += `<rect x="-10" y="${GROUND - 34}" width="${W + 20}" height="8" fill="${col}"/>`;
      return s;
    },
    warehouse(R, c, ac) {
      const col = shade(ac, -0.4);
      let s = `<rect x="20" y="${GROUND - 110}" width="360" height="112" fill="${col}"/>`;
      for (let i = 0; i < 4; i++) s += `<polygon points="${20 + i * 90},${GROUND - 110} ${20 + i * 90},${GROUND - 150} ${20 + i * 90 + 90},${GROUND - 110}" fill="${shade(col, -0.2)}"/>`;
      s += `<rect x="330" y="${GROUND - 220}" width="22" height="110" fill="${shade(col, -0.1)}"/><circle cx="340" cy="${GROUND - 240}" r="14" fill="#fff" opacity=".5"/><circle cx="356" cy="${GROUND - 262}" r="18" fill="#fff" opacity=".35"/>`;
      for (let i = 0; i < 6; i++) s += `<rect x="${40 + i * 56}" y="${GROUND - 90}" width="36" height="50" fill="${R() > 0.3 ? '#ffe9a8' : '#2c2338'}"/>`;
      s += `<path d="M0 ${GROUND - 170} Q200 ${GROUND - 120} 400 ${GROUND - 190}" fill="none" stroke="#fff" stroke-width="1.5" opacity=".8"/>`;
      for (let i = 0; i < 9; i++) { const t = i / 8, y = (1 - t) * (1 - t) * (GROUND - 170) + 2 * (1 - t) * t * (GROUND - 120) + t * t * (GROUND - 190); s += `<circle cx="${400 * t}" cy="${y}" r="4" fill="#ffd23f"/>`; }
      return s;
    },
    suburb(R, c, ac) {
      let s = `<rect x="0" y="${GROUND - 4}" width="${W}" height="40" fill="${shade(ac, 0.2)}"/>`;
      const cols = ['#f1d9b5', '#d9e8f2', '#f2c9c9', '#d5ecd0'];
      [20, 150, 280].forEach((x, i) => {
        const col = cols[(i + Math.floor(R() * 3)) % cols.length], w = 100;
        s += `<rect x="${x}" y="${GROUND - 80}" width="${w}" height="82" fill="${col}"/><polygon points="${x - 8},${GROUND - 80} ${x + w / 2},${GROUND - 130} ${x + w + 8},${GROUND - 80}" fill="${shade(col, -0.45)}"/><rect x="${x + 40}" y="${GROUND - 40}" width="20" height="40" fill="#8a5a3c"/><rect x="${x + 12}" y="${GROUND - 62}" width="18" height="18" fill="#9fd3ee"/><rect x="${x + 70}" y="${GROUND - 62}" width="18" height="18" fill="#9fd3ee"/>`;
      });
      [118, 250, 372].forEach((x) => { s += `<rect x="${x - 2}" y="${GROUND - 40}" width="5" height="42" fill="#6b4a32"/><circle cx="${x}" cy="${GROUND - 56}" r="22" fill="${shade(ac, -0.3)}"/>`; });
      return s;
    },
    ferry(R, c, ac) {
      let s = `<rect x="0" y="${GROUND - 20}" width="${W}" height="60" fill="${shade(ac, -0.05)}"/>`;
      let x = 0;
      while (x < W) { const w = 18 + R() * 20, h = 30 + R() * 60; s += `<rect x="${x}" y="${GROUND - 20 - h}" width="${w}" height="${h}" fill="${shade(ac, -0.45)}" opacity=".55"/>`; x += w + 2; }
      s += `<polygon points="90,${GROUND + 8} 330,${GROUND + 8} 310,${GROUND + 36} 112,${GROUND + 36}" fill="#ff8a2a"/><rect x="120" y="${GROUND - 26}" width="170" height="34" fill="#fff"/><rect x="150" y="${GROUND - 50}" width="110" height="26" fill="#f2f2f2"/>`;
      for (let i = 0; i < 7; i++) s += `<rect x="${130 + i * 23}" y="${GROUND - 18}" width="12" height="12" fill="#6fb8e0"/>`;
      s += `<rect x="200" y="${GROUND - 74}" width="14" height="24" fill="#ff8a2a"/>`;
      for (let r = 0; r < 3; r++) { let d = `M0 ${GROUND + 44 + r * 12}`; for (let k = 0; k <= W; k += 40) d += ` q10 -8 20 0 t20 0`; s += `<path d="${d}" fill="none" stroke="#fff" stroke-width="3" opacity="${0.65 - r * 0.15}"/>`; }
      return s;
    },
    market(R, c, ac) {
      let s = '';
      const cols = ['#ff4f6d', '#ffd23f', '#1fcf97', '#8b6cff', '#4cc9f0'];
      for (let i = 0; i < 4; i++) {
        const x = 8 + i * 98, col = cols[(i + Math.floor(R() * 3)) % cols.length];
        s += `<rect x="${x + 6}" y="${GROUND - 70}" width="4" height="72" fill="#5b4636"/><rect x="${x + 76}" y="${GROUND - 70}" width="4" height="72" fill="#5b4636"/>`;
        for (let k = 0; k < 6; k++) s += `<path d="M${x + k * 14} ${GROUND - 100} h14 v22 q-7 10 -14 0z" fill="${k % 2 ? '#fff' : col}"/>`;
        s += `<rect x="${x + 10}" y="${GROUND - 20}" width="66" height="22" fill="#8a6a4f"/>`;
        for (let k = 0; k < 5; k++) s += `<circle cx="${x + 18 + k * 13}" cy="${GROUND - 26}" r="7" fill="${cols[(i + k) % cols.length]}"/>`;
      }
      s += `<path d="M0 ${GROUND - 130} Q200 ${GROUND - 100} 400 ${GROUND - 130}" fill="none" stroke="#fff" stroke-width="1.5"/>`;
      for (let i = 0; i < 9; i++) s += `<polygon points="${i * 46 + 10},${GROUND - 126 + Math.sin(i * 0.7) * 6} ${i * 46 + 26},${GROUND - 126 + Math.sin(i * 0.7) * 6} ${i * 46 + 18},${GROUND - 106 + Math.sin(i * 0.7) * 6}" fill="${cols[i % cols.length]}"/>`;
      return s;
    },
    stadium(R, c, ac) {
      const col = shade(ac, -0.2);
      let s = `<path d="M10 ${GROUND} Q 200 ${GROUND - 200} 390 ${GROUND} z" fill="${col}"/><path d="M50 ${GROUND} Q 200 ${GROUND - 140} 350 ${GROUND} z" fill="${shade(col, -0.25)}"/>`;
      for (let i = 0; i < 10; i++) s += `<rect x="${60 + i * 29}" y="${GROUND - 70 - Math.sin(i / 9 * Math.PI) * 55}" width="14" height="${34 + Math.sin(i / 9 * Math.PI) * 40}" rx="7" fill="${shade(col, 0.3)}" opacity=".8"/>`;
      [40, 360].forEach((x) => { s += `<rect x="${x - 3}" y="${GROUND - 170}" width="6" height="170" fill="#4a4668"/><rect x="${x - 22}" y="${GROUND - 190}" width="44" height="22" fill="#fff6c0"/>`; });
      s += `<ellipse cx="200" cy="${GROUND + 12}" rx="130" ry="18" fill="#3e9a4f"/>`;
      return s;
    },
  };

  function sceneSVG(code, p) {
    const [c1, c2, ac] = p.pal;
    const R = rng(parseInt(code, 10) * 7919 + 13);
    const draw = SCENES[p.sc] || SCENES.skyline;
    const id = 'g' + code;
    const sun = `<circle cx="${290 + R() * 60}" cy="${90 + R() * 40}" r="${34 + R() * 12}" fill="#fff6c0" opacity=".85"/>`;
    const clouds = [0, 1, 2].map((i) => { const x = 40 + i * 130 + R() * 40, y = 60 + R() * 90; return `<g fill="#fff" opacity=".75"><ellipse cx="${x}" cy="${y}" rx="34" ry="11"/><ellipse cx="${x + 18}" cy="${y - 8}" rx="22" ry="10"/></g>`; }).join('');
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Illustration">
      <defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs>
      <rect width="${W}" height="${H}" fill="url(#${id})"/>${sun}${clouds}${draw(R, [c1, c2, ac], ac)}
      <rect x="0" y="${GROUND}" width="${W}" height="${H - GROUND}" fill="${p.sc === 'beach' ? '#f6dfaa' : shade(ac, -0.5)}" opacity="${p.sc === 'beach' ? 0 : 0.35}"/>
    </svg>`;
  }

  function emojiSVG(code, p) {
    const [c1, c2, ac] = p.pal;
    const R = rng(parseInt(code, 10) * 31 + 7);
    const spots = [[110, 190, -12, 120], [280, 260, 10, 110], [150, 380, 6, 100]];
    const dots = Array.from({ length: 16 }, () => `<circle cx="${R() * W}" cy="${R() * H}" r="${4 + R() * 10}" fill="${ac}" opacity="${0.08 + R() * 0.1}"/>`).join('');
    const em = p.emo.map((e, i) => `<text x="${spots[i][0]}" y="${spots[i][1]}" font-size="${spots[i][3]}" text-anchor="middle" transform="rotate(${spots[i][2]} ${spots[i][0]} ${spots[i][1]})">${e}</text>`).join('');
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" role="img" aria-label="${p.cap}">
      <defs><linearGradient id="e${code}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c2}"/><stop offset="1" stop-color="${c1}"/></linearGradient></defs>
      <rect width="${W}" height="${H}" fill="url(#e${code})"/>${dots}${em}
      <text x="26" y="58" font-size="26" font-weight="900" font-style="italic" fill="${shade(ac, -0.45)}" font-family="Georgia, serif">${p.cap}</text>
    </svg>`;
  }

  function posterSVG(code, p, ps) {
    const [, , ac] = p.pal;
    const R = rng(parseInt(code, 10) * 17 + 3);
    const rays = Array.from({ length: 14 }, (_, i) => `<polygon points="200,250 ${200 + 400 * Math.cos(i * Math.PI / 7)},${250 + 400 * Math.sin(i * Math.PI / 7)} ${200 + 400 * Math.cos((i + 0.5) * Math.PI / 7)},${250 + 400 * Math.sin((i + 0.5) * Math.PI / 7)}" fill="#fff" opacity=".06"/>`).join('');
    const title = ps.title.length > 20 ? ps.title : ps.title;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" role="img" aria-label="${title}">
      <defs><linearGradient id="p${code}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#17142e"/><stop offset="1" stop-color="${shade(ac, -0.55)}"/></linearGradient></defs>
      <rect width="${W}" height="${H}" fill="url(#p${code})"/>${rays}
      <text x="200" y="120" font-size="20" font-weight="900" text-anchor="middle" fill="#ffd23f" letter-spacing="3">${ps.rank === 1 ? 'NYC RECORD' : ps.top ? 'NYC LEADERBOARD' : 'REALITY CHECK'}</text>
      <text x="200" y="250" font-size="120" font-weight="900" text-anchor="middle" fill="#fff">#${ps.rank}</text>
      <text x="200" y="300" font-size="26" font-weight="900" text-anchor="middle" fill="#fff">${title}</text>
      <text x="200" y="336" font-size="18" font-weight="700" text-anchor="middle" fill="#ffd23f">${ps.value} · out of 42 areas</text>
    </svg>`;
  }

  root.NYC_ART = { sceneSVG, emojiSVG, posterSVG, shade };
})(typeof window !== 'undefined' ? window : globalThis);
