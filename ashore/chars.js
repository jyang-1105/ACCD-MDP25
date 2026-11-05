// Ashore — the people: merfolk (tail in the sea, legs on land, four flowing ribbons)
// and Land Dwellers (at dinner, back to the sea).
import * as THREE from 'three';
import { glowTexture } from './world.js';

export const RIB = ['voice', 'hands', 'sight', 'walking'];
export const RIB_HEX = { voice: 0xf7f3ea, hands: 0xd9483b, sight: 0x3e7fc9, walking: 0xe8b931 };

const lathe = (pts, segs = 20) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), segs);
const TORSO = lathe([[0.001, 0.82], [0.16, 0.84], [0.18, 0.92], [0.14, 1.04], [0.15, 1.14], [0.19, 1.25], [0.2, 1.34], [0.15, 1.42], [0.06, 1.46], [0.055, 1.52], [0.001, 1.53]]);
const HEAD = new THREE.SphereGeometry(0.135, 24, 18);
const HAIRCAP = new THREE.SphereGeometry(0.15, 24, 18, 0, Math.PI * 2, 0, Math.PI * 0.62);
const HAIRLONG = lathe([[0.001, 0.0], [0.11, 0.05], [0.15, 0.3], [0.13, 0.5], [0.001, 0.56]], 16);
const ARM = new THREE.CapsuleGeometry(0.04, 0.46, 4, 10);
const LEG = new THREE.CapsuleGeometry(0.06, 0.72, 4, 10);
const EYE = new THREE.SphereGeometry(0.018, 8, 6);
const LID = new THREE.BoxGeometry(0.04, 0.006, 0.01);
const BAND = lathe([[0.205, 1.22], [0.212, 1.26], [0.207, 1.33], [0.19, 1.36]], 20);
const COAT = lathe([[0.001, 0.0], [0.24, 0.02], [0.22, 0.5], [0.2, 0.9], [0.24, 1.35], [0.22, 1.5], [0.08, 1.58], [0.001, 1.6]], 20);
const FIN = (() => {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.bezierCurveTo(0.12, -0.05, 0.32, -0.08, 0.42, -0.32);
  s.bezierCurveTo(0.3, -0.24, 0.12, -0.24, 0, -0.14);
  s.bezierCurveTo(-0.12, -0.24, -0.3, -0.24, -0.42, -0.32);
  s.bezierCurveTo(-0.32, -0.08, -0.12, -0.05, 0, 0);
  return new THREE.ShapeGeometry(s, 16);
})();
const RING = new THREE.RingGeometry(0.85, 0.95, 48);
const GLOW_TEX = glowTexture();

const M = {
  skin: [0xf2cdb4, 0xd9a07c, 0x8d5a3e, 0xf6dcc8, 0xb07a58].map(c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.55 })),
  hair: [0x120d0b, 0x3a2016, 0x7a2a16, 0x183c40, 0xd9c6cc, 0x2b1b3a].map(c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.45 })),
  tailColors: [0x1fa3a0, 0x6b4fc4, 0xe0705f, 0x2f8a63, 0x2d5fd0, 0xc9a23a],
  ribbon: RIB.map(k => new THREE.MeshStandardMaterial({ color: RIB_HEX[k], roughness: 0.6, side: THREE.DoubleSide, emissive: RIB_HEX[k], emissiveIntensity: 0.35 })),
  dark: new THREE.MeshBasicMaterial({ color: 0x0a0a0c }),
};

const RINGS = 16, SIDES = 14;
const _v = new THREE.Vector3(), _a = new THREE.Vector3(), _b = new THREE.Vector3();

export class Merfolk {
  constructor(scene, id) {
    this.scene = scene; this.id = id;
    let s = id * 9973 + 7; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
    this.g = new THREE.Group();
    this.body = new THREE.Group(); this.g.add(this.body);
    this.skin = M.skin[Math.floor(rnd() * M.skin.length)].clone();
    const hair = M.hair[Math.floor(rnd() * M.hair.length)];
    const tc = M.tailColors[Math.floor(rnd() * M.tailColors.length)];
    this.tailMat = new THREE.MeshPhysicalMaterial({ color: tc, roughness: 0.22, metalness: 0.25, clearcoat: 0.8, clearcoatRoughness: 0.2,
      iridescence: 1, iridescenceIOR: 1.6, iridescenceThicknessRange: [180, 650] });
    const add = (geo, mat, parent = this.body) => { const m = new THREE.Mesh(geo, mat); m.castShadow = true; parent.add(m); return m; };
    add(TORSO, this.skin).scale.z = 0.72;
    add(BAND, this.tailMat).scale.z = 0.74;
    const head = add(HEAD, this.skin); head.position.y = 1.64; head.scale.y = 1.12;
    const cap = add(HAIRCAP, hair); cap.position.set(0, 1.66, -0.012); cap.rotation.x = -0.35;
    const lh = add(HAIRLONG, hair); lh.position.set(0, 1.2, -0.08); lh.scale.set(1, 0.9 + rnd() * 0.5, 0.45); lh.rotation.x = 0.12;
    this.eyes = [-1, 1].map(k => { const e = add(EYE, M.dark); e.position.set(0.045 * k, 1.665, 0.118); return e; });
    this.lids = [-1, 1].map(k => { const e = add(LID, M.dark); e.position.set(0.045 * k, 1.662, 0.124); e.visible = false; return e; });
    this.arms = [-1, 1].map(k => { const p = new THREE.Group(); p.position.set(0.2 * k, 1.36, 0); this.body.add(p); add(ARM, this.skin, p).position.y = -0.27; return p; });
    this.legs = [-1, 1].map(k => { const p = new THREE.Group(); p.position.set(0.085 * k, 0.86, 0); this.body.add(p); add(LEG, this.skin, p).position.y = -0.42; return p; });
    // tail: a ring mesh rebuilt every frame along a swaying spine
    const tg = new THREE.BufferGeometry();
    tg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(RINGS * (SIDES + 1) * 3), 3));
    const idx = [];
    for (let i = 0; i < RINGS - 1; i++) for (let j = 0; j < SIDES; j++) { const a = i * (SIDES + 1) + j, b = a + SIDES + 1; idx.push(a, b, a + 1, a + 1, b, b + 1); }
    tg.setIndex(idx);
    this.tail = add(tg, this.tailMat); this.tail.frustumCulled = false;
    this.fin = add(FIN, new THREE.MeshPhysicalMaterial({ color: tc, roughness: 0.3, metalness: 0.1, transparent: true, opacity: 0.85, side: THREE.DoubleSide, iridescence: 1, iridescenceIOR: 1.5 }));
    // ribbons (flat strips, world space)
    this.ribbons = M.ribbon.map(mat => {
      const n = 10, g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 2 * 3), 3));
      const id2 = []; for (let i = 0; i < n - 1; i++) { const a = i * 2; id2.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
      g.setIndex(id2);
      const m = new THREE.Mesh(g, mat); m.frustumCulled = false; scene.add(m);
      return { mesh: m, pts: [], n, shown: true };
    });
    // markers
    this.giverOrb = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW_TEX, color: 0xff8fa3, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.giverOrb.scale.setScalar(0.28); this.g.add(this.giverOrb);
    this.need = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW_TEX, color: 0xffffff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.need.scale.setScalar(0.5); this.need.position.y = 2.2; this.need.visible = false; this.g.add(this.need);
    this.halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW_TEX, color: 0xffd27a, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
    this.halo.scale.setScalar(3.2); this.halo.position.y = 1.1; this.g.add(this.halo);
    this.ringMat = new THREE.MeshBasicMaterial({ color: 0xffe2a0, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false });
    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.75, 0.9, 48, 1, Math.PI / 2, 0.001), this.ringMat);
    this.ring.rotation.x = -Math.PI / 2; this.ring.visible = false; this.g.add(this.ring);
    this.youRing = new THREE.Mesh(RING, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false }));
    this.youRing.rotation.x = -Math.PI / 2; this.youRing.visible = false; this.g.add(this.youRing);

    this.phase = rnd() * 10; this.sit = 0; this.inWater = true; this.sink = 0; this.lastRing = -1;
    this.pos = new THREE.Vector3(); this.vel = new THREE.Vector3(); this.yaw = 0; this.placed = false;
    scene.add(this.g);
  }

  dispose() { this.scene.remove(this.g); this.ribbons.forEach(r => this.scene.remove(r.mesh)); }

  anchor(k, out = new THREE.Vector3()) {
    if (k === 0) return this.body.localToWorld(out.set(0, 1.47, 0.07));
    if (k === 1) return this.arms[1].localToWorld(out.set(0, -0.5, 0));
    if (k === 2) return this.body.localToWorld(out.set(0, 1.76, 0.1));
    return this.inWater ? this.body.localToWorld(out.set(0, 0.55, 0.12)) : this.legs[0].localToWorld(out.set(0, -0.78, 0));
  }

  setVisible(v) { this.g.visible = v; this.ribbons.forEach(r => r.mesh.visible = v && r.shown); }

  updateTail(amp) {
    const pos = this.tail.geometry.attributes.position;
    const spine = this._spine || (this._spine = Array.from({ length: RINGS }, () => new THREE.Vector3()));
    for (let i = 0; i < RINGS; i++) {
      const u = i / (RINGS - 1);
      const w = Math.sin(this.phase - u * 3.2) * amp * u * u;
      spine[i].set(w * 0.4, 0.88 - u * 1.25 + u * u * 0.25, -u * u * 0.55 + w);
    }
    const prof = u => (u < 0.18 ? THREE.MathUtils.lerp(0.165, 0.175, u / 0.18) : THREE.MathUtils.lerp(0.175, 0.035, Math.pow((u - 0.18) / 0.82, 0.8)));
    const side = _a, up = _b, t = _v;
    for (let i = 0; i < RINGS; i++) {
      t.subVectors(spine[Math.min(RINGS - 1, i + 1)], spine[Math.max(0, i - 1)]).normalize();
      side.set(1, 0, 0).addScaledVector(t, -t.x).normalize();
      up.crossVectors(t, side).normalize();
      const r = prof(i / (RINGS - 1)), c = spine[i];
      for (let j = 0; j <= SIDES; j++) {
        const th = j / SIDES * Math.PI * 2, cs = Math.cos(th) * r, sn = Math.sin(th) * r * 0.8;
        pos.setXYZ(i * (SIDES + 1) + j, c.x + side.x * cs + up.x * sn, c.y + side.y * cs + up.y * sn, c.z + side.z * cs + up.z * sn);
      }
    }
    pos.needsUpdate = true;
    this.tail.geometry.computeVertexNormals();
    const end = spine[RINGS - 1], pre = spine[RINGS - 3];
    this.fin.position.copy(end);
    this.fin.lookAt(_v.copy(end).sub(pre).add(end).applyMatrix4(this.body.matrixWorld));
    this.fin.rotateX(Math.PI / 2);
  }

  // a = sim merfolk, target = world position, opts: { camera, isPlayer, needColor, attention }
  update(a, target, dt, time, opts) {
    if (!this.placed) { this.placed = true; this.g.position.copy(target); }
    const prev = this.g.position.clone();
    if (this.sink > 0) target = target.clone().add(new THREE.Vector3(0, -this.sink * 1.4, 0));
    this.g.position.lerp(target, 1 - Math.exp(-dt * 10));
    this.vel.copy(this.g.position).sub(prev).divideScalar(Math.max(dt, 1e-4));
    const sp = Math.hypot(this.vel.x, this.vel.z);
    if (sp > 0.25) {
      const want = Math.atan2(this.vel.x, this.vel.z);
      let d = want - this.yaw; d = Math.atan2(Math.sin(d), Math.cos(d));
      this.yaw += d * (1 - Math.exp(-dt * 6));
    }
    this.g.rotation.y = this.yaw;
    const r = a.r;
    this.inWater = a.zone < 2;
    this.phase += dt * (this.inWater ? 2 + sp * 1.4 : sp * 2.4);
    this.tail.visible = this.fin.visible = this.inWater;
    this.legs.forEach(l => l.visible = !this.inWater);
    if (this.inWater) { this.updateTail(r.walking ? 0.22 : 0.05); this.sit = 0; this.body.position.y = 0; }
    else {
      this.sit = THREE.MathUtils.lerp(this.sit, r.walking ? 0 : 1, dt * 2);
      const sw = Math.sin(this.phase) * 0.45 * Math.min(1, sp);
      this.legs[0].rotation.x = sw - 1.4 * this.sit; this.legs[1].rotation.x = -sw - 1.4 * this.sit;
      this.body.position.y = -0.5 * this.sit;
      // new legs hurt: a small wobble
      this.body.rotation.z = r.walking && sp > 0.3 ? Math.sin(time * 11 + this.id) * 0.06 : 0;
    }
    this.body.rotation.x = r.sight ? 0 : 0.14;
    const stroke = Math.sin(this.phase * 0.5) * 0.6 * Math.min(1, sp * 0.5 + 0.3);
    if (a.understood) { this.arms[0].rotation.set(-0.7, 0, -0.5); this.arms[1].rotation.set(-0.7, 0, 0.5); }
    else if (!r.hands) { this.arms[0].rotation.set(0.6, 0, 0.35); this.arms[1].rotation.set(0.6, 0, -0.35); }  // clasped behind the back
    else { this.arms[0].rotation.set(-stroke, 0, -0.18); this.arms[1].rotation.set(stroke, 0, 0.18); }
    this.eyes.forEach(e => e.visible = r.sight); this.lids.forEach(e => e.visible = !r.sight);

    // markers
    this.giverOrb.visible = a.giver && !a.foam;
    const ang = time * 1.6 + this.id;
    this.giverOrb.position.set(Math.cos(ang) * 0.42, 1.95 - 0.5 * this.sit + Math.sin(time * 2 + this.id) * 0.05, Math.sin(ang) * 0.42);
    this.need.visible = !!opts.needColor;
    if (opts.needColor) { this.need.material.color.setHex(opts.needColor); this.need.position.y = 2.25 - 0.5 * this.sit; this.need.scale.setScalar(0.45 + 0.12 * Math.sin(time * 5)); }
    this.youRing.visible = !!opts.isPlayer && !a.foam;
    if (this.youRing.visible) { this.youRing.position.y = this.inWater ? 0.92 : 0.05; this.youRing.scale.setScalar(1 + 0.05 * Math.sin(time * 3)); }
    const glow = a.understood ? 1 : 0;
    this.halo.material.opacity = THREE.MathUtils.lerp(this.halo.material.opacity, glow * (0.55 + 0.15 * Math.sin(time * 2 + this.id)), dt * 2);
    this.skin.emissive.setHex(0xffb040); this.skin.emissiveIntensity = this.halo.material.opacity * 0.35;
    const prog = a.understood || a.foam ? 0 : Math.min(1, a.attention / 10);
    this.ring.visible = prog > 0.01;
    if (this.ring.visible) {
      this.ring.position.y = this.inWater ? 0.93 : 0.06;
      if (Math.abs(prog - this.lastRing) > 0.01) {
        this.ring.geometry.dispose();
        this.ring.geometry = new THREE.RingGeometry(0.75, 0.9, 48, 1, Math.PI / 2, prog * Math.PI * 2);
        this.lastRing = prog;
      }
    }

    // ribbons: up and back in the sea, hanging and fluttering on land
    const back = _a.set(0, 0, -1).applyQuaternion(this.g.quaternion).clone();
    const camRight = _b.set(1, 0, 0).applyQuaternion(opts.camera.quaternion).clone();
    this.ribbons.forEach((rb, k) => {
      const show = r[RIB[k]] && !opts.ribbonHidden?.[k] && this.g.visible && !a.foam;
      rb.shown = r[RIB[k]] && !opts.ribbonHidden?.[k] && !a.foam;
      rb.mesh.visible = show;
      if (!show) { rb.pts.length = 0; return; }
      const anc = this.anchor(k);
      if (!rb.pts.length) for (let i = 0; i < rb.n; i++) rb.pts.push(anc.clone());
      rb.pts[0].copy(anc);
      for (let i = 1; i < rb.n; i++) {
        const drift = new THREE.Vector3(Math.sin(time * 1.3 + i * 0.7 + k * 2 + this.id), Math.sin(time * 1.1 + i * 0.5 + k), Math.cos(time * 1.7 + i * 0.6 + k * 3)).multiplyScalar(0.5);
        const flow = back.clone().multiplyScalar(0.8).add(drift).add(new THREE.Vector3(0, this.inWater ? 0.35 : -1.1, 0)).addScaledVector(this.vel, -0.1).normalize();
        const want = rb.pts[i - 1].clone().addScaledVector(flow, 0.14);
        rb.pts[i].lerp(want, 1 - Math.exp(-dt * 10));
        rb.pts[i].sub(rb.pts[i - 1]).normalize().multiplyScalar(0.14).add(rb.pts[i - 1]);
      }
      const p = rb.mesh.geometry.attributes.position;
      for (let i = 0; i < rb.n; i++) {
        const w = 0.035 * (1 - i / rb.n * 0.6);
        const tw = new THREE.Vector3().subVectors(rb.pts[Math.min(i + 1, rb.n - 1)], rb.pts[Math.max(i - 1, 0)]).normalize();
        const side = new THREE.Vector3().crossVectors(tw, camRight).normalize().cross(tw).normalize().multiplyScalar(w);
        p.setXYZ(i * 2, rb.pts[i].x + side.x, rb.pts[i].y + side.y, rb.pts[i].z + side.z);
        p.setXYZ(i * 2 + 1, rb.pts[i].x - side.x, rb.pts[i].y - side.y, rb.pts[i].z - side.z);
      }
      p.needsUpdate = true; rb.mesh.geometry.computeVertexNormals();
    });
  }
}

export class Dweller {
  constructor(scene, id) {
    this.scene = scene;
    const colors = [0x6b1f1a, 0x1f2f55, 0xb08a3c, 0x3d5a40, 0x5a3d6b, 0xd8d2c4, 0x2a2a2a, 0x8a4a2a];
    this.g = new THREE.Group();
    const cloth = new THREE.MeshStandardMaterial({ color: colors[id % colors.length], roughness: 0.75 });
    const coat = new THREE.Mesh(COAT, cloth); coat.scale.z = 0.75; coat.castShadow = true; this.g.add(coat);
    this.head = new THREE.Mesh(HEAD, M.skin[(id + 3) % 5]); this.head.position.y = 1.78; this.head.scale.setScalar(1.05); this.head.castShadow = true; this.g.add(this.head);
    const hair = new THREE.Mesh(HAIRCAP, M.hair[(id + 2) % 6]); hair.position.set(0, 1.81, -0.01); hair.rotation.x = -0.3; this.g.add(hair);
    this.arms = [-1, 1].map(k => {
      const p = new THREE.Group(); p.position.set(0.25 * k, 1.42, 0.02); this.g.add(p);
      const a = new THREE.Mesh(ARM, cloth); a.position.y = -0.27; a.castShadow = true; p.add(a); return p;
    });
    // a warm thread of attention to the merfolk they notice
    const n = 16, g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    this.thread = new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0xffd38a, transparent: true, opacity: 0.85 }));
    this.thread.frustumCulled = false; this.thread.visible = false; scene.add(this.thread);
    this.yaw = Math.PI / 2; this.chat = 1; this.placed = false;
    scene.add(this.g);
  }
  dispose() { this.scene.remove(this.g); this.scene.remove(this.thread); }
  update(l, pos, targetHead, dt, time, visible) {
    if (!this.placed) { this.placed = true; this.g.position.copy(pos); }
    this.g.position.lerp(pos, 1 - Math.exp(-dt * 4));
    let want = Math.PI / 2;   // back to the sea = facing the dinner (+x)
    if (l.facing) want = targetHead ? Math.atan2(targetHead.x - this.g.position.x, targetHead.z - this.g.position.z) : -Math.PI / 2;
    let d = want - this.yaw; d = Math.atan2(Math.sin(d), Math.cos(d));
    this.yaw += Math.sign(d) * Math.min(Math.abs(d), dt * 4.5);
    this.g.rotation.y = this.yaw;
    this.chat = THREE.MathUtils.lerp(this.chat, l.facing ? 0 : 1, dt * 3);
    const z = this.g.position.z;
    this.arms[0].rotation.set(-0.35 * this.chat + Math.sin(time * 2.3 + z) * 0.45 * this.chat, 0, -0.12);
    this.arms[1].rotation.set(-0.8 * this.chat + Math.sin(time * 3.1 + z * 2) * 0.5 * this.chat, 0, 0.12);
    this.head.rotation.set(Math.sin(time * 1.7 + z) * 0.12 * this.chat, Math.sin(time * 0.9 + z) * 0.25 * this.chat, 0);
    this.g.visible = visible;
    this.thread.visible = visible && l.facing && !!targetHead;
    if (this.thread.visible) {
      const p = this.thread.geometry.attributes.position, a = this.g.position.clone().add(new THREE.Vector3(0, 1.85, 0));
      for (let i = 0; i < 16; i++) {
        const k = i / 15, q = a.clone().lerp(targetHead, k); q.y += Math.sin(k * Math.PI) * 0.5 + Math.sin(time * 6 + k * 9) * 0.03;
        p.setXYZ(i, q.x, q.y, q.z);
      }
      p.needsUpdate = true;
    }
  }
}
