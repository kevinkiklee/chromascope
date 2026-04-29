// rendering.js — Pure-computation rendering functions extracted from main.js.
// These functions have no dependency on UXP APIs (photoshop, uxp, imaging)
// or global state (window.__chromascope), making them unit-testable.

// Minimal 3×5 bitmap font for digits and degree symbol.
// UXP canvas doesn't support fillText reliably, so we rasterize text manually.
// Each glyph is 5 rows of 3-bit bitmasks (MSB = leftmost pixel).
var FONT = {
  '0': [0x7,0x5,0x5,0x5,0x7], '1': [0x2,0x6,0x2,0x2,0x7],
  '2': [0x7,0x1,0x7,0x4,0x7], '3': [0x7,0x1,0x7,0x1,0x7],
  '4': [0x5,0x5,0x7,0x1,0x1], '5': [0x7,0x4,0x7,0x1,0x7],
  '6': [0x7,0x4,0x7,0x5,0x7], '7': [0x7,0x1,0x1,0x1,0x1],
  '8': [0x7,0x5,0x7,0x5,0x7], '9': [0x7,0x5,0x7,0x1,0x7],
  '\xB0': [0x7,0x5,0x7,0x0,0x0] // degree symbol
};

function drawChar(buf, size, ch, ox, oy, r, g, b) {
  var glyph = FONT[ch];
  if (!glyph) return;
  for (var row = 0; row < 5; row++) {
    for (var col = 0; col < 3; col++) {
      if (glyph[row] & (4 >> col)) {
        var px = Math.round(ox + col);
        var py = Math.round(oy + row);
        if (px >= 0 && px < size && py >= 0 && py < size) {
          var idx = (py * size + px) * 4;
          buf[idx] = r; buf[idx+1] = g; buf[idx+2] = b; buf[idx+3] = 255;
        }
      }
    }
  }
}

function drawString(buf, size, str, cx, cy, r, g, b) {
  var charW = 4;
  var totalW = str.length * charW - 1;
  var ox = cx - totalW / 2;
  var oy = cy - 2.5;
  for (var i = 0; i < str.length; i++) {
    drawChar(buf, size, str[i], ox + i * charW, oy, r, g, b);
  }
}

// HSV to RGB (h: 0-360, s: 0-1, v: 0-1) — matches Rust renderer's hsv_to_rgb
function hsvToRgb(h, s, v) {
  h = ((h % 360) + 360) % 360;
  var c = v * s;
  var x = c * (1.0 - Math.abs((h / 60) % 2 - 1));
  var m = v - c;
  var r, g, b;
  if (h < 60)       { r=c; g=x; b=0; }
  else if (h < 120) { r=x; g=c; b=0; }
  else if (h < 180) { r=0; g=c; b=x; }
  else if (h < 240) { r=0; g=x; b=c; }
  else if (h < 300) { r=x; g=0; b=c; }
  else               { r=c; g=0; b=x; }
  return [((r+m)*255)|0, ((g+m)*255)|0, ((b+m)*255)|0];
}

// Cached graticule buffer — matches Rust renderer's visual style.
// Contains background, grid rings, crosshair, color ring, tick marks, degree labels.
var cachedGraticuleBuf = null;
var cachedGraticuleSize = 0;

// Brightening LUT: precomputes (c*230 + 7650) >> 8 for c in [0, 255].
// Saves ~3 multiplies + 3 shifts per pixel in scatter/bloom inner loops
// (16k+ pixels × 3 channels per render at slider-drag frequency).
var BRIGHTEN_LUT = (function() {
  var lut = new Uint8Array(256);
  for (var i = 0; i < 256; i++) {
    var v = (i * 230 + 7650) >> 8;
    lut[i] = v > 255 ? 255 : v;
  }
  return lut;
})();

// Pooled bloom buffers — reused across renders to reduce GC pressure.
// Only reallocated when scopeSize changes.
var _bloomBufN = 0;
var _bloomR = null, _bloomG = null, _bloomB = null;
var _bloomTmpR = null, _bloomTmpG = null, _bloomTmpB = null;

// Pooled render/overlay/heatmap buffers. Each render would otherwise allocate
// ~360KB (size²×4 bytes) copies of the graticule and base buffers; at drag-time
// frame rates that's megabytes/sec of short-lived allocations.
// _renderBuf uses a 2-entry ring so callers that hold onto two successive
// results (cachedBaseBuf across a density switch, or back-to-back comparisons)
// see distinct buffers.
var _renderBufRing = [null, null];
var _renderBufRingIdx = 0;
var _renderBufN = 0;
var _overlayBuf = null;
var _overlayBufN = 0;
var _heatmapDensity = null;
var _heatmapDensityN = 0;

function renderGraticule(size) {
  if (cachedGraticuleBuf && cachedGraticuleSize === size) return cachedGraticuleBuf;

  var buf = new Uint8Array(size * size * 4);
  var half = size / 2;
  // Match Rust: radius = center * 0.82
  var radius = half * 0.82;

  // Background: match Rust BG = Rgb([9, 9, 11]).
  // Pack R=0x09 G=0x09 B=0x0B A=0xFF into one little-endian u32 and fill.
  new Uint32Array(buf.buffer).fill(0xFF0B0909);

  function setPixel(x, y, r, g, b) {
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || x >= size || y < 0 || y >= size) return;
    var idx = (y * size + x) * 4;
    buf[idx] = r; buf[idx+1] = g; buf[idx+2] = b; buf[idx+3] = 255;
  }

  // Blend a pixel with alpha (matches Rust blend_pixel)
  function blendPixel(x, y, r, g, b, a) {
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || x >= size || y < 0 || y >= size) return;
    var idx = (y * size + x) * 4;
    var inv = 1.0 - a;
    buf[idx]   = Math.round(buf[idx]   * inv + r * a);
    buf[idx+1] = Math.round(buf[idx+1] * inv + g * a);
    buf[idx+2] = Math.round(buf[idx+2] * inv + b * a);
    buf[idx+3] = 255;
  }

  // Grid rings at 25%, 50%, 75%, 100% — match Rust GRID = Rgb([30, 30, 35])
  for (var ri = 0; ri < 4; ri++) {
    var ringR = radius * [0.25, 0.5, 0.75, 1.0][ri];
    var steps = Math.max(Math.round(ringR * 6.28), 360);
    for (var si = 0; si < steps; si++) {
      var a = (si / steps) * Math.PI * 2;
      setPixel(half + Math.cos(a) * ringR, half + Math.sin(a) * ringR, 30, 30, 35);
    }
  }

  // Crosshair with alpha blend (match Rust: 0.5 alpha)
  for (var ci = 0; ci < size; ci++) {
    blendPixel(ci, half, 30, 30, 35, 0.5);
    blendPixel(half, ci, 30, 30, 35, 0.5);
  }

  // Color ring: HSV hue wheel just outside the graticule.
  // Thicker than Rust renderer (which renders at 700px) to be visible at 300px.
  var ringInner = radius * 1.01;
  var ringOuter = radius * 1.05;
  var ringMid = (ringInner + ringOuter) / 2;
  var ringHalf = (ringOuter - ringInner) / 2;
  var scanMin = Math.max(0, Math.floor(half - ringOuter - 1));
  var scanMax = Math.min(size - 1, Math.ceil(half + ringOuter + 1));

  for (var py = scanMin; py <= scanMax; py++) {
    for (var px = scanMin; px <= scanMax; px++) {
      var dx = px - half;
      var dy = py - half;
      var dist = Math.sqrt(dx * dx + dy * dy);
      var ringDist = Math.abs(dist - ringMid);
      if (ringDist > ringHalf + 0.5) continue;

      var alpha = ringDist > ringHalf - 0.5
        ? Math.max(0, Math.min(1, 1.0 - (ringDist - (ringHalf - 0.5))))
        : 1.0;

      // atan2(-dy, dx): 0° at right, CCW, matching graticule convention
      var angleRad = Math.atan2(-dy, dx);
      var hueDeg = ((angleRad * 180 / Math.PI) + 360) % 360;
      var rgb = hsvToRgb(hueDeg, 0.9, 0.85);
      blendPixel(px, py, rgb[0], rgb[1], rgb[2], alpha * 0.85);
    }
  }

  // Tick marks at 30° intervals (match Rust: 0.94 to 1.0 radius, LABEL alpha 0.7)
  var degrees = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330];
  for (var di = 0; di < degrees.length; di++) {
    var deg = degrees[di];
    var da = deg * Math.PI / 180;
    var tickInner = radius * 0.94;
    var tickOuter = radius;
    var tickSteps = Math.round((tickOuter - tickInner) * 2.5);
    for (var ti = 0; ti < tickSteps; ti++) {
      var t = ti / tickSteps;
      var td = tickInner + (tickOuter - tickInner) * t;
      blendPixel(half + Math.cos(da) * td, half - Math.sin(da) * td, 110, 110, 115, 0.7);
    }
  }

  // Degree labels outside the ring (match Rust: radius * 1.09, LABEL color)
  var labelRadius = radius * 1.09;
  for (var di = 0; di < degrees.length; di++) {
    var deg = degrees[di];
    var da = deg * Math.PI / 180;
    var lx = half + Math.cos(da) * labelRadius;
    var ly = half - Math.sin(da) * labelRadius;
    drawString(buf, size, String(deg), lx, ly, 110, 110, 115);
  }

  cachedGraticuleBuf = buf;
  cachedGraticuleSize = size;
  return buf;
}

// Software renderer: plots pixel data onto a copy of the graticule buffer.
// Graticule is cached and reused — only the pixel plotting runs per refresh.
//
// Parameters:
//   size        — render buffer dimension (square)
//   pixels      — { data: Uint8Array (RGB triplets), width, height } or null
//   densityMode — "scatter" | "heatmap" | "bloom" (default: "scatter")
//   showSkinTone — boolean, whether to draw skin tone indicator line
function renderToBuffer(size, pixels, densityMode, showSkinTone) {
  var graticule = renderGraticule(size);
  var n4 = graticule.length;
  if (_renderBufN !== n4) {
    _renderBufRing[0] = new Uint8Array(n4);
    _renderBufRing[1] = new Uint8Array(n4);
    _renderBufN = n4;
  }
  var buf = _renderBufRing[_renderBufRingIdx];
  _renderBufRingIdx = (_renderBufRingIdx + 1) & 1;
  buf.set(graticule);
  var half = size / 2;
  var radius = half * 0.82; // match Rust renderer

  if (!pixels) return buf;

  if (!densityMode) densityMode = "scatter";

  var data = pixels.data;
  var total = pixels.width * pixels.height;

  // Inline HSL mapping: hue → angle, saturation → radius.
  // Avoids function calls and object allocation per pixel — critical for UXP performance.
  // Writes px/py directly into reusable vars instead of returning objects.
  var _mapPx = 0, _mapPy = 0, _mapOk = false;
  function mapHSLInline(r255, g255, b255) {
    var rn = r255 * 0.003921569; // 1/255
    var gn = g255 * 0.003921569;
    var bn = b255 * 0.003921569;
    var max = rn > gn ? (rn > bn ? rn : bn) : (gn > bn ? gn : bn);
    var min = rn < gn ? (rn < bn ? rn : bn) : (gn < bn ? gn : bn);
    var delta = max - min;
    if (delta < 0.001) { _mapOk = false; return; }
    var l = (max + min) * 0.5;
    var s = l <= 0.5 ? delta / (max + min) : delta / (2 - max - min);
    var h;
    if (max === rn) { h = ((gn - bn) / delta) % 6; if (h < 0) h += 6; }
    else if (max === gn) { h = (bn - rn) / delta + 2; }
    else { h = (rn - gn) / delta + 4; }
    var hueRad = h * 1.0471975511966; // h/6 * 2π = h * π/3
    var sr = s * radius;
    _mapPx = Math.round(half + sr * Math.cos(hueRad));
    _mapPy = Math.round(half - sr * Math.sin(hueRad));
    _mapOk = true;
  }

  if (densityMode === "scatter") {
    // Additive blending: each dot adds its color to the existing pixel.
    // Dense clusters accumulate brightness naturally, preserving hue.
    // Matches Rust renderer's blend_pixel with alpha=0.9.
    for (var pi = 0; pi < total; pi++) {
      var off = pi * 3;
      mapHSLInline(data[off], data[off+1], data[off+2]);
      if (!_mapOk) continue;
      if (_mapPx >= 0 && _mapPx < size && _mapPy >= 0 && _mapPy < size) {
        var idx = (_mapPy * size + _mapPx) * 4;
        // Brightened pixel via LUT: c*0.9+30 (clamped to 255).
        var pr = BRIGHTEN_LUT[data[off]];
        var pg = BRIGHTEN_LUT[data[off+1]];
        var pb = BRIGHTEN_LUT[data[off+2]];
        // Blend at α=0.9: old*(26/256) + new*(230/256) + 0.5 rounding
        var br = (buf[idx]   * 26 + pr * 230 + 128) >> 8;
        var bg = (buf[idx+1] * 26 + pg * 230 + 128) >> 8;
        var bb = (buf[idx+2] * 26 + pb * 230 + 128) >> 8;
        buf[idx]   = br > 255 ? 255 : br;
        buf[idx+1] = bg > 255 ? 255 : bg;
        buf[idx+2] = bb > 255 ? 255 : bb;
        buf[idx+3] = 255;
      }
    }
  } else if (densityMode === "heatmap") {
    var nPixels = size * size;
    if (_heatmapDensityN !== nPixels) {
      _heatmapDensity = new Uint32Array(nPixels);
      _heatmapDensityN = nPixels;
    } else {
      _heatmapDensity.fill(0);
    }
    var density = _heatmapDensity;
    var maxDensity = 0;
    for (var pi = 0; pi < total; pi++) {
      var off = pi * 3;
      mapHSLInline(data[off], data[off+1], data[off+2]);
      if (!_mapOk) continue;
      var px = _mapPx, py = _mapPy;
      if (px >= 0 && px < size && py >= 0 && py < size) {
        var di = py * size + px;
        density[di]++;
        if (density[di] > maxDensity) maxDensity = density[di];
      }
    }
    if (maxDensity > 0) {
      var logMax = Math.log(maxDensity + 1);
      for (var i = 0; i < size * size; i++) {
        var dv = density[i];
        if (dv === 0) continue;
        var t = Math.log(dv + 1) / logMax;
        var idx = i * 4;
        if (t < 0.2)      { var s = t/0.2;       buf[idx]=0;                    buf[idx+1]=0;                    buf[idx+2]=Math.round(s*255); }
        else if (t < 0.4) { var s = (t-0.2)/0.2; buf[idx]=0;                    buf[idx+1]=Math.round(s*255);    buf[idx+2]=255; }
        else if (t < 0.6) { var s = (t-0.4)/0.2; buf[idx]=0;                    buf[idx+1]=255;                  buf[idx+2]=Math.round((1-s)*255); }
        else if (t < 0.8) { var s = (t-0.6)/0.2; buf[idx]=Math.round(s*255);    buf[idx+1]=255;                  buf[idx+2]=0; }
        else              { var s = (t-0.8)/0.2; buf[idx]=255;                   buf[idx+1]=Math.round((1-s)*255); buf[idx+2]=0; }
        buf[idx+3] = 255;
      }
    }
  } else if (densityMode === "bloom") {
    // Bloom via density accumulation + 3-pass box blur (much faster than per-pixel radial glow).
    // Old approach: O(pixels × glowRadius²) ≈ 52M ops for 65K pixels.
    // New approach: O(pixels + size² × 3 passes) ≈ 300K ops total.
    var alpha = Math.min(0.5, Math.max(0.03, 300 / total));
    var n = size * size;

    // Reuse pooled buffers when size hasn't changed; zero-fill for fresh render
    if (_bloomBufN !== n) {
      _bloomR = new Float32Array(n); _bloomG = new Float32Array(n); _bloomB = new Float32Array(n);
      _bloomTmpR = new Float32Array(n); _bloomTmpG = new Float32Array(n); _bloomTmpB = new Float32Array(n);
      _bloomBufN = n;
    } else {
      _bloomR.fill(0); _bloomG.fill(0); _bloomB.fill(0);
      _bloomTmpR.fill(0); _bloomTmpG.fill(0); _bloomTmpB.fill(0);
    }
    var bloomR = _bloomR;
    var bloomG = _bloomG;
    var bloomB = _bloomB;

    // Step 1: accumulate colored energy at each pixel location (single pass over input)
    for (var pi = 0; pi < total; pi++) {
      var off = pi * 3;
      mapHSLInline(data[off], data[off+1], data[off+2]);
      if (!_mapOk) continue;
      if (_mapPx >= 0 && _mapPx < size && _mapPy >= 0 && _mapPy < size) {
        var bi = _mapPy * size + _mapPx;
        bloomR[bi] += BRIGHTEN_LUT[data[off]] * alpha;
        bloomG[bi] += BRIGHTEN_LUT[data[off+1]] * alpha;
        bloomB[bi] += BRIGHTEN_LUT[data[off+2]] * alpha;
      }
    }

    // Step 2: box blur (3 passes for smooth gaussian-like falloff).
    // Each pass is O(size²) — separable horizontal then vertical.
    var blurRadius = Math.max(2, Math.round(size / 60));
    var tmpR = _bloomTmpR;
    var tmpG = _bloomTmpG;
    var tmpB = _bloomTmpB;

    for (var pass = 0; pass < 3; pass++) {
      var srcR = pass === 0 ? bloomR : (pass % 2 === 1 ? tmpR : bloomR);
      var srcG = pass === 0 ? bloomG : (pass % 2 === 1 ? tmpG : bloomG);
      var srcB = pass === 0 ? bloomB : (pass % 2 === 1 ? tmpB : bloomB);
      var dstR = pass % 2 === 0 ? tmpR : bloomR;
      var dstG = pass % 2 === 0 ? tmpG : bloomG;
      var dstB = pass % 2 === 0 ? tmpB : bloomB;

      // Horizontal blur (separable, sliding-window box).
      var w = 2 * blurRadius + 1;
      var invW = 1.0 / w;
      var sizeM1 = size - 1;
      for (var y = 0; y < size; y++) {
        var rowOff = y * size;
        var sumR = 0, sumG = 0, sumB = 0;
        // Seed window. Each k clamps against [0, size-1]; avoids two Math calls per step.
        for (var k = -blurRadius; k <= blurRadius; k++) {
          var sx = k < 0 ? 0 : (k > sizeM1 ? sizeM1 : k);
          sumR += srcR[rowOff + sx]; sumG += srcG[rowOff + sx]; sumB += srcB[rowOff + sx];
        }
        dstR[rowOff] = sumR * invW; dstG[rowOff] = sumG * invW; dstB[rowOff] = sumB * invW;
        for (var x = 1; x < size; x++) {
          var addX = x + blurRadius; if (addX > sizeM1) addX = sizeM1;
          var remX = x - blurRadius - 1; if (remX < 0) remX = 0;
          sumR += srcR[rowOff + addX] - srcR[rowOff + remX];
          sumG += srcG[rowOff + addX] - srcG[rowOff + remX];
          sumB += srcB[rowOff + addX] - srcB[rowOff + remX];
          dstR[rowOff + x] = sumR * invW; dstG[rowOff + x] = sumG * invW; dstB[rowOff + x] = sumB * invW;
        }
      }

      // Vertical blur (swap src/dst)
      srcR = dstR; srcG = dstG; srcB = dstB;
      dstR = pass % 2 === 0 ? bloomR : tmpR;
      dstG = pass % 2 === 0 ? bloomG : tmpG;
      dstB = pass % 2 === 0 ? bloomB : tmpB;

      for (var x = 0; x < size; x++) {
        var sumR = 0, sumG = 0, sumB = 0;
        for (var k = -blurRadius; k <= blurRadius; k++) {
          var sy = k < 0 ? 0 : (k > sizeM1 ? sizeM1 : k);
          var off = sy * size + x;
          sumR += srcR[off]; sumG += srcG[off]; sumB += srcB[off];
        }
        dstR[x] = sumR * invW; dstG[x] = sumG * invW; dstB[x] = sumB * invW;
        for (var y = 1; y < size; y++) {
          var addY = y + blurRadius; if (addY > sizeM1) addY = sizeM1;
          var remY = y - blurRadius - 1; if (remY < 0) remY = 0;
          var addOff = addY * size + x;
          var remOff = remY * size + x;
          sumR += srcR[addOff] - srcR[remOff];
          sumG += srcG[addOff] - srcG[remOff];
          sumB += srcB[addOff] - srcB[remOff];
          var di = y * size + x;
          dstR[di] = sumR * invW; dstG[di] = sumG * invW; dstB[di] = sumB * invW;
        }
      }
    }

    // Step 3: composite bloom onto the graticule buffer (additive blend)
    var finalR = tmpR, finalG = tmpG, finalB = tmpB; // after 3 passes, result is in tmp
    for (var ci = 0; ci < n; ci++) {
      var r = finalR[ci], g = finalG[ci], b = finalB[ci];
      if (r <= 0 && g <= 0 && b <= 0) continue;
      var idx = ci * 4;
      buf[idx]   = Math.min(255, buf[idx]   + ((r + 0.5) | 0));
      buf[idx+1] = Math.min(255, buf[idx+1] + ((g + 0.5) | 0));
      buf[idx+2] = Math.min(255, buf[idx+2] + ((b + 0.5) | 0));
      buf[idx+3] = 255;
    }
  }

  // Skin tone line at 123° — matches Rust renderer's draw_skin_tone_line.
  // Solid line from center to rim with fading alpha (0.7 at center, 0.42 at rim).
  if (showSkinTone) {
    var stAngle = 123 * Math.PI / 180;
    var stCos = Math.cos(stAngle);
    var stSin = -Math.sin(stAngle); // negate for canvas y-down
    var stSteps = Math.round(radius * 1.5);
    for (var si = 0; si < stSteps; si++) {
      var t = si / stSteps;
      var sx = Math.round(half + stCos * radius * t);
      var sy = Math.round(half + stSin * radius * t);
      if (sx >= 0 && sx < size && sy >= 0 && sy < size) {
        var stAlpha = 0.7 * (1.0 - t * 0.4); // match Rust: alpha * (1 - t*0.4)
        var idx = (sy * size + sx) * 4;
        var inv = 1.0 - stAlpha;
        buf[idx]   = Math.round(buf[idx]   * inv + 180 * stAlpha);
        buf[idx+1] = Math.round(buf[idx+1] * inv + 120 * stAlpha);
        buf[idx+2] = Math.round(buf[idx+2] * inv +  60 * stAlpha);
        buf[idx+3] = 255;
      }
    }
  }

  return buf;
}

// Pre-built lookup table of which pixels belong to each harmony zone.
// Avoids sqrt + atan2 per pixel on every overlay render.
var overlayLutSize = 0;
var overlayAngleLut = null;  // Float32Array of atan2 per pixel
var overlayDistLut = null;   // Float32Array of distance per pixel

function ensureOverlayLut(size) {
  if (overlayLutSize === size) return;
  var half = size / 2;
  var n = size * size;
  overlayAngleLut = new Float32Array(n);
  overlayDistLut = new Float32Array(n);
  for (var y = 0; y < size; y++) {
    var wdy = -(y - half);
    for (var x = 0; x < size; x++) {
      var wdx = x - half;
      var i = y * size + x;
      overlayDistLut[i] = Math.sqrt(wdx * wdx + wdy * wdy);
      overlayAngleLut[i] = Math.atan2(wdy, wdx);
    }
  }
  overlayLutSize = size;
}

// Apply harmony overlay by tinting pixels inside zone wedges.
// Uses pre-computed angle/distance LUT instead of per-pixel trig.
//
// Parameters:
//   baseBuf         — Uint8Array RGBA buffer to overlay onto (will be copied, not mutated)
//   size            — render buffer dimension (square)
//   harmonySettings — { scheme, rotation, zoneWidth } or null/undefined to skip
function applyHarmonyOverlay(baseBuf, size, harmonySettings) {
  if (!harmonySettings || !harmonySettings.scheme) return baseBuf;

  var n4 = baseBuf.length;
  if (_overlayBufN !== n4) {
    _overlayBuf = new Uint8Array(n4);
    _overlayBufN = n4;
  }
  _overlayBuf.set(baseBuf);
  var buf = _overlayBuf;
  var radius = (size / 2) * 0.82; // match Rust renderer
  var scheme = harmonySettings.scheme;
  var rot = harmonySettings.rotation || 0;
  var zoneWidth = harmonySettings.zoneWidth || 1.0;
  var halfWidth = (Math.PI / 12) * zoneWidth;

  var baseAngles;
  if (scheme === "complementary") baseAngles = [0, Math.PI];
  else if (scheme === "splitComplementary") baseAngles = [0, Math.PI - Math.PI/12, Math.PI + Math.PI/12];
  else if (scheme === "triadic") baseAngles = [0, Math.PI*2/3, Math.PI*4/3];
  else if (scheme === "tetradic") baseAngles = [0, Math.PI/2, Math.PI, Math.PI*3/2];
  else if (scheme === "analogous") baseAngles = [0, Math.PI/6, -Math.PI/6];
  else return buf;

  ensureOverlayLut(size);
  var n = size * size;

  // Build zone center angles array, pre-normalized to [-π, π] so the per-pixel
  // diff loop only needs a single wrap step.
  var zoneCount = baseAngles.length;
  var centerAngles = new Float64Array(zoneCount);
  for (var z = 0; z < zoneCount; z++) {
    var ca = baseAngles[z] + rot;
    // Wrap into [-π, π]. Using ((x + π) mod 2π) - π keeps numerical stability.
    ca = ((ca + Math.PI) % 6.283185307179586 + 6.283185307179586) % 6.283185307179586 - Math.PI;
    centerAngles[z] = ca;
  }

  // Single pass over all pixels using LUT
  for (var i = 0; i < n; i++) {
    var dist = overlayDistLut[i];
    if (dist < 2 || dist > radius) continue;

    var pAngle = overlayAngleLut[i];
    var inZone = false;
    for (var z = 0; z < zoneCount; z++) {
      var aDiff = pAngle - centerAngles[z];
      // Normalize to [-π, π]. centerAngles are pre-wrapped to [-π, π], so a single
      // pass is sufficient: aDiff lies in (-3π, 3π) at most.
      if (aDiff > Math.PI) aDiff -= 6.283185307179586;
      else if (aDiff < -Math.PI) aDiff += 6.283185307179586;
      if (Math.abs(aDiff) <= halfWidth) { inZone = true; break; }
    }

    if (inZone) {
      var idx = i * 4;
      buf[idx]   = Math.min(255, (buf[idx]   * 205 + 0x5a * 51 + 128) >> 8);
      buf[idx+1] = Math.min(255, (buf[idx+1] * 205 + 0x8f * 51 + 128) >> 8);
      buf[idx+2] = Math.min(255, (buf[idx+2] * 205 + 0xd5 * 51 + 128) >> 8);
    }
  }

  return buf;
}

// Invalidate cached graticule and release pooled buffers (e.g., when panel hides).
function invalidateGraticuleCache() {
  cachedGraticuleBuf = null;
  cachedGraticuleSize = 0;
  _renderBufRing[0] = null; _renderBufRing[1] = null;
  _renderBufRingIdx = 0; _renderBufN = 0;
  _overlayBuf = null; _overlayBufN = 0;
  _heatmapDensity = null; _heatmapDensityN = 0;
  _bloomBufN = 0;
  _bloomR = null; _bloomG = null; _bloomB = null;
  _bloomTmpR = null; _bloomTmpG = null; _bloomTmpB = null;
}

module.exports = {
  renderGraticule: renderGraticule,
  renderToBuffer: renderToBuffer,
  applyHarmonyOverlay: applyHarmonyOverlay,
  hsvToRgb: hsvToRgb,
  invalidateGraticuleCache: invalidateGraticuleCache,
  // For testing only:
  _drawChar: drawChar,
  _drawString: drawString,
  _ensureOverlayLut: ensureOverlayLut,
};
