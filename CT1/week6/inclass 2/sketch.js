let particles = [];

let gravity;

function setup() {
  createCanvas(400, 600);
  colorMode(HSB, TWO_PI, 1, 1);
  background(0, 0, 0.1);
}

function draw() {
  background(0, 0, 0.1, 0.2); 


  if (random() < 0.1) {
    particles.push(new Particle(random(width), 0));
  }

  let gravity = createVector(0, 0.8);

  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.applyForce(gravity); 
    p.move();
    p.display();

    if (!p.inBounds()) {
      particles.splice(i, 1);
    }
  }
}

