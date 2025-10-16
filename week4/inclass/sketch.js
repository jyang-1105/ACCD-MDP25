let posX
let posY

let VelX 
let VelY

let radius = 20

function setup() {
  createCanvas(600, 600)

  colorMode=(HSB, width, 100, 100)
  posX = width*0.5
  posY = height*0.5


  VelX = -2
  VelY = 3
}

 function draw() {
  posX = posX + VelX
  posY += VelY

  if (posY + radius >=height || posY -radius <=0){
    VelY = VelY * -1
  }

  if (posX +radius >=width || posX -radius <=0){
    VelX = VelX * -1
  }
   background(0, 0, 85)

   noStroke()

   fill(posX,0,250);

   circle(posX, posY,radius * 2);

   stroke(50,200,250);
   strokeWeight(4);

    fill(width * 0.75,100,100);
   rect(width*0.5 -50, height*0.5 -50, 100, 100)
 }

