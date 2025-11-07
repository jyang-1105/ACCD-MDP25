let plants = [];
let raindrops = [];
let ripples = [];
let rainSlider;
let moreRainButton, lessRainButton;
const SOIL_LINE = 460;
let globalMoisture = 0; // 环境湿度

function setup() {
  let canvas = createCanvas(700, 500);
  canvas.parent("sketch-container");
  colorMode(HSB, 360, 100, 100, 100);

  // --- 控制UI ---
  rainSlider = select("#rainSlider");
  moreRainButton = select("#moreRain");
  lessRainButton = select("#lessRain");

  moreRainButton.mousePressed(() => {
    let newVal = min(Number(rainSlider.value()) + 5, 40);
    rainSlider.value(newVal);
  });

  lessRainButton.mousePressed(() => {
    let newVal = max(Number(rainSlider.value()) - 5, 0);
    rainSlider.value(newVal);
  });

  // --- 初始化植物 ---
  for (let i = 0; i < 22; i++) {
    let x = map(i, 0, 21, 40, width - 40) + random(-10, 10);
    plants.push(new Plant(x, SOIL_LINE + 2));
  }
}

function draw() {
  background(0);
  noStroke();
  fill(0, 0, 12);
  rect(0, SOIL_LINE, width, height - SOIL_LINE);

  let intensity = Number(rainSlider.value());

  // 🌧 环境湿度由雨量直接决定（强相关）
  // 这里用较高的 lerp 速度，模拟快速响应雨强
  globalMoisture = lerp(globalMoisture, intensity / 40, 0.05);

  // 🌧 生成雨滴
  if (frameCount % 2 === 0 && intensity > 0) {
    for (let i = 0; i < intensity; i++) {
      raindrops.push(new Rain(random(width), random(-120, -10)));
    }
  }

  // 💧 更新雨滴
  for (let i = raindrops.length - 1; i >= 0; i--) {
    let r = raindrops[i];
    r.update();
    r.draw();
    if (r.y >= SOIL_LINE) {
      ripples.push(new Ripple(r.x, SOIL_LINE));
      waterNearby(r.x);
      raindrops.splice(i, 1);
    }
  }

  // 🌊 涟漪
  for (let i = ripples.length - 1; i >= 0; i--) {
    ripples[i].update();
    ripples[i].draw();
    if (ripples[i].alpha <= 0) ripples.splice(i, 1);
  }

  // 🌱 更新植物（传入当前雨量 & 湿度）
  for (let p of plants) {
    p.update(globalMoisture, intensity);
    p.draw();
  }

  // 📊 显示数值
  noStroke();
  fill(200, 30, 90);
  textSize(14);
  textAlign(LEFT);
  text(`Rain Intensity: ${intensity}`, 20, 30);
  text(`Soil Moisture: ${nf(globalMoisture, 1, 2)}`, 20, 50);
}

function waterNearby(x) {
  for (let p of plants) {
    if (abs(p.x - x) < 70) {
      p.water = min(p.water + 0.6, p.maxWater);
    }
  }
}

// ---- Rain ----
class Rain {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.vy = random(6, 10);
    this.wind = random(-0.25, 0.25);
    this.len = random(10, 16);
  }
  update() {
    this.y += this.vy;
    this.x += this.wind;
  }
  draw() {
    noStroke();
    fill(200, 80, 100, 80);
    ellipse(this.x, this.y, 5, this.len);
  }
}

// ---- Ripple ----
class Ripple {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.r = 4;
    this.alpha = 85;
  }
  update() {
    this.r += 1.8;
    this.alpha -= 1.5;
  }
  draw() {
    noFill();
    stroke(200, 40, 100, this.alpha);
    strokeWeight(1);
    ellipse(this.x, this.y, this.r, this.r * 0.5);
  }
}

// ---- Plant ----
class Plant {
  constructor(x, baseY) {
    this.x = x;
    this.baseY = baseY;
    this.height = random(30, 80);
    this.maxHeight = random(240, 320);
    this.water = random(0.0, 1.0);
    this.maxWater = 10;
    this.bloom = random(0.15, 0.35);
    this.phase = random(TWO_PI);
    this.petalHue = random(0, 360);
    this.centerHue = random([45, 200, 250]);
  }

  update(envMoisture, rainIntensity) {
    // 🌿 水分积累与雨强双重影响（核心变化）
    let rainFactor = rainIntensity / 40; // [0,1]区间
    this.water += envMoisture * 0.05 + rainFactor * 0.05 - 0.025;
    this.water = constrain(this.water, 0, this.maxWater);

    // 🌱 生长速度与雨量强相关
    let growthSpeed = map(rainIntensity, 0, 40, 0.001, 0.05);
    let bloomSpeed = map(rainIntensity, 0, 40, 0.0005, 0.005);

    if (this.water > 0.5) {
      this.height = min(this.height + this.water * growthSpeed, this.maxHeight);
      this.bloom = min(this.bloom + this.water * bloomSpeed, 1);
    } else {
      this.height = max(this.height - 0.04, 20);
      this.bloom = max(this.bloom - 0.0008, 0.2);
    }
  }

  draw() {
    push();
    translate(this.x, this.baseY);

    let sway = sin(frameCount * 0.02 + this.phase) * 0.12;
    rotate(sway);

    // 茎
    stroke(120, 50, 80);
    strokeWeight(2);
    line(0, 0, 0, -this.height);
    let headY = -this.height;

    // 🌸 花亮度与水分+雨量相关
    noStroke();
    let brightness = map(this.water, 0, this.maxWater, 30, 95);
    fill(this.petalHue, 55, 100, brightness);
    for (let i = 0; i < 7; i++) {
      let ang = (TWO_PI / 7) * i;
      let px = cos(ang) * 14;
      let py = headY + sin(ang) * 14;
      ellipse(px, py, 20, 14);
    }

    fill(this.centerHue, 70, 100, brightness);
    ellipse(0, headY, 12);
    pop();
  }
}
