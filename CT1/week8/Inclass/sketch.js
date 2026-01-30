let handPose
let video
let hands = []
let thumbTip
let indexTip
let paddle = { x1: 0, y1: 0, x2: 0, y2: 0 }

let pong = {
  pos: null,
  vel: null,
  radius: 10,
  clr: null
}

let score = 0

function preload() {
  handPose = ml5.handPose()
}

function setup() {
  createCanvas(640, 480)
  video = createCapture(VIDEO)
  video.size(640, 480)
  video.hide()
  handPose.detectStart(video, gotHands)

  pong.pos = createVector(width / 2, height / 2)
  pong.vel = createVector(random(-3, 3), random(-3, 3))
  pong.clr = color(255, 0, 0)
}

function draw() {
  image(video, 0, 0, width, height)
  fill(pong.clr)
  noStroke()
  circle(pong.pos.x, pong.pos.y, pong.radius * 2)

  pong.pos.add(pong.vel)

  if (pong.pos.x - pong.radius <= 0 || pong.pos.x + pong.radius >= width) pong.vel.x *= -1
  if (pong.pos.y - pong.radius <= 0 || pong.pos.y + pong.radius >= height) pong.vel.y *= -1

  if (hands.length > 0 && thumbTip && indexTip) {
    fill(0, 0, 255)
    rectMode(CORNERS)
    rect(paddle.x1, paddle.y1, paddle.x2, paddle.y2)

    let left = min(paddle.x1, paddle.x2)
    let right = max(paddle.x1, paddle.x2)
    let top = min(paddle.y1, paddle.y2)
    let bottom = max(paddle.y1, paddle.y2)

    if (
      pong.pos.x + pong.radius > left &&
      pong.pos.x - pong.radius < right &&
      pong.pos.y + pong.radius > top &&
      pong.pos.y - pong.radius < bottom
    ) {
      pong.vel.x *= -1
      pong.vel.y *= -1
      score++
    }

    fill(0, 255, 0)
    circle(thumbTip.x, thumbTip.y, 10)
    circle(indexTip.x, indexTip.y, 10)
  }

  fill(255)
  textSize(20)
  textAlign(LEFT)
  text("Score: " + score, 10, 30)
}

function gotHands(results) {
  hands = results
  if (hands.length > 0) {
    thumbTip = hands[0].thumb_tip
    indexTip = hands[0].index_finger_tip
    if (thumbTip && indexTip) {
      paddle.x1 = thumbTip.x
      paddle.y1 = thumbTip.y
      paddle.x2 = indexTip.x
      paddle.y2 = indexTip.y
    }
  }
}
