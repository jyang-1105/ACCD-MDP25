let flavors = [];
let path = [];
let hoverTimes = [];
let currentFlavor = null;
let hoverStartTime = 0;
let flavorImages = [];
let isCapturing = false;

const flavorNames = ['Strawberry', 'Vanilla', 'Chocolate', 'Matcha', 'Mango'];
const flavorColors = ['#FF6B9D', '#FFF5BA', '#8B4513', '#90EE90', '#FFB347'];
// 图片文件名 - 请确保这些图片在你的项目文件夹中
const imageFiles = ['strawberry.png', 'vanilla.png', 'chocolate.png', 'matcha.png', 'mango.png'];

function preload() {
  // 加载口味图片
  for (let i = 0; i < imageFiles.length; i++) {
    flavorImages[i] = loadImage(imageFiles[i]);
  }
}

function setup() {
  createCanvas(windowWidth, windowHeight);
  
  // 创建口味圆点 - 分布在画布中心区域
  let spacing = min(width, height) / 3;
  let centerX = width / 2;
  let centerY = height / 2;
  
  // 中心一个
  flavors.push({
    x: centerX,
    y: centerY,
    name: flavorNames[0],
    color: flavorColors[0],
    image: flavorImages[0],
    size: 100,
    hoverTime: 0
  });
  
  // 上下左右四个
  let positions = [
    {x: centerX - spacing, y: centerY},      // 左
    {x: centerX + spacing, y: centerY},      // 右
    {x: centerX, y: centerY - spacing},      // 上
    {x: centerX, y: centerY + spacing}       // 下
  ];
  
  for (let i = 0; i < 4; i++) {
    flavors.push({
      x: positions[i].x,
      y: positions[i].y,
      name: flavorNames[i + 1],
      color: flavorColors[i + 1],
      image: flavorImages[i + 1],
      size: 100,
      hoverTime: 0
    });
  }
  
  textAlign(CENTER, CENTER);
  imageMode(CENTER);
}

function draw() {
  background(250, 248, 245);
  
  // 绘制犹豫路径
  if (path.length > 1) {
    for (let i = 0; i < path.length - 1; i++) {
      let alpha = map(hoverTimes[i], 0, 3000, 50, 200);
      let weight = map(hoverTimes[i], 0, 3000, 1, 4);
      
      stroke(100, 100, 150, alpha);
      strokeWeight(weight);
      line(path[i].x, path[i].y, path[i + 1].x, path[i + 1].y);
    }
  }
  
  // 绘制口味圆点
  for (let flavor of flavors) {
    let d = dist(mouseX, mouseY, flavor.x, flavor.y);
    let isHovering = d < flavor.size / 2;
    
    // 计算停留时间
    if (isHovering) {
      if (currentFlavor !== flavor) {
        currentFlavor = flavor;
        hoverStartTime = millis();
        path.push({ x: mouseX, y: mouseY });
        hoverTimes.push(0);
      } else {
        flavor.hoverTime = millis() - hoverStartTime;
        if (hoverTimes.length > 0) {
          hoverTimes[hoverTimes.length - 1] = flavor.hoverTime;
        }
      }
    }
    
    // 根据停留时间增加圆点大小
    let currentSize = map(flavor.hoverTime, 0, 5000, flavor.size, flavor.size + 30);
    currentSize = constrain(currentSize, flavor.size, flavor.size + 30);
    
    noStroke();
    
    // 背景圆圈
    let c = color(flavor.color);
    fill(c);
    circle(flavor.x, flavor.y, currentSize);
    
    // 外圈光晕效果
    if (isHovering) {
      fill(flavor.color + '40');
      circle(flavor.x, flavor.y, currentSize + 20);
    }
    
    // 绘制图片
    if (flavor.image) {
      let imgSize = currentSize * 0.7;
      image(flavor.image, flavor.x, flavor.y, imgSize, imgSize);
    }
  }
  
  // 绘制当前鼠标轨迹
  if (path.length > 0 && currentFlavor && !isCapturing) {
    stroke(100, 100, 150, 100);
    strokeWeight(2);
    line(path[path.length - 1].x, path[path.length - 1].y, mouseX, mouseY);
  }
  
  // 说明文字（只在未截屏时显示）
  if (!isCapturing) {
    fill(100);
    noStroke();
    textAlign(LEFT);
    textSize(18);
    text('Move mouse to browse flavors, hover longer for bigger circles', 30, 40);
    textSize(14);
    text('Press SPACE to capture | Press C to clear path', 30, 70);
  }
}

function keyPressed() {
  // C 键清除路径
  if (key === 'c' || key === 'C') {
    path = [];
    hoverTimes = [];
    currentFlavor = null;
    for (let flavor of flavors) {
      flavor.hoverTime = 0;
    }
  }
  
  // 空格键截屏并显示数据
  if (key === ' ') {
    captureWithData();
  }
}

function captureWithData() {
  isCapturing = true;
  
  // 重新绘制一次以显示数据
  background(250, 248, 245);
  
  // 绘制路径
  if (path.length > 1) {
    for (let i = 0; i < path.length - 1; i++) {
      let alpha = map(hoverTimes[i], 0, 3000, 50, 200);
      let weight = map(hoverTimes[i], 0, 3000, 1, 4);
      
      stroke(100, 100, 150, alpha);
      strokeWeight(weight);
      line(path[i].x, path[i].y, path[i + 1].x, path[i + 1].y);
    }
  }
  
  // 绘制圆点
  for (let flavor of flavors) {
    let currentSize = map(flavor.hoverTime, 0, 5000, flavor.size, flavor.size + 30);
    currentSize = constrain(currentSize, flavor.size, flavor.size + 30);
    
    noStroke();
    let c = color(flavor.color);
    fill(c);
    circle(flavor.x, flavor.y, currentSize);
    
    if (flavor.image) {
      let imgSize = currentSize * 0.7;
      image(flavor.image, flavor.x, flavor.y, imgSize, imgSize);
    }
    
    // 显示停留时间
    if (flavor.hoverTime > 0) {
      fill(255);
      textAlign(CENTER, CENTER);
      textSize(14);
      textStyle(BOLD);
      text((flavor.hoverTime / 1000).toFixed(1) + 's', flavor.x, flavor.y + currentSize/2 + 25);
    }
  }
  
  // 显示统计数据
  fill(100);
  noStroke();
  textAlign(LEFT);
  textSize(20);
  textStyle(BOLD);
  text('Hesitation Path Report', 30, 40);
  
  textStyle(NORMAL);
  textSize(14);
  let yPos = 70;
  
  // 计算总停留时间
  let totalTime = 0;
  for (let flavor of flavors) {
    totalTime += flavor.hoverTime;
  }
  
  text('Total hesitation time: ' + (totalTime / 1000).toFixed(1) + 's', 30, yPos);
  yPos += 25;
  
  // 找出停留最久的口味
  let maxFlavor = flavors[0];
  for (let flavor of flavors) {
    if (flavor.hoverTime > maxFlavor.hoverTime) {
      maxFlavor = flavor;
    }
  }
  
  if (maxFlavor.hoverTime > 0) {
    text('Most hesitated: ' + maxFlavor.name + ' (' + (maxFlavor.hoverTime / 1000).toFixed(1) + 's)', 30, yPos);
    yPos += 25;
  }
  
  text('Path complexity: ' + path.length + ' points', 30, yPos);
  
  // 保存截图
  saveCanvas('hesitation-path-' + Date.now(), 'png');
  
  isCapturing = false;
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}