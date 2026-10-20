// UI: screens, onboarding, swipe deck, match / rejection / "are you sure" moments.
// Scoring and copy live in logic.js and data/. Art lives in art.js.
(function () {
  'use strict';
  const L = window.NYC, ART = window.NYC_ART;
  const { META, HOODS, BY, N, PROF, FACTORS, ORDER, IMP_LABEL } = L;

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  const app = $('#app'), stage = $('#stage'), topbar = $('#top'), topRight = $('#top-right'), btnBack = $('#btn-back');
  const sheetWrap = $('#sheet-wrap'), sheet = $('#sheet'), pop = $('#pop'), toastEl = $('#toast');

  $('#foot-text').innerHTML = `Data: NYC Open Data, pulled ${META.data_pulled_at}.<br><span class="foot-sub">Rent: Zillow · Commute: MTA GTFS (estimated)</span>`;

  // ------------------------------------------------------------------ state
  const KEY = 'swiperight-nyc.profile.v1';
  const defaults = () => ({
    name: '', vibe: 2, budget: 'mid', work: '306',
    imp: { rent: 3, commute: 3, transit: 3, safety: 3, green: 3, food: 3, density: 3, air: 3, rats: 3 },
  });
  let U = defaults();
  try { const saved = JSON.parse(localStorage.getItem(KEY) || 'null'); if (saved && saved.imp) U = Object.assign(defaults(), saved); } catch (e) { /* private mode */ }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(U)); } catch (e) { /* ignore */ } };

  let S = null;            // swipe session
  let sheetMode = null;    // what the open sheet is for
  let step = 0;

  // ------------------------------------------------------------------ helpers
  function setTop(opts) {
    if (!opts) { topbar.hidden = true; return; }
    topbar.hidden = false;
    btnBack.style.visibility = opts.back ? 'visible' : 'hidden';
    topRight.innerHTML = opts.right || '';
  }
  function toast(msg) {
    toastEl.textContent = msg; toastEl.hidden = false;
    clearTimeout(toast.t); toast.t = setTimeout(() => (toastEl.hidden = true), 1800);
  }
  const tabbar = $('#tabs');
  function setTabs(active) {
    tabbar.hidden = !active;
    $$('[data-tab]', tabbar).forEach((b) => b.setAttribute('aria-current', String(b.dataset.tab === active)));
  }
  function screen(html, cls = '') {
    setTabs(null);
    stage.innerHTML = `<section class="screen ${cls}">${html}</section>`;
    stage.firstElementChild.scrollTop = 0;
  }
  const photo = (code, i) => {
    const p = PROF[code];
    if (i === 0 && p.img) return `<img src="${esc(p.img)}" alt="${esc(p.d)}" style="width:100%;height:100%;object-fit:cover" draggable="false">`; // real photo (data/profiles.js: img + credit)
    return [ART.sceneSVG, ART.emojiSVG, (c, pr) => ART.posterSVG(c, pr, L.poster(BY[c]))][i](code, p);
  };
  const pct = (n) => `${Math.round(n)}%`;
  const lines = (h) => (h.lines.length ? h.lines.join(' ') : 'none');

  function confetti() {
    const wrap = document.createElement('div'); wrap.className = 'confetti';
    const bits = ['💚', '✨', '🏠', '💛', '🎉'];
    for (let i = 0; i < 26; i++) {
      const s = document.createElement('span');
      s.textContent = bits[i % bits.length];
      s.style.left = Math.random() * 100 + '%'; s.style.animationDelay = Math.random() * 0.6 + 's'; s.style.fontSize = 16 + Math.random() * 18 + 'px';
      wrap.appendChild(s);
    }
    app.appendChild(wrap); setTimeout(() => wrap.remove(), 3000);
  }

  // ------------------------------------------------------------------ welcome
  function showWelcome() {
    S = null; setTop(null);
    const hasSaved = !!U.name;
    screen(`
      <div class="hero">
        <h1>Swipe right<br>on <em>NYC</em></h1>
        <p>42 neighborhoods, one dating profile each. Funny, flirty, and backed by real NYC Open Data.</p>
        <div class="pill-row"><span class="pill">Real rat counts</span><span class="pill">Real air quality</span><span class="pill">Real commutes</span><span class="pill">Real rent</span></div>
        <div class="stack">
          <button class="btn block" data-act="start">${hasSaved ? 'Edit my profile' : 'Create my profile'} →</button>
          ${hasSaved ? `<button class="btn alt block" data-act="quick">Skip ahead as ${esc(U.name)}</button>` : ''}
        </div>
        <p class="note">Takes about a minute. No account, no tracking, nothing leaves your phone.</p>
      </div>`);
  }

  // ------------------------------------------------------------------ onboarding
  const VIBE_OPTS = [
    ['🛋️', 'Couch, quiet, door locked', 'Sleep is my hobby.'],
    ['🌳', 'A park and an early dinner', 'Home by sunset, thank you.'],
    ['🍷', 'Dinner out, home by 11', 'A little action, mostly comfort.'],
    ['🎶', 'Live music, late dinner', 'I like my street awake.'],
    ['🔥', 'Out until sunrise', 'Quiet is for other people.'],
  ];
  const BUDGET_OPTS = {
    low: ['🪙', 'Scrappy', 'I\'ll trade space and finishes for savings.'],
    mid: ['🏷️', 'Comfortable', 'A fair price for a fair neighborhood.'],
    high: ['💎', 'Treat-yourself', 'Rent is a love language.'],
  };
  const SRC_TAG = { rent: 'Zillow ZORI', commute: 'MTA GTFS', transit: 'MTA Stop Density', safety: 'NYPD CompStat', green: 'NYC Parks', food: 'DOHMH Restaurant Reg', density: 'Census ZCTA', air: 'DOHMH Community Air', rats: 'DOHMH Rodent Index' };

  function scale(key, label, hint) {
    const v = U.imp[key];
    return `<div class="field" data-scale="${key}">
      <div class="field-label"><span>${label}</span><small class="src-pill">${SRC_TAG[key] || ''}</small></div>
      <div class="scale" role="group" aria-label="${esc(label)}">${[1, 2, 3, 4, 5].map((n) => `<button data-imp="${key}" data-v="${n}" aria-pressed="${v === n}" aria-label="${n} of 5">${n}</button>`).join('')}</div>
      <div class=\"scale-cap\"><span>Whatever</span><span>Dealbreaker</span></div>
      <div class="scale-say" aria-live="polite">${IMP_LABEL[v - 1]}${hint ? ' · ' + hint : ''}</div>
    </div>`;
  }

  const STEPS = [
    {
      kicker: 'Hi there', title: 'What should neighborhoods call you?', sub: 'A first name or a flirty alias. They\'re judgy, but they\'ll cope.',
      body: () => `<div class="field"><label class="field-label" for="name">Your name</label><input id="name" class="text-in" maxlength="20" autocomplete="given-name" placeholder="e.g. Sam" value="${esc(U.name)}"></div>`,
      valid: () => true, // default: "Mystery Renter"
    },
    {
      kicker: 'The vibe', title: 'Pick your ideal Saturday night.', sub: 'This sets how packed and buzzing you want your street to be.',
      body: () => `<div class="opts" role="group" aria-label="Saturday night">${VIBE_OPTS.map((o, i) => `<button class="opt" data-vibe="${i}" aria-pressed="${U.vibe === i}"><span class="em">${o[0]}</span><div><b>${o[1]}</b><span>${o[2]}</span></div></button>`).join('')}</div>
        ${scale('density', 'How much does the crowd level matter?')}
        ${scale('food', 'How much do restaurants and bars nearby matter?')}`,
    },
    {
      kicker: 'The money talk', title: 'What\'s your rent energy?', sub: 'We compare typical rents across all 42 areas (Zillow\'s rent index, not a quote and not just 1BRs).',
      body: () => `<div class="opts" role="group" aria-label="Budget">${Object.entries(BUDGET_OPTS).map(([k, o]) => `<button class="opt" data-budget="${k}" aria-pressed="${U.budget === k}"><span class="em">${o[0]}</span><div><b>${o[1]}</b><span>${o[2]}</span></div></button>`).join('')}</div>
        ${scale('rent', 'How much does affordability matter?')}`,
    },
    {
      kicker: 'Getting around', title: 'Where do you work?', sub: 'We estimate subway time from each area to your work area. Pick the closest one.',
      body: () => `<div class="field"><div class="field-label"><span>Work area</span></div><div class="chips" role="group" aria-label="Work area">${Object.entries(META.work_areas).map(([c, n]) => `<button class="chip-btn" data-work="${c}" aria-pressed="${U.work === c}">${esc(n)}</button>`).join('')}<button class="chip-btn" data-work="remote" aria-pressed="${U.work === 'remote'}">WFH / Anywhere in NYC</button></div></div>
        <div id="commute-scale">${U.work === 'remote' ? '<p class="note">Commute is off, since you work from home.</p>' : scale('commute', 'How much does a short commute matter?')}</div>
        ${scale('transit', 'How much does having subway stations nearby matter?')}`,
    },
    {
      kicker: 'Safe and green', title: 'Streets and trees.', sub: 'Safety uses felony complaint rates per resident. Green space is park acres per resident.',
      body: () => `${scale('safety', 'How much does safety matter?')}${scale('green', 'How much does green space matter?')}
        <p class="note">Rates divide by residents, so business districts with few residents can look worse than they feel.</p>`,
    },
    {
      kicker: 'Last one', title: 'The unsexy stuff.', sub: 'The part landlords never mention.',
      body: () => `${scale('air', 'How much does clean air matter?', 'PM2.5')}${scale('rats', 'How much does rat activity matter?', 'inspections')}`,
    },
  ];

  function showStep(i) {
    step = i; S = null;
    const s = STEPS[i];
    setTop({ back: true, right: `<span class="supers">${i + 1}/${STEPS.length}</span>` });
    screen(`
      <div class="progress" aria-hidden="true" style="padding:0 0 10px">${STEPS.map((_, k) => `<i class="${k < i ? 'done' : k === i ? 'cur' : ''}"></i>`).join('')}</div>
      <div class="q-kicker">${s.kicker}</div>
      <h2 class="q-title">${s.title}</h2>
      <p class="q-sub">${s.sub}</p>
      ${s.body()}
      <div class="q-actions"><button class="btn block" data-act="next">${i === STEPS.length - 1 ? 'Build my profile' : 'Next →'}</button></div>`);
    const inp = $('#name'); if (inp) setTimeout(() => inp.focus(), 100);
  }

  function setImp(key, v) {
    U.imp[key] = v;
    const box = $(`[data-scale="${key}"]`);
    if (!box) return;
    $$('button', box).forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.v) === v)));
    const say = $('.scale-say', box); say.textContent = say.textContent.replace(/^[^·]+/, IMP_LABEL[v - 1] + (say.textContent.includes('·') ? ' ' : ''));
  }

  // ------------------------------------------------------------------ loading + preview
  async function showLoading() {
    U.name = (U.name || '').trim() || 'Mystery Renter';
    save(); setTop(null);
    const msgs = ['Reading a year of rat inspections', 'Checking the air quality data', 'Counting 20,000 restaurants', 'Riding every subway line', 'Asking landlords for comment (they ghosted)'];
    screen(`<div class="loading"><h2 class="q-title">Matchmaking for ${esc(U.name)}…</h2><div class="checks">${msgs.map((m, i) => `<div style="animation-delay:${i * 0.45}s">✅ ${m}</div>`).join('')}</div></div>`);
    await wait(msgs.length * 450 + 500);
    showPreview();
  }

  function listFactors(pred) {
    return ORDER.filter((f) => !(f === 'commute' && U.work === 'remote') && pred(U.imp[f])).sort((a, b) => U.imp[b] - U.imp[a]);
  }
  const tagsFor = (fs, cls) => (fs.length ? fs.map((f) => `<span class="tag ${cls}">${FACTORS[f].emoji} ${FACTORS[f].label}</span>`).join('') : '<span class="tag">Nothing. So chill.</span>');

  function showPreview() {
    S = null; setTop({ back: true });
    const must = listFactors((v) => v >= 4), chill = listFactors((v) => v <= 2), dealb = listFactors((v) => v === 5);
    screen(`
      <div class="q-kicker">Looking good</div>
      <h2 class="q-title">Here\'s your profile.</h2>
      <p class="q-sub">This is what neighborhoods see before they decide whether you\'re their type.</p>
      <div class="live-banner">✔ Live Profile: 9/9 preferences ready to calibrate</div>
      <article class="me-card">
        <div class="me-photo" aria-hidden="true"><span class="ini">${esc((U.name || "?").charAt(0).toUpperCase())}</span><b>${esc(U.name)}</b></div>
        <div class="me-body">
          <div class="prompt"><small>My ideal Saturday night</small><p>${esc(VIBE_OPTS[U.vibe][1])}</p></div>
          <div class="prompt"><small>My rent energy</small><p>${BUDGET_OPTS[U.budget][1]}</p></div>
          <div class="prompt"><small>I commute to</small><p>${U.work === 'remote' ? 'Nowhere. I work in pajamas.' : esc(META.work_areas[U.work])}</p></div>
          <div><small class="field-label" style="margin-bottom:6px">Must-haves</small><div class="tagrow">${tagsFor(must, 'green')}</div></div>
          <div><small class="field-label" style="margin-bottom:6px">Dealbreakers</small><div class="tagrow">${tagsFor(dealb, 'red')}</div></div>
          <div><small class="field-label" style="margin-bottom:6px">Chill about</small><div class="tagrow">${tagsFor(chill, '')}</div></div>
        </div>
      </article>
      <div class="q-actions" style="margin-top:0"><button class="btn mint block" data-act="deck">Meet my matches →</button><button class="btn alt block" data-act="edit">Edit my answers</button></div>`);
  }

  // ------------------------------------------------------------------ deck
  function startDeck() {
    const { deck, scores } = L.buildDeck(U);
    S = { deck, scores, idx: 0, supers: L.SUPERS, results: {}, reconsidered: new Set(), busy: false, photo: {} };
    renderDeck();
  }

  function topFactorsFor(code, k = 4) {
    const sc = S.scores[code].parts;
    return ORDER.filter((f) => L.weightOf(f, U) > 0 && sc[f] != null)
      .sort((a, b) => L.weightOf(b, U) - L.weightOf(a, U) || ORDER.indexOf(a) - ORDER.indexOf(b)).slice(0, k);
  }

  function chipHTML(f, code) {
    const h = BY[code], s = S.scores[code].parts[f];
    const cls = s == null ? 'na' : s >= 65 ? 'good' : s < 40 ? 'bad' : '';
    return `<button class="stat ${cls}" data-stat="${f}" data-code="${code}" aria-label="${FACTORS[f].label}: ${esc(L.rawValue(f, h, U))}. Tap for source.">${FACTORS[f].emoji} ${esc(L.rawValue(f, h, U))}</button>`;
  }

  function cardHTML(code, depth) {
    const h = BY[code], p = PROF[code], total = S.scores[code].total;
    const cls = depth === 0 ? '' : depth === 1 ? 'behind' : 'behind2';
    S.photo[code] = S.photo[code] || 0;
    return `<article class="card ${cls}" data-code="${code}" aria-label="${esc(p.d)}">
      <div class="photo">
        <div class="slide" data-slide>${photo(code, S.photo[code])}</div>
        <div class="bars" aria-hidden="true">${[0, 1, 2].map((i) => `<i class="${i === S.photo[code] ? 'on' : ''}"></i>`).join('')}</div>
        <div class="tapz l" data-tap="-1"></div><div class="tapz r" data-tap="1"></div>
        <div class="shade"></div>
        <div class="loc-pill">📍 ${esc(h.borough.toUpperCase())} · ${esc(h.code)}</div>
        <div class="match-pill" title="Compatibility with your profile">${total}% MATCH</div>
        ${total >= L.TOP_PICK_AT ? '<div class="toppick">★ Top pick for you</div>' : ''}
        <div class="stamp like">LIKE</div><div class="stamp nope">NOPE</div><div class="stamp sup">SUPER</div>
        <div class="swipe-hints" aria-hidden="true"><span class="l">← Swipe Left to Pass</span><span class="r">Swipe Right to Like →</span></div>
      </div>
      <div class="under">
        <div class="name-row"><h2>${esc(p.d)}<i class="dot" title="Verified by open data"></i></h2><span class="age">Age: ${p.age}</span></div>
        <p class="tagline">“${esc(p.tag)}”</p>
        <div class="stat-chips">${topFactorsFor(code).map((f) => chipHTML(f, code)).join('')}</div>
        <div class="flagchips"><span class="fc good">✔ ${esc(L.fill(p.green, h))}</span><span class="fc bad">✕ ${esc(L.fill(p.red, h))}</span></div>
      </div>
    </article>`;
  }

  function renderDeck() {
    setTop({ back: true, right: `<span class="supers" title="Super Likes left">★ ${S.supers}</span>` });
    setTabs('swipe');
    const rest = S.deck.slice(S.idx, S.idx + 3);
    stage.innerHTML = `<div class="deck-area" id="deck">${rest.map((c, i) => cardHTML(c, i)).reverse().join('')}</div>
      <div class="actions">
        <button class="act undo" data-act="undo" aria-label="Undo last swipe" ${S.idx ? '' : 'disabled'}>↺</button>
        <button class="act no" data-act="nope" aria-label="Pass (left arrow)">✕</button>
        <button class="act sup" data-act="super" aria-label="Super like (up arrow)" ${S.supers ? '' : 'disabled'}>★</button>
        <button class="act info" data-act="info" aria-label="Full profile">ⓘ</button>
        <button class="act yes" data-act="like" aria-label="Like (right arrow)">♥</button>
      </div>
      <div class="hint">${S.idx + 1} of ${S.deck.length} · drag the card, tap the photo, or use the buttons</div>`;
    const top = $('#deck .card:last-child');
    if (top) attachDrag(top);
  }

  function attachDrag(card) {
    let sx = 0, sy = 0, dx = 0, dy = 0, down = false, moved = false, captured = false, pid = 0;
    const like = $('.stamp.like', card), nope = $('.stamp.nope', card), sup = $('.stamp.sup', card);
    const clamp01 = (x) => Math.max(0, Math.min(1, x));
    card.addEventListener('pointerdown', (e) => {
      if (S.busy || (e.target.closest('button') && !e.target.closest('.tapz'))) return;
      down = true; moved = false; captured = false; pid = e.pointerId; sx = e.clientX; sy = e.clientY; dx = dy = 0;
      card.classList.remove('snap');
    });
    card.addEventListener('pointermove', (e) => {
      if (!down) return;
      dx = e.clientX - sx; dy = e.clientY - sy;
      if (Math.abs(dx) + Math.abs(dy) > 8) moved = true;
      if (moved && !captured) { captured = true; card.setPointerCapture(pid); } // capture only once it's a drag, so taps still reach the photo zones
      card.style.transform = `translate(${dx}px, ${dy}px) rotate(${dx / 18}deg)`;
      like.style.opacity = clamp01(dx / 90); nope.style.opacity = clamp01(-dx / 90);
      sup.style.opacity = Math.abs(dx) < 60 ? clamp01(-dy / 90) : 0;
    });
    const end = () => {
      if (!down) return; down = false;
      if (dx > 110) fly(card, 'like');
      else if (dx < -110) fly(card, 'nope');
      else if (dy < -110 && Math.abs(dx) < 80) fly(card, 'super');
      else { card.classList.add('snap'); card.style.transform = ''; like.style.opacity = nope.style.opacity = sup.style.opacity = 0; }
    };
    card.addEventListener('pointerup', end); card.addEventListener('pointercancel', end);
    // swallow the click that follows a drag
    card.addEventListener('click', (e) => { if (moved) { e.stopPropagation(); e.preventDefault(); moved = false; } }, true);
  }

  function fly(card, dir) {
    if (S.busy) return;
    if (dir === 'super' && S.supers < 1) { toast('No Super Likes left ⭐'); card.classList.add('snap'); card.style.transform = ''; return; }
    S.busy = true;
    const stamp = $(dir === 'like' ? '.stamp.like' : dir === 'nope' ? '.stamp.nope' : '.stamp.sup', card);
    if (stamp) stamp.style.opacity = 1;
    card.classList.add('fly');
    card.style.transform = dir === 'like' ? 'translate(520px,-40px) rotate(24deg)' : dir === 'nope' ? 'translate(-520px,-40px) rotate(-24deg)' : 'translate(0,-640px) rotate(0deg)';
    setTimeout(() => onSwipe(card.dataset.code, dir), 360);
  }

  function swipeButton(dir) {
    if (!S || S.busy || !$('#deck')) return;
    const card = $('#deck .card:last-child'); if (card) fly(card, dir);
  }

  // ------------------------------------------------------------------ the two-way match
  function onSwipe(code, dir) {
    const total = S.scores[code].total, accepts = total >= L.MATCH_AT;
    if (dir === 'nope') {
      if (accepts && !S.reconsidered.has(code)) return openRegret(code);
      S.results[code] = { dir, accepted: accepts, total };
      return advance();
    }
    if (dir === 'super') S.supers -= 1;
    if (accepts) {
      S.results[code] = { dir, accepted: true, total, sup: dir === 'super' };
      return openMatch(code, dir === 'super');
    }
    if (dir === 'super') S.supers += 1; // returned, they said no
    S.results[code] = { dir, accepted: false, total };
    return openReject(code, dir === 'super');
  }

  function undoSwipe() {
    if (!S || S.busy || S.idx === 0) return toast('Nothing to undo');
    const prev = S.deck[S.idx - 1], r = S.results[prev];
    if (r && r.dir === 'super' && r.accepted) S.supers += 1; // the Super Like comes back
    delete S.results[prev]; S.reconsidered.delete(prev);
    S.idx -= 1; renderDeck(); toast('Undid ' + PROF[prev].d + ' ↺');
  }

  function advance() {
    S.idx += 1; S.busy = false;
    if (S.idx >= S.deck.length) return showResults();
    renderDeck();
  }

  // ------------------------------------------------------------------ sheets
  function openSheet(html, mode, full = false) {
    sheetMode = mode;
    sheet.className = 'sheet' + (full ? ' full' : '');
    sheet.innerHTML = `<div class="grab"></div><button class="sheet-x" data-act="sheet-x" aria-label="Close">✕</button>${html}`;
    sheetWrap.hidden = false; sheet.scrollTop = 0; sheet.setAttribute('tabindex', '-1'); sheet.focus({ preventScroll: true });
  }
  function closeSheet() { sheetWrap.hidden = true; sheet.innerHTML = ''; sheetMode = null; hidePop(); }

  function barsHTML(code) {
    const sc = S ? S.scores[code] : { parts: L.score(BY[code], U).parts };
    const rows = ORDER.filter((f) => sc.parts[f] != null && L.weightOf(f, U) > 0).sort((a, b) => L.weightOf(b, U) - L.weightOf(a, U));
    return `<div class="bars-row">${rows.map((f) => `<div class="br"><span>${FACTORS[f].emoji} ${FACTORS[f].label}</span><div class="t"><i class="${sc.parts[f] < 40 ? 'low' : ''}" style="width:${Math.round(sc.parts[f])}%"></i></div><span>${Math.round(sc.parts[f])}</span></div>`).join('')}</div>`;
  }

  function dsLabel(f) {
    if (f === 'rent') return 'zillow-zori';
    if (f === 'commute' || f === 'transit') return 'mta-gtfs';
    return META.sources[FACTORS[f].src].dataset;
  }

  function statGrid(code) {
    const h = BY[code], parts = (S ? S.scores[code] : L.score(h, U)).parts;
    return `<div class="statgrid">${ORDER.filter((f) => !(f === 'commute' && U.work === 'remote')).map((f) => {
      const s = parts[f], cls = s == null ? '' : s >= 65 ? 'good' : s < 40 ? 'bad' : '';
      return `<button class="sg ${cls}" data-stat="${f}" data-code="${code}"><div class="k">${FACTORS[f].emoji} ${FACTORS[f].label}</div><div class="v">${esc(L.rawValue(f, h, U))}</div><div class="r">${esc(L.rankLabel(f, h) || (f === 'commute' ? 'est. by subway' : 'no data'))}</div><code class="ds">${esc(dsLabel(f))}</code></button>`;
    }).join('')}</div>`;
  }

  function profileBody(code, match) {
    const h = BY[code], p = PROF[code], fill = (s) => esc(L.fill(s, h));
    const total = (S ? S.scores[code] : L.score(h, U)).total;
    const why = L.whyYes(h, U, 3);
    return `<div class="sheet-hero">${photo(code, 0)}</div>
      <div class="sheet-body">
        ${match ? `<div class="result" style="padding:0"><div class="big" aria-hidden="true">💘</div><h2 class="match">It\'s a match!</h2><p class="who">${esc(U.name)} + ${esc(p.d)}</p><span class="big-score">${total}% compatible</span></div>` : ''}
        <div><h2>${esc(p.d)}, ${p.age}</h2><p class="tagline" style="margin-top:6px">${esc(p.tag)}</p><p class="note" style="text-align:left;margin-top:6px">Looking for: ${esc(p.look)}</p></div>
        <div><h3>About me</h3><p class="bio" style="margin-top:6px">${fill(p.bio)}</p></div>
        ${p.pr.map(([q, a]) => `<div class="qa"><small>${esc(q)}</small><p>${fill(a)}</p></div>`).join('')}
        <div class="flags"><div class="flag red"><span>✕</span><span>${fill(p.red)}</span></div><div class="flag green"><span>✔</span><span>${fill(p.green)}</span></div></div>
        ${match && why.length ? `<div><h3>Why we click</h3><ul class="why" style="margin-top:8px">${why.map((w) => `<li>${esc(w.text)}</li>`).join('')}</ul></div>` : ''}
        <div><h3>How we score for you</h3><div style="margin-top:8px">${barsHTML(code)}</div></div>
        <div><h3>By the numbers <span style="text-transform:none;letter-spacing:0">(tap for source)</span></h3><div style="margin-top:8px">${statGrid(code)}</div></div>
        <div class="story"><h3>${esc(p.story[0])}</h3><p>${fill(p.story[1])}</p><p class="check">Quirky-story facts are still being fact-checked.</p></div>
        ${match ? startLooking(code) : ''}
        ${p.credit ? `<p class="note">Photo: ${esc(p.credit)}</p>` : ''}
        <div class="guarantee">🛡️ Civic Open Data Guarantee. Values shown are cited or left blank. Not affiliated with the MTA, HPD, or real estate syndicates.</div>
      </div>`;
  }

  function startLooking(code) {
    const h = BY[code], p = PROF[code], t = L.tokens(h);
    const q = encodeURIComponent(`apartments for rent ${p.q}`);
    const near = h.lines.length ? `Start near the <b>${esc(lines(h))}</b> (${h.stations} station${h.stations === 1 ? '' : 's'}).` : 'This area has no subway station. Look near buses, rail or the ferry.';
    const rent = h.rent_typical == null ? 'We have no rent data for this area.' : `Typical rent here is <b>${t.rent}</b> (Zillow rent index, a median across ${h.rent_zip_count} of ${h.zips.length} ZIPs, not a quote).`;
    return `<div class="story" style="background:linear-gradient(135deg,#dcfbef,#e2f5ff)"><h3>🔑 Where to start looking</h3>
      <p>${near} ${rent}</p><p style="margin-top:6px">ZIPs to search: <b>${h.zips.join(', ')}</b></p>
      <div class="links" style="margin-top:12px">
        <a class="a-btn" href="https://www.google.com/search?q=${q}" target="_blank" rel="noopener">Search listings in ${esc(p.q.replace(/ (Brooklyn|Bronx|Queens|Manhattan|Staten Island)$/, ''))} <span>↗</span></a>
        <a class="a-btn" href="https://streeteasy.com/" target="_blank" rel="noopener">StreetEasy <span>↗</span></a>
        <a class="a-btn" href="https://hpdonline.nyc.gov/hpdonline/" target="_blank" rel="noopener">Check a building's violations (HPD) <span>↗</span></a>
      </div><p class="check">Before you sign: look up the building. Landlords won't volunteer its record.</p></div>`;
  }

  function openProfile(code) { openSheet(`${profileBody(code, false)}<div class="sheet-cta row"><button class="btn alt" data-act="sheet-pass">✕ PASS</button><button class="btn mint" data-act="sheet-like">LIKE MATCH ♥</button></div>`, 'profile', true); }

  function openMatch(code, sup) {
    const p = PROF[code];
    openSheet(`${profileBody(code, true)}${sup ? '<p class="note" style="margin-top:6px">⭐ Super Match! Yours is ranked first on the results screen.</p>' : ''}<div class="sheet-cta"><button class="btn block" data-act="chat" data-code="${code}" data-from="match">Chat with ${esc(p.d)}</button><button class="btn mint block" data-act="match-next">${S.idx + 1 >= S.deck.length ? 'See all my matches' : 'Keep swiping →'}</button></div>`, 'match', true);
    $('.sheet-hero', sheet).insertAdjacentHTML('beforeend', `<div style="position:absolute;left:0;right:0;bottom:0;height:60px;background:linear-gradient(transparent,var(--paper))"></div>`);
    void p;
  }

  function openReject(code, sup) {
    const h = BY[code], p = PROF[code], total = S.scores[code].total, why = L.whyNo(h, U, 3);
    openSheet(`<div class="result"><div class="big" aria-hidden="true">💔</div><h2>It\'s not you, it\'s me.</h2><p class="who">${esc(p.d)} swiped left on ${esc(U.name)}</p>
      <p class="line">${esc(p.rej)}</p>
      ${why.length ? `<div class="why"><h3 style="text-align:left;font-size:13px;letter-spacing:.1em;text-transform:uppercase;color:var(--ink-3)">Here\'s why</h3>${why.map((w) => `<li>${esc(w.text)}</li>`).join('')}</div>` : '<p class="line">No big dealbreaker. Just not enough sparks.</p>'}
      <span class="big-score">${total}% compatible</span><p class="note">${esc(p.d)} says yes at ${L.MATCH_AT}% or more.${sup ? ' Your Super Like was returned ⭐' : ''}</p></div>
      <div class="sheet-cta"><button class="btn block" data-act="rej-next">Ouch. Next →</button></div>`, 'reject');
  }

  function openRegret(code) {
    const h = BY[code], p = PROF[code], total = S.scores[code].total, why = L.whyYes(h, U, 3);
    openSheet(`<div class="result"><div class="big" aria-hidden="true">🥺</div><h2>Wait… are you sure?</h2><p class="who">${esc(p.d)} was ready to say yes to ${esc(U.name)}</p>
      <p class="line">${esc(p.reg)}</p>
      ${why.length ? `<div class="why"><h3 style="text-align:left;font-size:13px;letter-spacing:.1em;text-transform:uppercase;color:var(--ink-3)">Why we might actually work</h3>${why.map((w) => `<li>${esc(w.text)}</li>`).join('')}</div>` : ''}
      <span class="big-score">${total}% compatible</span></div>
      <div class="sheet-cta"><button class="btn mint block" data-act="reconsider" data-code="${code}">Okay, actually yes</button><button class="btn alt block" data-act="keepno" data-code="${code}">Still no</button></div>`, 'regret');
  }

  // ------------------------------------------------------------------ chat with a match
  const CHAT = window.NYC_CHAT;
  const CHAT_KEY = 'swiperight-nyc.chats.v1';   // { [uhf code]: { ts, msgs: [{ role: 'user'|'model', text }] } }
  let chats = {};
  try { chats = JSON.parse(localStorage.getItem(CHAT_KEY) || '{}') || {}; } catch (e) { /* private mode */ }
  const saveChats = () => { try { localStorage.setItem(CHAT_KEY, JSON.stringify(chats)); } catch (e) { /* ignore */ } };
  let chatCode = null, chatFrom = null, chatHist = [], chatBusy = false;

  function bubble(role, text) { return `<div class="msg ${role}">${esc(text)}</div>`; }
  function openChat(code, from) {
    const p = PROF[code], total = (S ? S.scores[code] : L.score(BY[code], U)).total;
    chatCode = code; chatFrom = from;
    chatHist = (chats[code] || { msgs: [] }).msgs;
    openSheet(`<div class="chat-head"><div class="th">${ART.sceneSVG(code, p)}</div><div><b>${esc(p.d)}</b><span>${total}% compatible · AI playing a neighborhood</span></div><button class="btn alt" data-act="chat-back">Back</button></div>
      <div class="chat-log" id="chat-log" aria-live="polite"><div class="chat-summary"><h3>You &amp; ${esc(p.d)} Matched!</h3><p>Ask about rent, rats, transit or what it's really like before you sign a lease.</p><div class="stats3"><div><small>TYPICAL RENT</small><b>${esc(L.rawValue('rent', BY[code]).replace('/mo', ''))}</b></div><div><small>${U.work === 'remote' ? 'SUBWAY STATIONS' : 'TO WORK'}</small><b>${U.work === 'remote' ? BY[code].stations : esc(L.rawValue('commute', BY[code], U))}</b></div><div><small>RAT SIGNS</small><b>${BY[code].rat_active_pct == null ? '—' : BY[code].rat_active_pct.toFixed(0) + '%'}</b></div></div></div>${bubble('them', `Hey ${U.name}. ${p.tag}`)}${chatHist.map((m) => bubble(m.role === 'model' ? 'them' : 'me', m.text)).join('')}</div>
      <div class="qchips"><button data-q="Best coffee spot?">☕ Coffee</button><button data-q="What's the typical rent?">💵 Avg Rent</button><button data-q="How is the commute?">🚇 Commute</button><button data-q="Any rat problems?">🐀 Rats</button></div>
      <form class="chat-form" id="chat-form"><input id="chat-in" autocomplete="off" maxlength="300" placeholder="Say something to ${esc(p.d)}…" aria-label="Message"><button class="btn mint" type="submit">Send</button></form>`, 'chat', true);
    $('#chat-form').addEventListener('submit', (e) => { e.preventDefault(); sendChat(); });
    const log = $('#chat-log'); log.scrollTop = log.scrollHeight;
    $('#chat-in').focus({ preventScroll: true });
  }
  async function sendChat() {
    const input = $('#chat-in'), log = $('#chat-log'), text = input.value.trim();
    if (!text || chatBusy) return;
    const code = chatCode, total = (S ? S.scores[code] : L.score(BY[code], U)).total;
    input.value = ''; chatBusy = true;
    chatHist.push({ role: 'user', text });
    chats[code] = { ts: Date.now(), msgs: chatHist }; saveChats();
    log.insertAdjacentHTML('beforeend', bubble('me', text) + '<div class="msg them typing" id="typing">…</div>');
    log.scrollTop = log.scrollHeight;
    try {
      const reply = await CHAT.send(code, U, total, chatHist);
      chatHist.push({ role: 'model', text: reply });
      chats[code].ts = Date.now(); saveChats();
      if (chatCode === code && $('#typing')) $('#typing').outerHTML = bubble('them', reply);
    } catch (err) {
      chatHist.pop(); if (!chatHist.length) delete chats[code]; saveChats();
      if ($('#typing')) $('#typing').outerHTML = `<div class="msg err">${esc(err.message)}</div>`;
    }
    chatBusy = false;
    const l = $('#chat-log'); if (l) l.scrollTop = l.scrollHeight;
  }

  // ------------------------------------------------------------------ tabs: Swipe / Matches / Chats
  function showChats() {
    closeSheet(); setTop({ back: false });
    const codes = Object.keys(chats).filter((c) => PROF[c] && chats[c].msgs.length).sort((a, b) => chats[b].ts - chats[a].ts);
    const row = (c) => {
      const p = PROF[c], last = chats[c].msgs[chats[c].msgs.length - 1];
      return `<button class="match-row" data-act="chat" data-code="${c}" data-from="view"><div class="th">${ART.sceneSVG(c, p)}</div><div><b>${esc(p.d)}</b><span>${last.role === 'user' ? 'You: ' : ''}${esc(last.text)}</span></div><div class="pc">💬</div></button>`;
    };
    screen(`<div class="res-hero"><div class="logo" aria-hidden="true">💬</div><h1>Messages</h1></div>
      ${codes.length ? `<div class="stack" style="margin-top:12px">${codes.map(row).join('')}</div>`
        : '<p class="q-sub" style="text-align:center;margin-top:16px">No chats yet. Match with a neighborhood, tap “Chat”, and your conversations are saved here.</p>'}`);
    setTabs('chats');
  }
  function showMatchesTab() {
    if (S && S.idx >= S.deck.length) { showResults(); return setTabs('matches'); }
    const r = S ? S.results : {};
    const matches = Object.keys(r).filter((c) => r[c].accepted && r[c].dir !== 'nope')
      .sort((a, b) => (r[b].sup ? 1 : 0) - (r[a].sup ? 1 : 0) || r[b].total - r[a].total);
    closeSheet(); setTop({ back: false });
    screen(`<div class="res-hero"><div class="logo" aria-hidden="true">💚</div><h1>Matches</h1></div>
      ${matches.length ? `<div class="stack" style="margin-top:12px">${matches.map((c) => { const p = PROF[c]; return `<button class="match-row" data-act="view" data-code="${c}"><div class="th">${ART.sceneSVG(c, p)}</div><div><b>${esc(p.d)}${r[c].sup ? '<span class="badge">⭐ Super</span>' : ''}</b><span>${esc(p.tag)}</span></div><div class="pc">${r[c].total}%</div></button>`; }).join('')}</div>`
        : '<p class="q-sub" style="text-align:center;margin-top:16px">No matches yet. Keep swiping.</p>'}`);
    setTabs('matches');
  }
  function goTab(tab) {
    if (tab === 'chats') return showChats();
    if (tab === 'matches') return showMatchesTab();
    if (S && S.idx < S.deck.length) return renderDeck();
    startDeck();
  }

  // ------------------------------------------------------------------ results
  function showResults() {
    closeSheet(); setTop({ back: false });
    $$('.confetti').forEach((c) => c.remove());
    const r = S.results;
    const matches = Object.keys(r).filter((c) => r[c].accepted && r[c].dir !== 'nope')
      .sort((a, b) => (r[b].sup ? 1 : 0) - (r[a].sup ? 1 : 0) || r[b].total - r[a].total);
    const rejected = Object.keys(r).filter((c) => !r[c].accepted && r[c].dir !== 'nope');
    const gotAway = Object.keys(r).filter((c) => r[c].accepted && r[c].dir === 'nope');
    if (!matches.length) {
      screen(`<div class="single"><div class="big" aria-hidden="true">🥲</div><h1 class="q-title" style="font-size:38px">Still single in NYC.</h1>
        <p class="q-sub">${rejected.length ? `${rejected.length} neighborhood${rejected.length === 1 ? '' : 's'} said no, and ` : ''}you passed on the rest. The rent is still too high, the rats are still doing great, and the subway is delayed.</p>
        <p class="q-sub"><b>Tip:</b> loosen one dealbreaker and try again. Even Park Slope compromised on strollers once.</p>
        <div class="stack"><button class="btn block" data-act="again">Swipe again</button><button class="btn alt block" data-act="edit">Change my answers</button></div></div>`);
      return;
    }
    const row = (c, top) => { const p = PROF[c]; return `<button class="match-row ${top ? 'top' : ''}" data-act="view" data-code="${c}"><div class="th">${ART.sceneSVG(c, p)}</div><div><b>${esc(p.d)}${r[c].sup ? '<span class="badge">⭐ Super</span>' : ''}</b><span>${esc(p.tag)}</span></div><div class="pc">${r[c].total}%</div></button>`; };
    screen(`<div class="res-hero"><h1>${matches.length === 1 ? 'One match.' : matches.length + ' matches.'}</h1><p class="q-sub" style="margin:0">${esc(U.name)}, your best fit is <b>${esc(PROF[matches[0]].d)}</b> at ${r[matches[0]].total}%.</p></div>
      <div class="stack" style="margin-top:12px">${matches.map((c, i) => row(c, i === 0)).join('')}</div>
      ${rejected.length ? `<h3 class="field-label" style="margin:20px 0 8px">They ghosted you</h3><div class="tagrow">${rejected.map((c) => `<span class="tag red">${esc(PROF[c].d)} · ${r[c].total}%</span>`).join('')}</div>` : ''}
      ${gotAway.length ? `<h3 class="field-label" style="margin:16px 0 8px">The ones that got away</h3><div class="tagrow">${gotAway.map((c) => `<span class="tag">${esc(PROF[c].d)} · ${r[c].total}%</span>`).join('')}</div>` : ''}
      <div class="q-actions"><button class="btn block" data-act="again">Restart</button><button class="btn alt block" data-act="edit">Change my answers</button></div>`);
    setTabs('matches');
  }

  // ------------------------------------------------------------------ sources + popovers
  function openSources() {
    const src = Object.values(META.sources);
    openSheet(`<div class="sheet-body" style="padding-top:34px"><h2>Data sources</h2>
      <p class="bio">Everything is pulled once from public data and saved in this page. Nothing is fetched while you swipe. Pulled <b>${META.data_pulled_at}</b>.</p>
      ${src.map((s) => `<div class="qa"><small>${esc(s.dataset)}</small><p style="font-size:15px">${esc(s.label)}</p><p class="note" style="text-align:left;margin-top:4px">${esc(s.note)}</p></div>`).join('')}
      <div class="qa"><small>Windows</small><p style="font-size:14px;line-height:1.5">${Object.entries(META.windows).map(([k, v]) => `<b>${esc(k)}</b>: ${esc(v)}`).join('<br>')}</p></div>
      <div class="qa"><small>How commute is estimated</small><p style="font-size:14px;font-weight:600;line-height:1.5">${esc(META.commute_method)}</p></div>
      <p class="note">Neighborhoods are the 42 United Hospital Fund (UHF) areas used by NYC Health. Ranks compare these 42 areas only. ${META.nulls.length} values are missing and shown as "—", never guessed. Profile jokes are not data.</p></div>
      <div class="sheet-cta"><button class="btn block" data-act="sheet-x">Close</button></div>`, 'sources', true);
  }

  function showPop(target, f, code) {
    const d = L.describe(f, BY[code], U);
    pop.innerHTML = `<b>${esc(d.title)}</b>${esc(d.what)}${d.rank ? `<small>Rank: ${esc(d.rank)}</small>` : ''}<small>Source: ${esc(d.source)}</small><small>${esc(d.note || '')}</small>`;
    pop.hidden = false;
    const a = app.getBoundingClientRect(), r = target.getBoundingClientRect(), pw = pop.offsetWidth, ph = pop.offsetHeight;
    let left = r.left - a.left + r.width / 2 - pw / 2; left = Math.max(10, Math.min(a.width - pw - 10, left));
    let top = r.bottom - a.top + 8; if (top + ph > a.height - 10) top = r.top - a.top - ph - 8;
    pop.style.left = left + 'px'; pop.style.top = Math.max(10, top) + 'px';
  }
  function hidePop() { pop.hidden = true; }

  // ------------------------------------------------------------------ events
  app.addEventListener('click', (e) => {
    const t = e.target;
    const stat = t.closest('[data-stat]');
    if (stat) { e.stopPropagation(); return showPop(stat, stat.dataset.stat, stat.dataset.code); }
    if (!t.closest('#pop')) hidePop();

    const tap = t.closest('[data-tap]');
    if (tap && S) {
      const card = tap.closest('.card'), code = card.dataset.code;
      S.photo[code] = (S.photo[code] + Number(tap.dataset.tap) + 3) % 3;
      $('[data-slide]', card).innerHTML = photo(code, S.photo[code]);
      $$('.bars i', card).forEach((b, i) => b.classList.toggle('on', i === S.photo[code]));
      return;
    }

    const qc = t.closest('[data-q]');
    if (qc && $('#chat-in')) { $('#chat-in').value = qc.dataset.q; return sendChat(); }
    const imp = t.closest('[data-imp]');
    if (imp) return setImp(imp.dataset.imp, Number(imp.dataset.v));
    const vibe = t.closest('[data-vibe]');
    if (vibe) { U.vibe = Number(vibe.dataset.vibe); $$('[data-vibe]').forEach((b) => b.setAttribute('aria-pressed', String(b === vibe))); return; }
    const bud = t.closest('[data-budget]');
    if (bud) { U.budget = bud.dataset.budget; $$('[data-budget]').forEach((b) => b.setAttribute('aria-pressed', String(b === bud))); return; }
    const work = t.closest('[data-work]');
    if (work) {
      U.work = work.dataset.work; $$('[data-work]').forEach((b) => b.setAttribute('aria-pressed', String(b === work)));
      $('#commute-scale').innerHTML = U.work === 'remote' ? '<p class="note">Commute is off, since you work from home.</p>' : scale('commute', 'How much does a short commute matter?');
      return;
    }

    const tab = t.closest('[data-tab]');
    if (tab) return goTab(tab.dataset.tab);

    const act = t.closest('[data-act]'); if (!act) return;
    const a = act.dataset.act, code = act.dataset.code;
    switch (a) {
      case 'start': return showStep(0);
      case 'quick': return showLoading();
      case 'next': {
        if (step === 0) { const v = $('#name').value.trim(); U.name = v || 'Mystery Renter'; }
        save();
        return step + 1 < STEPS.length ? showStep(step + 1) : showLoading();
      }
      case 'edit': return showStep(0);
      case 'deck': case 'again': return startDeck();
      case 'nope': case 'like': case 'super': return swipeButton(a);
      case 'profile': return openProfile(code);
      case 'view': return openSheet(`${profileBody(code, true)}<div class="sheet-cta"><button class="btn block" data-act="chat" data-code="${code}" data-from="view">Chat with ${esc(PROF[code].d)}</button><button class="btn alt block" data-act="sheet-x">Back to matches</button></div>`, 'view', true);
      case 'undo': return undoSwipe();
      case 'info': return openProfile(S.deck[S.idx]);
      case 'sheet-pass': closeSheet(); return swipeButton('nope');
      case 'sheet-like': closeSheet(); return swipeButton('like');
      case 'chat': return openChat(code, act.dataset.from);
      case 'chat-back': return chatFrom === 'match' ? closeAndAdvance() : closeSheet();
      case 'chat-send': return sendChat();
      case 'sheet-x': {
        if (sheetMode === 'match') return closeAndAdvance();
        if (sheetMode === 'reject') return closeAndAdvance();
        if (sheetMode === 'chat') return chatFrom === 'match' ? closeAndAdvance() : closeSheet();
        if (sheetMode === 'regret') return keepNo(S.deck[S.idx]);
        return closeSheet();
      }
      case 'match-next': case 'rej-next': return closeAndAdvance();
      case 'reconsider': { S.reconsidered.add(code); closeSheet(); return onSwipe(code, 'like'); }
      case 'keepno': return keepNo(code);
    }
  });
  $('#scrim').addEventListener('click', () => { const x = $('[data-act="sheet-x"]', sheet); if (x) x.click(); });
  $('#btn-sources').addEventListener('click', openSources);
  btnBack.addEventListener('click', () => {
    if (!S && step > 0 && $('.progress')) return showStep(step - 1);
    if (S && $('#deck')) return showPreview();
    if ($('.me-card')) return showStep(STEPS.length - 1);
    showWelcome();
  });

  function keepNo(code) { S.results[code] = { dir: 'nope', accepted: true, total: S.scores[code].total }; closeSheet(); advance(); }
  function closeAndAdvance() { closeSheet(); advance(); }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !sheetWrap.hidden) { const x = $('[data-act="sheet-x"]', sheet); if (x) x.click(); return; }
    if (!S || !$('#deck') || !sheetWrap.hidden) return;
    if (e.key === 'ArrowRight') swipeButton('like');
    else if (e.key === 'ArrowLeft') swipeButton('nope');
    else if (e.key === 'ArrowUp') swipeButton('super');
  });

  showWelcome();
})();
