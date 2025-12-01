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
let okConfirmTimer = 0;

// 保存反馈
let saveMessage = '';
let saveMessageTimer = 0;

// 加载进度
let loadingProgress = 0;
let totalAssets = 13;
let loadedAssets = 0;

// 初始化手指位置在屏幕中心
let lastFingerX = 0;
let lastFingerY = 0;

// 教程相关
let showTutorial = true;
let tutorialPage = 0;
let okHandImg;
let pointHandImg;

const names = ['Strawberry', 'Chocolate', 'Mango', 'Mint', 'Lemon',
               'Pistachio', 'Raspberry', 'Hazelnut', 'Coconut', 'Vanilla'];

const files = ['strawberry.png', 'chocolate.png', 'mango.png', 'mint.png', 'lemon.png',
               'pistachio.png', 'raspberry.png', 'hazelnut.png', 'coconut.png', 'vanilla.png'];

const READY_THRESHOLD = 3000;

function preload() {
  console.log('开始加载...');
  
  for (let i = 0; i < files.length; i++) {
    loadImage(files[i], 
      (img) => {
        imgs.push(img);
        loadedAssets++;
        updateLoadingProgress();
      },
      () => {
        console.error(`加载失败: ${files[i]}`);
        imgs.push(createImage(100, 100));
        loadedAssets++;
        updateLoadingProgress();
      }
    );
  }
  
  loadImage('ok-hand.png', 
    (img) => {
      okHandImg = img;
      loadedAssets++;
      updateLoadingProgress();
    },
    () => {
      console.error('OK手势图加载失败');
      loadedAssets++;
      updateLoadingProgress();
    }
  );
  
  loadImage('point-hand.png', 
    (img) => {
      pointHandImg = img;
      loadedAssets++;
      updateLoadingProgress();
    },
    () => {
      console.error('指向手势图加载失败');
      loadedAssets++;
      updateLoadingProgress();
    }
  );
  
  handPose = ml5.handPose(() => {
    loadedAssets++;
    updateLoadingProgress();
  });
}

function updateLoadingProgress() {
  loadingProgress = Math.floor((loadedAssets / totalAssets) * 100);
  
  let progressText = document.getElementById('progress-text');
  let progressBar = document.getElementById('progress-bar');
  
  if (progressText) {
    progressText.textContent = loadingProgress + '%';
  }
  
  if (progressBar) {
    progressBar.style.width = loadingProgress + '%';
  }
}

function setup() {
  createCanvas(windowWidth, windowHeight);
  
  fingerX = width / 2;
  fingerY = height / 2;
  lastFingerX = fingerX;
  lastFingerY = fingerY;
  
  let checkLoading = setInterval(() => {
    if (loadedAssets >= totalAssets) {
      clearInterval(checkLoading);
      initApp();
    }
  }, 100);
  
  textAlign(CENTER, CENTER);
  frameRate(60);
}

function initApp() {
  setupBoxes();
  
  video = createCapture(VIDEO);
  video.size(640, 480);
  video.hide();
  
  setTimeout(() => {
    let videoElement = document.getElementById('webcam');
    if (videoElement && video.elt.srcObject) {
      videoElement.srcObject = video.elt.srcObject;
    }
    
    if (handPose && video) {
      handPose.detectStart(video, gotHands);
    }
    
    setTimeout(() => {
      let loadingScreen = document.getElementById('loading-screen');
      if (loadingScreen) {
        loadingScreen.style.opacity = '0';
        setTimeout(() => {
          loadingScreen.style.display = 'none';
          showTutorial = true;
        }, 500);
      }
    }, 300);
  }, 500);
}

function setupBoxes() {
  let baseW = width * 0.15;
  let baseH = height * 0.32;
  let gap = width * 0.03;
  
  let startX = (width - (baseW * 5 + gap * 4)) / 2;
  let startY = height * 0.2;
  
  for (let i = 0; i < 10; i++) {
    let col = i % 5;
    let row = floor(i / 5);
    boxes.push({
      x: startX + col * (baseW + gap),
      y: startY + row * (baseH + gap),
      baseW: baseW,
      baseH: baseH,
      w: baseW,
      h: baseH,
      baseX: startX + col * (baseW + gap),
      baseY: startY + row * (baseH + gap),
      name: names[i],
      img: imgs[i],
      time: 0,
      ready: false,
      maxScale: 1.0
    });
  }
}

function gotHands(results) {
  hands = results;
}

function draw() {
  background(248, 250, 252);
  
  if (showTutorial) {
    drawTutorial();
    return;
  }
  
  updateFingerPosition();
  
  if (!hasSelected) {
    updateBoxSizes();
    drawSelection();
    checkOKGesture();
  } else {
    drawBeautifulReport();
  }
  
  if (saveMessageTimer > 0) {
    drawSaveMessage();
    saveMessageTimer--;
  }
}

// ✅ 简洁清爽的教程页面
function drawTutorial() {
  // 纯色背景
  background(245, 238, 228);
  
  push();
  
  // 左侧图片区域
  let leftX = width * 0.3;
  let centerY = height * 0.5;
  
  if (tutorialPage === 0) {
    // 第一页：指向手势
    
    // 左侧：图片
    if (pointHandImg) {
      let imgW = min(width * 0.28, 350);
      let imgH = imgW * (pointHandImg.height / pointHandImg.width);
      
      imageMode(CENTER);
      image(pointHandImg, leftX, centerY, imgW, imgH);
    }
    
    // 右侧：文字内容
    let rightX = width * 0.58;
    
    // Step标签
    fill(200, 140, 90);
    textAlign(LEFT, CENTER);
    textSize(20);
    textStyle(NORMAL);
    text('STEP 1', rightX, height * 0.32);
    
    // 主标题
    fill(70, 60, 50);
    textSize(48);
    textStyle(BOLD);
    text('Point to Select', rightX, height * 0.41);
    
    // 说明1
    fill(100, 85, 70);
    textSize(24);
    textStyle(NORMAL);
    text('Point your finger 👆 at your', rightX, height * 0.52);
    text('favorite ice cream', rightX, height * 0.57);
    
    // 说明2
    fill(120, 100, 85);
    textSize(20);
    text('Hold for 3 seconds to get ready', rightX, height * 0.65);
    
  } else {
    // 第二页：OK手势
    
    // 左侧：图片
    if (okHandImg) {
      let imgW = min(width * 0.28, 350);
      let imgH = imgW * (okHandImg.height / okHandImg.width);
      
      imageMode(CENTER);
      image(okHandImg, leftX, centerY, imgW, imgH);
    }
    
    // 右侧：文字内容
    let rightX = width * 0.58;
    
    // Step标签
    fill(200, 140, 90);
    textAlign(LEFT, CENTER);
    textSize(20);
    textStyle(NORMAL);
    text('STEP 2', rightX, height * 0.32);
    
    // 主标题
    fill(70, 60, 50);
    textSize(48);
    textStyle(BOLD);
    text('Confirm with OK', rightX, height * 0.41);
    
    // 说明1
    fill(100, 85, 70);
    textSize(24);
    textStyle(NORMAL);
    text('Make OK sign 👌 to confirm', rightX, height * 0.52);
    text('your choice', rightX, height * 0.57);
    
    // 说明2
    fill(120, 100, 85);
    textSize(20);
    text('You can confirm anytime!', rightX, height * 0.65);
  }
  
  // 底部按钮
  let btnW = 260;
  let btnH = 65;
  let btnX = width/2 - btnW/2;
  let btnY = height * 0.85;
  
  // 按钮
  fill(210, 140, 90);
  noStroke();
  rect(btnX, btnY, btnW, btnH, 33);
  
  // 按钮文字
  fill(255);
  textAlign(CENTER, CENTER);
  textSize(26);
  textStyle(BOLD);
  text('Click to Continue', width/2, btnY + btnH/2);
  
  // 页面指示器
  let dotY = height * 0.94;
  let dotGap = 18;
  noStroke();
  for (let i = 0; i < 2; i++) {
    if (i === tutorialPage) {
      fill(210, 140, 90);
      circle(width/2 - dotGap/2 + i * dotGap, dotY, 12);
    } else {
      fill(180, 140, 110, 100);
      circle(width/2 - dotGap/2 + i * dotGap, dotY, 9);
    }
  }
  
  pop();
}

function updateBoxSizes() {
  let maxTime = 0;
  for (let box of boxes) {
    if (box.time > maxTime) maxTime = box.time;
  }
  
  for (let box of boxes) {
    let targetScale = 1.0;
    
    if (maxTime > 0) {
      let timeRatio = box.time / maxTime;
      targetScale = 1.0 + (timeRatio * 0.3);
    }
    
    if (targetScale > box.maxScale) {
      box.maxScale = targetScale;
    }
    
    let currentScale = box.w / box.baseW;
    let newScale = lerp(currentScale, box.maxScale, 0.03);
    
    box.w = box.baseW * newScale;
    box.h = box.baseH * newScale;
    box.x = box.baseX + (box.baseW - box.w) / 2;
    box.y = box.baseY + (box.baseH - box.h) / 2;
  }
}

function updateFingerPosition() {
  if (hands.length > 0) {
    let hand = hands[0];
    let indexTip = hand.keypoints[8];
    fingerX = map(indexTip.x, 0, 640, width, 0);
    fingerY = map(indexTip.y, 0, 480, 0, height);
    
    lastFingerX = fingerX;
    lastFingerY = fingerY;
  } else {
    fingerX = lastFingerX;
    fingerY = lastFingerY;
  }
}

function checkOKGesture() {
  if (hands.length === 0 || !current) {
    okConfirmTimer = 0;
    return;
  }
  
  let hand = hands[0];
  
  let thumb = hand.keypoints[4];
  let index = hand.keypoints[8];
  let middle = hand.keypoints[12];
  let ring = hand.keypoints[16];
  let pinky = hand.keypoints[20];
  let wrist = hand.keypoints[0];
  
  let thumbIndexDist = dist(thumb.x, thumb.y, index.x, index.y);
  let middleDist = dist(middle.x, middle.y, wrist.x, wrist.y);
  let ringDist = dist(ring.x, ring.y, wrist.x, wrist.y);
  let pinkyDist = dist(pinky.x, pinky.y, wrist.x, wrist.y);
  
  let isOK = thumbIndexDist < 60 && 
             middleDist > 100 && 
             ringDist > 90 && 
             pinkyDist > 80;
  
  if (isOK) {
    okConfirmTimer++;
    
    push();
    fill(255, 200, 0, 200);
    noStroke();
    rectMode(CENTER);
    rect(width/2, height - 100, 280, 100, 20);
    
    fill(255);
    textSize(56);
    textStyle(BOLD);
    text('👌', width/2, height - 120);
    
    textSize(24);
    fill(255);
    let dots = '.'.repeat((okConfirmTimer / 10) % 4);
    text('Confirming' + dots, width/2, height - 60);
    
    let progress = constrain(okConfirmTimer / 60, 0, 1);
    fill(255, 255, 255, 80);
    rectMode(CORNER);
    rect(width/2 - 100, height - 30, 200, 6, 3);
    fill(255);
    rect(width/2 - 100, height - 30, 200 * progress, 6, 3);
    
    pop();
    
    if (okConfirmTimer > 60) {
      confirmSelection();
    }
  } else {
    okConfirmTimer = 0;
  }
}

function drawSelection() {
  push();
  fill(255, 255, 255, 230);
  noStroke();
  rect(0, 0, width, height * 0.16);
  
  fill(80, 100, 140);
  textAlign(CENTER, CENTER);
  textSize(40);
  textStyle(BOLD);
  text('🍦 Point at Your Favorite Ice Cream', width/2, height * 0.065);
  
  textSize(16);
  textStyle(NORMAL);
  fill(120, 140, 180);
  let status = hands.length > 0 ? '✓ Hand detected' : '👆 Show your hand';
  text(status + ' • Hold 3s for Ready • 👌 OK anytime', width/2, height * 0.115);
  pop();
  
  for (let box of boxes) {
    push();
    
    if (current === box) {
      drawingContext.shadowBlur = 12;
      drawingContext.shadowColor = 'rgba(100, 150, 255, 0.3)';
    }
    
    image(box.img, box.x, box.y, box.w, box.h);
    drawingContext.shadowBlur = 0;
    
    if (box.ready) {
      fill(255, 200, 100, 200);
      noStroke();
      rect(box.x, box.y, box.w, box.h);
      
      fill(255);
      stroke(80, 60, 40);
      strokeWeight(2);
      let textSize1 = map(box.w, box.baseW, box.baseW * 1.3, 20, 26);
      textSize(textSize1);
      textStyle(BOLD);
      text('Ready!', box.x + box.w/2, box.y + box.h/2 - 12);
      
      let textSize2 = map(box.w, box.baseW, box.baseW * 1.3, 14, 18);
      textSize(textSize2);
      text('👌 OK', box.x + box.w/2, box.y + box.h/2 + 12);
      
      noFill();
      stroke(255, 200, 100);
      strokeWeight(4);
      rect(box.x - 2, box.y - 2, box.w + 4, box.h + 4);
    }
    else if (current === box) {
      noFill();
      stroke(100, 150, 255);
      strokeWeight(3);
      rect(box.x - 2, box.y - 2, box.w + 4, box.h + 4);
    }
    
    pop();
  }
  
  if (path.length > 1) {
    stroke(255, 120, 150, 120);
    strokeWeight(2);
    noFill();
    beginShape();
    for (let i = max(0, path.length - 30); i < path.length; i++) {
      vertex(path[i].x, path[i].y);
    }
    if (current && hands.length > 0) vertex(fingerX, fingerY);
    endShape();
  }
  
  push();
  textAlign(CENTER, CENTER);
  textSize(45);
  
  drawingContext.shadowBlur = 10;
  drawingContext.shadowColor = 'rgba(0, 0, 0, 0.4)';
  drawingContext.shadowOffsetX = 2;
  drawingContext.shadowOffsetY = 2;
  
  if (hands.length > 0) {
    fill(255, 255, 255, 255);
  } else {
    fill(255, 255, 255, 150);
  }
  
  text('👆', fingerX, fingerY - 22);
  
  pop();
  
  updatePointing();
}

function updatePointing() {
  if (hands.length === 0) {
    current = null;
    return;
  }
  
  let found = null;
  
  for (let box of boxes) {
    if (fingerX > box.baseX && fingerX < box.baseX + box.baseW && 
        fingerY > box.baseY && fingerY < box.baseY + box.baseH) {
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
  if (current && !hasSelected) {
    selectedFlavor = current;
    hasSelected = true;
  }
}

function drawBeautifulReport() {
  for (let i = 0; i < height; i++) {
    let inter = map(i, 0, height, 0, 1);
    let c = lerpColor(color(252, 248, 245), color(245, 250, 252), inter);
    stroke(c);
    line(0, i, width, i);
  }
  
  for (let box of boxes) {
    push();
    tint(255, box === selectedFlavor ? 255 : 45);
    image(box.img, box.x, box.y, box.w, box.h);
    pop();
  }
  
  if (selectedFlavor) {
    push();
    drawingContext.shadowBlur = 30;
    drawingContext.shadowColor = 'rgba(255, 180, 100, 0.6)';
    strokeWeight(7);
    stroke(255, 190, 120);
    noFill();
    rect(selectedFlavor.x - 6, selectedFlavor.y - 6, 
         selectedFlavor.w + 12, selectedFlavor.h + 12);
    pop();
    
    push();
    fill(255, 160, 90);
    noStroke();
    textSize(32);
    textStyle(BOLD);
    text('✓ Your Choice', selectedFlavor.x + selectedFlavor.w/2, 
         selectedFlavor.y - 45);
    pop();
  }
  
  push();
  fill(100, 85, 75);
  noStroke();
  textAlign(CENTER);
  textSize(56);
  textStyle(BOLD);
  text('🍦', width/2, height * 0.06);
  
  textSize(38);
  text('Your Ice Cream Journey', width/2, height * 0.115);
  pop();
  
  let total = 0;
  let maxBox = boxes[0];
  for (let box of boxes) {
    total += box.time;
    if (box.time > maxBox.time) maxBox = box;
  }
  
  let cardW = min(width * 0.42, 550);
  let cardH = 85;
  let cardX = (width - cardW) / 2;
  let cardY = height * 0.18;
  let cardGap = height * 0.11;
  
  drawCard(cardX, cardY, cardW, cardH, 
           '💝 You chose', 
           selectedFlavor.name,
           color(255, 235, 235),
           color(220, 100, 100));
  
  drawCard(cardX, cardY + cardGap, cardW, cardH,
           '⏱️ Time spent',
           (total / 1000).toFixed(1) + ' seconds',
           color(235, 242, 255),
           color(100, 130, 200));
  
  if (maxBox.time > 0) {
    drawCard(cardX, cardY + cardGap * 2, cardW, cardH,
             '👀 Most stared',
             maxBox.name + ' (' + (maxBox.time / 1000).toFixed(1) + 's)',
             color(255, 248, 235),
             color(200, 150, 80));
  }
  
  if (abandoned.length > 0) {
    let uniqueAbandoned = [...new Set(abandoned)];
    drawCard(cardX, cardY + cardGap * 3, cardW, cardH,
             '🤔 Almost picked',
             uniqueAbandoned.join(', '),
             color(245, 240, 255),
             color(150, 120, 200));
  } else {
    drawCard(cardX, cardY + cardGap * 3, cardW, cardH,
             '🎯 Decision style',
             'Quick & Decisive!',
             color(240, 255, 245),
             color(100, 180, 120));
  }
  
  fill(120, 120, 130);
  noStroke();
  textAlign(CENTER);
  textSize(18);
  textStyle(NORMAL);
  text('Press S to save | Press C to try again', width/2, height - 60);
}

function drawCard(x, y, w, h, label, value, bgColor, textColor) {
  push();
  
  drawingContext.shadowBlur = 18;
  drawingContext.shadowColor = 'rgba(0, 0, 0, 0.08)';
  
  fill(bgColor);
  noStroke();
  rect(x, y, w, h, 16);
  
  drawingContext.shadowBlur = 0;
  
  let labelColor = color(red(textColor) + 40, green(textColor) + 40, blue(textColor) + 40);
  fill(labelColor);
  textAlign(LEFT);
  textSize(17);
  textStyle(NORMAL);
  text(label, x + 30, y + 28);
  
  fill(textColor);
  textSize(24);
  textStyle(BOLD);
  text(value, x + 30, y + 58);
  
  pop();
}

function drawSaveMessage() {
  push();
  let alpha = map(saveMessageTimer, 0, 120, 0, 255);
  
  fill(100, 180, 120, alpha * 0.95);
  noStroke();
  rectMode(CENTER);
  rect(width/2, 150, 360, 90, 20);
  
  fill(255, alpha);
  textAlign(CENTER, CENTER);
  textSize(28);
  textStyle(BOLD);
  text(saveMessage, width/2, 150);
  
  pop();
}

function mouseClicked() {
  if (showTutorial) {
    if (tutorialPage === 0) {
      tutorialPage = 1;
    } else {
      showTutorial = false;
    }
  }
}

function keyPressed() {
  if (showTutorial) {
    if (keyCode === RIGHT_ARROW || key === ' ') {
      if (tutorialPage === 0) {
        tutorialPage = 1;
      } else {
        showTutorial = false;
      }
    } else if (keyCode === LEFT_ARROW) {
      if (tutorialPage === 1) {
        tutorialPage = 0;
      }
    }
    return;
  }
  
  if (key === 'c' || key === 'C') {
    boxes.forEach(b => { 
      b.time = 0; 
      b.ready = false;
      b.w = b.baseW;
      b.h = b.baseH;
      b.x = b.baseX;
      b.y = b.baseY;
      b.maxScale = 1.0;
    });
    path = [];
    abandoned = [];
    current = null;
    hasSelected = false;
    selectedFlavor = null;
    okConfirmTimer = 0;
    saveMessage = '';
    saveMessageTimer = 0;
  }
  
  if ((key === 's' || key === 'S') && hasSelected) {
    saveCanvas('my-ice-cream-choice-' + Date.now(), 'png');
    saveMessage = '✓ Saved Successfully!';
    saveMessageTimer = 120;
  } else if ((key === 's' || key === 'S') && !hasSelected) {
    saveMessage = '⚠️ Make a choice first!';
    saveMessageTimer = 120;
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  boxes = [];
  setupBoxes();
}