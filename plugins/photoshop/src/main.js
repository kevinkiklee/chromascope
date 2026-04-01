const { entrypoints } = require("uxp");
const { imaging, core } = require("photoshop");

let getDocumentPixels, events, handleEditCommand;
let isRefreshing = false;
let scopeSize = 300;
let lastPixels = null;

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
  // cx, cy is the center of the string
  var charW = 4; // 3px char + 1px gap
  var totalW = str.length * charW - 1;
  var ox = cx - totalW / 2;
  var oy = cy - 2.5;
  for (var i = 0; i < str.length; i++) {
    drawChar(buf, size, str[i], ox + i * charW, oy, r, g, b);
  }
}

// Software renderer: draws vectorscope into an RGBA pixel buffer.
// We can't use Canvas 2D in UXP (no drawImage/getImageData/putImageData/toDataURL),
// so everything is rendered pixel-by-pixel into a Uint8Array, then encoded to JPEG
// via the Photoshop Imaging API for display in an <img> element.
function renderToBuffer(size, pixels) {
  const buf = new Uint8Array(size * size * 4);
  const half = size / 2;
  const radius = size * 0.40;

  // Fill background #111111
  for (var i = 0; i < size * size; i++) {
    buf[i * 4] = 0x11;
    buf[i * 4 + 1] = 0x11;
    buf[i * 4 + 2] = 0x11;
    buf[i * 4 + 3] = 255;
  }

  function setPixel(x, y, r, g, b) {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || x >= size || y < 0 || y >= size) return;
    var idx = (y * size + x) * 4;
    buf[idx] = r;
    buf[idx + 1] = g;
    buf[idx + 2] = b;
    buf[idx + 3] = 255;
  }

  // Draw graticule rings (Bresenham circle)
  function drawCircle(cx, cy, r, cr, cg, cb) {
    var steps = Math.max(Math.round(r * 6.28), 60);
    for (var i = 0; i < steps; i++) {
      var a = (i / steps) * Math.PI * 2;
      setPixel(cx + Math.cos(a) * r, cy + Math.sin(a) * r, cr, cg, cb);
    }
  }

  [0.25, 0.5, 0.75, 1.0].forEach(function(r) {
    drawCircle(half, half, radius * r, 0x33, 0x33, 0x33);
  });

  // Crosshair
  for (var cx = Math.round(half - radius); cx <= Math.round(half + radius); cx++) {
    setPixel(cx, half, 0x2a, 0x2a, 0x2a);
  }
  for (var cy = Math.round(half - radius); cy <= Math.round(half + radius); cy++) {
    setPixel(half, cy, 0x2a, 0x2a, 0x2a);
  }

  // Degree labels around the outer rim
  var labelRadius = radius * 1.08;
  var degrees = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330];
  for (var di = 0; di < degrees.length; di++) {
    var deg = degrees[di];
    var da = deg * Math.PI / 180;
    var lx = half + Math.cos(da) * labelRadius;
    var ly = half - Math.sin(da) * labelRadius;
    drawString(buf, size, String(deg) + '\xB0', lx, ly, 0x66, 0x66, 0x66);
    // Small tick mark at the rim
    var tickInner = radius * 0.97;
    var tickOuter = radius * 1.02;
    for (var ti = 0; ti < 5; ti++) {
      var td = tickInner + (tickOuter - tickInner) * ti / 4;
      setPixel(half + Math.cos(da) * td, half - Math.sin(da) * td, 0x55, 0x55, 0x55);
    }
  }

  // Color targets at actual YCbCr BT.601 chrominance positions
  // Each: [cb, cr, R, G, B] where cb/cr are normalized to [-1,1]
  // Computed from BT.601: Cb = (-0.168736*R - 0.331264*G + 0.5*B)*2
  //                        Cr = (0.5*R - 0.418688*G - 0.081312*B)*2
  var targets = [
    [-0.3375, 1.0,    0xff, 0x00, 0x00],  // Red
    [-1.0,    0.1626, 0xff, 0xff, 0x00],  // Yellow
    [-0.6625, -0.8374, 0x00, 0xff, 0x00], // Green
    [0.3375, -1.0,    0x00, 0xff, 0xff],  // Cyan
    [1.0,    -0.1626, 0x00, 0x00, 0xff],  // Blue
    [0.6625,  0.8374, 0xff, 0x00, 0xff],  // Magenta
  ];
  var dotR = Math.max(3, Math.round(size * 0.014));
  targets.forEach(function(t) {
    var tx = half + t[0] * radius;
    var ty = half - t[1] * radius;
    for (var dy = -dotR; dy <= dotR; dy++) {
      for (var dx = -dotR; dx <= dotR; dx++) {
        if (dx * dx + dy * dy <= dotR * dotR) {
          setPixel(tx + dx, ty + dy, t[2], t[3], t[4]);
        }
      }
    }
  });

  // Center dot
  setPixel(half, half, 0x55, 0x55, 0x55);
  setPixel(half + 1, half, 0x55, 0x55, 0x55);
  setPixel(half - 1, half, 0x55, 0x55, 0x55);
  setPixel(half, half + 1, 0x55, 0x55, 0x55);
  setPixel(half, half - 1, 0x55, 0x55, 0x55);

  // Get density mode from core settings
  var densityMode = "scatter";
  if (window.__chromascope) {
    var settings = window.__chromascope.getSettings();
    if (settings && settings.densityMode) densityMode = settings.densityMode;
  }

  // Map RGB pixel to YCbCr BT.601 scope coordinates
  // Returns [cb, cr] normalized to [-1, 1]
  function mapToScope(r255, g255, b255) {
    var cb = (-0.168736 * r255 - 0.331264 * g255 + 0.5 * b255) * 2;
    var cr = (0.5 * r255 - 0.418688 * g255 - 0.081312 * b255) * 2;
    return [cb, cr];
  }

  // Plot pixels
  if (pixels) {
    var data = pixels.data;
    var total = pixels.width * pixels.height;

    if (densityMode === "heatmap" || densityMode === "bloom") {
      if (densityMode === "heatmap") {
        // Accumulate density map for heatmap
        var density = new Uint32Array(size * size);
        var maxDensity = 0;
        for (var pi = 0; pi < total; pi++) {
          var ri = data[pi * 3], gi = data[pi * 3 + 1], bi = data[pi * 3 + 2];
          var sc = mapToScope(ri / 255, gi / 255, bi / 255);
          var px = Math.round(half + sc[0] * radius);
          var py = Math.round(half - sc[1] * radius);
          if (px >= 0 && px < size && py >= 0 && py < size) {
            var di = py * size + px;
            density[di]++;
            if (density[di] > maxDensity) maxDensity = density[di];
          }
        }
      }

      if (densityMode === "bloom") {
        // Bloom: additive colored glow per point (matches Rust renderer)
        var glowR = Math.min(20, Math.max(2, size / 20 * (500 / total)));
        var alpha = Math.min(0.3, Math.max(0.01, 200 / total));
        var bloomR = new Float32Array(size * size);
        var bloomG = new Float32Array(size * size);
        var bloomB = new Float32Array(size * size);

        for (var pi2 = 0; pi2 < total; pi2++) {
          var ri2 = data[pi2 * 3], gi2 = data[pi2 * 3 + 1], bi2 = data[pi2 * 3 + 2];
          var sc2 = mapToScope(ri2 / 255, gi2 / 255, bi2 / 255);
          var cx2 = half + sc2[0] * radius;
          var cy2 = half - sc2[1] * radius;
          var pr = ri2 * alpha, pg = gi2 * alpha, pb = bi2 * alpha;

          var xMin = Math.max(0, Math.floor(cx2 - glowR));
          var xMax = Math.min(size - 1, Math.ceil(cx2 + glowR));
          var yMin = Math.max(0, Math.floor(cy2 - glowR));
          var yMax = Math.min(size - 1, Math.ceil(cy2 + glowR));

          for (var iy = yMin; iy <= yMax; iy++) {
            for (var ix = xMin; ix <= xMax; ix++) {
              var ddx = ix - cx2, ddy = iy - cy2;
              var dist = Math.sqrt(ddx * ddx + ddy * ddy);
              if (dist > glowR) continue;
              var falloff = 1.0 - dist / glowR;
              var bi3 = iy * size + ix;
              bloomR[bi3] += pr * falloff;
              bloomG[bi3] += pg * falloff;
              bloomB[bi3] += pb * falloff;
            }
          }
        }

        // Composite bloom onto buffer additively
        for (var ci = 0; ci < size * size; ci++) {
          if (bloomR[ci] <= 0 && bloomG[ci] <= 0 && bloomB[ci] <= 0) continue;
          var idx = ci * 4;
          buf[idx] = Math.min(255, Math.round(buf[idx] + bloomR[ci]));
          buf[idx+1] = Math.min(255, Math.round(buf[idx+1] + bloomG[ci]));
          buf[idx+2] = Math.min(255, Math.round(buf[idx+2] + bloomB[ci]));
          buf[idx+3] = 255;
        }
      } else {
        // Heatmap: density accumulation with color ramp
        // Render density to color
        if (maxDensity > 0) {
          var logMax = Math.log(maxDensity + 1);
          for (var dy = 0; dy < size; dy++) {
            for (var dx = 0; dx < size; dx++) {
              var dv = density[dy * size + dx];
              if (dv === 0) continue;
              var t = Math.log(dv + 1) / logMax;
              var idx = (dy * size + dx) * 4;
              // Black → blue → cyan → green → yellow → red
              if (t < 0.2)      { var s = t/0.2;       buf[idx]=0;                    buf[idx+1]=0;                    buf[idx+2]=Math.round(s*255); }
              else if (t < 0.4) { var s = (t-0.2)/0.2; buf[idx]=0;                    buf[idx+1]=Math.round(s*255);    buf[idx+2]=255; }
              else if (t < 0.6) { var s = (t-0.4)/0.2; buf[idx]=0;                    buf[idx+1]=255;                  buf[idx+2]=Math.round((1-s)*255); }
              else if (t < 0.8) { var s = (t-0.6)/0.2; buf[idx]=Math.round(s*255);    buf[idx+1]=255;                  buf[idx+2]=0; }
              else              { var s = (t-0.8)/0.2; buf[idx]=255;                   buf[idx+1]=Math.round((1-s)*255); buf[idx+2]=0; }
              buf[idx + 3] = 255;
            }
          }
        }
      }
    } else {
      // Scatter mode: direct pixel plotting
      for (var pi = 0; pi < total; pi++) {
        var ri = data[pi * 3], gi = data[pi * 3 + 1], bi = data[pi * 3 + 2];
        var sc = mapToScope(ri / 255, gi / 255, bi / 255);
        var px = Math.round(half + sc[0] * radius);
        var py = Math.round(half - sc[1] * radius);
        if (px >= 0 && px < size && py >= 0 && py < size) {
          var idx = (py * size + px) * 4;
          buf[idx] = ri;
          buf[idx + 1] = gi;
          buf[idx + 2] = bi;
          buf[idx + 3] = 255;
        }
      }
    }
    console.log("[renderScope] drew", total, "points as", densityMode, "on", size, "buffer");
  }

  return buf;
}

// Draw harmony overlay onto a copy of the base buffer.
// Creates a new buffer each time so we can re-render overlays without re-plotting pixels.
function applyHarmonyOverlay(baseBuf, size) {
  if (!window.__chromascope) return baseBuf;
  var hSettings = window.__chromascope.getSettings();
  if (!hSettings || !hSettings.harmony || !hSettings.harmony.scheme) return baseBuf;

  var buf = new Uint8Array(baseBuf); // Copy base buffer
  var half = size / 2;
  var radius = size * 0.40;
  var scheme = hSettings.harmony.scheme;
  var rot = hSettings.harmony.rotation || 0;
  var zoneWidth = hSettings.harmony.zoneWidth || 1.0;
  var baseHalfWidth = Math.PI / 12;
  var halfWidth = baseHalfWidth * zoneWidth;

  var baseAngles = [];
  if (scheme === "complementary") baseAngles = [0, Math.PI];
  else if (scheme === "splitComplementary") baseAngles = [0, Math.PI - Math.PI/12, Math.PI + Math.PI/12];
  else if (scheme === "triadic") baseAngles = [0, Math.PI*2/3, Math.PI*4/3];
  else if (scheme === "tetradic") baseAngles = [0, Math.PI/2, Math.PI, Math.PI*3/2];
  else if (scheme === "analogous") baseAngles = [0, Math.PI/6, -Math.PI/6];

  for (var ai = 0; ai < baseAngles.length; ai++) {
    var centerAngle = baseAngles[ai] + rot;
    for (var wy = 0; wy < size; wy++) {
      for (var wx = 0; wx < size; wx++) {
        var wdx = wx - half;
        var wdy = -(wy - half);
        var wdist = Math.sqrt(wdx * wdx + wdy * wdy);
        if (wdist < 2 || wdist > radius) continue;
        var pAngle = Math.atan2(wdy, wdx);
        var aDiff = pAngle - centerAngle;
        while (aDiff > Math.PI) aDiff -= Math.PI * 2;
        while (aDiff < -Math.PI) aDiff += Math.PI * 2;
        if (Math.abs(aDiff) <= halfWidth) {
          var idx = (wy * size + wx) * 4;
          buf[idx] = Math.min(255, Math.round(buf[idx] * 0.8 + 0x5a * 0.2));
          buf[idx+1] = Math.min(255, Math.round(buf[idx+1] * 0.8 + 0x8f * 0.2));
          buf[idx+2] = Math.min(255, Math.round(buf[idx+2] * 0.8 + 0xd5 * 0.2));
        }
      }
    }
  }

  return buf;
}

// Cached base buffer (without overlay)
var cachedBaseBuf = null;

// Encode RGBA buffer to base64 JPEG via Photoshop Imaging API and display in <img>.
// This is the only way to render custom graphics in UXP — canvas toDataURL is unavailable.
async function displayScope(rgbaBuf, size) {
  var img = document.getElementById("scope-image");
  if (!img) return;

  try {
    // Create RGB buffer (no alpha) for encoding
    var rgbBuf = new Uint8Array(size * size * 3);
    for (var i = 0; i < size * size; i++) {
      rgbBuf[i * 3] = rgbaBuf[i * 4];
      rgbBuf[i * 3 + 1] = rgbaBuf[i * 4 + 1];
      rgbBuf[i * 3 + 2] = rgbaBuf[i * 4 + 2];
    }

    var imageData = await imaging.createImageDataFromBuffer(rgbBuf, {
      width: size,
      height: size,
      components: 3,
      colorSpace: "RGB",
      colorProfile: "sRGB IEC61966-2.1",
      componentSize: 8,
    });

    var jpegData = await imaging.encodeImageData({
      imageData: imageData,
      base64: true,
    });

    imageData.dispose();

    img.src = "data:image/jpeg;base64," + jpegData;
  } catch (e) {
    console.error("[renderScope] encode failed:", e);
  }
}

async function renderScope(pixels, overlayOnly) {
  var buf;
  if (overlayOnly && cachedBaseBuf) {
    // Fast path: reuse cached base, only re-draw overlay
    buf = applyHarmonyOverlay(cachedBaseBuf, scopeSize);
  } else {
    // Full render: build base + apply overlay
    cachedBaseBuf = renderToBuffer(scopeSize, pixels);
    buf = applyHarmonyOverlay(cachedBaseBuf, scopeSize);
  }
  await displayScope(buf, scopeSize);
}

async function refresh() {
  if (isRefreshing) return;
  isRefreshing = true;

  try {

    const pixels = await getDocumentPixels();

    if (pixels) {
      lastPixels = pixels;
      await renderScope(pixels);

    } else {

    }
  } catch (err) {
    console.error("Chromascope refresh error:", err);

  } finally {
    isRefreshing = false;
  }
}

async function init() {
  const imagingModule = require("./src/imaging.js");
  getDocumentPixels = imagingModule.getDocumentPixels;
  events = require("./src/events.js");
  handleEditCommand = require("./src/edits.js").handleEditCommand;



  // Fixed render resolution independent of panel size.
  // CSS width:100% on the <img> scales it to fill the container.
  // Higher values = sharper but slower; 500 is a good balance.
  scopeSize = 500;

  console.log("[main] scopeSize:", scopeSize);

  // After a short delay, measure actual container width and lock its height to match (square)
  await new Promise(function(resolve) { setTimeout(resolve, 300); });
  var container = document.getElementById("scope-canvas-container");
  if (container) {
    var w = container.clientWidth || container.offsetWidth;
    if (w > 50) {
      container.style.height = w + "px";
      console.log("[main] locked container height:", w);
    }
  }

  // Debounced settings listener: waits 300ms after the last change before re-rendering.
  // Without debouncing, dragging the rotation slider would trigger hundreds of full renders.
  if (window.__chromascope) {
    var settingsTimer = null;
    var settingsRendering = false;
    var settingsDirty = false;
    window.__chromascope.onSettingsChanged = function() {
      if (settingsRendering) { settingsDirty = true; return; }
      if (settingsTimer) clearTimeout(settingsTimer);
      settingsTimer = setTimeout(function() {
        settingsTimer = null;
        settingsRendering = true;
        console.log("[main] settings changed, re-rendering");
        renderScope(lastPixels, false).then(function() {
          settingsRendering = false;
          if (settingsDirty) {
            settingsDirty = false;
            window.__chromascope.onSettingsChanged();
          }
        });
      }, 300);
    };
  }

  // Click-to-rotate overlay on the scope image
  var scopeContainer = document.getElementById("scope-canvas-container");
  if (scopeContainer && window.__chromascope) {
    scopeContainer.addEventListener("click", function(e) {
      var settings = window.__chromascope.getSettings();
      if (!settings || !settings.harmony || !settings.harmony.scheme) return;

      var rect = scopeContainer.getBoundingClientRect();
      var cx = rect.left + rect.width / 2;
      var cy = rect.top + rect.height / 2;
      var dx = e.clientX - cx;
      var dy = -(e.clientY - cy);
      var angle = Math.atan2(dy, dx);

      window.__chromascope.updateSettings({
        harmony: {
          scheme: settings.harmony.scheme,
          rotation: angle,
          zoneWidth: settings.harmony.zoneWidth,
          pullStrengths: settings.harmony.pullStrengths
        }
      });
    });
  }

  // Initial render with no data (just graticule), then fetch pixels
  await renderScope(null);
  await refresh();
  await events.startListening(refresh);
}

entrypoints.setup({
  panels: {
    chromascopePanel: {
      show() {
        init();
      },
      hide() {
        if (events) events.stopListening();
      },
    },
  },
});
