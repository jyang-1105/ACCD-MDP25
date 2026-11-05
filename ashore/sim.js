// ===== Ashore — the rules (no rendering, no networking) =====
// World: x runs from the Deep Sea (0) to the Shore (100); z is the width of the room (0..40).
// Some merfolk can be played by people ("humans"); the rest follow the model's rules.
export const WORLD = { W: 100, D: 40, B1: 50, B2: 72, LD_X: 83 };
export const RIB = ['voice', 'hands', 'sight', 'walking'];

export const DEFAULTS = {
  merfolk: 30,       // how many merfolk
  givers: 6,         // how many of the AI merfolk are givers
  dwellers: 3,       // how many Land Dwellers
  busy: 0.6,         // 0 = always turning around, 1 = almost never
  tides: 3,          // how many low tides before dawn
  kinder: true,      // being helped makes you more likely to help
  far: false,        // Land Dwellers stand far up the shore instead of near the water
  keep: 'random',    // which ability AI merfolk keep when they pay two at the Shore
  rips: true,        // rip currents in the Shallows at low tide
  night: 1,          // stretch the night (1 = 3 minutes; 2 = 6 minutes)
};

export const CONST = {
  DT: 0.1,
  START: 15,         // the Deep: nobody can cross yet
  NIGHT: 165,        // time shared by all tides (times p.night)
  LOW: 10,           // a low tide lasts this long (times p.night)
  GRACE: 10,         // time after the last low tide before dawn
  SPEED: 4,
  SIGHT_R: 8,        // how far a merfolk with Sight can see
  REACH: 1.6,        // close enough to touch, lead or gift
  NOTICE_R: 12,      // how close a Land Dweller has to be to notice you
  UNDERSTAND: 10,    // seconds of attention needed
  KIND_P: 0.5,       // chance a helped merfolk becomes a giver
  CROWD_R: 3.5,      // merfolk this close to a Land Dweller count as "gathered around"
  RIP: 5,            // strength of a rip current (m/s back toward the sea)
  SIGNAL_R: 18,      // a raised hand is seen this far away
};

// the larp's message cards
export const MESSAGES = [
  'I saved you once.', 'I gave up my home to be here.', 'I miss the sea.', 'Please remember my name.',
  'I am not who you think I am.', 'I was here before you noticed me.', "I don't want to go back.",
  "I can't explain why I came.", "Don't leave me alone.", 'I used to be able to sing.', "I'm tired.",
  'Thank you for seeing me.', 'I came for you.', 'It hurts to stand here.',
];

// two rip currents cross the Shallows (z ranges)
export const RIPS = [[6.5, 13.5], [25.5, 32.5]];
export const inRip = (x, z) => x > WORLD.B1 + 1 && x < WORLD.B2 - 0.5 && RIPS.some(([a, b]) => z > a && z < b);

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const night = p => CONST.NIGHT * (p.night || 1);
const low = p => CONST.LOW * (p.night || 1);
export function dawnTime(p) { return CONST.START + night(p) + CONST.GRACE; }
export function tideState(t, p) {
  const C = night(p) / p.tides, L = low(p);
  if (t < CONST.START) return { low: false, phase: 'deep', tide: 0, next: CONST.START + C - L };
  const end = CONST.START + night(p);
  if (t >= end) return { low: false, phase: 'dawn-near', tide: p.tides + 1, next: dawnTime(p) };
  const k = Math.floor((t - CONST.START) / C);
  const into = t - CONST.START - k * C;
  const isLow = into >= C - L;
  return { low: isLow, phase: isLow ? 'low' : 'high', tide: k + 1, next: CONST.START + k * C + (isLow ? C : C - L) };
}

const cap = k => k[0].toUpperCase() + k.slice(1);

export function createSim(params, seed) {
  const p = { ...DEFAULTS, ...params };
  const rnd = mulberry32(seed);
  const { W, D, B1, B2 } = WORLD;
  const ldX = () => p.far ? 95 : WORLD.LD_X;
  const m = [];
  const order = [...Array(p.merfolk).keys()].sort(() => rnd() - 0.5);
  const giverIds = new Set(order.slice(0, Math.min(p.givers, p.merfolk)));
  const msgs = [...MESSAGES].sort(() => rnd() - 0.5);
  for (let i = 0; i < p.merfolk; i++) {
    m.push({
      id: i,
      x: 3 + rnd() * 35, z: 2 + rnd() * (D - 4),
      vx: 0, vz: 0, heading: rnd() * Math.PI * 2,
      r: { voice: true, hands: true, sight: true, walking: true },
      zone: 0, giver: giverIds.has(i), bornGiver: giverIds.has(i),
      helped: false, gave: 0, understood: false, attention: 0,
      foam: false, cooldown: 0, ledBy: -1, attendedBy: -1, crossedTide: 0,
      message: msgs[i % msgs.length],
      // people
      human: false, name: '', inX: 0, inZ: 0, holdWant: false, holding: -1, holdT: 0,
      signal: 0, humT: 0, choosing: false,
    });
  }
  const ld = [];
  const newDweller = id => ({ id, x: 0, z: 0, facing: false, target: -1, wait: expWait(), lookTime: 0 });
  for (let j = 0; j < p.dwellers; j++) ld.push(newDweller(j));
  const events = [];
  const s = {
    p, seed, t: 0, m, ld, events, over: false,
    stats: { shore: 0, understood: 0, foam: 0, gifts: 0, leads: 0, giversStuck: 0, crossings1: 0 },
    stories: m.map(() => []), help: [],
  };
  placeDwellers();
  const tell = (id, kind, text, extra = {}) => { if (m[id].human) s.stories[id].push({ t: s.t, kind, text, ...extra }); };

  function expWait() { return 1 + (-Math.log(1 - rnd())) * (2 + 40 * p.busy); }
  const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
  const nonVoice = a => (a.r.hands ? 1 : 0) + (a.r.sight ? 1 : 0) + (a.r.walking ? 1 : 0);
  // one border per low tide; Voice for the first, two more (keeping one) for the second
  const canPay = (a, border, tide) => tide.low && a.crossedTide !== tide.tide && (border === 1 ? a.r.voice : nonVoice(a) >= 3);
  const lacks = a => (!a.r.walking ? 'walking' : !a.r.sight ? 'sight' : !a.r.hands ? 'hands' : null);
  const active = a => !a.foam && !a.understood;
  const name = a => a.human ? a.name : `#${a.id + 1}`;

  function pay(a, border, tide, chosen) {
    a.crossedTide = tide.tide;
    let paid;
    if (border === 1) { a.r.voice = false; s.stats.crossings1++; paid = ['voice']; }
    else {
      // "two more abilities of your choice": people choose; the model's merfolk keep one at random
      const keep = chosen || (p.keep === 'random' ? ['hands', 'sight', 'walking'][Math.floor(rnd() * 3)] : p.keep);
      paid = ['hands', 'sight', 'walking'].filter(k => k !== keep);
      for (const k of paid) a.r[k] = false;
      s.stats.shore++;
    }
    a.zone = border;
    events.push({ type: 'cross', id: a.id, border, paid, t: s.t });
    tell(a.id, 'pay', border === 1 ? 'The Sea Witch took your Voice.'
      : `The Sea Witch took your ${paid.map(cap).join(' and ')}. You kept your ${cap(['hands', 'sight', 'walking'].find(k => !paid.includes(k)))}.`);
  }

  function give(a, b, need) {
    a.r[need] = false; b.r[need] = true;
    a.gave++; b.helped = true; a.cooldown = 3; b.cooldown = 3;
    s.stats.gifts++;
    if (p.kinder && !b.giver && !b.human && rnd() < CONST.KIND_P) b.giver = true;
    events.push({ type: 'gift', from: a.id, to: b.id, ribbon: need, t: s.t });
    s.help.push({ type: 'gift', from: a.id, to: b.id, ribbon: need, t: s.t });
    tell(a.id, 'gave', `You gave your ${cap(need)} to ${name(b)}.`);
    tell(b.id, 'got', `${name(a)} gave you their ${cap(need)}.`);
  }

  function endHold(a) {
    if (a.holding < 0) return;
    const b = m[a.holding];
    const dur = s.t - a.holdT;
    if (dur > 1.5) {
      s.help.push({ type: 'lead', from: a.id, to: b.id, t: a.holdT, dur });
      s.stats.leads++;
      tell(a.id, 'led', `You held ${name(b)}’s hand for ${Math.round(dur)} seconds.`);
      tell(b.id, 'wasled', `${name(a)} held your hand for ${Math.round(dur)} seconds.`);
    }
    events.push({ type: 'hold', from: a.id, to: b.id, on: false, t: s.t });
    a.holding = -1;
  }

  function step() {
    if (s.over) return;
    const dt = CONST.DT;
    s.t += dt;
    const tide = tideState(s.t, p);
    const humming = m.filter(h => h.human && h.humT > 0 && h.zone === 0 && h.r.voice);

    // --- everyone decides where to go
    for (const a of m) {
      if (a.foam) continue;
      a.cooldown = Math.max(0, a.cooldown - dt);
      a.signal = Math.max(0, a.signal - dt);
      a.humT = Math.max(0, a.humT - dt);
      let gx = 0, gz = 0, speed = CONST.SPEED;
      a.ledBy = -1;

      if (!a.r.walking) {
        // moves only while someone who can walk is right next to her (or holds her hand: see below)
        let best = null, bd = CONST.REACH;
        for (const b of m) if (b !== a && !b.foam && b.r.walking) { const d = dist(a, b); if (d < bd) { bd = d; best = b; } }
        if (best) { a.ledBy = best.id; a.vx = best.vx * 0.8; a.vz = best.vz * 0.8; }
        else { a.vx = 0; a.vz = 0; }
        continue;
      }
      if (a.human) {
        gx = a.inX; gz = a.inZ;
        if (a.understood) speed *= 0.6;
        if (!a.r.sight) speed *= 0.7;
      } else if (!a.r.sight) {
        // drifts: wanders with no goal, slower
        a.heading += (rnd() - 0.5) * 1.2;
        gx = Math.cos(a.heading); gz = Math.sin(a.heading); speed *= 0.45;
      } else {
        let goal = null;
        // givers look for someone nearby who is missing something they still have (a raised hand is seen from further)
        if (a.giver && a.r.hands && a.cooldown === 0 && !a.understood) {
          let best = null, bd = Infinity;
          for (const b of m) {
            if (b === a || !active(b)) continue;
            const need = lacks(b);
            if (!need || !a.r[need]) continue;
            const d = dist(a, b);
            const reach = b.signal > 0 ? CONST.SIGNAL_R : CONST.SIGHT_R;
            if (d < reach && d < bd) { bd = d; best = b; }
          }
          if (best) {
            if (bd <= CONST.REACH) {
              give(a, best, lacks(best));
              if (!a.r.walking) { a.vx = a.vz = 0; continue; }
            } else goal = { x: best.x, z: best.z };
          }
        }
        // someone is humming in the Deep: the school gathers around the song
        if (!goal && a.zone === 0) for (const h of humming) { const d = dist(a, h); if (d < 14 && d > 2.5) { goal = { x: h.x, z: h.z }; break; } }
        if (!goal) {
          if (a.understood) { gx = gz = 0; speed = 0; }
          else if (a.zone < 2) {
            const bx = a.zone === 0 ? B1 : B2;
            const open = canPay(a, a.zone + 1, tide);
            let gzz = a.z + (open ? 0 : (rnd() - 0.5) * 2);
            // the model's merfolk swim around the rip currents
            if (p.rips && a.zone === 1 && tide.low) for (const [r0, r1] of RIPS) if (a.z > r0 - 1 && a.z < r1 + 1) gzz = a.z < (r0 + r1) / 2 ? r0 - 1.6 : r1 + 1.6;
            goal = open ? { x: bx + 3, z: gzz } : { x: bx - 1.2, z: gzz };
          } else {
            let best = null, bd = 1e9;
            for (const l of ld) { const d = dist(a, l); if (d < bd) { bd = d; best = l; } }
            if (best && bd > 2.2) goal = { x: best.x - 1.5, z: best.z };
            else speed = 0;
          }
        }
        if (goal) {
          const dx = goal.x - a.x, dz = goal.z - a.z, L = Math.hypot(dx, dz) || 1;
          gx = dx / L; gz = dz / L;
          if (L < 0.5) speed *= L / 0.5;
        }
      }
      // soft separation
      let sx = 0, sz = 0;
      for (const b of m) {
        if (b === a || b.foam || b.id === a.holding || a.id === b.holding) continue;
        const d = dist(a, b);
        if (d < 1.1 && d > 0) { sx += (a.x - b.x) / d * (1.1 - d); sz += (a.z - b.z) / d * (1.1 - d); }
      }
      const tvx = gx * speed + sx * 3, tvz = gz * speed + sz * 3;
      const ease = a.human ? 0.45 : 0.25;
      a.vx += (tvx - a.vx) * ease; a.vz += (tvz - a.vz) * ease;
    }

    // --- holding hands: people take a hand (R), and lead whoever they hold.
    for (const a of m) {
      if (!a.human || a.foam) continue;
      if (a.holding >= 0) {
        const b = m[a.holding];
        if (!a.holdWant || b.foam || !a.r.walking || dist(a, b) > 2.8) endHold(a);
      } else if (a.holdWant && a.r.walking && a.cooldown === 0) {
        let best = null, bd = CONST.REACH + 0.5;
        for (const b of m) { if (b === a || b.foam || b.holding === a.id) continue; const d = dist(a, b); if (d < bd) { bd = d; best = b; } }
        if (best) {
          a.holding = best.id; a.holdT = s.t;
          events.push({ type: 'hold', from: a.id, to: best.id, on: true, t: s.t });
          if (!best.r.walking) tell(best.id, 'held', `${name(a)} took your hand.`);
        }
      }
    }
    // the more hands, the faster she goes
    const groups = new Map();
    for (const a of m) if (a.holding >= 0 && !a.foam) { if (!groups.has(a.holding)) groups.set(a.holding, []); groups.get(a.holding).push(a); }
    const groupSize = new Map();
    for (const [bid, hs] of groups) {
      const b = m[bid], n = hs.length;
      const f = b.r.walking ? 1 : Math.min(1, 0.45 + 0.3 * (n - 1));
      let mx = 0, mz = 0;
      for (const h of hs) {
        const sp = Math.hypot(h.vx, h.vz), lim = CONST.SPEED * f;
        if (sp > lim) { h.vx *= lim / sp; h.vz *= lim / sp; }
        // stay close to the one you hold
        const dx = b.x - h.x, dz = b.z - h.z, d = Math.hypot(dx, dz);
        if (d > 1.3) { h.vx += dx / d * (d - 1.3) * 2; h.vz += dz / d * (d - 1.3) * 2; }
        mx += h.vx; mz += h.vz;
      }
      b.vx = mx / n; b.vz = mz / n; b.ledBy = hs[0].id;
      groupSize.set(bid, n + 1); for (const h of hs) groupSize.set(h.id, n + 1);
    }

    // --- rip currents at low tide: alone you are pulled back, a chain of hands holds
    const ripPull = a => (p.rips && tide.low && a.zone === 1 && inRip(a.x, a.z)) ? CONST.RIP / (groupSize.get(a.id) || 1) : 0;

    // the tide came in before she chose: she stays in the Shallows and can choose next time
    if (!tide.low) for (const a of m) if (a.choosing) { a.choosing = false; a.x = Math.min(a.x, B2 - 1.5); a.vx = 0; }

    // --- move, and pay the Witch at the borders
    for (const a of m) {
      if (a.foam) continue;
      let nx = a.x + (a.vx - ripPull(a)) * dt, nz = a.z + a.vz * dt;
      for (const [bx, border] of [[B1, 1], [B2, 2]]) {
        if (a.zone === border - 1 && nx >= bx) {
          if (canPay(a, border, tide)) {
            if (a.human && border === 2) {
              // the Witch asks a person: which one will you keep?
              if (!a.choosing) { a.choosing = true; events.push({ type: 'choose', id: a.id, t: s.t }); }
              nx = bx - 0.05; a.vx = Math.min(a.vx, 0);
            } else pay(a, border, tide);
          } else { nx = bx - 0.05; a.vx = Math.min(a.vx, 0); }
        }
        if (a.zone >= border && nx < bx + 0.05) { nx = bx + 0.05; a.vx = Math.max(a.vx, 0); } // nobody goes back
      }
      a.x = Math.max(0.5, Math.min(W - 0.5, nx));
      a.z = Math.max(0.5, Math.min(D - 0.5, nz));
    }

    // --- Land Dwellers: busy with dinner; a crowd around them makes them turn sooner
    for (const l of ld) {
      if (!l.facing) {
        let crowd = 0;
        for (const a of m) if (a.zone === 2 && active(a) && dist(a, l) < CONST.CROWD_R) crowd++;
        l.crowd = crowd;
        l.wait -= dt * (1 + 1.6 * Math.max(0, crowd - 1));
        if (l.wait <= 0) {
          l.facing = true; l.lookTime = 0;
          let best = null, bd = CONST.NOTICE_R;
          for (const a of m) {
            if (a.zone !== 2 || !active(a) || a.attendedBy !== -1) continue;
            const d = dist(a, l); if (d < bd) { bd = d; best = a; }
          }
          l.target = best ? best.id : -1;
          if (best) { best.attendedBy = l.id; events.push({ type: 'noticed', id: best.id, by: l.id, t: s.t }); tell(best.id, 'noticed', 'A Land Dweller turned around and looked at you.'); }
        }
      } else {
        l.lookTime += dt;
        const a = l.target >= 0 ? m[l.target] : null;
        if (a && active(a) && dist(a, l) <= CONST.NOTICE_R) {
          a.attention += dt;
          if (a.attention >= CONST.UNDERSTAND) {
            a.understood = true; a.attendedBy = -1; s.stats.understood++;
            events.push({ type: 'understood', id: a.id, by: l.id, t: s.t });
            tell(a.id, 'understood', `A Land Dweller understood you: “${a.message}”`);
            turnBack(l);
          }
        } else if (!a || l.lookTime > 1.5) {
          if (a) { a.attendedBy = -1; if (a.human) tell(a.id, 'lost', 'They turned back to their dinner.'); }
          turnBack(l);
        }
      }
    }

    // --- dawn
    if (s.t >= dawnTime(p)) {
      for (const a of m) if (a.holding >= 0) endHold(a);
      for (const a of m) if (!a.understood) { a.foam = true; s.stats.foam++; }
      for (const a of m) if (a.bornGiver && a.zone < 2) s.stats.giversStuck++;
      for (const a of m) tell(a.id, 'dawn', a.understood ? 'At dawn, you stayed.' : 'At dawn, you became sea foam.');
      events.push({ type: 'dawn', t: s.t });
      s.over = true;
    }
  }
  function turnBack(l) { l.facing = false; l.target = -1; l.wait = expWait(); }
  function placeDwellers() {
    const n = ld.length;
    ld.forEach((l, j) => { l.x = ldX() + (j % 2 ? 1.5 : -1.5); l.z = (j + 0.5) * D / n; });
  }

  // ---- people
  s.setHuman = (id, nm) => { const a = m[id]; a.human = true; a.name = nm || `#${id + 1}`; a.giver = a.bornGiver = false; };
  s.releaseHuman = id => { const a = m[id]; endHold(a); a.human = false; a.inX = a.inZ = 0; a.holdWant = false; a.choosing = false; };
  s.input = (id, inp) => { const a = m[id]; if (!a) return; a.inX = inp.x || 0; a.inZ = inp.z || 0; a.holdWant = !!inp.hold; };
  s.giveTarget = id => {
    const a = m[id]; if (!a || !active(a) || !a.r.hands || a.cooldown > 0) return null;
    let best = null, bd = CONST.REACH + 0.8;
    for (const b of m) {
      if (b === a || !active(b)) continue;
      const need = lacks(b); if (!need || !a.r[need]) continue;
      const d = dist(a, b); if (d < bd) { bd = d; best = b; }
    }
    return best;
  };
  s.give = id => { const b = s.giveTarget(id); if (!b) return null; const need = lacks(b); give(m[id], b, need); return { to: b.id, ribbon: need }; };
  s.choose = (id, keep) => {
    const a = m[id]; if (!a || !a.choosing) return;
    a.choosing = false;
    const tide = tideState(s.t, p);
    if (!tide.low) return;        // the tide came back in while she was choosing
    pay(a, 2, tide, keep);
    a.x = B2 + 0.6;
  };
  s.decline = id => { const a = m[id]; if (!a) return; a.choosing = false; a.x = B2 - 1.5; a.vx = 0; };
  s.hum = id => { const a = m[id]; if (!a || !a.r.voice || a.zone !== 0) return false; if (a.humT <= 0) tell(id, 'hum', 'You hummed, and the school gathered around you.'); a.humT = 5; return true; };
  s.raise = id => { const a = m[id]; if (!a || !active(a)) return false; a.signal = 6; events.push({ type: 'signal', id, t: s.t }); return true; };
  s.lacks = lacks;
  s.canPay = canPay;

  // ---- live changes (experiment panel)
  s.setGivers = n => {
    p.givers = n;
    order.forEach((id, k) => { const a = m[id]; if (a.human) return; const g = k < n; if (a.bornGiver !== g) { a.bornGiver = g; a.giver = g || (a.helped && a.giver); } });
  };
  s.setDwellers = n => {
    p.dwellers = n;
    while (ld.length > n) { const l = ld.pop(); if (l.target >= 0) m[l.target].attendedBy = -1; }
    while (ld.length < n) ld.push(newDweller(ld.length));
    placeDwellers();
  };
  s.setFar = f => { p.far = f; placeDwellers(); };
  s.step = step;
  s.run = () => { while (!s.over) step(); return s.stats; };
  return s;
}
