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

// No individual patches needed -- we polyfill missing canvas methods at runtime (see below)

// Replace the message-based API with a direct window API.
// The core's onHostMessage listener (fe(...)) needs to become a direct callable.
// We expose window.__chromascope so the plugin can call setPixels directly.
jsCode = jsCode.replace(
  /fe\(e=>\{switch[\s\S]*?\}\}\);/,
  `
window.__chromascope = {
  setPixels: function(pixelData) {
    S.setPixels(pixelData);
    L();
  },
  updateSettings: function(partial) {
    S.updateSettings(partial);
    F.update(S.settings);
    L();
  },
  getSettings: function() { return S.settings; }
};
console.log("[scope-bundle] Chromascope core loaded");
`
);

// Extract only the controls component CSS, skip the base layout CSS
let cssCode = "";
for (const match of styleMatches) {
  const css = match[1].trim();
  // Only grab the controls/button CSS, not the html/body/root layout
  if (css.includes(".vs-btn") || css.includes(".vs-control")) {
    cssCode += css + "\n";
  }
}

const bundle = `// Chromascope core bundle
(function() {
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
