const fs = require("fs");
const path = require("path");

const coreSource = path.resolve(__dirname, "../../../packages/core/build/index.html");
const coreDest = path.resolve(__dirname, "../core/index.html");
const bundleDest = path.resolve(__dirname, "../core/scope-bundle.js");

if (!fs.existsSync(coreSource)) {
  console.error("Core build not found! Run 'turbo run build --filter=@chromascope/core' first.");
  process.exit(1);
}

// Copy full core HTML (for reference)
fs.mkdirSync(path.dirname(coreDest), { recursive: true });
fs.copyFileSync(coreSource, coreDest);
console.log("Copied core build → plugins/photoshop/core/index.html");

// Extract inlined JS and CSS from the single-file HTML for direct embedding
const html = fs.readFileSync(coreSource, "utf8");

const scriptMatch = html.match(/<script type="module"[^>]*>([\s\S]*?)<\/script>/);
const styleMatches = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)];

if (!scriptMatch) {
  console.error("Could not extract JS from core build!");
  process.exit(1);
}

let jsCode = scriptMatch[1];

// Remove Vite modulepreload polyfill (uses MutationObserver, not available in UXP)
jsCode = jsCode.replace(
  /\(function\(\)\{const\s+\w+=document\.createElement\("link"\)[\s\S]*?\}\)\(\);/,
  "/* vite polyfill removed */"
);

// Boost scatter plot alpha and dot size for UXP (no additive blending)
// Original alpha: Math.max(.02, Math.min(.5, 500/t.length))
jsCode = jsCode.replace(
  /Math\.max\(\.02,Math\.min\(\.5,500\/t\.length\)\)/,
  'Math.max(.4,Math.min(1,5000/t.length))'
);
// Original dot size: Math.max(1, Math.round(o/200))
jsCode = jsCode.replace(
  /Math\.max\(1,Math\.round\(o\/200\)\)/,
  'Math.max(2,Math.round(o/100))'
);

// Find the minified variable names for scope instance, controls, and draw function
// Pattern: X=new ue,Y=Se(  where X=scope, Y=controls
const varMatch = jsCode.match(/([A-Za-z]+)=new ue,([A-Za-z]+)=Se\(/);
if (!varMatch) {
  console.error("Could not find scope/controls variable names in minified code!");
  process.exit(1);
}
const scopeVar = varMatch[1];
const ctrlVar = varMatch[2];

// Find the draw function: function X(){...scope.render...}
const drawMatch = jsCode.match(/function ([A-Za-z]+)\(\)\{const \w+=\w+\.width;/);
const drawFn = drawMatch ? drawMatch[1] : "L";

console.log(`  Detected minified vars: scope=${scopeVar}, controls=${ctrlVar}, draw=${drawFn}`);

// Replace the message-based API with a direct window API.
jsCode = jsCode.replace(
  /fe\(e=>\{switch[\s\S]*?\}\}\);/,
  `
window.__chromascope = {
  setPixels: function(pixelData) {
    ${scopeVar}.setPixels(pixelData);
    ${drawFn}();
  },
  updateSettings: function(partial) {
    ${scopeVar}.updateSettings(partial);
    ${ctrlVar}.update(${scopeVar}.settings);
    ${drawFn}();
  },
  getSettings: function() { return ${scopeVar}.settings; },
  draw: function() { ${drawFn}(); },
  onSettingsChanged: null
};
// Patch scope.updateSettings to notify main.js on setting changes
var _origUpdateSettings = ${scopeVar}.updateSettings.bind(${scopeVar});
${scopeVar}.updateSettings = function(partial) {
  _origUpdateSettings(partial);
  if (window.__chromascope && typeof window.__chromascope.onSettingsChanged === 'function') {
    window.__chromascope.onSettingsChanged(${scopeVar}.settings);
  }
};
// Replace render entirely -- UXP canvas doesn't support drawing after initial render pass
${scopeVar}.render = function(ctx, size) {
  // Clear and draw background
  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = '#111111';
  ctx.fillRect(0, 0, size, size);

  var half = size / 2;
  var radius = size * 0.45;

  // Draw graticule rings
  ctx.strokeStyle = '#333333';
  ctx.lineWidth = 1;
  var rings = [0.25, 0.5, 0.75, 1.0];
  for (var ri = 0; ri < rings.length; ri++) {
    ctx.beginPath();
    ctx.arc(half, half, radius * rings[ri], 0, Math.PI * 2);
    ctx.stroke();
  }

  // Draw crosshair
  ctx.strokeStyle = '#2a2a2a';
  ctx.beginPath();
  ctx.moveTo(half - radius, half);
  ctx.lineTo(half + radius, half);
  ctx.moveTo(half, half - radius);
  ctx.lineTo(half, half + radius);
  ctx.stroke();

  // Draw color targets
  var targets = [
    {label:'R', deg:0,   color:'#ff4444'},
    {label:'Y', deg:60,  color:'#ffff44'},
    {label:'G', deg:120, color:'#44ff44'},
    {label:'C', deg:180, color:'#44ffff'},
    {label:'B', deg:240, color:'#4444ff'},
    {label:'M', deg:300, color:'#ff44ff'}
  ];
  for (var ti = 0; ti < targets.length; ti++) {
    var t = targets[ti];
    var a = t.deg * Math.PI / 180;
    var tx = Math.cos(a), ty = -Math.sin(a);
    ctx.fillStyle = t.color;
    ctx.beginPath();
    ctx.arc(half + tx * radius, half + ty * radius, size * 0.012, 0, Math.PI * 2);
    ctx.fill();
  }

  // Draw center dot
  ctx.fillStyle = '#555555';
  ctx.beginPath();
  ctx.arc(half, half, 2, 0, Math.PI * 2);
  ctx.fill();

  // Draw scatter points
  var points = this.mappedPoints;
  if (points.length > 0) {
    function toHex(n) { var h = n.toString(16); return h.length < 2 ? '0' + h : h; }
    for (var i = 0; i < points.length; i++) {
      var p = points[i];
      var px = half + p.x * radius;
      var py = half - p.y * radius;
      ctx.fillStyle = '#' + toHex(p.r) + toHex(p.g) + toHex(p.b);
      ctx.fillRect(Math.round(px), Math.round(py), 1, 1);
    }
    console.log("[render] drew", points.length, "points on", size, "canvas");
  }
};

console.log("[scope-bundle] Chromascope core loaded");
`
);

// Skip injecting core CSS entirely — index.html provides all Photoshop-native styles
let cssCode = "";

const bundle = `// Chromascope core bundle
(function() {
  // Patch globalCompositeOperation -- UXP may not support "lighter"
  var _origCompSet;
  try {
    var _desc = Object.getOwnPropertyDescriptor(CanvasRenderingContext2D.prototype, 'globalCompositeOperation');
    if (_desc && _desc.set) {
      _origCompSet = _desc.set;
      Object.defineProperty(CanvasRenderingContext2D.prototype, 'globalCompositeOperation', {
        get: _desc.get,
        set: function(v) {
          try { _origCompSet.call(this, v); }
          catch(e) { _origCompSet.call(this, 'source-over'); }
        },
        configurable: true
      });
    }
  } catch(e) {}

  // Polyfill window.parent.postMessage (core tries to send messages to host via this)
  if (!window.parent || !window.parent.postMessage) {
    window.parent = window;
  }

  // Polyfill canvas methods not available in UXP
  var proto = CanvasRenderingContext2D.prototype;

  // save/restore: implement as manual state stack
  if (!proto.save) {
    proto._stateStack = [];
    proto.save = function() {
      this._stateStack = this._stateStack || [];
      this._stateStack.push({
        globalAlpha: this.globalAlpha,
        globalCompositeOperation: this.globalCompositeOperation,
        strokeStyle: this.strokeStyle,
        fillStyle: this.fillStyle,
        lineWidth: this.lineWidth
      });
    };
    proto.restore = function() {
      this._stateStack = this._stateStack || [];
      if (this._stateStack.length > 0) {
        var s = this._stateStack.pop();
        this.globalAlpha = s.globalAlpha;
        this.globalCompositeOperation = s.globalCompositeOperation;
        this.strokeStyle = s.strokeStyle;
        this.fillStyle = s.fillStyle;
        this.lineWidth = s.lineWidth;
      }
    };
  }
  if (!proto.setLineDash) proto.setLineDash = function() {};
  if (!proto.createImageData) {
    proto.createImageData = function(w, h) {
      return { width: w, height: h, data: new Uint8ClampedArray(w * h * 4) };
    };
  }
  if (!proto.putImageData) {
    proto.putImageData = function(imageData, dx, dy) {
      // Fallback: draw pixel-by-pixel using fillRect
      var d = imageData.data, w = imageData.width, h = imageData.height;
      for (var y = 0; y < h; y++) {
        for (var x = 0; x < w; x++) {
          var i = (y * w + x) * 4;
          if (d[i+3] > 0) {
            this.fillStyle = "rgb(" + d[i] + "," + d[i+1] + "," + d[i+2] + ")";
            this.fillRect(dx + x, dy + y, 1, 1);
          }
        }
      }
    };
  }
  if (!proto.fillText) proto.fillText = function() {};
  if (!proto.measureText) proto.measureText = function() { return { width: 0 }; };
  if (!proto.createRadialGradient) {
    proto.createRadialGradient = function() {
      return { addColorStop: function() {} };
    };
  }
  try {
    var desc = Object.getOwnPropertyDescriptor(proto, 'font');
    if (!desc || !desc.set) {
      Object.defineProperty(proto, 'font', { set: function() {}, get: function() { return ''; }, configurable: true });
    }
  } catch(e) {}

  var style = document.createElement("style");
  style.textContent = ${JSON.stringify(cssCode)};
  document.head.appendChild(style);
  ${jsCode}
})();
`;

fs.writeFileSync(bundleDest, bundle);
console.log("Extracted scope bundle → plugins/photoshop/core/scope-bundle.js");
console.log("Photoshop plugin build complete.");
