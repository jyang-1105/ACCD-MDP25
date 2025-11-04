let flavors = [];
let trails = [];
let hoverStartTime;
let lastHovered = null;

function setup() {
  createCanvas(windowWidth * 0.9, windowHeight * 0.9);
  colorMode(HSB, 360, 100, 100, 100);
  background(260, 10, 98);
  noCursor();

  // 定义口味点
  flavors = [
    { name: "Chocolate", x: width * 0.25, y: height * 0.5, col: color(30, 60, 40) },
    { name: "Strawberry", x: width * 0.45, y: height * 0.3, col: color(345, 70, 90) },
    { name: "Pistachio", x: width * 0.65, y: height * 0.5, col: color(90, 40, 80) },
    { name: "Vanilla", x: width * 0.55, y: height * 0.7, col: color(50, 20, 100) }
  ];
}

function draw() {
  // 残影层：降低透明度，让轨迹更持久
  noStroke();
  fill(260, 10, 98, 3); // 调低透明度，残影更浓厚
  rect(0, 0, width, height);

  // 绘制发光轨迹（更浓更“雾化”）
  for (let t of trails) {
    drawingContext.shadowBlur = 40;
    drawingContext.shadowColor = t.col;
    stroke(t.col);
    strokeWeight(t.weight);
    noFill();

    beginShape();
    curveVertex(t.x1, t.y1);
    curveVertex((t.x1 + t.x2) / 2 + random(-2, 2), (t.y1 + t.y2) / 2 + random(-2, 2));
    curveVertex(t.x2, t.y2);
    endShape();

    drawingContext.shadowBlur = 0;
  }

  // 绘制口味圆点
  for (let f of flavors) {
    let d = dist(mouseX, mouseY, f.x, f.y);
    let hovered = d < 80;

    if (hovered) {
      // 呼吸光环
      noFill();
      stroke(hue(f.col), 60, 100, 50);
      strokeWeight(8);
      ellipse(f.x, f.y, 130 + sin(frameCount * 0.08) * 10);

      // 主圆
      fill(f.col);
      noStroke();
      ellipse(f.x, f.y, 100);

      // 文字
      fill(0, 0, 20);
      textAlign(CENTER);
      textSize(20);
      text(f.name, f.x, f.y + 5);

      // 犹豫路径生成逻辑
      if (lastHovered === f) {
        let hoverDuration = millis() - hoverStartTime;
        let w = map(hoverDuration, 0, 3000, 1.5, 8, true);
        let hueShift = map(hoverDuration, 0, 3000, 200, 40, true);
        let c = color(hueShift, 80, 100, map(hoverDuration, 0, 3000, 20, 100));
        trails.push({
          x1: pmouseX + random(-3, 3),
          y1: pmouseY + random(-3, 3),
          x2: mouseX + random(-3, 3),
          y2: mouseY + random(-3, 3),
          col: c,
          weight: w
        });
      } else {
        lastHovered = f;
        hoverStartTime = millis();
      }
    } else {
      fill(f.col);
      noStroke();
      ellipse(f.x, f.y, 80);
      fill(0, 0, 20);
      textAlign(CENTER);
      textSize(14);
      text(f.name, f.x, f.y + 5);
    }
  }

  // 鼠标点
  noStroke();
  fill(0, 0, 20);
  ellipse(mouseX, mouseY, 6);

  // 路径淡出速度放慢，让残影更明显
  for (let i = trails.length - 1; i >= 0; i--) {
    trails[i].col.setAlpha(alpha(trails[i].col) - 0.4);
    if (alpha(trails[i].col) <= 0) trails.splice(i, 1);
  }
}

function mousePressed() {
  noLoop();
  saveCanvas('hesitation_path_v3', 'png');
}
