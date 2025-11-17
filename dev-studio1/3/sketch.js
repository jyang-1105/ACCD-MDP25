let imgs = [];
let boxes = [];
let video;
let handPose;
let hands = [];

// 追踪数据
let fingerX = 0;
let fingerY = 0;
let path = [];
let current = null;
let startTime = 0;
let abandoned = [];
let selectedFlavor = null;
let hasSelected = false;
let peaceConfirmTimer = 0;

const names = ['Strawberry', 'Chocolate', 'Mango', 'Mint', 'Lemon',
               'Pistachio', 'Raspberry', 'Hazelnut', 'Coconut', 'Vanilla'];

const files = ['strawberry.png', 'chocolate.png', 'mango.png', 'mint.png', 'lemon.png',
               'pistachio.png', 'raspberry.png', 'hazelnut.png', 'coconut.png', 'vanilla.png'];

const READY_THRESHOLD = 3000; // 3秒

function preload() {
  for (let f of files) imgs.push(loadImage(f));
  handPose = ml5.handPose();
}

function setup() {
  createCanvas(windowWidth, windowHeight);
  setupBoxes();
  
  video = createCapture(VIDEO);
  video.size(640, 480);
  video.hide();
  
  let videoElement = document.getElementById('webcam');
  videoElement.srcObject = video.elt.srcObject;
  
  handPose.detectStart(video, gotHands);
  
  setTimeout(() => {
    document.getElementById('loading-screen').classList.add('hidden');
  }, 2000);
  
  textAlign(CENTER, CENTER);
}

function setupBoxes() {
  let w = width * 0.18;
  let h = height * 0.4;
  let gap = width * 0.02;
  let startX = (width - (w * 5 + gap * 4)) / 2;
  let startY = (height - (h * 2 + gap)) / 2;
  
  for (let i = 0; i < 10; i++) {
    let col = i % 5;
    let row = floor(i / 5);
    boxes.push({
      x: startX + col * (w + gap),
      y: startY + row * (h + gap),
      w: w,
      h: h,
      name: names[i],
      img: imgs[i],
      time: 0,
      ready: false
    });
  }
}

function gotHands(results) {
  hands = results;
}

function draw() {
  background(245);
  
  updateFingerPosition();
  
  if (!hasSelected) {
    drawSelection();
    checkPeaceGesture();
  } else {
    drawBeautifulReport();
  }
}

function updateFingerPosition() {
  if (hands.length > 0) {
    let hand = hands[0];
    let indexTip = hand.keypoints[8];
    fingerX = map(indexTip.x, 0, 640, width, 0);
    fingerY = map(indexTip.y, 0, 480, 0, height);
  }
}

function checkPeaceGesture() {
  if (hands.length === 0 || !current || !current.ready) {
    peaceConfirmTimer = 0;
    return;
  }
  
  let hand = hands[0];
  
  // 检测 Peace 手势：食指和中指伸直
  let indexTip = hand.keypoints[8];
  let middleTip = hand.keypoints[12];
  let ringTip = hand.keypoints[16];
  let pinkyTip = hand.keypoints[20];
  let wrist = hand.keypoints[0];
  
  let indexDist = dist(indexTip.x, indexTip.y, wrist.x, wrist.y);
  let middleDist = dist(middleTip.x, middleTip.y, wrist.x, wrist.y);
  let ringDist = dist(ringTip.x, ringTip.y, wrist.x, wrist.y);
  let pinkyDist = dist(pinkyTip.x, pinkyTip.y, wrist.x, wrist.y);
  
  // 食指和中指伸直，无名指和小指弯曲
  let isPeace = indexDist > 120 && middleDist > 120 && ringDist < 100 && pinkyDist < 90;
  
  if (isPeace) {
    peaceConfirmTimer++;
    
    // 显示确认进度
    push();
    fill(255, 200, 0);
    noStroke();
    textSize(48);
    textStyle(BOLD);
    text('✌️', width/2, height - 120);
    
    textSize(24);
    let dots = '.'.repeat((peaceConfirmTimer / 10) % 4);
    text('Confirming' + dots, width/2, height - 60);
    pop();
    
    // 60帧 = 1秒后确认
    if (peaceConfirmTimer > 60) {
      confirmSelection();
    }
  } else {
    peaceConfirmTimer = 0;
  }
}

function drawSelection() {
  for (let box of boxes) {
    image(box.img, box.x, box.y, box.w, box.h);
    
    if (box.ready) {
      fill(255, 180, 0);
      stroke(0);
      strokeWeight(5);
      textSize(24);
      textStyle(BOLD);
      text('Ready to choose?', box.x + box.w/2, box.y + box.h/2 - 10);
      
      textSize(18);
      textStyle(NORMAL);
      text('✌️ Show peace sign', box.x + box.w/2, box.y + box.h/2 + 25);
    }
  }
  
  if (path.length > 1) {
    stroke(255, 100, 100, 150);
    strokeWeight(3);
    noFill();
    beginShape();
    for (let p of path) vertex(p.x, p.y);
    if (current && hands.length > 0) vertex(fingerX, fingerY);
    endShape();
  }
  
  if (hands.length > 0) {
    noFill();
    stroke(0, 255, 0);
    strokeWeight(4);
    circle(fingerX, fingerY, 60);
    line(fingerX - 30, fingerY, fingerX + 30, fingerY);
    line(fingerX, fingerY - 30, fingerX, fingerY + 30);
  }
  
  updatePointing();
  
  fill(0);
  noStroke();
  textAlign(CENTER);
  textSize(28);
  textStyle(BOLD);
  text('Point at Your Favorite Ice Cream', width/2, 60);
  
  textSize(18);
  textStyle(NORMAL);
  let status = hands.length > 0 ? 'Hand detected ✓' : 'Show your hand';
  text('👆 ' + status + ' | Hold 3s | ✌️ Peace to confirm', width/2, 95);
}

function updatePointing() {
  if (hands.length === 0) {
    current = null;
    return;
  }
  
  let found = null;
  
  for (let box of boxes) {
    if (fingerX > box.x && fingerX < box.x + box.w && 
        fingerY > box.y && fingerY < box.y + box.h) {
      found = box;
      break;
    }
  }
  
  if (found) {
    if (current !== found) {
      if (current && current.ready) {
        abandoned.push(current.name);
      }
      boxes.forEach(b => b.ready = false);
      current = found;
      startTime = millis();
      path.push({x: fingerX, y: fingerY});
    } else {
      current.time += deltaTime;
      if (millis() - startTime > READY_THRESHOLD) {
        current.ready = true;
      }
    }
  } else {
    if (current && current.ready) {
      abandoned.push(current.name);
    }
    current = null;
  }
}

function confirmSelection() {
  if (current && current.ready && !hasSelected) {
    selectedFlavor = current;
    hasSelected = true;
    console.log('Selected:', selectedFlavor.name);
  }
}

function drawBeautifulReport() {
  // 渐变背景
  for (let i = 0; i < height; i++) {
    let inter = map(i, 0, height, 0, 1);
    let c = lerpColor(color(250, 248, 245), color(255, 250, 240), inter);
    stroke(c);
    line(0, i, width, i);
  }
  
  // 画所有图片（暗淡）
  for (let box of boxes) {
    tint(255, box === selectedFlavor ? 255 : 60);
    image(box.img, box.x, box.y, box.w, box.h);
  }
  noTint();
  
  // 选中的图片 - 发光效果
  if (selectedFlavor) {
    push();
    drawingContext.shadowBlur = 30;
    drawingContext.shadowColor = 'rgba(0, 255, 0, 0.6)';
    strokeWeight(8);
    stroke(0, 255, 100);
    noFill();
    rect(selectedFlavor.x - 4, selectedFlavor.y - 4, 
         selectedFlavor.w + 8, selectedFlavor.h + 8, 10);
    pop();
    
    // 选择标签
    push();
    fill(0, 255, 100);
    noStroke();
    textSize(28);
    textStyle(BOLD);
    text('✓ Your Choice', selectedFlavor.x + selectedFlavor.w/2, selectedFlavor.y - 30);
    pop();
  }
  
  // 主标题
  push();
  fill(100, 80, 60);
  noStroke();
  textAlign(CENTER);
  textSize(48);
  textStyle(BOLD);
  text('🍦', width/2, 80);
  
  textSize(36);
  text('Your Ice Cream Journey', width/2, 130);
  pop();
  
  // 统计数据
  let total = 0;
  let maxBox = boxes[0];
  for (let box of boxes) {
    total += box.time;
    if (box.time > maxBox.time) maxBox = box;
  }
  
  // 卡片式设计
  let cardY = 180;
  let cardGap = 80;
  
  // 卡片1：你的选择
  drawCard(width/2 - 250, cardY, 480, 60, 
           '💝 You chose', 
           selectedFlavor.name,
           color(255, 200, 200));
  
  // 卡片2：纠结时长
  drawCard(width/2 - 250, cardY + cardGap, 480, 60,
           '⏱️ Time spent thinking',
           (total / 1000).toFixed(1) + ' seconds',
           color(200, 220, 255));
  
  // 卡片3：最吸引你的
  if (maxBox.time > 0) {
    drawCard(width/2 - 250, cardY + cardGap * 2, 480, 60,
             '👀 You stared most at',
             maxBox.name + ' (' + (maxBox.time / 1000).toFixed(1) + 's)',
             color(255, 240, 200));
  }
  
  // 卡片4：改变主意
  if (abandoned.length > 0) {
    let uniqueAbandoned = [...new Set(abandoned)];
    drawCard(width/2 - 250, cardY + cardGap * 3, 480, 60,
             '🤔 You almost picked',
             uniqueAbandoned.join(', '),
             color(230, 200, 255));
  } else {
    drawCard(width/2 - 250, cardY + cardGap * 3, 480, 60,
             '🎯 Decision style',
             'Quick & Decisive!',
             color(200, 255, 200));
  }
  
  // 底部提示
  fill(150);
  noStroke();
  textAlign(CENTER);
  textSize(16);
  textStyle(NORMAL);
  text('Press S to save this moment | Press C to try again', width/2, height - 40);
}

function drawCard(x, y, w, h, label, value, bgColor) {
  push();
  
  // 卡片阴影
  drawingContext.shadowBlur = 15;
  drawingContext.shadowColor = 'rgba(0, 0, 0, 0.1)';
  
  // 卡片背景
  fill(bgColor);
  noStroke();
  rect(x, y, w, h, 12);
  
  // 重置阴影
  drawingContext.shadowBlur = 0;
  
  // 标签
  fill(100, 80, 60);
  textAlign(LEFT);
  textSize(16);
  textStyle(NORMAL);
  text(label, x + 20, y + 22);
  
  // 值
  fill(50, 40, 30);
  textSize(20);
  textStyle(BOLD);
  text(value, x + 20, y + 45);
  
  pop();
}

function keyPressed() {
  if (key === 'c' || key === 'C') {
    boxes.forEach(b => { b.time = 0; b.ready = false; });
    path = [];
    abandoned = [];
    current = null;
    hasSelected = false;
    selectedFlavor = null;
    peaceConfirmTimer = 0;
  }
  
  if (key === 's' || key === 'S' && hasSelected) {
    saveCanvas('my-ice-cream-choice-' + Date.now(), 'png');
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  boxes = [];
  setupBoxes();
}