const { entrypoints } = require("uxp");
const { imaging } = require("photoshop");
const { renderToBuffer, applyHarmonyOverlay, invalidateGraticuleCache } = require("./src/rendering.js");
var testHarness = require("./src/test-harness.js");

let getDocumentPixels, events;
let isRefreshing = false;
let scopeSize = 300;
let lastPixels = null;
var showSkinTone = false;

var cachedBaseBuf = null;

// Cleanup handles registered during init(), invoked from hide() to release
// listeners, timers, and DOM nodes so a re-show starts clean.
var cleanupFns = [];

function registerCleanup(fn) {
  cleanupFns.push(fn);
}

function runCleanup() {
  for (var i = 0; i < cleanupFns.length; i++) {
    try { cleanupFns[i](); } catch (e) { console.warn("Chromascope cleanup error:", e); }
  }
  cleanupFns = [];
}

// Encode RGBA buffer to base64 JPEG via Photoshop Imaging API and display in <img>.
// Renders directly to RGB (3-channel) to avoid an extra RGBA→RGB copy pass.
//
// Pooled RGB output buffer — reallocated only when scopeSize changes.
// Each render previously allocated ~270KB (300² × 3) of throwaway memory at
// slider-drag frequency; pooling drops that to a single fixed allocation.
var _displayRgbBuf = null;
var _displayRgbBufN = 0;

async function displayScope(rgbaBuf, size) {
  var img = document.getElementById("scope-image");
  if (!img) return;

  // Convert RGBA → RGB in one pass
  var n = size * size;
  var rgbBytes = n * 3;
  if (_displayRgbBufN !== rgbBytes) {
    _displayRgbBuf = new Uint8Array(rgbBytes);
    _displayRgbBufN = rgbBytes;
  }
  var rgbBuf = _displayRgbBuf;
  for (var i = 0, ri = 0, si = 0; i < n; i++, ri += 3, si += 4) {
    rgbBuf[ri]   = rgbaBuf[si];
    rgbBuf[ri+1] = rgbaBuf[si+1];
    rgbBuf[ri+2] = rgbaBuf[si+2];
  }

  // imageData wraps native memory and MUST be disposed even on the error path.
  // Without try/finally, a throw inside encodeImageData would leak the buffer
  // — UXP warns at 600MB cumulative, and this runs at slider-drag frequency.
  var imageData = null;
  try {
    imageData = await imaging.createImageDataFromBuffer(rgbBuf, {
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

    img.src = "data:image/jpeg;base64," + jpegData;
  } catch (e) {
    console.error("[renderScope] encode failed:", e);
  } finally {
    if (imageData) {
      try { imageData.dispose(); } catch (_e) { /* already disposed */ }
    }
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

// One-shot guard: panel `show` is unreliable in UXP (PS-57284 — fires once,
// not on every show), and we now run init from `create` instead. The guard
// keeps init idempotent if any future host fires create/show more than once.
var _initialized = false;

async function init() {
  if (_initialized) return;
  _initialized = true;

  const imagingModule = require("./src/imaging.js");
  getDocumentPixels = imagingModule.getDocumentPixels;
  events = require("./src/events.js");

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

  // Test harness: activated by setting window.__chromascopeTestMode = true before init
  if (window.__chromascopeTestMode) {
    testHarness.activate(
      renderScope,
      function () { return window.__chromascope ? window.__chromascope.getSettings() : null; },
      function (s) { if (window.__chromascope) window.__chromascope.updateSettings(s); },
      function () { return cachedBaseBuf; }
    );
    console.log("[test-harness] activated");
  }

  // Wait two frames so layout has settled before measuring container width.
  // rAF-based yields are faster than the old 300ms fixed delay (~32ms at 60Hz).
  await new Promise(function(resolve) {
    requestAnimationFrame(function() { requestAnimationFrame(resolve); });
  });
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
    registerCleanup(function() {
      if (settingsTimer) { clearTimeout(settingsTimer); settingsTimer = null; }
      if (window.__chromascope) window.__chromascope.onSettingsChanged = null;
    });
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
    var scopeClickHandler = function(e) {
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
    };
    scopeContainer.addEventListener("click", scopeClickHandler);
    registerCleanup(function() {
      scopeContainer.removeEventListener("click", scopeClickHandler);
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
    stBtn.type = "button";
    stBtn.className = "vs-btn";
    stBtn.textContent = "Skin Tone";
    stBtn.setAttribute("aria-pressed", "false");
    stBtn.setAttribute("aria-label", "Toggle skin tone reference line");
    stBtn.style.flex = "0 0 auto";
    stBtn.style.padding = "0 6px";
    var skinClickHandler = function() {
      showSkinTone = !showSkinTone;
      stBtn.classList.toggle("active", showSkinTone);
      stBtn.setAttribute("aria-pressed", showSkinTone ? "true" : "false");
      cachedBaseBuf = null;
      renderScope(lastPixels, false);
    };
    stBtn.addEventListener("click", skinClickHandler);
    stRow.appendChild(stBtn);
    controlsEl.appendChild(stRow);
    registerCleanup(function() {
      stBtn.removeEventListener("click", skinClickHandler);
      if (stRow.parentNode) stRow.parentNode.removeChild(stRow);
    });
  }

  await renderScope(null);
  await refresh();
  await events.startListening(refresh);
}

// Lifecycle note: `show` and `hide` are both unreliable in Photoshop UXP
// (PS-57284 — `show` fires only once per panel lifetime, `hide` never fires).
// `create` and `destroy` ARE reliable, so we wire init/teardown there.
//
// `create` is the only place to register listeners that need to outlive the
// first show. `destroy` is the only place real cleanup gets a chance to run.
//
// `create` has a 300ms host timeout, so heavy work is deferred via setTimeout
// so this callback returns immediately.
function teardown() {
  if (!_initialized) return;
  if (events) {
    events.stopListening();
    events = null;
  }
  runCleanup();
  lastPixels = null;
  cachedBaseBuf = null;
  _displayRgbBuf = null;
  _displayRgbBufN = 0;
  invalidateGraticuleCache();
  isRefreshing = false;
  showSkinTone = false;
  _initialized = false;
}

entrypoints.setup({
  panels: {
    chromascopePanel: {
      create() {
        // Defer init off the create call so the host's 300ms timeout cannot
        // bite if pixel-fetch / event-registration takes a while.
        setTimeout(function () {
          init().catch(function (err) {
            console.error("Chromascope init failed:", err);
          });
        }, 0);
      },
      destroy() {
        teardown();
      },
    },
  },
});
