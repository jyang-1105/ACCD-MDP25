/* Ring Forest — 双环符号流（外=空气，内=地下）
   需求：
   - 健康区 顺时针；火灾区 逆时针
   - 两侧分开（各自扇区内运动）
   - 符号：'!', 'Me', '~', 'H₂O'
   - 背景：你的环形拼贴 PNG：forestRing.png
   调参热键见底部。
*/
let W=1400, H=850;
let CENTER={x:700,y:430};     // 环中心（按键可微调）
let OUTER_R=345;              // 外环半径（空气）
let INNER_R=275;              // 内环半径（地下）
let RING_ROT=-Math.PI/15;     // 整体旋转（弧度，负=顺时针）
let IMG_SCALE=1.0;            // 背景图缩放
let SHOW_DEBUG=false;         // D 开/关调试图层
let PAUSE=false;

let img;

// —— 定义两个“扇区”（角度以环心为参考；配合 RING_ROT 一起转）——
// 下面是假设：左 = 火灾；右 = 健康。可以在运行时用快捷键微调。
let FIRE_SECTOR   ={start:  Math.PI*0.70, end: Math.PI*1.30}; // 左半（逆时针流）
let HEALTHY_SECTOR={start: -Math.PI*0.30, end: Math.PI*0.30}; // 右半（顺时针流）

// 符号类型（颜色仅决定轨迹与文本颜色，背景色由你的PNG决定）
const TYPES = [
  {key:'ETH', label:'!',  col:'#E53935', speedOuter:2.1, speedInner:2.2, size:20, w:3.0},  // Ethylene
  {key:'Me',  label:'Me', col:'#FF7043', speedOuter:1.9, speedInner:2.0, size:18, w:2.4},  // Methyl salicylate
  {key:'GLV', label:'~',  col:'#FFB300', speedOuter:1.8, speedInner:1.9, size:16, w:2.0},  // GLVs
  {key:'H2O', label:'H₂O',col:'#9CCC65', speedOuter:1.6, speedInner:1.8, size:15, w:1.6},  // 水/资源
];

// 生成策略：火灾侧多 '!/Me/~'，健康侧多 'H₂O'
const SPAWN = [
  {type:'ETH', side:'fire',    p:0.20},
  {type:'Me',  side:'fire',    p:0.14},
  {type:'GLV', side:'fire',    p:0.12},
  {type:'H2O', side:'healthy', p:0.18},
  {type:'GLV', side:'healthy', p:0.10},
];

let particles=[];

function preload(){ img = loadImage('forestRing.png'); }

function setup(){
  createCanvas(W,H);
  textFont('Helvetica, Arial, sans-serif');
}

function draw(){
  if(!PAUSE){
    spawnParticles();     // 生成新符号
    particles.forEach(p=>p.step());
    particles = particles.filter(p=>!p.dead);
  }

  background(0);
  // 背景环形拼贴
  push();
  translate(CENTER.x, CENTER.y);
  rotate(RING_ROT);
  imageMode(CENTER);
  image(img, 0, 0, img.width*IMG_SCALE, img.height*IMG_SCALE);
  pop();

  // 画符号
  particles.forEach(p=>p.draw());

  if(SHOW_DEBUG) drawDebug();

  // HUD
  noStroke(); fill(255); textSize(12);
  text('中心: 方向键/WASD | 半径: [ / ] | 旋转: R/r | 扇区起止: 火灾(, .) 健康(; / \') | D 调试 | P 暂停', 16, height-14);
}

// ============== 粒子对象 ==============
class Particle{
  constructor(kind, ring, sector, dir){
    this.kind = TYPES.find(t=>t.key===kind);
    this.ring = ring; // 'outer' or 'inner'
    this.dir  = dir;  // +1 顺时针（健康） / -1 逆时针（火灾）

    this.theta = random(sector.start, sector.end);
    this.r = (ring==='outer')? OUTER_R : INNER_R;

    // 轻微抖动参数（空气 > 地下）
    this.radJit = (ring==='outer')? random(-6,6) : random(-2,2);
    this.tJit   = (ring==='outer')? random(-0.015,0.015) : random(-0.008,0.008);

    this.alpha = 255;
    this.age=0;
  }

  step(){
    const base = (this.ring==='outer')? this.kind.speedOuter : this.kind.speedInner;
    this.theta += (base/850)*this.dir + this.tJit*0.25;

    // 径向呼吸
    const baseR = (this.ring==='outer')? OUTER_R : INNER_R;
    this.r = baseR + sin(frameCount*0.02 + this.radJit)*((this.ring==='outer')? 2.2 : 1.2);

    this.age++;
    if(this.age>1200) this.alpha -= 3;
    if(this.alpha<=0) this.dead=true;
  }

  pos(){
    const a = this.theta + RING_ROT;
    return {
      x: CENTER.x + this.r * cos(a),
      y: CENTER.y + this.r * sin(a)
    };
  }

  draw(){
    const p = this.pos();
    // 轨迹点（粗细 = 信号强度）
    strokeWeight(this.kind.w);
    stroke(colorAlpha(this.kind.col, 130));
    point(p.x, p.y);

    // 文字符号
    noStroke();
    fill(colorAlpha(this.kind.col, this.alpha));
    textAlign(CENTER, CENTER);
    textSize(this.kind.size);
    text(this.kind.label, p.x, p.y);
  }
}

// ============== 生成逻辑（分区+方向） ==============
function spawnParticles(){
  SPAWN.forEach(s=>{
    if(random() < s.p*0.025){
      const sector = (s.side==='fire') ? FIRE_SECTOR : HEALTHY_SECTOR;
      const dir    = (s.side==='fire') ? -1 : +1; // 火灾逆时针；健康顺时针
      // 外环/内环都生成：外=空气，内=地下（地下生成率略低）
      particles.push(new Particle(s.type, 'outer', sector, dir));
      if(random()<0.7) particles.push(new Particle(s.type, 'inner', sector, dir));
    }
  });
}

// ============== 调试图层（环与扇区） ==============
function drawDebug(){
  push();
  translate(CENTER.x, CENTER.y);
  rotate(RING_ROT);
  noFill();

  // 外/内环
  stroke(255,80); ellipse(0,0, OUTER_R*2, OUTER_R*2);
  stroke(255,50); ellipse(0,0, INNER_R*2, INNER_R*2);

  // 扇区弧
  stroke('#E53935'); arc(0,0,(OUTER_R+10)*2,(OUTER_R+10)*2, FIRE_SECTOR.start, FIRE_SECTOR.end);  // 火灾
  stroke('#66BB6A'); arc(0,0,(OUTER_R+10)*2,(OUTER_R+10)*2, HEALTHY_SECTOR.start, HEALTHY_SECTOR.end); // 健康
  pop();
}

function colorAlpha(hex,a){
  const c=color(hex);
  return color(red(c),green(c),blue(c),a);
}

// ============== 调参快捷键 ==============
function keyPressed(){
  if(key==='P' || key==='p') PAUSE=!PAUSE;
  if(key==='D' || key==='d') SHOW_DEBUG=!SHOW_DEBUG;

  // 中心
  if(keyCode===LEFT_ARROW || key==='a') CENTER.x-=2;
  if(keyCode===RIGHT_ARROW|| key==='d') CENTER.x+=2;
  if(keyCode===UP_ARROW   || key==='w') CENTER.y-=2;
  if(keyCode===DOWN_ARROW || key==='s') CENTER.y+=2;

  // 半径
  if(key==='[') INNER_R-=2;
  if(key===']') OUTER_R+=2;

  // 旋转
  if(key==='R') RING_ROT+=0.02;
  if(key==='r') RING_ROT-=0.02;

  // 扇区角度微调（火灾：, .  健康：; '）
  if(key===',') FIRE_SECTOR.start-=0.03;
  if(key==='.') FIRE_SECTOR.end  +=0.03;
  if(key===';') HEALTHY_SECTOR.start-=0.03;
  if(key==="'") HEALTHY_SECTOR.end  +=0.03;
}

