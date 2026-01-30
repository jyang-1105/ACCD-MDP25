let numLines = 10;

function setup() {
  createCanvas(400, 400);
  colorMode(HSB, TWO_PI, 1, 1);
}

function draw() {
  background(TWO_PI * 0.75, 0.2, 0.9);

  
  push();
  rotate(QUARTER_PI * 0.2);
  stroke(0, 0, 0.3);
  strokeWeight(1);
  drawGrid(20);
  pop();

  push();
  translate(width * 0.5, height * 0.5);
  rotate(QUARTER_PI);
  stroke(TWO_PI * 0.6, 0.8, 0.9);
  strokeWeight(2);
  drawGrid(20);
  noFill();
  rectMode(CENTER);
  rect(0, 0, 100, 100);
  pop();
}

function drawGrid(numLines) {

  for (let y = 0; y <= numLines; y++) {
    line(0, y * height / numLines, width, y * height / numLines);
  }

  for (let x = 0; x <= numLines; x++) {
    line(x * width / numLines, 0, x * width / numLines, height);
  }
}
