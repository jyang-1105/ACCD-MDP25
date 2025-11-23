// Configuration
const CONFIG = {
    videoWidth: 640,
    videoHeight: 480,
    captureWidth: 320,
    captureHeight: 240,
    // Distance thresholds
    minFaceSize: 1500,
    maxFaceSize: 20000,
    // Mosaic settings
    minBlockSize: 1,
    maxBlockSize: 50,
    // Particle settings
    particleCount: 2000,
    maxParticleSpeed: 15,
    particleSize: 3,
    // General
    padding: 20,
    clearThreshold: 0.25
};

// Global variables
let video;
let faceMesh;
let faces = [];
let statusElement;
let particles = [];
let currentMode = 'mosaic'; // 'mosaic' or 'particle'

// Particle class
class Particle {
    constructor(x, y, color) {
        this.homeX = x;
        this.homeY = y;
        this.x = x;
        this.y = y;
        this.color = color;
        this.vx = 0;
        this.vy = 0;
        this.size = CONFIG.particleSize;
    }
    
    // Scatter particle away from home position
    scatter(amount) {
        let angle = random(TWO_PI);
        let force = amount * CONFIG.maxParticleSpeed;
        this.vx += cos(angle) * force * random(0.5, 1.5);
        this.vy += sin(angle) * force * random(0.5, 1.5);
    }
    
    // Return particle to home position
    returnHome(strength) {
        let dx = this.homeX - this.x;
        let dy = this.homeY - this.y;
        this.vx += dx * strength;
        this.vy += dy * strength;
    }
    
    update(disperseAmount) {
        if (disperseAmount > 0.1) {
            // Scatter when close
            if (random() < 0.1) {
                this.scatter(disperseAmount);
            }
        } else {
            // Return home when far
            this.returnHome(0.1);
        }
        
        // Apply velocity with damping
        this.x += this.vx;
        this.y += this.vy;
        this.vx *= 0.92;
        this.vy *= 0.92;
        
        // Keep particles on screen
        this.x = constrain(this.x, 0, width);
        this.y = constrain(this.y, 0, height);
    }
    
    display() {
        noStroke();
        fill(this.color);
        circle(this.x, this.y, this.size);
    }
    
    // Update home position and color from video
    updateHome(x, y, color) {
        this.homeX = x;
        this.homeY = y;
        this.color = color;
    }
}

function preload() {
    let options = {
        maxFaces: 1,
        refineLandmarks: false,
        flipped: false
    };
    faceMesh = ml5.faceMesh(options);
}

function setup() {
    pixelDensity(1);
    let canvas = createCanvas(CONFIG.videoWidth, CONFIG.videoHeight);
    canvas.parent('canvas-container');
    
    statusElement = document.getElementById('status');
    updateStatus('Initializing...', '');
    
    video = createCapture(VIDEO);
    video.size(CONFIG.captureWidth, CONFIG.captureHeight);
    video.hide();
    
    faceMesh.detectStart(video, gotFaces);
    updateStatus('Model ready', 'ready');
    
    frameRate(30);
    
    // Initialize particles
    initParticles();
}

function initParticles() {
    particles = [];
    let cols = Math.ceil(sqrt(CONFIG.particleCount * (width / height)));
    let rows = Math.ceil(CONFIG.particleCount / cols);
    let spacingX = width / cols;
    let spacingY = height / rows;
    
    for (let i = 0; i < rows; i++) {
        for (let j = 0; j < cols; j++) {
            if (particles.length >= CONFIG.particleCount) break;
            let x = j * spacingX + spacingX / 2;
            let y = i * spacingY + spacingY / 2;
            particles.push(new Particle(x, y, color(255)));
        }
    }
}

function gotFaces(results) {
    faces = results;
}

function draw() {
    background(0);
    
    // Draw video
    image(video, 0, 0, width, height);
    
    if (faces.length > 0) {
        let face = faces[0];
        let bounds = getFaceBounds(face);
        
        // Scale bounds
        let scaleX = width / CONFIG.captureWidth;
        let scaleY = height / CONFIG.captureHeight;
        bounds.x *= scaleX;
        bounds.y *= scaleY;
        bounds.width *= scaleX;
        bounds.height *= scaleY;
        
        // Calculate distance
        let faceSize = (bounds.width / scaleX) * (bounds.height / scaleY);
        let normalizedSize = constrain(
            map(faceSize, CONFIG.minFaceSize, CONFIG.maxFaceSize, 0, 1), 
            0, 1
        );
        let curvedSize = pow(normalizedSize, 1.8);
        
        // Distance label
        let distanceLabel = normalizedSize < 0.25 ? 'FAR' : 
                          normalizedSize < 0.5 ? 'MEDIUM' : 
                          normalizedSize < 0.75 ? 'CLOSE' : 'VERY CLOSE';
        
        if (currentMode === 'mosaic') {
            // Mosaic mode
            if (curvedSize < CONFIG.clearThreshold) {
                updateStatus(`Clear | ${distanceLabel}`, 'ready');
            } else {
                let blockSize = map(curvedSize, CONFIG.clearThreshold, 1, 
                                   CONFIG.minBlockSize, CONFIG.maxBlockSize);
                blockSize = Math.floor(blockSize);
                applyMosaic(bounds, blockSize);
                updateStatus(`Mosaic: ${blockSize}px | ${distanceLabel}`, 'detecting');
            }
        } else {
            // Particle mode
            applyParticleEffect(bounds, curvedSize, distanceLabel);
        }
    } else {
        if (currentMode === 'particle') {
            // Still update particles when no face detected
            updateParticlesNoFace();
        }
        updateStatus('No face detected', 'ready');
    }
}

function getFaceBounds(face) {
    if (face.box) {
        return {
            x: Math.max(0, face.box.xMin - CONFIG.padding),
            y: Math.max(0, face.box.yMin - CONFIG.padding),
            width: Math.min(CONFIG.captureWidth - CONFIG.padding, face.box.width + CONFIG.padding * 2),
            height: Math.min(CONFIG.captureHeight - CONFIG.padding, face.box.height + CONFIG.padding * 2)
        };
    }
    
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (let kp of face.keypoints) {
        minX = Math.min(minX, kp.x);
        minY = Math.min(minY, kp.y);
        maxX = Math.max(maxX, kp.x);
        maxY = Math.max(maxY, kp.y);
    }
    
    return {
        x: Math.max(0, minX - CONFIG.padding),
        y: Math.max(0, minY - CONFIG.padding),
        width: Math.min(CONFIG.captureWidth - CONFIG.padding, maxX - minX + CONFIG.padding * 2),
        height: Math.min(CONFIG.captureHeight - CONFIG.padding, maxY - minY + CONFIG.padding * 2)
    };
}

// Mosaic effect
function applyMosaic(bounds, blockSize) {
    if (blockSize < 2) return;
    
    let x = Math.floor(constrain(bounds.x, 0, width - 1));
    let y = Math.floor(constrain(bounds.y, 0, height - 1));
    let w = Math.min(Math.floor(bounds.width), width - x);
    let h = Math.min(Math.floor(bounds.height), height - y);
    
    loadPixels();
    noStroke();
    
    for (let by = 0; by < h; by += blockSize) {
        for (let bx = 0; bx < w; bx += blockSize) {
            let sampleX = constrain(Math.floor(x + bx + blockSize / 2), 0, width - 1);
            let sampleY = constrain(Math.floor(y + by + blockSize / 2), 0, height - 1);
            
            let index = (sampleY * width + sampleX) * 4;
            fill(pixels[index], pixels[index + 1], pixels[index + 2]);
            
            let blockW = Math.min(blockSize, w - bx);
            let blockH = Math.min(blockSize, h - by);
            rect(x + bx, y + by, blockW, blockH);
        }
    }
}

// Particle effect
function applyParticleEffect(bounds, disperseAmount, distanceLabel) {
    // Load pixels for color sampling
    loadPixels();
    
    // Update particle colors and positions from video
    let particleIndex = 0;
    let cols = Math.ceil(sqrt(CONFIG.particleCount * (width / height)));
    let rows = Math.ceil(CONFIG.particleCount / cols);
    let spacingX = width / cols;
    let spacingY = height / rows;
    
    for (let i = 0; i < rows && particleIndex < particles.length; i++) {
        for (let j = 0; j < cols && particleIndex < particles.length; j++) {
            let x = Math.floor(j * spacingX + spacingX / 2);
            let y = Math.floor(i * spacingY + spacingY / 2);
            
            x = constrain(x, 0, width - 1);
            y = constrain(y, 0, height - 1);
            
            let index = (y * width + x) * 4;
            let c = color(pixels[index], pixels[index + 1], pixels[index + 2]);
            
            particles[particleIndex].updateHome(x, y, c);
            particleIndex++;
        }
    }
    
    // Check if particle is in face region
    let faceParticles = 0;
    
    // Clear canvas and draw particles
    background(0);
    
    for (let p of particles) {
        // Check if particle's home is in face bounds
        let inFace = p.homeX >= bounds.x && 
                    p.homeX <= bounds.x + bounds.width &&
                    p.homeY >= bounds.y && 
                    p.homeY <= bounds.y + bounds.height;
        
        if (inFace) {
            // Disperse particles in face region
            p.update(disperseAmount);
            faceParticles++;
        } else {
            // Keep non-face particles at home
            p.update(0);
        }
        
        p.display();
    }
    
    updateStatus(`Particles | ${distanceLabel}`, 'detecting');
}

// Update particles when no face detected
function updateParticlesNoFace() {
    loadPixels();
    
    let particleIndex = 0;
    let cols = Math.ceil(sqrt(CONFIG.particleCount * (width / height)));
    let rows = Math.ceil(CONFIG.particleCount / cols);
    let spacingX = width / cols;
    let spacingY = height / rows;
    
    for (let i = 0; i < rows && particleIndex < particles.length; i++) {
        for (let j = 0; j < cols && particleIndex < particles.length; j++) {
            let x = Math.floor(j * spacingX + spacingX / 2);
            let y = Math.floor(i * spacingY + spacingY / 2);
            
            x = constrain(x, 0, width - 1);
            y = constrain(y, 0, height - 1);
            
            let index = (y * width + x) * 4;
            let c = color(pixels[index], pixels[index + 1], pixels[index + 2]);
            
            particles[particleIndex].updateHome(x, y, c);
            particles[particleIndex].update(0);
            particleIndex++;
        }
    }
    
    background(0);
    for (let p of particles) {
        p.display();
    }
}

// Mode switching function (called from HTML buttons)
function setMode(mode) {
    currentMode = mode;
    
    // Update button styles
    document.getElementById('mosaicBtn').classList.toggle('active', mode === 'mosaic');
    document.getElementById('particleBtn').classList.toggle('active', mode === 'particle');
    
    // Reset particles when switching to particle mode
    if (mode === 'particle') {
        for (let p of particles) {
            p.x = p.homeX;
            p.y = p.homeY;
            p.vx = 0;
            p.vy = 0;
        }
    }
}

function updateStatus(message, className) {
    if (statusElement) {
        statusElement.textContent = message;
        statusElement.className = className;
    }
}