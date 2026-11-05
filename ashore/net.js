// Ashore — rooms. The big screen hosts; everyone else joins with a 4-letter code.
// Two transports: PeerJS (real network, no login) and a local BroadcastChannel (tabs in one browser, for testing).
const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
export const newCode = () => Array.from({ length: 4 }, () => LETTERS[Math.floor(Math.random() * LETTERS.length)]).join('');
const PREFIX = 'ashore-room-';

let peerLib = null;
export function loadPeerJS() {
  if (window.Peer) return Promise.resolve(window.Peer);
  if (peerLib) return peerLib;
  peerLib = new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/peerjs@1.5.4/dist/peerjs.min.js';
    s.onload = () => res(window.Peer); s.onerror = () => rej(new Error('Could not load the network library.'));
    document.head.appendChild(s);
  });
  return peerLib;
}
const ICE = { config: { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }] } };

function emitter() {
  const h = {};
  return { on(k, f) { (h[k] = h[k] || []).push(f); }, emit(k, ...a) { (h[k] || []).forEach(f => f(...a)); } };
}

// ---------------------------------------------------------------- host
export async function hostRoom(kind) {
  const ev = emitter();
  const conns = new Map();
  let code = newCode(), close;
  if (kind === 'local') {
    const ch = new BroadcastChannel(PREFIX + code);
    ch.onmessage = e => {
      const { from, to, msg } = e.data; if (to !== 'host') return;
      if (msg.t === 'hello' && !conns.has(from)) { conns.set(from, true); ev.emit('join', from, msg); }
      else if (msg.t === 'bye') { conns.delete(from); ev.emit('leave', from); }
      else ev.emit('msg', from, msg);
    };
    const send = (id, msg) => ch.postMessage({ from: 'host', to: id, msg });
    close = () => ch.close();
    return { code, kind, on: ev.on, send, broadcast: msg => { for (const id of conns.keys()) send(id, msg); }, close, peer: null };
  }
  const Peer = await loadPeerJS();
  let peer;
  for (let tries = 0; tries < 4; tries++) {
    try {
      peer = await new Promise((res, rej) => {
        const p = new Peer(PREFIX + code, ICE);
        p.on('open', () => res(p));
        p.on('error', err => { p.destroy(); rej(err); });
      });
      break;
    } catch (err) { if (err.type === 'unavailable-id') { code = newCode(); continue; } throw err; }
  }
  if (!peer) throw new Error('Could not open a room.');
  peer.on('connection', c => {
    c.on('data', msg => {
      if (msg.t === 'hello' && !conns.has(c.peer)) { conns.set(c.peer, c); ev.emit('join', c.peer, msg); }
      else ev.emit('msg', c.peer, msg);
    });
    c.on('close', () => { if (conns.delete(c.peer)) ev.emit('leave', c.peer); });
    c.on('error', () => { if (conns.delete(c.peer)) ev.emit('leave', c.peer); });
  });
  peer.on('disconnected', () => { try { peer.reconnect(); } catch (e) { /* ignore */ } });
  const send = (id, msg) => { const c = conns.get(id); if (c && c.open) c.send(msg); };
  return { code, kind, on: ev.on, send, broadcast: msg => { for (const id of conns.keys()) send(id, msg); }, close: () => peer.destroy(), peer };
}

// ---------------------------------------------------------------- client
export async function joinRoom(kind, code, name) {
  const ev = emitter();
  code = code.toUpperCase().trim();
  if (kind === 'local') {
    const id = 'c' + Math.random().toString(36).slice(2, 8);
    const ch = new BroadcastChannel(PREFIX + code);
    ch.onmessage = e => { const { to, msg } = e.data; if (to === id) ev.emit('msg', msg); };
    const send = msg => ch.postMessage({ from: id, to: 'host', msg });
    send({ t: 'hello', name });
    addEventListener('beforeunload', () => send({ t: 'bye' }));
    return { id, kind, on: ev.on, send, close: () => { send({ t: 'bye' }); ch.close(); }, peer: null };
  }
  const Peer = await loadPeerJS();
  const peer = await new Promise((res, rej) => {
    const p = new Peer(undefined, ICE);
    p.on('open', () => res(p)); p.on('error', rej);
  });
  const conn = await new Promise((res, rej) => {
    const c = peer.connect(PREFIX + code, { reliable: true, serialization: 'json' });
    const timer = setTimeout(() => rej(new Error('No room with that code answered.')), 12000);
    c.on('open', () => { clearTimeout(timer); res(c); });
    peer.on('error', err => { clearTimeout(timer); rej(err.type === 'peer-unavailable' ? new Error('No room with that code.') : err); });
  });
  conn.on('data', msg => ev.emit('msg', msg));
  conn.on('close', () => ev.emit('close'));
  conn.send({ t: 'hello', name });
  return { id: peer.id, kind, on: ev.on, send: msg => { if (conn.open) conn.send(msg); }, close: () => peer.destroy(), peer };
}

// ---------------------------------------------------------------- state snapshots (host -> players, ~15 per second)
const BITS = ['voice', 'hands', 'sight', 'walking'];
export function packState(sim) {
  const m = [];
  for (const a of sim.m) {
    let b = 0;
    BITS.forEach((k, i) => { if (a.r[k]) b |= 1 << i; });
    b |= a.zone << 4;
    if (a.giver) b |= 64; if (a.understood) b |= 128; if (a.foam) b |= 256; if (a.human) b |= 512;
    if (a.choosing) b |= 1024; if (a.humT > 0) b |= 2048; if (a.signal > 0) b |= 4096;
    m.push(Math.round(a.x * 20), Math.round(a.z * 20), b, Math.round(a.attention * 10), a.holding, a.ledBy, a.crossedTide);
  }
  const ld = [];
  for (const l of sim.ld) ld.push(Math.round(l.x * 20), Math.round(l.z * 20), l.facing ? 1 : 0, l.target);
  return { t: 's', time: Math.round(sim.t * 10) / 10, over: sim.over, m, ld, st: sim.stats, p: { tides: sim.p.tides, night: sim.p.night, far: sim.p.far, rips: sim.p.rips } };
}
export function unpackState(mirror, snap) {
  mirror.t = snap.time; mirror.over = snap.over; mirror.stats = snap.st; Object.assign(mirror.p, snap.p);
  const n = snap.m.length / 7;
  for (let i = 0; i < n; i++) {
    const o = i * 7, b = snap.m[o + 2];
    const a = mirror.m[i] || (mirror.m[i] = { id: i, r: {}, message: '', name: '' });
    a.x = snap.m[o] / 20; a.z = snap.m[o + 1] / 20;
    BITS.forEach((k, j) => { a.r[k] = !!(b & (1 << j)); });
    a.zone = (b >> 4) & 3; a.giver = !!(b & 64); a.understood = !!(b & 128); a.foam = !!(b & 256); a.human = !!(b & 512);
    a.choosing = !!(b & 1024); a.humT = b & 2048 ? 1 : 0; a.signal = b & 4096 ? 1 : 0;
    a.attention = snap.m[o + 3] / 10; a.holding = snap.m[o + 4]; a.ledBy = snap.m[o + 5]; a.crossedTide = snap.m[o + 6];
  }
  mirror.m.length = n;
  const k = snap.ld.length / 4;
  for (let j = 0; j < k; j++) {
    const o = j * 4, l = mirror.ld[j] || (mirror.ld[j] = { id: j });
    l.x = snap.ld[o] / 20; l.z = snap.ld[o + 1] / 20; l.facing = !!snap.ld[o + 2]; l.target = snap.ld[o + 3];
  }
  mirror.ld.length = k;
}
