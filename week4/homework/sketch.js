/* ===== Final version: Image Orbs with Edge-triggered Swap (JPG version) ===== */
let balls = [];
let obstacles = [];
let imgs = [];
const BALL_COUNT = 4;

function preload() {
  imgs[0] = loadImage("assets/ball1.jpg");
  imgs[1] = loadImage("assets/ball2.jpg");
}

function setup() {
  const { w, h } = holderSize();
  const cnv = createCanvas(w, h);
  cnv.parent("sketch-holder");
  setupObstacles();
  setupBalls();
  noStroke();
  frameRate(60);
}

function draw() {
  background(10, 12, 20, 40);
  for (const ob of obstacles) ob.draw();
  for (const b of balls) {
    b.update();
    b.bounceEdges();
    for (const ob of obstacles) b.collideObstacle(ob);
    b.draw();
  }
}

function holderSize() {
  const el = document.getElementById("sketch-holder");
  const w = el?.clientWidth || windowWidth * 0.9;
  const h = el?.clientHeight || Math.min(420, w * 9/16);
  return { w: floor(w), h: floor(h) };
}

function windowResized() {
  const { w, h } = holderSize();
  resizeCanvas(w, h);
  setupObstacles(true);
}

function setupBalls() {
  balls = [];
  for (let i = 0; i < BALL_COUNT; i++) {
    const r = random(20, 32);
    const x = random(r, width - r);
    const y = random(r, height - r);
    const sp = random(1.5, 2.8);
    const a = random(TWO_PI);
    balls.push(new Ball(x, y, cos(a)*sp, sin(a)*sp, r));
  }
}

function setupObstacles() {
  obstacles = [];
  obstacles.push(new Obstacle(width*0.25, height*0.55, width*0.3, 18));
  obstacles.push(new Obstacle(width*0.62, height*0.25, 20, height*0.4));
  obstacles.push(new Obstacle(width*0.5, height*0.8, width*0.2, 14));
}

function clamp(v, lo, hi) { return max(lo, min(hi, v)); }

class Ball {
  constructor(x, y, vx, vy, r) {
    this.pos = createVector(x, y);
    this.vel = createVector(vx, vy);
    this.r = r;
    this.index = 0;
    this.cooldown = 0;
    this.nx = random(1000);
    this.ny = random(2000);
  }

  update() {
    const j = 0.12;
    this.vel.x += map(noise(this.nx + frameCount*0.007), 0, 1, -j, j);
    this.vel.y += map(noise(this.ny + frameCount*0.007), 0, 1, -j, j);
    this.vel.limit(3.5);
    this.pos.add(this.vel);
    if (this.cooldown > 0) this.cooldown--;
  }

  bounceEdges() {
    let hit = false;
    if (this.pos.x < this.r) { this.pos.x=this.r; this.vel.x*=-1; hit=true; }
    else if (this.pos.x > width-this.r) { this.pos.x=width-this.r; this.vel.x*=-1; hit=true; }
    if (this.pos.y < this.r) { this.pos.y=this.r; this.vel.y*=-1; hit=true; }
    else if (this.pos.y > height-this.r) { this.pos.y=height-this.r; this.vel.y*=-1; hit=true; }

    if (hit && this.cooldown===0 && imgs.length>=2) {
      this.index = (this.index + 1) % imgs.length;
      this.cooldown = 6;
    }
  }

  collideObstacle(ob) {
    const nx = clamp(this.pos.x, ob.x, ob.x+ob.w);
    const ny = clamp(this.pos.y, ob.y, ob.y+ob.h);
    const dx = this.pos.x - nx;
    const dy = this.pos.y - ny;
    const d2 = dx*dx + dy*dy;
    if (d2 < this.r*this.r) {
      let n = createVector(dx, dy);
      if (n.magSq()===0) n.set(1,0);
      n.normalize();
      const vdotn = this.vel.dot(n);
      const reflect = p5.Vector.mult(n, 2*vdotn);
      this.vel.sub(reflect).mult(0.985).add(p5.Vector.random2D().mult(0.03));
      const d = sqrt(d2);
      const overlap = this.r - d + 0.6;
      this.pos.add(p5.Vector.mult(n, overlap));
    }
  }

  draw() {
    push();
    translate(this.pos.x, this.pos.y);
    imageMode(CENTER);
    const sprite = imgs[this.index];
    const d = this.r*2;
    if (sprite) {
      drawingContext.save();
      drawingContext.beginPath();
      drawingContext.arc(0, 0, this.r, 0, TWO_PI);
      drawingContext.closePath();
      drawingContext.clip();
      image(sprite, 0, 0, d, d);
      drawingContext.restore();
    } else {
      fill(255, 120);
      circle(0, 0, d);
    }
    pop();
  }
}

class Obstacle {
  constructor(x, y, w, h){this.x=x;this.y=y;this.w=w;this.h=h;}
  draw(){noStroke();fill(240,240,255,38);rect(this.x,this.y,this.w,this.h,6);}
}
