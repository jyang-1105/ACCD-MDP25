// ========================================
// 🌧️ Dreamy Rain & Flowers System
// Author: [Your Name]
// ========================================

let flowers = [];
let raindrops = [];
let ripples = [];
let rainSlider;

function setup() {
  createCanvas(800, 500);
  colorMode(HSB, 360, 100, 100, 100);

  // 控制雨量
  rainSlider = createSlider(0, 30, 5, 1);
  rainSlider.position(width - 180, height - 40);
  rainSlider.style('width', '150px');

  // 初始花朵
  for (let i = 0; i < 6; i++) {
    flowers.push(new Flower(random(width), height - random(80, 120)));
  }
}

function draw() {
  background(0, 0, 0); // 黑色背景

  let rainIntensity = rainSlider.value();

  // 显示滑块提示
  noStroke();
  fill(200);
  textSize(14);
  textAlign(LEFT);
  text("Rain Intensity: " + rainIntensity, width - 175, height - 50);

  // 🌧️ 生成雨滴
  if (frameCount % 3 === 0) {
    for (let i = 0; i < rainIntensity; i++) {
      raindrops.push(new Rain(random(width), random(-100, 0)));
    }
  }

  // ☔ 更新雨滴
  for (let i = raindrops.length - 1; i >= 0; i--) {
    raindrops[i].fall();
    raindrops[i].display();

    // 生成涟漪与花朵
    if (raindrops[i].y > height - 20) {
      ripples.push(new Ripple(raindrops[i].x, height - 20));
      if (random() < 0.2) {
        flowers.push(new Flower(raindrops[i].x, height - random(60, 120)));
      }
      raindrops.splice(i, 1);
    }
  }

  // 🌊 绘制涟漪
  for (let i = ripples.length - 1; i >= 0; i--) {
    ripples[i].expand();
    ripples[i].display();
    if (ripples[i].alpha <= 0) ripples.splice(i, 1);
  }

  // 🌸 绘制花朵
  for (let f of flowers) {
    f.swing();
    f.display();
  }

  // 地面
  noStroke();
  fill(0, 0, 10);
  rect(0, height - 20, width, 30);
}

// 🌧️ 雨滴类 Rain
class Rain {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.speed = random(5, 9);
    this.len = random(8, 15);
  }

  fall() {
    this.y += this.speed;
  }

  display() {
    noStroke();
    fill(200, 80, 100, 80);
    ellipse(this.x, this.y, 4, this.len);
  }
}

// 🌊 涟漪类 Ripple
class Ripple {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.r = 2;
    this.alpha = 80;
  }

  expand() {
    this.r += 1.5;
    this.alpha -= 1.5;
  }

  display() {
    noFill();
    stroke(200, 50, 100, this.alpha);
    ellipse(this.x, this.y, this.r);
  }
}

// 🌸 花朵类 Flower
class Flower {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.size = random(15, 35);
    this.color = color(random(0, 360), 60, 100);
    this.petalCount = int(random(5, 9));
    this.swingOffset = random(TWO_PI);
  }

  swing() {
    this.x += sin(frameCount * 0.02 + this.swingOffset) * 0.1;
  }

  display() {
    push();
    translate(this.x, this.y);

    // 茎
    stroke(120, 80, 80);
    strokeWeight(2);
    line(0, 0, 0, 80);

    // 花瓣
    noStroke();
    fill(this.color);
    for (let i = 0; i < this.petalCount; i++) {
      let angle = TWO_PI / this.petalCount * i;
      let px = cos(angle) * this.size;
      let py = sin(angle) * this.size;
      ellipse(px, py, this.size, this.size * 0.7);
    }

    // 中心
    fill(50, 30, 100);
    ellipse(0, 0, this.size * 0.7, this.size * 0.7);

    pop();
  }
}
