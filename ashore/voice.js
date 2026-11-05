// Ashore — proximity voice. While you still have your Voice you can talk to people near you
// in the Deep; the further away, the quieter, and you hear which side it comes from.
// When the Sea Witch takes your Voice, your microphone goes silent.
export function createVoice(peer, ctx, out) {
  const remotes = new Map();   // peerId -> { panner, gain, analyser, el, data }
  let local = null, localAnalyser = null, localData = null, muted = false;

  function attach(id, stream) {
    if (remotes.has(id)) return;
    // Chrome only feeds a remote WebRTC stream into Web Audio if it is also playing in a (muted) element
    const el = new Audio(); el.srcObject = stream; el.muted = true; el.play().catch(() => {});
    const src = ctx.createMediaStreamSource(stream);
    const gain = ctx.createGain(); gain.gain.value = 0;
    const panner = ctx.createPanner();
    Object.assign(panner, { panningModel: 'HRTF', distanceModel: 'linear', refDistance: 1.5, maxDistance: 20, rolloffFactor: 1 });
    const analyser = ctx.createAnalyser(); analyser.fftSize = 512;
    src.connect(analyser); src.connect(gain); gain.connect(panner); panner.connect(out);
    remotes.set(id, { el, gain, panner, analyser, data: new Uint8Array(analyser.fftSize) });
  }
  function onCall(call) {
    call.answer(local || undefined);
    call.on('stream', st => attach(call.peer, st));
    call.on('close', () => drop(call.peer));
  }
  function drop(id) {
    const r = remotes.get(id); if (!r) return;
    try { r.gain.disconnect(); r.panner.disconnect(); r.el.srcObject = null; } catch (e) { /* ignore */ }
    remotes.delete(id);
  }
  const level = (an, data) => { an.getByteTimeDomainData(data); let s = 0; for (const v of data) { const d = (v - 128) / 128; s += d * d; } return Math.sqrt(s / data.length); };

  return {
    async start() {
      try {
        local = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
        const src = ctx.createMediaStreamSource(local);
        localAnalyser = ctx.createAnalyser(); localAnalyser.fftSize = 512; localData = new Uint8Array(512);
        src.connect(localAnalyser);
      } catch (e) { local = null; }
      if (peer) peer.on('call', onCall);
      return !!local;
    },
    get hasMic() { return !!local; },
    // call everyone whose id sorts after mine (so each pair connects once)
    connect(ids, myId) {
      if (!peer || !local) return;
      for (const id of ids) if (id !== myId && id > myId && !remotes.has(id)) {
        const call = peer.call(id, local);
        if (!call) continue;
        call.on('stream', st => attach(id, st));
        call.on('close', () => drop(id));
      }
    },
    setMuted(m) { muted = m; if (local) local.getAudioTracks().forEach(t => { t.enabled = !m; }); },
    // speakers: peerId -> { x, y, z, voiced }; listener: { pos, fwd }
    update(speakers, listener) {
      const L = ctx.listener, t = ctx.currentTime;
      if (L.positionX) {
        L.positionX.setValueAtTime(listener.pos.x, t); L.positionY.setValueAtTime(listener.pos.y, t); L.positionZ.setValueAtTime(listener.pos.z, t);
        L.forwardX.setValueAtTime(listener.fwd.x, t); L.forwardY.setValueAtTime(listener.fwd.y, t); L.forwardZ.setValueAtTime(listener.fwd.z, t);
        L.upX.setValueAtTime(0, t); L.upY.setValueAtTime(1, t); L.upZ.setValueAtTime(0, t);
      } else { L.setPosition(listener.pos.x, listener.pos.y, listener.pos.z); L.setOrientation(listener.fwd.x, listener.fwd.y, listener.fwd.z, 0, 1, 0); }
      for (const [id, r] of remotes) {
        const s = speakers[id];
        const on = s && s.voiced ? 1 : 0;
        r.gain.gain.setTargetAtTime(on, t, 0.15);
        if (s) {
          if (r.panner.positionX) { r.panner.positionX.setValueAtTime(s.x, t); r.panner.positionY.setValueAtTime(s.y, t); r.panner.positionZ.setValueAtTime(s.z, t); }
          else r.panner.setPosition(s.x, s.y, s.z);
        }
      }
    },
    myLevel() { return localAnalyser && !muted ? level(localAnalyser, localData) : 0; },
    levelOf(id) { const r = remotes.get(id); return r ? level(r.analyser, r.data) : 0; },
    stop() { for (const id of [...remotes.keys()]) drop(id); if (local) local.getTracks().forEach(t => t.stop()); },
  };
}
