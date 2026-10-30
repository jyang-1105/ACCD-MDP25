/* ============================================================
   The Person in the Name — the causal chain
   ------------------------------------------------------------
   name ─┬─▶ agify.io        ─▶ age ─▶ birth year − 100 ─┐
         ├─▶ nationalize.io  ─▶ country ─────────────────┼─▶ Cleveland Museum of Art
         └─▶ genderize.io    ─▶ gender (kept as a label) │   (or The Met, if Cleveland is silent)
                                                         │        │
                                                         │   each artwork calls the next by:
                                                         │   a word in its title · its artist · its place
                                                         │   its decade · its technique · a century earlier
                                                         └──────────▶ mood board
   ============================================================ */
'use strict';

/* ---------- settings you can play with ---------- */
const CFG = {
  genTargets: [2, 4, 6],   // artworks per generation: 2 seeds → 4 → 6  (= 12 total)
  genX: [6, 36, 61],       // horizontal position of each generation on the board (%)
  zigzag: 23,              // crowded columns push every other photo this far right (%)
  maxSlots: 8,             // the tallest column can hold this many photos
  rowHeight: 180,          // vertical space per slot (px)
  delay: 450,              // pause between steps so people can watch the chain (ms)
  timeout: 9000,           // give up on any server that takes longer than this (ms)
  pickFromTop: 14,         // choose among the N most relevant museum results
  metObjects: 6,           // The Met answers with ID numbers; fetch this many objects per search
  museums: ['cma', 'met'], // which museum is asked first; ['met', 'cma'] asks The Met first
  maxPerPlace: 3,          // at most this many pictures from one place, so one country can't take over
};

const CMA_API = 'https://openaccess-api.clevelandart.org/api/artworks/';
const MET_API = 'https://collectionapi.metmuseum.org/public/collection/v1';
const MUSEUM_NAME = { cma: 'the Cleveland Museum of Art', met: 'The Met' };

/* Some country names differ from how the museums record places. */
const PLACE_FIX = { GB: 'England', KR: 'Korea', KP: 'Korea', HK: 'China', MO: 'China', US: 'America' };
const FALLBACK_PLACES = ['France', 'Japan', 'China', 'Italy', 'Netherlands', 'India', 'Mexico', 'Egypt', 'England', 'America'];
const STOPWORDS = new Set(('the and with from for that this into over under near after before about their there were what when where which while ' +
  'untitled study sketch portrait figure figures view number part plate page leaf fragment object pair set ' +
  'des les une der die das den von und del della dei con per').split(' '));

/* ---------- tiny helpers ---------- */
const $ = (s) => document.querySelector(s);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const short = (s, n = 28) => { s = String(s ?? 'Untitled'); return s.length > n ? s.slice(0, n - 1) + '…' : s; };
const fmt = (n) => Number(n || 0).toLocaleString('en-US');

/* Seeded randomness: the same name always walks the same path. */
function hashString(str) {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  return h1 >>> 0;
}
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function regionName(code) {
  if (PLACE_FIX[code]) return PLACE_FIX[code];
  try { return new Intl.DisplayNames(['en'], { type: 'region' }).of(code) || code; }
  catch { return code; }
}
function hslToHex(h, s, l) {
  s /= 100; l /= 100;
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return '#' + [f(0), f(8), f(4)].map((x) => Math.round(x * 255).toString(16).padStart(2, '0')).join('');
}
function hueName(h) {
  const names = [[15, 'red'], [45, 'orange'], [70, 'yellow'], [160, 'green'], [200, 'teal'], [260, 'blue'], [300, 'purple'], [340, 'pink'], [360, 'red']];
  return names.find(([max]) => h < max)[1];
}
function readable(hex) {
  const n = parseInt(hex.slice(1), 16);
  const lum = (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return lum > 0.55 ? '#161616' : '#fdfdfb';
}

/* ---------- ransom-note letters ---------- */
const CUTS = [
  { font: 'var(--cut1)', bg: '#161616', fg: '#fdfdfb', upper: true },
  { font: 'var(--cut2)', bg: '#fdfdfb', fg: '#161616' },
  { font: 'var(--cut3)', bg: '#e9e7df', fg: '#161616' },
  { font: 'var(--cut2)', bg: '#f4e04d', fg: '#161616', italic: true },
  { font: 'var(--cut1)', bg: '#fdfdfb', fg: '#2337b5', upper: true },
  { font: 'var(--typed)', bg: '#d8d6cc', fg: '#161616', bold: true },
  { font: 'var(--cut2)', bg: '#2337b5', fg: '#fdfdfb' },
];
function ransom(el, text, seed) {
  const rng = mulberry32(hashString(String(seed)));
  el.innerHTML = '';
  let last = -1;
  let word = null;
  [...text].forEach((ch, i) => {
    if (ch === ' ') { word = null; return; }
    if (!word) {                     // letters of one word stay on the same line
      word = document.createElement('span');
      word.className = 'word';
      el.append(word);
    }
    let c = Math.floor(rng() * CUTS.length);
    if (c === last) c = (c + 1) % CUTS.length;   // no two neighbours cut from the same page
    last = c;
    const cut = CUTS[c];
    const s = document.createElement('span');
    s.className = 'cut';
    s.textContent = cut.upper ? ch.toUpperCase() : ch;
    s.style.fontFamily = cut.font;
    s.style.background = cut.bg;
    s.style.color = cut.fg;
    if (cut.italic) s.style.fontStyle = 'italic';
    if (cut.bold) s.style.fontWeight = '700';
    s.style.fontSize = `${(0.82 + rng() * 0.3).toFixed(2)}em`;
    s.style.transform = `rotate(${(rng() * 12 - 6).toFixed(1)}deg) translateY(${(rng() * 6 - 3).toFixed(1)}px)`;
    s.style.animationDelay = `${i * 60}ms`;
    s.setAttribute('aria-hidden', 'true');
    word.append(s);
  });
  el.setAttribute('aria-label', text);
}

/* ---------- state ---------- */
let S = null;
const alive = (token) => S && S.token === token;

function freshState(name) {
  return {
    name,
    token: Symbol(name),
    rng: mulberry32(hashString(name.toLowerCase())),
    works: [],          // { data, gen, cause, el, tried }   data = one normalised artwork
    used: new Set(),
    typeCount: {},      // how often each link type has been used, to keep the mix balanced
    threads: [],        // { fromEl, toEl, type, label, g }
    requests: 0,
    hosts: new Set(),
    museums: [...CFG.museums],   // museums that still answer, in the order they are asked
    t0: performance.now(),
    guesses: {},
    profile: null,      // the one Wikidata answer, shared by the three receipts
    wdProblem: null,    // why Wikidata didn't help, shown on the receipts
  };
}

/* Choose the next artwork. Prefer one that adds something new to the board:
   an object type, an artist and a place not seen yet. */
function pick(list) {
  const top = list.slice(0, CFG.pickFromTop);
  const types = new Set(S.works.map((w) => w.data.type));
  const artists = new Set(S.works.map((w) => w.data.artist));
  const places = new Set(S.works.map((w) => w.data.place));
  let best = null, bestScore = -1;
  for (const w of top) {
    const score = (types.has(w.type) ? 0 : 0.4)
      + (artists.has(w.artist) ? 0 : 0.3)
      + (places.has(w.place) ? 0 : 0.45)
      + S.rng() * 0.5;
    if (score > bestScore) { best = w; bestScore = score; }
  }
  return best;
}

/* ---------- the receipt roll (the visible mechanism) ---------- */
function logLine(html) {
  const li = document.createElement('li');
  li.innerHTML = html;
  $('#log').appendChild(li);
  $('#log').scrollTop = $('#log').scrollHeight;
  return li;
}
function logAppend(li, text) {
  li.insertAdjacentHTML('beforeend', `<br><span class="got">= ${esc(text)}</span>`);
  $('#log').scrollTop = $('#log').scrollHeight;
}
function updateCounter() {
  const secs = ((performance.now() - S.t0) / 1000).toFixed(1);
  $('#counter').textContent = `${S.requests} requests, ${S.hosts.size} servers, ${secs} s`;
}
function setStatus(t) { $('#status').textContent = t; }

async function getJSON(url, host, label) {
  S.requests++; S.hosts.add(host); updateCounter();
  const li = logLine(`<b>${esc(host)}</b> ${esc(label)}`);
  let res;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), CFG.timeout);
    res = await fetch(url, { signal: ctrl.signal }).finally(() => clearTimeout(timer));
  } catch (err) {
    li.classList.add('err');
    logAppend(li, err.name === 'AbortError' ? `too slow, gave up after ${CFG.timeout / 1000} s` : 'no answer (blocked or offline)');
    err.network = true;
    throw err;
  }
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    li.classList.add('err');
    logAppend(li, `refused, HTTP ${res.status}`);
    const err = new Error(`HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return { json, li };
}

/* ---------- step 1: three machines print receipts ----------
   The three guessing services allow about 100 free names a day. Every answer is
   kept in this browser, so asking about the same name again costs nothing. */
function memoryKey(host, name) { return `person-in-the-name:${host}:${name.toLowerCase()}`; }
function recall(host, name) {
  try { return JSON.parse(localStorage.getItem(memoryKey(host, name))); } catch { return null; }
}
function keep(host, name, json) {
  try { localStorage.setItem(memoryKey(host, name), JSON.stringify(json)); } catch { /* storage off: just ask again next time */ }
}
async function askService(host, name) {
  const saved = recall(host, name);
  if (saved) {
    const li = logLine(`<b>${esc(host)}</b> name=${esc(name)} <i>(asked before, answer kept)</i>`);
    return { json: saved, li };
  }
  try {
    const { json, li } = await getJSON(`https://api.${host}/?name=${encodeURIComponent(name)}`, host, `name=${name}`);
    keep(host, name, json);
    return { json, li };
  } catch (err) {
    return { json: null, why: err.status === 429 ? 'limit' : 'silent' };
  }
}
const NO_ANSWER = {
  limit: 'today’s free limit (about 100 names) is used up, it resets tomorrow',
  silent: 'no answer: the free daily limit is probably used up, or the network blocked it',
  empty: 'this name isn’t in its records',
};
function meter(p) {
  const n = Math.round(p * 16);
  return `sure  ${'■'.repeat(n)}${'□'.repeat(16 - n)}`;
}
function openReceipt(card) {
  card.classList.add('open');
  card.querySelector('.r-name').textContent = S.name;
}
function fillReceipt(card, value, detail, confidence) {
  const v = card.querySelector('.r-val');
  v.innerHTML = '';
  const span = document.createElement('span'); span.textContent = value;
  v.append(span);
  card.querySelector('.r-detail').textContent = detail;
  card.querySelector('.r-meter').textContent = meter(confidence);
  card.classList.add('done');
}
function resetReceipts() {
  document.querySelectorAll('.receipt').forEach((c) => {
    c.classList.remove('open', 'done');
    c.querySelector('.r-val').textContent = '…';
    c.querySelector('.r-detail').textContent = 'printing';
    c.querySelector('.r-meter').textContent = '';
  });
}

/* ---------- Wikidata: the first machine asked ----------
   Wikidata (the database behind Wikipedia) knows millions of people and their
   given names. Each receipt asks it one question about everyone who shares the
   name. No daily limit, no key. If it knows no one with this name, the old
   name-guessing service for that receipt is asked instead. */
const WD_API = 'https://query.wikidata.org/sparql';
const WD_SEX = { Q6581072: 'female', Q6581097: 'male', Q1052281: 'female', Q2449503: 'male', Q48270: 'non-binary', Q1097630: 'intersex' };
/* Two light steps instead of one heavy query:
   1. Wikidata's own search finds humans whose name contains the word
      (so "Jia" finds Jia Zhangke and Yang Jia alike).
   2. One small SPARQL query reads birth year, citizenship and sex for the
      first 50 of them. */
const WD_SEARCH = 'https://www.wikidata.org/w/api.php';
const WD_PEOPLE = 50;
function wikidataDetails(ids) {
  return `SELECT ?p ?y ?c ?cl ?s WHERE {
  VALUES ?p { ${ids.map((id) => `wd:${id}`).join(' ')} }
  OPTIONAL { ?p wdt:P569 ?b . BIND(YEAR(?b) AS ?y) }
  OPTIONAL { ?p wdt:P27 ?c . ?c rdfs:label ?cl . FILTER(LANG(?cl) = "en") }
  OPTIONAL { ?p wdt:P21 ?s }
}`;
}
function summarise(rows) {
  const people = new Map();   // one entry per person, however many rows they have
  rows.forEach((r) => {
    const id = r.p.value;
    const e = people.get(id) || { y: null, c: null, s: null };
    if (r.y && !e.y) e.y = Number(r.y.value);
    if (r.cl && !e.c) e.c = plainPlace(r.cl.value);
    if (r.s && !e.s) e.s = WD_SEX[r.s.value.split('/').pop()] || 'other';
    people.set(id, e);
  });
  const list = [...people.values()];
  const tally = (key) => {
    const t = {};
    list.forEach((e) => { if (e[key]) t[e[key]] = (t[e[key]] || 0) + 1; });
    return Object.entries(t).sort((a, b) => b[1] - a[1]);
  };
  const thisYear = new Date().getFullYear();
  const years = list.map((e) => e.y).filter((y) => y >= 1900 && y <= thisYear).sort((a, b) => a - b);
  return { people: list.length, years, countries: tally('c'), sexes: tally('s') };
}
function wikidataProfile(name) {
  if (S.profile) return S.profile;                    // asked once, read by all three receipts
  S.profile = (async () => {
    const saved = recall('wikidata2', name);
    if (saved) {
      const li = logLine(`<b>wikidata.org</b> people called ${esc(name)} <i>(asked before, answer kept)</i>`);
      logAppend(li, `${saved.people} people`);
      return saved;
    }
    try {
      // first look only in people's names; if that finds no one, search everything written about people
      let ids = [], total = 0;
      for (const query of [`haswbstatement:P31=Q5 inlabel:${name}`, `haswbstatement:P31=Q5 ${name}`]) {
        const search = new URLSearchParams({
          action: 'query', list: 'search', srsearch: query,
          srnamespace: 0, srlimit: WD_PEOPLE, format: 'json', origin: '*',
        });
        const { json: found, li } = await getJSON(`${WD_SEARCH}?${search}`, 'wikidata.org', `search people called ${name}`);
        ids = ((found.query && found.query.search) || []).map((r) => r.title).filter((t) => /^Q\d+$/.test(t));
        total = (found.query && found.query.searchinfo && found.query.searchinfo.totalhits) || ids.length;
        logAppend(li, ids.length ? `${fmt(total)} people, reading the first ${ids.length}` : 'no one found');
        if (ids.length) break;
      }
      if (!ids.length) { S.wdProblem = 'found no one'; return summarise([]); }

      const { json, li: li2 } = await getJSON(`${WD_API}?format=json&query=${encodeURIComponent(wikidataDetails(ids))}`, 'wikidata.org', `birth, country, sex of ${ids.length} people`);
      const profile = summarise((json && json.results && json.results.bindings) || []);
      profile.total = total;
      logAppend(li2, `${profile.years.length} birth years, ${profile.countries.length} countries`);
      keep('wikidata2', name, profile);
      return profile;
    } catch (err) {
      S.wdProblem = err.name === 'AbortError' ? 'too slow' : err.status ? `refused (HTTP ${err.status})` : 'blocked or offline';
      return null;
    }
  })();
  return S.profile;
}

const num = (b) => (b ? Number(b.value) : 0);
const qid = (b) => (b ? b.value.split('/').pop() : '');
/* turn Wikidata's official country names into the plain names museums use */
function plainPlace(label) {
  const fix = {
    "People's Republic of China": 'China', 'Republic of China': 'Taiwan', 'United States of America': 'America',
    'United States': 'America', 'United Kingdom': 'England', 'Kingdom of the Netherlands': 'Netherlands',
    'Soviet Union': 'Russia', 'Russian Empire': 'Russia', 'Kingdom of Italy': 'Italy', 'German Empire': 'Germany',
    'West Germany': 'Germany', 'East Germany': 'Germany', 'Empire of Japan': 'Japan', 'Qing dynasty': 'China',
  };
  return fix[label] || label.replace(/^(Republic|Kingdom|Empire|State) of (the )?/i, '');
}
function setSource(card, host) { card.querySelector('h3').textContent = host; }
const wdNote = () => (S.wdProblem ? `Wikidata ${S.wdProblem}; ` : '');

async function askAge(name) {
  const card = $('#card-age');
  openReceipt(card);
  setStatus(`asking Wikidata when the people named ${name} were born…`);
  const wd = await wikidataProfile(name);
  const years = wd ? wd.years : [];
  if (years.length) {
    const born = years[Math.floor(years.length / 2)];
    const age = new Date().getFullYear() - born;
    setSource(card, 'wikidata.org');
    fillReceipt(card, String(age), `the middle birth year of ${fmt(years.length)} people called ${name} on Wikidata is ${born}`,
      Math.min(1, Math.log10(years.length + 1) / 2.5));
    return { age, year: born, fallback: false, count: years.length, source: 'Wikidata' };
  }

  setSource(card, 'agify.io');
  setStatus(`Wikidata knows no ${name}, so asking agify.io…`);
  const { json, li, why } = await askService('agify.io', name);
  let age = json ? json.age : null;
  const count = json ? json.count : 0;
  if (li) logAppend(li, age != null ? `age ${age}, from ${fmt(count)} people` : 'no idea');
  const fallback = age == null;
  if (fallback) age = 18 + Math.floor(S.rng() * 50);
  const year = new Date().getFullYear() - age;
  fillReceipt(card, fallback ? `${age}?` : String(age),
    fallback ? `${wdNote()}${NO_ANSWER[why || 'empty']}. This number is made up from the letters.` : `born around ${year}, based on ${fmt(count)} people who used agify`,
    fallback ? 0 : Math.min(1, Math.log10(count + 1) / 6));
  return { age, year, fallback, count, source: fallback ? 'the letters' : 'agify.io' };
}

async function askCountry(name) {
  const card = $('#card-country');
  openReceipt(card);
  setStatus(`asking Wikidata where the people named ${name} are from…`);
  const wd = await wikidataProfile(name);
  const rows = wd ? wd.countries : [];
  if (rows.length) {
    const all = rows.reduce((s, r) => s + r[1], 0);
    const [place, n] = rows[0];
    const p = n / all;
    const next = rows[1] ? `, then ${rows[1][0]} ${Math.round((rows[1][1] / all) * 100)}%` : '';
    setSource(card, 'wikidata.org');
    fillReceipt(card, place, `${Math.round(p * 100)}% of ${fmt(all)} people called ${name}${next}`, p);
    return { place, probability: p, fallback: false, source: 'Wikidata' };
  }

  setSource(card, 'nationalize.io');
  setStatus(`Wikidata knows no ${name}, so asking nationalize.io…`);
  const { json, li, why } = await askService('nationalize.io', name);
  const list = ((json && json.country) || []).slice().sort((a, b) => b.probability - a.probability);
  if (li) logAppend(li, list.length ? list.slice(0, 3).map((c) => `${c.country_id} ${Math.round(c.probability * 100)}%`).join(', ') : 'no idea');
  if (!list.length) {
    const place = FALLBACK_PLACES[Math.floor(S.rng() * FALLBACK_PLACES.length)];
    fillReceipt(card, `${place}?`, `${wdNote()}${NO_ANSWER[why || 'empty']}. This place is made up from the letters.`, 0);
    return { place, probability: 0, fallback: true, source: 'the letters' };
  }
  const top = list[0];
  const place = regionName(top.country_id);
  const runnerUp = list[1] ? `, then ${regionName(list[1].country_id)} ${Math.round(list[1].probability * 100)}%` : '';
  fillReceipt(card, place, `${Math.round(top.probability * 100)}% sure${runnerUp}`, top.probability);
  return { place, probability: top.probability, fallback: false, source: 'nationalize.io' };
}

async function askGender(name) {
  const card = $('#card-gender');
  openReceipt(card);
  setStatus(`asking Wikidata who the people named ${name} are…`);
  const wd = await wikidataProfile(name);
  const sexes = wd ? wd.sexes : [];
  if (sexes.length) {
    const total = sexes.reduce((s, r) => s + r[1], 0);
    const [gender, n] = sexes[0];
    setSource(card, 'wikidata.org');
    fillReceipt(card, gender, `${Math.round((n / total) * 100)}% of ${fmt(total)} people called ${name}`, n / total);
    return { gender, probability: n / total, source: 'Wikidata' };
  }

  setSource(card, 'genderize.io');
  const { json, li, why } = await askService('genderize.io', name);
  const gender = json ? json.gender : null;
  const probability = (json && json.probability) || 0;
  if (li) logAppend(li, gender ? `${gender} ${Math.round(probability * 100)}%` : 'no idea');
  fillReceipt(card, gender || 'no guess', gender ? `${Math.round(probability * 100)}% sure` : `${wdNote()}${NO_ANSWER[why || 'empty']}`, gender ? probability : 0);
  return { gender, probability, source: gender ? 'genderize.io' : null };
}

/* ---------- step 2: the museums answer ----------
   Every search is written once as a "spec" (what we are looking for) and each
   museum translates it into its own kind of request. Cleveland is asked first;
   if it is silent or has nothing, The Met is asked instead. */

/* Cleveland: one request returns finished records with images. */
function cmaRecord(w) {
  const web = w.images && w.images.web;
  if (!web || !web.url) return null;
  const creator = (w.creators || [])[0];
  const artist = creator && creator.description ? creator.description.split(' (')[0].trim() : null;
  const culture = (w.culture || [])[0];
  return {
    id: `cma-${w.id}`, museum: 'cma',
    title: w.title || 'Untitled',
    img: web.url, imgLarge: web.url,
    artist, date: w.creation_date || '', start: w.creation_date_earliest,
    place: culture ? culture.split(',')[0].trim() : null,
    technique: w.technique || null, type: w.type || null, url: w.url,
  };
}
/* Cleveland returns matches in a fixed order, so taking the first page would give
   every name the same pictures. Instead the machine first asks how many matches
   there are, then opens the result list at a point chosen by the name. */
function cmaParams(spec, usePlaceAs) {
  const p = { has_image: 1, cc0: 1 };
  if (spec.q) p.q = spec.q;
  if (spec.place) p[usePlaceAs] = spec.place;
  if (spec.artist) p.artists = spec.artist;
  if (spec.from != null) p.created_after = spec.from;
  if (spec.to != null) p.created_before = spec.to;
  return p;
}
async function cmaSearch(spec, label) {
  // a place is first asked as a culture (precise); if that finds nothing, as a keyword
  for (const as of spec.place ? ['culture', 'q'] : ['q']) {
    const base = cmaParams(spec, as);
    const tag = spec.place && as === 'q' ? ' (as a word)' : '';
    const { json: c, li: lc } = await getJSON(`${CMA_API}?${new URLSearchParams({ ...base, limit: 1, fields: 'id' })}`, 'clevelandart.org', `how many: ${label}${tag}`);
    const total = c.info ? c.info.total : 0;
    logAppend(lc, `${fmt(total)} matches`);
    if (!total) continue;
    const page = 40;
    const skip = Math.floor(S.rng() * Math.max(0, Math.min(total, 1000) - page));
    const { json, li } = await getJSON(`${CMA_API}?${new URLSearchParams({ ...base, limit: page, skip })}`, 'clevelandart.org', `open at #${skip + 1}`);
    const list = (json.data || []).map(cmaRecord).filter(Boolean);
    logAppend(li, `${list.length} with pictures`);
    return list;
  }
  return [];
}

/* The Met: a search returns only ID numbers, so each object is a second request.
   More requests, more machine. */
function metRecord(o) {
  if (!o || !o.primaryImageSmall || o.isPublicDomain === false) return null;
  return {
    id: `met-${o.objectID}`, museum: 'met',
    title: o.title || 'Untitled',
    img: o.primaryImageSmall, imgLarge: o.primaryImage || o.primaryImageSmall,
    artist: o.artistDisplayName || null, date: o.objectDate || '', start: o.objectBeginDate,
    place: o.culture || o.country || null,
    technique: o.medium || null, type: o.classification || o.objectName || null, url: o.objectURL,
  };
}
async function metSearch(spec, label) {
  const p = { hasImages: 'true', q: spec.q || spec.artist || spec.place || spec.fallbackQ || 'painting' };
  if (spec.artist) p.artistOrCulture = 'true';
  if (spec.from != null && spec.to != null) { p.dateBegin = spec.from; p.dateEnd = spec.to; }
  const { json, li } = await getJSON(`${MET_API}/search?${new URLSearchParams(p)}`, 'metmuseum.org', label);
  const all = json.objectIDs || [];
  const start = Math.floor(S.rng() * Math.max(0, Math.min(all.length, 2000) - 60));   // a different stretch for each name
  const ids = all.slice(start, start + 60);
  logAppend(li, `${fmt(json.total || 0)} ID numbers`);
  const chosen = [];
  while (ids.length && chosen.length < CFG.metObjects) chosen.push(ids.splice(Math.floor(S.rng() * ids.length), 1)[0]);
  const objects = await Promise.all(chosen.map(async (id) => {
    try {
      const { json: o, li: l } = await getJSON(`${MET_API}/objects/${id}`, 'metmuseum.org', `object ${id}`);
      logAppend(l, o.primaryImageSmall ? short(o.title, 26) : 'no picture');
      return metRecord(o);
    } catch { return null; }
  }));
  return objects.filter(Boolean);
}

const placeCount = (place) => S.works.filter((w) => w.data.place === place).length;

async function museumSearch(spec, label) {
  let fallback = [];
  for (const m of [...S.museums]) {
    try {
      const list = (await (m === 'cma' ? cmaSearch(spec, label) : metSearch(spec, label)))
        .filter((w) => !S.used.has(w.id) && (!spec.keep || spec.keep(w)));
      // keep the board varied: skip places that already have enough pictures
      const varied = list.filter((w) => !w.place || placeCount(w.place) < CFG.maxPerPlace);
      if (varied.length) return varied;
      if (!fallback.length) fallback = list;
    } catch (err) {
      // this museum is blocked or broken: stop asking it for the rest of the run
      S.museums = S.museums.filter((x) => x !== m);
    }
  }
  return fallback;
}

async function seedFromCountry(place) {
  setStatus(`asking the museum for something made in ${place}…`);
  const list = await museumSearch({ place }, `made in ${place}`);
  return list.length ? pick(list) : null;
}
async function seedFromYear(year) {
  setStatus(`asking the museum for something made in ${year}, a century before the guessed birth…`);
  for (const w of [0, 3, 10]) {
    const label = w ? `made ${year - w}–${year + w}` : `made in ${year}`;
    const list = await museumSearch({ from: year - w, to: year + w, fallbackQ: 'painting' }, label);
    if (list.length) return pick(list);
  }
  return null;
}

/* ---------- step 3: art calls more art ---------- */
const TYPES = ['word', 'artist', 'place', 'era', 'technique', 'century'];
const randomOf = (arr) => arr[Math.floor(S.rng() * arr.length)];
const decade = (y) => Math.floor(y / 10) * 10;
const knownArtist = (a) => a && !/^(unknown|unidentified|anonymous)/i.test(a);
function titleWords(title) {
  return [...new Set(String(title || '').toLowerCase().split(/[^\p{L}]+/u)
    .filter((w) => w.length >= 4 && !STOPWORDS.has(w)))];
}
function shortTechnique(t) {
  return String(t || '').split(/[;,(]/)[0].trim().split(/\s+/).slice(0, 3).join(' ').toLowerCase();
}

async function bounce(parent, type) {
  const p = parent.data;

  if (type === 'word') {                              // a word from its title
    const words = titleWords(p.title);
    if (words.length) {
      const w = randomOf(words);
      setStatus(`what else is called “${w}”?`);
      const list = await museumSearch({ q: w, keep: (x) => titleWords(x.title).includes(w) }, `title has “${w}”`);
      if (list.length) return { data: pick(list), type, note: `“${w}” again` };
    }
  }

  if (type === 'artist' && knownArtist(p.artist)) {   // same artist
    setStatus(`what else did ${p.artist} make?`);
    const list = await museumSearch({ artist: p.artist, keep: (x) => x.artist === p.artist }, `artist = ${short(p.artist, 24)}`);
    if (list.length) return { data: pick(list), type, note: 'same hand' };
  }

  if (type === 'place' && p.place && placeCount(p.place) < CFG.maxPerPlace) {                  // made in the same place, by someone else
    setStatus(`back to ${p.place} for something else…`);
    const list = await museumSearch({ place: p.place, keep: (x) => x.artist !== p.artist || !knownArtist(p.artist) }, `place = ${short(p.place, 22)}`);
    if (list.length) return { data: pick(list), type, note: `also ${short(p.place, 14)}` };
  }

  if (type === 'era' && p.start != null) {            // made in the same decade, somewhere else
    const d = decade(p.start);
    setStatus(`what else was being made in the ${d}s?`);
    const list = await museumSearch({ from: d, to: d + 9, fallbackQ: p.type || 'painting', keep: (x) => x.place !== p.place }, `made ${d}–${d + 9}, elsewhere`);
    if (list.length) return { data: pick(list), type, note: `same ${d}s` };
  }

  if (type === 'technique' && p.technique) {          // the same material or technique
    const t = shortTechnique(p.technique);
    if (t) {
      setStatus(`looking for more ${t}…`);
      const list = await museumSearch({ q: t }, `technique = ${short(t, 22)}`);
      if (list.length) return { data: pick(list), type, note: `more ${short(t, 16)}` };
    }
  }

  if (type === 'century' && p.place && p.start != null) {   // the same place, a hundred years earlier
    const y = p.start - 100;
    setStatus(`what was ${p.place} making around ${y}?`);
    const list = await museumSearch({ place: p.place, from: y - 15, to: y + 15 }, `${short(p.place, 16)} around ${y}`);
    if (list.length) return { data: pick(list), type, note: '100 years earlier' };
  }
  return null;
}

/* Never leave by the door you came in through, never use the same door twice,
   and try the least-used kind of link first, so every board mixes all six. */
function orderTypes(parent) {
  return TYPES
    .filter((t) => t !== parent.cause.type && !parent.tried.has(t))
    .map((t) => ({ t, n: S.typeCount[t] || 0, r: S.rng() }))
    .sort((a, b) => a.n - b.n || a.r - b.r)
    .map((x) => x.t);
}
async function tryTypes(parent) {
  for (const type of orderTypes(parent)) {
    parent.tried.add(type);
    const res = await bounce(parent, type);
    if (res && res.data) {
      S.typeCount[type] = (S.typeCount[type] || 0) + 1;
      return res;
    }
  }
  return null;
}

/* ---------- the board ---------- */
function boardHeight() { return Math.max(760, CFG.maxSlots * CFG.rowHeight + 40); }

function artImg(data, large) {
  const img = document.createElement('img');
  img.alt = data.title || 'Artwork';
  img.loading = 'lazy';
  img.referrerPolicy = 'no-referrer';
  img.src = large ? data.imgLarge : data.img;
  img.onerror = () => {
    if (large && img.src !== data.img) img.src = data.img;
    else img.removeAttribute('src');
  };
  return img;
}

function addWork(data, gen, cause, slot, slots) {
  S.used.add(data.id);
  S.requests++; S.hosts.add(data.museum === 'cma' ? 'clevelandart.org images' : 'metmuseum.org images'); updateCounter();
  const H = boardHeight() - 40;
  const rot = (S.rng() * 8 - 4).toFixed(1);
  const jx = S.rng() * 5 - 2.5;
  const jy = Math.round(S.rng() * 30 - 15);
  const top = Math.round(((slot + 0.5) * H) / slots - 95 + jy);
  const zig = slots > 5 && slot % 2 ? CFG.zigzag : 0;

  const el = document.createElement('figure');
  el.className = 'pin';
  el.style.left = `calc(${CFG.genX[gen] + zig + jx}% - 40px)`;
  el.style.top = `${Math.max(14, top)}px`;
  el.style.setProperty('--rot', `${rot}deg`);
  el.style.setProperty('--tape-rot', `${(S.rng() * 14 - 7).toFixed(1)}deg`);

  const tape = document.createElement('span'); tape.className = 'tape';
  const why = document.createElement('span'); why.className = 'why'; why.textContent = cause.note;
  const cap = document.createElement('figcaption');
  const t = document.createElement('span'); t.className = 'title'; t.textContent = data.title;
  const by = document.createElement('span'); by.className = 'by';
  by.textContent = [data.artist, data.date].filter(Boolean).join(', ') || data.place || '';
  cap.append(why, t, by);
  el.append(tape, artImg(data, false), cap);
  el.title = `${data.title}\n${by.textContent}\n${data.place || ''}\n${MUSEUM_NAME[data.museum]}`;
  $('#board').appendChild(el);

  const work = { data, gen, cause, el, tried: new Set() };
  S.works.push(work);
  const token = S.token;
  el.addEventListener('animationend', () => {
    if (alive(token)) addThread(cause.fromEl, el, cause.type, cause.note);
  }, { once: true });
  return work;
}

/* ---------- hand-drawn ballpoint arrows ---------- */
const SVGNS = 'http://www.w3.org/2000/svg';
function svgEl(tag, attrs) {
  const e = document.createElementNS(SVGNS, tag);
  Object.entries(attrs).forEach(([k, v]) => e.setAttribute(k, v));
  return e;
}
function edgePoint(el, side, sr) {
  const r = el.getBoundingClientRect();
  if (side === 'right') return { x: r.right - sr.left + 2, y: r.top + r.height * 0.42 - sr.top };
  return { x: r.left - sr.left - 4, y: r.top + r.height * 0.3 - sr.top };
}
/* A wobbly curve with an open arrowhead and a scribbled reason next to it. */
function drawArrow(g, fromEl, toEl, type, note, seed, animate) {
  const rng = mulberry32(seed);
  const sr = $('#stage').getBoundingClientRect();
  const a = edgePoint(fromEl, 'right', sr);
  const b = edgePoint(toEl, 'left', sr);
  const dx = b.x - a.x, dy = b.y - a.y;
  const bend = (rng() - 0.5) * Math.min(90, Math.abs(dx) * 0.4 + 30);
  const c1 = { x: a.x + dx * 0.35, y: a.y + dy * 0.1 + bend };
  const c2 = { x: a.x + dx * 0.7, y: a.y + dy * 0.9 - bend * 0.6 };
  const d = `M${a.x.toFixed(1)},${a.y.toFixed(1)} C${c1.x.toFixed(1)},${c1.y.toFixed(1)} ${c2.x.toFixed(1)},${c2.y.toFixed(1)} ${b.x.toFixed(1)},${b.y.toFixed(1)}`;
  const pencil = type === 'guess';
  g.innerHTML = '';

  const main = svgEl('path', { d, class: `ink${pencil ? ' pencil' : ''}` });
  g.append(main);
  if (!pencil) {
    // a second, lighter pass of the pen: real ballpoint lines are never one clean stroke
    const j = () => (rng() * 2.4 - 1.2).toFixed(1);
    g.append(svgEl('path', { d, class: 'ink ghost', transform: `translate(${j()},${j()})` }));
  }

  // arrowhead: two short strokes at the tip, along the curve's final direction
  const ang = Math.atan2(b.y - c2.y, b.x - c2.x);
  const len = 13;
  const hd = [-0.45, 0.45].map((o) => {
    const x = b.x - len * Math.cos(ang + o), y = b.y - len * Math.sin(ang + o);
    return `M${x.toFixed(1)},${y.toFixed(1)} L${b.x.toFixed(1)},${b.y.toFixed(1)}`;
  }).join(' ');
  g.append(svgEl('path', { d: hd, class: `ink${pencil ? ' pencil' : ''}` }));

  // the scribbled reason, near the middle of the curve
  const t = 0.5, mt = 1 - t;
  const mx = mt ** 3 * a.x + 3 * mt * mt * t * c1.x + 3 * mt * t * t * c2.x + t ** 3 * b.x;
  const my = mt ** 3 * a.y + 3 * mt * mt * t * c1.y + 3 * mt * t * t * c2.y + t ** 3 * b.y;
  const tilt = Math.max(-14, Math.min(14, Math.atan2(dy, dx) * 180 / Math.PI * 0.5));
  const text = svgEl('text', {
    x: mx.toFixed(1), y: (my - 6).toFixed(1), 'text-anchor': 'middle',
    class: `note${pencil ? ' pencil-note' : ''}`,
    transform: `rotate(${tilt.toFixed(1)} ${mx.toFixed(1)} ${my.toFixed(1)})`,
  });
  text.textContent = note;
  g.append(text);

  if (animate) {
    g.querySelectorAll('path').forEach((p) => {
      const L = Math.ceil(p.getTotalLength());
      p.style.setProperty('--len', L);
      p.classList.add('draw');
      p.addEventListener('animationend', () => { p.classList.remove('draw'); }, { once: true });
    });
  } else {
    text.style.opacity = 1;
    text.style.animation = 'none';
  }
}
function addThread(fromEl, toEl, type, note) {
  const g = svgEl('g', {});
  $('#threads').appendChild(g);
  const th = { fromEl, toEl, type, note, g, seed: hashString(note + S.threads.length) };
  S.threads.push(th);
  drawArrow(g, fromEl, toEl, type, note, th.seed, true);
}
function redrawThreads() {
  if (!S) return;
  S.threads.forEach((t) => drawArrow(t.g, t.fromEl, t.toEl, t.type, t.note, t.seed, false));
}
let resizeTimer;
window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(redrawThreads, 120); });

/* ---------- when the museum never answers ---------- */
function showMuseumFailure() {
  const local = location.protocol === 'file:';
  setStatus('no museum answered');
  const note = document.createElement('div');
  note.className = 'note-sheet';
  note.innerHTML = `<strong>No museum answered.</strong>
    The three guesses worked, but the requests to the Cleveland Museum of Art and The Met were both blocked, so there is no art to pin.
    <ul>
      ${local ? '<li>This page was opened as a file. Open it with Live Server in VS Code instead (right-click index.html, then “Open with Live Server”).</li>' : ''}
      <li>Some school and office Wi-Fi blocks the museum. Try another network or a phone hotspot.</li>
      <li>Ad blockers can block it too. Turn them off for this page.</li>
    </ul>`;
  $('#board').append(note);
  $('#retry-btn').hidden = false;
}

/* ---------- run the whole machine ---------- */
async function start(rawName) {
  const word = (rawName.match(/[\p{L}'’-]+/u) || [rawName])[0];
  const name = word.charAt(0).toUpperCase() + word.slice(1);
  S = freshState(name);
  const token = S.token;

  $('#intro').hidden = true;
  $('#moodboard').hidden = true;
  $('#stage').hidden = false;
  $('#stage').classList.remove('composing');
  $('#board').innerHTML = '';
  $('#board').style.minHeight = `${boardHeight()}px`;
  $('#threads').innerHTML = '';
  $('#log').innerHTML = '';
  $('#compose-btn').hidden = true;
  $('#retry-btn').hidden = true;
  resetReceipts();
  ransom($('#name-display'), name, name);
  updateCounter();
  window.scrollTo({ top: 0, behavior: 'smooth' });
  await sleep(600);

  // 1 — three guesses
  const age = await askAge(name);          if (!alive(token)) return; await sleep(CFG.delay);
  const country = await askCountry(name);  if (!alive(token)) return; await sleep(CFG.delay);
  const gender = await askGender(name);    if (!alive(token)) return; await sleep(CFG.delay);
  S.guesses = { age, country, gender };
  if (age.fallback && country.fallback) {
    setStatus('the guessing machines are out of answers today, so the letters made the rest up');
    await sleep(CFG.delay * 2);
  }

  // 2 — the guesses become museum searches
  const seeds = [];
  const a = await seedFromCountry(country.place);
  if (!alive(token)) return;
  if (a) seeds.push(addWork(a, 0, { type: 'guess', fromEl: $('#card-country'), note: `${short(country.place, 14)}?` }, 0, 2));
  await sleep(CFG.delay);

  const year = age.year - 100;
  const b = await seedFromYear(year);
  if (!alive(token)) return;
  if (b) seeds.push(addWork(b, 0, { type: 'guess', fromEl: $('#card-age'), note: `${age.year} − 100` }, 1, 2));
  await sleep(CFG.delay);

  if (!seeds.length) { showMuseumFailure(); return; }

  // 3 — art calls more art, generation by generation
  let parents = seeds;
  for (let g = 1; g < CFG.genTargets.length; g++) {
    const target = CFG.genTargets[g];
    const perParent = Math.ceil(target / parents.length);
    const slots = Math.min(CFG.maxSlots, parents.length * perParent);
    const kids = [];
    for (let round = 0; round < perParent && kids.length < target; round++) {
      for (let pi = 0; pi < parents.length; pi++) {
        if (kids.length >= target) break;
        const par = parents[pi];
        const res = await tryTypes(par);
        if (!alive(token)) return;
        if (res) {
          const slot = Math.min(slots - 1, pi * perParent + round);
          kids.push(addWork(res.data, g, { type: res.type, fromEl: par.el, note: res.note }, slot, slots));
          await sleep(CFG.delay);
        }
      }
    }
    if (!kids.length) break;
    parents = kids.sort((x, y) => parseFloat(x.el.style.top) - parseFloat(y.el.style.top));
  }

  updateCounter();
  setStatus(`done: ${S.works.length} pictures pulled in by ${S.requests} requests`);
  $('#compose-btn').hidden = false;
}

/* ---------- step 4: the mood board ---------- */
/* The museums don't publish colours, so the machine measures them itself:
   each picture is shrunk to 24×24 pixels and its most common colour is kept.
   If a museum's image server doesn't allow this, the palette is left out. */
function dominantColour(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    const done = (v) => { clearTimeout(timer); resolve(v); };
    const timer = setTimeout(() => done(null), 5000);
    img.onerror = () => done(null);
    img.onload = () => {
      try {
        const c = document.createElement('canvas');
        c.width = c.height = 24;
        const ctx = c.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(img, 0, 0, 24, 24);
        const px = ctx.getImageData(0, 0, 24, 24).data;
        const buckets = new Map();
        for (let i = 0; i < px.length; i += 4) {
          const key = `${px[i] >> 5},${px[i + 1] >> 5},${px[i + 2] >> 5}`;
          const b = buckets.get(key) || { n: 0, r: 0, g: 0, b: 0 };
          b.n++; b.r += px[i]; b.g += px[i + 1]; b.b += px[i + 2];
          buckets.set(key, b);
        }
        const top = [...buckets.values()].sort((x, y) => y.n - x.n)[0];
        const hex = '#' + [top.r, top.g, top.b].map((v) => Math.round(v / top.n).toString(16).padStart(2, '0')).join('');
        done(hex);
      } catch { done(null); }                 // the image server did not allow reading pixels
    };
    img.src = src;
  });
}
function hexDistance(a, b) {
  const n = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [x, y] = [n(a), n(b)];
  return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]);
}
async function fillPalette(token, rng) {
  const chips = $('#mb-palette');
  chips.innerHTML = '';
  const colours = await Promise.all(S.works.map((w) => dominantColour(w.data.img)));
  if (!alive(token)) return;
  const picked = [];
  colours.filter(Boolean).forEach((c) => { if (!picked.some((p) => hexDistance(p, c) < 40)) picked.push(c); });
  picked.slice(0, 9).forEach((hex) => {
    const chip = document.createElement('div');
    chip.className = 'chip';
    chip.style.setProperty('--rot', `${(rng() * 6 - 3).toFixed(1)}deg`);
    const sw = document.createElement('i'); sw.style.background = hex;
    const label = document.createElement('span'); label.textContent = hex;
    chip.append(sw, label);
    chips.append(chip);
  });
}
function buildKeywords() {
  const tally = new Map();
  S.works.forEach(({ data }) => {
    const terms = new Set([data.type, shortTechnique(data.technique), data.place, ...titleWords(data.title)]
      .filter(Boolean).map((t) => t.toLowerCase()));
    terms.forEach((t) => tally.set(t, (tally.get(t) || 0) + 1));
  });
  return [...tally.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([t]) => t);
}

function compose() {
  $('#stage').classList.add('composing');
  setTimeout(() => {
    $('#stage').hidden = true;
    $('#moodboard').hidden = false;
    renderMoodboard();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, 500);
}

/* a photo with torn edges, a bit of tape and a caption slip */
function tornEdges(rng) {
  const pts = [];
  const side = (fx, fy, n) => { for (let i = 0; i < n; i++) pts.push(fx(i / n, rng() * 2.4)); };
  side((t, j) => `${(t * 100).toFixed(1)}% ${j.toFixed(1)}%`, null, 9);
  side((t, j) => `${(100 - j).toFixed(1)}% ${(t * 100).toFixed(1)}%`, null, 9);
  side((t, j) => `${(100 - t * 100).toFixed(1)}% ${(100 - j).toFixed(1)}%`, null, 9);
  side((t, j) => `${j.toFixed(1)}% ${(100 - t * 100).toFixed(1)}%`, null, 9);
  return `polygon(${pts.join(',')})`;
}
function tile(kind, w, h, rng) {
  const el = document.createElement('div');
  el.className = `tile tile-${kind}`;
  el.style.setProperty('--w', w);
  el.style.setProperty('--h', h);
  el.style.setProperty('--rot', `${(rng() * 5 - 2.5).toFixed(1)}deg`);
  el.style.setProperty('--dx', `${Math.round(rng() * 12 - 6)}px`);
  el.style.setProperty('--dy', `${Math.round(rng() * 12 - 6)}px`);
  return el;
}
function addTape(el, rng) {
  const t = document.createElement('span');
  t.className = 'tape';
  const corner = Math.floor(rng() * 3);
  if (corner === 0) Object.assign(t.style, { top: '-9px', left: '-14px', transform: `rotate(${-30 - rng() * 15}deg)` });
  if (corner === 1) Object.assign(t.style, { top: '-9px', right: '-14px', transform: `rotate(${30 + rng() * 15}deg)` });
  if (corner === 2) Object.assign(t.style, { top: '-11px', left: '50%', marginLeft: '-35px', transform: `rotate(${rng() * 10 - 5}deg)` });
  el.append(t);
}
function artTile(work, w, h, rng) {
  const { data } = work;
  const el = tile('art', w, h, rng);
  const frame = document.createElement('div');
  frame.className = 'frame';
  frame.style.clipPath = tornEdges(rng);
  frame.append(artImg(data, w >= 2));
  const cap = document.createElement('div');
  cap.className = 'cap';
  const ti = document.createElement('i'); ti.textContent = data.title || 'Untitled';
  cap.append(ti, [data.artist, data.date].filter(Boolean).join(', ') || data.place || '');
  el.append(frame, cap);
  el.tabIndex = 0;
  if (rng() < 0.6) addTape(el, rng);
  return el;
}
function detailTile(work, rng) {
  const el = tile('detail', 1, 1, rng);
  const frame = document.createElement('div');
  frame.className = 'frame';
  const img = document.createElement('img');
  img.alt = `Detail of ${work.data.title}`;
  img.loading = 'lazy';
  img.referrerPolicy = 'no-referrer';
  img.src = work.data.imgLarge;
  // a close-up: the whole picture blown up 3×, centred on a random spot
  img.style.transform = 'scale(3)';
  img.style.transformOrigin = `${20 + Math.floor(rng() * 60)}% ${20 + Math.floor(rng() * 60)}%`;
  img.onerror = () => { el.remove(); };
  frame.append(img);
  el.append(frame);
  return el;
}
function quoteTile(text, rng) {
  const el = tile('quote', 3, 1, rng);
  const frame = document.createElement('div');
  frame.className = 'frame';
  const q = document.createElement('p'); q.textContent = text;
  frame.append(q);
  el.append(frame);
  return el;
}
function scrawlTile(text, rng) {
  const el = tile('scrawl', 2, 1, rng);
  el.textContent = text;
  return el;
}

function guessSources() {
  const { age, country, gender } = S.guesses;
  const s = [...new Set([age.source, country.source, gender.source].filter(Boolean))];
  if (s.length === 1 && s[0] === 'Wikidata') return `Everyone named ${S.name} on Wikidata`;
  return s.length ? s.join(', ').replace(/, ([^,]*)$/, ' and $1') : 'The letters of the name';
}

function renderMoodboard() {
  const { age, country, gender } = S.guesses;
  const rng = mulberry32(hashString(`${S.name}-board`));
  ransom($('#mb-title'), S.name, S.name);
  const linkWords = { word: 'words in their titles', artist: 'shared artists', place: 'shared places', era: 'shared decades', technique: 'shared techniques', century: 'jumps back a hundred years' };
  const used = TYPES.filter((t) => S.typeCount[t]).map((t) => linkWords[t]);
  const museums = [...new Set(S.works.map((w) => MUSEUM_NAME[w.data.museum]))].join(' and ');
  $('#mb-sub').textContent =
    `${guessSources()} guessed who a “${S.name}” might be. The guesses sent ${museums} ` +
    `looking for art from ${country.place} and from the year ${age.year - 100}` +
    (used.length ? `; the art then led to more art through ${used.join(', ')}.` : '.');

  const keywords = buildKeywords();
  // seeds first, then the rest in the order the chain found them, lightly shuffled by the name
  const order = S.works.slice().sort((x, y) => (x.gen - y.gen) + (rng() - 0.5) * 1.5);
  const sizes = [[3, 3], [2, 2], [2, 3], [2, 2], [1, 2], [3, 2], [2, 2], [1, 1], [2, 2], [1, 2], [2, 2], [3, 2]];
  const quoteFrom = S.works[Math.floor(rng() * S.works.length)];
  const details = order.slice(0, 3);

  const items = [];
  order.forEach((w, k) => {
    const [cw, ch] = sizes[k % sizes.length];
    items.push(artTile(w, cw, ch, rng));
    if (k === 1) items.push(quoteTile(quoteFrom.data.title || S.name, rng));
    if (k === 2 || k === 6 || k === 9) { const d = details.shift(); if (d) items.push(detailTile(d, rng)); }
    if (k === 4) items.push(scrawlTile(`${age.age}? ${country.place}?`, rng));
  });
  const collage = $('#mb-collage');
  collage.innerHTML = '';
  items.forEach((el) => collage.append(el));

  fillPalette(S.token, rng);

  const dymos = $('#mb-keywords');
  dymos.innerHTML = '';
  keywords.forEach((t) => {
    const s = document.createElement('span');
    s.className = 'dymo';
    s.style.setProperty('--rot', `${(rng() * 4 - 2).toFixed(1)}deg`);
    s.textContent = t;
    dymos.append(s);
  });

  const rows = [
    ['name', S.name],
    ['age', age.fallback ? `${age.age} (made up)` : `about ${age.age}, per ${age.source}`],
    ['from', country.fallback ? `${country.place} (made up)` : `${country.place}, ${Math.round(country.probability * 100)}%`],
    ['gender', gender.gender ? `${gender.gender}, ${Math.round(gender.probability * 100)}%` : 'undecided'],
    ['made of', `${S.works.length} artworks`],
  ];
  const dl = $('#mb-portrait');
  dl.innerHTML = '';
  rows.forEach(([k, v], i) => {
    const dt = document.createElement('dt'); dt.textContent = k;
    const dd = document.createElement('dd');
    if (i >= 1 && i <= 3) { const m = document.createElement('mark'); m.textContent = v; dd.append(m); }
    else dd.textContent = v;
    dl.append(dt, dd);
  });
}

/* ---------- wiring ---------- */
ransom($('#intro-title'), 'The Person in the Name', 'title');

$('#name-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const v = $('#name-input').value.trim();
  if (v) start(v);
});
$('#compose-btn').addEventListener('click', compose);
$('#retry-btn').addEventListener('click', () => { if (S) start(S.name); });
$('#again-btn').addEventListener('click', () => {
  S = null;
  $('#moodboard').hidden = true;
  $('#stage').hidden = true;
  $('#intro').hidden = false;
  $('#name-input').value = '';
  $('#name-input').focus();
  window.scrollTo({ top: 0 });
});
$('#chain-btn').addEventListener('click', () => {
  $('#moodboard').hidden = true;
  $('#stage').hidden = false;
  $('#stage').classList.remove('composing');
  requestAnimationFrame(redrawThreads);
});

/* ?name=Jia in the address starts the machine straight away (handy for demos) */
const preset = new URLSearchParams(location.search).get('name');
if (preset) { $('#name-input').value = preset; start(preset); }
