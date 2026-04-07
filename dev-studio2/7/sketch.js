// All Water Meets Again — sketch.js
// Global p5 mode + ml5 v1 HandPose

// ── ml5 ──
let handPose, hands = [], video;

// ── finger ──
let fingerX, fingerY, velX = 0, velY = 0;
let handVisible = false;

// ── stage ──
let stage = -1;
let firstContact = false;
let openFrames = 0;
const OPEN_THRESH = 16;
let idleTO = null, burstTO = null;

// ── merge: use average mp ratio across world particles ──
// 0.0 = all cold,  1.0 = all merged seafoam
// thresholds drive stage advances automatically
const MERGE_STAGE3 = 0.18; // 18% avg → carry
let mergeTriggered = false; // so it only fires once

// ── river path (S-curve) ──
let rPath = [];

// ── departure flash ──
let fParts = [], flashOn = false;

// ── ambient warm ──
let ambW = 0;

// ── DOM ──
let elMain, elSub, elStage, elBurst, elHint, elStatus;

// ── colors ──
// CS = world river: cold blue
// CH = hand  river: warm amber  
// CM = merged:      seafoam
const CS = [105, 170, 255];
const CH = [255, 195, 128];
const CM = [175, 212, 195];

// ── stage text ──
const ST = {
  0:{ lb:'— I —  arrival',
      m:'Winter repeats itself,<br>and those who should meet<br>will meet again.',
      s:'', mc:'visible', sc:'visible' },
  1:{ lb:'— II —  encounter',
      m:'All the water in the world<br>will meet again.',
      s:'The Arctic Ocean and the Nile River<br>will blend in the wet clouds.',
      mc:'visible', sc:'visible' },
  2:{ lb:'— III —  departure', m:'', s:'', mc:'', sc:'',
      burst:'But from then on,<br>we never met again.' },
  3:{ lb:'— IV —  carry',
      m:'The part of me who was changed by you<br>will forever accompany me<br>in your place.',
      s:'Even if we wander,<br>every road will take us home.',
      mc:'warm', sc:'warm' },
  4:{ lb:'— V —  realization',
      m:'Some goodbyes were always<br>meant to happen.',
      s:"Not because love wasn't real,<br>but because some things are carried by water...",
      mc:'wind', sc:'wind' },
  5:{ lb:'— VI —  wind',
      m:'...and some things are<br>carried by wind.',
      s:'Hesse said the water always meets again.<br>I believe him.',
      mc:'wind', sc:'wind' },
  6:{ lb:'— VII —  release',
      m:"But the wind doesn't need to.<br>The wind just moves — through you, past you, and on.",
      s:'What stays, stays. What leaves, leaves.',
      mc:'wind', sc:'wind' },
  7:{ lb:'— VIII —  motion',
      m:'Let the ones who were always going to go,<br>go with the wind.',
      s:'Not as loss. Just as motion.<br>Just as the way it was always going to be.',
      mc:'wind', sc:'wind' },
};

// ════════════════════════════════════════
//  PRELOAD
// ════════════════════════════════════════
function preload() {
  handPose = ml5.handPose(function() {
    if (elStatus) elStatus.textContent = 'model ready — show your index finger';
  });
}

// ════════════════════════════════════════
//  SETUP
// ════════════════════════════════════════
function setup() {
  let cnv = createCanvas(windowWidth, windowHeight);
  cnv.parent('canvas-container');
  pixelDensity(1);
  frameRate(30);
  colorMode(RGB, 255);
  noStroke();

  fingerX = width / 2;
  fingerY = height / 2;

  elMain   = document.getElementById('poem-main');
  elSub    = document.getElementById('poem-sub');
  elStage  = document.getElementById('stage-label');
  elBurst  = document.getElementById('burst-msg');
  elHint   = document.getElementById('hint');
  elStatus = document.getElementById('status');

  buildPath();
  initWorld();
  toStage(0);

  video = createCapture(VIDEO);
  video.size(640, 480);
  video.hide();
  video.elt.onloadedmetadata = function() {
    let pv = document.getElementById('webcam-preview');
    if (pv) pv.srcObject = video.elt.srcObject;
  };
  handPose.detectStart(video, function(r) { hands = r; });
}

// ════════════════════════════════════════
//  DRAW
// ════════════════════════════════════════
function draw() {
  // persistent dark background (creates trail effect)
  background(2, 5, 9, 38);

  readFinger();

  // warm ambient glow (stage 3)
  if (stage === 3) {
    ambW = min(1, ambW + 0.002);
    noStroke();
    fill(255, 162, 75, ambW * 10);
    ellipse(width/2, height/2, min(width,height) * 0.55);
  }
  if (stage >= 4) ambW = max(0, ambW - 0.01);

  // world particles
  for (let i = wParts.length - 1; i >= 0; i--) {
    wParts[i].tick();
    wParts[i].show();
    if (wParts[i].dead()) wParts[i].resetW(false);
  }

  // departure flash
  for (let i = fParts.length - 1; i >= 0; i--) {
    let f = fParts[i];
    f.life++; f.x += f.vx; f.y += f.vy; f.vx *= 0.965; f.vy *= 0.965;
    fill(180, 212, 255, (1 - f.life/f.max) * 160);
    ellipse(f.x, f.y, f.r * 2);
    if (f.life >= f.max) fParts.splice(i, 1);
  }

  // hand particles
  spawnHand();
  for (let i = hParts.length - 1; i >= 0; i--) {
    hParts[i].tick();
    hParts[i].show();
    if (hParts[i].dead()) hParts.splice(i, 1);
  }

  // subtle finger dot (only when hand visible)
  if (handVisible && firstContact) {
    noStroke();
    fill(255, 215, 155, 120);
    ellipse(fingerX, fingerY, 5);
    fill(255, 215, 155, 30);
    ellipse(fingerX, fingerY, 18);
  }

  checkOpen();

  // ── check merge ratio → auto advance stage ──
  if (stage === 1 && firstContact && !mergeTriggered) {
    let total = 0;
    for (let p of wParts) total += p.mp;
    let ratio = total / wParts.length;
    if (ratio >= MERGE_STAGE3) {
      mergeTriggered = true;
      toStage(3);
    }
  }
}

// ════════════════════════════════════════
//  FINGER READ  (Bacio pattern)
// ════════════════════════════════════════
function readFinger() {
  if (hands.length > 0) {
    let kp  = hands[0].keypoints;
    let tip = kp[8];

    let nx = map(tip.x, 0, 640, width,  0);   // mirror x, fixed 640×480
    let ny = map(tip.y, 0, 480, 0, height);

    velX = velX * 0.55 + (nx - fingerX) * 0.45;
    velY = velY * 0.55 + (ny - fingerY) * 0.45;
    fingerX = nx;
    fingerY = ny;
    handVisible = true;

    if (elStatus) { elStatus.textContent = 'hand detected ✦'; elStatus.className = 'on'; }

    if (!firstContact) {
      firstContact = true;
      elHint.style.opacity = '0';
      toStage(1);
    }
    if (stage === 1) resetIdle();

  } else {
    handVisible = false;
    velX *= 0.85; velY *= 0.85;
    if (elStatus) { elStatus.textContent = 'model ready — show your index finger'; elStatus.className = ''; }
  }
}

// ════════════════════════════════════════
//  OPEN HAND DETECTION
// ════════════════════════════════════════
function checkOpen() {
  if (hands.length === 0 || stage < 3) {
    openFrames = max(0, openFrames - 2);
    return;
  }
  let kp = hands[0].keypoints;
  let tips = [8, 12, 16, 20];
  let pips = [6, 10, 14, 18];
  let ext = 0;
  for (let i = 0; i < 4; i++) {
    if (kp[tips[i]].y < kp[pips[i]].y) ext++;
  }
  if (abs(kp[4].x - kp[0].x) > 60) ext++;

  if (ext >= 4) {
    openFrames++;
    if (openFrames >= OPEN_THRESH) {
      openFrames = 0;
      if (stage >= 3 && stage < 7) toStage(stage + 1);
    }
  } else {
    openFrames = max(0, openFrames - 3);
  }
}

// ════════════════════════════════════════
//  RIVER PATH  (S-curve)
// ════════════════════════════════════════
function buildPath() {
  rPath = [];
  for (let i = 0; i <= 160; i++) {
    let t = i / 160;
    rPath.push({
      x: width  * 0.06 + width  * 0.88 * t,
      y: height * 0.5
        + sin(t * PI * 1.7) * height * 0.21
        + sin(t * PI * 3.9 + 1.1) * height * 0.06
    });
  }
}

// ════════════════════════════════════════
//  PARTICLE CLASS
// ════════════════════════════════════════
class Particle {
  constructor(type) {
    this.type = type;
    this.mp   = 0;       // mergeProgress: 0=own color, 1=merged
    this.pt   = random(1); // path progress
    this.trail = [];
    if (type === 'world') this.resetW(true);
    else                  this.resetH();
  }

  // ── world: born on river path ──
  resetW(rndLife) {
    let idx = floor(this.pt * (rPath.length - 1));
    let p   = rPath[constrain(idx, 0, rPath.length - 1)];
    this.x = p.x + random(-28, 28);
    this.y = p.y + random(-28, 28);
    this.sz   = random(0.8, 2.2);
    this.life = rndLife ? floor(random(240)) : 0;
    this.max  = random(280, 520);
    this.trail = [];
    let n   = constrain(idx + 1, 0, rPath.length - 1);
    let dx  = rPath[n].x - p.x;
    let dy  = rPath[n].y - p.y;
    let len = dist(0,0,dx,dy) || 1;
    let spd = random(0.15, 0.38);
    this.vx = dx/len*spd + random(-0.2, 0.2);
    this.vy = dy/len*spd + random(-0.2, 0.2);
  }

  // ── hand: born at fingertip, flows in movement direction ──
  resetH() {
    let spd = dist(0, 0, velX, velY);
    let nx  = spd > 0.4 ? velX / spd : 0;
    let ny  = spd > 0.4 ? velY / spd : 0;
    // spawn slightly behind tip
    this.x = fingerX - nx * random(3, 12) + random(-5, 5);
    this.y = fingerY - ny * random(3, 12) + random(-5, 5);
    this.sz   = random(0.8, 2.2);
    this.life = 0;
    this.max  = random(140, 300);
    this.trail = [];
    // velocity: along movement direction + small perpendicular wobble
    let perp = random(-0.18, 0.18);
    this.vx = nx * random(0.18, 0.55) - ny * perp + random(-0.06, 0.06);
    this.vy = ny * random(0.18, 0.55) + nx * perp + 0.03 + random(-0.04, 0.04);
  }

  // ── compute color based on mergeProgress ──
  // mp=0 → own color (CS or CH)
  // mp=1 → CM (seafoam)
  // After merging, color stays permanently (mp never goes back to 0 from merge)
  col() {
    let base = this.type === 'world' ? CS : CH;
    return [
      base[0] + (CM[0]-base[0]) * this.mp,
      base[1] + (CM[1]-base[1]) * this.mp,
      base[2] + (CM[2]-base[2]) * this.mp
    ];
  }

  tick() {
    this.life++;

    // ── proximity to finger → merge permanently ──
    if (firstContact && stage < 4) {
      let dx = fingerX - this.x;
      let dy = fingerY - this.y;
      let d  = dist(0, 0, dx, dy);
      if (d < 110) {
        let prox = 1 - d / 110;
        // merge color permanently — mp only increases
        this.mp = min(1, this.mp + prox * 0.032);
        // gentle repel from finger
        if (d > 1) { this.vx -= dx/d*prox*0.1; this.vy -= dy/d*prox*0.1; }
      }
    }

    // ── world follows river path ──
    if (this.type === 'world' && stage <= 3) {
      this.pt += 0.0008;
      if (this.pt > 1) this.pt = 0;
      let idx = constrain(floor(this.pt * (rPath.length-1)), 0, rPath.length-1);
      let p   = rPath[idx];
      let dx  = p.x - this.x, dy = p.y - this.y;
      let d   = dist(0, 0, dx, dy) || 1;
      if (d > 5) { this.vx += dx/d * 0.009; this.vy += dy/d * 0.009; }
    }

    // ── organic flow field ──
    let ang = (sin(this.x*0.007+this.life*0.003) + cos(this.y*0.007+this.life*0.002)) * PI;
    this.vx += cos(ang) * 0.006;
    this.vy += sin(ang) * 0.006;

    // ── departure scatter ──
    if (stage === 2 && flashOn) {
      let cdx = this.x - width/2, cdy = this.y - height/2;
      let cd  = dist(0,0,cdx,cdy) || 1;
      if (cd < 200) {
        let f = (200-cd)/200;
        this.vx += cdx/cd*f*0.2;
        this.vy += cdy/cd*f*0.2;
      }
    }

    // ── wind: blow right ──
    if (stage >= 4) {
      this.vx += 0.06;
      this.vy -= 0.012;
      // wind does NOT revert merge color — the memory stays
    }

    // damping + speed cap
    this.vx *= 0.978; this.vy *= 0.978;
    let spd = dist(0, 0, this.vx, this.vy);
    if (spd > 2.0) { this.vx = this.vx/spd*2.0; this.vy = this.vy/spd*2.0; }
    this.x += this.vx; this.y += this.vy;

    // trail
    this.trail.push({x: this.x, y: this.y});
    if (this.trail.length > 8) this.trail.shift();
  }

  show() {
    let fi = min(1, this.life / 50);
    let fo = max(0, 1 - max(0, this.life - this.max*0.72) / (this.max*0.28));
    let a  = fi * fo * (stage === 2 ? 0.45 : 1);
    let [r,g,b] = this.col();

    noStroke();

    // trail — drawn from oldest to newest, fading in
    for (let i = 0; i < this.trail.length; i++) {
      let t = i / this.trail.length;
      fill(r, g, b, a * t * 0.25 * 255);
      let sz = this.sz * t * 0.7;
      if (sz > 0.2) ellipse(this.trail[i].x, this.trail[i].y, sz * 2);
    }

    // core dot
    fill(r, g, b, a * 0.88 * 255);
    ellipse(this.x, this.y, this.sz * 2);

    // soft glow
    fill(r, g, b, a * 0.12 * 255);
    ellipse(this.x, this.y, this.sz * 5.5);
  }

  dead() {
    return this.life > this.max
      || this.x < -150 || this.x > width  + 150
      || this.y < -150 || this.y > height + 150;
  }
}

// ════════════════════════════════════════
//  POOLS
// ════════════════════════════════════════
function initWorld() {
  let n = min(500, floor(width * height / 3500));
  wParts = [];
  for (let i = 0; i < n; i++) {
    let p = new Particle('world');
    wParts.push(p);
  }
}

function spawnHand() {
  if (!firstContact || stage >= 4) return;
  // emit only when moving
  if (dist(0, 0, velX, velY) < 0.3) return;
  if (hParts.length > 150) return;
  // emit 2 per frame for denser trail
  for (let i = 0; i < 2; i++) {
    hParts.push(new Particle('hand'));
  }
}

// ════════════════════════════════════════
//  DEPARTURE FLASH
// ════════════════════════════════════════
function triggerFlash() {
  flashOn = true;
  let cx = width/2, cy = height/2;
  for (let i = 0; i < 100; i++) {
    let a = random(TWO_PI), s = random(0.5, 4.5);
    fParts.push({
      x: cx+random(-40,40), y: cy+random(-40,40),
      vx: cos(a)*s, vy: sin(a)*s,
      life: 0, max: random(50, 110), r: random(0.8, 2.2)
    });
  }
  setTimeout(function(){ flashOn = false; }, 2500);
}

// ════════════════════════════════════════
//  STAGE SYSTEM
// ════════════════════════════════════════
function toStage(n) {
  if (stage === n) return;
  stage = n;
  let t = ST[n];
  elStage.textContent = t.lb;
  elBurst.classList.remove('active'); elBurst.innerHTML = '';
  clearTimeout(burstTO);

  if (n === 2) {
    elMain.className = ''; elMain.innerHTML = '';
    elSub.className  = ''; elSub.innerHTML  = '';
    burstTO = setTimeout(function() {
      elBurst.innerHTML = t.burst;
      elBurst.classList.add('active');
      triggerFlash();
      setTimeout(function(){ elBurst.classList.remove('active'); }, 4200);
    }, 600);
    setTimeout(function(){ if (stage===2) toStage(3); }, 6000);
  } else {
    elMain.className = t.mc; elMain.innerHTML = t.m;
    elSub.className  = t.sc; elSub.innerHTML  = t.s;
  }

  if (n === 3) {
    setTimeout(function(){
      if (stage===3) {
        elHint.textContent   = 'open your hand to let the wind in';
        elHint.style.opacity = '0.3';
      }
    }, 5500);
  } else if (n >= 4 && n < 7) {
    elHint.textContent   = 'open your hand to continue';
    elHint.style.opacity = '0.22';
  } else if (n === 7) {
    elHint.style.opacity = '0';
  }
}

function resetIdle() {
  clearTimeout(idleTO);
  idleTO = setTimeout(function(){
    if (stage===1) toStage(2);
  }, 3800);
}

// ── mouse fallback ──
function mouseMoved() {
  if (handVisible) return;
  velX = velX*0.5 + (mouseX-fingerX)*0.5;
  velY = velY*0.5 + (mouseY-fingerY)*0.5;
  fingerX = mouseX; fingerY = mouseY;
  if (!firstContact) { firstContact=true; elHint.style.opacity='0'; toStage(1); }
  if (stage===1) resetIdle();
  if (stage===2) toStage(1);
}

function keyPressed() {
  if (key===' ' && stage>=3 && stage<7) toStage(stage+1);
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  buildPath();
  initWorld();
}