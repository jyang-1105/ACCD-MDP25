/* 
  Bouncy Orbs with Rectangular Obstacles
  - 多个彩色圆球在屏幕内弹性反弹
  - 碰到矩形障碍物会反射
  - 速度加入少量 Perlin 噪声 -> 非线性运动质感
*/

let balls = [];
let obstacles = [];
const BALL_COUNT = 40;

function setup() {
  createCanvas(windowWidth, windowHeight);
  // 创建障碍物（可自定义/增加）
  // Obstacle(x, y, w, h)
  obstacles.push(new Obstacle(width*0.25, height*0.35, 200, 24));
  obstacles.push(new Obstacle(width*0.6, height*0.6, 240, 28));
  obstacles.push(new Obstacle(width*0.55, height*0.25, 30, 220));
  obstacles.push(new Obstacle(width*0.15, height*0.7, 180, 20));

  // 创建小球
  for (let i = 0; i < BALL_COUNT; i++) {
    const r = random(10, 26);
    const x = random(r, width - r);
    const y = random(r, height - r);
    // 避免出生在障碍物里
    if (isPointInAnyObstacle(x, y)) { i--; continue; }
    const speed = random(1.2, 3.2);
    const angle = random(TWO_PI);
    balls.push(new Ball(x, y, cos(angle)*speed, sin(angle)*speed, r));
  }

  noStroke();
}

function draw() {
  // 半透明叠加制造拖影
  background(10, 12, 20, 35);

  // 画障碍物
  for (const ob of obstacles) ob.draw();

  // 更新并绘制小球
  for (const b of balls) {
    b.update();
    // 与边界碰撞
    b.bounceEdges();
    // 与障碍物碰撞
    for (const ob of obstacles) {
      b.collideObstacle(ob);
    }
    b.draw();
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}

// ---------- 工具 ----------
function clamp(v, lo, hi) { return max(lo, min(hi, v)); }

function isPointInAnyObstacle(px, py) {
  return obstacles.some(ob => (
    px >= ob.x && px <= ob.x + ob.w && py >= ob.y && py <= ob.y + ob.h
  ));
}

// ---------- 类 ----------
class Ball {
  constructor(x, y, vx, vy, r) {
    this.pos = createVector(x, y);
    this.vel = createVector(vx, vy);
    this.r = r;
    this.hueBase = random(360);
    this.noiseSeedX = random(1000);
    this.noiseSeedY = random(2000, 3000);
  }

  update() {
    // 给速度一点点噪声扰动（非线性）
    const nX = noise(this.noiseSeedX + frameCount * 0.007);
    const nY = noise(this.noiseSeedY + frameCount * 0.007);
    const jitter = 0.15; // 扰动强度（可调）
    this.vel.x += map(nX, 0, 1, -jitter, jitter);
    this.vel.y += map(nY, 0, 1, -jitter, jitter);

    // 限速避免飞走
    this.vel.limit(4.5);

    this.pos.add(this.vel);
  }

  bounceEdges() {
    // 左右
    if (this.pos.x < this.r) {
      this.pos.x = this.r;
      this.vel.x *= -1;
    } else if (this.pos.x > width - this.r) {
      this.pos.x = width - this.r;
      this.vel.x *= -1;
    }
    // 上下
    if (this.pos.y < this.r) {
      this.pos.y = this.r;
      this.vel.y *= -1;
    } else if (this.pos.y > height - this.r) {
      this.pos.y = height - this.r;
      this.vel.y *= -1;
    }
  }

  collideObstacle(ob) {
    // 计算圆到矩形的最近点
    const nearestX = clamp(this.pos.x, ob.x, ob.x + ob.w);
    const nearestY = clamp(this.pos.y, ob.y, ob.y + ob.h);
    const dx = this.pos.x - nearestX;
    const dy = this.pos.y - nearestY;
    const distSq = dx*dx + dy*dy;

    if (distSq < this.r * this.r) {
      // 碰撞：法线向量
      let normal = createVector(dx, dy);
      // 圆心在矩形内部的罕见情况 -> 选择最短推出方向
      if (normal.magSq() === 0) {
        const leftPen   = abs((this.pos.x - ob.x));
        const rightPen  = abs((ob.x + ob.w) - this.pos.x);
        const topPen    = abs((this.pos.y - ob.y));
        const bottomPen = abs((ob.y + ob.h) - this.pos.y);
        const minPen = min(leftPen, rightPen, topPen, bottomPen);
        if (minPen === leftPen)      normal.set(-1, 0);
        else if (minPen === rightPen)normal.set( 1, 0);
        else if (minPen === topPen)  normal.set( 0,-1);
        else                         normal.set( 0, 1);
      } else {
        normal.normalize();
      }

      // 反射速度 v' = v - 2(v·n)n
      const vdotn = this.vel.dot(normal);
      const reflect = p5.Vector.mult(normal, 2 * vdotn);
      this.vel.sub(reflect);

      // 稍微增加能量损失/扰动，避免“卡住”
      this.vel.mult(0.98);
      this.vel.add(p5.Vector.random2D().mult(0.05));

      // 位置校正：把圆推出接触面外
      const dist = sqrt(distSq);
      const overlap = this.r - dist + 0.5;
      this.pos.add(p5.Vector.mult(normal, overlap));
    }
  }

  draw() {
    // 颜色：随时间在色环上轻微漂移
    const hue = (this.hueBase + frameCount * 0.3) % 360;
    colorMode(HSB, 360, 100, 100, 100);
    fill(hue, 85, 100, 92);
    noStroke();
    circle(this.pos.x, this.pos.y, this.r * 2);
    colorMode(RGB, 255);
  }
}

class Obstacle {
  constructor(x, y, w, h) {
    this.x = x; this.y = y; this.w = w; this.h = h;
  }
  draw() {
    push();
    noStroke();
    fill(240, 240, 255, 40);    // 半透明填充
    rect(this.x, this.y, this.w, this.h, 6);
    pop();
  }
}

