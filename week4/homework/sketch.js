/* Bouncy Orbs (small canvas version inside #sketch-holder) */
let balls = [];
let obstacles = [];
const BALL_COUNT = 36;

function setup() {
  const {w, h} = holderSize();
  const cnv = createCanvas(w, h);
  cnv.parent("sketch-holder");

  setupObstacles();
  setupBalls();

  noStroke();
  frameRate(60);
}

function draw() {
  // 深色+轻拖影
  background(10, 12, 20, 40);

  // 障碍物
  for (const ob of obstacles) ob.draw();

  // 小球
  for (const b of balls) {
    b.update();
    b.bounceEdges();
    for (const ob of obstacles) b.collideObstacle(ob);
    b.draw();
  }
}

/* ---------- Layout helpers ---------- */
function holderSize(){
  const el = document.getElementById("sketch-holder");
  // el 还未渲染时兜底
  const w = el?.clientWidth || windowWidth * 0.9;
  const h = el?.clientHeight || Math.min(420, w * 9/16);
  return { w: floor(w), h: floor(h) };
}
function windowResized(){
  const {w,h} = holderSize();
  resizeCanvas(w, h);
  setupObstacles(true); // 重建障碍物以适应新尺寸
}

/* ---------- Scene setup ---------- */
function setupBalls(){
  balls = [];
  for (let i = 0; i < BALL_COUNT; i++) {
    const r = random(10, 24);
    const x = random(r, width - r);
    const y = random(r, height - r);
    if (pointInObstacles(x, y)) { i--; continue; }
    const speed = random(1.2, 3.0);
    const a = random(TWO_PI);
    balls.push(new Ball(x, y, cos(a)*speed, sin(a)*speed, r));
  }
}
function setupObstacles(keepCount=false){
  // 按当前画布尺寸放置一些矩形
  obstacles = [];
  const pad = max(16, width*0.02);
  obstacles.push(new Obstacle(width*0.18, height*0.58, width*0.26, 18));
  obstacles.push(new Obstacle(width*0.62, height*0.25, 22, height*0.42));
  obstacles.push(new Obstacle(width*0.30, height*0.28, width*0.22, 16));
  // 也可以再加一条底部短杠
  obstacles.push(new Obstacle(width*0.55, height*0.80, width*0.18, 14));
}

/* ---------- Utils ---------- */
function clamp(v, lo, hi){ return max(lo, min(hi, v)); }
function pointInObstacles(px, py){
  return obstacles.some(ob => px>=ob.x && px<=ob.x+ob.w && py>=ob.y && py<=ob.y+ob.h);
}

/* ---------- Classes ---------- */
class Ball{
  constructor(x,y,vx,vy,r){
    this.pos = createVector(x,y);
    this.vel = createVector(vx,vy);
    this.r = r;
    this.h = random(360);
    this.nx = random(1000);
    this.ny = random(2000,3000);
  }
  update(){
    // 非线性：给速度添加噪声扰动
    const jitter = 0.14;
    this.vel.x += map(noise(this.nx + frameCount*0.007), 0, 1, -jitter, jitter);
    this.vel.y += map(noise(this.ny + frameCount*0.007), 0, 1, -jitter, jitter);
    this.vel.limit(4.2);
    this.pos.add(this.vel);
  }
  bounceEdges(){
    if (this.pos.x < this.r){ this.pos.x = this.r; this.vel.x *= -1; }
    if (this.pos.x > width - this.r){ this.pos.x = width - this.r; this.vel.x *= -1; }
    if (this.pos.y < this.r){ this.pos.y = this.r; this.vel.y *= -1; }
    if (this.pos.y > height - this.r){ this.pos.y = height - this.r; this.vel.y *= -1; }
  }
  collideObstacle(ob){
    const nx = clamp(this.pos.x, ob.x, ob.x+ob.w);
    const ny = clamp(this.pos.y, ob.y, ob.y+ob.h);
    const dx = this.pos.x - nx;
    const dy = this.pos.y - ny;
    const d2 = dx*dx + dy*dy;
    if (d2 < this.r*this.r){
      let n = createVector(dx,dy);
      if (n.magSq() === 0){
        // 退到最近边
        const left = abs(this.pos.x - ob.x);
        const right = abs(ob.x+ob.w - this.pos.x);
        const top = abs(this.pos.y - ob.y);
        const bottom = abs(ob.y+ob.h - this.pos.y);
        const m = min(left,right,top,bottom);
        if (m===left) n.set(-1,0); else if (m===right) n.set(1,0);
        else if (m===top) n.set(0,-1); else n.set(0,1);
      }else n.normalize();

      // 速度反射
      const vdotn = this.vel.dot(n);
      const reflect = p5.Vector.mult(n, 2*vdotn);
      this.vel.sub(reflect).mult(0.985).add(p5.Vector.random2D().mult(0.04));

      // 位置校正
      const d = sqrt(d2);
      const overlap = this.r - d + 0.6;
      this.pos.add(p5.Vector.mult(n, overlap));
    }
  }
  draw(){
    colorMode(HSB,360,100,100,100);
    const hue = (this.h + frameCount*0.35) % 360;
    fill(hue, 85, 100, 92);
    noStroke();
    circle(this.pos.x, this.pos.y, this.r*2);
    colorMode(RGB,255);
  }
}

class Obstacle{
  constructor(x,y,w,h){ this.x=x; this.y=y; this.w=w; this.h=h; }
  draw(){
    noStroke();
    fill(240,240,255,38);
    rect(this.x, this.y, this.w, this.h, 6);
  }
}
