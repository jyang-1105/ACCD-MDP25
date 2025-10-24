// Iter 6 — Final version: rainbow jelly with multi-color gradient + all motions

let W = 1280, H = 720;

// ==== Planet (same desync motion) ====
let orbitRBase = 200;
let planetR = 26;
let planetPeriod = 6.0;
let planetPhase0 = Math.PI / 3;

let lfoRPeriod = 9.3;
let lfoWPeriod = 11.7;
let lfoPhasePer = 13.4;
let lfoRAmp = 26;
let lfoWAmp = 0.07;
let lfoPhaseAmp = 0.35;

// ==== Jelly ====
let jellyBaseR = 88;
let noiseZ = 0;
let noiseSpeed = 0.012;
let noiseScale = 0.24;
let jellyOrbitBase = 280;
let jellyOrbitAmp = 22;
let jellyOrbitPer = 7.1;

let jellyAngle = Math.PI * 0.1;
let jellyStartAngle = jellyAngle;
let jellyTargetAngle = jellyAngle;
let jellyMoving = false;
let jellyMoveStart = 0;
let jellyMoveDur = 1200;
let jellyLastTrigger = 0;
let jellyInterval = 3400;

// ==== Background ====
let stars = [];
let neb;
let nebSeed = 4711;
let starSeed = 1234;

const TRAIL_COL  = [255, 150, 180, 90];
const PLANET_COL = [255, 100, 150];

function setup() {
  const holder = document.getElementById("sketch-holder");
  const c = createCanvas(W, H);
  if (holder) c.parent(holder);
  colorMode(HSB, 360, 100, 100, 100);
  noStroke();

  randomSeed(starSeed);
  noiseSeed(starSeed);
  const starCount = 220;
  for (let i = 0; i < starCount; i++) {
    stars.push({
      x: random(width),
      y: random(height),
      r: random(0.8, 2.2),
      twZ: random(1000),
      twSp: random(0.002, 0.006),
    });
  }
  neb = createGraphics(W, H);
  renderNebula(neb, nebSeed);

  jellyLastTrigger = -9999;
}

function draw() {
  drawNebula();
  drawStars();

  const cx = width / 2, cy = height / 2;
  const t = millis() / 1000;

  // planet motion
  const orbitR = orbitRBase + lfoRAmp * sin(TWO_PI * t / lfoRPeriod + 0.6);
  const omega = (TWO_PI / planetPeriod) * (1 + lfoWAmp * sin(TWO_PI * t / lfoWPeriod + 0.2));
  const phaseDrift = lfoPhaseAmp * sin(TWO_PI * t / lfoPhasePer + 0.9);
  const a = omega * t + planetPhase0 + phaseDrift;
  const px = cx + orbitR * cos(a);
  const py = cy + orbitR * sin(a);

  // planet orbit ring
  push();
  noFill(); stroke(255, 255, 255, 40);
  circle(cx, cy, orbitR * 2);
  pop();

  // trail
  push();
  noFill(); stroke(...TRAIL_COL);
  beginShape();
  for (let i = 0; i < 60; i++) {
    const k = i / 60;
    const ra = a - k * 0.9;
    const rr = orbitR - k * 12;
    vertex(cx + rr * cos(ra), cy + rr * sin(ra));
  }
  endShape(); pop();

  // planet body
  push(); noStroke(); fill(...PLANET_COL);
  circle(px, py, planetR * 2); pop();

  // jelly motion
  updateJellyAngle();
  const jellyOrbitalR = jellyOrbitBase + jellyOrbitAmp * sin(TWO_PI * t / jellyOrbitPer + 0.8);
  const jx = cx + jellyOrbitalR * cos(jellyAngle);
  const jy = cy + jellyOrbitalR * sin(jellyAngle);
  drawRainbowJelly(jx, jy);

  noiseZ += noiseSpeed;
}

// ==== Rainbow Jelly ====
function drawRainbowJelly(cx, cy) {
  push();
  translate(cx, cy);
  noStroke();

  const layers = 5;
  for (let j = 0; j < layers; j++) {
    const alpha = 90 - j * 15;
    const rMul = 1 + j * 0.05;
    // 每层颜色基于时间和随机偏移变化，形成彩虹果冻
    const hueBase = (frameCount * 0.8 + j * 60 + random(-10,10)) % 360;
    const sat = 80 + random(-10,10);
    const bri = 90 + random(-5,5);
    fill(hueBase, sat, bri, alpha);

    beginShape();
    const steps = 160;
    for (let i = 0; i < steps; i++) {
      const ang = (TWO_PI * i) / steps;
      const nx = cos(ang);
      const ny = sin(ang);
      const n = noise(nx * 1.2 + 100, ny * 1.2 + 200, noiseZ + j * 0.6);
      const r = jellyBaseR * (1 + noiseScale * (n - 0.5));
      vertex(r * nx * rMul, r * ny * rMul);
    }
    endShape(CLOSE);
  }
  pop();
}

// ==== Jelly motion helpers ====
function updateJellyAngle() {
  const now = millis();
  if (now - jellyLastTrigger > jellyInterval) {
    jellyLastTrigger = now;
    jellyMoveStart = now;
    jellyMoving = true;
    jellyStartAngle = jellyAngle;
    let delta = radians(random(40,160)) * (random()<0.5?-1:1);
    if (random()<0.2) delta = radians(random(170,260)) * (random()<0.5?-1:1);
    jellyTargetAngle = jellyStartAngle + delta;
    jellyInterval = 3000 + random(-700,900);
    jellyMoveDur  = 1100 + random(-300,380);
  }
  if (jellyMoving) {
    const u = constrain((now - jellyMoveStart)/jellyMoveDur,0,1);
    const ee = easeInOutCubic(u);
    const d = shortestArc(jellyStartAngle, jellyTargetAngle);
    jellyAngle = jellyStartAngle + d * ee;
    if (u>=1){ jellyAngle = wrapAngle(jellyTargetAngle); jellyMoving=false; }
  } else { jellyAngle = wrapAngle(jellyAngle); }
}

// ==== Background ====
function renderNebula(g, seed){
  g.push(); g.clear(); g.noStroke(); g.colorMode(HSB,360,100,100,100);
  randomSeed(seed); noiseSeed(seed);
  const cell=8;
  for(let y=0;y<g.height;y+=cell){
    for(let x=0;x<g.width;x+=cell){
      const nx=x*0.0015, ny=y*0.0015;
      const n=noise(nx,ny)*0.6+noise(nx*0.5+99,ny*0.5+99)*0.4;
      const hue=lerp(320,210,n);
      const sat=lerp(20,50,n);
      const bri=lerp(6,20,n);
      const alp=lerp(0,22,n);
      if(alp>1){ g.fill(hue,sat,bri+5,alp); g.rect(x,y,cell+1,cell+1); }
    }
  }
  g.pop();
}

function drawNebula(){
  const t=millis()*0.00007;
  const ox=(sin(t*1.7)*30)|0;
  const oy=(cos(t*1.3)*30)|0;
  image(neb,ox,oy);
  image(neb,ox-width,oy);
  image(neb,ox,oy-height);
  image(neb,ox-width,oy-height);
}

function drawStars(){
  push(); noStroke();
  for(let s of stars){
    s.twZ+=s.twSp;
    const tw=0.6+0.4*noise(s.twZ);
    const a=140*tw;
    fill(255,255,255,a);
    circle(s.x,s.y,s.r);
  }
  pop();
}

// ==== Utilities ====
function shortestArc(from,to){let d=to-from;return atan2(sin(d),cos(d));}
function wrapAngle(a){return atan2(sin(a),cos(a));}
function easeInOutCubic(x){return x<0.5?4*x*x*x:1-pow(-2*x+2,3)/2;}

function keyPressed(){
  if(key==='S'||key==='s'){ saveCanvas('iter6_rainbow_jelly','png'); }
  if(key==='R'||key==='r'){
    starSeed=floor(random(1e6)); nebSeed=floor(random(1e6));
    stars=[]; randomSeed(starSeed); noiseSeed(starSeed);
    for(let i=0;i<220;i++){
      stars.push({x:random(width),y:random(height),r:random(0.8,2.2),
        twZ:random(1000),twSp:random(0.002,0.006)});
    }
    renderNebula(neb,nebSeed);
  }
}
