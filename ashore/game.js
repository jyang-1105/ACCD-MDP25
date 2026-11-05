// Ashore — the game: play as one merfolk, or watch the whole night as an experiment.
import * as THREE from 'three';
import { createWorld, W, ground, B1, B2 } from './world.js';
import { Merfolk, Dweller, RIB, RIB_HEX } from './chars.js';
import { createSim, tideState, dawnTime, CONST, DEFAULTS } from './sim.js';

const Q = new URLSearchParams(location.search);
const $ = id => document.getElementById(id);
const cap = k => k[0].toUpperCase() + k.slice(1);
const fmt = t => { const s = Math.max(0, Math.round(t)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const RIB_CSS = { voice: 'var(--voice)', hands: 'var(--hands)', sight: 'var(--sight)', walking: 'var(--walking)' };

const world = createWorld($('stage'), { lowQuality: Q.has('low') });
const { scene, camera } = world;
function onResize() { world.resize(innerWidth, innerHeight); }
addEventListener('resize', onResize); onResize();

// =====================================================================================
// sound (all generated, no files)
// =====================================================================================
const sound = {
  ctx: null,
  init() {
    if (this.ctx) { this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    const ctx = this.ctx = new AC();
    this.master = ctx.createGain(); this.master.gain.value = 0.8; this.master.connect(ctx.destination);
    // ocean: filtered noise with slow swells
    const len = ctx.sampleRate * 4, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    let b = 0; for (let i = 0; i < len; i++) { b = (b + (Math.random() * 2 - 1) * 0.02) * 0.998; d[i] = b * 3; }
    const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 700;
    this.oceanGain = ctx.createGain(); this.oceanGain.gain.value = 0;
    const swell = ctx.createGain(); swell.gain.value = 0.6;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 1 / 7; const lfoG = ctx.createGain(); lfoG.gain.value = 0.4;
    lfo.connect(lfoG); lfoG.connect(swell.gain); lfo.start();
    src.connect(lp); lp.connect(swell); swell.connect(this.oceanGain); this.oceanGain.connect(this.master); src.start();
    // humming: a soft chord sung by many voices
    this.humGain = ctx.createGain(); this.humGain.gain.value = 0; this.humGain.connect(this.master);
    [196, 246.9, 293.7, 392, 220].forEach((f, i) => {
      const o = ctx.createOscillator(); o.type = i % 2 ? 'triangle' : 'sine'; o.frequency.value = f;
      const v = ctx.createOscillator(); v.frequency.value = 0.15 + i * 0.07; const vg = ctx.createGain(); vg.gain.value = f * 0.004;
      v.connect(vg); vg.connect(o.frequency); v.start();
      const g = ctx.createGain(); g.gain.value = [0.5, 0.3, 0.3, 0.12, 0.2][i];
      o.connect(g); g.connect(this.humGain); o.start();
    });
    // your own voice when you hum
    this.meGain = ctx.createGain(); this.meGain.gain.value = 0; this.meGain.connect(this.master);
    const me = ctx.createOscillator(); me.type = 'sine'; me.frequency.value = 330;
    const mv = ctx.createOscillator(); mv.frequency.value = 5; const mvg = ctx.createGain(); mvg.gain.value = 4; mv.connect(mvg); mvg.connect(me.frequency); mv.start();
    me.connect(this.meGain); me.start();
  },
  set(gainNode, v, t = 0.6) { if (this.ctx && gainNode) gainNode.gain.setTargetAtTime(v, this.ctx.currentTime, t); },
  bell(freq = 523, vol = 0.5, len = 4) {
    if (!this.ctx) return; const ctx = this.ctx, t0 = ctx.currentTime;
    [[1, 1, 1.4], [2.76, 0.45, 2.2], [5.4, 0.25, 3.5], [8.93, 0.12, 5], [0.5, 0.35, 0.9]].forEach(([r, a, dc]) => {
      const o = ctx.createOscillator(); o.frequency.value = freq * r; const g = ctx.createGain();
      g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(vol * a * 0.4, t0 + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t0 + len / dc * 1.4);
      o.connect(g); g.connect(this.master); o.start(t0); o.stop(t0 + len);
    });
  },
  whoosh(vol = 0.35) {
    if (!this.ctx) return; const ctx = this.ctx, t0 = ctx.currentTime;
    const len = ctx.sampleRate * 1.2, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.sin(Math.PI * i / len);
    const s = ctx.createBufferSource(); s.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 2; f.frequency.setValueAtTime(400, t0); f.frequency.exponentialRampToValueAtTime(2400, t0 + 1.1);
    const g = ctx.createGain(); g.gain.value = vol;
    s.connect(f); f.connect(g); g.connect(this.master); s.start();
  },
  pluck(freq = 660, vol = 0.25) {
    if (!this.ctx) return; const ctx = this.ctx, t0 = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = freq; const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.8);
    o.connect(g); g.connect(this.master); o.start(); o.stop(t0 + 0.9);
  },
};

// =====================================================================================
// state
// =====================================================================================
let mode = 'title';                 // title | play | watch
let params = { ...DEFAULTS };
let seed = 1 + Math.floor(Math.random() * 99999);
let sim = null, mer = [], dw = [];
let speed = 1, paused = false, acc = 0, modal = null, focus = -1, fast = false;
let prevLow = false, prevPhase = '';
const flyers = [], bubblesEl = $('bubbles'), bubbles = [];
const pendingIn = new Map();        // `${id}:${ribbon}` -> ribbons still flying to her
const sinking = new Map();          // id -> seconds since dawn
let endingShown = false, whiteK = 0, darkK = 0;
const history = [];

function newNight(p, s = seed) {
  mer.forEach(m => m.dispose()); dw.forEach(d => d.dispose());
  flyers.forEach(f => scene.remove(f.sprite)); flyers.length = 0;
  bubbles.forEach(b => b.el.remove()); bubbles.length = 0;
  pendingIn.clear(); sinking.clear();
  sim = createSim(p, s);
  mer = sim.m.map(a => new Merfolk(scene, a.id));
  dw = sim.ld.map((l, j) => new Dweller(scene, j));
  world.buildDinner(p.far);
  acc = 0; prevLow = false; prevPhase = ''; endingShown = false; whiteK = 0; fast = false; paused = false;
  mini.active = false;
}
function syncDwellers() {
  while (dw.length > sim.ld.length) dw.pop().dispose();
  while (dw.length < sim.ld.length) dw.push(new Dweller(scene, dw.length));
}

// =====================================================================================
// screens
// =====================================================================================
function show(id, on = true) { $(id).classList.toggle('hidden', !on); }
function toTitle() {
  mode = 'title'; modal = null; focus = -1;
  ['hud', 'choice', 'mini', 'ending', 'watchUI', 'intro'].forEach(id => show(id, false));
  show('title');
  params = { ...params, player: false };
  newNight(params, 1 + Math.floor(Math.random() * 99999));
  speed = 1;
}
function startIntro() {
  sound.init();
  seed = 1 + Math.floor(Math.random() * 99999);
  params = { ...params, player: true };
  newNight(params, seed);
  show('title', false); show('intro');
  $('introMsg').textContent = `“${sim.player.message}”`;
  modal = 'intro'; mode = 'play'; focus = 0; speed = 1;
  rig.yaw = Math.PI / 2; rig.dist = 6.5; rig.pitch = 0.3;
}
function beginPlay() {
  show('intro', false); show('hud'); modal = null;
  sound.bell(523, 0.25);
  toast('The sea is deep. Swim.');
}
function startWatch() {
  sound.init();
  mode = 'watch'; modal = null; focus = -1; speed = 1;
  params = { ...params, player: false };
  seed = 1 + Math.floor(Math.random() * 99999);
  newNight(params, seed);
  ['title', 'hud', 'choice', 'mini', 'ending', 'intro'].forEach(id => show(id, false));
  show('watchUI'); refreshPanel();
}
$('btnPlay').onclick = startIntro;
$('btnWatch').onclick = startWatch;
$('btnBegin').onclick = beginPlay;
$('btnAgain').onclick = () => { show('ending', false); startIntro(); };
$('btnEndWatch').onclick = () => { show('ending', false); startWatch(); };
$('btnEndMenu').onclick = () => toTitle();
$('wMenu').onclick = () => toTitle();

let toastT = 0;
function toast(text, secs = 4.5) { $('toast').textContent = text; $('toast').style.opacity = 1; toastT = secs; }

function say(text, getPos, secs = 5) {
  const el = document.createElement('div'); el.className = 'bubble'; el.textContent = text;
  bubblesEl.appendChild(el); bubbles.push({ el, getPos, t: secs });
}

// =====================================================================================
// the Witch's choice
// =====================================================================================
document.querySelectorAll('#choice .opt').forEach(b => b.onclick = () => choose(b.dataset.keep));
$('btnNotYet').onclick = () => { sim.playerDecline(); closeChoice(); toast('You stay in the Shallows. The tide will come in.'); };
function openChoice() { modal = 'choice'; show('choice'); sound.bell(392, 0.3); }
function closeChoice() { modal = null; show('choice', false); }
function choose(keep) {
  if (modal !== 'choice') return;
  sim.playerChoose(keep);
  closeChoice();
}

// =====================================================================================
// being understood: a small game of timing
// =====================================================================================
const mini = { active: false, phase: 0, boost: 0, by: -1, flash: 0 };
function miniWindow() {
  const r = sim.player.r;
  return r.hands ? 0.42 : r.sight ? 0.55 : 0.66;   // gestures are easiest to read
}
function miniBright() { return Math.pow(0.5 + 0.5 * Math.sin(mini.phase * Math.PI * 2 / 1.5), 3); }
function miniPress() {
  const a = sim.player;
  if (miniBright() > miniWindow()) {
    a.attention = Math.min(CONST.UNDERSTAND, a.attention + 1.1);
    mini.boost = 1.3; mini.flash = 1;
    sound.pluck(880, 0.18);
    const p = mer[0].g.position;
    for (let i = 0; i < 10; i++) world.fx.sparkles.emit(p.clone().add(new THREE.Vector3((Math.random() - 0.5), 1.5 + Math.random() * 0.5, (Math.random() - 0.5))), new THREE.Vector3(0, 0.8, 0), new THREE.Color(0xffd38a), 1.2);
  } else {
    a.attention = Math.max(0, a.attention - 0.4);
    const l = sim.ld[mini.by]; if (l) l.bored += 0.6;
    sound.pluck(220, 0.12);
  }
}

// =====================================================================================
// input
// =====================================================================================
const keys = new Set();
addEventListener('keydown', e => {
  if (e.repeat) return;
  const k = e.key.toLowerCase();
  keys.add(k);
  if (k === 'escape') {
    if (modal === 'choice') { sim.playerDecline(); closeChoice(); return; }
    if (mode === 'watch' && focus >= 0) { focus = -1; show('follow', false); return; }
    toTitle(); return;
  }
  if (mode === 'play' && modal === 'choice') { if (k === '1') choose('hands'); if (k === '2') choose('sight'); if (k === '3') choose('walking'); return; }
  if (mode === 'play' && !modal && sim && !sim.over) {
    const a = sim.player;
    if (k === ' ') {
      e.preventDefault();
      if (mini.active) miniPress();
      else if (a.zone === 0 && a.r.voice) { if (sim.playerHum()) { sound.set(sound.meGain, 0.12, 0.2); setTimeout(() => sound.set(sound.meGain, 0, 0.8), 2500); toast('You hum. The school gathers around your song.'); } }
      else if (a.zone === 2) { if (sim.playerTap()) toast('You touch their shoulder.'); else if (a.r.hands) toast('Get closer to a Land Dweller to touch their shoulder.'); }
    }
    if (k === 'e') {
      if (!a.r.hands) toast('Without Hands you cannot untie a ribbon.');
      else { const g = sim.playerGive(); if (!g) toast('Nobody within reach is missing something you still have.'); }
    }
    if (k === 'f') { fast = !fast; toast(fast ? 'Time runs faster.' : 'Time runs at its own pace.', 2); }
  }
  if (mode === 'watch' && k === ' ') { e.preventDefault(); paused = !paused; refreshPanel(); }
});
addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
addEventListener('blur', () => keys.clear());

const rig = { yaw: Math.PI / 2, pitch: 0.3, dist: 6.5, oYaw: 1.0, oPitch: 0.55, oDist: 78, oTarget: new THREE.Vector3(5, 0, 0) };
let drag = null;
const canvas = world.renderer.domElement;
canvas.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY }; canvas.setPointerCapture(e.pointerId); });
canvas.addEventListener('pointermove', e => {
  if (!drag) return;
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY;
  if (mode === 'watch' && focus < 0) { rig.oYaw -= dx * 0.005; rig.oPitch = THREE.MathUtils.clamp(rig.oPitch + dy * 0.004, 0.12, 1.35); }
  else { rig.yaw -= dx * 0.005; rig.pitch = THREE.MathUtils.clamp(rig.pitch + dy * 0.004, 0.05, 1.2); }
});
canvas.addEventListener('pointerup', e => {
  if (drag && mode === 'watch' && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) < 6) pick(e.clientX, e.clientY);
  drag = null;
});
canvas.addEventListener('wheel', e => {
  e.preventDefault();
  const k = Math.exp(Math.sign(e.deltaY) * 0.1);
  if (mode === 'watch' && focus < 0) rig.oDist = THREE.MathUtils.clamp(rig.oDist * k, 12, 170);
  else rig.dist = THREE.MathUtils.clamp(rig.dist * k, 2.5, 18);
}, { passive: false });

function pick(x, y) {
  let best = -1, bd = 40;
  const v = new THREE.Vector3();
  mer.forEach((m, i) => {
    if (sim.m[i].foam) return;
    v.copy(m.g.position).add(new THREE.Vector3(0, 1.2, 0)).project(camera);
    if (v.z > 1) return;
    const sx = (v.x * 0.5 + 0.5) * innerWidth, sy = (-v.y * 0.5 + 0.5) * innerHeight;
    const d = Math.hypot(sx - x, sy - y); if (d < bd) { bd = d; best = i; }
  });
  if (best >= 0) { focus = best; rig.yaw = mer[best].yaw + Math.PI; rig.yaw = mer[best].yaw; rig.dist = 7; show('follow'); }
}

// =====================================================================================
// sim events -> what you see and hear
// =====================================================================================
function fly(from, toFn, ribbon, dur, done) {
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: mer[0].giverOrb.material.map, color: RIB_HEX[ribbon], transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  sprite.scale.setScalar(0.5); scene.add(sprite);
  flyers.push({ sprite, from: from.clone(), toFn, ribbon, k: 0, dur, done, color: new THREE.Color(RIB_HEX[ribbon]) });
}

function handleEvents() {
  for (const e of sim.events) {
    if (e.type === 'cross') {
      const v = mer[e.id], w = world.witches[e.border - 1];
      e.paid.forEach((r, i) => setTimeout(() => fly(v.anchor(RIB.indexOf(r)), () => w.jarWorld, r, 1.4, () => { w.pulse = 1; }), i * 180));
      for (let i = 0; i < 14; i++) world.fx.bubbles.emit(v.g.position.clone().add(new THREE.Vector3(Math.random() - 0.5, 0.8 + Math.random(), Math.random() - 0.5)), new THREE.Vector3(0, 1 + Math.random(), 0), new THREE.Color(0x9fd8ff), 1.6);
      if (sim.m[e.id].isPlayer) {
        sound.whoosh(0.4);
        if (e.border === 1) toast('The Sea Witch takes your Voice. From now on, you are silent.');
        else toast(`The Sea Witch takes your ${e.paid.map(cap).join(' and ')}. You are on the Shore.`);
      } else if (mode === 'watch' || nearPlayer(e.id, 14)) sound.whoosh(0.08);
    } else if (e.type === 'gift') {
      const key = `${e.to}:${e.ribbon}`;
      pendingIn.set(key, (pendingIn.get(key) || 0) + 1);
      const from = mer[e.from], to = mer[e.to], ri = RIB.indexOf(e.ribbon);
      fly(from.anchor(ri), () => to.anchor(ri), e.ribbon, 0.9, () => { pendingIn.set(key, pendingIn.get(key) - 1); });
      if (sim.m[e.to].isPlayer) { toast(`#${e.from + 1} unties their ${cap(e.ribbon)} and ties it on you.`); sound.pluck(784, 0.25); }
      else if (sim.m[e.from].isPlayer) { toast(`You untie your ${cap(e.ribbon)} and tie it on #${e.to + 1}.`); sound.pluck(587, 0.25); }
      else if (mode === 'watch' || nearPlayer(e.from, 10)) sound.pluck(660, 0.06);
    } else if (e.type === 'understood') {
      const v = mer[e.id];
      for (let i = 0; i < 40; i++) world.fx.sparkles.emit(v.g.position.clone().add(new THREE.Vector3((Math.random() - 0.5) * 1.2, 1 + Math.random() * 1.2, (Math.random() - 0.5) * 1.2)), new THREE.Vector3(0, 0.6 + Math.random(), 0), new THREE.Color(0xffd27a), 2.2);
      const msg = sim.m[e.id].message, d = dw[e.by];
      if (sim.m[e.id].isPlayer) {
        sound.bell(784, 0.35, 5);
        say(`“${msg}”`, () => d.g.position.clone().add(new THREE.Vector3(0, 2.3, 0)), 7);
        toast('Someone turned around, and understood you.', 6);
        mini.active = false; show('mini', false);
      } else if (mode === 'watch' || nearPlayer(e.id, 16)) {
        sound.bell(1046, 0.08, 3);
        say(`“${msg}”`, () => d.g.position.clone().add(new THREE.Vector3(0, 2.3, 0)), 5);
      }
    } else if (e.type === 'noticed') {
      toast('A Land Dweller turns around and looks at you.');
      sound.pluck(440, 0.2);
    } else if (e.type === 'lost') {
      toast('They turn back to their dinner before they understand.');
      mini.active = false; show('mini', false);
    } else if (e.type === 'choose') {
      openChoice();
    } else if (e.type === 'dawn') {
      [0, 1.6, 3.2].forEach(t => setTimeout(() => sound.bell(440, 0.5, 5), t * 1000));
      sim.m.forEach(a => { if (a.foam) sinking.set(a.id, -Math.random() * 2.5); });
      if (mode === 'play') {
        mini.active = false; show('mini', false);
        toast(sim.player.understood ? 'Three bells. The sun comes up, and you are still here.' : 'Three bells. The sun comes up.', 6);
        setTimeout(showEnding, sim.player.understood ? 5000 : 6500);
      }
      if (mode === 'watch') addHistory(sim.p, sim.stats, 1);
    }
  }
  sim.events.length = 0;
}
const nearPlayer = (id, r) => sim.player && Math.hypot(sim.m[id].x - sim.player.x, sim.m[id].z - sim.player.z) < r;

function showEnding() {
  if (endingShown || mode !== 'play') return;
  endingShown = true;
  const a = sim.player;
  $('endTitle').textContent = a.understood ? 'You were understood.' : 'You became sea foam.';
  $('endMsg').textContent = `“${a.message}”`;
  $('endStory').innerHTML = '';
  // fold "turned around ... turned back" pairs into one line
  const lines = [];
  for (let i = 0; i < sim.story.length; i++) {
    const s = sim.story[i];
    if (s.kind === 'noticed' && sim.story[i + 1]?.kind === 'lost') {
      const last = lines[lines.length - 1];
      if (last && last.fold) { last.n++; } else lines.push({ t: s.t, fold: true, n: 1 });
      i++; continue;
    }
    if (s.kind === 'hum' && lines.some(l => l.kind === 'hum')) continue;
    lines.push({ t: s.t, text: s.text, kind: s.kind });
  }
  for (const l of lines) {
    const text = l.fold ? (l.n === 1 ? 'A Land Dweller turned around, then turned back to their dinner before they understood.'
                                     : `A Land Dweller turned around, then turned back before they understood. This happened ${l.n} times.`) : l.text;
    const li = document.createElement('li'); const b = document.createElement('b'); b.textContent = fmt(l.t);
    li.appendChild(b); li.appendChild(document.createTextNode(text)); $('endStory').appendChild(li);
  }
  const st = sim.stats;
  $('endRoom').innerHTML = '';
  [[`${st.understood} of ${sim.m.length}`, 'were understood tonight'], [st.gifts, 'ribbons were given away'], [st.foam, 'became sea foam']].forEach(([n, l]) => {
    const d = document.createElement('div'); const s1 = document.createElement('strong'); s1.textContent = n; const s2 = document.createElement('span'); s2.textContent = l;
    d.append(s1, s2); $('endRoom').appendChild(d);
  });
  show('hud', false); show('ending'); modal = 'ending';
}

// =====================================================================================
// cameras
// =====================================================================================
const camPos = new THREE.Vector3(-20, 30, 60), camLook = new THREE.Vector3(10, 0, 0);
function updateCamera(dt, time) {
  let wantPos, wantLook;
  if (mode === 'title') {
    const t = time * 0.03;
    wantLook = W(70, 20, 0.5);
    wantPos = wantLook.clone().add(new THREE.Vector3(-Math.cos(t) * 40 - 14, 11 + Math.sin(t * 0.7) * 3, Math.sin(t) * 26 + 8));
  } else if (mode === 'watch' && focus < 0) {
    // WASD slides the view
    const f = new THREE.Vector3(Math.sin(rig.oYaw), 0, Math.cos(rig.oYaw)), r = new THREE.Vector3(-f.z, 0, f.x);
    const mv = new THREE.Vector3();
    if (keys.has('w')) mv.add(f); if (keys.has('s')) mv.sub(f); if (keys.has('d')) mv.sub(r); if (keys.has('a')) mv.add(r);
    rig.oTarget.addScaledVector(mv, dt * rig.oDist * 0.5);
    rig.oTarget.x = THREE.MathUtils.clamp(rig.oTarget.x, -50, 55); rig.oTarget.z = THREE.MathUtils.clamp(rig.oTarget.z, -25, 25);
    wantLook = rig.oTarget.clone();
    wantPos = wantLook.clone().add(new THREE.Vector3(-Math.sin(rig.oYaw) * Math.cos(rig.oPitch), Math.sin(rig.oPitch), -Math.cos(rig.oYaw) * Math.cos(rig.oPitch)).multiplyScalar(rig.oDist));
  } else {
    const m = mer[focus];
    if (mode === 'watch') { let d = m.yaw - rig.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); if (!drag) rig.yaw += d * dt * 0.8; }
    if (modal === 'choice') { let d = Math.PI / 2 - rig.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); rig.yaw += d * dt * 2; }
    const blind = !sim.m[focus].r.sight;
    const dist = blind ? Math.min(rig.dist, 3.2) : (modal === 'choice' ? 4.5 : rig.dist);
    wantLook = m.g.position.clone().add(new THREE.Vector3(0, 1.4, 0));
    const f = new THREE.Vector3(Math.sin(rig.yaw), 0, Math.cos(rig.yaw));
    wantPos = wantLook.clone().addScaledVector(f, -dist * Math.cos(rig.pitch)).add(new THREE.Vector3(0, dist * Math.sin(rig.pitch) + 0.3, 0));
    const floor = Math.max(ground(wantPos.x + 50, wantPos.z + 20), world.seaY(wantPos.x, wantPos.z, time)) + 0.45;
    wantPos.y = Math.max(wantPos.y, floor);
    if (modal === 'choice') wantLook.lerp(world.witches[1].jarWorld, 0.35);
  }
  const k = 1 - Math.exp(-dt * (mode === 'title' ? 1.5 : 6));
  camPos.lerp(wantPos, k); camLook.lerp(wantLook, k);
  camera.position.copy(camPos); camera.lookAt(camLook);
}

// =====================================================================================
// HUD
// =====================================================================================
function ribChips(r) {
  return RIB.map(k => `<span class="rb ${r[k] ? '' : 'lost'}"><i class="dot" style="background:${RIB_CSS[k]}"></i>${cap(k)}</span>`).join('');
}
function stateLine(a) {
  const tide = tideState(sim.t, sim.p);
  if (a.foam) return 'Sea foam.';
  if (a.understood) return 'Understood. You can stay.';
  if (!a.r.walking) return a.ledBy >= 0 ? `#${a.ledBy + 1} is leading you.` : 'You cannot move on your own. Someone who can walk has to come close and lead you.';
  if (a.zone < 2) {
    if (sim.canPay(a, a.zone + 1, tide)) return a.zone === 0 ? 'The border is open. Swim across: it costs your Voice.' : 'The border is open. Swim across: it costs two more.';
    if (a.zone === 1 && (a.r.hands + a.r.sight + a.r.walking) < 3) return 'You don’t have enough left to pay for the Shore.';
    if (tide.low && a.crossedTide === tide.tide) return 'One border per tide. Wait for the next low tide.';
    return tide.phase === 'dawn-near' ? 'The tide will not go out again.' : 'Wait for low tide. From here you cannot see how crowded the shore is.';
  }
  const ways = [];
  if (a.r.hands) ways.push('touch a shoulder (Space)');
  if (a.r.walking) ways.push('step in front of them');
  if (a.r.sight) ways.push('stand close and hold their gaze');
  return `On the Shore. Catch a Land Dweller’s attention: ${ways.join(', or ')}.`;
}
function tideText() {
  const tide = tideState(sim.t, sim.p);
  const pill = $('tidePill');
  pill.className = sim.over ? 'dawn' : tide.low ? 'low' : '';
  if (sim.over) return 'Dawn';
  if (tide.phase === 'deep') return `The Deep · low tide in ${fmt(tide.next - sim.t)}`;
  if (tide.phase === 'dawn-near') return `The sun is coming · dawn in ${fmt(dawnTime(sim.p) - sim.t)}`;
  if (tide.low) return `Low tide · the borders are open · ${fmt(tide.next - sim.t)}`;
  return `High tide ${tide.tide} · borders closed · low tide in ${fmt(tide.next - sim.t)}`;
}
function updateHUD(dt) {
  toastT -= dt; if (toastT < 0) $('toast').style.opacity = 0;
  if (mode !== 'play' || !sim) return;
  const a = sim.player;
  $('tidePill').textContent = tideText();
  $('dawnBar').firstElementChild.style.width = `${Math.min(100, sim.t / dawnTime(sim.p) * 100)}%`;
  $('meMsg').textContent = `“${a.message}”`;
  $('meRibs').innerHTML = ribChips(a.r);
  $('meState').textContent = stateLine(a);
  const ps = [];
  const tgt = sim.giveTarget();
  if (tgt) ps.push(`<span class="p hot"><kbd>E</kbd> give your ${cap(sim.lacks(tgt))} to #${tgt.id + 1}</span>`);
  if (a.zone === 0 && a.r.voice) ps.push(`<span class="p"><kbd>Space</kbd> hum</span>`);
  if (a.zone === 2 && a.r.hands && !mini.active && !a.understood) ps.push(`<span class="p"><kbd>Space</kbd> touch a shoulder</span>`);
  ps.push(`<span class="p"><kbd>F</kbd> ${fast ? 'back to normal speed' : 'let time pass faster'}</span>`);
  $('prompt').innerHTML = ps.join('');
  // the mini-game
  const l = sim.ld.find(l => l.facing && l.target === 0);
  const was = mini.active;
  mini.active = !!l && !a.understood && !a.foam;
  show('mini', mini.active);
  if (mini.active) {
    if (!was) { mini.phase = 0; mini.boost = 0; }
    mini.by = l.id;
    mini.phase += dt; mini.boost = Math.max(0, mini.boost - dt); mini.flash = Math.max(0, mini.flash - dt * 3);
    sim.playerRate = mini.boost > 0 ? 1.1 : 0.1;
    const b = miniBright(), win = b > miniWindow();
    const pulse = $('miniPulse');
    pulse.style.transform = `scale(${0.6 + b * 1.6})`; pulse.style.opacity = 0.35 + b * 0.65;
    pulse.style.filter = win ? 'drop-shadow(0 0 12px #ffd38a)' : 'none';
    $('miniArc').setAttribute('stroke-dasharray', `${(a.attention / CONST.UNDERSTAND) * 327} 400`);
    $('miniPat').style.width = `${Math.max(0, 1 - l.bored / 3) * 100}%`;
    $('miniWho').textContent = `They are looking at you. Make them understand: “${a.message}”`;
    const how = a.r.hands ? 'Gesture' : a.r.sight ? 'Hold their gaze' : 'Step closer and show them';
    $('miniHow').innerHTML = `${how}: <kbd>Space</kbd> when the light is brightest`;
  } else sim.playerRate = 0;
}

// =====================================================================================
// experiment panel
// =====================================================================================
const P = {
  givers: ['sGivers', 'oGivers', 1, v => `${v} of ${params.merfolk}`, v => sim.setGivers(v)],
  dwellers: ['sDwellers', 'oDwellers', 1, v => `${v}`, v => { sim.setDwellers(v); syncDwellers(); }],
  busy: ['sBusy', 'oBusy', 100, v => `${Math.round(v * 100)}%`, v => { sim.p.busy = v; }],
  tides: ['sTides', 'oTides', 1, v => `${v}`, v => { sim.p.tides = v; }],
};
for (const [key, [sid, oid, scale, txt, apply]] of Object.entries(P)) {
  const el = $(sid);
  el.addEventListener('input', () => { params[key] = +el.value / scale; $(oid).textContent = txt(params[key]); apply(params[key]); });
}
$('cKinder').onchange = () => { params.kinder = sim.p.kinder = $('cKinder').checked; };
$('cFar').onchange = () => { params.far = $('cFar').checked; sim.setFar(params.far); world.buildDinner(params.far); };
$('sKeep').onchange = () => { params.keep = sim.p.keep = $('sKeep').value; };
$('wPause').onclick = () => { paused = !paused; refreshPanel(); };
$('wReset').onclick = () => { seed = 1 + Math.floor(Math.random() * 99999); newNight(params, seed); focus = -1; show('follow', false); refreshPanel(); };
$('wReplay').onclick = () => { newNight(params, seed); focus = -1; show('follow', false); refreshPanel(); };
document.querySelectorAll('#wSpeed button').forEach(b => b.onclick = () => { speed = +b.dataset.s; document.querySelectorAll('#wSpeed button').forEach(x => x.classList.toggle('on', x === b)); });
document.querySelectorAll('#panel .preset').forEach(b => b.onclick = () => {
  Object.assign(params, { dwellers: 3, tides: 3, kinder: true, keep: 'random' }, JSON.parse(b.dataset.p));
  seed = 1 + Math.floor(Math.random() * 99999); newNight(params, seed); focus = -1; show('follow', false); refreshPanel();
});
$('wBatch').onclick = async () => {
  const btn = $('wBatch'); btn.disabled = true;
  const N = 20, sum = { understood: 0, shore: 0, gifts: 0 };
  for (let i = 0; i < N; i++) {
    const st = createSim({ ...params, player: false }, 1000 + i).run();
    sum.understood += st.understood; sum.shore += st.shore; sum.gifts += st.gifts;
    btn.textContent = `Running… ${i + 1}/${N}`; await new Promise(r => setTimeout(r, 0));
  }
  addHistory(params, { understood: sum.understood / N, shore: sum.shore / N, gifts: sum.gifts / N }, N);
  btn.textContent = 'Run 20 nights instantly'; btn.disabled = false;
};
function settingsText(p) {
  return `${p.givers} givers · ${p.dwellers} dwellers · ${Math.round(p.busy * 100)}% busy · ${p.tides} tides${p.kinder ? '' : ' · kinder off'}${p.far ? ' · far shore' : ''}${p.keep !== 'random' ? ' · keep ' + p.keep : ''}`;
}
function addHistory(p, st, n) {
  history.unshift([settingsText(p) + (n > 1 ? ` (avg of ${n})` : ''), st.understood, st.shore, st.gifts]);
  $('wHist').innerHTML = '';
  for (const h of history.slice(0, 12)) {
    const tr = document.createElement('tr');
    h.forEach((c, i) => { const td = document.createElement('td'); td.textContent = typeof c === 'number' ? (Number.isInteger(c) ? c : c.toFixed(1)) : c; if (i === 1) td.className = 'big'; tr.appendChild(td); });
    $('wHist').appendChild(tr);
  }
  show('wHistWrap');
}
function refreshPanel() {
  for (const [key, [sid, oid, scale, txt]] of Object.entries(P)) { $(sid).value = params[key] * scale; $(oid).textContent = txt(params[key]); }
  $('cKinder').checked = params.kinder; $('cFar').checked = params.far; $('sKeep').value = params.keep;
  $('wPause').textContent = paused ? 'Play' : 'Pause';
}
function updatePanel() {
  if (mode !== 'watch' || !sim) return;
  const st = sim.stats, tide = tideState(sim.t, sim.p);
  const deep = sim.m.filter(a => !a.foam && a.zone === 0).length, shal = sim.m.filter(a => !a.foam && a.zone === 1).length;
  $('wStats').innerHTML = [
    [tideTextShort(tide), sim.over ? 'Dawn' : `${fmt(dawnTime(sim.p) - sim.t)} to dawn`],
    [deep, 'in the Deep'], [shal, 'in the Shallows'], [st.shore, 'reached Shore'],
    [st.understood, 'understood', true], [sim.over ? st.foam : '–', 'sea foam'], [st.gifts, 'ribbons given'],
  ].slice(1).map(([n, l, key]) => `<div class="${key ? 'key' : ''}"><strong>${n}</strong><span>${l}</span></div>`).join('')
    + `<div style="grid-column:1/-1;font-size:12px;color:var(--muted);background:none;padding:2px 0">${tideTextShort(tide)} · ${sim.over ? 'Dawn' : fmt(dawnTime(sim.p) - sim.t) + ' to dawn'}</div>`;
  if (focus >= 0) {
    const a = sim.m[focus];
    $('follow').innerHTML = `<b>Merfolk #${a.id + 1}${a.giver ? ' · giver' : ''}</b><div class="rbs">${ribChips(a.r)}</div><div style="font-size:13px;color:#c9d4df">${followLine(a)}</div><div style="font-size:12px;color:var(--muted);margin-top:6px">You see only what she sees. Esc to go back.</div>`;
  }
}
const tideTextShort = tide => sim.over ? 'Dawn' : tide.phase === 'deep' ? 'The Deep' : tide.low ? 'Low tide · borders open' : tide.phase === 'dawn-near' ? 'The sun is coming' : `High tide ${tide.tide}`;
function followLine(a) {
  if (a.foam) return 'Sea foam.'; if (a.understood) return `Understood: “${a.message}”`;
  if (!a.r.sight) return 'Eyes closed. She drifts.';
  if (!a.r.walking) return a.ledBy >= 0 ? `Being led by #${a.ledBy + 1}.` : 'Cannot move alone.';
  if (a.zone < 2) return 'Heading for the shore. She cannot see how crowded it is.';
  return a.attention > 0 ? `Someone is listening (${Math.floor(a.attention)} / 10 s).` : 'Trying to catch a Land Dweller’s attention.';
}

// =====================================================================================
// labels for the overview
// =====================================================================================
const labels = [['DEEP SEA', 25], ['SHALLOWS', 61], ['SHORE', 86]].map(([t, x]) => {
  const el = document.createElement('div'); el.className = 'label3d'; el.textContent = t; document.body.appendChild(el);
  return { el, pos: W(x, -4, 1.5) };
});
function project(p) { const v = p.clone().project(camera); return { x: (v.x * 0.5 + 0.5) * innerWidth, y: (-v.y * 0.5 + 0.5) * innerHeight, ok: v.z < 1 }; }

// =====================================================================================
// main loop
// =====================================================================================
const clock = new THREE.Clock();
let time = 0;
function frame() {
  const dt = Math.min(clock.getDelta(), 0.05);
  time += dt;

  // player movement from the keys, relative to the camera
  if (mode === 'play' && sim && sim.player) {
    const f = new THREE.Vector3(Math.sin(rig.yaw), 0, Math.cos(rig.yaw)), r = new THREE.Vector3(-f.z, 0, f.x);
    const mv = new THREE.Vector3();
    if (keys.has('w') || keys.has('arrowup')) mv.add(f); if (keys.has('s') || keys.has('arrowdown')) mv.sub(f);
    if (keys.has('d') || keys.has('arrowright')) mv.sub(r); if (keys.has('a') || keys.has('arrowleft')) mv.add(r);
    if (mv.lengthSq() > 1) mv.normalize();
    sim.player.inX = mv.x; sim.player.inZ = mv.z;
  }

  // run the night
  const running = sim && !modal && !paused && !(mode === 'play' && sim.over);
  if (running && !sim.over) {
    const sp = mode === 'play' ? (fast ? 6 : 1) : speed;
    acc += dt * sp;
    let n = 0;
    while (acc >= CONST.DT && n < 300) { sim.step(); acc -= CONST.DT; n++; handleEvents(); }
  }
  if (mode === 'title' && sim.over && !sinking.size) newNight({ ...params, player: false }, 1 + Math.floor(Math.random() * 99999));
  if (mode === 'title' && sim.over && sinking.size && [...sinking.values()].every(v => v > 6)) newNight({ ...params, player: false }, 1 + Math.floor(Math.random() * 99999));

  // tide changes: a bell, the sea goes quiet (like the larp)
  const tide = tideState(sim.t, sim.p);
  if (tide.low && !prevLow && mode !== 'title') { sound.bell(523, 0.45); if (mode === 'play') toast('One bell. Low tide: the borders are open.'); }
  if (tide.phase === 'dawn-near' && prevPhase !== 'dawn-near' && mode === 'play') toast('“The sun is coming,” says the Sea Witch.');
  prevLow = tide.low; prevPhase = tide.phase;
  sound.set(sound.oceanGain, mode === 'title' ? 0.35 : sim.over ? 0.15 : tide.low ? 0.03 : 0.5, 0.8);

  world.update(dt, time, sim.over ? 1 : Math.min(1, sim.t / dawnTime(sim.p)), tide.low);

  // who can she see?
  const me = (mode === 'play' || (mode === 'watch' && focus >= 0)) ? sim.m[focus] : null;
  const seeR = me ? (me.r.sight ? CONST.SIGHT_R + 1 : 2.2) : Infinity;
  // fog closes in around her eyes
  const wantFog = !me ? 0.0055 : me.foam ? 0.01 : me.r.sight ? 0.019 : 0.14;
  scene.fog.density += (wantFog - scene.fog.density) * Math.min(1, dt * 2);
  darkK += ((me && !me.r.sight && !me.foam ? 1 : 0) - darkK) * Math.min(1, dt * 1.5);
  world.grade.uniforms.uDark.value = darkK * 0.8;

  // merfolk
  let voiced = 0;
  sim.m.forEach((a, i) => {
    const v = mer[i];
    const inWater = a.zone < 2;
    const wp = W(a.x, a.z);
    wp.y = inWater ? Math.max(world.seaY(wp.x, wp.z, time) - 0.92, ground(a.x, a.z) - 0.05) : ground(a.x, a.z);
    if (sinking.has(i)) { const s = sinking.get(i) + dt; sinking.set(i, s); v.sink = Math.max(0, s / 3); if (s > 0 && s < 4 && Math.random() < 0.5) world.fx.bubbles.emit(v.g.position.clone().add(new THREE.Vector3((Math.random() - 0.5), 0.5 + Math.random() * 1.2, (Math.random() - 0.5))), new THREE.Vector3(0, 0.6 + Math.random(), 0), new THREE.Color(0xdff4ff), 2.5); }
    const vis = !me || i === focus || Math.hypot(a.x - me.x, a.z - me.z) <= seeR;
    v.setVisible(vis && v.sink < 1.4);
    const hidden = RIB.map(k => (pendingIn.get(`${i}:${k}`) || 0) > 0);
    const need = mode === 'play' && !a.foam && !a.understood && i !== 0 && sim.lacks(a) && sim.player.r[sim.lacks(a)] && Math.hypot(a.x - sim.player.x, a.z - sim.player.z) < 10 ? RIB_HEX[sim.lacks(a)] : 0;
    v.update(a, wp, dt, time, { camera, isPlayer: mode === 'play' && i === 0, needColor: need, ribbonHidden: hidden });
    if (a.r.voice && !a.foam) {
      voiced++;
      if (vis && Math.random() < dt * (sim.humT > 0 && Math.hypot(a.x - sim.player?.x, a.z - sim.player?.z) < 14 ? 3 : 0.5))
        world.fx.hums.emit(v.g.position.clone().add(new THREE.Vector3(0, 1.9, 0)), new THREE.Vector3((Math.random() - 0.5) * 0.3, 0.6, (Math.random() - 0.5) * 0.3), new THREE.Color(0x9fc4ff), 2.5);
    }
    if (vis && inWater && !a.foam && Math.random() < dt * 0.8) world.fx.bubbles.emit(v.g.position.clone().add(new THREE.Vector3(0, 0.6, 0)), new THREE.Vector3(0, 0.7, 0), new THREE.Color(0x7fb4d8), 1.4);
  });
  // the song of the Deep fades as voices are given away
  sound.set(sound.humGain, mode === 'title' ? 0.03 : sim.over ? 0 : 0.11 * voiced / sim.m.length + (sim.humT > 0 ? 0.05 : 0), 1.2);

  // dwellers
  sim.ld.forEach((l, j) => {
    if (!dw[j]) return;
    const pos = W(l.x, l.z, ground(l.x, l.z));
    const head = l.facing && l.target >= 0 ? mer[l.target].g.position.clone().add(new THREE.Vector3(0, 1.55, 0)) : null;
    const vis = !me || Math.hypot(l.x - me.x, l.z - me.z) <= seeR;
    dw[j].update(l, pos, head, dt, time, vis);
  });

  // flying ribbons
  for (let i = flyers.length - 1; i >= 0; i--) {
    const f = flyers[i]; f.k += dt / f.dur;
    const k = Math.min(1, f.k), end = f.toFn();
    const mid = f.from.clone().add(end).multiplyScalar(0.5); mid.y += 1.5 + f.from.distanceTo(end) * 0.12;
    const p = f.from.clone().lerp(mid, k).lerp(mid.clone().lerp(end, k), k);
    f.sprite.position.copy(p);
    world.fx.sparkles.emit(p, new THREE.Vector3(0, 0.1, 0), f.color, 0.6);
    if (f.k >= 1) { scene.remove(f.sprite); flyers.splice(i, 1); f.done && f.done(); }
  }

  // white-out when you become foam
  const wantWhite = mode === 'play' && sim.over && sim.player && !sim.player.understood ? 0.75 : 0;
  whiteK += (wantWhite - whiteK) * Math.min(1, dt * 0.5);
  world.grade.uniforms.uWhite.value = whiteK;

  updateCamera(dt, time);
  updateHUD(dt);
  updatePanel();

  // speech bubbles and labels
  for (let i = bubbles.length - 1; i >= 0; i--) {
    const b = bubbles[i]; b.t -= dt;
    const s = project(b.getPos());
    b.el.style.left = `${s.x}px`; b.el.style.top = `${s.y}px`; b.el.style.display = s.ok ? '' : 'none';
    b.el.style.opacity = Math.min(1, b.t);
    if (b.t <= 0) { b.el.remove(); bubbles.splice(i, 1); }
  }
  labels.forEach(l => { const s = project(l.pos); l.el.style.display = mode === 'watch' && focus < 0 && s.ok ? '' : 'none'; l.el.style.left = `${s.x}px`; l.el.style.top = `${s.y}px`; });

  world.composer.render();
  requestAnimationFrame(frame);
}

toTitle();
frame();

// small hooks for automated testing
window.__ashore = { get sim() { return sim; }, get mode() { return mode; }, startIntro, beginPlay, startWatch, choose, miniPress, mini, keys,
  setTime(t) { while (sim.t < t && !sim.over && !modal) { sim.step(); handleEvents(); } } };
