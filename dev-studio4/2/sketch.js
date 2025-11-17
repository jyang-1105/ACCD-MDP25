// Configuration
const CONFIG = {
    videoWidth: 640,
    videoHeight: 480,
    minFaceSize: 5000,      // Minimum face size (far away)
    maxFaceSize: 50000,     // Maximum face size (close up)
    minBlockSize: 2,        // Minimum mosaic block size (clear)
    maxBlockSize: 30,       // Maximum mosaic block size (pixelated)
    padding: 30             // Padding around face detection
};

// Global variables
let video;
let faceMesh;
let faces = [];
let statusElement;

function preload() {
    // Load FaceMesh model with optimized options
    let options = {
        maxFaces: 1,
        refineLandmarks: false,
        flipped: false
    };
    faceMesh = ml5.faceMesh(options);
}

function setup() {
    // Create canvas
    let canvas = createCanvas(CONFIG.videoWidth, CONFIG.videoHeight);
    canvas.parent('canvas-container');
    
    // Get status element
    statusElement = document.getElementById('status');
    updateStatus('Initializing...', '');
    
    // Initialize video capture
    video = createCapture(VIDEO);
    video.size(width, height);
    video.hide();
    
    // Start detecting faces
    faceMesh.detectStart(video, gotFaces);
    updateStatus('Model ready', 'ready');
}

function gotFaces(results) {
    // Callback function to receive face detection results
    faces = results;
}

function draw() {
    background(0);
    
    // Draw video feed
    image(video, 0, 0, width, height);
    
    // Process detected faces
    if (faces.length > 0) {
        for (let i = 0; i < faces.length; i++) {
            let face = faces[i];
            
            // Calculate face bounding box
            let bounds = getFaceBounds(face);
            
            // Calculate distance based on face size
            let faceSize = bounds.width * bounds.height;
            
            // Normalize face size to 0-1 range
            let normalizedSize = constrain(
                map(faceSize, CONFIG.minFaceSize, CONFIG.maxFaceSize, 0, 1), 
                0, 
                1
            );
            
            // Calculate mosaic block size: larger when closer
            let blockSize = map(
                normalizedSize, 
                0, 
                1, 
                CONFIG.minBlockSize, 
                CONFIG.maxBlockSize
            );
            blockSize = Math.floor(blockSize);
            
            // Apply optimized mosaic effect to face region
            applyMosaicToRegion(
                bounds.x, 
                bounds.y, 
                bounds.width, 
                bounds.height, 
                blockSize
            );
        }
        
        updateStatus(`Detecting ${faces.length} face${faces.length > 1 ? 's' : ''}`, 'detecting');
    } else {
        updateStatus('No face detected', 'ready');
    }
}

/**
 * Calculate bounding box for detected face using keypoints
 * @param {Object} face - Face detection result from ml5
 * @returns {Object} Bounding box with x, y, width, height
 */
function getFaceBounds(face) {
    // Use the box property from ml5 v1 for better performance
    if (face.box) {
        return {
            x: Math.max(0, face.box.xMin - CONFIG.padding),
            y: Math.max(0, face.box.yMin - CONFIG.padding),
            width: Math.min(width, face.box.width + CONFIG.padding * 2),
            height: Math.min(height, face.box.height + CONFIG.padding * 2)
        };
    }
    
    // Fallback to calculating from keypoints
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    
    for (let keypoint of face.keypoints) {
        minX = Math.min(minX, keypoint.x);
        minY = Math.min(minY, keypoint.y);
        maxX = Math.max(maxX, keypoint.x);
        maxY = Math.max(maxY, keypoint.y);
    }
    
    return {
        x: Math.max(0, minX - CONFIG.padding),
        y: Math.max(0, minY - CONFIG.padding),
        width: Math.min(width, maxX - minX + CONFIG.padding * 2),
        height: Math.min(height, maxY - minY + CONFIG.padding * 2)
    };
}

/**
 * Optimized mosaic effect using p5.js get() and set() methods
 * This is much faster than direct pixel manipulation
 * @param {number} x - Region x position
 * @param {number} y - Region y position
 * @param {number} w - Region width
 * @param {number} h - Region height
 * @param {number} blockSize - Size of mosaic blocks
 */
function applyMosaicToRegion(x, y, w, h, blockSize) {
    if (blockSize < 2) return; // Skip if block too small
    
    // Ensure coordinates are within canvas bounds
    x = Math.floor(Math.max(0, x));
    y = Math.floor(Math.max(0, y));
    w = Math.floor(Math.min(width - x, w));
    h = Math.floor(Math.min(height - y, h));
    
    // Process in blocks
    for (let by = 0; by < h; by += blockSize) {
        for (let bx = 0; bx < w; bx += blockSize) {
            // Sample color from center of block
            let sampleX = Math.floor(x + bx + blockSize / 2);
            let sampleY = Math.floor(y + by + blockSize / 2);
            
            // Ensure sample point is within bounds
            sampleX = constrain(sampleX, 0, width - 1);
            sampleY = constrain(sampleY, 0, height - 1);
            
            // Get color at sample point
            let c = get(sampleX, sampleY);
            
            // Fill the block with sampled color
            noStroke();
            fill(c);
            
            // Calculate actual block dimensions
            let blockW = Math.min(blockSize, w - bx);
            let blockH = Math.min(blockSize, h - by);
            
            // Draw block
            rect(x + bx, y + by, blockW, blockH);
        }
    }
}

/**
 * Update status message and styling
 * @param {string} message - Status message
 * @param {string} className - CSS class name
 */
function updateStatus(message, className) {
    if (statusElement) {
        statusElement.textContent = message;
        statusElement.className = className;
    }
}

/**
 * Draw debug information (optional - uncomment in draw() to use)
 * @param {Object} bounds - Face bounding box
 * @param {number} normalizedSize - Normalized face size
 * @param {number} blockSize - Current mosaic block size
 */
function drawDebugInfo(bounds, normalizedSize, blockSize) {
    push();
    fill(255);
    noStroke();
    textSize(12);
    textAlign(LEFT, TOP);
    
    let distance = normalizedSize > 0.5 ? 'CLOSE' : 'FAR';
    text(`Distance: ${distance}`, bounds.x, bounds.y - 30);
    text(`Mosaic: ${blockSize}px`, bounds.x, bounds.y - 15);
    
    // Draw bounding box
    noFill();
    stroke(255, 100);
    strokeWeight(2);
    rect(bounds.x, bounds.y, bounds.width, bounds.height);
    
    pop();
}