const { entrypoints } = require("uxp");
const { imaging, core } = require("photoshop");
const { renderGraticule, renderToBuffer, applyHarmonyOverlay, invalidateGraticuleCache } = require("./src/rendering.js");

let getDocumentPixels, events, handleEditCommand;
let isRefreshing = false;
let scopeSize = 300;
let lastPixels = null;
var showSkinTone = false;

var cachedBaseBuf = null;

// Encode RGBA buffer to base64 JPEG via Photoshop Imaging API and display in <img>.
// Renders directly to RGB (3-channel) to avoid an extra RGBA→RGB copy pass.
async function displayScope(rgbaBuf, size) {
  var img = document.getElementById("scope-image");
  if (!img) return;

  try {
    // Convert RGBA → RGB in one pass
    var n = size * size;
    var rgbBuf = new Uint8Array(n * 3);
    for (var i = 0, ri = 0, si = 0; i < n; i++, ri += 3, si += 4) {
      rgbBuf[ri]   = rgbaBuf[si];
      rgbBuf[ri+1] = rgbaBuf[si+1];
      rgbBuf[ri+2] = rgbaBuf[si+2];
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
  var densityMode = "scatter";
  var harmonySettings = null;
  if (window.__chromascope) {
    var settings = window.__chromascope.getSettings();
    if (settings && settings.densityMode) densityMode = settings.densityMode;
    if (settings && settings.harmony) harmonySettings = settings.harmony;
  }

  var buf;
  if (overlayOnly && cachedBaseBuf) {
    buf = applyHarmonyOverlay(cachedBaseBuf, scopeSize, harmonySettings);
  } else {
    cachedBaseBuf = renderToBuffer(scopeSize, pixels, densityMode, showSkinTone);
    buf = applyHarmonyOverlay(cachedBaseBuf, scopeSize, harmonySettings);
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

  // 300px render buffer. The <img> CSS scales it to fill the panel.
  // 500 was visually identical but 2.8× more pixels to process and encode.
  scopeSize = 300;

  console.log("[main] scopeSize:", scopeSize);

  // Initialize core controls UI and settings bridge.
  // scope-bundle.js exposes ChromascopeCore (IIFE) with createControls.
  if (typeof ChromascopeCore !== 'undefined') {
    var _coreSettings = {
      colorSpace: "hsl",
      densityMode: "scatter",
      logScale: false,
      harmony: { scheme: null, rotation: 0, zoneWidth: 1.0, pullStrengths: [] }
    };

    var _coreControlsEl = document.getElementById("controls-container");
    if (_coreControlsEl) {
      var _controlsApi = ChromascopeCore.createControls(_coreControlsEl, _coreSettings, {
        onSettingsChange: function(partial) {
          Object.assign(_coreSettings, partial);
          if (window.__chromascope && window.__chromascope.onSettingsChanged) {
            window.__chromascope.onSettingsChanged();
          }
        }
      });

      window.__chromascope = {
        getSettings: function() { return _coreSettings; },
        updateSettings: function(partial) {
          Object.assign(_coreSettings, partial);
          _controlsApi.update(_coreSettings);
          if (this.onSettingsChanged) this.onSettingsChanged();
        },
        onSettingsChanged: null
      };
    }
  }

  await new Promise(function(resolve) { setTimeout(resolve, 300); });
  var container = document.getElementById("scope-canvas-container");
  if (container) {
    var w = container.clientWidth || container.offsetWidth;
    if (w > 50) {
      container.style.height = w + "px";
      console.log("[main] locked container height:", w);
    }
  }

  // Debounced settings listener: overlay-only re-render for fast response.
  // Full pixel re-render is only needed when density mode changes.
  if (window.__chromascope) {
    var settingsTimer = null;
    var settingsRendering = false;
    var settingsDirty = false;
    var lastDensityMode = null;
    window.__chromascope.onSettingsChanged = function() {
      if (settingsRendering) { settingsDirty = true; return; }
      if (settingsTimer) clearTimeout(settingsTimer);
      settingsTimer = setTimeout(function() {
        settingsTimer = null;
        settingsRendering = true;

        // Only re-render pixels when density mode changes; otherwise just re-apply overlay
        var settings = window.__chromascope.getSettings();
        var currentDensity = settings && settings.densityMode;
        var needFullRender = currentDensity !== lastDensityMode;
        lastDensityMode = currentDensity;

        if (needFullRender) {
          cachedBaseBuf = null; // force full re-render
        }

        renderScope(needFullRender ? lastPixels : null, !needFullRender).then(function() {
          settingsRendering = false;
          if (settingsDirty) {
            settingsDirty = false;
            window.__chromascope.onSettingsChanged();
          }
        }).catch(function(err) {
          console.error("Chromascope settings render error:", err);
          settingsRendering = false;
          if (settingsDirty) {
            settingsDirty = false;
            window.__chromascope.onSettingsChanged();
          }
        });
      }, 150); // Reduced from 300ms for snappier response
    };
  }

  // Click-to-rotate overlay
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

  // Skin tone indicator toggle — appended at the bottom of controls
  var controlsEl = document.getElementById("controls-container");
  if (controlsEl) {
    var stRow = document.createElement("div");
    stRow.className = "vs-control-row";
    stRow.style.marginTop = "2px";
    var stLabel = document.createElement("label");
    stLabel.textContent = "Skin";
    stRow.appendChild(stLabel);
    var stBtn = document.createElement("button");
    stBtn.className = "vs-btn";
    stBtn.textContent = "Skin Tone";
    stBtn.style.flex = "0 0 auto";
    stBtn.style.padding = "0 6px";
    stBtn.addEventListener("click", function() {
      showSkinTone = !showSkinTone;
      stBtn.classList.toggle("active", showSkinTone);
      cachedBaseBuf = null;
      renderScope(lastPixels, false);
    });
    stRow.appendChild(stBtn);
    controlsEl.appendChild(stRow);
  }

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
        lastPixels = null;
        cachedBaseBuf = null;
        invalidateGraticuleCache();
        isRefreshing = false;
      },
    },
  },
});
