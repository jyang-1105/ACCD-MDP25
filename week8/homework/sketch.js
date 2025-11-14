// Gesture Particle Brush - Enhanced Version
// Using P5.js + ML5.js HandPose

let handPose;
let video;
let hands = [];
let particles = [];
let hue = 0;

// Particle class with enhanced visual differences
class Particle {
  constructor(x, y, mode) {
    this.x = x;
    this.y = y;
    this.mode = mode;
    
    // Different life spans for different modes
    if (mode === 'firework') {
      this.life = 255;
      this.size = random(8, 20); // Larger particles
      let angle = random(TWO_PI);
      let speed = random(5, 12); // Faster explosion
      this.vx = cos(angle) * speed;
      this.vy = sin(angle) * speed;
      this.gravity = 0.3; // Strong gravity
    } else if (mode === 'star') {
      this.life = 200;
      this.size = random(2, 8); // Smaller, delicate particles
      let angle = random(TWO_PI);
      let speed = random(0.3, 1.5); // Very slow drift
      this.vx = cos(angle) * speed;
      this.vy = sin(angle) * speed;
      this.gravity = 0;
    } else { // flow mode
      this.life = 180;
      this.size = random(4, 10); // Medium particles
      this.vx = random(-0.5, 0.5); // Minimal drift
      this.vy = random(-0.5, 0.5);
      this.gravity = 0;
    }
    
    this.color = hue;
    this.alpha = 255;
  }
  
  update() {
    this.x += this.vx;
    this.y += this.vy;
    
    // Apply gravity only for fireworks
    if (this.mode === 'firework') {
      this.vy += this.gravity;
      this.life -= 4; // Fade faster
    } else if (this.mode === 'star') {
      this.life -= 1.5; // Fade very slowly
    } else {
      this.life -= 2.5; // Moderate fade
    }
  }
  
  display() {
    noStroke();
    colorMode(HSB);
    
    // Different visual styles for each mode
    if (this.mode === 'firework') {
      // Bright, vibrant fireworks
      fill(this.color, 85, 95, this.life);
      circle(this.x, this.y, this.size);
      // Add glow effect
      fill(this.color, 60, 100, this.life * 0.3);
      circle(this.x, this.y, this.size * 1.5);
    } else if (this.mode === 'star') {
      // Soft, gentle stars
      fill(this.color, 50, 90, this.life);
      circle(this.x, this.y, this.size);
      // Subtle glow
      fill(this.color, 30, 95, this.life * 0.2);
      circle(this.x, this.y, this.size * 2);
    } else {
      // Smooth flowing trail
      fill(this.color, 70, 85, this.life);
      circle(this.x, this.y, this.size);
    }
  }
  
  isDead() {
    return this.life <= 0;
  }
}

// Preload ML5 model
function preload() {
  handPose = ml5.handPose({ maxHands: 1, flipped: true });
}

// Setup canvas and video
function setup() {
  let canvas = createCanvas(640, 480);
  canvas.parent('canvas-container');
  
  video = createCapture(VIDEO);
  video.size(640, 480);
  video.hide();
  
  handPose.detectStart(video, gotHands);
  
  background(255);
}

// Main draw loop
function draw() {
  // Semi-transparent white background for trail effect
  fill(255, 25);
  rect(0, 0, width, height);
  
  // Draw flipped video
  push();
  translate(width, 0);
  scale(-1, 1);
  tint(255, 80);
  image(video, 0, 0, width, height);
  pop();
  
  // Update color hue
  hue = (hue + 0.5) % 360;
  
  // Update and draw particles
  for (let i = particles.length - 1; i >= 0; i--) {
    particles[i].update();
    particles[i].display();
    
    if (particles[i].isDead()) {
      particles.splice(i, 1);
    }
  }
  
  // Draw hand and create particles
  if (hands.length > 0) {
    let hand = hands[0];
    let mode = detectGesture(hand);
    
    drawHandSkeleton(hand);
    
    let indexTip = hand.index_finger_tip;
    
    if (mode === 'firework') {
      // Create 5 firework particles per frame
      for (let i = 0; i < 5; i++) {
        particles.push(new Particle(indexTip.x, indexTip.y, 'firework'));
      }
    } else if (mode === 'flow') {
      // Create 2 flowing particles per frame
      for (let i = 0; i < 2; i++) {
        particles.push(new Particle(indexTip.x, indexTip.y, 'flow'));
      }
    } else if (mode === 'star') {
      // Create 3 star particles from palm center
      let thumb = hand.thumb_tip;
      let pinky = hand.pinky_finger_tip;
      let centerX = (indexTip.x + thumb.x + pinky.x) / 3;
      let centerY = (indexTip.y + thumb.y + pinky.y) / 3;
      for (let i = 0; i < 3; i++) {
        particles.push(new Particle(centerX, centerY, 'star'));
      }
    }
  }
  
  // Display info
  fill(60);
  noStroke();
  textSize(16);
  textAlign(LEFT);
  text('Particles: ' + particles.length, 10, 30);
}

// Detect hand gesture with clear distinctions
function detectGesture(hand) {
  let indexTip = hand.index_finger_tip;
  let middleTip = hand.middle_finger_tip;
  let ringTip = hand.ring_finger_tip;
  let pinkyTip = hand.pinky_finger_tip;
  let thumb = hand.thumb_tip;
  let wrist = hand.wrist;
  
  // Calculate distances from wrist
  let indexDist = dist(indexTip.x, indexTip.y, wrist.x, wrist.y);
  let middleDist = dist(middleTip.x, middleTip.y, wrist.x, wrist.y);
  let ringDist = dist(ringTip.x, ringTip.y, wrist.x, wrist.y);
  let pinkyDist = dist(pinkyTip.x, pinkyTip.y, wrist.x, wrist.y);
  let thumbDist = dist(thumb.x, thumb.y, wrist.x, wrist.y);
  
  // Determine which fingers are extended
  let indexUp = indexDist > 120;
  let middleUp = middleDist > 120;
  let ringUp = ringDist > 100;
  let pinkyUp = pinkyDist > 90;
  let thumbOut = thumbDist > 100;
  
  // Open hand: all fingers extended
  if (indexUp && middleUp && ringUp && pinkyUp && thumbOut) {
    return 'star';
  } 
  // Two fingers: index and middle only
  else if (indexUp && middleUp && !ringUp && !pinkyUp) {
    return 'firework';
  } 
  // One finger: index only
  else if (indexUp && !middleUp && !ringUp) {
    return 'flow';
  }
  
  return 'flow'; // Default to flow
}

// Draw hand skeleton
function drawHandSkeleton(hand) {
  fill(100, 150, 250);
  noStroke();
  for (let keypoint of hand.keypoints) {
    circle(keypoint.x, keypoint.y, 6);
  }
  
  stroke(100, 150, 250, 120);
  strokeWeight(2);
  let connections = handPose.getConnections();
  for (let connection of connections) {
    let a = hand.keypoints[connection[0]];
    let b = hand.keypoints[connection[1]];
    line(a.x, a.y, b.x, b.y);
  }
}

// Receive hand detection results
function gotHands(results) {
  hands = results;
}

// Click to clear canvas
function mousePressed() {
  particles = [];
  background(255);
}