// 🎨 ICE CREAM SELECTOR WITH AUDIO - Simple 3-Sound Version
let canStart = false;
window.startP5 = function() { canStart = true; };

let imgs = [], boxes = [], video, handPose, hands = [];
let fingerX = 0, fingerY = 0, path = [], current = null, startTime = 0, abandoned = [];
let selectedFlavor = null, hasSelected = false, totalViewTime = 0, switchCount = 0, viewedAll = false;
let okConfirmTimer = 0;
let saveMessage = '', saveMessageTimer = 0;
let loadingProgress = 0, totalAssets = 13, loadedAssets = 0;
let lastFingerX = 0, lastFingerY = 0;

let showTutorial = true;
let tutorialPage = 0;
let pointHandImg, okHandImg;
let tutorialGestureTimer = 0;

let showBuffer = false, bufferTimer = 0;
const BUFFER_DURATION = 180;
let confetti = [], bubbles = [], promptBubbles = [];

let funParticles = [];
let flavorEmojis = ['🍓', '🍫', '🥭', '🌿', '🍋', '🥜', '🫐', '🌰', '🥥', '🌼'];
let reactionEmojis = ['😍', '🤤', '😋', '🥳', '✨', '💖', '🌟', '🎉', '👑', '💯'];
let floatingEmojis = [];
let iceCreamFacts = [];

// 🔊 AUDIO VARIABLES - Simple 3-Sound System
let bgMusic;              // 1. 整体背景音乐（贯穿全程）
let startSound;           // 2. 点击Start的音效
let successSound;         // 3. 选择成功的音效
let isMuted = false;
let bgMusicVolume = 0.2;  // 背景音乐小声（20%）
let sfxVolume = 0.6;      // 音效正常音量（60%）

// 🎭 渐进式提示系统 - 从温柔到催促
const prompts = {
  // 0-10秒：温柔鼓励
  gentle: [
    "Take your time~ 😊",
    "No rush at all! 💙",
    "Explore freely~ ✨",
    "They all look great! 🍦",
    "Enjoy the moment~ 🌸",
    "Feel the vibes! 💫",
    "So many good choices~ 🎨",
    "Find your favorite! 💖"
  ],
  
  // 10-20秒：友好提醒
  friendly: [
    "Still looking? 👀",
    "Getting closer? 🤔",
    "Found a favorite yet? 💭",
    "Any standing out? 🌟",
    "Tough choice, huh? 😊",
    "Take your time! ⏰",
    "Which one calls to you? 💫",
    "Trust your instinct! ✨"
  ],
  
  // 20-30秒：温和催促
  nudge: [
    "Maybe this one? 👉",
    "How about deciding soon? 😅",
    "Getting hungry here! 🍦",
    "Pick your champion! 🏆",
    "Time's ticking... ⏱️",
    "Make a move! 🎯",
    "Just choose one! 😄",
    "Go with your gut! 💪"
  ],
  
  // 30-45秒：幽默催促
  playfulPush: [
    "Still thinking?! 🤯",
    "It's just ice cream! 😂",
    "Plot twist: pick one! 🎬",
    "Any day now... 😅",
    "The ice cream's melting! 🫠",
    "Flip a coin? 🪙",
    "Close your eyes and pick! 🙈",
    "They're all good, promise! 💯"
  ],
  
  // 45秒+：搞笑催促
  urgentFunny: [
    "JUST PICK ONE! 😱",
    "It's been 84 years... 👴",
    "Are you okay?! 🆘",
    "This is intense! 🔥",
    "Philosophy class? 🧠",
    "Need a consultant? 📞",
    "Eeny meeny miny moe? 🎲",
    "The universe is waiting! 🌌",
    "YOLO - pick something! 🚀"
  ],
  
  // 切换特殊提示（任何时候切换>3次）
  switching: [
    "Changed your mind! 😄",
    "Exploring mode! 🔍",
    "Window shopping! 🪟",
    "Can't decide? 🦋",
    "Ooh, another one! 👀",
    "So indecisive! 💭",
    "They're all tempting! 😋",
    "Tour guide! 🎪"
  ]
};

const names = ['Strawberry', 'Chocolate', 'Mango', 'Mint', 'Lemon', 'Pistachio', 'Raspberry', 'Hazelnut', 'Coconut', 'Vanilla'];
const files = [
  'assets/images/strawberry.png', 
  'assets/images/chocolate.png', 
  'assets/images/mango.png', 
  'assets/images/mint.png', 
  'assets/images/lemon.png', 
  'assets/images/pistachio.png', 
  'assets/images/raspberry.png', 
  'assets/images/hazelnut.png', 
  'assets/images/coconut.png', 
  'assets/images/vanilla.png'
];
const READY_THRESHOLD = 3000;
let lastPromptTime = 0;
const promptInterval = 4000;
let usedPrompts = [];

const iceCreamTrivia = [
  "Ice cream was served at England's King Charles I wedding in 1633!",
  "Vanilla is the world's most popular ice cream flavor.",
  "It takes 12 pounds of milk to make 1 gallon of ice cream.",
  "Americans eat an average of 48 pints of ice cream per year!",
  "The ice cream cone was invented at the 1904 World's Fair.",
  "It takes about 50 licks to finish a single scoop cone.",
  "Brain freeze happens when cold hits your palate's nerves.",
  "Chocolate ice cream was actually invented before vanilla.",
  "Ice cream was once a food reserved only for royalty!",
  "The world's most expensive sundae costs over $1,000."
];

function preload() {
  for (let i = 0; i < files.length; i++) {
    loadImage(files[i], 
      (img) => { imgs.push(img); loadedAssets++; updateLoadingProgress(); },
      () => { imgs.push(createImage(100, 100)); loadedAssets++; updateLoadingProgress(); }
    );
  }
  loadImage('assets/images/point-hand.png', (img) => { pointHandImg = img; loadedAssets++; updateLoadingProgress(); }, () => { loadedAssets++; updateLoadingProgress(); });
  loadImage('assets/images/ok-hand.png', (img) => { okHandImg = img; loadedAssets++; updateLoadingProgress(); }, () => { loadedAssets++; updateLoadingProgress(); });
  handPose = ml5.handPose(() => { loadedAssets++; updateLoadingProgress(); });
}

function updateLoadingProgress() {
  loadingProgress = Math.floor((loadedAssets / totalAssets) * 100);
  let progressText = document.getElementById('progress-text');
  let progressBar = document.getElementById('progress-bar');
  if (progressText) progressText.textContent = loadingProgress + '%';
  if (progressBar) progressBar.style.width = loadingProgress + '%';
}

function setup() {
  let canvas = createCanvas(windowWidth, windowHeight);
  canvas.parent('canvas-container');
  fingerX = width / 2; fingerY = height / 2; lastFingerX = fingerX; lastFingerY = fingerY;
  
  let checkLoading = setInterval(() => {
    if (loadedAssets >= totalAssets) { clearInterval(checkLoading); initApp(); }
  }, 100);
  
  textAlign(CENTER, CENTER); frameRate(60);
  
  // 🚀 性能优化：减少背景元素数量
  for (let i = 0; i < 15; i++) bubbles.push(new BackgroundBubble()); // 从25减到15
  for (let i = 0; i < 20; i++) funParticles.push(new FunParticle()); // 从30减到20
}

// 🔊 Initialize Audio System
function initAudio() {
  bgMusic = document.getElementById('bg-music');
  startSound = document.getElementById('start-sound');
  successSound = document.getElementById('success-sound');
  
  // Set volumes - 背景音乐小声，音效正常
  if (bgMusic) bgMusic.volume = bgMusicVolume;
  if (startSound) startSound.volume = sfxVolume;
  if (successSound) successSound.volume = sfxVolume;
  
  // Setup mute button
  let muteButton = document.getElementById('mute-button');
  if (muteButton) {
    muteButton.addEventListener('click', toggleMute);
  }
}

// 🔊 Play sound effect
function playSFX(sound) {
  if (!sound || isMuted) return;
  sound.currentTime = 0;
  sound.play().catch(err => console.log('Audio prevented:', err));
}

// 🔊 Start background music
function startBGMusic() {
  if (!bgMusic || isMuted) return;
  bgMusic.loop = true;
  bgMusic.currentTime = 0;
  bgMusic.play().catch(err => console.log('Music prevented:', err));
}

// 🔊 Stop background music
function stopBGMusic() {
  if (bgMusic) bgMusic.pause();
}

// 🔊 Toggle mute
function toggleMute() {
  isMuted = !isMuted;
  let muteButton = document.getElementById('mute-button');
  
  if (isMuted) {
    stopBGMusic();
    if (muteButton) muteButton.textContent = '🔇 Unmute';
  } else {
    if (muteButton) muteButton.textContent = '🔊 Mute';
    // 如果游戏已经开始，恢复背景音乐
    if (!showTutorial || hasSelected) {
      startBGMusic();
    }
  }
}

function initApp() {
  setupBoxes(); 
  
  // 🔧 FIX: 确保教程从第一页开始
  showTutorial = true; 
  tutorialPage = 0;
  tutorialGestureTimer = 0;
  
  // 🔊 Initialize audio
  initAudio();
  
  video = createCapture(VIDEO); 
  video.size(640, 480); 
  video.hide();
  
  setTimeout(() => {
    let videoElement = document.getElementById('webcam');
    if (videoElement && video.elt.srcObject) videoElement.srcObject = video.elt.srcObject;
    if (handPose && video) handPose.detectStart(video, gotHands);
    
    setTimeout(() => {
      let loadingScreen = document.getElementById('loading-screen');
      if (loadingScreen) {
        loadingScreen.style.opacity = '0';
        setTimeout(() => { 
          loadingScreen.style.display = 'none'; 
          
          // 🔧 FIX: 显示start screen，不自动进入教程
          showStartScreen();
        }, 500);
      }
    }, 300);
  }, 500);
  
  iceCreamFacts = shuffle(iceCreamTrivia);
}

// 🔊 Show start screen with audio permission
function showStartScreen() {
  let startScreen = document.getElementById('start-screen');
  let startButton = document.getElementById('start-button');
  
  // 🔧 FIX: 重置教程状态
  showTutorial = true;
  tutorialPage = 0;
  tutorialGestureTimer = 0;
  
  if (startScreen) {
    startScreen.style.display = 'flex';
    
    if (startButton) {
      startButton.addEventListener('click', () => {
        // 🔊 Play start sound effect
        playSFX(startSound);
        
        // 🔊 Start background music
        startBGMusic();
        
        // Hide start screen and show tutorial
        startScreen.style.opacity = '0';
        setTimeout(() => {
          startScreen.style.display = 'none';
          // 🔧 FIX: 确保显示教程第一页
          showTutorial = true;
          tutorialPage = 0;
          tutorialGestureTimer = 0;
        }, 300);
      });
    }
  }
}

function setupBoxes() {
  boxes = [];
  let baseW = width * 0.15, baseH = height * 0.32, gap = width * 0.03;
  let startX = (width - (baseW * 5 + gap * 4)) / 2, startY = height * 0.2;
  for (let i = 0; i < 10; i++) {
    let col = i % 5, row = floor(i / 5);
    boxes.push({
      x: startX + col * (baseW + gap), y: startY + row * (baseH + gap),
      baseW: baseW, baseH: baseH, w: baseW, h: baseH,
      baseX: startX + col * (baseW + gap), baseY: startY + row * (baseH + gap),
      name: names[i], img: imgs[i], time: 0, ready: false, maxScale: 1.0, viewed: false,
      emoji: flavorEmojis[i]
    });
  }
}

function gotHands(results) { hands = results; }

function draw() {
  if (!canStart) return;
  background(248, 250, 252);
  
  // 🚀 性能优化：报告页面不显示背景动画
  if (!hasSelected) {
    for (let p of funParticles) { p.update(); p.display(); }
    for (let bubble of bubbles) { bubble.update(); bubble.display(); }
  }
  
  for (let i = floatingEmojis.length - 1; i >= 0; i--) {
    floatingEmojis[i].update();
    floatingEmojis[i].display();
    if (floatingEmojis[i].isDead()) floatingEmojis.splice(i, 1);
  }
  
  if (showTutorial) { drawTutorial(); checkTutorialGesture(); return; }
  if (showBuffer) { drawBuffer(); bufferTimer++; if (bufferTimer >= BUFFER_DURATION) { showBuffer = false; bufferTimer = 0; } return; }
  
  updateFingerPosition();
  
  if (!hasSelected) { 
    updateBoxSizes(); drawSelection(); updatePrompts(); drawPromptBubbles(); checkOKGesture(); 
  } else { 
    drawBeautifulReport(); updateConfetti(); drawConfetti(); 
  }
  
  if (saveMessageTimer > 0) { drawSaveMessage(); saveMessageTimer--; }
}

class FunParticle {
  constructor() {
    this.x = random(width); this.y = random(height); this.size = random(2, 6);
    this.speedX = random(-0.5, 0.5); this.speedY = random(-0.5, 0.5);
    this.color = color(random(200, 255), random(200, 255), random(200, 255), random(30, 80));
    this.life = random(200, 400); this.maxLife = this.life;
  }
  update() {
    this.x += this.speedX; this.y += this.speedY; this.life--;
    if (this.life <= 0 || this.x < 0 || this.x > width || this.y < 0 || this.y > height) {
      this.x = random(width); this.y = random(height); this.life = this.maxLife;
    }
  }
  display() {
    push();
    let alpha = map(this.life, 0, this.maxLife, 0, this.color.levels[3]);
    fill(this.color.levels[0], this.color.levels[1], this.color.levels[2], alpha);
    noStroke(); circle(this.x, this.y, this.size);
    pop();
  }
}

class FloatingEmoji {
  constructor(x, y, emoji) {
    this.x = x; this.y = y; this.emoji = emoji; this.vy = random(-3, -1); this.vx = random(-1, 1);
    this.size = random(30, 50); this.rotation = random(TWO_PI); this.rotationSpeed = random(-0.1, 0.1);
    this.life = 180; this.alpha = 255;
  }
  update() {
    this.x += this.vx; this.y += this.vy; this.vy += 0.05; this.rotation += this.rotationSpeed; this.life--;
    if (this.life < 60) this.alpha = map(this.life, 0, 60, 0, 255);
  }
  display() {
    push(); translate(this.x, this.y); rotate(this.rotation); textSize(this.size);
    fill(255, this.alpha); textAlign(CENTER, CENTER); text(this.emoji, 0, 0); pop();
  }
  isDead() { return this.life <= 0; }
}

class BackgroundBubble {
  constructor() {
    this.x = random(width); this.y = random(height, height + 200); this.size = random(40, 100);
    this.speed = random(0.3, 1.2); this.color = color(random(150, 255), random(200, 255), random(220, 255), 100);
    this.wobble = random(TWO_PI);
  }
  update() {
    this.y -= this.speed; this.wobble += 0.05;
    if (this.y < -this.size) { this.y = height + this.size; this.x = random(width); }
  }
  display() {
    push(); noStroke(); let wobbleX = sin(this.wobble) * 15;
    fill(this.color.levels[0], this.color.levels[1], this.color.levels[2], 50);
    circle(this.x + wobbleX, this.y, this.size + 20);
    fill(this.color); circle(this.x + wobbleX, this.y, this.size);
    fill(255, 255, 255, 180);
    circle(this.x + wobbleX - this.size * 0.2, this.y - this.size * 0.2, this.size * 0.3);
    fill(255, 255, 255, 100);
    circle(this.x + wobbleX - this.size * 0.2, this.y - this.size * 0.2, this.size * 0.4);
    pop();
  }
}

class PromptBubble {
  constructor(x, y, text, elapsedTime) {
    this.x = x; this.y = y; this.text = text; this.life = 200; this.maxLife = 200;
    this.size = 0; this.targetSize = 160; this.alpha = 255; this.wobble = random(TWO_PI);
    this.wobbleSpeed = random(0.04, 0.1);
    
    // 🎨 根据时间改变颜色 - 从冷色（冷静）到暖色（催促）
    if (elapsedTime < 10000) {
      this.color = color(200, 230, 255, 200);
    } else if (elapsedTime < 20000) {
      this.color = color(220, 210, 255, 200);
    } else if (elapsedTime < 30000) {
      this.color = color(255, 220, 230, 200);
    } else if (elapsedTime < 45000) {
      this.color = color(255, 230, 200, 200);
    } else {
      this.color = color(255, 200, 180, 200);
    }
    
    this.popping = false; this.popParticles = [];
  }
  
  update() {
    this.life--; this.wobble += this.wobbleSpeed;
    if (this.life > this.maxLife - 30) this.size = lerp(this.size, this.targetSize, 0.15);
    if (this.life < 40 && !this.popping) { 
      this.popping = true; 
      this.createPopEffect(); 
    }
    if (this.popping) { for (let p of this.popParticles) p.update(); } 
    else { this.y -= 0.6; }
  }
  
  createPopEffect() {
    let particleCount = floor(random(15, 25));
    for (let i = 0; i < particleCount; i++) {
      let angle = TWO_PI / particleCount * i + random(-0.3, 0.3);
      this.popParticles.push({
        x: this.x, y: this.y, vx: cos(angle) * random(3, 8), vy: sin(angle) * random(3, 8),
        size: random(5, 12), life: 40,
        color: color(this.color.levels[0] + random(-30, 30), this.color.levels[1] + random(-30, 30), 
                     this.color.levels[2] + random(-30, 30), 255),
        update() { this.x += this.vx; this.y += this.vy; this.vy += 0.3; this.vx *= 0.93; this.life--; this.size *= 0.90; }
      });
    }
  }
  
  display() {
    if (this.popping) {
      for (let p of this.popParticles) {
        if (p.life > 0) {
          push(); let alpha = map(p.life, 0, 40, 0, 255);
          fill(p.color.levels[0], p.color.levels[1], p.color.levels[2], alpha);
          noStroke(); circle(p.x, p.y, p.size); pop();
        }
      }
    } else {
      push(); let wobbleX = sin(this.wobble) * 5; let wobbleY = cos(this.wobble * 1.3) * 3;
      fill(this.color.levels[0], this.color.levels[1], this.color.levels[2], 60);
      noStroke(); circle(this.x + wobbleX, this.y + wobbleY, this.size + 30);
      fill(this.color); circle(this.x + wobbleX, this.y + wobbleY, this.size);
      fill(255, 255, 255, 200);
      circle(this.x + wobbleX - this.size * 0.25, this.y + wobbleY - this.size * 0.25, this.size * 0.4);
      fill(255, 255, 255, 150);
      circle(this.x + wobbleX + this.size * 0.2, this.y + wobbleY - this.size * 0.15, this.size * 0.2);
      fill(255, 255, 255, 80);
      ellipse(this.x + wobbleX, this.y + wobbleY + this.size * 0.3, this.size * 0.7, this.size * 0.25);
      fill(80, 60, 100, this.alpha); textAlign(CENTER, CENTER); textSize(18); textStyle(BOLD);
      text(this.text, this.x + wobbleX, this.y + wobbleY); pop();
    }
  }
  
  isDead() { 
    if (this.popping) return this.popParticles.every(p => p.life <= 0);
    return this.life <= 0; 
  }
}

class Confetti {
  constructor(x, y) {
    this.x = x; this.y = y; this.vx = random(-8, 8); this.vy = random(-15, -8); this.gravity = 0.4;
    this.size = random(10, 20); this.rotation = random(TWO_PI); this.rotationSpeed = random(-0.3, 0.3);
    let colorChoice = floor(random(6));
    if (colorChoice === 0) this.color = color(255, 50, 100);
    else if (colorChoice === 1) this.color = color(50, 150, 255);
    else if (colorChoice === 2) this.color = color(255, 200, 50);
    else if (colorChoice === 3) this.color = color(150, 255, 100);
    else if (colorChoice === 4) this.color = color(255, 100, 200);
    else this.color = color(200, 100, 255);
    this.alpha = 255; this.life = 240;
  }
  update() {
    this.x += this.vx; this.y += this.vy; this.vy += this.gravity; this.rotation += this.rotationSpeed; this.life--;
    if (this.life < 80) this.alpha = map(this.life, 0, 80, 0, 255);
  }
  display() {
    push(); translate(this.x, this.y); rotate(this.rotation);
    fill(this.color.levels[0], this.color.levels[1], this.color.levels[2], this.alpha);
    noStroke(); rectMode(CENTER); rect(0, 0, this.size, this.size); pop();
  }
  isDead() { return this.life <= 0 || this.y > height + 50; }
}

function getUniquePrompt(category) {
  let availablePrompts = prompts[category].filter(p => !usedPrompts.includes(p));
  if (availablePrompts.length === 0) { usedPrompts = []; availablePrompts = prompts[category]; }
  let selected = random(availablePrompts);
  usedPrompts.push(selected);
  if (usedPrompts.length > 15) usedPrompts.shift();
  return selected;
}

function updatePrompts() {
  if (millis() - lastPromptTime > promptInterval && current) {
    let elapsed = millis() - startTime;
    let promptText = "";
    let category = "";
    
    // 🎭 优先检查切换行为
    if (switchCount > 3) {
      category = 'switching';
    } 
    // 🕐 否则根据时间递进选择语气
    else if (elapsed < 10000) {
      category = 'gentle';
    } else if (elapsed < 20000) {
      category = 'friendly';
    } else if (elapsed < 30000) {
      category = 'nudge';
    } else if (elapsed < 45000) {
      category = 'playfulPush';
    } else {
      category = 'urgentFunny';
    }
    
    promptText = getUniquePrompt(category);
    
    let bubbleX = fingerX + random(-180, 180);
    let bubbleY = fingerY + random(-180, 180);
    bubbleX = constrain(bubbleX, 120, width - 120);
    bubbleY = constrain(bubbleY, 120, height - 120);
    
    promptBubbles.push(new PromptBubble(bubbleX, bubbleY, promptText, elapsed));
    lastPromptTime = millis();
  }
  for (let i = promptBubbles.length - 1; i >= 0; i--) {
    promptBubbles[i].update();
    if (promptBubbles[i].isDead()) promptBubbles.splice(i, 1);
  }
}

function drawPromptBubbles() { for (let bubble of promptBubbles) bubble.display(); }

function createConfetti(x, y) { 
  // 🚀 性能优化：从150减到100
  for (let i = 0; i < 100; i++) confetti.push(new Confetti(x, y));
  // 🚀 性能优化：从10减到8
  for (let i = 0; i < 8; i++) {
    let emoji = random(reactionEmojis);
    floatingEmojis.push(new FloatingEmoji(x + random(-100, 100), y + random(-50, 50), emoji));
  }
}

function updateConfetti() {
  for (let i = confetti.length - 1; i >= 0; i--) {
    confetti[i].update();
    if (confetti[i].isDead()) confetti.splice(i, 1);
  }
}

function drawConfetti() { for (let c of confetti) c.display(); }

function checkTutorialGesture() {
  if (hands.length === 0) { tutorialGestureTimer = 0; return; }
  let hand = hands[0], isCorrectGesture = false;
  if (tutorialPage === 0) {
    let indexTip = hand.keypoints[8], indexBase = hand.keypoints[5], middleTip = hand.keypoints[12];
    let ringTip = hand.keypoints[16], pinkyTip = hand.keypoints[20], wrist = hand.keypoints[0];
    let indexExtended = dist(indexTip.x, indexTip.y, wrist.x, wrist.y) > dist(indexBase.x, indexBase.y, wrist.x, wrist.y) + 60;
    let middleFolded = dist(middleTip.x, middleTip.y, wrist.x, wrist.y) < 120;
    let ringFolded = dist(ringTip.x, ringTip.y, wrist.x, wrist.y) < 110;
    let pinkyFolded = dist(pinkyTip.x, pinkyTip.y, wrist.x, wrist.y) < 100;
    isCorrectGesture = indexExtended && middleFolded && ringFolded && pinkyFolded;
  } else {
    let thumb = hand.keypoints[4], index = hand.keypoints[8], middle = hand.keypoints[12];
    let ring = hand.keypoints[16], pinky = hand.keypoints[20], wrist = hand.keypoints[0];
    let thumbIndexDist = dist(thumb.x, thumb.y, index.x, index.y);
    let middleDist = dist(middle.x, middle.y, wrist.x, wrist.y);
    let ringDist = dist(ring.x, ring.y, wrist.x, wrist.y);
    let pinkyDist = dist(pinky.x, pinky.y, wrist.x, wrist.y);
    isCorrectGesture = thumbIndexDist < 60 && middleDist > 100 && ringDist > 90 && pinkyDist > 80;
  }
  if (isCorrectGesture) {
    tutorialGestureTimer++;
    push();
    fill(100, 200, 150, 200); noStroke(); rectMode(CENTER);
    rect(width/2, height * 0.75, 300, 80, 20);
    fill(255); textAlign(CENTER, CENTER); textSize(24); textStyle(BOLD);
    text('Great! Keep holding...', width/2, height * 0.74);
    // 🔧 FIX: 从90帧（1.5秒）改为30帧（0.5秒）
    let progress = constrain(tutorialGestureTimer / 30, 0, 1);
    fill(255, 255, 255, 80); rectMode(CORNER);
    rect(width/2 - 120, height * 0.77, 240, 8, 4);
    fill(255); rect(width/2 - 120, height * 0.77, 240 * progress, 8, 4);
    pop();
    // 🔧 FIX: 从90帧改为30帧
    if (tutorialGestureTimer > 30) {
      if (tutorialPage === 0) tutorialPage = 1;
      else { showTutorial = false; showBuffer = true; bufferTimer = 0; }
      tutorialGestureTimer = 0;
    }
  } else tutorialGestureTimer = 0;
}

function drawTutorial() {
  background(245, 238, 228); push();
  let leftX = width * 0.3, centerY = height * 0.5;
  if (tutorialPage === 0) {
    fill(200, 100, 50); textAlign(CENTER, CENTER); textSize(32); textStyle(BOLD);
    text('📍 Tutorial Page 1 of 2', width/2, height * 0.12);
    if (pointHandImg) {
      let imgW = min(width * 0.28, 350), imgH = imgW * (pointHandImg.height / pointHandImg.width);
      imageMode(CENTER); image(pointHandImg, leftX, centerY, imgW, imgH);
    }
    let rightX = width * 0.58;
    fill(200, 140, 90); textAlign(LEFT, CENTER); textSize(20); textStyle(NORMAL); text('STEP 1', rightX, height * 0.32);
    fill(70, 60, 50); textSize(48); textStyle(BOLD); text('Point to Select', rightX, height * 0.41);
    fill(100, 85, 70); textSize(24); textStyle(NORMAL);
    text('Point your finger 👆 at your', rightX, height * 0.52); text('favorite ice cream', rightX, height * 0.57);
    fill(120, 100, 85); textSize(20); text('Hold for 3 seconds to get ready', rightX, height * 0.65);
    fill(140, 120, 100); textAlign(CENTER, CENTER); textSize(22); textStyle(NORMAL);
    text('Point your finger 👆 to continue', width/2, height * 0.88);
  } else {
    fill(200, 100, 50); textAlign(CENTER, CENTER); textSize(32); textStyle(BOLD);
    text('📍 Tutorial Page 2 of 2', width/2, height * 0.12);
    if (okHandImg) {
      let imgW = min(width * 0.28, 350), imgH = imgW * (okHandImg.height / okHandImg.width);
      imageMode(CENTER); image(okHandImg, leftX, centerY, imgW, imgH);
    }
    let rightX = width * 0.58;
    fill(200, 140, 90); textAlign(LEFT, CENTER); textSize(20); textStyle(NORMAL); text('STEP 2', rightX, height * 0.32);
    fill(70, 60, 50); textSize(48); textStyle(BOLD); text('Confirm with OK', rightX, height * 0.41);
    fill(100, 85, 70); textSize(24); textStyle(NORMAL);
    text('Make OK sign 👌 to confirm', rightX, height * 0.52); text('your choice', rightX, height * 0.57);
    fill(120, 100, 85); textSize(20); text('You can confirm anytime!', rightX, height * 0.65);
    fill(140, 120, 100); textAlign(CENTER, CENTER); textSize(22); textStyle(NORMAL);
    text('Make OK sign 👌 to start', width/2, height * 0.88);
  }
  let dotY = height * 0.94, dotGap = 18; noStroke();
  for (let i = 0; i < 2; i++) {
    if (i === tutorialPage) { fill(210, 140, 90); circle(width/2 - dotGap/2 + i * dotGap, dotY, 12); }
    else { fill(180, 140, 110, 100); circle(width/2 - dotGap/2 + i * dotGap, dotY, 9); }
  }
  pop();
}

function drawBuffer() {
  background(240, 245, 250); push();
  let progress = bufferTimer / BUFFER_DURATION, countdown = ceil(3 - progress * 3);
  fill(100, 150, 200); textAlign(CENTER, CENTER); textSize(120); textStyle(BOLD);
  text(countdown, width/2, height/2 - 50);
  textSize(36); fill(120, 140, 160); text('Get ready to choose!', width/2, height/2 + 80);
  push(); translate(width/2, height/2 - 50); noFill(); strokeWeight(8);
  stroke(200, 220, 240); circle(0, 0, 200); stroke(100, 150, 200); strokeCap(ROUND); 
  arc(0, 0, 200, 200, -HALF_PI, -HALF_PI + TWO_PI * progress);
  pop(); pop();
}

function updateBoxSizes() {
  let maxTime = 0;
  for (let box of boxes) if (box.time > maxTime) maxTime = box.time;
  for (let box of boxes) {
    let targetScale = 1.0;
    if (maxTime > 0) { let timeRatio = box.time / maxTime; targetScale = 1.0 + (timeRatio * 0.3); }
    if (targetScale > box.maxScale) box.maxScale = targetScale;
    let currentScale = box.w / box.baseW, newScale = lerp(currentScale, box.maxScale, 0.0075);
    box.w = box.baseW * newScale; box.h = box.baseH * newScale;
    box.x = box.baseX + (box.baseW - box.w) / 2; box.y = box.baseY + (box.baseH - box.h) / 2;
  }
}

function updateFingerPosition() {
  if (hands.length > 0) {
    let hand = hands[0], indexTip = hand.keypoints[8];
    fingerX = map(indexTip.x, 0, 640, width, 0);
    fingerY = map(indexTip.y, 0, 480, 0, height);
    lastFingerX = fingerX; lastFingerY = fingerY;
  } else { fingerX = lastFingerX; fingerY = lastFingerY; }
}

function checkOKGesture() {
  if (hands.length === 0 || !current) { okConfirmTimer = 0; return; }
  let hand = hands[0];
  let thumb = hand.keypoints[4], index = hand.keypoints[8], middle = hand.keypoints[12];
  let ring = hand.keypoints[16], pinky = hand.keypoints[20], wrist = hand.keypoints[0];
  let thumbIndexDist = dist(thumb.x, thumb.y, index.x, index.y);
  let middleDist = dist(middle.x, middle.y, wrist.x, wrist.y);
  let ringDist = dist(ring.x, ring.y, wrist.x, wrist.y);
  let pinkyDist = dist(pinky.x, pinky.y, wrist.x, wrist.y);
  let isOK = thumbIndexDist < 60 && middleDist > 100 && ringDist > 90 && pinkyDist > 80;
  if (isOK) {
    okConfirmTimer++;
    push();
    fill(255, 200, 0, 200); noStroke(); rectMode(CENTER);
    rect(width/2, height - 100, 280, 100, 20);
    fill(255); textSize(56); textStyle(BOLD); text('👌', width/2, height - 120);
    textSize(24); fill(255);
    let dots = '.'.repeat((okConfirmTimer / 10) % 4);
    text('Confirming' + dots, width/2, height - 60);
    // 🔧 FIX: 从60帧（1秒）改为30帧（0.5秒）
    let progress = constrain(okConfirmTimer / 30, 0, 1);
    fill(255, 255, 255, 80); rectMode(CORNER);
    rect(width/2 - 100, height - 30, 200, 6, 3);
    fill(255); rect(width/2 - 100, height - 30, 200 * progress, 6, 3);
    pop();
    // 🔧 FIX: 从60帧改为30帧
    if (okConfirmTimer > 30) confirmSelection();
  } else okConfirmTimer = 0;
}

function drawSelection() {
  push();
  fill(255, 255, 255, 230); noStroke(); rect(0, 0, width, height * 0.16);
  fill(80, 100, 140); textAlign(CENTER, CENTER); textSize(40); textStyle(BOLD);
  text('🍦 Point at Your Favorite Ice Cream', width/2, height * 0.065);
  textSize(16); textStyle(NORMAL); fill(120, 140, 180);
  let status = hands.length > 0 ? '✓ Hand detected' : '👆 Show your hand';
  text(status + ' • Hold 3s for Ready • 👌 OK anytime', width/2, height * 0.115);
  pop();
  for (let box of boxes) {
    push();
    if (current === box) {
      drawingContext.shadowBlur = 12; drawingContext.shadowColor = 'rgba(100, 150, 255, 0.3)';
    }
    image(box.img, box.x, box.y, box.w, box.h);
    drawingContext.shadowBlur = 0;
    if (box.ready) {
      fill(255, 200, 100, 200); noStroke(); rect(box.x, box.y, box.w, box.h);
      fill(255); stroke(80, 60, 40); strokeWeight(2);
      let textSize1 = map(box.w, box.baseW, box.baseW * 1.3, 20, 26); 
      textSize(textSize1); textStyle(BOLD); text('Ready!', box.x + box.w/2, box.y + box.h/2 - 12);
      let textSize2 = map(box.w, box.baseW, box.baseW * 1.3, 14, 18); 
      textSize(textSize2); text('👌 OK', box.x + box.w/2, box.y + box.h/2 + 12);
      noFill(); stroke(255, 200, 100); strokeWeight(4); 
      rect(box.x - 2, box.y - 2, box.w + 4, box.h + 4);
    } else if (current === box) {
      noFill(); stroke(100, 150, 255); strokeWeight(3); 
      rect(box.x - 2, box.y - 2, box.w + 4, box.h + 4);
    }
    pop();
  }
  if (path.length > 1) {
    stroke(255, 120, 150, 120); strokeWeight(2); noFill(); beginShape();
    for (let i = max(0, path.length - 30); i < path.length; i++) vertex(path[i].x, path[i].y);
    if (current && hands.length > 0) vertex(fingerX, fingerY);
    endShape();
  }
  push(); textAlign(CENTER, CENTER); textSize(45);
  drawingContext.shadowBlur = 10; drawingContext.shadowColor = 'rgba(0, 0, 0, 0.4)';
  drawingContext.shadowOffsetX = 2; drawingContext.shadowOffsetY = 2;
  if (hands.length > 0) fill(255, 255, 255, 255); else fill(255, 255, 255, 150);
  text('👆', fingerX, fingerY - 22);
  pop();
  updatePointing();
}

function updatePointing() {
  if (hands.length === 0) { current = null; return; }
  let found = null;
  for (let box of boxes) {
    if (fingerX > box.baseX && fingerX < box.baseX + box.baseW && 
        fingerY > box.baseY && fingerY < box.baseY + box.baseH) {
      found = box; break;
    }
  }
  if (found) {
    if (current !== found) {
      if (current && current.ready) abandoned.push(current.name);
      boxes.forEach(b => b.ready = false);
      current = found; startTime = millis(); path.push({x: fingerX, y: fingerY}); switchCount++;
    } else {
      current.time += deltaTime; totalViewTime += deltaTime;
      if (millis() - startTime > READY_THRESHOLD) current.ready = true;
    }
    if (!found.viewed) { found.viewed = true; viewedAll = boxes.every(b => b.viewed); }
  } else {
    if (current && current.ready) abandoned.push(current.name);
    current = null;
  }
}

function mouseClicked() {
  if (showTutorial && canStart) {
    if (tutorialPage === 0) tutorialPage = 1;
    else { showTutorial = false; showBuffer = true; bufferTimer = 0; }
  }
}

function confirmSelection() {
  if (current && !hasSelected) {
    selectedFlavor = current; hasSelected = true;
    createConfetti(selectedFlavor.x + selectedFlavor.w/2, selectedFlavor.y + selectedFlavor.h/2);
    
    // 🔊 Play success sound effect!
    playSFX(successSound);
  }
}

function analyzePersonality() {
  let decisionTime = totalViewTime / 1000, personality = "", description = "";
  if (decisionTime < 10 && switchCount <= 2) {
    personality = "Quick Decider";
    description = "You know what you want!";
  } else if (viewedAll && decisionTime > 20) {
    personality = "Rational Analyzer";
    description = "Carefully considered everything.";
  } else if (viewedAll && decisionTime > 30) {
    personality = "Perfectionist";
    description = "Every detail matters to you.";
  } else if (switchCount <= 1) {
    personality = "Determined One";
    description = "Once you see it, you know it.";
  } else if (switchCount >= 5) {
    personality = "Explorer";
    description = "Why choose one? Explore them all!";
  } else if (decisionTime < 20 && switchCount >= 3) {
    personality = "Heart Follower";
    description = "You follow your feelings.";
  } else {
    personality = "Balanced One";
    description = "Perfect balance of thought and feeling.";
  }
  return { personality, description };
}

function drawBeautifulReport() {
  // 🎨 优化：使用简单的纯色背景，减少渐变计算
  background(248, 250, 252);
  
  // 🎨 优化：只渲染必要的背景冰淇淋（减少绘制）
  for (let box of boxes) {
    if (box === selectedFlavor) continue; // 选中的单独绘制
    push(); 
    tint(255, 15); // 更透明，减少视觉干扰
    image(box.img, box.x, box.y, box.w, box.h); 
    pop();
  }
  
  // 选中的冰淇淋 - 突出显示
  if (selectedFlavor) {
    push();
    // 🎨 优化：减少阴影模糊，提升性能
    drawingContext.shadowBlur = 30;
    drawingContext.shadowColor = 'rgba(100, 150, 255, 0.3)';
    image(selectedFlavor.img, selectedFlavor.x, selectedFlavor.y, selectedFlavor.w, selectedFlavor.h);
    
    // 边框高亮
    noFill();
    strokeWeight(4); 
    stroke(100, 150, 255);
    rect(selectedFlavor.x - 3, selectedFlavor.y - 3, selectedFlavor.w + 6, selectedFlavor.h + 6, 10);
    pop();
  }
  
  // 🎨 新设计：顶部标题区域
  push();
  textAlign(CENTER, CENTER);
  textSize(72); 
  text(selectedFlavor.emoji, width/2, height * 0.11);
  
  fill(50, 45, 70); 
  textSize(42); 
  textStyle(BOLD);
  text(selectedFlavor.name, width/2, height * 0.19);
  
  fill(110, 100, 130); 
  textSize(18); 
  textStyle(NORMAL);
  text('Your Perfect Choice', width/2, height * 0.24);
  pop();
  
  // 📊 数据准备
  let total = totalViewTime / 1000;
  let personalityResult = analyzePersonality();
  let viewRate = (viewedAll ? 100 : (boxes.filter(b => b.viewed).length / boxes.length * 100)).toFixed(0);
  
  // 🎨 新布局：4个卡片横排（更紧凑）
  let cardStartY = height * 0.33;
  let cardW = min(width * 0.19, 240); // 稍微宽一点
  let cardH = 160;
  let cardGap = width * 0.025;
  let totalWidth = cardW * 4 + cardGap * 3;
  let cardStartX = (width - totalWidth) / 2;
  
  // 卡片1: Personality
  drawModernCard(
    cardStartX, 
    cardStartY, 
    cardW, 
    cardH,
    '🎭',
    personalityResult.personality,
    personalityResult.description,
    color(245, 240, 255),
    color(140, 120, 200)
  );
  
  // 卡片2: Decision Time
  let speedEmoji = total < 10 ? '⚡' : total < 20 ? '⏱️' : '🐌';
  drawModernCard(
    cardStartX + (cardW + cardGap), 
    cardStartY, 
    cardW, 
    cardH,
    speedEmoji,
    total.toFixed(1) + 's',
    'Decision Time',
    color(255, 245, 240),
    color(230, 150, 120)
  );
  
  // 卡片3: Explored
  drawModernCard(
    cardStartX + (cardW + cardGap) * 2, 
    cardStartY, 
    cardW, 
    cardH,
    '👁️',
    viewRate + '%',
    'Explored',
    color(240, 250, 255),
    color(120, 180, 220)
  );
  
  // 卡片4: Switches
  drawModernCard(
    cardStartX + (cardW + cardGap) * 3, 
    cardStartY, 
    cardW, 
    cardH,
    '🔄',
    switchCount.toString(),
    'Switches',
    color(245, 255, 245),
    color(130, 200, 150)
  );
  
  // 🎨 新设计：Fun Fact 卡片（更美观）
  let factY = cardStartY + cardH + 50;
  let factW = min(width * 0.65, 800);
  let factH = 110;
  let factX = (width - factW) / 2;
  
  push();
  // 🎨 优化：减少阴影模糊
  drawingContext.shadowBlur = 20;
  drawingContext.shadowColor = 'rgba(0, 0, 0, 0.06)';
  
  // 渐变背景效果
  fill(255, 252, 245);
  noStroke();
  rect(factX, factY, factW, factH, 18);
  
  // 顶部装饰条
  fill(255, 200, 100);
  rect(factX, factY, factW, 6, 18, 18, 0, 0);
  
  drawingContext.shadowBlur = 0;
  
  // 图标和标题
  textAlign(LEFT, CENTER);
  textSize(32);
  text('💡', factX + 25, factY + 38);
  
  fill(200, 150, 50);
  textSize(16);
  textStyle(BOLD);
  text('Fun Fact', factX + 70, factY + 38);
  
  // 内容文字
  fill(80, 70, 90);
  textAlign(LEFT, TOP);
  textSize(15);
  textStyle(NORMAL);
  let factIndex = floor(selectedFlavor.name.charCodeAt(0)) % iceCreamFacts.length;
  text(iceCreamFacts[factIndex], factX + 25, factY + 60, factW - 50);
  pop();
  
  // 底部提示
  push();
  fill(130, 120, 150);
  textAlign(CENTER, CENTER);
  textSize(15);
  textStyle(NORMAL);
  text('Press S to save  •  Press C to start over', width/2, height - 35);
  pop();
}

// 🎨 新函数：现代化卡片设计
function drawModernCard(x, y, w, h, emoji, mainText, subText, bgColor, accentColor) {
  push();
  
  // 🎨 优化：减少阴影模糊，提升性能
  drawingContext.shadowBlur = 20;
  drawingContext.shadowColor = 'rgba(0, 0, 0, 0.06)';
  
  // 卡片背景
  fill(bgColor);
  noStroke();
  rect(x, y, w, h, 16);
  
  drawingContext.shadowBlur = 0;
  
  // 内容布局
  textAlign(CENTER, CENTER);
  
  // Emoji图标
  textSize(45);
  text(emoji, x + w/2, y + h * 0.28);
  
  // 主要文字
  fill(accentColor);
  textSize(mainText.length > 10 ? 20 : 26);
  textStyle(BOLD);
  text(mainText, x + w/2, y + h * 0.58);
  
  // 副标题
  fill(accentColor);
  textSize(13);
  textStyle(NORMAL);
  text(subText, x + w/2, y + h * 0.83);
  
  pop();
}

function drawSaveMessage() {
  push();
  let alpha = map(saveMessageTimer, 0, 120, 0, 255);
  fill(120, 200, 150, alpha * 0.95); noStroke(); rectMode(CENTER);
  rect(width/2, 150, 380, 90, 20);
  fill(255, alpha); textAlign(CENTER, CENTER); textSize(28); textStyle(BOLD);
  text(saveMessage, width/2, 150); pop();
}

function keyPressed() {
  if (showTutorial) {
    if (keyCode === RIGHT_ARROW || key === ' ') {
      if (tutorialPage === 0) tutorialPage = 1;
      else { showTutorial = false; showBuffer = true; bufferTimer = 0; }
    } else if (keyCode === LEFT_ARROW) {
      if (tutorialPage === 1) tutorialPage = 0;
    }
    return;
  }
  if (key === 'c' || key === 'C') {
    boxes.forEach(b => { 
      b.time = 0; b.ready = false; b.w = b.baseW; b.h = b.baseH; 
      b.x = b.baseX; b.y = b.baseY; b.maxScale = 1.0; b.viewed = false; 
    });
    path = []; abandoned = []; current = null; hasSelected = false; selectedFlavor = null;
    okConfirmTimer = 0; saveMessage = ''; saveMessageTimer = 0; 
    confetti = []; promptBubbles = []; floatingEmojis = [];
    totalViewTime = 0; switchCount = 0; viewedAll = false; lastPromptTime = 0; usedPrompts = [];
    
    // 🔊 重新显示start screen
    showStartScreen();
  }
  if ((key === 's' || key === 'S') && hasSelected) {
    saveCanvas('ice-cream-choice-' + Date.now(), 'png');
    saveMessage = '✓ Saved Successfully!'; saveMessageTimer = 120;
  } else if ((key === 's' || key === 'S') && !hasSelected) {
    saveMessage = '⚠️ Choose first!'; saveMessageTimer = 120;
  }
  
  // 🔊 M键切换静音
  if (key === 'm' || key === 'M') {
    toggleMute();
  }
}

function windowResized() { resizeCanvas(windowWidth, windowHeight); boxes = []; setupBoxes(); }

function shuffle(array) {
  let arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = floor(random(i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}