
// Week6.js (refactored)
// Visualizer: Space scene with central core, beam, planets, stars, comets, progress slider and wave EQ
// Design preserved; code organized into small, readable functions.

// =====================
// Globals & State
// =====================
let stars = [];
let planets = [];
let comets = [];
let initialised = false;

// Wave EQ state
const EQ_BAR_COUNT = 48; // smoother wave
let eqWaveBass = [];
let eqWaveTreble = [];
let nebulaEnergySmooth = 0;

// =====================
// Config
// =====================
const STAR_COUNT = 600;
const PLANET_COUNT = 3;

// Core colors (yellow/amber)
const CORE_COLOR_A = () => color(255, 196, 40); // deeper amber

// =====================
// Utilities
// =====================
function randRange(a, b) { return a + Math.random() * (b - a); }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

// =====================
// Classes
// =====================
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
    // Some stars become '+' shaped twinklers
    this.isPlus = Math.random() < 0.08;
    if (this.isPlus) {
      this.plusLenBase = randRange(6, 13) * this.z;
      this.plusThick = randRange(1.1, 2.0);
    }
  }
  update(vocal, bass) {
    this.x += this.vx * (1 + bass * 0.003);
    this.y += this.vy * (1 + bass * 0.003);
    if (this.x < -5) this.x = width + 5;
    if (this.x > width + 5) this.x = -5;
    if (this.y < -5) this.y = height + 5;
    if (this.y > height + 5) this.y = -5;
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
    if (this.isPlus) {
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
    this.baseX = x; this.baseY = y; // base anchor relative to core
    this.colA = colA; this.colB = colB;
    this.hasRing = hasRing;
    this.tilt = tilt;
    this.distScale = 1; // smoothed distance scale
  }
  draw(midX, midY, bass, other) {
    const amt = map(other, 0, 100, 0, 1);
    const base = lerpColor(this.colA, this.colB, 0.4 + 0.2 * Math.sin(frameCount * 0.01));
    const bright = lerpColor(base, color(255, 255, 255), map(bass, 0, 100, 0.0, 0.25));
    const ctx = drawingContext; ctx.save();
    const blur = map(bass, 0, 100, 0, 35);
    ctx.shadowBlur = blur;
    ctx.shadowColor = 'rgba(255,255,255,0.25)';

    // Distance reaction to value (using 'bass'): low -> closer, high -> farther
    const valueNorm = clamp(bass / 100, 0, 1);
    const targetScale = lerp(0.83, 1.28, valueNorm);
    this.distScale = this.distScale + (targetScale - this.distScale) * 0.14; // smoothing (slightly more responsive)
    const anchorX = midX + (this.baseX - midX) * this.distScale;
    const anchorY = midY + (this.baseY - midY) * this.distScale;
    this.x = anchorX;
    this.y = anchorY;

    // Lighting toward core
    const vx = midX - this.x, vy = midY - this.y;
    const vlen = Math.max(1e-3, Math.hypot(vx, vy));
    const ux = vx / vlen, uy = vy / vlen; // toward core
    const gx = this.x + ux * this.r * 0.35;
    const gy = this.y + uy * this.r * 0.35;
    const grad = ctx.createRadialGradient(gx, gy, this.r * 0.20, this.x, this.y, this.r);
    // Core color reference (no interpolation)
    const coreCol = CORE_COLOR_A();
    const innerMix = 0.55;
    const c0 = color(
      lerp(red(this.colA), red(coreCol), innerMix),
      lerp(green(this.colA), green(coreCol), innerMix),
      lerp(blue(this.colA), blue(coreCol), innerMix),
      255
    );
    const c1 = color(red(this.colB), green(this.colB), blue(this.colB), 220);
    const innerAlpha = 0.85;
    const outerAlpha = 0.70;
    grad.addColorStop(0, `rgba(${red(c0)},${green(c0)},${blue(c0)},${innerAlpha})`);
    grad.addColorStop(1, `rgba(${red(c1)},${green(c1)},${blue(c1)},${outerAlpha})`);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
    ctx.fill();

    // Glint and rim aligned to light (toward core glow)
    push();
    blendMode(ADD);
    const angDeg = atan2(uy, ux);
    noFill();
    stroke(red(coreCol), green(coreCol), blue(coreCol), 60 + map(bass, 0, 100, 0, 45));
    strokeWeight(3.5);
    arc(this.x, this.y, this.r * 2.3, this.r * 2.3, angDeg - 24, angDeg + 24);
    noStroke();
    fill(red(coreCol), green(coreCol), blue(coreCol), 120);
    ellipse(this.x + ux * this.r * 0.30, this.y + uy * this.r * 0.30, this.r * 0.16, this.r * 0.16);
    pop();

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

// =====================
// Scene Init
// =====================
function initSpaceScene() {
  stars = []; planets = []; comets = [];
  for (let i = 0; i < STAR_COUNT; i++) {
    const depth = randRange(0.3, 1);
    stars.push(new Star(randRange(0, canvasWidth), randRange(0, canvasHeight), depth));
  }
  const thirdsX = [canvasWidth * 0.22, canvasWidth * 0.5, canvasWidth * 0.78];
  const thirdsY = [canvasHeight * 0.28, canvasHeight * 0.58, canvasHeight * 0.82];
  const palettes = [
    [color(120, 200, 255), color(30, 50, 120)],
    [color(255, 210, 140), color(120, 60, 20)],
    [color(180, 160, 255), color(80, 50, 140)],
    [color(160, 255, 200), color(40, 120, 80)]
  ];
  // Generate positions dynamically to support any PLANET_COUNT
  const midX = canvasWidth / 2;
  const midY = canvasHeight / 2;
  const major = canvasWidth * 0.28;  // ellipse major radius 
  const minor = canvasHeight * 0.19; // ellipse minor radius 
  const angleOffset = -20;           // slight tilt offset
  const ringAngleDeg = 32; // match nebula ring tilt
  const cosA = Math.cos(radians(ringAngleDeg));
  const sinA = Math.sin(radians(ringAngleDeg));
  for (let i = 0; i < PLANET_COUNT; i++) {
    const pal = random(palettes);
    const ang = radians(angleOffset + (360 / Math.max(1, PLANET_COUNT)) * i);
    // base ellipse offset
    const dx = major * Math.cos(ang);
    const dy = minor * Math.sin(ang);
    // rotate offset by ring angle
    const rx = dx * cosA - dy * sinA;
    const ry = dx * sinA + dy * cosA;
    const x = midX + rx;
    const y = midY + ry;
    // vary radius softly and clamp (ensure below core max size)
    const maxSunSize = 220; // core maximum size from drawCentralCore mapping
    const planetMax = Math.floor(maxSunSize * 0.42); // keep comfortably smaller than core
    const r = clamp(70 + 50 * Math.cos(ang + i * 0.4), 55, planetMax);
    const hasRing = (i % 3 === 1); // periodic rings for variety
    const tilt = ringAngleDeg + randRange(-20, 20);
    planets.push(new Planet(x, y, r, pal[0], pal[1], hasRing, tilt));
  }
  initialised = true;
}

// Called by system_runner.js when song starts
function reset_music() { initSpaceScene(); }

// =====================
// Layout & Geometry
// =====================
function computeCoverAndTitleGeometry() {
  let hasCover = false;
  let imgW=0, imgH=0, drawW=0, drawH=0, margin=32, x=0, y=0;
  let tx=0, ty=0, textBlockH=0, rightMargin=32, albumBottom=height - margin;
  if (typeof coverImg !== 'undefined' && coverImg && coverImg.width && coverImg.height) {
    hasCover = true;
    imgW = coverImg.width; imgH = coverImg.height;
    const maxW = width * 0.2;
    const maxH = height * 0.38;
    const scale = Math.min(maxW / imgW, maxH / imgH, 1);
    drawW = imgW * scale; drawH = imgH * scale;
    x = margin; y = height - drawH - margin;
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
  ctx.shadowColor = 'rgba(0,0,0,0.6)';
  ctx.shadowBlur = 8;
  ctx.shadowOffsetX = 2;
  ctx.shadowOffsetY = 3;
  fill(255); noStroke(); textAlign(LEFT, TOP);
  textStyle(BOLD); textSize(40);
  text('Galactic Eliminator', geom.tx, geom.ty);
  textStyle(NORMAL); textSize(24);
  text('Kobaryo', geom.tx, geom.ty + 40 + 6);
  ctx.restore();
  pop();
}

// =====================
// Drawing Blocks
// =====================
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
  if (edge === 0) { x = -20; y = random(0, height); vx = speed; vy = randRange(-2, 2); }
  else if (edge === 1) { x = width + 20; y = random(0, height); vx = -speed; vy = randRange(-2, 2); }
  else if (edge === 2) { x = random(0, width); y = -20; vx = randRange(-2, 2); vy = speed; }
  else { x = random(0, width); y = height + 20; vx = randRange(-2, 2); vy = -speed; }
  const life = int(randRange(40, 90));
  comets.push(new Comet(x, y, vx, vy, life));
}

function drawComets(drum) {
  for (let i = comets.length - 1; i >= 0; i--) {
    const c = comets[i];
    if (c.update()) comets.splice(i, 1); else c.draw(drum);
  }
}

function drawPlanetsAll(midX, midY, bass, other) { for (let p of planets) p.draw(midX, midY, bass, other); }

function drawAngledBeam(midX, midY, drum, bass) {
  push();
  translate(midX, midY); rotate(32);
  const beamLen = height * 0.85;
  const maxWidth = map(drum, 0, 100, 24, 100);
  const layers = 200;
  for (let i = 0; i <= layers; i++) {
    const t = map(i, 0, layers, -1, 1);
    const y = t * (beamLen / 2);
    const fall = pow(1 - abs(t), 1.7);
    const halfW = maxWidth * fall;
    const alphaVal = 40 + 210 * fall;
    stroke(255, 220, 120, alphaVal);
    strokeWeight(1);
    line(-halfW, y, halfW, y);
  }
  stroke(255, 245, 220, 230);
  strokeWeight(3);
  line(0, -beamLen / 2, 0, beamLen / 2);
  strokeWeight(2);
  for (let i = 0; i < 80; i++) {
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

// Nebula bands at 32 degrees above and below the core
function drawBorderNebula(midX, midY, other, bass) {
  push();
  translate(midX, midY);
  rotate(32);
  blendMode(ADD);

  // Geometry close to edges
  const edgeMargin = 16;
  const len = Math.hypot(width, height) * 1.2; // span corner to corner
  const steps = 56;
  const baseOffset = Math.min(width, height) * 0.5 - edgeMargin; // near visible top/bottom edges

  // Visual richness controls
  const streamCountPerSide = 1;   // further reduced for performance
  const layersPerStream = 2;      // further reduced for performance
  const alphaBase = map(other, 0, 100, 14, 42);

  // Color palettes (cool -> warm)
  const cools = [ color(80,120,150), color(60,100,120), color(90,140,170) ];
  const warms = [ color(255,230,150), color(250,210,120), color(255,200,110) ];

  for (let band = -1; band <= 1; band += 2) {
    // multiple parallel streams per side
    for (let s = 0; s < streamCountPerSide; s++) {
      const streamShift = map(s, 0, streamCountPerSide - 1, -1, 1);
      const yBase = band * baseOffset + streamShift * 18; // small spacing between streams
      const freqMod = 2.2 + s * 0.35;                     // slightly different noise frequencies
      const timeMod = 0.004 + s * 0.0006;                 // subtle time speed diff
      const thickness = map(bass, 0, 100, 26, 100) * (1.0 + 0.08 * s); // thicker for later streams

      for (let layer = 0; layer < layersPerStream; layer++) {
        const layerScale = 1 + layer * 0.45;
        const layerAlpha = alphaBase * (1 - layer * 0.28);
        const cool = cools[(s + layer) % cools.length];
        const warm = warms[(s + 2*layer) % warms.length];
        noStroke();

        for (let i = 0; i < steps; i++) {
          const t = i / (steps - 1);
          const x = lerp(-len / 2, len / 2, t);
          const n = noise(t * freqMod + layer * 0.7, frameCount * timeMod + band * (1.6 + 0.2*s));
          const y = yBase + (n - 0.5) * thickness * layerScale;
          const fall = pow(1 - abs(t * 2 - 1), 2.2); // stronger taper for edges
          const wob = 0.8 + 0.4 * noise(10 + layer * 9 + t * 4.3);
          const r = thickness * 0.40 * fall * wob;

          // blend cool->warm, slightly biased warm at center
          const warmBias = 0.55 + 0.15 * (1 - abs(t * 2 - 1));
          const c = lerpColor(cool, warm, warmBias);
          const a = layerAlpha * fall;
          fill(red(c), green(c), blue(c), a);
          ellipse(x, y, r * 1.9, r);
        }

        // dust speckles for richness
        const dustCount = 10;
        for (let d = 0; d < dustCount; d++) {
          const tt = d / (dustCount - 1);
          const dx = lerp(-len / 2, len / 2, tt) + (noise(s*33 + layer*7 + d*0.17) - 0.5) * 18;
          const dn = noise(tt * (freqMod*0.8) + s*0.3 + layer*0.2, frameCount * (timeMod*0.7) + band*2.1);
          const dy = yBase + (dn - 0.5) * thickness * (0.65 + 0.3 * noise(5 + s*0.5 + layer*0.4));
          const df = pow(1 - abs(tt * 2 - 1), 2.0);
          const da = (alphaBase * 0.45) * df;
          fill(255, 210, 140, da);
          ellipse(dx, dy, 2.2 + 1.4 * noise(d*0.31), 2.2 + 1.4 * noise(d*0.29));
        }
      }
    }
  }

  blendMode(BLEND);
  pop();
}

// Large rotating glow rings turned into subtle nebula torus
function drawGlowRings(midX, midY, drum, bass, other) {
  push();
  translate(midX, midY);
  const drumNorm = clamp(drum / 100, 0, 1);
  const wobFreq = 0.0015 + 0.004 * drumNorm; // subtle tilt wobble vs drum
  rotate(32 + 1.2 * Math.sin(frameCount * wobFreq));
  // Keep additive but use very low alpha to avoid harshness
  blendMode(ADD);

  const energyRaw = (0.5 * bass + 0.5 * other) / 100; // 0..1
  nebulaEnergySmooth = nebulaEnergySmooth + (energyRaw - nebulaEnergySmooth) * 0.05;
  const energy = clamp(nebulaEnergySmooth * 0.7, 0, 1);
  const maxDim = Math.max(width, height);
  const outerA = maxDim * 0.55; // major radius (x)
  const outerB = outerA * 0.42; // minor radius (y)
  const innerA = maxDim * 0.35;
  const innerB = innerA * 0.33;
  // ring angular speeds mapped to drum
  const rotSpeed = map(drum, 0, 100, 0.0008, 0.0096);
  const dustSpeed = rotSpeed * 0.75;

  function drawNebulaRing(a, b, dir, jitterSeed) {
    const wobble = 0.02 * Math.sin(frameCount * 0.01 + jitterSeed);
    const aNow = a * (1 + wobble * 0.35);
    const bNow = b * (1 - wobble * 0.25);

    // parameters for fog puffs around ring path
    const samples = 72;
    const puffsPerSample = 2;
    const thickness = lerp(24, 50, energy); // normal offset scale (damped)

    const ctxp = drawingContext; ctxp.save();
    ctxp.shadowBlur = 3; // lower blur for performance
    ctxp.shadowColor = 'rgba(255,225,150,0.18)';
    noStroke();
    for (let i = 0; i < samples; i++) {
      const t = i / samples;
      const ang = t * TWO_PI + frameCount * rotSpeed * dir;
      const x = aNow * Math.cos(ang);
      const y = bNow * Math.sin(ang);

      // outward unit normal for ellipse (gradient of x^2/a^2 + y^2/b^2 = 1)
      let nx = x / (aNow * aNow);
      let ny = y / (bNow * bNow);
      const nlen = Math.sqrt(nx * nx + ny * ny) || 1;
      nx /= nlen; ny /= nlen;

      for (let k = 0; k < puffsPerSample; k++) {
        const seed = jitterSeed + i * 0.27 + k * 3.11;
        const offSign = (noise(seed) > 0.5) ? 1 : -1;
        const nmag = (noise(seed + frameCount * 0.004) - 0.5) * 2; // -1..1
        const off = offSign * thickness * (0.35 + 0.65 * Math.abs(nmag));
        const px = x + nx * off + (noise(seed + 7.7) - 0.5) * 8; // small tangential jitter
        const py = y + ny * off + (noise(seed + 9.3) - 0.5) * 8;

        const fall = Math.exp(-Math.pow(off / (thickness * 0.9), 2)); // gaussian from ring path
        const size = (10 + 22 * fall) * (0.80 + 0.35 * energy);

        // subdued color mix (cool<->warm) with low alpha
        const cool = color(90, 120, 140, 10 + 18 * fall);
        const warm = color(240, 200, 120, 12 + 22 * fall);
        const mixAmt = 0.55 + 0.15 * Math.sin(ang - HALF_PI);
        const cc = lerpColor(cool, warm, mixAmt);
        fill(red(cc), green(cc), blue(cc), alpha(cc) * (0.45 + 0.35 * energy));
        circle(px, py, size);
      }
    }

    ctxp.restore();
    
    // very subtle dust along the ring (greatly reduced to avoid flashiness)
    const dust = 40;
    for (let d = 0; d < dust; d++) {
      const tt = d / dust;
      const ang = tt * TWO_PI + frameCount * dustSpeed * dir;
      const x = aNow * Math.cos(ang);
      const y = bNow * Math.sin(ang);
      const jitter = (noise(jitterSeed * 10 + d * 0.73) - 0.5) * 10;
      fill(255, 210, 140, 12);
      circle(x + jitter, y - jitter * 0.4, 1.4);
    }
  }

  drawNebulaRing(outerA, outerB, 1, 0.0);
  drawNebulaRing(innerA, innerB, -1, 2.3);

  blendMode(BLEND);
  pop();
}

function drawCentralCore(midX, midY, drum, bass, other) {
 
  const col = CORE_COLOR_A();

  // Size 
  const sunSize = map(drum, 0, 100, 100, 300);
  const glow = map(bass, 0, 100, 10, 26);
  const ctx = drawingContext; ctx.save();


  // Soft aura glow (additive radial gradient)
  {
    push();
    blendMode(ADD);
    noStroke();
    const ctxg = drawingContext; ctxg.save();
    const innerR = sunSize * 0.75;
    const outerR = sunSize * 1.15;
    const grad = ctxg.createRadialGradient(midX, midY, innerR, midX, midY, outerR);
    grad.addColorStop(0.0, 'rgba(255,245,120,0.14)');
    grad.addColorStop(0.55, 'rgba(255,250,180,0.08)');
    grad.addColorStop(1.0, 'rgba(255,255,220,0)');
    ctxg.fillStyle = grad;
    ctxg.beginPath();
    ctxg.arc(midX, midY, outerR, 0, Math.PI * 2);
    ctxg.fill();
    ctxg.restore();
    pop();
    blendMode(BLEND);
  }

  // Solid white nucleus fill
  {
    push();
    noStroke();
    fill(255, 247, 201);
    circle(midX, midY, sunSize);
    pop();
  }

  // Rings: simple spacing and light fade; slight thickness response to bass
  const RING_COUNT = 8;
  const RING_GAP = 56;
  const baseStroke = map(bass, 0, 100, 2, 10);
  noFill();
  for (let i = 0; i < RING_COUNT; i++) {
    const d = sunSize - i * RING_GAP;
    if (d <= sunSize * 0.18) break;
    const a = lerp(210, 60, i / (RING_COUNT - 1));
    const sw = max(1, baseStroke - i * 0.8);
    stroke(red(col), green(col), blue(col), a);
    strokeWeight(sw);
    ellipse(midX, midY, d, d);
  }
}

function drawProgressAndWave(counter, geom) {
  // Progress slider aligned: from title-left to right margin; vertical at album bottom
  const rightMargin = geom.rightMargin;
  const barH = 10;
  if (!geom.hasCover) return; // Aligning to cover title layout; if no cover, skip
  const leftX = geom.tx;
  const rightX = width - rightMargin;
  const barY = geom.albumBottom - barH / 2;
  const barW = Math.max(50, rightX - leftX);
  // Progress [0..1]
  let totalSlices = (typeof volume_table_length !== 'undefined' && volume_table_length > 0) ? volume_table_length : 0;
  let progress = 0;
  if (typeof editorMode !== 'undefined' && editorMode) progress = 0; else if (totalSlices > 0) progress = clamp((counter + 1) / totalSlices, 0, 1);
  // Wave EQ above slider (bass area + treble line)
  const eqGap = 12; const eqBaseY = barY - eqGap; const eqMaxH = 112;
  const N = EQ_BAR_COUNT;
  if (!Array.isArray(eqWaveBass) || eqWaveBass.length !== N) eqWaveBass = new Array(N).fill(0);
  if (!Array.isArray(eqWaveTreble) || eqWaveTreble.length !== N) eqWaveTreble = new Array(N).fill(0);
  const dx = barW / (N - 1);
  for (let i = 0; i < N; i++) {
    const t = N > 1 ? i / (N - 1) : 0;
    const lowW = Math.exp(-Math.pow((t - 0.12) / 0.28, 2));
    const midW = Math.exp(-Math.pow((t - 0.50) / 0.30, 2));
    const highW = Math.exp(-Math.pow((t - 0.88) / 0.28, 2));
    const bassNorm = slider3.value ? slider3.value() / 100.0 : 0; // fallback if editor
    const drumNorm = slider2.value ? slider2.value() / 100.0 : 0;
    const vocalNorm = slider1.value ? slider1.value() / 100.0 : 0;
    const otherNorm = slider4.value ? slider4.value() / 100.0 : 0;
    let targetBassH = eqMaxH * (0.90 * bassNorm * lowW + 0.35 * (0.6 * drumNorm + 0.4 * vocalNorm) * midW);
    let targetTrebleH = eqMaxH * (0.90 * otherNorm * highW + 0.30 * (0.6 * drumNorm + 0.4 * vocalNorm) * midW);
    const wavePhase = frameCount * 0.6;
    targetBassH *= 0.85 + 0.15 * Math.sin(wavePhase * 0.012 + t * 5.0);
    targetTrebleH *= 0.85 + 0.15 * Math.cos(wavePhase * 0.015 + t * 6.0);
    const k = 0.28;
    eqWaveBass[i] = eqWaveBass[i] + (targetBassH - eqWaveBass[i]) * k;
    eqWaveTreble[i] = eqWaveTreble[i] + (targetTrebleH - eqWaveTreble[i]) * k;
  }
  // Draw bass filled area
  push(); noStroke(); fill(255, 170, 50, 140);
  beginShape();
  for (let i = 0; i < N; i++) { vertex(leftX + i * dx, eqBaseY - eqWaveBass[i]); }
  vertex(leftX + (N - 1) * dx, eqBaseY); vertex(leftX, eqBaseY);
  endShape(CLOSE); pop();
  // Draw treble line
  push(); const ctx2 = drawingContext; ctx2.save(); ctx2.shadowBlur = 6; ctx2.shadowColor = 'rgba(255,220,120,0.55)';
  noFill(); stroke(255, 241, 118, 230); strokeWeight(3); beginShape();
  for (let i = 0; i < N; i++) { vertex(leftX + i * dx, eqBaseY - (eqWaveBass[i] + eqWaveTreble[i] * 0.35)); }
  endShape(); ctx2.restore(); pop();
  // Progress bar
  noStroke(); fill(255, 255, 255, 60);
  rect(leftX, barY - barH / 2, barW, barH, barH / 2);
  const filledW = barW * progress;
  fill(255, 204, 0, 220);
  rect(leftX, barY - barH / 2, filledW, barH, barH / 2);
  fill(255, 220, 120, 255);
  circle(leftX + filledW, barY, barH * 1.8);
}

// =====================
// Frame Entry
// =====================
function drawCentralCore_Simple(midX, midY, drum, bass, other) {
  const changingColor = CORE_COLOR_A();
  const sunSize = map(drum, 0, 100, 70, 220);
  const strokeThickness = map(bass, 0, 100, 1, 70);
  const ctx = drawingContext; ctx.save();
  ctx.shadowBlur = map(bass, 0, 100, 4, 14);
  ctx.shadowColor = `rgba(${red(changingColor)},${green(changingColor)},${blue(changingColor)},0.55)`;
  noStroke(); fill(changingColor);
  circle(midX, midY, sunSize * 0.55);
  ctx.restore();
  for (let i = 0; i <= 7; i++) {
    let c = color(changingColor); c.setAlpha(map(i, 0, 7, 230, 60));
    stroke(c); strokeWeight(map(i, 0, 7, strokeThickness, 1));
    ellipse(midX, midY, sunSize - i * 50, sunSize - i * 50);
  }
}

function draw_one_frame(words, vocal, drum, bass, other, counter) {
  if (!initialised) initSpaceScene();
  background(6); angleMode(DEGREES);
  const midX = canvasWidth / 2; const midY = canvasHeight / 2;
  const geom = computeCoverAndTitleGeometry();
  // moved: cover & text will be drawn last to appear in front
  drawBackgroundStars(vocal, bass, other);
  drawGlowRings(midX, midY, drum, bass, other);
  maybeSpawnComet(drum); drawComets(drum);
  drawPlanetsAll(midX, midY, bass, other);
  drawBorderNebula(midX, midY, other, bass);
  drawAngledBeam(midX, midY, drum, bass);
  drawCentralCore_Simple(midX, midY, drum, bass, other);
  drawProgressAndWave(counter, geom);
  drawCoverAndTitle(geom);
}
