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

// ✅ 加载进度
let loadingProgress = 0;
let totalAssets = 11;
let loadedAssets = 0;

const names = ['Strawberry', 'Chocolate', 'Mango', 'Mint', 'Lemon',
               'Pistachio', 'Raspberry', 'Hazelnut', 'Coconut', 'Vanilla'];

const files = ['strawberry.png', 'chocolate.png', 'mango.png', 'mint.png', 'lemon.png',
               'pistachio.png', 'raspberry.png', 'hazelnut.png', 'coconut.png', 'vanilla.png'];

const READY_THRESHOLD = 3000; // ✅ 恢复3秒，用于显示Ready

function preload() {
  console.log('开始加载...');
  
  for (let i = 0; i < files.length; i++) {
    loadImage(files[i], 
      (img) => {
        imgs.push(img);
        loadedAssets++;
        updateLoadingProgress();
        console.log(`加载完成: ${files[i]} (${loadedAssets}/${totalAssets})`);
      },
      () => {
        console.error(`加载失败: ${files[i]}`);
        imgs.push(createImage(100, 100));
        loadedAssets++;
        updateLoadingProgress();
      }
    );
  }
  
  handPose = ml5.handPose(() => {
    loadedAssets++;
    updateLoadingProgress();
    console.log('HandPose模型加载完成!');
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
  
  console.log(`加载进度: ${loadingProgress}%`);
}

function setup() {
  createCanvas(windowWidth, windowHeight);
  
  let checkLoading = setInterval(() => {
    if (loadedAssets >= totalAssets) {
      clearInterval(checkLoading);
      initApp();
    }
  }, 100);
  
  textAlign(CENTER, CENTER);
}

function initApp() {
  console.log('初始化应用...');
  
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
        }, 500);
      }
    }, 300);
  }, 500);
}

function setupBoxes() {
  let w = width * 0.16;
  let h = height * 0.35;
  let gap = width * 0.025;
  
  let startX = (width - (w * 5 + gap * 4)) / 2;
  let startY = height * 0.18;
  
  let totalHeight = h * 2 + gap;
  if (startY + totalHeight > height * 0.85) {
    startY = height * 0.15;
    h = (height * 0.7 - gap) / 2;
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
    checkOKGesture(); // ✅ 随时检测OK手势
  } else {
    drawBeautifulReport();
  }
  
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

// ✅ OK手势检测 - 不需要Ready状态，随时可以确认
function checkOKGesture() {
  // ✅ 只要有current就可以OK确认，不需要ready状态
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
    fill(255, 200, 0);
    noStroke();
    textSize(56);
    textStyle(BOLD);
    text('👌', width/2, height - 130);
    
    textSize(26);
    let dots = '.'.repeat((okConfirmTimer / 10) % 4);
    text('Confirming' + dots, width/2, height - 70);
    
    let progress = constrain(okConfirmTimer / 60, 0, 1);
    fill(255, 200, 0, 100);
    rect(width/2 - 100, height - 35, 200, 8, 4);
    fill(255, 200, 0);
    rect(width/2 - 100, height - 35, 200 * progress, 8, 4);
    
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
  fill(100, 150, 200, 30);
  noStroke();
  rect(0, 0, width, height * 0.15);
  
  fill(50, 80, 120);
  textAlign(CENTER, CENTER);
  textSize(36);
  textStyle(BOLD);
  text('🍦 Point at Your Favorite Ice Cream', width/2, height * 0.06);
  
  textSize(16);
  textStyle(NORMAL);
  fill(80, 110, 150);
  let status = hands.length > 0 ? '👆 Hand detected ✓' : '👆 Show your hand';
  text(status + ' | Hold 3s for Ready | 👌 OK anytime to confirm', width/2, height * 0.11);
  pop();
  
  for (let box of boxes) {
    push();
    
    if (current === box) {
      drawingContext.shadowBlur = 15;
      drawingContext.shadowColor = 'rgba(100, 150, 255, 0.4)';
    }
    
    image(box.img, box.x, box.y, box.w, box.h);
    drawingContext.shadowBlur = 0;
    
    // ✅ 只有Ready的时候才显示Ready提示
    if (box.ready) {
      fill(255, 180, 0, 180);
      noStroke();
      rect(box.x, box.y, box.w, box.h);
      
      fill(255);
      stroke(0);
      strokeWeight(2);
      textSize(22);
      textStyle(BOLD);
      text('Ready!', box.x + box.w/2, box.y + box.h/2 - 12);
      
      textSize(16);
      text('👌 OK to confirm', box.x + box.w/2, box.y + box.h/2 + 12);
      
      noFill();
      stroke(255, 180, 0);
      strokeWeight(4);
      rect(box.x - 2, box.y - 2, box.w + 4, box.h + 4, 6);
    }
    // ✅ 如果是current但还没ready，显示简单的高亮边框
    else if (current === box) {
      noFill();
      stroke(100, 150, 255);
      strokeWeight(3);
      rect(box.x - 2, box.y - 2, box.w + 4, box.h + 4, 6);
    }
    
    pop();
  }
  
  if (path.length > 1) {
    stroke(255, 100, 150, 150);
    strokeWeight(3);
    noFill();
    beginShape();
    for (let p of path) vertex(p.x, p.y);
    if (current && hands.length > 0) vertex(fingerX, fingerY);
    endShape();
  }
  
  if (hands.length > 0) {
    noFill();
    stroke(0, 255, 150);
    strokeWeight(4);
    circle(fingerX, fingerY, 40);
    
    stroke(0, 255, 150);
    strokeWeight(2);
    line(fingerX - 15, fingerY, fingerX + 15, fingerY);
    line(fingerX, fingerY - 15, fingerX, fingerY + 15);
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
      // ✅ 继续累积时间
      current.time += deltaTime;
      // ✅ 满3秒才设置ready为true
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

// ✅ 确认选择 - 不需要检查ready状态
function confirmSelection() {
  if (current && !hasSelected) {
    selectedFlavor = current;
    hasSelected = true;
    console.log('Selected:', selectedFlavor.name);
  }
}

function drawBeautifulReport() {
  background(250, 248, 245);
  
  for (let box of boxes) {
    tint(255, box === selectedFlavor ? 255 : 60);
    image(box.img, box.x, box.y, box.w, box.h);
  }
  noTint();
  
  if (selectedFlavor) {
    push();
    drawingContext.shadowBlur = 25;
    drawingContext.shadowColor = 'rgba(0, 200, 100, 0.6)';
    strokeWeight(6);
    stroke(0, 220, 120);
    noFill();
    rect(selectedFlavor.x - 4, selectedFlavor.y - 4, 
         selectedFlavor.w + 8, selectedFlavor.h + 8, 10);
    pop();
    
    push();
    fill(0, 220, 120);
    noStroke();
    textSize(28);
    textStyle(BOLD);
    text('✓ Your Choice', selectedFlavor.x + selectedFlavor.w/2, selectedFlavor.y - 35);
    pop();
  }
  
  push();
  fill(100, 80, 60);
  noStroke();
  textAlign(CENTER);
  textSize(48);
  textStyle(BOLD);
  text('🍦', width/2, height * 0.08);
  
  textSize(34);
  text('Your Ice Cream Journey', width/2, height * 0.13);
  pop();
  
  let total = 0;
  let maxBox = boxes[0];
  for (let box of boxes) {
    total += box.time;
    if (box.time > maxBox.time) maxBox = box;
  }
  
  let cardY = height * 0.2;
  let cardGap = height * 0.09;
  
  drawCard(width/2 - 240, cardY, 480, 60, 
           '💝 You chose', 
           selectedFlavor.name,
           color(255, 200, 200));
  
  drawCard(width/2 - 240, cardY + cardGap, 480, 60,
           '⏱️ Time spent',
           (total / 1000).toFixed(1) + ' seconds',
           color(200, 220, 255));
  
  if (maxBox.time > 0) {
    drawCard(width/2 - 240, cardY + cardGap * 2, 480, 60,
             '👀 You stared at',
             maxBox.name + ' (' + (maxBox.time / 1000).toFixed(1) + 's)',
             color(255, 240, 200));
  }
  
  if (abandoned.length > 0) {
    let uniqueAbandoned = [...new Set(abandoned)];
    drawCard(width/2 - 240, cardY + cardGap * 3, 480, 60,
             '🤔 Almost picked',
             uniqueAbandoned.join(', '),
             color(230, 200, 255));
  } else {
    drawCard(width/2 - 240, cardY + cardGap * 3, 480, 60,
             '🎯 Decision',
             'Quick & Decisive!',
             color(200, 255, 200));
  }
  
  fill(120);
  noStroke();
  textAlign(CENTER);
  textSize(16);
  text('Press S to save | Press C to try again', width/2, height - 50);
}

function drawCard(x, y, w, h, label, value, bgColor) {
  push();
  
  drawingContext.shadowBlur = 12;
  drawingContext.shadowColor = 'rgba(0, 0, 0, 0.1)';
  
  fill(bgColor);
  noStroke();
  rect(x, y, w, h, 12);
  
  drawingContext.shadowBlur = 0;
  
  fill(80, 60, 50);
  textAlign(LEFT);
  textSize(15);
  textStyle(NORMAL);
  text(label, x + 20, y + 22);
  
  fill(40, 30, 20);
  textSize(20);
  textStyle(BOLD);
  text(value, x + 20, y + 45);
  
  pop();
}

function drawSaveMessage() {
  push();
  let alpha = map(saveMessageTimer, 0, 120, 0, 255);
  
  fill(0, 200, 100, alpha * 0.9);
  noStroke();
  rectMode(CENTER);
  rect(width/2, 150, 320, 70, 12);
  
  fill(255, alpha);
  textAlign(CENTER, CENTER);
  textSize(24);
  textStyle(BOLD);
  text(saveMessage, width/2, 150);
  
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
    okConfirmTimer = 0;
    saveMessage = '';
    saveMessageTimer = 0;
  }
  
  if ((key === 's' || key === 'S') && hasSelected) {
    saveCanvas('my-ice-cream-choice-' + Date.now(), 'png');
    saveMessage = '✓ Saved!';
    saveMessageTimer = 120;
  } else if ((key === 's' || key === 'S') && !hasSelected) {
    saveMessage = '⚠️ Choose first!';
    saveMessageTimer = 120;
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  boxes = [];
  setupBoxes();
}