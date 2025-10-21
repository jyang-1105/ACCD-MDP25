/* Forest Signaling Map — revert ring size, enlarge path radius slightly (with caps)
   - 外/内环尺寸回到之前版本：外(0.54,0.315,-0.075)，内(0.33,0.20,+0.21)
   - 仅放大“路径半径”（outerPathGain / innerPathGain），并用像素带宽 bandPx 限制
   - 图例固定在图像下方，完整显示；背景柔白；速度/频度保持真实感设定
*/

let img;

// 画布高度保留较高，保证图例完整显示
let cw = 1280, ch = 980;

let cx, cy, drawW, drawH;

// 椭圆轴与偏移（恢复到你之前满意的一版）
let aOuter, bOuter, aInnerFlow, bInnerFlow, rot;
let OUTER_DY, INNER_DY;

// 仅放大“路径半径”的系数（不会改变环的范围）
const outerPathGain = 1.06;  // 外环路径半径微增（≈+6%）
const innerPathGain = 1.08;  // 内环路径半径微增（≈+8%）
const bandPx        = 12;    // 最多只比原轨道外扩 12px，避免“范围变大”的观感

// 扇区
const FIRE_SECTOR    = { start: 0.65 * Math.PI, end: 1.35 * Math.PI };   // 左
const HEALTHY_SECTOR = { start:-0.35 * Math.PI, end: 0.35 * Math.PI };   // 右

// —— 外环（空气）物质 —— //
const AIR_TYPES = [
  {key:'ETH',  label:'!  Ethylene',           col:'#E53935', speed:2.2, size:18, w:2.6},
  {key:'MeSA', label:'Me  Methyl salicylate', col:'#FF7043', speed:2.0, size:16, w:2.2},
  {key:'GLV',  label:'~  GLVs',               col:'#FFB300', speed:2.5, size:15, w:1.9},
  {key:'TERP', label:'Terp  terpenes',        col:'#F57F17', speed:1.7, size:14, w:1.8},
  {key:'SMK',  label:'·  smoke',              col:'#616161', speed:1.6, size:13, w:1.5},
  {key:'CO2',  label:'CO₂',                   col:'#9E9E9E', speed:1.7, size:12, w:1.3},
  {key:'H2Ov', label:'H₂O↑  vapor',           col:'#90CAF9', speed:1.7, size:12, w:1.3},
];

// —— 内环（地下）物质 —— //
const UNDER_TYPES = [
  {key:'H2O',  label:'H₂O  water',        col:'#2E7D32', speed:1.7, size:14, w:1.5},
  {key:'Suc',  label:'Suc  sugars',       col:'#388E3C', speed:1.6, size:13, w:1.4},
  {key:'AA',   label:'AA  amino acids',   col:'#43A047', speed:1.5, size:12, w:1.3},
  {key:'N',    label:'N  nitrogen',       col:'#4CAF50', speed:1.4, size:12, w:1.3},
  {key:'P',    label:'P  phosphorus',     col:'#66BB6A', speed:1.3, size:12, w:1.3},
  {key:'K',    label:'K  potassium',      col:'#81C784', speed:1.3, size:12, w:1.3},
  {key:'ABA',  label:'ABA',               col:'#1B5E20', speed:1.2, size:12, w:1.3},
  {key:'JA',   label:'JA',                col:'#2E7D32', speed:1.2, size:12, w:1.3},
  {key:'SA',   label:'SA',                col:'#33691E', speed:1.2, size:12, w:1.3},
  {key:'IAA',  label:'IAA',               col:'#00796B', speed:1.2, size:12, w:1.2},
  {key:'CK',   label:'CK',                col:'#00838F', speed:1.2, size:12, w:1.2},
  {key:'SL',   label:'SL',                col:'#0097A7', speed:1.2, size:12, w:1.2},
  {key:'e',    label:'e⁻  electrical',    col:'#00695C', speed:2.4, size:11, w:1.2},
  {key:'EX',   label:'Ex  root exudates', col:'#558B2F', speed:1.1, size:11, w:1.1},
];

// 频度
const SPAWN_OUTER = [
  {type:'ETH',  side:'fire',    p:0.32},
  {type:'GLV',  side:'fire',    p:0.28},
  {type:'MeSA', side:'fire',    p:0.20},
  {type:'TERP', side:'fire',    p:0.15},
  {type:'SMK',  side:'fire',    p:0.35},
  {type:'CO2',  side:'fire',    p:0.22},
  {type:'H2Ov', side:'fire',    p:0.18},
  {type:'GLV',  side:'healthy', p:0.08},
  {type:'H2Ov', side:'healthy', p:0.10},
  {type:'CO2',  side:'healthy', p:0.08},
];
const SPAWN_INNER = [
  {type:'H2O',  side:'healthy', p:0.35},
  {type:'Suc',  side:'healthy', p:0.28},
  {type:'AA',   side:'healthy', p:0.18},
  {type:'N',    side:'healthy', p:0.16},
  {type:'P',    side:'healthy', p:0.12},
  {type:'K',    side:'healthy', p:0.12},
  {type:'EX',   side:'healthy', p:0.10},
  {type:'e',    side:'healthy', p:0.05},
  {type:'IAA',  side:'healthy', p:0.08},
  {type:'CK',   side:'healthy', p:0.08},
  {type:'SL',   side:'healthy', p:0.07},
  {type:'H2O',  side:'fire',    p:0.15},
  {type:'Suc',  side:'fire',    p:0.12},
  {type:'N',    side:'fire',    p:0.10},
  {type:'P',    side:'fire',    p:0.09},
  {type:'K',    side:'fire',    p:0.09},
  {type:'EX',   side:'fire',    p:0.10},
  {type:'e',    side:'fire',    p:0.10},
  {type:'ABA',  side:'fire',    p:0.18},
  {type:'JA',   side:'fire',    p:0.18},
  {type:'SA',   side:'fire',    p:0.16},
];

let particles = [];

function preload(){ img = loadImage('forestRing.png'); }

function setup(){
  createCanvas(cw, ch);
  imageMode(CENTER);
  textFont('Helvetica, Arial, sans-serif');
  smooth();

  // 图片：安全适配 → 72% 缩放（给下方图例留白）
  const s0 = Math.min((width*0.9)/img.width, (height*0.9)/img.height);
  const SCALE_K = 0.72;
  const s  = s0 * SCALE_K;
  drawW = img.width * s;
  drawH = img.height * s;

  // 上移一些，为下方图例留空间
  cx = width/2; 
  cy = height/2 - 20;

  // —— 恢复“之前”的环尺寸与位置 —— //
  aOuter   = drawW * 0.54;
  bOuter   = drawH * 0.315;
  OUTER_DY = -drawH * 0.075;   // 外环上移，停在树冠上沿一圈

  aInnerFlow = drawW * 0.33;
  bInnerFlow = drawH * 0.20;
  INNER_DY   =  drawH * 0.21;  // 内环下移，洞内“地下流”

  rot = -0.06; // 轻微逆时针匹配构图
  frameRate(60);
}

function draw(){
  background(252); // 柔白

  drawHeader();

  // 背景拼贴（柔和阴影）
  drawShadow(() => image(img, cx, cy, drawW, drawH), 8, 0, 6, color(0,0,0,20));

  // 生成/更新/绘制
  spawnOuter();  spawnInner();
  particles.forEach(p => p.step());
  particles = particles.filter(p => !p.dead);
  particles.forEach(p => p.draw());

  // 图例：固定在下方、双列、完整可见
  const imgBounds = {left: cx - drawW/2, right: cx + drawW/2, top: cy - drawH/2, bottom: cy + drawH/2};
  drawLegendTwoColsBelow(imgBounds);
}

/* ===== 粒子 ===== */
class Particle{
  constructor(kind, ring, side){
    this.kind = kind;
    this.ring = ring; this.side = side;
    this.dir  = (side==='fire') ? -1 : +1;
    const sec = (side==='fire') ? FIRE_SECTOR : HEALTHY_SECTOR;
    this.t    = random(sec.start, sec.end);
    this.alpha= 255; this.age=0;
    this.tJit   = (ring==='outer') ? random(-0.010,0.010) : random(-0.006,0.006);
    this.breath = (ring==='outer') ? 1.0 : 0.45;
  }
  step(){
    const sec = (this.side==='fire') ? FIRE_SECTOR : HEALTHY_SECTOR;
    this.t += (this.kind.speed/900) * this.dir + this.tJit * 0.25;
    const span = sec.end - sec.start;
    while (this.t < sec.start) this.t += span;
    while (this.t > sec.end)   this.t -= span;
    this.age++; if(this.age>1100) this.alpha -= 3;
    if(this.alpha<=0) this.dead = true;
  }
  pos(){
    // 基础椭圆坐标
    const aBase = (this.ring==='outer') ? aOuter     : aInnerFlow;
    const bBase = (this.ring==='outer') ? bOuter     : bInnerFlow;
    const dy    = (this.ring==='outer') ? OUTER_DY   : INNER_DY;

    const yb = bBase + Math.sin(frameCount*0.02)*this.breath;
    let x0 = aBase * Math.cos(this.t);
    let y0 = yb    * Math.sin(this.t);

    // —— 仅放大“路径半径”（带像素上限），不改变环的总体范围 —— //
    const gain = (this.ring==='outer') ? outerPathGain : innerPathGain;
    const r    = Math.hypot(x0, y0);          // 原半径
    const rNew = r * gain;                    // 放大后的半径
    const rCap = r + bandPx;                  // 最多外扩 bandPx 像素
    const rUse = Math.min(rNew, rCap);
    const scale = r > 0 ? (rUse / r) : 1.0;   // 实际缩放（若r=0则不动）

    x0 *= scale;
    y0 *= scale;

    // 旋转 + 平移
    const xr = x0 * Math.cos(rot) - y0 * Math.sin(rot);
    const yr = x0 * Math.sin(rot) + y0 * Math.cos(rot);
    return { x: cx + xr, y: cy + yr + dy };
  }
  draw(){
    const p = this.pos();
    strokeWeight(this.kind.w);
    stroke(colorA(this.kind.col, 90));
    point(p.x, p.y);
    noStroke();
    fill(colorA(this.kind.col, this.alpha));
    textAlign(CENTER, CENTER);
    const short = this.kind.label.split('  ')[0];
    textSize(this.kind.size);
    text(short, p.x, p.y);
  }
}

/* ===== 生成 ===== */
function spawnOuter(){ SPAWN_OUTER.forEach(s=>{ if (random()<s.p*0.02){
  const tdef=AIR_TYPES.find(t=>t.key===s.type); particles.push(new Particle(tdef,'outer',s.side)); }});}
function spawnInner(){ SPAWN_INNER.forEach(s=>{ if (random()<s.p*0.02){
  const tdef=UNDER_TYPES.find(t=>t.key===s.type); particles.push(new Particle(tdef,'inner',s.side)); }});}

/* ===== 标题 + 英文描述 ===== */
function drawHeader(){
  const padX = 26, padY = 22, maxW = 520;
  noStroke();
  fill(20); textAlign(LEFT, TOP); textSize(24);
  text('Forest Signaling Map', padX, padY);
  fill(90); textSize(13);
  const caption = "Airborne alerts vs underground exchange. Fire-distressed trees emit volatile warnings, while healthy stands share water, sugars, and minerals through roots and fungi.";
  drawWrappedText(caption, padX, padY+30, maxW, 18);
  stroke(245); line(padX, padY+86, padX+maxW, padY+86);
}

/* ===== 图例：固定下方，双列，动态高度 ===== */
function drawLegendTwoColsBelow(imgB){
  const pad = 16;
  const cardW = Math.min(width - 48, 740);
  const x = (width - cardW)/2;
  const y = imgB.bottom + 28;

  textAlign(LEFT, TOP);
  textSize(12);
  const headerH = 18;
  const subH    = 16;
  const lineH   = 15;
  const gutter  = 20;
  const innerW  = cardW - pad*2;

  const outerItems = [
    ['!  Ethylene', '#E53935'], ['Me  Methyl salicylate', '#FF7043'],
    ['~  GLVs', '#FFB300'],     ['Terp  terpenes', '#F57F17'],
    ['·  smoke', '#616161'],    ['CO₂', '#9E9E9E'],
    ['H₂O↑  vapor', '#90CAF9']
  ];
  const innerItems = [
    ['H₂O  water','#2E7D32'],['Suc  sugars','#388E3C'],['AA  amino acids','#43A047'],
    ['N  nitrogen','#4CAF50'],['P  phosphorus','#66BB6A'],['K  potassium','#81C784'],
    ['ABA','#1B5E20'],['JA','#2E7D32'],['SA','#33691E'],['IAA','#00796B'],
    ['CK','#00838F'],['SL','#0097A7'],['e⁻  electrical','#00695C'],['Ex  root exudates','#558B2F']
  ];

  const rowsOuter = Math.ceil(outerItems.length/2);
  const rowsInner = Math.ceil(innerItems.length/2);
  const contentH =
      headerH + pad/2 +
      subH + rowsOuter*lineH +
      10 +
      subH + rowsInner*lineH;
  const cardH = contentH + pad*1.5;

  drawShadow(()=>{ fill(255); noStroke(); rect(x, y, cardW, cardH, 8); }, 8, 0, 6, color(0,0,0,20));

  let yy = y + pad;
  fill(20); textSize(12); text('Legend', x+pad, yy); yy += headerH;

  fill(120); textSize(11); text('Outer (air):', x+pad, yy); yy += subH;
  yy = drawTwoColItems(outerItems, x+pad, yy, innerW, lineH, gutter);

  yy += 10;
  fill(120); text('Inner (underground):', x+pad, yy); yy += subH;
  drawTwoColItems(innerItems, x+pad, yy, innerW, lineH, gutter);
}

// 两列渲染
function drawTwoColItems(items, x, y, innerW, lineH, gutter){
  const colW = (innerW - gutter) / 2;
  const left = x, right = x + colW + gutter;
  let yL = y, yR = y;

  items.forEach((pair, i)=>{
    const [label, col] = pair;
    fill(col);
    if (i % 2 === 0){
      drawWrappedText(label, left, yL, colW, lineH);
      yL += lineH;
    }else{
      drawWrappedText(label, right, yR, colW, lineH);
      yR += lineH;
    }
  });
  return Math.max(yL, yR);
}

// 文本换行
function drawWrappedText(str, x, y, maxW, lineH){
  const words = str.split(' ');
  let line = '', yy = y;
  textAlign(LEFT, TOP);
  for (let i=0;i<words.length;i++){
    let test = line ? line + ' ' + words[i] : words[i];
    if (textWidth(test) > maxW){
      text(line, x, yy);
      line = words[i];
      yy += lineH;
    } else {
      line = test;
    }
  }
  if (line) text(line, x, yy);
}

// 阴影 & 颜色
function drawShadow(drawFn, blur, dx, dy, col){
  push(); drawingContext.save();
  drawingContext.shadowBlur=blur;
  drawingContext.shadowOffsetX=dx;
  drawingContext.shadowOffsetY=dy;
  drawingContext.shadowColor=col.toString();
  drawFn(); drawingContext.restore(); pop();
}
function colorA(hex,a){ const c=color(hex); return color(red(c), green(c), blue(c), a); }
