let flavors = [];
let path = [];
let hoverTimes = [];
let currentFlavor = null;
let hoverStartTime = 0;
let flavorImages = [];
let isCapturing = false;
let abandonedChoices = []; // 记录放弃的选择

const flavorNames = ['Strawberry', 'Vanilla', 'Chocolate', 'Matcha', 'Mango'];
const flavorColors = ['#FF6B9D', '#FFF5BA', '#8B4513', '#90EE90', '#FFB347'];
const imageFiles = ['strawberry.png', 'vanilla.png', 'chocolate.png', 'matcha.png', 'mango.png'];

const READY_THRESHOLD = 5000; // 5秒后显示"ready to choose"

function preload() {
  for (let i = 0; i < imageFiles.length; i++) {
    flavorImages[i] = loadImage(imageFiles[i]);
  }
}

function setup() {
  createCanvas(windowWidth, windowHeight);
  
  let spacing = min(width, height) / 3;
  let centerX = width / 2;
  let centerY = height / 2;
  
  flavors.push({
    x: centerX,
    y: centerY,
    name: flavorNames[0],
    color: flavorColors[0],
    image: flavorImages[0],
    size: 100,
    hoverTime: 0,
    totalHoverTime: 0, // 累计停留时间
    isReady: false
  });
  
  let positions = [
    {x: centerX - spacing, y: centerY},
    {x: centerX + spacing, y: centerY},
    {x: centerX, y: centerY - spacing},
    {x: centerX, y: centerY + spacing}
  ];
  
  for (let i = 0; i < 4; i++) {
    flavors.push({
      x: positions[i].x,
      y: positions[i].y,
      name: flavorNames[i + 1],
      color: flavorColors[i + 1],
      image: flavorImages[i + 1],
      size: 100,
      hoverTime: 0,
      totalHoverTime: 0, // 累计停留时间
      isReady: false
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
        // 如果从另一个"ready"状态的口味切换过来，记录为abandoned
        if (currentFlavor && currentFlavor.isReady) {
          abandonedChoices.push({
            flavor: currentFlavor.name,
            time: currentFlavor.totalHoverTime,
            timestamp: millis()
          });
        }
        
        // 重置之前所有口味的isReady状态
        for (let f of flavors) {
          f.isReady = false;
        }
        
        currentFlavor = flavor;
        hoverStartTime = millis();
        path.push({ x: mouseX, y: mouseY });
        hoverTimes.push(0);
      } else {
        // 累加停留时间
        let currentHover = millis() - hoverStartTime;
        flavor.hoverTime = currentHover;
        flavor.totalHoverTime += deltaTime; // 累计总时间
        
        if (hoverTimes.length > 0) {
          hoverTimes[hoverTimes.length - 1] = flavor.hoverTime;
        }
        
        // 检查是否达到"ready to choose"状态
        if (flavor.hoverTime >= READY_THRESHOLD) {
          flavor.isReady = true;
        }
      }
    } else {
      // 鼠标移开时
      if (flavor === currentFlavor) {
        // 如果是在ready状态下移开，记录为abandoned
        if (flavor.isReady) {
          abandonedChoices.push({
            flavor: flavor.name,
            time: flavor.totalHoverTime,
            timestamp: millis()
          });
        }
        // 重置当前停留状态，但保留totalHoverTime（累计时间）
        flavor.hoverTime = 0;
        flavor.isReady = false;
        currentFlavor = null;
      }
    }
    
    // 根据累计停留时间增加圆点大小
    let currentSize = map(flavor.totalHoverTime, 0, 5000, flavor.size, flavor.size + 30);
    currentSize = constrain(currentSize, flavor.size, flavor.size + 30);
    
    noStroke();
    
    // 背景圆圈
    let c = color(flavor.color);
    fill(c);
    circle(flavor.x, flavor.y, currentSize);
    
    // Ready状态：闪烁效果
    if (flavor.isReady) {
      let pulse = sin(millis() * 0.005) * 0.5 + 0.5;
      strokeWeight(4);
      stroke(255, 255, 255, 150 + pulse * 105);
      noFill();
      circle(flavor.x, flavor.y, currentSize + 15);
    }
    
    // 外圈光晕效果
    if (isHovering) {
      fill(flavor.color + '40');
      circle(flavor.x, flavor.y, currentSize + 20);
    }
    
    // 绘制图片 - 圆形裁剪
    if (flavor.image) {
      push();
      let imgSize = currentSize * 0.95;
      drawingContext.save();
      drawingContext.beginPath();
      drawingContext.arc(flavor.x, flavor.y, imgSize/2, 0, TWO_PI);
      drawingContext.clip();
      image(flavor.image, flavor.x, flavor.y, imgSize, imgSize);
      drawingContext.restore();
      pop();
    }
    
    // Ready提示文字
    if (flavor.isReady && !isCapturing) {
      push();
      fill(flavor.color);
      textSize(12);
      textStyle(BOLD);
      let pulse = sin(millis() * 0.005) * 5;
      text('Ready to choose?', flavor.x, flavor.y - currentSize/2 - 20 + pulse);
      pop();
    }
  }
  
  // 绘制当前鼠标轨迹
  if (path.length > 0 && currentFlavor && !isCapturing) {
    stroke(100, 100, 150, 100);
    strokeWeight(2);
    line(path[path.length - 1].x, path[path.length - 1].y, mouseX, mouseY);
  }
  
  // 说明文字
  if (!isCapturing) {
    fill(100);
    noStroke();
    textAlign(LEFT);
    textStyle(NORMAL);
    textSize(18);
    text('Move mouse to browse flavors, hover longer for bigger circles', 30, 40);
    textSize(14);
    text('Hover 5+ seconds to see "Ready to choose" | Click LEFT MOUSE to capture', 30, 70);
    text('Press C to clear path', 30, 95);
  }
}

function keyPressed() {
  if (key === 'c' || key === 'C') {
    path = [];
    hoverTimes = [];
    currentFlavor = null;
    abandonedChoices = [];
    for (let flavor of flavors) {
      flavor.hoverTime = 0;
      flavor.totalHoverTime = 0;
      flavor.isReady = false;
    }
  }
}

function mousePressed() {
  if (mouseButton === LEFT) {
    captureWithData();
  }
}

function captureWithData() {
  isCapturing = true;
  
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
    let currentSize = map(flavor.totalHoverTime, 0, 5000, flavor.size, flavor.size + 30);
    currentSize = constrain(currentSize, flavor.size, flavor.size + 30);
    
    noStroke();
    let c = color(flavor.color);
    fill(c);
    circle(flavor.x, flavor.y, currentSize);
    
    if (flavor.image) {
      push();
      let imgSize = currentSize * 0.95;
      drawingContext.save();
      drawingContext.beginPath();
      drawingContext.arc(flavor.x, flavor.y, imgSize/2, 0, TWO_PI);
      drawingContext.clip();
      image(flavor.image, flavor.x, flavor.y, imgSize, imgSize);
      drawingContext.restore();
      pop();
    }
    
    // 显示停留时间
    if (flavor.totalHoverTime > 0) {
      fill(255);
      textAlign(CENTER, CENTER);
      textSize(14);
      textStyle(BOLD);
      text((flavor.totalHoverTime / 1000).toFixed(1) + 's', flavor.x, flavor.y + currentSize/2 + 25);
    }
  }
  
  // 显示统计数据
  fill(100);
  noStroke();
  textAlign(LEFT);
  textSize(24);
  textStyle(BOLD);
  text('Hesitation Path Report', 30, 50);
  
  textStyle(NORMAL);
  textSize(16);
  let yPos = 90;
  
  // 总停留时间
  let totalTime = 0;
  for (let flavor of flavors) {
    totalTime += flavor.totalHoverTime;
  }
  text('Total hesitation time: ' + (totalTime / 1000).toFixed(1) + 's', 30, yPos);
  yPos += 30;
  
  // 最长停留
  let maxFlavor = flavors[0];
  for (let flavor of flavors) {
    if (flavor.totalHoverTime > maxFlavor.totalHoverTime) {
      maxFlavor = flavor;
    }
  }
  
  if (maxFlavor.totalHoverTime > 0) {
    text('Most hesitated: ' + maxFlavor.name + ' (' + (maxFlavor.totalHoverTime / 1000).toFixed(1) + 's)', 30, yPos);
    yPos += 30;
  }
  
  text('Path complexity: ' + path.length + ' points', 30, yPos);
  yPos += 40;
  
  // 显示放弃的决定
  if (abandonedChoices.length > 0) {
    textStyle(BOLD);
    text('Last-Second Changes:', 30, yPos);
    yPos += 30;
    
    textStyle(NORMAL);
    textSize(14);
    
    // 统计放弃次数
    let abandonCount = {};
    for (let abandoned of abandonedChoices) {
      if (abandonCount[abandoned.flavor]) {
        abandonCount[abandoned.flavor]++;
      } else {
        abandonCount[abandoned.flavor] = 1;
      }
    }
    
    for (let flavorName in abandonCount) {
      let count = abandonCount[flavorName];
      let timeText = count === 1 ? 'time' : 'times';
      text('→ Almost chose ' + flavorName + ' (' + count + ' ' + timeText + ')', 30, yPos);
      yPos += 25;
    }
    
    yPos += 10;
    textSize(13);
    fill(150);
    text('You changed your mind ' + abandonedChoices.length + ' time(s) after hovering 5+ seconds!', 30, yPos);
  } else {
    textSize(14);
    fill(150);
    text('No last-second changes detected - decisive choice!', 30, yPos);
  }
  
  saveCanvas('hesitation-path-' + Date.now(), 'png');
  
  isCapturing = false;
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}