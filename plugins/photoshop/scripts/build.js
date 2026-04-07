const fs = require("fs");
const path = require("path");

const coreBundleSrc = path.resolve(__dirname, "../../../packages/core/build-lib/chromascope-core.iife.js");
const bundleDest = path.resolve(__dirname, "../core/scope-bundle.js");
const coreHtmlSrc = path.resolve(__dirname, "../../../packages/core/build/index.html");
const coreHtmlDest = path.resolve(__dirname, "../core/index.html");

// Validate inputs exist
if (!fs.existsSync(coreBundleSrc)) {
  console.error("Core library bundle not found. Run 'npm run build:lib' in packages/core first.");
  console.error("Expected:", coreBundleSrc);
  process.exit(1);
}
if (!fs.existsSync(coreHtmlSrc)) {
  console.error("Core HTML not found. Run 'npm run build' in packages/core first.");
  console.error("Expected:", coreHtmlSrc);
  process.exit(1);
}

fs.mkdirSync(path.dirname(bundleDest), { recursive: true });
fs.copyFileSync(coreHtmlSrc, coreHtmlDest);

let coreBundle = fs.readFileSync(coreBundleSrc, "utf-8");

// UXP canvas polyfills
const polyfills = `
// === UXP Canvas Polyfills ===
(function() {
  try {
    var proto = CanvasRenderingContext2D.prototype;
    if (!proto._stateStack) {
      var _origSave = proto.save, _origRestore = proto.restore;
      proto.save = function() { if (!this._stateStack) this._stateStack = []; this._stateStack.push({ gco: this.globalCompositeOperation, ga: this.globalAlpha, ld: this._lineDash || [] }); _origSave.call(this); };
      proto.restore = function() { _origRestore.call(this); if (this._stateStack && this._stateStack.length) { var s = this._stateStack.pop(); this.globalCompositeOperation = s.gco; this.globalAlpha = s.ga; this._lineDash = s.ld; } };
    }
    if (!proto.setLineDash) {
      proto.setLineDash = function(d) { this._lineDash = d; };
      proto.getLineDash = function() { return this._lineDash || []; };
    }
    if (!proto.createImageData) {
      proto.createImageData = function(w, h) { return { width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }; };
    }
    if (!proto.putImageData) {
      proto.putImageData = function(id, dx, dy) {
        var c = document.createElement("canvas"); c.width = id.width; c.height = id.height;
        var tc = c.getContext("2d"); var td = tc.createImageData(id.width, id.height);
        td.data.set(id.data); tc.putImageData(td, 0, 0);
        this.drawImage(c, dx, dy);
      };
    }
    if (!proto.fillText) { proto.fillText = function() {}; }
    if (!proto.measureText) { proto.measureText = function(t) { return { width: (t||"").length * 6 }; }; }
    if (!Object.getOwnPropertyDescriptor(proto, "font")) {
      Object.defineProperty(proto, "font", { get: function() { return this._font || "10px sans-serif"; }, set: function(v) { this._font = v; }, configurable: true });
    }
    try {
      var desc = Object.getOwnPropertyDescriptor(proto, "globalCompositeOperation");
      if (desc && desc.set) {
        var origSet = desc.set;
        Object.defineProperty(proto, "globalCompositeOperation", {
          get: desc.get,
          set: function(v) { try { origSet.call(this, v); } catch(e) { origSet.call(this, "source-over"); } },
          configurable: true
        });
      }
    } catch(e) {}
  } catch(e) { console.warn("UXP polyfill setup failed:", e); }
})();
`;

const bundle = polyfills + "\n" + coreBundle + "\n";
fs.writeFileSync(bundleDest, bundle);
console.log("Assembled scope bundle →", bundleDest);
console.log("Copied core HTML →", coreHtmlDest);
console.log("Photoshop plugin build complete.");
