const { entrypoints } = require("uxp");
const { imaging, core } = require("photoshop");

let getDocumentPixels, events, handleEditCommand;
let isRefreshing = false;
let statusBar = null;
let scopeSize = 300;
let lastPixels = null;

// Software renderer: draws vectorscope into an RGBA pixel buffer
function renderToBuffer(size, pixels) {
  const buf = new Uint8Array(size * size * 4);
  const half = size / 2;
  const radius = size * 0.45;

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

  // Scatter plot
  if (pixels) {
    var data = pixels.data;
    var total = pixels.width * pixels.height;

    for (var pi = 0; pi < total; pi++) {
      var ri = data[pi * 3], gi = data[pi * 3 + 1], bi = data[pi * 3 + 2];
      var r255 = ri / 255, g255 = gi / 255, b255 = bi / 255;
      var cb = (-0.168736 * r255 - 0.331264 * g255 + 0.5 * b255) * 2;
      var cr = (0.5 * r255 - 0.418688 * g255 - 0.081312 * b255) * 2;
      var px = Math.round(half + cb * radius);
      var py = Math.round(half - cr * radius);
      if (px >= 0 && px < size && py >= 0 && py < size) {
        var idx = (py * size + px) * 4;
        buf[idx] = ri;
        buf[idx + 1] = gi;
        buf[idx + 2] = bi;
        buf[idx + 3] = 255;
      }
    }
    console.log("[renderScope] drew", total, "points on", size, "buffer");
  }

  // Draw harmony overlay from core settings
  if (window.__chromascope) {
    var settings = window.__chromascope.getSettings();
    if (settings && settings.harmony && settings.harmony.scheme) {
      var scheme = settings.harmony.scheme;
      var rot = settings.harmony.rotation || 0;
      var zoneWidth = settings.harmony.zoneWidth || 1.0;

      // Determine harmony angles based on scheme
      var angles = [];
      if (scheme === "complementary") angles = [0, Math.PI];
      else if (scheme === "splitComplementary") angles = [0, Math.PI * 5/6, Math.PI * 7/6];
      else if (scheme === "triadic") angles = [0, Math.PI * 2/3, Math.PI * 4/3];
      else if (scheme === "tetradic") angles = [0, Math.PI/2, Math.PI, Math.PI * 3/2];
      else if (scheme === "analogous") angles = [0, Math.PI/6, -Math.PI/6];

      // Draw zone lines
      for (var ai = 0; ai < angles.length; ai++) {
        var angle = angles[ai] + rot;
        var steps = Math.round(radius);
        for (var si = 0; si < steps; si++) {
          var dist = (si / steps) * radius;
          var lx = Math.round(half + Math.cos(angle) * dist);
          var ly = Math.round(half - Math.sin(angle) * dist);
          setPixel(lx, ly, 0x5a, 0x8f, 0xd5);
        }
      }
    }
  }

  return buf;
}

// Encode RGBA buffer to base64 JPEG via Photoshop Imaging API and display in <img>
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
    console.log("[renderScope] displayed scope image");
  } catch (e) {
    console.error("[renderScope] encode failed:", e);
  }
}

async function renderScope(pixels) {
  var buf = renderToBuffer(scopeSize, pixels);
  await displayScope(buf, scopeSize);
}

async function refresh() {
  if (isRefreshing) return;
  isRefreshing = true;

  try {
    if (statusBar) statusBar.textContent = "Refreshing...";
    const pixels = await getDocumentPixels();

    if (pixels) {
      lastPixels = pixels;
      await renderScope(pixels);
      if (statusBar) statusBar.textContent = `${pixels.width}×${pixels.height} · ${pixels.colorProfile}`;
    } else {
      if (statusBar) statusBar.textContent = "No document open";
    }
  } catch (err) {
    console.error("Chromascope refresh error:", err);
    if (statusBar) statusBar.textContent = "Error: " + String(err);
  } finally {
    isRefreshing = false;
  }
}

async function init() {
  const imagingModule = require("./src/imaging.js");
  getDocumentPixels = imagingModule.getDocumentPixels;
  events = require("./src/events.js");
  handleEditCommand = require("./src/edits.js").handleEditCommand;

  statusBar = document.getElementById("status-bar");

  // Fixed render resolution — CSS width:100% handles display scaling
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

  // Hook core settings changes to re-render via software pipeline (debounced)
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
        renderScope(lastPixels).then(function() {
          settingsRendering = false;
          if (settingsDirty) {
            settingsDirty = false;
            window.__chromascope.onSettingsChanged();
          }
        });
      }, 300);
    };
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
