// ===== Ashore simulation core (no rendering) =====
// World: x runs from the Deep Sea (0) to the Shore (100); z is the width of the room.
export const WORLD = { W: 100, D: 40, B1: 50, B2: 72, LD_X: 83 };
export const RIB = ['voice', 'hands', 'sight', 'walking'];
export const RIB_COLOR = { voice: 0xF2EFE6, hands: 0xD9483B, sight: 0x3E7FC9, walking: 0xE8B931 };

export const DEFAULTS = {
  merfolk: 30,       // how many merfolk
  givers: 6,         // how many of them are givers
  dwellers: 3,       // how many Land Dwellers
  busy: 0.6,         // 0 = always turning around, 1 = almost never
  tides: 3,          // how many low tides before dawn
  kinder: true,      // being helped makes you more likely to help
  far: false,        // Land Dwellers stand far up the shore instead of near the water
  keep: 'random',    // which ability merfolk keep when they pay two at the Shore
  player: false,     // merfolk #0 is played by a person
};

// the larp's message cards
export const MESSAGES = [
  'I saved you once.', 'I gave up my home to be here.', 'I miss the sea.', 'Please remember my name.',
  'I am not who you think I am.', 'I was here before you noticed me.', "I don't want to go back.",
  "I can't explain why I came.", "Don't leave me alone.", 'I used to be able to sing.', "I'm tired.",
  'Thank you for seeing me.', 'I came for you.', 'It hurts to stand here.',
];

export const CONST = {
  DT: 0.1,
  START: 15,         // the Deep: nobody can cross yet
  NIGHT: 165,        // time shared by all tides
  LOW: 10,           // a low tide lasts this long (borders open)
  GRACE: 10,         // time after the last low tide before dawn
  SPEED: 4,
  SIGHT_R: 8,        // how far a merfolk with Sight can see
  REACH: 1.6,        // close enough to touch, lead or gift
  NOTICE_R: 12,      // how close a Land Dweller has to be to notice you
  UNDERSTAND: 10,    // seconds of attention needed
  KIND_P: 0.5,       // chance a helped merfolk becomes a giver
};

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

export function dawnTime(p) { return CONST.START + CONST.NIGHT + CONST.GRACE; }

export function tideState(t, p) {
  if (t < CONST.START) return { low: false, phase: 'deep', next: CONST.START + cycle(p) - CONST.LOW };
  const end = CONST.START + CONST.NIGHT;
  if (t >= end) return { low: false, phase: 'dawn-near', next: dawnTime(p) };
  const C = cycle(p);
  const k = Math.floor((t - CONST.START) / C);
  const into = t - CONST.START - k * C;
  const low = into >= C - CONST.LOW;
  return { low, phase: low ? 'low' : 'high', tide: k + 1, next: CONST.START + k * C + (low ? C : C - CONST.LOW) };
}
function cycle(p) { return CONST.NIGHT / p.tides; }

export function createSim(params, seed) {
  const p = { ...DEFAULTS, ...params };
  const rnd = mulberry32(seed);
  const { W, D, B1, B2 } = WORLD;
  const ldX = () => p.far ? 95 : WORLD.LD_X;
  const m = [];
  const giverIds = new Set();
  let order = [...Array(p.merfolk).keys()].sort(() => rnd() - 0.5);
  if (p.player) order = order.filter(i => i !== 0).concat([0]);   // the player is never an automatic giver
  for (let i = 0; i < Math.min(p.givers, p.merfolk); i++) giverIds.add(order[i]);
  for (let i = 0; i < p.merfolk; i++) {
    m.push({
      id: i,
      x: 3 + rnd() * 35, z: 2 + rnd() * (D - 4),
      vx: 0, vz: 0, heading: rnd() * Math.PI * 2,
      r: { voice: true, hands: true, sight: true, walking: true },
      zone: 0, giver: giverIds.has(i), bornGiver: giverIds.has(i),
      helped: false, gave: 0, understood: false, attention: 0,
      foam: false, cooldown: 0, ledBy: -1, attendedBy: -1, crossedTide: 0,
      message: MESSAGES[Math.floor(rnd() * MESSAGES.length)],
      isPlayer: p.player && i === 0, inX: 0, inZ: 0,
    });
  }
  const ld = [];
  for (let j = 0; j < p.dwellers; j++) {
    ld.push({
      id: j, x: ldX() + (j % 2 ? 1.5 : -1.5), z: (j + 0.5) * D / p.dwellers,
      facing: false, target: -1, wait: expWait(), lookTime: 0, bored: 0,
    });
  }
  const events = [];      // gifts, crossings, understood — for the view to animate
  const s = { p, seed, t: 0, m, ld, events, over: false,
    stats: { shore: 0, understood: 0, foam: 0, gifts: 0, giversStuck: 0, crossings1: 0 },
    // player only
    player: p.player ? m[0] : null, story: [], humT: 0, playerRate: 0, choosing: false };
  const tell = (kind, text, extra = {}) => { s.story.push({ t: s.t, kind, text, ...extra }); };

  function expWait() { return 1 + (-Math.log(1 - rnd())) * (2 + 40 * p.busy); }
  const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
  const nonVoice = a => (a.r.hands ? 1 : 0) + (a.r.sight ? 1 : 0) + (a.r.walking ? 1 : 0);
  // one border per low tide; Voice for the first, two more (keeping one) for the second
  const canPay = (a, border, tide) => tide.low && a.crossedTide !== tide.tide && (border === 1 ? a.r.voice : nonVoice(a) >= 3);
  const lacks = a => (!a.r.walking ? 'walking' : !a.r.sight ? 'sight' : !a.r.hands ? 'hands' : null);
  const active = a => !a.foam && !a.understood;

  function pay(a, border, tide, chosen) {
    a.crossedTide = tide.tide;
    let paid;
    if (border === 1) { a.r.voice = false; s.stats.crossings1++; paid = ['voice']; }
    else {
      // "two more abilities of your choice": the person chooses; others keep one at random
      const keep = chosen || (p.keep === 'random' ? ['hands', 'sight', 'walking'][Math.floor(rnd() * 3)] : p.keep);
      paid = ['hands', 'sight', 'walking'].filter(k => k !== keep);
      for (const k of paid) a.r[k] = false;
      s.stats.shore++;
    }
    a.zone = border;
    events.push({ type: 'cross', id: a.id, border, paid, t: s.t });
    if (a.isPlayer) tell('pay', border === 1 ? 'You gave the Sea Witch your Voice.' : `You gave the Sea Witch your ${paid.map(cap).join(' and ')}, and kept your ${cap(['hands','sight','walking'].find(k => !paid.includes(k)))}.`, { paid });
  }
  const cap = k => k[0].toUpperCase() + k.slice(1);

  function give(a, b, need) {
    a.r[need] = false; b.r[need] = true;
    a.gave++; b.helped = true; a.cooldown = 3; b.cooldown = 3;
    s.stats.gifts++;
    if (p.kinder && !b.giver && !b.isPlayer && rnd() < CONST.KIND_P) b.giver = true;
    events.push({ type: 'gift', from: a.id, to: b.id, ribbon: need, t: s.t });
    if (a.isPlayer) tell('gave', `You gave your ${cap(need)} to #${b.id + 1}.`, { ribbon: need, to: b.id });
    if (b.isPlayer) tell('got', `#${a.id + 1} gave you their ${cap(need)}.`, { ribbon: need, from: a.id });
  }

  function step() {
    if (s.over) return;
    const dt = CONST.DT;
    s.t += dt;
    const tide = tideState(s.t, p);
    s.humT = Math.max(0, s.humT - dt);

    // --- merfolk decide where to go
    for (const a of m) {
      if (a.foam) continue;
      a.cooldown = Math.max(0, a.cooldown - dt);
      let gx = 0, gz = 0, speed = CONST.SPEED;
      a.ledBy = -1;

      if (!a.r.walking) {
        // moves only while someone who can walk is right next to her
        let best = null, bd = CONST.REACH;
        for (const b of m) if (b !== a && !b.foam && b.r.walking) { const d = dist(a, b); if (d < bd) { bd = d; best = b; } }
        if (best) { a.ledBy = best.id; a.vx = best.vx * 0.8; a.vz = best.vz * 0.8; }
        else { a.vx = 0; a.vz = 0; }
        continue;
      }
      if (a.isPlayer) {
        // a person decides where to go; blind or not, she can still try
        gx = a.inX; gz = a.inZ;
        if (a.understood) speed = 0;
        if (!a.r.sight) speed *= 0.7;
      } else if (!a.r.sight) {
        // drifts: wanders with no goal, slower
        a.heading += (rnd() - 0.5) * 1.2;
        gx = Math.cos(a.heading); gz = Math.sin(a.heading); speed *= 0.45;
      } else {
        let goal = null;
        // givers look for someone nearby who is missing something they still have
        if (a.giver && a.r.hands && a.cooldown === 0 && !a.understood) {
          let best = null, bd = CONST.SIGHT_R;
          for (const b of m) {
            if (b === a || !active(b)) continue;
            const need = lacks(b);
            if (!need || !a.r[need]) continue;
            const d = dist(a, b);
            if (d < bd) { bd = d; best = b; }
          }
          if (best) {
            if (bd <= CONST.REACH) {
              give(a, best, lacks(best));
              if (!a.r.walking) { a.vx = a.vz = 0; continue; }
            } else goal = { x: best.x, z: best.z };
          }
        }
        // someone is humming nearby in the Deep: the school gathers around the song
        const pl = s.player;
        if (!goal && s.humT > 0 && pl && a.zone === 0 && pl.zone === 0 && dist(a, pl) < 14 && dist(a, pl) > 2.5) goal = { x: pl.x, z: pl.z };
        if (!goal) {
          if (a.understood) { gx = gz = 0; speed = 0; }
          else if (a.zone < 2) {
            const bx = a.zone === 0 ? B1 : B2;
            const open = canPay(a, a.zone + 1, tide);
            goal = open ? { x: bx + 3, z: a.z } : { x: bx - 1.2, z: a.z + (rnd() - 0.5) * 2 };
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
        if (b === a || b.foam) continue;
        const d = dist(a, b);
        if (d < 1.1 && d > 0) { sx += (a.x - b.x) / d * (1.1 - d); sz += (a.z - b.z) / d * (1.1 - d); }
      }
      const tvx = gx * speed + sx * 3, tvz = gz * speed + sz * 3;
      const ease = a.isPlayer ? 0.45 : 0.25;
      a.vx += (tvx - a.vx) * ease; a.vz += (tvz - a.vz) * ease;
    }

    // --- move, and pay the Witch at the borders
    for (const a of m) {
      if (a.foam) continue;
      let nx = a.x + a.vx * dt, nz = a.z + a.vz * dt;
      for (const [bx, border] of [[B1, 1], [B2, 2]]) {
        if (a.zone === border - 1 && nx >= bx) {
          if (canPay(a, border, tide)) {
            if (a.isPlayer && border === 2) {
              // the Witch asks: which one will you keep? (the game pauses and shows the choice)
              if (!s.choosing) { s.choosing = true; events.push({ type: 'choose', id: a.id, t: s.t }); }
              nx = bx - 0.05; a.vx = Math.min(a.vx, 0);
            } else pay(a, border, tide);
          }
          else { nx = bx - 0.05; a.vx = Math.min(a.vx, 0); }
        }
        if (a.zone >= border && nx < bx + 0.05) { nx = bx + 0.05; a.vx = Math.max(a.vx, 0); } // nobody goes back
      }
      a.x = Math.max(0.5, Math.min(W - 0.5, nx));
      a.z = Math.max(0.5, Math.min(D - 0.5, nz));
    }

    // --- Land Dwellers
    for (const l of ld) {
      if (!l.facing) {
        l.wait -= dt;
        // the player can catch their attention with what she has left
        const pl = s.player;
        if (pl && active(pl) && pl.zone === 2) {
          const d = dist(pl, l);
          if (pl.r.walking && d < 3.5 && pl.x > l.x + 0.3) l.wait -= dt * 3;   // stepped into their view
          if (pl.r.sight && d < 4.5) l.wait -= dt * 1.2;                        // holding their gaze
        }
        if (l.wait <= 0) {
          l.facing = true; l.lookTime = 0;
          let best = null, bd = CONST.NOTICE_R;
          for (const a of m) {
            if (a.zone !== 2 || !active(a) || a.attendedBy !== -1) continue;
            const d = dist(a, l); if (d < bd) { bd = d; best = a; }
          }
          l.target = best ? best.id : -1;
          if (best) best.attendedBy = l.id;
          l.bored = 0;
          if (best && best.isPlayer) { events.push({ type: 'noticed', id: best.id, by: l.id, t: s.t }); tell('noticed', 'A Land Dweller turned around and looked at you.'); }
        }
      } else {
        l.lookTime += dt;
        const a = l.target >= 0 ? m[l.target] : null;
        if (a && a.isPlayer && active(a) && dist(a, l) <= CONST.NOTICE_R) {
          // the person has to make them understand (the game sets playerRate from the mini-game)
          a.attention += dt * s.playerRate;
          l.bored = s.playerRate > 0.15 ? 0 : l.bored + dt;
          if (a.attention >= CONST.UNDERSTAND) {
            a.understood = true; a.attendedBy = -1; s.stats.understood++;
            events.push({ type: 'understood', id: a.id, by: l.id, t: s.t });
            tell('understood', `A Land Dweller turned around and said: “${a.message}”`);
            turnBack(l);
          } else if (l.bored > 3) {
            a.attendedBy = -1; turnBack(l);
            events.push({ type: 'lost', id: a.id, by: l.id, t: s.t });
            tell('lost', 'They turned back to their dinner before they understood.');
          }
        } else if (a && active(a) && dist(a, l) <= CONST.NOTICE_R) {
          a.attention += dt;
          if (a.attention >= CONST.UNDERSTAND) {
            a.understood = true; a.attendedBy = -1; s.stats.understood++;
            events.push({ type: 'understood', id: a.id, by: l.id, t: s.t });
            turnBack(l);
          }
        } else if (!a || l.lookTime > 1.5) {
          if (a) a.attendedBy = -1;
          turnBack(l);
        }
      }
    }

    // --- dawn
    if (s.t >= dawnTime(p)) {
      for (const a of m) if (!a.understood) { a.foam = true; s.stats.foam++; }
      for (const a of m) if (a.bornGiver && a.zone < 2) s.stats.giversStuck++;
      if (s.player) tell('dawn', s.player.understood ? 'At dawn, you stayed.' : 'At dawn, you became sea foam.');
      events.push({ type: 'dawn', t: s.t });
      s.over = true;
    }
  }
  function turnBack(l) { l.facing = false; l.target = -1; l.wait = expWait(); l.bored = 0; }

  // live changes while it runs
  s.setGivers = n => {
    p.givers = n;
    order.forEach((id, k) => { const a = m[id]; const g = k < n; if (a.bornGiver !== g) { a.bornGiver = g; a.giver = g || (a.helped && a.giver); } });
  };
  s.setDwellers = n => {
    p.dwellers = n;
    while (ld.length > n) { const l = ld.pop(); if (l.target >= 0) m[l.target].attendedBy = -1; }
    while (ld.length < n) ld.push({ id: ld.length, x: 0, z: 0, facing: false, target: -1, wait: expWait(), lookTime: 0 });
    ld.forEach((l, j) => { l.x = ldX() + (j % 2 ? 1.5 : -1.5); l.z = (j + 0.5) * D / n; });
  };
  s.setFar = f => { p.far = f; s.setDwellers(ld.length); };
  // ---- what the person can do
  const giveTarget = () => {
    const a = s.player; if (!a || !active(a) || !a.r.hands || a.cooldown > 0) return null;
    let best = null, bd = CONST.REACH + 0.8;
    for (const b of m) {
      if (b === a || !active(b)) continue;
      const need = lacks(b); if (!need || !a.r[need]) continue;
      const d = dist(a, b); if (d < bd) { bd = d; best = b; }
    }
    return best;
  };
  s.giveTarget = giveTarget;
  s.lacks = lacks;
  s.playerGive = () => { const b = giveTarget(); if (!b) return null; const need = lacks(b); give(s.player, b, need); return { to: b, ribbon: need }; };
  s.playerChoose = keep => {
    const a = s.player; if (!a || !s.choosing) return;
    s.choosing = false;
    const tide = tideState(s.t, p);
    pay(a, 2, tide.low ? tide : { ...tide, tide: a.crossedTide + 1 }, keep);
    a.x = B2 + 0.6;
  };
  s.playerDecline = () => { s.choosing = false; if (s.player) { s.player.x = B2 - 1.5; s.player.vx = 0; } };
  s.playerHum = () => {
    const a = s.player; if (!a || !a.r.voice || a.zone !== 0) return false;
    if (s.humT <= 0) tell('hum', 'You hummed, and the school gathered around you.');
    s.humT = 5; return true;
  };
  s.playerTap = () => {
    // a touch on the shoulder (needs Hands): the nearest Land Dweller turns soon
    const a = s.player; if (!a || !active(a) || a.zone !== 2 || !a.r.hands) return false;
    let best = null, bd = 2.6;
    for (const l of ld) { const d = dist(a, l); if (d < bd && !l.facing) { bd = d; best = l; } }
    if (!best) return false;
    best.wait = Math.min(best.wait, 0.6); return true;
  };
  s.canPay = canPay;
  s.step = step;
  s.run = () => { while (!s.over) step(); return s.stats; };
  return s;
}
