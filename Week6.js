// -------- Globals & State
let stars = [];
let planets = [];
let comets = [];
let initialised = false;

// Offscreen slow layer (nebula + glow rings)
let gSlow = null;
let lastSlowEnergy = 0;
let slowNeedsRedraw = true;
let slowFrameSkip = 0;

// Wave EQ state
const EQ_BAR_COUNT = 48; 
let eqWaveBass = [];
let eqWaveTreble = [];
let nebulaEnergySmooth = 0;

// -------- Quality Presets
const QUALITY = 'high'; // 'high' | 'med' | 'low'
const Q = {
  high: { stars: 500, nebulaSteps: 148, ringSamples: 60, dust: 28, puffs: 2, streams: 1, layers: 2, useShadow: true, slowEvery: 2, energyThresh: 0.02 },
  med:  { stars: 400, nebulaSteps: 36, ringSamples: 40, dust: 20, puffs: 1, streams: 1, layers: 2, useShadow: true, slowEvery: 3, energyThresh: 0.03 },
  low:  { stars: 300, nebulaSteps: 28, ringSamples: 28, dust: 14, puffs: 1, streams: 1, layers: 1, useShadow: false, slowEvery: 4, energyThresh: 0.05 },
}[QUALITY];

// -------- Config
const PLANET_COUNT = 3;
const RING_TILT_DEG = 32; // shared ring/beam tilt

// -------- Core color
const CORE_COLOR_A = () => color(255, 196, 40);

// -------- Utilities
function W() { return (typeof canvasWidth !== 'undefined') ? canvasWidth : width; }
function H() { return (typeof canvasHeight !== 'undefined') ? canvasHeight : height; }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function randRange(a, b) { return random(a, b); } // unify on p5 random()

// -------- Classes
class Star {
  constructor(x, y, depth) {
    this.x = x; this.y = y; this.z = depth; // 0.3..1 for parallax
    this.baseSize = randRange(0.8, 2.8) * this.z;
    this.baseAlpha = randRange(70, 255) * this.z;
    this.lumBias = randRange(0.6, 1.5);
    this.phase = randRange(0, TWO_PI);
    this.speed = randRange(0.01, 0.04);
    const tint = randRange(-10, 10);
    this.r = clamp(245 + tint, 220, 255);
    this.g = clamp(245 + (tint > 0 ? tint * 0.6 : tint), 220, 255);
    this.b = 255;
    const ang = randRange(0, TWO_PI);
    this.vx = Math.cos(ang) * 0.15 * this.z;
    this.vy = Math.sin(ang) * 0.15 * this.z;
    this.isPlus = Math.random() < 0.08;
    if (this.isPlus) {
      this.plusLenBase = randRange(6, 13) * this.z;
      this.plusThick = randRange(1.1, 2.0);
    }
  }
  update(vocal, bass) {
    this.x += this.vx * (1 + bass * 0.003);
    this.y += this.vy * (1 + bass * 0.003);
    if (this.x < -5) this.x = W() + 5;
    if (this.x > W() + 5) this.x = -5;
    if (this.y < -5) this.y = H() + 5;
    if (this.y > H() + 5) this.y = -5;
    this.phase += this.speed;
    const twinkleAmp = map(vocal, 0, 100, 0.2, 1.6);
    this.twinkle = (Math.sin(this.phase) * 0.5 + 0.5) * twinkleAmp;
  }
  draw(other) {
    const hueShift = map(other, 0, 100, -15, 15);
    const a = clamp(this.baseAlpha * (0.5 + 0.5 * this.twinkle) * this.lumBias, 25, 255);
    const c = color(
      clamp(this.r + hueShift, 220, 255),
      clamp(this.g + hueShift * 0.4, 210, 255),
      clamp(this.b, 230, 255),
      a
    );
    if (this.isPlus && Q.useShadow) {
      push();
      const ctx = drawingContext; ctx.save();
      ctx.shadowBlur = 4;
      ctx.shadowColor = 'rgba(255,255,220,0.25)';
      stroke(red(c), green(c), blue(c), clamp(a * 1.1 + 20, 60, 255));
      strokeWeight(this.plusThick);
      const L = this.plusLenBase * (0.9 + 0.8 * this.twinkle);
      line(this.x - L * 0.6, this.y, this.x + L * 0.6, this.y);
      line(this.x, this.y - L * 0.6, this.x, this.y + L * 0.6);
      noStroke();
      fill(red(c), green(c), blue(c), clamp(a * 1.05, 60, 255));
      circle(this.x, this.y, this.baseSize * (1.2 + 0.6 * this.twinkle));
      ctx.restore();
      pop();
    } else {
      noStroke();
      fill(c);
      circle(this.x, this.y, this.baseSize * (0.9 + 0.3 * this.twinkle));
    }
  }
}

class Planet {
  constructor(x, y, r, colA, colB, hasRing = false, tilt = 20) {
    this.x = x; this.y = y; this.r = r;
    this.baseX = x; this.baseY = y;
    this.colA = colA; this.colB = colB;
    this.hasRing = hasRing;
    this.tilt = tilt;
    this.distScale = 1;
  }
  draw(midX, midY, bass) {
    const ctx = drawingContext; ctx.save();
    if (Q.useShadow) {
      const blur = map(bass, 0, 100, 0, 24);
      ctx.shadowBlur = blur;
      ctx.shadowColor = 'rgba(255,255,255,0.2)';
    }

    // Distance reaction
    const valueNorm = clamp(bass / 100, 0, 1);
    const targetScale = lerp(0.83, 1.28, valueNorm);
    this.distScale += (targetScale - this.distScale) * 0.14;
    const anchorX = midX + (this.baseX - midX) * this.distScale;
    const anchorY = midY + (this.baseY - midY) * this.distScale;
    this.x = anchorX; this.y = anchorY;

    // Lighting toward core
    const vx = midX - this.x, vy = midY - this.y;
    const vlen = Math.max(1e-3, Math.hypot(vx, vy));
    const ux = vx / vlen, uy = vy / vlen;
    const gx = this.x + ux * this.r * 0.35;
    const gy = this.y + uy * this.r * 0.35;

    const grad = ctx.createRadialGradient(gx, gy, this.r * 0.20, this.x, this.y, this.r);
    const coreCol = CORE_COLOR_A();
    const innerMix = 0.55;
    const c0 = color(
      lerp(red(this.colA), red(coreCol), innerMix),
      lerp(green(this.colA), green(coreCol), innerMix),
      lerp(blue(this.colA), blue(coreCol), innerMix),
      255
    );
    const c1 = color(red(this.colB), green(this.colB), blue(this.colB), 220);
    grad.addColorStop(0, `rgba(${red(c0)},${green(c0)},${blue(c0)},0.85)`);
    grad.addColorStop(1, `rgba(${red(c1)},${green(c1)},${blue(c1)},0.70)`);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
    ctx.fill();

    // Rim & glint
    push();
    blendMode(ADD);
    const angDeg = atan2(uy, ux);
    noFill();
    stroke(red(coreCol), green(coreCol), blue(coreCol), 60 + map(bass, 0, 100, 0, 45));
    strokeWeight(3);
    arc(this.x, this.y, this.r * 2.3, this.r * 2.3, angDeg - 24, angDeg + 24);
    noStroke();
    fill(red(coreCol), green(coreCol), blue(coreCol), 120);
    ellipse(this.x + ux * this.r * 0.30, this.y + uy * this.r * 0.30, this.r * 0.16, this.r * 0.16);
    pop();

    // Halo
    noFill();
    stroke(255, 255, 255, 25 + map(bass, 0, 100, 0, 55));
    strokeWeight(2);
    circle(this.x, this.y, this.r * 2);

    if (this.hasRing) {
      push();
      translate(this.x, this.y);
      rotate(this.tilt);
      noFill();
      const ringAlpha = 90 + map(bass, 0, 100, 0, 50);
      stroke(255, 230, 200, ringAlpha);
      strokeWeight(6);
      ellipse(0, 0, this.r * 2.2, this.r * 1.0);
      stroke(255, 255, 255, ringAlpha - 40);
      strokeWeight(2);
      ellipse(0, 0, this.r * 2.35, this.r * 1.05);
      pop();
    }
    ctx.restore();
  }
}

class Comet {
  constructor(x, y, vx, vy, life) {
    this.x = x; this.y = y; this.vx = vx; this.vy = vy;
    this.life = life; this.maxLife = life;
  }
  update() {
    this.x += this.vx; this.y += this.vy; this.life--; return this.life <= 0;
  }
  draw(drum) {
    const t = this.life / this.maxLife;
    const len = 60 * (0.3 + 0.7 * t);
    const px = this.x - this.vx * len * 0.1;
    const py = this.y - this.vy * len * 0.1;
    blendMode(ADD);
    strokeWeight(2 + map(drum, 0, 100, 0, 3));
    stroke(255, 240, 200, 180 * t);
    line(this.x, this.y, px, py);
    blendMode(BLEND);
    noStroke();
    fill(255, 255, 220, 220);
    circle(this.x, this.y, 4 + map(drum, 0, 100, 0, 3));
  }
}

// -------- Scene Init
function initSpaceScene() {
  stars = []; planets = []; comets = [];
  randomSeed(12345);
  noiseSeed(9876);

  // Stars
  for (let i = 0; i < Q.stars; i++) {
    const depth = randRange(0.3, 1);
    stars.push(new Star(randRange(0, W()), randRange(0, H()), depth));
  }

  // Planets
  const palettes = [
    [color(120, 200, 255), color(30, 50, 120)],
    [color(255, 210, 140), color(120, 60, 20)],
    [color(180, 160, 255), color(80, 50, 140)],
    [color(160, 255, 200), color(40, 120, 80)]
  ];
  const midX = W() / 2;
  const midY = H() / 2;
  const major = W() * 0.28;
  const minor = H() * 0.19;
  const angleOffset = -20;
  const ringAngleDeg = RING_TILT_DEG;
  const cosA = Math.cos(radians(ringAngleDeg));
  const sinA = Math.sin(radians(ringAngleDeg));
  for (let i = 0; i < PLANET_COUNT; i++) {
    const pal = random(palettes);
    const ang = radians(angleOffset + (360 / Math.max(1, PLANET_COUNT)) * i);
    const dx = major * Math.cos(ang);
    const dy = minor * Math.sin(ang);
    const rx = dx * cosA - dy * sinA;
    const ry = dx * sinA + dy * cosA;
    const x = midX + rx;
    const y = midY + ry;
    const maxSunSize = 220;
    const planetMax = Math.floor(maxSunSize * 0.42);
    const r = clamp(70 + 50 * Math.cos(ang + i * 0.4), 55, planetMax);
    const hasRing = (i % 3 === 1);
    const tilt = ringAngleDeg + randRange(-20, 20);
    planets.push(new Planet(x, y, r, pal[0], pal[1], hasRing, tilt));
  }

  // Offscreen slow layer init
  if (!gSlow || gSlow.width !== W() || gSlow.height !== H()) {
    gSlow = createGraphics(W(), H());
    gSlow.angleMode(DEGREES);
  }
  gSlow.clear(0, 0, 0, 0);
  lastSlowEnergy = 0;
  slowNeedsRedraw = true;
  slowFrameSkip = 0;

  initialised = true;
}

// -------- Music reset hook (if used externally)
function reset_music() { initSpaceScene(); }

// -------- Layout & Cover geometry
function computeCoverAndTitleGeometry() {
  let hasCover = false;
  let imgW=0, imgH=0, drawW=0, drawH=0, margin=32, x=0, y=0;
  let tx=0, ty=0, textBlockH=0, rightMargin=32, albumBottom=H() - margin;
  if (typeof coverImg !== 'undefined' && coverImg && coverImg.width && coverImg.height) {
    hasCover = true;
    imgW = coverImg.width; imgH = coverImg.height;
    const maxW = W() * 0.2;
    const maxH = H() * 0.38;
    const scale = Math.min(maxW / imgW, maxH / imgH, 1);
    drawW = imgW * scale; drawH = imgH * scale;
    x = margin; y = H() - drawH - margin;
    const titleSize = 40, artistSize = 24, lineGap = 6;
    textBlockH = titleSize + lineGap + artistSize;
    tx = x + drawW + 16;
    ty = y + (drawH - textBlockH) / 2;
    albumBottom = y + drawH;
  }
  return { hasCover, imgW, imgH, drawW, drawH, margin, x, y, tx, ty, textBlockH, rightMargin, albumBottom };
}

function drawCoverAndTitle(geom) {
  if (!geom.hasCover) return;
  push();
  noTint();
  imageMode(CORNER);
  image(coverImg, geom.x, geom.y, geom.drawW, geom.drawH);
  pop();
  push();
  const ctx = drawingContext; ctx.save();
  if (Q.useShadow) {
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 3;
  }
  fill(255); noStroke(); textAlign(LEFT, TOP);
  textStyle(BOLD); textSize(40);
  text('Galactic Eliminator', geom.tx, geom.ty);
  textStyle(NORMAL); textSize(24);
  text('Kobaryo', geom.tx, geom.ty + 40 + 6);
  ctx.restore();
  pop();
}

// -------- Drawing Blocks (fast layer)
function drawBackgroundStars(vocal, bass, other) {
  drawingContext.shadowBlur = 0;
  blendMode(ADD);
  for (let s of stars) { s.update(vocal, bass); s.draw(other); }
  blendMode(BLEND);
}

function maybeSpawnComet(drum) {
  const cometChance = map(drum, 0, 100, 0.002, 0.04);
  if (random() >= cometChance) return;
  const edge = int(random(4));
  let x, y, vx, vy; const speed = randRange(4, 8) * (1 + drum * 0.01);
  if (edge === 0) { x = -20; y = random(0, H()); vx = speed; vy = randRange(-2, 2); }
  else if (edge === 1) { x = W() + 20; y = random(0, H()); vx = -speed; vy = randRange(-2, 2); }
  else if (edge === 2) { x = random(0, W()); y = -20; vx = randRange(-2, 2); vy = speed; }
  else { x = random(0, W()); y = H() + 20; vx = randRange(-2, 2); vy = -speed; }
  const life = int(randRange(40, 90));
  comets.push(new Comet(x, y, vx, vy, life));
}

function drawComets(drum) {
  for (let i = comets.length - 1; i >= 0; i--) {
    const c = comets[i];
    if (c.update()) comets.splice(i, 1); else c.draw(drum);
  }
}

function drawPlanetsAll(midX, midY, bass) { for (let p of planets) p.draw(midX, midY, bass); }

function drawAngledBeam(midX, midY, drum) {
  push();
  translate(midX, midY); rotate(RING_TILT_DEG);
  const beamLen = H() * 0.85;
  const maxWidth = map(drum, 0, 100, 24, 100);
  const layers = 120; // slightly reduced
  for (let i = 0; i <= layers; i++) {
    const t = map(i, 0, layers, -1, 1);
    const y = t * (beamLen / 2);
    const fall = pow(1 - abs(t), 1.7);
    const halfW = maxWidth * fall;
    const alphaVal = 28 + 200 * fall;
    stroke(255, 220, 120, alphaVal);
    strokeWeight(1);
    line(-halfW, y, halfW, y);
  }
  stroke(255, 245, 220, 220);
  strokeWeight(3);
  line(0, -beamLen / 2, 0, beamLen / 2);
  strokeWeight(2);
  for (let i = 0; i < 60; i++) {
    const y = random(-beamLen * 0.5, beamLen * 0.5);
    const t = abs(y) / (beamLen * 0.5);
    const spread = lerp(maxWidth * 0.6, maxWidth * 0.2, t);
    const x = random(-spread, spread);
    const a = lerp(255, 80, t);
    stroke(255, 240, 180, a);
    point(x, y);
  }
  pop();
}

// -------- Slow Layer (offscreen): Nebula + Glow Rings
function redrawSlowLayer(midX, midY, drum, bass, other) {
  const pg = gSlow;
  pg.clear(0, 0, 0, 0);
  pg.push();
  pg.translate(midX, midY);
  pg.blendMode(ADD);

  // ---- Glow Rings
  const drumNorm = clamp(drum / 100, 0, 1);
  const wobFreq = 0.0015 + 0.004 * drumNorm;
  pg.push();
  pg.rotate(RING_TILT_DEG + 1.2 * Math.sin(frameCount * wobFreq));

  const energyRaw = (0.5 * bass + 0.5 * other) / 100; // 0..1
  nebulaEnergySmooth += (energyRaw - nebulaEnergySmooth) * 0.05;
  const energy = clamp(nebulaEnergySmooth * 0.7, 0, 1);
  const maxDim = Math.max(W(), H());
  const outerA = maxDim * 0.55, outerB = outerA * 0.42;
  const innerA = maxDim * 0.35, innerB = innerA * 0.33;
  const rotSpeed = map(drum, 0, 100, 0.0008, 0.0096);
  const dustSpeed = rotSpeed * 0.75;

  function drawNebulaRing(a, b, dir, jitterSeed) {
    const wobble = 0.02 * Math.sin(frameCount * 0.01 + jitterSeed);
    const aNow = a * (1 + wobble * 0.35);
    const bNow = b * (1 - wobble * 0.25);
    const samples = Q.ringSamples;
    const puffsPerSample = Q.puffs;
    const thickness = lerp(24, 50, energy);

    const ctxp = pg.drawingContext; 
    ctxp.save();
    if (Q.useShadow) {
      ctxp.shadowBlur = 3;
      ctxp.shadowColor = 'rgba(255,225,150,0.18)';
    }
    pg.noStroke();
    for (let i = 0; i < samples; i++) {
      const t = i / samples;
      const ang = t * TWO_PI + frameCount * rotSpeed * dir;
      const x = aNow * Math.cos(ang);
      const y = bNow * Math.sin(ang);

      // outward unit normal for ellipse
      let nx = x / (aNow * aNow);
      let ny = y / (bNow * bNow);
      const nlen = Math.sqrt(nx * nx + ny * ny) || 1;
      nx /= nlen; ny /= nlen;

      for (let k = 0; k < puffsPerSample; k++) {
        const seed = jitterSeed + i * 0.27 + k * 3.11;
        const offSign = (noise(seed) > 0.5) ? 1 : -1;
        const nmag = (noise(seed + frameCount * 0.004) - 0.5) * 2;
        const off = offSign * thickness * (0.35 + 0.65 * Math.abs(nmag));
        const px = x + nx * off + (noise(seed + 7.7) - 0.5) * 8;
        const py = y + ny * off + (noise(seed + 9.3) - 0.5) * 8;

        const fall = Math.exp(-Math.pow(off / (thickness * 0.9), 2));
        const size = (10 + 22 * fall) * (0.80 + 0.35 * energy);

        const cool = color(90, 120, 140, 10 + 18 * fall);
        const warm = color(240, 200, 120, 12 + 22 * fall);
        const mixAmt = 0.55 + 0.15 * Math.sin(ang - HALF_PI);
        const cc = lerpColor(cool, warm, mixAmt);
        pg.fill(red(cc), green(cc), blue(cc), alpha(cc) * (0.45 + 0.35 * energy));
        pg.circle(px, py, size);
      }
    }
    ctxp.restore();

    // subtle dust
    const dust = Q.dust;
    pg.noStroke();
    for (let d = 0; d < dust; d++) {
      const tt = d / dust;
      const ang = tt * TWO_PI + frameCount * dustSpeed * dir;
      const x = aNow * Math.cos(ang);
      const y = bNow * Math.sin(ang);
      const jitter = (noise(jitterSeed * 10 + d * 0.73) - 0.5) * 10;
      pg.fill(255, 210, 140, 12);
      pg.circle(x + jitter, y - jitter * 0.4, 1.4);
    }
  }

  drawNebulaRing(outerA, outerB, 1, 0.0);
  drawNebulaRing(innerA, innerB, -1, 2.3);
  pg.pop();

  // ---- Border Nebula (two bands)
  pg.push();
  pg.rotate(RING_TILT_DEG);
  pg.blendMode(ADD);

  const edgeMargin = 16;
  const len = Math.hypot(W(), H()) * 1.2;
  const steps = Q.nebulaSteps;
  const baseOffset = Math.min(W(), H()) * 0.5 - edgeMargin;
  const alphaBase = map(other, 0, 100, 14, 42);

  // Precompute falloff for steps (cache-like)
  const fallCache = [];
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1);
    fallCache[i] = pow(1 - abs(t * 2 - 1), 2.2);
  }

  const streamCountPerSide = Q.streams;
  const layersPerStream = Q.layers;

  const cools = [ color(80,120,150), color(60,100,120), color(90,140,170) ];
  const warms = [ color(255,230,150), color(250,210,120), color(255,200,110) ];

  for (let band = -1; band <= 1; band += 2) {
    for (let s = 0; s < streamCountPerSide; s++) {
      const streamShift = (streamCountPerSide === 1) ? 0 : map(s, 0, streamCountPerSide - 1, -1, 1);
      const yBase = band * baseOffset + streamShift * 18;
      const freqMod = 2.2 + s * 0.35;
      const timeMod = 0.004 + s * 0.0006;
      const thickness = map(bass, 0, 100, 26, 100) * (1.0 + 0.08 * s);

      for (let layer = 0; layer < layersPerStream; layer++) {
        const layerScale = 1 + layer * 0.45;
        const layerAlpha = alphaBase * (1 - layer * 0.28);
        const cool = cools[(s + layer) % cools.length];
        const warm = warms[(s + 2*layer) % warms.length];
        pg.noStroke();

        for (let i = 0; i < steps; i++) {
          const t = i / (steps - 1);
          const x = lerp(-len / 2, len / 2, t);
          const n = noise(t * freqMod + layer * 0.7, frameCount * timeMod + band * (1.6 + 0.2*s));
          const y = yBase + (n - 0.5) * thickness * layerScale;
          const fall = fallCache[i];
          const wob = 0.8 + 0.4 * noise(10 + layer * 9 + t * 4.3);
          const r = thickness * 0.40 * fall * wob;

          const warmBias = 0.55 + 0.15 * (1 - abs(t * 2 - 1));
          const c = lerpColor(cool, warm, warmBias);
          const a = layerAlpha * fall;
          pg.fill(red(c), green(c), blue(c), a);
          pg.ellipse(x, y, r * 1.9, r);
        }

        // dust speckles
        const dustCount = 8;
        for (let d = 0; d < dustCount; d++) {
          const tt = d / (dustCount - 1);
          const dx = lerp(-len / 2, len / 2, tt) + (noise(s*33 + layer*7 + d*0.17) - 0.5) * 18;
          const dn = noise(tt * (freqMod*0.8) + s*0.3 + layer*0.2, frameCount * (timeMod*0.7) + band*2.1);
          const dy = yBase + (dn - 0.5) * thickness * (0.65 + 0.3 * noise(5 + s*0.5 + layer*0.4));
          const df = pow(1 - abs(tt * 2 - 1), 2.0);
          const da = (alphaBase * 0.45) * df;
          pg.fill(255, 210, 140, da);
          pg.ellipse(dx, dy, 2.2 + 1.4 * noise(d*0.31), 2.2 + 1.4 * noise(d*0.29));
        }
      }
    }
  }
  pg.pop();
  pg.pop();

  lastSlowEnergy = energy;
  slowNeedsRedraw = false;
}

// -------- UI: Progress + Wave
function drawProgressAndWave(counter, geom, vocal, drum, bass, other) {
  const rightMargin = geom.rightMargin;
  const barH = 10;
  if (!geom.hasCover) return;
  const leftX = geom.tx;
  const rightX = W() - rightMargin;
  const barY = geom.albumBottom - barH / 2;
  const barW = Math.max(50, rightX - leftX);

  let totalSlices = (typeof volume_table_length !== 'undefined' && volume_table_length > 0) ? volume_table_length : 0;
  let progress = 0;
  if (typeof editorMode !== 'undefined' && editorMode) progress = 0; 
  else if (totalSlices > 0) progress = clamp((counter + 1) / totalSlices, 0, 1);

  const eqGap = 12; const eqBaseY = barY - eqGap; const eqMaxH = 112;
  const N = EQ_BAR_COUNT;
  if (!Array.isArray(eqWaveBass) || eqWaveBass.length !== N) eqWaveBass = new Array(N).fill(0);
  if (!Array.isArray(eqWaveTreble) || eqWaveTreble.length !== N) eqWaveTreble = new Array(N).fill(0);
  const dx = barW / (N - 1);

  for (let i = 0; i < N; i++) {
    const t = N > 1 ? i / (N - 1) : 0;
    const lowW  = Math.exp(-Math.pow((t - 0.12) / 0.28, 2));
    const midW  = Math.exp(-Math.pow((t - 0.50) / 0.30, 2));
    const highW = Math.exp(-Math.pow((t - 0.88) / 0.28, 2));
    const bassNorm = clamp(bass / 100, 0, 1);
    const drumNorm = clamp(drum / 100, 0, 1);
    const vocalNorm = clamp(vocal / 100, 0, 1);
    const otherNorm = clamp(other / 100, 0, 1);
    let targetBassH   = eqMaxH * (0.90 * bassNorm * lowW + 0.35 * (0.6 * drumNorm + 0.4 * vocalNorm) * midW);
    let targetTrebleH = eqMaxH * (0.90 * otherNorm * highW + 0.30 * (0.6 * drumNorm + 0.4 * vocalNorm) * midW);
    const wavePhase = frameCount * 0.6;
    targetBassH   *= 0.85 + 0.15 * Math.sin(wavePhase * 0.012 + t * 5.0);
    targetTrebleH *= 0.85 + 0.15 * Math.cos(wavePhase * 0.015 + t * 6.0);
    const k = 0.28;
    eqWaveBass[i]   += (targetBassH - eqWaveBass[i]) * k;
    eqWaveTreble[i] += (targetTrebleH - eqWaveTreble[i]) * k;
  }

  // bass area
  push(); noStroke(); fill(255, 170, 50, 140);
  beginShape();
  for (let i = 0; i < N; i++) { vertex(leftX + i * dx, eqBaseY - eqWaveBass[i]); }
  vertex(leftX + (N - 1) * dx, eqBaseY); vertex(leftX, eqBaseY);
  endShape(CLOSE); pop();

  // treble line
  push(); const ctx2 = drawingContext; ctx2.save(); 
  if (Q.useShadow) { ctx2.shadowBlur = 6; ctx2.shadowColor = 'rgba(255,220,120,0.55)'; }
  noFill(); stroke(255, 241, 118, 230); strokeWeight(3); beginShape();
  for (let i = 0; i < N; i++) { vertex(leftX + i * dx, eqBaseY - (eqWaveBass[i] + eqWaveTreble[i] * 0.35)); }
  endShape(); ctx2.restore(); pop();

  // progress
  noStroke(); fill(255, 255, 255, 60);
  rect(leftX, barY - barH / 2, barW, barH, barH / 2);
  const filledW = barW * progress;
  fill(255, 204, 0, 220);
  rect(leftX, barY - barH / 2, filledW, barH, barH / 2);
  fill(255, 220, 120, 255);
  circle(leftX + filledW, barY, barH * 1.8);
}

// -------- Core
function drawCentralCore_Simple(midX, midY, drum, bass, other) {
  const coreCol = CORE_COLOR_A();
  const sunSize = map(drum, 0, 100, 70, 220);
  const strokeThickness = map(bass, 0, 100, 1, 70);
  const r = red(coreCol), g = green(coreCol), b = blue(coreCol);

  //Glow
  push();
  blendMode(ADD);
  const ctxGlow = drawingContext; ctxGlow.save();
  const energy = clamp((0.6 * bass + 0.4 * (other || 0)) / 100, 0, 1);
  const innerR = sunSize * 0.35;
  const outerR = sunSize * (1.4 + 0.5 * energy);
  const grad = ctxGlow.createRadialGradient(midX, midY, innerR, midX, midY, outerR);
  grad.addColorStop(0.0, `rgba(${r},${g},${b},0.45)`);
  grad.addColorStop(0.4, `rgba(${r},${g},${b},0.20)`);
  grad.addColorStop(1.0, `rgba(${r},${g},${b},0.0)`);
  ctxGlow.fillStyle = grad;
  ctxGlow.beginPath();
  ctxGlow.arc(midX, midY, outerR, 0, Math.PI * 2);
  ctxGlow.fill();
  ctxGlow.restore();
  pop();

  // Core body with soft shadow
  const ctx = drawingContext; ctx.save();
  if (Q.useShadow) {
    ctx.shadowBlur = map(bass, 0, 100, 6, 18);
    ctx.shadowColor = `rgba(${r},${g},${b},0.65)`;
  }
  noStroke(); fill(r, g, b, 255);
  circle(midX, midY, sunSize * 0.55);
  ctx.restore();

  // Pulsing rings
  for (let i = 0; i <= 7; i++) {
    let c = color(coreCol); c.setAlpha(map(i, 0, 7, 230, 60));
    stroke(c); strokeWeight(map(i, 0, 7, strokeThickness, 1));
    ellipse(midX, midY, sunSize - i * 50, sunSize - i * 50);
  }
}

// -------- Frame Entry
function draw_one_frame(words, vocal, drum, bass, other, counter) {
  if (!initialised) initSpaceScene();
  background(6);
  angleMode(DEGREES);
  if (gSlow) gSlow.angleMode(DEGREES);

  const midX = W() / 2; 
  const midY = H() / 2;

  // ----- Offscreen slow layer update policy
  const energyRaw = (0.5 * bass + 0.5 * other) / 100;
  const energyDelta = Math.abs(energyRaw - lastSlowEnergy);

  slowNeedsRedraw = slowNeedsRedraw || (energyDelta > Q.energyThresh);
  if (++slowFrameSkip >= Q.slowEvery) { slowNeedsRedraw = true; slowFrameSkip = 0; }

  if (slowNeedsRedraw) {
    redrawSlowLayer(midX, midY, drum, bass, other);
  }

  // ----- Fast layer
  const geom = computeCoverAndTitleGeometry();

  // 1) stars
  drawBackgroundStars(vocal, bass, other);

  // 2) composite slow layer (nebula + glow rings)
  if (gSlow) {
    push();
    blendMode(ADD);
    image(gSlow, 0, 0);
    blendMode(BLEND);
    pop();
  }

  // 3) comets
  maybeSpawnComet(drum); 
  drawComets(drum);

  // 4) planets
  drawPlanetsAll(midX, midY, bass);

  // 5) angled beam (dynamic → fast layer)
  drawAngledBeam(midX, midY, drum);

  // 6) core
  drawCentralCore_Simple(midX, midY, drum, bass, other);

  // 7) UI
  drawProgressAndWave(counter, geom, vocal, drum, bass, other);
  drawCoverAndTitle(geom);
}


