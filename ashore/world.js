// Ashore — the place: sky, sea, sea floor and beach, rocks, the dinner on land,
// borders (buoys + Sea Witches), particles and the film look.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

export const B1 = 50, B2 = 72;
// sim coordinates (x 0..100 sea -> shore, z 0..40) to the 3D world
export const W = (x, z, y = 0) => new THREE.Vector3(x - 50, y, z - 20);

// ---------------------------------------------------------------- land heights
export function smooth(a, b, x) { const t = THREE.MathUtils.clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
function noise2(x, z) { return Math.sin(x * 0.37 + Math.sin(z * 0.21) * 2) * 0.5 + Math.sin(z * 0.43 + x * 0.11) * 0.5; }
export function ground(x, z) {
  let h;
  if (x < 46) h = -4.2;
  else if (x < 54) h = THREE.MathUtils.lerp(-4.2, -2.4, smooth(46, 54, x));
  else if (x < 70) h = THREE.MathUtils.lerp(-2.4, -0.5, (x - 54) / 16);
  else if (x < 74.5) h = THREE.MathUtils.lerp(-0.5, 0.3, smooth(70, 74.5, x));
  else if (x < 100) h = THREE.MathUtils.lerp(0.3, 1.1, (x - 74.5) / 25.5);
  else h = 1.1 + (x - 100) * 0.025;
  const dunes = smooth(98, 125, x) * (0.9 * (0.5 + 0.5 * Math.sin(z * 0.11 + x * 0.05)) + 0.4 * Math.sin(x * 0.17 + z * 0.07));
  const rough = x < 60 ? 0.7 : x < 74 ? 0.2 : 0.18;
  return h + noise2(x, z) * rough + dunes;
}

// ---------------------------------------------------------------- waves (same maths on GPU and CPU)
const WAVES = [[1.0, 0.3, 0.16, 22.0], [0.8, -0.6, 0.14, 13.0], [0.3, 1.0, 0.10, 7.5], [1.0, 0.9, 0.08, 4.2], [-0.6, 1.0, 0.05, 2.6]];
export function waveHeight(wx, wz, time) {
  let y = 0;
  for (const [dx, dz, steep, L] of WAVES) {
    const len = Math.hypot(dx, dz), k = 6.28318 / L, c = Math.sqrt(9.8 / k);
    const f = k * ((dx / len) * wx + (dz / len) * wz - c * time * 0.6);
    y += (steep / k) * Math.sin(f);
  }
  return y;
}

export function glowTexture(inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)') {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d'); const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, inner); gr.addColorStop(0.25, inner); gr.addColorStop(1, outer);
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

const lerpC = (a, b, k) => new THREE.Color(a).lerp(new THREE.Color(b), k);
function palette(k) {
  const d = THREE.MathUtils.smoothstep(k, 0.62, 1.0);
  return {
    d,
    top: lerpC(0x03060f, 0x2a3f6e, d),
    horizon: lerpC(0x10264a, 0xf5b07a, d),
    fog: lerpC(0x0a1830, 0xb8a49a, d),
    sun: lerpC(0x9fb6ff, 0xffb37a, d),
    sunI: THREE.MathUtils.lerp(1.15, 2.4, d),
    hemiSky: lerpC(0x3a5590, 0x9fb0d8, d),
    hemiGround: lerpC(0x05070a, 0x4a3a30, d),
    hemiI: THREE.MathUtils.lerp(1.45, 1.0, d),
    stars: 1 - d,
  };
}

export function createWorld(container, { lowQuality = false } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, lowQuality ? 1 : 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(52, 1, 0.1, 2000);

  // ---- sky dome
  const sunDir = new THREE.Vector3();
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { uTop: { value: new THREE.Color() }, uHorizon: { value: new THREE.Color() }, uSunDir: { value: sunDir },
                uSun: { value: new THREE.Color() }, uStars: { value: 1 }, uTime: { value: 0 }, uDawn: { value: 0 } },
    vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = projectionMatrix*modelViewMatrix*vec4(position,1.); gl_Position = p.xyww; }`,
    fragmentShader: `
      uniform vec3 uTop, uHorizon, uSun, uSunDir; uniform float uStars, uTime, uDawn; varying vec3 vDir;
      float hash(vec3 p){ p = fract(p*0.3183099+.1); p*=17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
      void main(){
        vec3 d = normalize(vDir);
        float h = clamp(d.y, -0.2, 1.0);
        vec3 col = mix(uHorizon, uTop, pow(max(h,0.0), 0.45));
        col = mix(col, uHorizon*0.35, smoothstep(0.0,-0.2,h));
        float s = max(dot(d, normalize(uSunDir)), 0.0);
        col += uSun * (pow(s, 2000.0)*4.0 + pow(s, 120.0)*(0.06 + 0.3*uDawn) + pow(s, 6.0)*0.12*uDawn);
        vec3 g = floor(d*420.0);
        float st = hash(g);
        float tw = 0.6 + 0.4*sin(uTime*2.0 + st*40.0);
        col += vec3(0.85,0.9,1.0) * step(0.9965, st) * tw * uStars * smoothstep(0.02,0.25,h) * 1.6;
        gl_FragColor = vec4(col,1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`
  });
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(900, 48, 24), skyMat));

  // ---- lights
  const hemi = new THREE.HemisphereLight(0x3a5590, 0x05070a, 1.1);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0x9fb6ff, 1);
  sun.castShadow = true;
  sun.shadow.mapSize.set(lowQuality ? 1024 : 2048, lowQuality ? 1024 : 2048);
  Object.assign(sun.shadow.camera, { left: -70, right: 70, top: 40, bottom: -40, near: 1, far: 300 });
  sun.shadow.bias = -0.0005;
  scene.add(sun, sun.target);
  scene.fog = new THREE.FogExp2(0x0a1830, 0.0055);
  const moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('rgba(235,240,255,1)'), fog: false, depthWrite: false, transparent: true }));
  moon.scale.setScalar(14);
  scene.add(moon);

  // ---- sea floor + beach
  {
    const geo = new THREE.PlaneGeometry(320, 240, lowQuality ? 160 : 256, lowQuality ? 120 : 192);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position, col = new Float32Array(pos.count * 3);
    const deep = new THREE.Color(0x0d1620), shal = new THREE.Color(0x3a5048), wet = new THREE.Color(0x6b5a44), dry = new THREE.Color(0xd8c39b);
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i) + 90, z = pos.getZ(i) + 20;
      pos.setX(i, x - 50); pos.setY(i, ground(x, z));
      if (x < 50) c.copy(deep).lerp(shal, smooth(30, 55, x) * 0.4);
      else if (x < 72) c.copy(deep).lerp(shal, 0.4 + 0.6 * (x - 50) / 22);
      else if (x < 77) c.copy(wet).lerp(dry, (x - 72) / 5);
      else c.copy(dry);
      const grain = 0.9 + 0.2 * Math.abs(Math.sin(x * 12.9898 + z * 78.233) * 43758.5453 % 1);
      col.set([c.r * grain, c.g * grain, c.b * grain], i * 3);
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }));
    m.receiveShadow = true;
    scene.add(m);
  }

  // ---- rocks along the sides of the sea
  {
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x4a4f55, roughness: 0.92 });
    let seed = 3; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (const zs of [-3, 43]) for (let x = -10; x < 78; x += 2 + rnd() * 3) {
      const s = 1.2 + rnd() * 2.8;
      const g = new THREE.IcosahedronGeometry(1, 3);
      const p = g.attributes.position, o = rnd() * 50;
      for (let i = 0; i < p.count; i++) {
        const X = p.getX(i), Y = p.getY(i), Z = p.getZ(i);
        const k = 0.82 + 0.18 * Math.sin(X * 2.1 + o) * Math.sin(Y * 2.7 + o * 0.7) + 0.08 * Math.sin(Z * 5.3 + X * 3.1 + o);
        p.setXYZ(i, X * k, Y * k * (Y < 0 ? 0.6 : 1), Z * k);
      }
      g.computeVertexNormals();
      const r = new THREE.Mesh(g, rockMat);
      const z = zs + (rnd() - 0.5) * 3 + (zs < 0 ? -s * 0.4 : s * 0.4);
      r.position.copy(W(x, z, ground(x, z) + s * 0.25));
      r.scale.set(s * 1.4, s * (0.6 + rnd() * 0.7), s);
      r.rotation.set(rnd() * 0.6, rnd() * 6, rnd() * 0.6);
      r.castShadow = r.receiveShadow = true;
      scene.add(r);
    }
  }

  // ---- the sea
  const waterU = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
    uTime: { value: 0 }, uSunDir: { value: sunDir }, uSun: { value: new THREE.Color() },
    uTop: { value: new THREE.Color() }, uHorizon: { value: new THREE.Color() },
    uDeep: { value: new THREE.Color(0x02101c) }, uShallow: { value: new THREE.Color(0x0f5a5c) },
    uShoreX: { value: B2 - 50 }, uShalX: { value: B1 - 50 }, uLevel: { value: 0 },
  }]);
  const waveGLSL = WAVES.map(([dx, dz, st, L]) => `q += gerstner(vec4(${dx.toFixed(2)}, ${dz.toFixed(2)}, ${st.toFixed(2)}, ${L.toFixed(1)}), p, t, b);`).join('\n');
  const waterMat = new THREE.ShaderMaterial({
    uniforms: waterU, transparent: true, fog: true, side: THREE.DoubleSide,
    vertexShader: `
      uniform float uTime, uLevel;
      varying vec3 vWorld; varying vec3 vNormal; varying float vCrest;
      #include <fog_pars_vertex>
      vec3 gerstner(vec4 w, vec3 p, inout vec3 tangent, inout vec3 binormal){
        float steep = w.z, L = w.w; float k = 6.28318/L; float c = sqrt(9.8/k);
        vec2 d = normalize(w.xy); float f = k*(dot(d,p.xz) - c*uTime*0.6); float a = steep/k;
        tangent += vec3(-d.x*d.x*steep*sin(f), d.x*steep*cos(f), -d.x*d.y*steep*sin(f));
        binormal += vec3(-d.x*d.y*steep*sin(f), d.y*steep*cos(f), -d.y*d.y*steep*sin(f));
        return vec3(d.x*a*cos(f), a*sin(f), d.y*a*cos(f));
      }
      void main(){
        vec3 p = (modelMatrix*vec4(position,1.)).xyz;
        vec3 t = vec3(1,0,0), b = vec3(0,0,1), q = p;
        ${waveGLSL}
        q.y += uLevel;
        vCrest = q.y - uLevel;
        vWorld = q; vNormal = normalize(cross(b, t));
        vec4 mvPosition = viewMatrix*vec4(q,1.);
        gl_Position = projectionMatrix*mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: `
      uniform vec3 uSun, uSunDir, uTop, uHorizon, uDeep, uShallow; uniform float uShoreX, uShalX, uTime, uLevel;
      varying vec3 vWorld; varying vec3 vNormal; varying float vCrest;
      #include <fog_pars_fragment>
      float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)))*43758.5453); }
      float vnoise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
        return mix(mix(hash(i),hash(i+vec2(1,0)),f.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x), f.y); }
      void main(){
        vec3 n = normalize(vNormal);
        vec2 rp = vWorld.xz*1.6 + vec2(uTime*0.4, uTime*0.25);
        n = normalize(n + vec3(vnoise(rp)-0.5, 0., vnoise(rp+7.3)-0.5)*0.18);
        vec3 v = normalize(cameraPosition - vWorld);
        float fres = 0.02 + 0.98*pow(1.0 - max(dot(n,v),0.0), 5.0);
        vec3 r = reflect(-v, n);
        vec3 skyc = mix(uHorizon, uTop, pow(max(r.y,0.0), 0.45));
        vec3 sd = normalize(uSunDir);
        float glint = pow(max(dot(r, sd),0.0), 300.0)*6.0 + pow(max(dot(r, sd),0.0), 24.0)*0.35;
        float shallow = smoothstep(uShalX-6.0, uShoreX, vWorld.x);
        vec3 body = mix(uDeep, uShallow, shallow);
        body *= 0.55 + 0.45*max(dot(n, sd), 0.0);
        body += uShallow*0.25*smoothstep(0.1,0.6,vCrest);
        vec3 col = mix(body, skyc, fres) + uSun*glint;
        float shore = uShoreX - 1.2 - uLevel*3.0;
        float edge = 1.0 - clamp(abs(vWorld.x - shore + 0.5*sin(vWorld.z*0.45+uTime*0.8))/1.1, 0.0, 1.0);
        float fn = vnoise(vWorld.xz*4.0 + uTime*0.5) * vnoise(vWorld.xz*1.3 - uTime*0.2);
        float foam = smoothstep(0.25, 0.75, edge*(0.4+1.2*fn)) * 0.8 + smoothstep(0.6, 0.95, vCrest)*fn*0.25*shallow;
        float sunLum = dot(uSun, vec3(0.33));
        col = mix(col, vec3(0.85,0.9,1.0)*(0.08+0.55*sunLum), clamp(foam,0.,1.)*0.85);
        float a = clamp(mix(0.82, 1.0, fres) + foam*0.4, 0.0, 1.0);
        gl_FragColor = vec4(col, a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`
  });
  {
    const g = new THREE.PlaneGeometry(700, 500, lowQuality ? 175 : 350, lowQuality ? 125 : 250);
    g.rotateX(-Math.PI / 2);
    const water = new THREE.Mesh(g, waterMat);
    water.position.set(-350 + 23, 0, 0);
    scene.add(water);
  }

  // ---- the dinner on land
  const lanternLights = [];
  let dinner = null;
  function buildDinner(far) {
    if (dinner) { scene.remove(dinner); lanternLights.forEach(l => scene.remove(l)); lanternLights.length = 0; }
    dinner = new THREE.Group(); scene.add(dinner);
    const tx = (far ? 95 : 83) + 5.5;
    const wood = new THREE.MeshStandardMaterial({ color: 0x4a2e1c, roughness: 0.7 });
    const cloth = new THREE.MeshStandardMaterial({ color: 0xefe8dc, roughness: 0.9 });
    const flame = new THREE.MeshStandardMaterial({ color: 0xffd9a0, emissive: 0xffa040, emissiveIntensity: 6 });
    const paper = new THREE.MeshStandardMaterial({ color: 0xffe0b0, emissive: 0xff9a40, emissiveIntensity: 3.5 });
    const y = ground(tx, 20);
    const top = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.08, 28), cloth); top.position.copy(W(tx, 20, y + 0.8)); top.castShadow = top.receiveShadow = true; dinner.add(top);
    const drape = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.35, 28.05), cloth); drape.position.copy(W(tx, 20, y + 0.62)); dinner.add(drape);
    const plateG = new THREE.CylinderGeometry(0.14, 0.12, 0.02, 20), plateM = new THREE.MeshStandardMaterial({ color: 0xf6f6f2, roughness: 0.3 });
    const glassG = new THREE.CylinderGeometry(0.04, 0.03, 0.14, 12), glassM = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.05, transmission: 0.9, thickness: 0.05 });
    const candleG = new THREE.CylinderGeometry(0.025, 0.025, 0.18, 8);
    for (let i = 0; i < 9; i++) {
      const z = 7.5 + i * 3.1;
      const cdl = new THREE.Mesh(candleG, flame); cdl.position.copy(W(tx + 0.2, z, y + 0.93)); dinner.add(cdl);
      const plate = new THREE.Mesh(plateG, plateM); plate.position.copy(W(tx - 0.45, z + 1, y + 0.85)); dinner.add(plate);
      const glass = new THREE.Mesh(glassG, glassM); glass.position.copy(W(tx - 0.2, z + 0.6, y + 0.91)); dinner.add(glass);
    }
    const posts = [];
    for (let i = 0; i < 5; i++) {
      const z = 3 + i * 8.5, lx = tx + 3, gy = ground(lx, z);
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 3, 8), wood); post.position.copy(W(lx, z, gy + 1.5)); post.castShadow = true; dinner.add(post);
      const lan = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 12), paper); lan.scale.y = 1.3; lan.position.copy(W(lx, z, gy + 2.7)); dinner.add(lan);
      posts.push(W(lx, z, gy + 2.95));
      const L = new THREE.PointLight(0xffa860, 14, 16, 1.6); L.position.copy(W(lx - 0.8, z, gy + 2.6)); scene.add(L); lanternLights.push(L);
    }
    const bulb = new THREE.SphereGeometry(0.045, 8, 6);
    const bulbMat = new THREE.MeshStandardMaterial({ color: 0xfff0c0, emissive: 0xffc070, emissiveIntensity: 8 });
    for (let i = 0; i < posts.length - 1; i++) for (let k = 1; k < 14; k++) {
      const u = k / 14, p = posts[i].clone().lerp(posts[i + 1], u); p.y -= Math.sin(u * Math.PI) * 0.6;
      const b = new THREE.Mesh(bulb, bulbMat); b.position.copy(p); dinner.add(b);
    }
  }
  buildDinner(false);

  // ---- borders: buoys and the Sea Witches
  const buoyMat = new THREE.MeshStandardMaterial({ color: 0xffe08a, emissive: 0xffb640, emissiveIntensity: 0.4, roughness: 0.4 });
  const buoys = [];
  const buoyG = new THREE.SphereGeometry(0.11, 12, 10);
  for (const bx of [B1, B2 - 0.8]) for (let z = 1; z < 40; z += 2.2) {
    const b = new THREE.Mesh(buoyG, buoyMat); b.position.copy(W(bx, z, 0)); scene.add(b); buoys.push(b);
  }
  const lathe = (pts, segs = 28) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), segs);
  function witch(x) {
    const g = new THREE.Group();
    const cloak = new THREE.MeshPhysicalMaterial({ color: 0x120a1c, roughness: 0.35, sheen: 1, sheenColor: 0x5a3a8a });
    g.add(new THREE.Mesh(lathe([[0.001, 0], [1.3, 0.05], [0.9, 0.8], [0.55, 1.8], [0.42, 2.6], [0.28, 3.0], [0.001, 3.05]]), cloak));
    const hood = new THREE.Mesh(new THREE.SphereGeometry(0.4, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.7), cloak); hood.position.y = 3.15; hood.rotation.x = -0.2; g.add(hood);
    const face = new THREE.Mesh(new THREE.SphereGeometry(0.2, 20, 16), new THREE.MeshStandardMaterial({ color: 0x8aa39a, roughness: 0.5 })); face.position.set(0, 3.08, 0.1); g.add(face);
    const jarMat = new THREE.MeshStandardMaterial({ color: 0x9fffd0, emissive: 0x40ffa0, emissiveIntensity: 1.4, transparent: true, opacity: 0.9 });
    const jar = new THREE.Mesh(new THREE.SphereGeometry(0.24, 20, 16), jarMat);
    jar.position.set(0, 2.0, 0.75); jar.scale.y = 1.2; g.add(jar);
    const L = new THREE.PointLight(0x50ffb0, 6, 10, 1.6); L.position.copy(jar.position); g.add(L);
    g.position.copy(W(x, 20, -4.5)); g.rotation.y = -Math.PI / 2;
    scene.add(g);
    return { g, jar, jarMat, light: L, rise: 0, pulse: 0, jarWorld: new THREE.Vector3() };
  }
  const witches = [witch(B1), witch(B2 - 2)];

  // ---- particles (one pool per kind; emit() places a particle, update() moves them)
  function pool(n, size, blending = THREE.AdditiveBlending) {
    const g = new THREE.BufferGeometry();
    const pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const m = new THREE.PointsMaterial({ size, vertexColors: true, map: glowTexture(), transparent: true, depthWrite: false, blending, sizeAttenuation: true });
    const pts = new THREE.Points(g, m); pts.frustumCulled = false; scene.add(pts);
    const life = new Float32Array(n), vel = new Float32Array(n * 3), base = new Float32Array(n * 3);
    let next = 0;
    for (let i = 0; i < n; i++) pos[i * 3 + 1] = -999;
    return {
      emit(p, v, c, lifeS = 2) {
        const i = next; next = (next + 1) % n;
        pos.set([p.x, p.y, p.z], i * 3); vel.set([v.x, v.y, v.z], i * 3); base.set([c.r, c.g, c.b], i * 3); life[i] = lifeS;
      },
      update(dt) {
        for (let i = 0; i < n; i++) {
          if (life[i] <= 0) continue;
          life[i] -= dt;
          pos[i * 3] += vel[i * 3] * dt; pos[i * 3 + 1] += vel[i * 3 + 1] * dt; pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
          const k = Math.min(1, life[i]);
          col[i * 3] = base[i * 3] * k; col[i * 3 + 1] = base[i * 3 + 1] * k; col[i * 3 + 2] = base[i * 3 + 2] * k;
          if (life[i] <= 0) pos[i * 3 + 1] = -999;
        }
        g.attributes.position.needsUpdate = true; g.attributes.color.needsUpdate = true;
      },
    };
  }
  const fx = { bubbles: pool(1500, 0.16), sparkles: pool(800, 0.2), hums: pool(400, 0.28) };

  // ---- post-processing
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(512, 512), 0.75, 0.6, 0.82);
  composer.addPass(bloom);
  const grade = new ShaderPass({
    uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uVig: { value: 0.9 }, uDark: { value: 0 }, uWhite: { value: 0 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `uniform sampler2D tDiffuse; uniform float uTime, uVig, uDark, uWhite; varying vec2 vUv;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)))*43758.5453); }
      void main(){ vec4 c = texture2D(tDiffuse, vUv);
        float l = dot(c.rgb, vec3(0.299,0.587,0.114));
        c.rgb = mix(c.rgb, c.rgb*vec3(0.92,1.0,1.08), 1.0-smoothstep(0.0,0.5,l));
        c.rgb = mix(c.rgb, c.rgb*vec3(1.06,1.0,0.92), smoothstep(0.4,1.0,l));
        float r = length(vUv-0.5)*1.4;
        float v = smoothstep(1.15, 0.25, r); c.rgb *= mix(1.0, v, uVig);
        // without Sight: the world closes in to a small, dim circle
        c.rgb *= mix(1.0, 0.12 + smoothstep(0.7, 0.1, r)*0.5, uDark);
        // sea foam at dawn: everything goes white
        c.rgb = mix(c.rgb, vec3(0.92,0.96,1.0), uWhite);
        c.rgb += (hash(vUv*1000.0+uTime)-0.5)*0.025;
        gl_FragColor = c; }`
  });
  composer.addPass(grade);
  composer.addPass(new OutputPass());

  function resize(w, h) {
    renderer.setSize(w, h); composer.setSize(w, h);
    camera.aspect = w / h; camera.updateProjectionMatrix();
  }

  // ---- every frame
  let level = 0;
  function update(dt, time, nightK, low) {
    const P = palette(nightK);
    const moonDir = new THREE.Vector3(0.75, 0.32, -0.55).normalize();
    const sunUp = new THREE.Vector3(1, THREE.MathUtils.lerp(-0.08, 0.12, P.d), 0.15).normalize();
    sunDir.copy(moonDir).lerp(sunUp, P.d).normalize();
    sun.position.copy(sunDir).multiplyScalar(120); sun.target.position.set(0, 0, 0);
    sun.color.copy(P.sun); sun.intensity = P.sunI;
    hemi.color.copy(P.hemiSky); hemi.groundColor.copy(P.hemiGround); hemi.intensity = P.hemiI;
    scene.fog.color.copy(P.fog);
    skyMat.uniforms.uTop.value.copy(P.top); skyMat.uniforms.uHorizon.value.copy(P.horizon);
    skyMat.uniforms.uSun.value.copy(P.sun); skyMat.uniforms.uStars.value = P.stars; skyMat.uniforms.uDawn.value = P.d;
    skyMat.uniforms.uTime.value = time;
    waterU.uTop.value.copy(P.top); waterU.uHorizon.value.copy(P.horizon); waterU.uSun.value.copy(P.sun).multiplyScalar(P.sunI * 0.6);
    waterU.uTime.value = time;
    // the tide goes out: the sea drops
    level += ((low ? -0.45 : 0) - level) * Math.min(1, dt * 0.8);
    waterU.uLevel.value = level;
    moon.position.copy(moonDir).multiplyScalar(700); moon.material.opacity = 1 - P.d;
    lanternLights.forEach((l, i) => l.intensity = THREE.MathUtils.lerp(14, 5, P.d) * (0.9 + 0.1 * Math.sin(time * 7 + i * 3)));
    // buoys light up while the borders are open
    buoyMat.emissiveIntensity = low ? 2.2 + 0.6 * Math.sin(time * 4) : 0.35;
    buoys.forEach((b, i) => { b.position.y = level + waveHeight(b.position.x, b.position.z, time) + 0.05; });
    // the Witches rise at low tide
    for (const w of witches) {
      w.rise = THREE.MathUtils.clamp(w.rise + (low ? dt * 0.6 : -dt * 0.5), 0, 1);
      const e = THREE.MathUtils.smoothstep(w.rise, 0, 1);
      w.g.position.y = THREE.MathUtils.lerp(-4.6, -0.6, e) + level + Math.sin(time * 1.2) * 0.06;
      w.g.visible = w.rise > 0.001;
      w.pulse = Math.max(0, w.pulse - dt * 1.4);
      w.jarMat.emissiveIntensity = 0.6 + 1.2 * e + 4 * w.pulse;
      w.light.intensity = e * (5 + 14 * w.pulse);
      w.jar.getWorldPosition(w.jarWorld);
    }
    fx.bubbles.update(dt); fx.sparkles.update(dt); fx.hums.update(dt);
    grade.uniforms.uTime.value = time;
    return P;
  }

  return {
    renderer, scene, camera, composer, grade, bloom, witches, fx, buildDinner, resize, update,
    get level() { return level; },
    seaY: (wx, wz, time) => level + waveHeight(wx, wz, time),
  };
}
