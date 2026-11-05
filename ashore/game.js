// Ashore — the game. Modes:
//   title  : the night plays by itself behind the menu
//   solo   : play one merfolk, everyone else follows the model's rules
//   host   : this screen is the big screen; it runs the night for everyone who joins
//   client : you are one merfolk in someone's room
//   watch  : the experiment panel
import * as THREE from 'three';
import { createWorld, W, ground, B1, B2 } from './world.js';
import { Merfolk, Dweller, RIB, RIB_HEX } from './chars.js';
import { createSim, tideState, dawnTime, CONST, DEFAULTS, inRip, RIPS, WORLD } from './sim.js';
import { hostRoom, joinRoom, packState, unpackState } from './net.js';
import { createVoice } from './voice.js';
import { mountHowto, CARDS } from './howto.js';
import { sound } from './sound.js';

const Q = new URLSearchParams(location.search);
const NET = Q.get('net') === 'local' ? 'local' : 'peer';
const $ = id => document.getElementById(id);
const show = (id, on = true) => { $(id).classList.toggle('hidden', !on); if (id === 'choice') document.body.classList.toggle('choosing', on); if (id === 'bigEnd' || id === 'ending') document.body.classList.toggle('endview', !$('bigEnd').classList.contains('hidden') || !$('ending').classList.contains('hidden')); };
const cap = k => k[0].toUpperCase() + k.slice(1);
const fmt = t => { const s = Math.max(0, Math.round(t)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const RIB_CSS = { voice: 'var(--voice)', hands: 'var(--hands)', sight: 'var(--sight)', walking: 'var(--walking)' };
const randSeed = () => 1 + Math.floor(Math.random() * 99999);

const world = createWorld($('stage'), { lowQuality: Q.has('low') });
const { scene, camera } = world;
function onResize() { world.resize(innerWidth, innerHeight); }
addEventListener('resize', onResize); onResize();

// =====================================================================================
// state
// =====================================================================================
let mode = 'title';
let params = { ...DEFAULTS };
let seed = randSeed();
let sim = null;          // the night, when it runs on this computer
let S = null;            // what we draw: the sim, or a mirror of the host's sim
let myId = -1;           // the merfolk this person plays
let mer = [], dw = [];
let speed = 1, paused = false, acc = 0, modal = null, focus = -1, fast = false;
let prevLow = false, prevPhase = '';
const flyers = [], bubbles = [], pendingIn = new Map(), sinking = new Map();
let endingShown = false, whiteK = 0, darkK = 0;
const history = [];
// big screen
let room = null; const players = new Map(); let nightLen = 1.5, snapT = 0, bigEndShown = false;
// player in a room
let conn = null, voice = null, myName = '', names = {}, slotOf = {}, peerOfSlot = {}, ready = false;
const tipsShown = new Set();

function clearEffects() {
  flyers.forEach(f => scene.remove(f.sprite)); flyers.length = 0;
  bubbles.forEach(b => b.el.remove()); bubbles.length = 0;
  pendingIn.clear(); sinking.clear();
  links.forEach(l => scene.remove(l)); links.length = 0;
  $('tags').innerHTML = ''; tagEls.clear();
}
function rebuildViews() {
  mer.forEach(m => m.dispose()); dw.forEach(d => d.dispose());
  mer = S.m.map(a => new Merfolk(scene, a.id));
  dw = S.ld.map((l, j) => new Dweller(scene, j));
}
function syncViews() {
  while (mer.length < S.m.length) mer.push(new Merfolk(scene, mer.length));
  while (mer.length > S.m.length) mer.pop().dispose();
  while (dw.length < S.ld.length) dw.push(new Dweller(scene, dw.length));
  while (dw.length > S.ld.length) dw.pop().dispose();
}
function newLocalNight(p, s, humans = []) {
  clearEffects();
  sim = createSim(p, s);
  for (const [id, nm] of humans) sim.setHuman(id, nm);
  S = sim;
  rebuildViews();
  world.buildDinner(p.far);
  acc = 0; prevLow = false; prevPhase = ''; endingShown = false; bigEndShown = false; whiteK = 0; fast = false; paused = false;
}

// =====================================================================================
// screens
// =====================================================================================
const ALL = ['title', 'joinCard', 'howto', 'lobby', 'big', 'bigEnd', 'hud', 'choice', 'ending', 'watchUI'];
function only(...ids) { ALL.forEach(id => show(id, ids.includes(id))); }

function toTitle() {
  if (conn) { try { conn.close(); } catch (e) { /* ignore */ } conn = null; }
  if (voice) { voice.stop(); voice = null; }
  if (room) { try { room.close(); } catch (e) { /* ignore */ } room = null; players.clear(); }
  mode = 'title'; modal = null; focus = -1; myId = -1;
  only('title');
  newLocalNight({ ...params }, randSeed());
}

// ---- play alone
function startSolo() {
  sound.init();
  mode = 'solo'; modal = 'howto'; focus = 0; myId = 0;
  newLocalNight({ ...params, night: 1 }, (seed = randSeed()), [[0, 'You']]);
  only('howto');
  mountHowto({ doneLabel: 'Begin', onDone: () => { modal = null; only('hud'); sound.bell(523, 0.25); toast('The sea is deep. Swim.'); tip('start', soloStartTip()); } });
  rig.yaw = Math.PI / 2; rig.dist = 6.5; rig.pitch = 0.3;
}
const soloStartTip = () => 'Swim toward the lights. Borders open at <b>low tide</b>.';

// ---- the big screen
async function startHost() {
  sound.init();
  mode = 'host'; modal = null; focus = -1; myId = -1;
  only('big'); show('bigLobby'); show('bigGame', false);
  $('bigCodeBig').textContent = '····'; $('bigErr').textContent = '';
  $('bigUrl').textContent = location.href.split('?')[0].replace(/index\.html$/, '') + (NET === 'local' ? '?net=local' : '');
  newLocalNight({ ...params }, randSeed());
  try {
    room = await hostRoom(NET);
  } catch (e) { $('bigErr').textContent = 'Could not open a room: ' + (e.message || e.type || e) + '. Check the internet connection.'; return; }
  $('bigCodeBig').textContent = room.code;
  room.on('join', (cid, msg) => {
    players.set(cid, { name: (msg.name || 'Someone').slice(0, 14), ready: false, slot: -1 });
    if (sim && sim.m.some(a => a.human) && !sim.over) admitLate(cid);
    broadcastLobby();
  });
  room.on('leave', cid => {
    const p = players.get(cid); players.delete(cid);
    if (p && p.slot >= 0 && sim) sim.releaseHuman(p.slot);
    broadcastLobby();
  });
  room.on('msg', (cid, msg) => {
    const p = players.get(cid); if (!p) return;
    if (msg.t === 'ready') { p.ready = !!msg.v; broadcastLobby(); return; }
    if (p.slot < 0 || !sim || sim.over) return;
    if (msg.t === 'in') sim.input(p.slot, msg);
    else if (msg.t === 'act') {
      if (msg.a === 'give') sim.give(p.slot);
      else if (msg.a === 'raise') sim.raise(p.slot);
      else if (msg.a === 'hum') sim.hum(p.slot);
      else if (msg.a === 'choose') sim.choose(p.slot, msg.keep);
      else if (msg.a === 'decline') sim.decline(p.slot);
    }
  });
  broadcastLobby();
}
function broadcastLobby() {
  const list = [...players.entries()].map(([cid, p]) => ({ cid, name: p.name, ready: p.ready }));
  if (room) room.broadcast({ t: 'lobby', players: list });
  $('bigList').innerHTML = list.length ? list.map(p => `<div class="pl"><span class="nm">${esc(p.name)}</span>${p.ready ? '<span class="ok">✓ ready</span>' : '<span class="wait">reading…</span>'}</div>`).join('')
    : '<div class="pl"><span class="wait">Nobody has joined yet.</span></div>';
  $('bigStart').disabled = list.length === 0;
  $('bigStart').textContent = list.length && !list.every(p => p.ready) ? 'Start anyway' : 'Start';
}
document.querySelectorAll('#bigLen button').forEach(b => b.onclick = () => { nightLen = +b.dataset.n; document.querySelectorAll('#bigLen button').forEach(x => x.classList.toggle('on', x === b)); });
$('bigStart').onclick = () => startRoomNight();
function startRoomNight() {
  const ps = [...players.entries()];
  seed = randSeed();
  const p = { ...params, night: nightLen };
  newLocalNight(p, seed, ps.map(([cid, pl], i) => [i, pl.name]));
  // people start together in the Deep, so they can find each other
  ps.forEach(([cid, pl], i) => { pl.slot = i; const a = sim.m[i]; a.x = 14 + (i % 3) * 2.2; a.z = 16 + Math.floor(i / 3) * 2.4; });
  for (const [cid, pl] of ps) sendStart(cid, pl.slot);
  show('bigLobby', false); show('bigGame'); show('bigEnd', false);
  $('bigCode').innerHTML = `Room <b>${room.code}</b>`;
  sound.bell(523, 0.3);
}
function sendStart(cid, slot) {
  room.send(cid, { t: 'start', slot, p: sim.p, names: Object.fromEntries([...players.values()].filter(x => x.slot >= 0).map(x => [x.slot, x.name])),
    peers: Object.fromEntries([...players.entries()].filter(([, x]) => x.slot >= 0).map(([c, x]) => [x.slot, c])), messages: sim.m.map(a => a.message) });
}
function admitLate(cid) {
  // someone joins during the night: they take over a merfolk still in the Deep
  const p = players.get(cid);
  const free = sim.m.find(a => !a.human && !a.foam && a.zone === 0) || sim.m.find(a => !a.human && !a.foam && !a.understood);
  if (!free) return;
  sim.setHuman(free.id, p.name); p.slot = free.id; p.ready = true;
  sendStart(cid, free.id);
  room.broadcast({ t: 'names', names: Object.fromEntries([...players.values()].filter(x => x.slot >= 0).map(x => [x.slot, x.name])), peers: Object.fromEntries([...players.entries()].filter(([, x]) => x.slot >= 0).map(([c, x]) => [x.slot, c])) });
}
$('bigAgain').onclick = () => { show('bigEnd', false); show('bigGame', false); show('bigLobby'); for (const p of players.values()) { p.slot = -1; } if (room) room.broadcast({ t: 'again' }); broadcastLobby(); newLocalNight({ ...params }, randSeed()); };
$('bigMenu').onclick = () => toTitle();

// ---- joining a room
function openJoin() { sound.init(); only('joinCard'); $('joinErr').textContent = ''; $('joinName').value = localStorageGet('ashoreName') || ''; $('joinCode').value = Q.get('room') || ''; setTimeout(() => ($('joinName').value ? $('joinCode') : $('joinName')).focus(), 50); }
function localStorageGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
function localStorageSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* ignore */ } }
$('btnJoinBack').onclick = () => only('title');
$('joinCode').addEventListener('keydown', e => { if (e.key === 'Enter') $('btnJoinGo').click(); });
$('btnJoinGo').onclick = async () => {
  const nm = $('joinName').value.trim() || 'Someone', code = $('joinCode').value.trim().toUpperCase();
  if (code.length !== 4) { $('joinErr').textContent = 'The room code has four letters.'; return; }
  $('btnJoinGo').disabled = true; $('joinErr').textContent = 'Connecting…';
  try {
    conn = await joinRoom(NET, code, nm);
  } catch (e) { $('joinErr').textContent = e.message || 'Could not connect.'; $('btnJoinGo').disabled = false; return; }
  $('btnJoinGo').disabled = false;
  myName = nm; localStorageSet('ashoreName', nm);
  mode = 'client'; myId = -1; focus = -1; ready = false;
  conn.on('msg', onHostMsg);
  conn.on('close', () => { toast('The room closed.'); setTimeout(toTitle, 1500); });
  if (conn.peer && sound.ctx) { voice = createVoice(conn.peer, sound.ctx, sound.master); voice.start().then(ok => { $('lobbyErr').textContent = ok ? '' : 'No microphone. You can still play: use Space to hum.'; }); }
  only('howto'); modal = 'howto';
  mountHowto({ doneLabel: 'Ready', onDone: () => { modal = null; ready = true; conn.send({ t: 'ready', v: true }); if (myId >= 0) only('hud'); else only('lobby'); } });
};
$('lobbyHow').onclick = () => { only('howto'); mountHowto({ doneLabel: 'Back', onDone: () => only(myId >= 0 ? 'hud' : 'lobby') }); };
$('lobbyMic').onclick = () => { if (!voice) { $('lobbyErr').textContent = 'Voice works only with the real network (not in test mode).'; return; } const l = voice.myLevel(); $('lobbyErr').textContent = voice.hasMic ? 'Microphone is on. Say something: the dot next to your name moves in the game.' : 'No microphone found.'; };

function onHostMsg(msg) {
  if (msg.t === 'lobby') {
    $('lobbyList').innerHTML = msg.players.map(p => `<div class="pl"><span class="nm">${esc(p.name)}${p.cid === conn.id ? ' (you)' : ''}</span>${p.ready ? '<span class="ok">✓ ready</span>' : '<span class="wait">reading…</span>'}</div>`).join('');
    if (voice) voice.connect(msg.players.map(p => p.cid), conn.id);
  } else if (msg.t === 'start') {
    clearEffects();
    myId = msg.slot; focus = myId; names = msg.names; peerOfSlot = msg.peers;
    S = { p: { ...msg.p }, m: [], ld: [], t: 0, over: false, stats: {}, messages: msg.messages };
    endingShown = false; whiteK = 0; prevLow = false; prevPhase = '';
    rig.yaw = Math.PI / 2; rig.dist = 6.5; rig.pitch = 0.3;
    world.buildDinner(msg.p.far);
    if (modal !== 'howto') { only('hud'); }
    show('ending', false);
    toast('The sea is deep. Swim.'); sound.bell(523, 0.25);
    tip('start', 'Find the others. <b>Talk</b> — people near you can hear.');
  } else if (msg.t === 'names') { names = msg.names; peerOfSlot = msg.peers; }
  else if (msg.t === 's') {
    if (!S) return;
    unpackState(S, msg);
    S.m.forEach((a, i) => { a.message = S.messages[i]; a.name = names[i] || ''; });
    if (mer.length !== S.m.length || dw.length !== S.ld.length) { if (!mer.length) rebuildViews(); else syncViews(); }
  } else if (msg.t === 'ev') { if (S) handleEvents(msg.list); }
  else if (msg.t === 'end') { showClientEnding(msg); }
  else if (msg.t === 'again') { myId = -1; focus = -1; S = null; clearEffects(); only('lobby'); $('lobbyNote').textContent = 'Another night is coming. Wait for the big screen.'; }
}

// ---- watch / experiment
function startWatch() {
  sound.init();
  mode = 'watch'; modal = null; focus = -1; myId = -1; speed = 1;
  newLocalNight({ ...params }, (seed = randSeed()));
  only('watchUI'); refreshPanel();
}

$('btnSolo').onclick = startSolo;
$('btnHost').onclick = startHost;
$('btnJoin').onclick = openJoin;
$('btnWatch').onclick = startWatch;
$('wMenu').onclick = () => toTitle();

// =====================================================================================
// messages on screen
// =====================================================================================
let toastT = 0, tipT = 0;
function toast(text, secs = 4.5) { $('toast').textContent = text; $('toast').style.opacity = 1; toastT = secs; }
function tip(key, html, secs = 7) { if (tipsShown.has(key)) return; tipsShown.add(key); $('tip').innerHTML = html; $('tip').classList.add('new'); tipT = secs; sound.pluck(988, 0.08); }
function say(text, getPos, secs = 5) {
  const el = document.createElement('div'); el.className = 'bubble'; el.textContent = text;
  $('tags').appendChild(el); bubbles.push({ el, getPos, t: secs });
}
const nameOf = id => (S && S.m[id] && S.m[id].human && (S.m[id].name || names[id])) || `#${id + 1}`;

// =====================================================================================
// the Witch's choice
// =====================================================================================
document.querySelectorAll('#choice .opt').forEach(b => b.onclick = () => choose(b.dataset.keep));
$('btnNotYet').onclick = () => { act('decline'); closeChoice(); toast('You stay in the Shallows.'); };
function openChoice() { modal = 'choice'; show('choice'); document.body.classList.add('choosing'); sound.bell(392, 0.3); }
function closeChoice() { modal = null; show('choice', false); document.body.classList.remove('choosing'); }
function choose(keep) { if (modal !== 'choice') return; act('choose', { keep }); closeChoice(); }

// an action by the person: run it here (alone) or send it to the big screen
function act(a, extra = {}) {
  if (mode === 'solo') {
    if (a === 'give') return sim.give(myId);
    if (a === 'raise') return sim.raise(myId);
    if (a === 'hum') return sim.hum(myId);
    if (a === 'choose') return sim.choose(myId, extra.keep);
    if (a === 'decline') return sim.decline(myId);
  } else if (mode === 'client' && conn) { conn.send({ t: 'act', a, ...extra }); return true; }
}

// =====================================================================================
// input
// =====================================================================================
const keys = new Set();
const playing = () => (mode === 'solo' || mode === 'client') && myId >= 0 && S && !S.over;
addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT') return;
  if (e.repeat) return;
  const k = e.key.toLowerCase();
  keys.add(k);
  if (k === 'escape') {
    if (modal === 'choice') { act('decline'); closeChoice(); return; }
    if (mode === 'watch' && focus >= 0) { focus = -1; show('follow', false); return; }
    if (mode === 'solo' || mode === 'watch') toTitle();
    return;
  }
  if (modal === 'choice') { if (k === '1') choose('hands'); if (k === '2') choose('sight'); if (k === '3') choose('walking'); return; }
  if (k === 'h' && playing() && modal !== 'howto') { const prev = modal; modal = mode === 'solo' ? 'howto' : null; only('howto'); mountHowto({ doneLabel: 'Back', onDone: () => { modal = prev; only('hud'); } }); return; }
  if (playing() && !modal) {
    const a = S.m[myId];
    if (k === ' ') {
      e.preventDefault();
      if (a.zone === 0 && a.r.voice) { act('hum'); sound.set(sound.meGain, 0.12, 0.2); setTimeout(() => sound.set(sound.meGain, 0, 0.8), 2500); }
    }
    if (k === 'q') { act('raise'); toast('You raise your hand.', 2); }
    if (k === 'e') {
      if (!a.r.hands) toast('You have no Hands.');
      else if (!giveTarget(S, myId)) toast('Nobody nearby needs what you have.');
      else act('give');
    }
    if (k === 'f' && mode === 'solo') { fast = !fast; toast(fast ? 'Time runs faster.' : 'Time runs at its own pace.', 2); }
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
    if (S.m[i].foam) return;
    v.copy(m.g.position).add(new THREE.Vector3(0, 1.2, 0)).project(camera);
    if (v.z > 1) return;
    const sx = (v.x * 0.5 + 0.5) * innerWidth, sy = (-v.y * 0.5 + 0.5) * innerHeight;
    const d = Math.hypot(sx - x, sy - y); if (d < bd) { bd = d; best = i; }
  });
  if (best >= 0) { focus = best; rig.yaw = mer[best].yaw; rig.dist = 7; show('follow'); }
}

// the person's movement, relative to the camera
let lastSent = 0, lastIn = '';
function sendInput(now) {
  if (!playing()) return;
  const f = new THREE.Vector3(Math.sin(rig.yaw), 0, Math.cos(rig.yaw)), r = new THREE.Vector3(-f.z, 0, f.x);
  const mv = new THREE.Vector3();
  if (!modal || modal === 'choice') {
    if (keys.has('w') || keys.has('arrowup')) mv.add(f); if (keys.has('s') || keys.has('arrowdown')) mv.sub(f);
    if (keys.has('d') || keys.has('arrowright')) mv.add(r); if (keys.has('a') || keys.has('arrowleft')) mv.sub(r);
  }
  if (mv.lengthSq() > 1) mv.normalize();
  const inp = { x: +mv.x.toFixed(3), z: +mv.z.toFixed(3), hold: keys.has('r') && !modal };
  if (mode === 'solo') sim.input(myId, inp);
  else if (conn) {
    const key = JSON.stringify(inp);
    if (key !== lastIn || now - lastSent > 0.25) { conn.send({ t: 'in', ...inp }); lastIn = key; lastSent = now; }
  }
}

// helpers that work on the sim or on a mirror of it
function lacksOf(a) { return !a.r.walking ? 'walking' : !a.r.sight ? 'sight' : !a.r.hands ? 'hands' : null; }
function giveTarget(St, id) {
  const a = St.m[id]; if (!a || a.foam || a.understood || !a.r.hands) return null;
  let best = null, bd = CONST.REACH + 0.8;
  for (const b of St.m) {
    if (b === a || b.foam || b.understood) continue;
    const need = lacksOf(b); if (!need || !a.r[need]) continue;
    const d = Math.hypot(a.x - b.x, a.z - b.z); if (d < bd) { bd = d; best = b; }
  }
  return best;
}
function nearestHand(St, id) {
  const a = St.m[id]; if (!a || !a.r.walking) return null;
  let best = null, bd = CONST.REACH + 0.5;
  for (const b of St.m) { if (b === a || b.foam) continue; const d = Math.hypot(a.x - b.x, a.z - b.z); if (d < bd) { bd = d; best = b; } }
  return best;
}
function canPayOf(St, a, border) {
  const tide = tideState(St.t, St.p);
  return tide.low && a.crossedTide !== tide.tide && (border === 1 ? a.r.voice : (a.r.hands + a.r.sight + a.r.walking) >= 3);
}

// =====================================================================================
// events -> what you see and hear
// =====================================================================================
function fly(from, toFn, ribbon, dur, done) {
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: mer[0].giverOrb.material.map, color: RIB_HEX[ribbon], transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  sprite.scale.setScalar(0.5); scene.add(sprite);
  flyers.push({ sprite, from: from.clone(), toFn, ribbon, k: 0, dur, done, color: new THREE.Color(RIB_HEX[ribbon]) });
}
const me = () => (myId >= 0 && S ? S.m[myId] : null);
const near = (id, r) => { const a = me(); return !a || (S.m[id] && Math.hypot(S.m[id].x - a.x, S.m[id].z - a.z) < r); };

function handleEvents(list) {
  for (const e of list) {
    if (e.type === 'cross') {
      const v = mer[e.id], w = world.witches[e.border - 1]; if (!v) continue;
      e.paid.forEach((r, i) => setTimeout(() => fly(v.anchor(RIB.indexOf(r)), () => w.jarWorld, r, 1.4, () => { w.pulse = 1; }), i * 180));
      for (let i = 0; i < 14; i++) world.fx.bubbles.emit(v.g.position.clone().add(new THREE.Vector3(Math.random() - 0.5, 0.8 + Math.random(), Math.random() - 0.5)), new THREE.Vector3(0, 1 + Math.random(), 0), new THREE.Color(0x9fd8ff), 1.6);
      if (e.id === myId) {
        sound.whoosh(0.4);
        if (e.border === 1) { toast('The Witch takes your Voice.'); tip('voice', 'Your mic is off. Use your body.'); }
        else toast(`The Witch takes your ${e.paid.map(cap).join(' and ')}.`);
      } else if (near(e.id, 14)) sound.whoosh(mode === 'host' ? 0.05 : 0.08);
    } else if (e.type === 'gift') {
      const key = `${e.to}:${e.ribbon}`;
      pendingIn.set(key, (pendingIn.get(key) || 0) + 1);
      const from = mer[e.from], to = mer[e.to], ri = RIB.indexOf(e.ribbon); if (!from || !to) continue;
      fly(from.anchor(ri), () => to.anchor(ri), e.ribbon, 0.9, () => { pendingIn.set(key, pendingIn.get(key) - 1); });
      if (e.to === myId) { toast(`${nameOf(e.from)} gives you their ${cap(e.ribbon)}.`); sound.pluck(784, 0.25); }
      else if (e.from === myId) { toast(`You give your ${cap(e.ribbon)} to ${nameOf(e.to)}.`); sound.pluck(587, 0.25); }
      else if (near(e.from, 10)) sound.pluck(660, 0.06);
    } else if (e.type === 'understood') {
      const v = mer[e.id]; if (!v) continue;
      for (let i = 0; i < 40; i++) world.fx.sparkles.emit(v.g.position.clone().add(new THREE.Vector3((Math.random() - 0.5) * 1.2, 1 + Math.random() * 1.2, (Math.random() - 0.5) * 1.2)), new THREE.Vector3(0, 0.6 + Math.random(), 0), new THREE.Color(0xffd27a), 2.2);
      const msg = S.m[e.id].message, d = dw[e.by];
      if (e.id === myId) { sound.bell(784, 0.35, 5); if (d) say(`“${msg}”`, () => d.g.position.clone().add(new THREE.Vector3(0, 2.3, 0)), 7); toast('You are understood.', 6); }
      else if (near(e.id, 16) && d) { sound.bell(1046, 0.08, 3); say(`“${msg}”`, () => d.g.position.clone().add(new THREE.Vector3(0, 2.3, 0)), 5); }
    } else if (e.type === 'noticed') {
      if (e.id === myId) { toast('Someone turns to look at you. Stay.'); sound.pluck(440, 0.2); }
    } else if (e.type === 'choose') {
      if (e.id === myId) { openChoice();  }
    } else if (e.type === 'hold') {
      if (e.on && e.to === myId) { toast(`${nameOf(e.from)} takes your hand.`, 3); sound.pluck(523, 0.2); }
      if (e.on && e.from === myId) { sound.pluck(659, 0.15); }
    } else if (e.type === 'signal') {
      if (e.id !== myId && near(e.id, CONST.SIGNAL_R) && me() && me().r.sight) { sound.pluck(1318, 0.06); tip('seeSignal', `Someone needs help. Go and <b>hold R</b>.`); }
    } else if (e.type === 'dawn') {
      [0, 1.6, 3.2].forEach(t => setTimeout(() => sound.bell(440, 0.5, 5), t * 1000));
      S.m.forEach(a => { if (a.foam) sinking.set(a.id, -Math.random() * 2.5); });
      closeChoice();
      if (mode === 'solo') { toast(S.m[myId].understood ? 'Three bells. The sun comes up, and you are still here.' : 'Three bells. The sun comes up.', 6); setTimeout(showSoloEnding, S.m[myId].understood ? 5000 : 6500); }
      if (mode === 'client') toast(S.m[myId] && S.m[myId].understood ? 'Three bells. You are still here.' : 'Three bells. The sun comes up.', 6);
      if (mode === 'watch') addHistory(sim.p, sim.stats, 1);
      if (mode === 'host') setTimeout(showBigEnding, 6000);
    }
  }
}

// =====================================================================================
// endings
// =====================================================================================
function storyItems(story) {
  const lines = [];
  for (let i = 0; i < story.length; i++) {
    const s = story[i];
    if (s.kind === 'noticed' && story[i + 1]?.kind === 'lost') {
      const last = lines[lines.length - 1];
      if (last && last.fold) last.n++; else lines.push({ t: s.t, fold: true, n: 1 });
      i++; continue;
    }
    if (s.kind === 'hum' && lines.some(l => l.kind === 'hum')) continue;
    lines.push({ t: s.t, text: s.text, kind: s.kind });
  }
  return lines.map(l => `<li><b>${fmt(l.t)}</b>${esc(l.fold ? (l.n === 1 ? 'A Land Dweller turned around, then turned back to their dinner.' : `A Land Dweller turned around, then turned back. This happened ${l.n} times.`) : l.text)}</li>`).join('');
}
function fillEnding({ understood, message, story, stats, total, note, buttons }) {
  $('endTitle').textContent = understood ? 'You were understood.' : 'You became sea foam.';
  $('endMsg').textContent = `“${message}”`;
  $('endStory').innerHTML = storyItems(story);
  $('endRoom').innerHTML = [[`${stats.understood} of ${total}`, 'were understood tonight'], [stats.leads ?? 0, 'hands were held'], [stats.gifts, 'ribbons were given away']]
    .map(([n, l]) => `<div><strong>${n}</strong><span>${l}</span></div>`).join('');
  $('endNote').textContent = note || '';
  $('endBtns').innerHTML = '';
  for (const [label, fn, primary] of buttons) { const b = document.createElement('button'); b.textContent = label; if (primary) b.className = 'primary'; b.onclick = fn; $('endBtns').appendChild(b); }
  show('hud', false); show('ending'); modal = 'ending';
}
function showSoloEnding() {
  if (endingShown || mode !== 'solo') return; endingShown = true;
  const a = sim.m[myId];
  fillEnding({ understood: a.understood, message: a.message, story: sim.stories[myId], stats: sim.stats, total: sim.m.length,
    buttons: [['Play again', () => { show('ending', false); startSolo(); }, true], ['Menu', toTitle]] });
}
function showClientEnding(msg) {
  endingShown = true;
  const a = S && S.m[myId];
  fillEnding({ understood: msg.understood, message: msg.message, story: msg.story, stats: msg.stats, total: msg.total,
    note: 'Look at the big screen: it shows how everyone helped each other tonight.', buttons: [['Leave the room', toTitle]] });
}
function showBigEnding() {
  if (mode !== 'host' || bigEndShown) return; bigEndShown = true;
  // tell each person their own night
  for (const [cid, p] of players) if (p.slot >= 0) room.send(cid, { t: 'end', understood: sim.m[p.slot].understood, message: sim.m[p.slot].message, story: sim.stories[p.slot], stats: sim.stats, total: sim.m.length });
  const st = sim.stats;
  $('bigEndTitle').textContent = 'Dawn';
  $('bigEndSub').textContent = `${st.understood} of ${sim.m.length} were understood · ${st.leads} hands held · ${st.gifts} ribbons given · ${st.foam} became sea foam`;
  drawNetwork();
  const humans = sim.m.filter(a => a.human);
  $('bigCards').innerHTML = `<h3 style="margin:0 0 12px;font-size:13px;letter-spacing:.14em;color:var(--muted)">EVERYONE’S CARD</h3>` + humans.map(a => {
    const gave = sim.help.filter(h => h.from === a.id), got = sim.help.filter(h => h.to === a.id);
    const helpers = [...new Set(got.map(h => nameOf(h.from)))];
    return `<div class="pc"><div class="n">${esc(a.name)}<span>${a.understood ? 'understood' : 'sea foam'}</span></div><div class="m">“${esc(a.message)}”</div>
      <div class="h">${gave.length ? `helped ${gave.length} time${gave.length > 1 ? 's' : ''}` : 'helped nobody'} · ${helpers.length ? 'was helped by ' + esc(helpers.join(', ')) : 'nobody helped her'}</div></div>`;
  }).join('');
  show('bigGame', false); show('bigEnd');
}
function drawNetwork() {
  const X = x => 60 + (x / WORLD.W) * 880, Y = z => 50 + (z / WORLD.D) * 460;
  const pos = a => [X(a.x), Y(a.z)];
  let svg = `<defs><filter id="gl"><feGaussianBlur stdDeviation="3"/></filter></defs>`;
  // the room: three zones
  svg += `<rect x="${X(0)}" y="${Y(0)}" width="${X(WORLD.B1) - X(0)}" height="460" fill="#071a2e"/>`
    + `<rect x="${X(WORLD.B1)}" y="${Y(0)}" width="${X(WORLD.B2) - X(WORLD.B1)}" height="460" fill="#0c3a40"/>`
    + `<rect x="${X(WORLD.B2)}" y="${Y(0)}" width="${X(100) - X(WORLD.B2)}" height="460" fill="#3a3326"/>`
    + [['DEEP SEA', 25], ['SHALLOWS', 61], ['SHORE', 86]].map(([t, x]) => `<text x="${X(x)}" y="${Y(0) - 14}" fill="#9fb0c2" font-size="13" letter-spacing="3" text-anchor="middle" font-family="Gotham, Montserrat, sans-serif" font-weight="700">${t}</text>`).join('');
  for (const l of sim.ld) svg += `<rect x="${X(l.x) - 6}" y="${Y(l.z) - 6}" width="12" height="12" fill="#efe8dc" opacity=".8" transform="rotate(45 ${X(l.x)} ${Y(l.z)})"/>`;
  // threads of help
  let k = 0;
  for (const h of sim.help) {
    const a = sim.m[h.from], b = sim.m[h.to];
    const [x1, y1] = pos(a), [x2, y2] = pos(b);
    const mx = (x1 + x2) / 2 + (y2 - y1) * 0.25, my = (y1 + y2) / 2 - (x2 - x1) * 0.25;
    const col = h.type === 'lead' ? '#ffffff' : RIB_CSS[h.ribbon].replace('var(--', '').replace(')', '');
    const stroke = h.type === 'lead' ? '#fff' : ({ voice: '#f7f3ea', hands: '#d9483b', sight: '#3e7fc9', walking: '#e8b931' })[h.ribbon];
    const w = h.type === 'lead' ? Math.min(7, 1.5 + h.dur / 12) : 2.5;
    const human = a.human || b.human;
    svg += `<path d="M${x1} ${y1} Q${mx} ${my} ${x2} ${y2}" stroke="${stroke}" stroke-width="${w}" fill="none" opacity="${human ? 0.95 : 0.4}" stroke-linecap="round" class="thread" style="animation-delay:${(k++ * 0.08).toFixed(2)}s"/>`;
  }
  // everyone, where they were at dawn
  for (const a of sim.m) {
    const [x, y] = pos(a);
    const fill = a.understood ? '#ffd38a' : '#5a6878';
    if (a.human) {
      svg += `${a.understood ? `<circle cx="${x}" cy="${y}" r="16" fill="#ffd38a" opacity=".5" filter="url(#gl)"/>` : ''}<circle cx="${x}" cy="${y}" r="9" fill="${fill}" stroke="#fff" stroke-width="2"/>`
        + `<text x="${x}" y="${y - 15}" fill="#fff" font-size="15" font-weight="700" text-anchor="middle" font-family="Gotham, Montserrat, sans-serif">${esc(a.name)}</text>`;
    } else svg += `<circle cx="${x}" cy="${y}" r="4.5" fill="${fill}" opacity="${a.understood ? 1 : 0.6}"/>`;
  }
  $('net').innerHTML = `<style>.thread{stroke-dasharray:1200;stroke-dashoffset:1200;animation:draw 1.6s ease forwards}@keyframes draw{to{stroke-dashoffset:0}}</style>` + svg;
}

// =====================================================================================
// cameras
// =====================================================================================
const camPos = new THREE.Vector3(-20, 30, 60), camLook = new THREE.Vector3(10, 0, 0);
function updateCamera(dt, time) {
  let wantPos, wantLook, k = 6;
  if (mode === 'title' || (mode === 'host' && (!S || !S.m.some(a => a.human)))) {
    const t = time * 0.03;
    wantLook = W(70, 20, 0.5);
    wantPos = wantLook.clone().add(new THREE.Vector3(-Math.cos(t) * 40 - 14, 11 + Math.sin(t * 0.7) * 3, Math.sin(t) * 26 + 8));
    k = 1.5;
  } else if (mode === 'host') {
    // the big screen follows the people, slowly circling
    const hs = S.m.filter(a => a.human && !a.foam);
    const c = new THREE.Vector3(); (hs.length ? hs : S.m).forEach(a => c.add(W(a.x, a.z))); c.divideScalar(Math.max(1, (hs.length ? hs : S.m).length));
    let spread = 0; hs.forEach(a => { spread = Math.max(spread, W(a.x, a.z).distanceTo(c)); });
    const d = THREE.MathUtils.clamp(26 + spread * 1.3, 26, 80), t = time * 0.025;
    wantLook = c.clone().add(new THREE.Vector3(4, 0.5, 0));
    wantPos = wantLook.clone().add(new THREE.Vector3(-Math.cos(t) * d * 0.8, d * 0.55, Math.sin(t) * d * 0.6 + d * 0.3));
    k = 0.8;
  } else if (mode === 'watch' && focus < 0) {
    const f = new THREE.Vector3(Math.sin(rig.oYaw), 0, Math.cos(rig.oYaw)), r = new THREE.Vector3(-f.z, 0, f.x);
    const mv = new THREE.Vector3();
    if (keys.has('w')) mv.add(f); if (keys.has('s')) mv.sub(f); if (keys.has('d')) mv.add(r); if (keys.has('a')) mv.sub(r);
    rig.oTarget.addScaledVector(mv, dt * rig.oDist * 0.5);
    rig.oTarget.x = THREE.MathUtils.clamp(rig.oTarget.x, -50, 55); rig.oTarget.z = THREE.MathUtils.clamp(rig.oTarget.z, -25, 25);
    wantLook = rig.oTarget.clone();
    wantPos = wantLook.clone().add(new THREE.Vector3(-Math.sin(rig.oYaw) * Math.cos(rig.oPitch), Math.sin(rig.oPitch), -Math.cos(rig.oYaw) * Math.cos(rig.oPitch)).multiplyScalar(rig.oDist));
  } else if (focus >= 0 && mer[focus] && S.m[focus]) {
    const m = mer[focus];
    if (mode === 'watch') { let d = m.yaw - rig.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); if (!drag) rig.yaw += d * dt * 0.8; }
    if (modal === 'choice') { let d = Math.PI / 2 - rig.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); rig.yaw += d * dt * 2; }
    const blind = !S.m[focus].r.sight;
    const dist = blind ? Math.min(rig.dist, 3.2) : (modal === 'choice' ? 4.5 : rig.dist);
    wantLook = m.g.position.clone().add(new THREE.Vector3(0, 1.4, 0));
    const f = new THREE.Vector3(Math.sin(rig.yaw), 0, Math.cos(rig.yaw));
    wantPos = wantLook.clone().addScaledVector(f, -dist * Math.cos(rig.pitch)).add(new THREE.Vector3(0, dist * Math.sin(rig.pitch) + 0.3, 0));
    const floor = Math.max(ground(wantPos.x + 50, wantPos.z + 20), world.seaY(wantPos.x, wantPos.z, time)) + 0.45;
    wantPos.y = Math.max(wantPos.y, floor);
    if (modal === 'choice') wantLook.lerp(world.witches[1].jarWorld, 0.35);
  } else { wantPos = camPos.clone(); wantLook = camLook.clone(); }
  const kk = 1 - Math.exp(-dt * k);
  camPos.lerp(wantPos, kk); camLook.lerp(wantLook, kk);
  camera.position.copy(camPos); camera.lookAt(camLook);
}

// =====================================================================================
// HUD
// =====================================================================================
const ribChips = r => RIB.map(k => `<span class="rb ${r[k] ? '' : 'lost'}"><i class="dot" style="background:${RIB_CSS[k]}"></i>${cap(k)}</span>`).join('');
function stateLine(a) {
  const tide = tideState(S.t, S.p);
  if (a.foam) return 'Sea foam.';
  if (a.understood) return 'Understood. Help someone else.';
  if (!a.r.walking) return a.ledBy >= 0 ? `${nameOf(a.ledBy)} is leading you.` : 'Wait for someone to take your hand.';
  if (a.zone < 2) {
    if (canPayOf(S, a, a.zone + 1)) return a.zone === 0 ? 'Border open → swim right. Costs your Voice.' : 'Border open → swim on. Costs two more.';
    if (a.zone === 1 && (a.r.hands + a.r.sight + a.r.walking) < 3) return 'Not enough left to cross. Help others.';
    if (tide.low && a.crossedTide === tide.tide) return 'One border per tide. Wait.';
    return tide.phase === 'dawn-near' ? 'The tide won’t go out again.' : 'Wait for low tide.';
  }
  return 'Gather around a Land Dweller.';
}
function tideText() {
  const tide = tideState(S.t, S.p);
  $('tidePill').className = 'glass ' + (S.over ? 'dawn' : tide.low ? 'low' : '');
  if (S.over) return 'Dawn';
  if (tide.phase === 'deep') return `Low tide in ${fmt(tide.next - S.t)}`;
  if (tide.phase === 'dawn-near') return `Dawn in ${fmt(dawnTime(S.p) - S.t)}`;
  if (tide.low) return `Borders open · ${fmt(tide.next - S.t)}`;
  return `Low tide in ${fmt(tide.next - S.t)}`;
}
let hudT = 0;
function updateHUD(dt) {
  toastT -= dt; if (toastT < 0) $('toast').style.opacity = 0;
  tipT -= dt;
  const a = me();
  if (!a || (mode !== 'solo' && mode !== 'client')) return;
  hudT -= dt; if (hudT > 0) return; hudT = 0.12;
  $('tidePill').textContent = tideText();
  $('dawnBar').firstElementChild.style.width = `${Math.min(100, S.t / dawnTime(S.p) * 100)}%`;
  $('meRibs').innerHTML = ribChips(a.r);
  if (tipT <= 0) { $('tip').classList.remove('new'); $('tip').textContent = stateLine(a); }
  $('meMic').style.display = voice && voice.hasMic ? '' : 'none';
  const ps = [];
  const g = giveTarget(S, myId);
  if (g) ps.push(`<span class="p glass hot"><kbd>E</kbd> give ${cap(lacksOf(g))} to ${esc(nameOf(g.id))}</span>`);
  const h = nearestHand(S, myId);
  if (a.holding >= 0) ps.push(`<span class="p glass hot">holding ${esc(nameOf(a.holding))}</span>`);
  else if (h && !a.foam) ps.push(`<span class="p glass ${!h.r.walking ? 'hot' : ''}">hold <kbd>R</kbd> take ${esc(nameOf(h.id))}’s hand</span>`);
  if (!a.r.walking && a.ledBy < 0 && !a.foam && !a.understood) ps.push(`<span class="p glass hot"><kbd>Q</kbd> ask for help</span>`);
  $('prompt').innerHTML = ps.join('');
  // first-time tips
  if (!a.r.walking && !a.foam && !a.understood) tip('noWalk', 'You can’t walk. <b>Q</b> to ask for help.');
  if (!a.r.sight && !a.foam) tip('noSight', 'You can’t see. Stay close to others.');
  if (a.zone === 1 && inRip(a.x, a.z) && tideState(S.t, S.p).low) tip('rip', 'Rip current. <b>Hold R</b> with someone to push through.');
  if (a.zone === 2 && !a.understood) tip('shore', '<b>Gather around a Land Dweller</b> with others.');
  if (g) tip('give', `${esc(nameOf(g.id))} lost their ${cap(lacksOf(g))}. <b>E</b> to give yours.`);
  // the choice can only be made while the tide is out
  if (modal === 'choice') { const tide = tideState(S.t, S.p); if (!tide.low || a.zone !== 1 || (mode === 'client' && !a.choosing && a.zone === 2)) closeChoice(); else $('choiceSub').textContent = `The Sea Witch takes the other two · ${fmt(tide.next - S.t)}`; }
}

// =====================================================================================
// experiment panel
// =====================================================================================
const P = {
  givers: ['sGivers', 'oGivers', 1, v => `${v} of ${params.merfolk}`, v => sim.setGivers(v)],
  dwellers: ['sDwellers', 'oDwellers', 1, v => `${v}`, v => { sim.setDwellers(v); syncViews(); }],
  busy: ['sBusy', 'oBusy', 100, v => `${Math.round(v * 100)}%`, v => { sim.p.busy = v; }],
  tides: ['sTides', 'oTides', 1, v => `${v}`, v => { sim.p.tides = v; }],
};
for (const [key, [sid, oid, scale, txt, apply]] of Object.entries(P)) {
  const el = $(sid);
  el.addEventListener('input', () => { params[key] = +el.value / scale; $(oid).textContent = txt(params[key]); apply(params[key]); });
}
$('cKinder').onchange = () => { params.kinder = sim.p.kinder = $('cKinder').checked; };
$('cRips').onchange = () => { params.rips = sim.p.rips = $('cRips').checked; };
$('cFar').onchange = () => { params.far = $('cFar').checked; sim.setFar(params.far); world.buildDinner(params.far); };
$('sKeep').onchange = () => { params.keep = sim.p.keep = $('sKeep').value; };
$('wPause').onclick = () => { paused = !paused; refreshPanel(); };
$('wReset').onclick = () => { newLocalNight({ ...params }, (seed = randSeed())); focus = -1; show('follow', false); refreshPanel(); };
$('wReplay').onclick = () => { newLocalNight({ ...params }, seed); focus = -1; show('follow', false); refreshPanel(); };
document.querySelectorAll('#wSpeed button').forEach(b => b.onclick = () => { speed = +b.dataset.s; document.querySelectorAll('#wSpeed button').forEach(x => x.classList.toggle('on', x === b)); });
document.querySelectorAll('#panel .preset').forEach(b => b.onclick = () => {
  Object.assign(params, { dwellers: 3, tides: 3, kinder: true, keep: 'random', rips: true }, JSON.parse(b.dataset.p));
  newLocalNight({ ...params }, (seed = randSeed())); focus = -1; show('follow', false); refreshPanel();
});
$('wBatch').onclick = async () => {
  const btn = $('wBatch'); btn.disabled = true;
  const N = 20, sum = { understood: 0, shore: 0, gifts: 0 };
  for (let i = 0; i < N; i++) {
    const st = createSim({ ...params }, 1000 + i).run();
    sum.understood += st.understood; sum.shore += st.shore; sum.gifts += st.gifts;
    btn.textContent = `Running… ${i + 1}/${N}`; await new Promise(r => setTimeout(r, 0));
  }
  addHistory(params, { understood: sum.understood / N, shore: sum.shore / N, gifts: sum.gifts / N }, N);
  btn.textContent = 'Run 20 nights instantly'; btn.disabled = false;
};
const settingsText = p => `${p.givers} givers · ${p.dwellers} dwellers · ${Math.round(p.busy * 100)}% busy · ${p.tides} tides${p.kinder ? '' : ' · kinder off'}${p.rips ? '' : ' · no rips'}${p.far ? ' · far shore' : ''}${p.keep !== 'random' ? ' · keep ' + p.keep : ''}`;
function addHistory(p, st, n) {
  history.unshift([settingsText(p) + (n > 1 ? ` (avg of ${n})` : ''), st.understood, st.shore, st.gifts]);
  $('wHist').innerHTML = history.slice(0, 12).map(h => `<tr>${h.map((c, i) => `<td class="${i === 1 ? 'big' : ''}">${typeof c === 'number' ? (Number.isInteger(c) ? c : c.toFixed(1)) : esc(c)}</td>`).join('')}</tr>`).join('');
  show('wHistWrap');
}
function refreshPanel() {
  for (const [key, [sid, oid, scale, txt]] of Object.entries(P)) { $(sid).value = params[key] * scale; $(oid).textContent = txt(params[key]); }
  $('cKinder').checked = params.kinder; $('cFar').checked = params.far; $('cRips').checked = params.rips; $('sKeep').value = params.keep;
  $('wPause').textContent = paused ? 'Play' : 'Pause';
}
let panelT = 0;
function updatePanel(dt) {
  if (mode !== 'watch' || !sim) return;
  panelT -= dt; if (panelT > 0) return; panelT = 0.2;
  const st = sim.stats, tide = tideState(sim.t, sim.p);
  const deep = sim.m.filter(a => !a.foam && a.zone === 0).length, shal = sim.m.filter(a => !a.foam && a.zone === 1).length;
  const tl = sim.over ? 'Dawn' : tide.phase === 'deep' ? 'The Deep' : tide.low ? 'Low tide · borders open' : tide.phase === 'dawn-near' ? 'The sun is coming' : `High tide ${tide.tide}`;
  $('wStats').innerHTML = [[deep, 'in the Deep'], [shal, 'in the Shallows'], [st.shore, 'reached Shore'], [st.understood, 'understood', true], [sim.over ? st.foam : '–', 'sea foam'], [st.gifts, 'ribbons given']]
    .map(([n, l, key]) => `<div class="${key ? 'key' : ''}"><strong>${n}</strong><span>${l}</span></div>`).join('')
    + `<div style="grid-column:1/-1;font-size:12px;color:var(--muted);background:none;padding:2px 0">${tl} · ${sim.over ? 'Dawn' : fmt(dawnTime(sim.p) - sim.t) + ' to dawn'}</div>`;
  if (focus >= 0) {
    const a = sim.m[focus];
    const line = a.foam ? 'Sea foam.' : a.understood ? `Understood: “${a.message}”` : !a.r.sight ? 'Eyes closed. She drifts.' : !a.r.walking ? (a.ledBy >= 0 ? `Being led by #${a.ledBy + 1}.` : 'Cannot move alone.') : a.zone < 2 ? 'Heading for the shore. She cannot see how crowded it is.' : a.attention > 0 ? `Someone is listening (${Math.floor(a.attention)} / 10 s).` : 'Trying to catch a Land Dweller’s attention.';
    $('follow').innerHTML = `<b>Merfolk #${a.id + 1}${a.giver ? ' · giver' : ''}</b><div class="rbs">${ribChips(a.r)}</div><div style="font-size:13px;color:#c9d4df">${line}</div><div style="font-size:12px;color:var(--muted);margin-top:6px">You see only what she sees. Esc to go back.</div>`;
  }
}
let rosterT = 0;
function updateRoster(dt) {
  if (mode !== 'host' || !S || !S.m.some(a => a.human)) return;
  rosterT -= dt; if (rosterT > 0) return; rosterT = 0.3;
  const tide = tideState(S.t, S.p);
  $('roster').innerHTML = `<div style="font-weight:700;margin-bottom:6px">${S.over ? 'Dawn' : tide.low ? 'Low tide · borders open' : tide.phase === 'deep' ? 'The Deep' : tide.phase === 'dawn-near' ? 'The sun is coming' : 'High tide ' + tide.tide} <span style="color:var(--muted);font-weight:400">· ${S.over ? '' : fmt(dawnTime(S.p) - S.t) + ' to dawn'}</span></div>`
    + S.m.filter(a => a.human).map(a => `<div class="r"><span class="nm">${esc(a.name)}</span><span class="mini">${RIB.map(k => `<i style="background:${a.r[k] ? RIB_CSS[k] : 'rgba(255,255,255,.12)'}"></i>`).join('')}</span><span class="st">${a.foam ? 'sea foam' : a.understood ? 'understood' : ['Deep', 'Shallows', 'Shore'][a.zone]}</span></div>`).join('');
}

// =====================================================================================
// labels, name tags, hand links
// =====================================================================================
const labels = [['DEEP SEA', 25], ['SHALLOWS', 61], ['SHORE', 86]].map(([t, x]) => {
  const el = document.createElement('div'); el.className = 'label3d'; el.textContent = t; document.body.appendChild(el);
  return { el, pos: W(x, -4, 1.5) };
});
function project(p) { const v = p.clone().project(camera); return { x: (v.x * 0.5 + 0.5) * innerWidth, y: (-v.y * 0.5 + 0.5) * innerHeight, ok: v.z < 1 && v.z > -1 }; }
const tagEls = new Map();
function tagFor(id) {
  let el = tagEls.get(id);
  if (!el) { el = document.createElement('div'); el.className = 'tag'; $('tags').appendChild(el); tagEls.set(id, el); }
  return el;
}
const links = [];
const linkMat = new THREE.LineBasicMaterial({ color: 0xffd38a, transparent: true, opacity: 0.95 });
function linkLine(i) {
  while (links.length <= i) { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3)); const l = new THREE.Line(g, linkMat); l.frustumCulled = false; scene.add(l); links.push(l); }
  return links[i];
}

// =====================================================================================
// main loop
// =====================================================================================
const clock = new THREE.Clock();
let time = 0;
function frame() {
  try { frameBody(); } catch (e) { console.error(e); }
  requestAnimationFrame(frame);
}
let rawDt = 0;
function frameBody() {
  rawDt = Math.min(clock.getDelta(), 0.5);   // the night keeps real time even on a slow big screen
  const dt = Math.min(rawDt, 0.05);
  time += dt;
  sendInput(time);

  // run the night here (alone, on the big screen, in the experiment, behind the menu)
  if (sim && S === sim && !sim.over && !paused && !(mode === 'solo' && modal)) {
    const sp = mode === 'solo' ? (fast ? 6 : 1) : mode === 'watch' ? speed : 1;
    acc += (mode === 'host' ? rawDt : dt) * sp;
    let n = 0;
    while (acc >= CONST.DT && n < 300) {
      sim.step(); acc -= CONST.DT; n++;
      if (sim.events.length) {
        const list = sim.events.splice(0);
        handleEvents(list);
        if (mode === 'host' && room) room.broadcast({ t: 'ev', list });
      }
    }
  }
  if (mode === 'host' && room && sim) { snapT -= dt; if (snapT <= 0) { snapT = 1 / 15; if (sim.m.some(a => a.human)) room.broadcast(packState(sim)); } }
  if (mode === 'title' && sim.over && (!sinking.size || [...sinking.values()].every(v => v > 6))) newLocalNight({ ...params }, randSeed());

  if (!S) { world.update(dt, time, 0, false); updateCamera(dt, time); world.composer.render(); return; }

  // tide changes: a bell, and the sea goes quiet (like the larp)
  const tide = tideState(S.t, S.p);
  if (tide.low && !prevLow && mode !== 'title') { sound.bell(523, 0.45); if (me()) toast('Low tide. The borders are open.'); }
  if (tide.phase === 'dawn-near' && prevPhase !== 'dawn-near' && me()) toast('“The sun is coming,” says the Sea Witch.');
  prevLow = tide.low; prevPhase = tide.phase;
  sound.set(sound.oceanGain, mode === 'title' ? 0.35 : S.over ? 0.15 : tide.low ? 0.03 : 0.5, 0.8);
  world.update(dt, time, S.over ? 1 : Math.min(1, S.t / dawnTime(S.p)), tide.low);

  // what can she see?
  const viewer = focus >= 0 ? S.m[focus] : null;
  const seeR = viewer ? (viewer.r.sight ? CONST.SIGHT_R + 1 : 2.4) : Infinity;
  const wantFog = !viewer ? 0.0055 : viewer.foam ? 0.01 : viewer.r.sight ? 0.016 : 0.12;
  scene.fog.density += (wantFog - scene.fog.density) * Math.min(1, dt * 2);
  darkK += ((viewer && !viewer.r.sight && !viewer.foam ? 1 : 0) - darkK) * Math.min(1, dt * 1.5);
  world.grade.uniforms.uDark.value = darkK * 0.75;

  // voice: who is talking, and from where
  const speakers = {};
  const talking = new Set();
  if (voice) {
    const mine = me();
    voice.setMuted(!mine || !mine.r.voice || mine.foam);
    for (const [slot, cid] of Object.entries(peerOfSlot)) {
      const a = S.m[slot]; if (!a || +slot === myId) continue;
      const p = mer[slot] ? mer[slot].g.position.clone().add(new THREE.Vector3(0, 1.6, 0)) : W(a.x, a.z, 1);
      speakers[cid] = { x: p.x, y: p.y, z: p.z, voiced: a.r.voice && !a.foam };
      if (a.r.voice && voice.levelOf(cid) > 0.035) talking.add(+slot);
    }
    const fwd = new THREE.Vector3(); camera.getWorldDirection(fwd);
    voice.update(speakers, { pos: camera.position, fwd });
    const lv = voice.myLevel();
    if (lv > 0.035 && mine && mine.r.voice) talking.add(myId);
    const dot = $('meMic').firstElementChild; dot.style.transform = `scale(${1 + Math.min(1.5, lv * 20)})`; dot.style.background = mine && mine.r.voice ? (lv > 0.035 ? '#9fc4ff' : '#4a6a8a') : '#3a3a3a';
  }

  // merfolk
  let voiced = 0, li = 0;
  const handPos = new THREE.Vector3(), handPos2 = new THREE.Vector3();
  S.m.forEach((a, i) => {
    const v = mer[i]; if (!v) return;
    const inWater = a.zone < 2;
    const wp = W(a.x, a.z);
    wp.y = inWater ? Math.max(world.seaY(wp.x, wp.z, time) - 0.92, ground(a.x, a.z) - 0.05) : ground(a.x, a.z);
    if (sinking.has(i)) { const s = sinking.get(i) + dt; sinking.set(i, s); v.sink = Math.max(0, s / 3); if (s > 0 && s < 4 && Math.random() < 0.5) world.fx.bubbles.emit(v.g.position.clone().add(new THREE.Vector3((Math.random() - 0.5), 0.5 + Math.random() * 1.2, (Math.random() - 0.5))), new THREE.Vector3(0, 0.6 + Math.random(), 0), new THREE.Color(0xdff4ff), 2.5); }
    const vis = !viewer || i === focus || Math.hypot(a.x - viewer.x, a.z - viewer.z) <= seeR;
    v.setVisible(vis && v.sink < 1.4);
    const hidden = RIB.map(k => (pendingIn.get(`${i}:${k}`) || 0) > 0);
    const mine = me();
    const need = mine && i !== myId && !a.foam && !a.understood && lacksOf(a) && mine.r[lacksOf(a)] && Math.hypot(a.x - mine.x, a.z - mine.z) < 4 ? RIB_HEX[lacksOf(a)] : 0;
    const held = a.holding >= 0 && mer[a.holding] ? mer[a.holding] : null;
    const holder = S.m.find(b => b.holding === i);
    v.update(a, wp, dt, time, { camera, isPlayer: i === myId, needColor: need, showGiver: mode === 'watch', ribbonHidden: hidden,
      holdTarget: held ? held.handL(handPos) : null, heldBy: holder && mer[holder.id] ? mer[holder.id].hand(handPos2) : null });
    // a golden thread between held hands
    if (held && vis) {
      const l = linkLine(li++); const p = l.geometry.attributes.position;
      const h1 = v.hand(), h2 = held.handL();
      p.setXYZ(0, h1.x, h1.y, h1.z); p.setXYZ(1, h2.x, h2.y, h2.z); p.needsUpdate = true; l.visible = true;
      if (Math.random() < dt * 6) world.fx.sparkles.emit(h1.clone().lerp(h2, Math.random()), new THREE.Vector3(0, 0.3, 0), new THREE.Color(0xffd38a), 0.8);
    }
    if (a.r.voice && !a.foam) {
      voiced++;
      const humming = a.humT > 0 || talking.has(i);
      if (vis && Math.random() < dt * (humming ? 6 : 0.5))
        world.fx.hums.emit(v.g.position.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.3, 1.9, (Math.random() - 0.5) * 0.3)), new THREE.Vector3((Math.random() - 0.5) * 0.3, 0.7, (Math.random() - 0.5) * 0.3), new THREE.Color(humming ? 0xcfe2ff : 0x9fc4ff), 2.5);
    }
    if (vis && inWater && !a.foam && Math.random() < dt * 0.8) world.fx.bubbles.emit(v.g.position.clone().add(new THREE.Vector3(0, 0.6, 0)), new THREE.Vector3(0, 0.7, 0), new THREE.Color(0x7fb4d8), 1.4);
    // name tags for people
    const showTag = a.human && i !== myId && !a.foam && v.g.visible && (mode === 'host' || mode === 'client' || (mode === 'solo' && false));
    const el = a.human ? tagFor(i) : null;
    if (el) {
      if (!showTag) el.style.display = 'none';
      else {
        const s = project(v.g.position.clone().add(new THREE.Vector3(0, 2.6 - 0.5 * v.sit, 0)));
        el.style.display = s.ok ? '' : 'none'; el.style.left = `${s.x}px`; el.style.top = `${s.y}px`;
        el.textContent = a.name || names[i] || '';
        el.className = 'tag' + (i === myId ? ' me' : '') + (talking.has(i) ? ' talk' : '');
      }
    }
  });
  for (let k = li; k < links.length; k++) links[k].visible = false;
  sound.set(sound.humGain, mode === 'title' ? 0.03 : S.over ? 0 : 0.11 * voiced / Math.max(1, S.m.length), 1.2);

  // rip currents: foam streaks pulling back toward the sea at low tide
  if (tide.low && S.p.rips !== false) for (const [z0, z1] of RIPS) {
    if (Math.random() < dt * 40) {
      const z = z0 + Math.random() * (z1 - z0), x = 53 + Math.random() * 18;
      if (!viewer || Math.hypot(x - viewer.x, z - viewer.z) < seeR + 6) world.fx.sparkles.emit(W(x, z, world.seaY(x - 50, z - 20, time) + 0.08), new THREE.Vector3(-3.5, 0, (Math.random() - 0.5) * 0.4), new THREE.Color(0x9fe8ff).multiplyScalar(0.7), 1.2);
    }
  }

  // Land Dwellers
  S.ld.forEach((l, j) => {
    if (!dw[j]) return;
    const pos = W(l.x, l.z, ground(l.x, l.z));
    const head = l.facing && l.target >= 0 && mer[l.target] ? mer[l.target].g.position.clone().add(new THREE.Vector3(0, 1.55, 0)) : null;
    const vis = !viewer || Math.hypot(l.x - viewer.x, l.z - viewer.z) <= seeR;
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

  // becoming foam: everything goes white
  const mine = me();
  const wantWhite = mine && S.over && !mine.understood ? 0.75 : 0;
  whiteK += (wantWhite - whiteK) * Math.min(1, dt * 0.5);
  world.grade.uniforms.uWhite.value = whiteK;

  updateCamera(dt, time);
  updateHUD(dt);
  updatePanel(dt);
  updateRoster(dt);

  for (let i = bubbles.length - 1; i >= 0; i--) {
    const b = bubbles[i]; b.t -= dt;
    const s = project(b.getPos());
    b.el.style.left = `${s.x}px`; b.el.style.top = `${s.y}px`; b.el.style.display = s.ok ? '' : 'none';
    b.el.style.opacity = Math.min(1, b.t);
    if (b.t <= 0) { b.el.remove(); bubbles.splice(i, 1); }
  }
  labels.forEach(l => { const s = project(l.pos); const on = ((mode === 'watch' && focus < 0) || (mode === 'host' && S.m.some(a => a.human))) && s.ok; l.el.style.display = on ? '' : 'none'; l.el.style.left = `${s.x}px`; l.el.style.top = `${s.y}px`; });

  world.composer.render();
}


toTitle();
frame();
if (Q.get('room')) openJoin();

// hooks for automated tests
window.__ashore = { get sim() { return sim; }, get S() { return S; }, get mode() { return mode; }, get myId() { return myId; }, get room() { return room; },
  startSolo, startHost, startWatch, openJoin, startRoomNight, keys, choose,
  step(t) { while (sim && sim.t < t && !sim.over) { sim.step(); const list = sim.events.splice(0); handleEvents(list); if (mode === 'host' && room) room.broadcast({ t: 'ev', list }); } if (mode === 'host' && room) room.broadcast(packState(sim)); } };
