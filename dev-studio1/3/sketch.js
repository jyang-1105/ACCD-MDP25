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
let okConfirmTimer = 0; // 改名: peace -> ok

// 保存反馈
let saveMessage = '';
let saveMessageTimer = 0;

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
  // 优化布局：更好的间距和尺寸
  let w = width * 0.16;  // 稍微缩小图片宽度
  let h = height * 0.35; // 稍微缩小图片高度
  let gap = width * 0.025; // 增加间距
  
  // 计算起始位置，留出顶部空间给标题
  let startX = (width - (w * 5 + gap * 4)) / 2;
  let startY = height * 0.18; // 从18%的位置开始，给标题留足空间
  
  // 确保底部也有足够空间
  let totalHeight = h * 2 + gap;
  if (startY + totalHeight > height * 0.85) {
    startY = height * 0.15;
    h = (height * 0.7 - gap) / 2; // 调整高度以适应屏幕
  }
  
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
    checkOKGesture(); // 改名: Peace -> OK
  } else {
    drawBeautifulReport();
  }
  
  // 显示保存反馈消息
  if (saveMessageTimer > 0) {
    drawSaveMessage();
    saveMessageTimer--;
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

// ✅ 新函数：检测OK手势
function checkOKGesture() {
  if (hands.length === 0 || !current || !current.ready) {
    okConfirmTimer = 0;
    return;
  }
  
  let hand = hands[0];
  
  // OK手势检测：拇指和食指形成圆圈，其他三指伸直
  let thumb = hand.keypoints[4];      // 拇指尖
  let index = hand.keypoints[8];       // 食指尖
  let middle = hand.keypoints[12];     // 中指尖
  let ring = hand.keypoints[16];       // 无名指尖
  let pinky = hand.keypoints[20];      // 小指尖
  let wrist = hand.keypoints[0];       // 手腕
  
  // 1. 拇指和食指距离要近（形成圆圈）
  let thumbIndexDist = dist(thumb.x, thumb.y, index.x, index.y);
  
  // 2. 其他三指要伸直（距离手腕较远）
  let middleDist = dist(middle.x, middle.y, wrist.x, wrist.y);
  let ringDist = dist(ring.x, ring.y, wrist.x, wrist.y);
  let pinkyDist = dist(pinky.x, pinky.y, wrist.x, wrist.y);
  
  // OK手势判断
  let isOK = thumbIndexDist < 60 && // 拇指食指靠近
             middleDist > 100 &&     // 中指伸直
             ringDist > 90 &&        // 无名指伸直
             pinkyDist > 80;         // 小指伸直
  
  if (isOK) {
    okConfirmTimer++;
    
    // 显示确认进度
    push();
    fill(255, 200, 0);
    noStroke();
    textSize(56);
    textStyle(BOLD);
    text('👌', width/2, height - 130);
    
    textSize(26);
    let dots = '.'.repeat((okConfirmTimer / 10) % 4);
    text('Confirming' + dots, width/2, height - 70);
    
    // 进度条
    let progress = constrain(okConfirmTimer / 60, 0, 1);
    fill(255, 200, 0, 100);
    rect(width/2 - 100, height - 35, 200, 8, 4);
    fill(255, 200, 0);
    rect(width/2 - 100, height - 35, 200 * progress, 8, 4);
    
    pop();
    
    // 60帧 = 1秒后确认
    if (okConfirmTimer > 60) {
      confirmSelection();
    }
  } else {
    okConfirmTimer = 0;
  }
}

function drawSelection() {
  // ✅ 优化的标题区域 - 使用渐变背景
  push();
  // 顶部渐变背景
  for (let i = 0; i < height * 0.15; i++) {
    let alpha = map(i, 0, height * 0.15, 80, 0);
    stroke(100, 150, 200, alpha);
    line(0, i, width, i);
  }
  
  // 标题
  fill(50, 80, 120);
  noStroke();
  textAlign(CENTER, CENTER);
  textSize(42);
  textStyle(BOLD);
  text('🍦 Point at Your Favorite Ice Cream', width/2, height * 0.06);
  
  // 状态栏
  textSize(18);
  textStyle(NORMAL);
  fill(80, 110, 150);
  let status = hands.length > 0 ? '👆 Hand detected ✓' : '👆 Show your hand';
  text(status + ' | Hold 3s to select | 👌 OK sign to confirm', width/2, height * 0.11);
  pop();
  
  // 绘制图片
  for (let box of boxes) {
    push();
    
    // 图片阴影效果
    if (current === box) {
      drawingContext.shadowBlur = 20;
      drawingContext.shadowColor = 'rgba(100, 150, 255, 0.5)';
    }
    
    image(box.img, box.x, box.y, box.w, box.h);
    drawingContext.shadowBlur = 0;
    
    // Ready状态显示
    if (box.ready) {
      // 半透明覆盖层
      fill(255, 180, 0, 200);
      noStroke();
      rect(box.x, box.y, box.w, box.h);
      
      // 文字提示
      fill(255);
      stroke(0);
      strokeWeight(3);
      textSize(24);
      textStyle(BOLD);
      text('Ready!', box.x + box.w/2, box.y + box.h/2 - 15);
      
      textSize(18);
      textStyle(NORMAL);
      text('👌 Show OK sign', box.x + box.w/2, box.y + box.h/2 + 15);
      
      // 边框高亮
      noFill();
      stroke(255, 180, 0);
      strokeWeight(5);
      rect(box.x - 2, box.y - 2, box.w + 4, box.h + 4, 8);
    }
    
    pop();
  }
  
  // 绘制轨迹
  if (path.length > 1) {
    stroke(255, 100, 150, 180);
    strokeWeight(4);
    noFill();
    beginShape();
    for (let p of path) {
      curveVertex(p.x, p.y); // 使用曲线让轨迹更平滑
    }
    if (current && hands.length > 0) {
      curveVertex(fingerX, fingerY);
    }
    endShape();
  }
  
  // 手指指示器
  if (hands.length > 0) {
    push();
    noFill();
    stroke(0, 255, 150);
    strokeWeight(5);
    circle(fingerX, fingerY, 50);
    
    // 十字标记
    stroke(0, 255, 150);
    strokeWeight(3);
    line(fingerX - 20, fingerY, fingerX + 20, fingerY);
    line(fingerX, fingerY - 20, fingerX, fingerY + 20);
    
    // 外圈动画
    let pulseSize = 50 + sin(frameCount * 0.1) * 10;
    stroke(0, 255, 150, 100);
    strokeWeight(2);
    circle(fingerX, fingerY, pulseSize);
    pop();
  }
  
  updatePointing();
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
    drawingContext.shadowBlur = 35;
    drawingContext.shadowColor = 'rgba(0, 200, 100, 0.7)';
    strokeWeight(8);
    stroke(0, 220, 120);
    noFill();
    rect(selectedFlavor.x - 5, selectedFlavor.y - 5, 
         selectedFlavor.w + 10, selectedFlavor.h + 10, 12);
    pop();
    
    // 选择标签
    push();
    fill(0, 220, 120);
    noStroke();
    textSize(32);
    textStyle(BOLD);
    text('✓ Your Choice', selectedFlavor.x + selectedFlavor.w/2, selectedFlavor.y - 40);
    pop();
  }
  
  // 主标题 - 优化位置
  push();
  fill(100, 80, 60);
  noStroke();
  textAlign(CENTER);
  textSize(52);
  textStyle(BOLD);
  text('🍦', width/2, height * 0.08);
  
  textSize(38);
  text('Your Ice Cream Journey', width/2, height * 0.13);
  pop();
  
  // 统计数据
  let total = 0;
  let maxBox = boxes[0];
  for (let box of boxes) {
    total += box.time;
    if (box.time > maxBox.time) maxBox = box;
  }
  
  // 卡片式设计 - 优化位置避免遮挡
  let cardY = height * 0.2; // 从20%开始
  let cardGap = height * 0.09; // 动态间距
  
  // 确保卡片不会太靠下
  if (cardY + cardGap * 4 > height * 0.85) {
    cardGap = (height * 0.65) / 4;
  }
  
  // 卡片1：你的选择
  drawCard(width/2 - 260, cardY, 500, 65, 
           '💝 You chose', 
           selectedFlavor.name,
           color(255, 200, 200));
  
  // 卡片2：纠结时长
  drawCard(width/2 - 260, cardY + cardGap, 500, 65,
           '⏱️ Time spent thinking',
           (total / 1000).toFixed(1) + ' seconds',
           color(200, 220, 255));
  
  // 卡片3：最吸引你的
  if (maxBox.time > 0) {
    drawCard(width/2 - 260, cardY + cardGap * 2, 500, 65,
             '👀 You stared most at',
             maxBox.name + ' (' + (maxBox.time / 1000).toFixed(1) + 's)',
             color(255, 240, 200));
  }
  
  // 卡片4：改变主意
  if (abandoned.length > 0) {
    let uniqueAbandoned = [...new Set(abandoned)];
    drawCard(width/2 - 260, cardY + cardGap * 3, 500, 65,
             '🤔 You almost picked',
             uniqueAbandoned.join(', '),
             color(230, 200, 255));
  } else {
    drawCard(width/2 - 260, cardY + cardGap * 3, 500, 65,
             '🎯 Decision style',
             'Quick & Decisive!',
             color(200, 255, 200));
  }
  
  // 底部提示
  fill(120);
  noStroke();
  textAlign(CENTER);
  textSize(18);
  textStyle(NORMAL);
  text('Press S to save | Press C to try again', width/2, height - 50);
}

function drawCard(x, y, w, h, label, value, bgColor) {
  push();
  
  // 卡片阴影
  drawingContext.shadowBlur = 18;
  drawingContext.shadowColor = 'rgba(0, 0, 0, 0.15)';
  
  // 卡片背景
  fill(bgColor);
  noStroke();
  rect(x, y, w, h, 15);
  
  // 重置阴影
  drawingContext.shadowBlur = 0;
  
  // 标签
  fill(100, 80, 60);
  textAlign(LEFT);
  textSize(17);
  textStyle(NORMAL);
  text(label, x + 25, y + 24);
  
  // 值
  fill(50, 40, 30);
  textSize(22);
  textStyle(BOLD);
  text(value, x + 25, y + 48);
  
  pop();
}

function drawSaveMessage() {
  push();
  
  // 计算淡出效果
  let alpha = map(saveMessageTimer, 0, 120, 0, 255);
  
  // 背景
  fill(0, 200, 100, alpha * 0.9);
  noStroke();
  rectMode(CENTER);
  rect(width/2, 150, 350, 80, 15);
  
  // 文字
  fill(255, alpha);
  textAlign(CENTER, CENTER);
  textSize(26);
  textStyle(BOLD);
  text(saveMessage, width/2, 150);
  
  pop();
}

function keyPressed() {
  // C键：重置
  if (key === 'c' || key === 'C') {
    boxes.forEach(b => { b.time = 0; b.ready = false; });
    path = [];
    abandoned = [];
    current = null;
    hasSelected = false;
    selectedFlavor = null;
    okConfirmTimer = 0; // 改名
    saveMessage = '';
    saveMessageTimer = 0;
  }
  
  // S键：保存
  if ((key === 's' || key === 'S') && hasSelected) {
    saveCanvas('my-ice-cream-choice-' + Date.now(), 'png');
    
    // 显示保存成功消息
    saveMessage = '✓ Saved successfully!';
    saveMessageTimer = 120;
  } else if ((key === 's' || key === 'S') && !hasSelected) {
    // 用户还没选择就按了S键
    saveMessage = '⚠️ Make a choice first!';
    saveMessageTimer = 120;
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  boxes = [];
  setupBoxes();
}