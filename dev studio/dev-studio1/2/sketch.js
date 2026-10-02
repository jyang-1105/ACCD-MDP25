let imgs = [];
let boxes = [];
let selectedFlavor = null;
let hasSelected = false;

const names = ['Strawberry', 'Chocolate', 'Mango', 'Mint', 'Lemon',
               'Pistachio', 'Raspberry', 'Hazelnut', 'Coconut', 'Vanilla'];

const files = ['strawberry.png', 'chocolate.png', 'mango.png', 'mint.png', 'lemon.png',
               'pistachio.png', 'raspberry.png', 'hazelnut.png', 'coconut.png', 'vanilla.png'];

function preload() {
  for (let f of files) imgs.push(loadImage(f));
}

function setup() {
  createCanvas(windowWidth, windowHeight);
  
  // 创建10个盒子 (2行5列)
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
      hover: false
    });
  }
  
  textAlign(CENTER, CENTER);
}

function draw() {
  background(245);
  
  // 如果还没选择，正常显示
  if (!hasSelected) {
    drawSelection();
  } else {
    drawConfirmation();
  }
}

function drawSelection() {
  // 检测鼠标悬停
  for (let box of boxes) {
    box.hover = mouseX > box.x && mouseX < box.x + box.w &&
                mouseY > box.y && mouseY < box.y + box.h;
  }
  
  // 画所有图片
  for (let box of boxes) {
    image(box.img, box.x, box.y, box.w, box.h);
    
    // 悬停效果
    if (box.hover) {
      strokeWeight(6);
      stroke(255, 180, 0);
      noFill();
      rect(box.x, box.y, box.w, box.h);
      
      // 显示名字
      fill(255, 180, 0);
      stroke(0);
      strokeWeight(4);
      textSize(24);
      textStyle(BOLD);
      text(box.name, box.x + box.w/2, box.y + box.h/2);
    }
  }
  
  // 说明文字
  fill(0);
  noStroke();
  textAlign(CENTER);
  textSize(28);
  textStyle(BOLD);
  text('Choose Your Favorite Ice Cream Flavor', width/2, 60);
  
  textSize(18);
  textStyle(NORMAL);
  text('Browse naturally and click on your choice', width/2, 95);
  
  // 底部提示
  textSize(14);
  fill(100);
  text('Hover to preview | Click to select', width/2, height - 30);
}

function drawConfirmation() {
  // 画所有图片（半透明）
  for (let box of boxes) {
    tint(255, box === selectedFlavor ? 255 : 100);
    image(box.img, box.x, box.y, box.w, box.h);
  }
  noTint();
  
  // 高亮选中的
  if (selectedFlavor) {
    strokeWeight(12);
    stroke(0, 255, 0);
    noFill();
    rect(selectedFlavor.x - 6, selectedFlavor.y - 6, 
         selectedFlavor.w + 12, selectedFlavor.h + 12);
    
    // 显示选择文字
    fill(0, 255, 0);
    stroke(0);
    strokeWeight(6);
    textAlign(CENTER);
    textSize(36);
    textStyle(BOLD);
    text('YOU CHOSE', selectedFlavor.x + selectedFlavor.w/2, selectedFlavor.y - 40);
    text(selectedFlavor.name + '!', selectedFlavor.x + selectedFlavor.w/2, 
         selectedFlavor.y + selectedFlavor.h + 50);
  }
  
  // 感谢信息
  fill(0);
  noStroke();
  textAlign(CENTER);
  textSize(24);
  textStyle(NORMAL);
  text('Thank you for participating!', width/2, height - 60);
  textSize(16);
  text('Your eye tracking data has been recorded.', width/2, height - 30);
}

function mousePressed() {
  if (!hasSelected) {
    // 检查点击了哪个盒子
    for (let box of boxes) {
      if (box.hover) {
        selectedFlavor = box;
        hasSelected = true;
        console.log('Selected:', box.name);
        
        // 通知 GazeRecorder 任务完成（如果有的话）
        if (typeof GazeCloudAPI !== 'undefined') {
          GazeCloudAPI.OnResult();
        }
        break;
      }
    }
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  
  // 重新计算布局
  let w = width * 0.18;
  let h = height * 0.4;
  let gap = width * 0.02;
  let startX = (width - (w * 5 + gap * 4)) / 2;
  let startY = (height - (h * 2 + gap)) / 2;
  
  for (let i = 0; i < boxes.length; i++) {
    let col = i % 5;
    let row = floor(i / 5);
    boxes[i].x = startX + col * (w + gap);
    boxes[i].y = startY + row * (h + gap);
    boxes[i].w = w;
    boxes[i].h = h;
  }
}