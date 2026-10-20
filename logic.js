// Pure logic: stats, scoring, reasons, deck building. No DOM here, so it can be tested in node.
(function (root) {
  'use strict';
  const DATA = root.NYC_DATA;
  const PROF = root.PROFILES;
  const META = DATA.meta;
  const HOODS = DATA.neighborhoods;
  const N = HOODS.length;
  const BY = Object.fromEntries(HOODS.map((h) => [h.code, h]));

  // Tunable constants (see PRD section 6)
  const MATCH_AT = 60;      // neighborhood says yes at or above this compatibility
  const TOP_PICK_AT = 75;   // "Top pick for you" badge (~1 in 3 users sees at least one)
  const SUPERS = 3;
  const DECK_TOP = 10;      // best matches to show...
  const DECK_WILD = 4;      // ...plus wildcards from the rest

  // 1-5 importance -> weight
  const WEIGHT = { 1: 0.2, 2: 1, 3: 2, 4: 3.5, 5: 6 };
  const IMP_LABEL = ['Don\'t care', 'Nice to have', 'Matters', 'Really matters', 'Dealbreaker'];

  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const ord = (n) => {
    const s = ['th', 'st', 'nd', 'rd'], v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  };
  const num = (x, d = 0) => Number(x).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });

  // ---------------------------------------------------------------- factors
  // best/worst: wording for "Nth-<best>" / "Nth-<worst>" rank labels
  const FACTORS = {
    rent:    { emoji: '💸', label: 'Rent', best: 'cheapest', worst: 'priciest', src: 'rent' },
    commute: { emoji: '💼', label: 'Commute', src: 'commute' },
    transit: { emoji: '🚇', label: 'Subway access', best: 'most stations', worst: 'fewest stations', src: 'transit' },
    safety:  { emoji: '🛡️', label: 'Safety', best: 'lowest felony rate', worst: 'highest felony rate', src: 'safety' },
    green:   { emoji: '🌳', label: 'Green space', best: 'most park space', worst: 'least park space', src: 'green' },
    food:    { emoji: '🍜', label: 'Food scene', best: 'most restaurants', worst: 'fewest restaurants', src: 'food' },
    density: { emoji: '👥', label: 'Crowd level', best: 'densest', worst: 'least dense', src: 'density' },
    air:     { emoji: '💨', label: 'Air quality', best: 'cleanest air', worst: 'smoggiest air', src: 'air' },
    rats:    { emoji: '🐀', label: 'Rat activity', best: 'fewest rat signs', worst: 'most rat signs', src: 'rats' },
  };
  const ORDER = ['rent', 'commute', 'transit', 'safety', 'green', 'food', 'density', 'air', 'rats'];

  function rankLabel(f, h) {
    const r = h.ranks[f];
    if (r == null) return null;
    const F = FACTORS[f];
    const top = r <= Math.ceil(N / 2), k = top ? r : N + 1 - r, word = top ? F.best : F.worst;
    return k === 1 ? `the ${word}` : `${ord(k)}-${word}`;
  }

  function rawValue(f, h, u) {
    switch (f) {
      case 'rent': return h.rent_typical == null ? '—' : '$' + num(h.rent_typical) + '/mo';
      case 'commute': {
        if (!u || u.work === 'remote') return '—';
        const m = h.commute_min[u.work];
        return m == null ? 'No rail route' : m === 0 ? 'Right there' : `~${m} min`;
      }
      case 'transit': return `${h.stations} station${h.stations === 1 ? '' : 's'}`;
      case 'safety': return `${h.felonies_per_1k.toFixed(1)} felonies/1k`;
      case 'green': return `${h.park_acres_per_1k.toFixed(1)} acres/1k`;
      case 'food': return `${num(h.restaurants_per_km2)} eateries/km²`;
      case 'density': return `${num(h.pop_density_per_km2)} people/km²`;
      case 'air': return `${h.pm25.toFixed(1)} µg/m³`;
      case 'rats': return `${h.rat_active_pct.toFixed(1)}% rat signs`;
    }
  }

  function describe(f, h, u) {
    const src = META.sources[FACTORS[f].src];
    let what;
    switch (f) {
      case 'rent': what = h.rent_typical == null ? 'No rent data for this area.' : `Typical rent ${rawValue(f, h)} (median of ${h.rent_zip_count} of ${h.zips.length} ZIPs with data).`; break;
      case 'commute': what = commuteText(h, u); break;
      case 'transit': what = `${h.stations} subway/rail stations${h.lines.length ? ' on the ' + h.lines.join(' ') : ''}.`; break;
      case 'safety': what = `${num(h.felonies)} felony complaints, ${h.felonies_per_1k.toFixed(1)} per 1,000 residents.`; break;
      case 'green': what = `${num(h.park_acres)} acres of parkland, ${h.park_acres_per_1k.toFixed(1)} per 1,000 residents.`; break;
      case 'food': what = `${num(h.restaurants)} restaurants inspected, ${num(h.restaurants_per_km2)} per sq km.`; break;
      case 'density': what = `${num(h.pop_density_per_km2)} people per sq km (${num(h.population)} residents).`; break;
      case 'air': what = `PM2.5 annual mean ${h.pm25.toFixed(2)} µg/m³ (area: ${h.pm25_uhf_name}).`; break;
      case 'rats': what = `${num(h.rat_active)} of ${num(h.rat_initial_inspections)} initial inspections found active rat signs (${h.rat_active_pct.toFixed(1)}%).`; break;
    }
    const rl = rankLabel(f, h);
    return { title: `${FACTORS[f].emoji} ${FACTORS[f].label}`, what, rank: rl ? `${rl} of ${N}` : null, source: `${src.label}${src.dataset ? ' [' + src.dataset + ']' : ''}`, note: src.note };
  }

  function commuteText(h, u) {
    if (!u || u.work === 'remote') return 'You said you work from home, so commute is ignored.';
    const w = META.work_areas[u.work];
    const m = h.commute_min[u.work];
    if (h.code === u.work) return `You'd live in the same neighborhood as work (${w}).`;
    if (m == null) return h.stations === 0
      ? `No subway station here, so no rail route to ${w} (buses, ferries and LIRR are not modeled).`
      : `No subway route to ${w} (ferries and buses are not modeled).`;
    return `About ${m} min by subway to ${w}, including waits and transfers but not the walk to the station.`;
  }

  // ---------------------------------------------------------------- tokens for profile copy
  function tokens(h) {
    const r = h.ranks;
    return {
      pm25: h.pm25 == null ? '—' : h.pm25.toFixed(1), air_rank: ord(r.air),
      rat_pct: h.rat_active_pct == null ? '—' : h.rat_active_pct.toFixed(1) + '%',
      rat_n: num(h.rat_initial_inspections), rat_rank: r.rats == null ? '—' : `${rankLabel('rats', h)} of ${N}`,
      rent: h.rent_typical == null ? '—' : '$' + num(h.rent_typical), rent_rank: r.rent == null ? '—' : `${rankLabel('rent', h)} of ${N}`,
      rent_dear: r.rent == null ? '—' : ord(N + 1 - r.rent),
      crime: h.felonies_per_1k.toFixed(1), safety_rank: ord(r.safety),
      park: h.park_acres_per_1k.toFixed(1), green_rank: ord(r.green),
      food: num(h.restaurants_per_km2), food_rank: ord(r.food),
      stations: h.stations, transit_rank: ord(r.transit), lines: h.lines.length ? h.lines.join(' ') : 'none',
      density: num(h.pop_density_per_km2), density_rank: ord(r.density),
    };
  }
  function fill(str, h) {
    const t = tokens(h);
    // rent_rank / rat_rank already read "... of 42", so swallow a trailing " of 42" in the copy
    return String(str).replace(/\{(rent_rank|rat_rank)\} of 42/g, '{$1}').replace(/\{(\w+)\}/g, (m, k) => (k in t ? t[k] : m));
  }

  // ---------------------------------------------------------------- scoring
  const BUDGET = { low: 0.34, mid: 0.67, high: 1 };
  const VIBES = [0, 0.25, 0.5, 0.75, 1];

  function factorScore(f, h, u) {
    switch (f) {
      case 'density': {
        const d = 1 - (h.ranks.density - 1) / (N - 1); // 1 = densest
        return 100 * (1 - Math.abs(VIBES[u.vibe] - d));
      }
      case 'rent': {
        if (h.rent_typical == null || h.ranks.rent == null) return null;
        const p = (h.ranks.rent - 1) / (N - 1), cap = BUDGET[u.budget];
        return p <= cap ? 70 + 30 * (1 - p / cap) : Math.max(0, 70 - (70 * (p - cap)) / 0.34);
      }
      case 'commute': {
        if (u.work === 'remote') return null;
        if (h.code === u.work) return 100;
        const m = h.commute_min[u.work];
        return m == null ? 0 : clamp(100 - (m - 10) * 2, 0, 100);
      }
      default: {
        const r = h.ranks[f];
        return r == null ? null : (100 * (N - r)) / (N - 1);
      }
    }
  }
  const weightOf = (f, u) => (f === 'commute' && u.work === 'remote' ? 0 : WEIGHT[u.imp[f]] || 0);

  function score(h, u) {
    let sum = 0, wsum = 0;
    const parts = {};
    for (const f of ORDER) {
      const s = factorScore(f, h, u), w = weightOf(f, u);
      parts[f] = s;
      if (s == null || w === 0) continue;
      sum += s * w; wsum += w;
    }
    return { total: wsum ? Math.round(sum / wsum) : 0, parts };
  }

  function scoreAll(u) {
    const out = {};
    for (const h of HOODS) out[h.code] = score(h, u);
    return out;
  }

  // ---------------------------------------------------------------- reasons (always cite real stats)
  const BUDGET_NAME = { low: 'scrappy', mid: 'comfortable', high: 'treat-yourself' };
  function reason(f, h, u, good) {
    const t = tokens(h), F = FACTORS[f], rl = rankLabel(f, h);
    switch (f) {
      case 'rent': return good
        ? `${F.emoji} Typical rent is ${t.rent}, which fits your ${BUDGET_NAME[u.budget]} budget (${rl} of ${N}).`
        : `${F.emoji} Typical rent is ${t.rent} (${rl} of ${N}), which is above your ${BUDGET_NAME[u.budget]} budget.`;
      case 'commute': {
        const m = h.commute_min[u.work], w = META.work_areas[u.work];
        if (h.code === u.work) return `${F.emoji} You'd already be at work: ${w}.`;
        if (m == null) return `${F.emoji} There's no subway route to ${w} (ferries and buses aren't modeled).`;
        return good ? `${F.emoji} About ${m} minutes by subway to ${w}.` : `${F.emoji} About ${m} minutes by subway to ${w}, longer than you'd like.`;
      }
      case 'transit': return good
        ? `${F.emoji} ${t.stations} subway stations (${rl}), serving the ${t.lines}.`
        : `${F.emoji} ${h.stations === 0 ? 'No subway stations' : 'Only ' + t.stations + ' subway station' + (h.stations === 1 ? '' : 's')} (${rl}). You'd lean on buses, rail or a car.`;
      case 'safety': return good
        ? `${F.emoji} ${t.crime} felony complaints per 1,000 residents (${rl} of ${N}).`
        : `${F.emoji} ${t.crime} felony complaints per 1,000 residents (${rl} of ${N}), and you rated safety ${u.imp.safety}/5.`;
      case 'green': return good
        ? `${F.emoji} ${t.park} acres of parkland per 1,000 residents (${rl} of ${N}).`
        : `${F.emoji} Only ${t.park} acres of parkland per 1,000 residents (${rl} of ${N}).`;
      case 'food': return good
        ? `${F.emoji} ${t.food} restaurants per sq km (${rl} of ${N}).`
        : `${F.emoji} Just ${t.food} restaurants per sq km (${rl} of ${N}).`;
      case 'density': {
        const wantQuiet = VIBES[u.vibe] <= 0.5;
        return good
          ? `${F.emoji} At ${t.density} people per sq km, the crowd level matches your ${wantQuiet ? 'low-key' : 'high-energy'} Saturday.`
          : `${F.emoji} At ${t.density} people per sq km, I'm ${wantQuiet ? 'busier' : 'sleepier'} than your Saturday-night taste.`;
      }
      case 'air': return good
        ? `${F.emoji} PM2.5 of ${t.pm25} µg/m³, the ${rl} of ${N}.`
        : `${F.emoji} PM2.5 of ${t.pm25} µg/m³, the ${rl} of ${N}.`;
      case 'rats': return good
        ? `${F.emoji} ${t.rat_pct} of initial rat inspections found active signs (${rl}).`
        : `${F.emoji} ${t.rat_pct} of initial rat inspections found active signs (${rl}).`;
    }
  }

  // factors sorted by how much they help (good) or hurt (bad), weighted by what the user cares about
  function whyYes(h, u, k = 3) {
    const res = score(h, u);
    return ORDER.filter((f) => res.parts[f] != null && weightOf(f, u) >= WEIGHT[3] && res.parts[f] >= 60)
      .sort((a, b) => weightOf(b, u) * res.parts[b] - weightOf(a, u) * res.parts[a]).slice(0, k)
      .map((f) => ({ f, text: reason(f, h, u, true), s: res.parts[f] }));
  }
  function whyNo(h, u, k = 3) {
    const res = score(h, u);
    return ORDER.filter((f) => res.parts[f] != null && weightOf(f, u) >= WEIGHT[3] && res.parts[f] < 50)
      .sort((a, b) => weightOf(b, u) * (100 - res.parts[b]) - weightOf(a, u) * (100 - res.parts[a])).slice(0, k)
      .map((f) => ({ f, text: reason(f, h, u, false), s: res.parts[f] }));
  }

  // ---------------------------------------------------------------- deck
  function shuffle(a, rnd = Math.random) {
    a = a.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }
  // Deck order is random on purpose: matches are a discovery, not a ranked list.
  // Neighborhoods with a real photo (data/photos.js) come first; the rest go at the end of the queue.
  const DECK_SIZE = DECK_TOP + DECK_WILD;
  function buildDeck(u, rnd = Math.random) {
    const all = scoreAll(u);
    const hasPhoto = (c) => !!(root.PHOTOS && root.PHOTOS[c] && root.PHOTOS[c].length);
    const byScore = HOODS.map((h) => h.code).sort((a, b) => all[b].total - all[a].total);
    const photo = byScore.filter(hasPhoto), plain = byScore.filter((c) => !hasPhoto(c));
    if (photo.length) {
      const first = shuffle(photo, rnd).slice(0, DECK_SIZE);
      // fill any remaining slots from the rest: a mix of likely matches and wildcards, shuffled, at the end
      const need = DECK_SIZE - first.length;
      const tail = shuffle(plain.slice(0, Math.ceil(need / 2)).concat(shuffle(plain.slice(Math.ceil(need / 2)), rnd).slice(0, Math.floor(need / 2))), rnd);
      return { deck: first.concat(tail), scores: all };
    }
    const top = byScore.slice(0, DECK_TOP), rest = byScore.slice(DECK_TOP);
    const below = rest.filter((c) => all[c].total < MATCH_AT);
    const pool = below.length >= DECK_WILD ? below : rest.slice(-DECK_WILD);
    return { deck: shuffle(top.concat(shuffle(pool, rnd).slice(0, DECK_WILD)), rnd), scores: all };
  }

  // ---------------------------------------------------------------- extremes for the "stat poster" photo
  const POSTER = {
    air: ['Cleanest air in NYC', 'Smoggiest air in NYC'], rats: ['Fewest rat signs', 'Most rat signs'],
    rent: ['Cheapest rent', 'Priciest rent'], safety: ['Lowest felony rate', 'Highest felony rate'],
    green: ['Most park space', 'Least park space'], food: ['Most restaurants', 'Fewest restaurants'],
    transit: ['Most subway access', 'Least subway access'],
  };
  function poster(h) {
    let best = null;
    for (const f of Object.keys(POSTER)) {
      const r = h.ranks[f];
      if (r == null) continue;
      const hi = r - 1, lo = N - r;
      const d = Math.min(hi, lo);
      if (!best || d < best.d) best = { f, d, top: hi <= lo, r };
    }
    const k = best.top ? best.r : N + 1 - best.r;
    return { f: best.f, top: best.top, rank: k, title: POSTER[best.f][best.top ? 0 : 1], value: rawValue(best.f, h) };
  }

  root.NYC = {
    META, HOODS, BY, N, PROF, FACTORS, ORDER, WEIGHT, IMP_LABEL, BUDGET, BUDGET_NAME, VIBES,
    MATCH_AT, TOP_PICK_AT, SUPERS, DECK_TOP, DECK_WILD,
    ord, num, fill, tokens, rankLabel, rawValue, describe, commuteText,
    factorScore, weightOf, score, scoreAll, whyYes, whyNo, reason, buildDeck, poster, shuffle,
  };
  if (typeof module !== 'undefined') module.exports = root.NYC;
})(typeof window !== 'undefined' ? window : globalThis);
