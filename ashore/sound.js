// Ashore — every sound is generated: the ocean, the humming school, bells, plucks.
export const sound = {
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
  set(gainNode, v, t = 0.6) { if (this.ctx && gainNode && Number.isFinite(v)) gainNode.gain.setTargetAtTime(v, this.ctx.currentTime, t); },
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
