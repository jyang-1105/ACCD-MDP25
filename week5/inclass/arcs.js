let numArcs = 10;        
let initRadius;         
let strWeight = 20;     

function setup() {
  createCanvas(800, 800);
  colorMode(HSB, TWO_PI, 1, 1); 
  initRadius = width * 0.1;     
  noFill();                     
}

function draw() {
  background(0);
  strokeWeight(strWeight);

  for (let i = 0; i < numArcs; i++) {
    stroke(i * 0.5, 1, 1);    

    push();
    translate(width * 0.5, height * 0.5);  

    arc(
      0, 0,
      initRadius + i * strWeight * 2,
      initRadius + i * strWeight * 2,
      HALF_PI + QUARTER_PI,      
      TWO_PI + QUARTER_PI        
    );

    pop();
  }
}
