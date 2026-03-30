# Photoshop UXP Plugin — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a dockable Photoshop panel plugin that embeds the vectorscope core WebView, reads pixel data from the active document, and sends it to the scope for real-time color analysis. Supports bidirectional highlighting and edit commands.

**Architecture:** UXP panel plugin with a WebView embedding the core package's single-file HTML build. The plugin reads downscaled pixel data via `imaging.getPixels()`, converts from RGBA to RGB, and posts it to the WebView. Event listeners on document changes trigger debounced refreshes. Edit commands from the scope are received via WebView messaging and dispatched as `batchPlay` commands. No build tooling needed — UXP loads raw JS/HTML directly.

**Tech Stack:** UXP (Photoshop plugin framework), Manifest v5, WebView, Photoshop Imaging API, batchPlay

---

## File Map

```
plugins/photoshop/
├── manifest.json                # UXP manifest v5
├── index.html                   # Panel entry point with WebView
├── icons/
│   ├── icon-light.png           # Panel icon (light theme)
│   ├── icon-dark.png            # Panel icon (dark theme)
│   └── plugin-icon.png          # Plugin icon
├── src/
│   ├── main.js                  # Panel lifecycle, init, teardown
│   ├── imaging.js               # getPixels wrapper, RGBA→RGB conversion
│   ├── bridge.js                # WebView messaging (host ↔ scope)
│   ├── events.js                # Document change listeners, debounce
│   └── edits.js                 # batchPlay command builders for HSL, Color Balance, Curves
└── core/
    └── index.html               # COPIED from packages/core/build/index.html at build time
```

---

### Task 1: Plugin Scaffold + Manifest

**Files:**
- Create: `plugins/photoshop/manifest.json`
- Create: `plugins/photoshop/index.html`

- [ ] **Step 1: Create manifest.json**

```json
{
  "manifestVersion": 5,
  "id": "com.vectorscope.photoshop",
  "name": "Vectorscope",
  "version": "1.0.0",
  "main": "index.html",
  "host": {
    "app": "PS",
    "minVersion": "23.3.0"
  },
  "entrypoints": [
    {
      "type": "panel",
      "id": "vectorscopePanel",
      "label": { "default": "Vectorscope" },
      "minimumSize": { "width": 230, "height": 300 },
      "preferredDockedSize": { "width": 320, "height": 450 },
      "preferredFloatingSize": { "width": 400, "height": 550 }
    }
  ],
  "requiredPermissions": {
    "network": { "domains": [] },
    "webview": { "allow": "yes", "domains": ["about:blank"] },
    "clipboard": "readAndWrite",
    "localFileSystem": "request"
  }
}
```

- [ ] **Step 2: Create index.html**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body {
      width: 100%; height: 100%;
      overflow: hidden;
      background: var(--uxp-host-background-color, #323232);
      font-family: "Adobe Clean", system-ui, sans-serif;
      color: var(--uxp-host-text-color, #e0e0e0);
    }
    #plugin-root {
      width: 100%; height: 100%;
      display: flex;
      flex-direction: column;
    }
    #scope-webview-container {
      flex: 1;
      min-height: 0;
      position: relative;
    }
    #scope-webview {
      width: 100%;
      height: 100%;
      border: none;
    }
    #status-bar {
      flex-shrink: 0;
      padding: 4px 8px;
      font-size: 11px;
      color: var(--uxp-host-text-color-secondary, #999);
      border-top: 1px solid var(--uxp-host-border-color, #444);
      background: var(--uxp-host-background-color, #2b2b2b);
    }
  </style>
</head>
<body>
  <div id="plugin-root">
    <div id="scope-webview-container">
      <webview id="scope-webview" src="core/index.html"></webview>
    </div>
    <div id="status-bar">Vectorscope ready</div>
  </div>
  <script src="src/main.js"></script>
</body>
</html>
```

- [ ] **Step 3: Create placeholder directories**

```bash
mkdir -p plugins/photoshop/src plugins/photoshop/icons plugins/photoshop/core
```

- [ ] **Step 4: Copy core build into plugin**

```bash
cp packages/core/build/index.html plugins/photoshop/core/index.html
```

- [ ] **Step 5: Commit**

```bash
git add plugins/photoshop/manifest.json plugins/photoshop/index.html plugins/photoshop/core/
git commit -m "feat: scaffold Photoshop UXP plugin with manifest and WebView"
```

---

### Task 2: Imaging Module (Pixel Reader)

**Files:**
- Create: `plugins/photoshop/src/imaging.js`

Wraps the Photoshop Imaging API to read downscaled pixels from the active document and convert RGBA to RGB.

- [ ] **Step 1: Create imaging.js**

```javascript
// plugins/photoshop/src/imaging.js

const { app, imaging } = require("photoshop");

/**
 * Read downscaled pixel data from the active document.
 * Returns { data: Uint8Array (RGB), width, height, colorProfile } or null if no document.
 */
async function getDocumentPixels() {
  const doc = app.activeDocument;
  if (!doc) return null;

  const targetSize = 256;

  const result = await imaging.getPixels({
    documentID: doc.id,
    targetSize: { width: targetSize, height: targetSize },
    colorSpace: "RGB",
    componentSize: 8,
  });

  try {
    const imageData = result.imageData;
    const rawData = await imageData.getData();
    const w = imageData.width;
    const h = imageData.height;
    const hasAlpha = imageData.hasAlpha;
    const profile = imageData.colorProfile || "sRGB";

    // Convert RGBA to RGB if needed
    let rgb;
    if (hasAlpha) {
      const components = 4;
      const totalPixels = w * h;
      rgb = new Uint8Array(totalPixels * 3);
      for (let i = 0; i < totalPixels; i++) {
        rgb[i * 3] = rawData[i * components];
        rgb[i * 3 + 1] = rawData[i * components + 1];
        rgb[i * 3 + 2] = rawData[i * components + 2];
      }
    } else {
      // Already RGB, just copy
      rgb = new Uint8Array(rawData);
    }

    return { data: rgb, width: w, height: h, colorProfile: profile };
  } finally {
    result.imageData.dispose();
  }
}

module.exports = { getDocumentPixels };
```

- [ ] **Step 2: Commit**

```bash
git add plugins/photoshop/src/imaging.js
git commit -m "feat: add imaging module for pixel data extraction"
```

---

### Task 3: Bridge Module (WebView Messaging)

**Files:**
- Create: `plugins/photoshop/src/bridge.js`

Handles communication between the UXP host and the WebView containing the vectorscope core.

- [ ] **Step 1: Create bridge.js**

```javascript
// plugins/photoshop/src/bridge.js

let webviewElement = null;

/**
 * Initialize the bridge with the WebView element.
 */
function init(webview) {
  webviewElement = webview;
}

/**
 * Send pixel data to the vectorscope WebView.
 */
function sendPixels(pixelResult) {
  if (!webviewElement || !pixelResult) return;

  webviewElement.postMessage({
    type: "pixels",
    data: Array.from(pixelResult.data),
    width: pixelResult.width,
    height: pixelResult.height,
    colorProfile: pixelResult.colorProfile,
  });
}

/**
 * Send settings update to the vectorscope WebView.
 */
function sendSettings(settings) {
  if (!webviewElement) return;

  webviewElement.postMessage({
    type: "settings",
    ...settings,
  });
}

/**
 * Send a highlight command to the vectorscope WebView.
 */
function sendHighlight(x, y) {
  if (!webviewElement) return;

  webviewElement.postMessage({
    type: "highlight",
    x,
    y,
  });
}

/**
 * Listen for messages from the WebView (edit commands, highlight regions).
 * Returns a cleanup function.
 */
function onScopeMessage(handler) {
  if (!webviewElement) return () => {};

  const listener = (event) => {
    const data = event.data;
    if (data && typeof data.type === "string") {
      handler(data);
    }
  };

  webviewElement.addEventListener("message", listener);
  return () => webviewElement.removeEventListener("message", listener);
}

module.exports = { init, sendPixels, sendSettings, sendHighlight, onScopeMessage };
```

- [ ] **Step 2: Commit**

```bash
git add plugins/photoshop/src/bridge.js
git commit -m "feat: add WebView bridge for host-scope messaging"
```

---

### Task 4: Events Module (Document Change Listeners)

**Files:**
- Create: `plugins/photoshop/src/events.js`

Sets up Photoshop event listeners to trigger vectorscope refreshes on document changes, with debouncing.

- [ ] **Step 1: Create events.js**

```javascript
// plugins/photoshop/src/events.js

const { action } = require("photoshop");

const DEBOUNCE_MS = 200;

let refreshCallback = null;
let debounceTimer = null;

/** Document-modifying events that should trigger a refresh */
const TRACKED_EVENTS = [
  "set", "select", "make", "delete",
  "open", "close", "save",
  "move", "transform", "crop",
  "fill", "stroke", "paint",
  "adjustments",
];

function debouncedRefresh() {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    if (refreshCallback) refreshCallback();
  }, DEBOUNCE_MS);
}

function handleEvent(eventName, descriptor) {
  debouncedRefresh();
}

/**
 * Start listening for document changes.
 * @param {Function} onRefresh - Called when the vectorscope should refresh.
 */
async function startListening(onRefresh) {
  refreshCallback = onRefresh;

  await action.addNotificationListener(TRACKED_EVENTS, handleEvent);
}

/**
 * Stop listening and clean up.
 */
async function stopListening() {
  if (debounceTimer) clearTimeout(debounceTimer);
  refreshCallback = null;

  try {
    await action.removeNotificationListener(TRACKED_EVENTS, handleEvent);
  } catch (e) {
    // Ignore errors during cleanup
  }
}

module.exports = { startListening, stopListening };
```

- [ ] **Step 2: Commit**

```bash
git add plugins/photoshop/src/events.js
git commit -m "feat: add event listeners for document change tracking"
```

---

### Task 5: Edits Module (batchPlay Commands)

**Files:**
- Create: `plugins/photoshop/src/edits.js`

Builds batchPlay command descriptors for the edit modes supported by the scope.

- [ ] **Step 1: Create edits.js**

```javascript
// plugins/photoshop/src/edits.js

const { action, core } = require("photoshop");

/**
 * Apply an HSL adjustment via batchPlay.
 * @param {Object} params - { hue, saturation, lightness } deltas
 */
async function applyHSL(params) {
  await core.executeAsModal(async () => {
    await action.batchPlay([
      {
        _obj: "make",
        _target: [{ _ref: "adjustmentLayer" }],
        using: {
          _obj: "adjustmentLayer",
          type: {
            _obj: "hueSaturation",
            adjustment: [
              {
                _obj: "hueSatAdjustmentV2",
                hue: params.hue || 0,
                saturation: params.saturation || 0,
                lightness: params.lightness || 0,
              },
            ],
          },
        },
      },
    ], { synchronousExecution: true });
  }, { commandName: "Vectorscope HSL Adjustment" });
}

/**
 * Apply a Color Balance adjustment via batchPlay.
 * @param {Object} params - { shadows, midtones, highlights } with [cyan-red, magenta-green, yellow-blue]
 */
async function applyColorBalance(params) {
  const descriptor = {
    _obj: "make",
    _target: [{ _ref: "adjustmentLayer" }],
    using: {
      _obj: "adjustmentLayer",
      type: {
        _obj: "colorBalance",
      },
    },
  };

  if (params.shadows) {
    descriptor.using.type.shadowLevels = params.shadows;
  }
  if (params.midtones) {
    descriptor.using.type.midtoneLevels = params.midtones;
  }
  if (params.highlights) {
    descriptor.using.type.highlightLevels = params.highlights;
  }

  await core.executeAsModal(async () => {
    await action.batchPlay([descriptor], { synchronousExecution: true });
  }, { commandName: "Vectorscope Color Balance" });
}

/**
 * Apply a Curves adjustment via batchPlay.
 * @param {Object} params - { channel, points } where points is [[in, out], ...]
 */
async function applyCurves(params) {
  const curvePoints = (params.points || [[0, 0], [255, 255]]).map(([input, output]) => ({
    _obj: "curvePoint",
    horizontal: input,
    vertical: output,
  }));

  await core.executeAsModal(async () => {
    await action.batchPlay([
      {
        _obj: "make",
        _target: [{ _ref: "adjustmentLayer" }],
        using: {
          _obj: "adjustmentLayer",
          type: {
            _obj: "curves",
            adjustment: [
              {
                _obj: "curvesAdjustment",
                channel: { _ref: "channel", _enum: "channel", _value: params.channel || "composite" },
                curve: curvePoints,
              },
            ],
          },
        },
      },
    ], { synchronousExecution: true });
  }, { commandName: "Vectorscope Curves Adjustment" });
}

/**
 * Dispatch an edit command from the scope.
 */
async function handleEditCommand(editMsg) {
  switch (editMsg.mode) {
    case "hsl":
      await applyHSL(editMsg.params);
      break;
    case "colorGrading":
      await applyColorBalance(editMsg.params);
      break;
    case "curves":
      await applyCurves(editMsg.params);
      break;
    case "pixels":
      // Direct pixel editing — future implementation
      console.warn("Direct pixel editing not yet implemented");
      break;
  }
}

module.exports = { applyHSL, applyColorBalance, applyCurves, handleEditCommand };
```

- [ ] **Step 2: Commit**

```bash
git add plugins/photoshop/src/edits.js
git commit -m "feat: add batchPlay edit command builders"
```

---

### Task 6: Main Module (Panel Lifecycle)

**Files:**
- Create: `plugins/photoshop/src/main.js`

The main entry point. Initializes the bridge, sets up event listeners, and handles the panel lifecycle.

- [ ] **Step 1: Create main.js**

```javascript
// plugins/photoshop/src/main.js

const bridge = require("./bridge.js");
const { getDocumentPixels } = require("./imaging.js");
const events = require("./events.js");
const { handleEditCommand } = require("./edits.js");

const statusBar = document.getElementById("status-bar");

let isRefreshing = false;

async function refresh() {
  if (isRefreshing) return;
  isRefreshing = true;

  try {
    statusBar.textContent = "Refreshing...";
    const pixels = await getDocumentPixels();

    if (pixels) {
      bridge.sendPixels(pixels);
      statusBar.textContent = `${pixels.width}×${pixels.height} · ${pixels.colorProfile}`;
    } else {
      statusBar.textContent = "No document open";
    }
  } catch (err) {
    console.error("Vectorscope refresh error:", err);
    statusBar.textContent = "Error: " + (err.message || "unknown");
  } finally {
    isRefreshing = false;
  }
}

// --- Init ---

async function init() {
  const webview = document.getElementById("scope-webview");
  bridge.init(webview);

  // Listen for edit commands from the scope
  bridge.onScopeMessage(async (msg) => {
    if (msg.type === "edit") {
      await handleEditCommand(msg);
      // Refresh after edit to show updated colors
      await refresh();
    }
  });

  // Start listening for document changes
  await events.startListening(refresh);

  // Initial refresh
  // Wait briefly for WebView to load
  setTimeout(refresh, 500);
}

// UXP panel lifecycle
const entrypoints = require("uxp").entrypoints;

entrypoints.setup({
  panels: {
    vectorscopePanel: {
      show() {
        init();
      },
      hide() {
        events.stopListening();
      },
    },
  },
});
```

- [ ] **Step 2: Commit**

```bash
git add plugins/photoshop/src/main.js
git commit -m "feat: add main panel lifecycle with auto-refresh"
```

---

### Task 7: Build Script + Turbo Integration

**Files:**
- Create: `plugins/photoshop/package.json`
- Modify: `turbo.json` (add photoshop build task)

- [ ] **Step 1: Create package.json**

```json
{
  "name": "@vectorscope/photoshop",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "build": "node scripts/build.js",
    "dev": "node scripts/build.js --watch"
  }
}
```

- [ ] **Step 2: Create build script**

```bash
mkdir -p plugins/photoshop/scripts
```

```javascript
// plugins/photoshop/scripts/build.js

const fs = require("fs");
const path = require("path");

const coreSource = path.resolve(__dirname, "../../../packages/core/build/index.html");
const coreDest = path.resolve(__dirname, "../core/index.html");

// Copy core build into plugin
if (fs.existsSync(coreSource)) {
  fs.mkdirSync(path.dirname(coreDest), { recursive: true });
  fs.copyFileSync(coreSource, coreDest);
  console.log("Copied core build → plugins/photoshop/core/index.html");
} else {
  console.error("Core build not found! Run 'turbo run build --filter=@vectorscope/core' first.");
  process.exit(1);
}

console.log("Photoshop plugin build complete.");
```

- [ ] **Step 3: Add to turbo.json**

Read `turbo.json` and add `"build"` task dependency so the photoshop build runs after core build.

In the existing `turbo.json`, the `build` task should have `"dependsOn": ["^build"]` which already handles this — the workspace dependency ensures core builds first. Just verify this is the case.

- [ ] **Step 4: Verify build**

```bash
cd /Users/iser/workspace/vectorscope/plugins/photoshop && node scripts/build.js
```

Expected: "Copied core build → plugins/photoshop/core/index.html"

- [ ] **Step 5: Commit**

```bash
git add plugins/photoshop/package.json plugins/photoshop/scripts/
git commit -m "feat: add build script to copy core into Photoshop plugin"
```

---

### Task 8: Placeholder Icons

**Files:**
- Create: `plugins/photoshop/icons/icon-light.png`
- Create: `plugins/photoshop/icons/icon-dark.png`
- Create: `plugins/photoshop/icons/plugin-icon.png`

Create minimal 1x1 placeholder PNGs so the manifest doesn't error. These get replaced with real icons later.

- [ ] **Step 1: Create placeholder icons**

Use Node.js to generate minimal valid PNG files:

```bash
cd /Users/iser/workspace/vectorscope/plugins/photoshop/icons
node -e "
const fs = require('fs');
// Minimal 1x1 white PNG (68 bytes)
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==', 'base64');
fs.writeFileSync('icon-light.png', png);
fs.writeFileSync('icon-dark.png', png);
fs.writeFileSync('plugin-icon.png', png);
console.log('Created placeholder icons');
"
```

- [ ] **Step 2: Commit**

```bash
git add plugins/photoshop/icons/
git commit -m "feat: add placeholder icons for Photoshop plugin"
```

---

### Task 9: Final Verification

**Files:** None new — verify the full plugin structure is correct.

- [ ] **Step 1: Verify file structure**

```bash
find plugins/photoshop -type f | sort
```

Expected:
```
plugins/photoshop/core/index.html
plugins/photoshop/icons/icon-dark.png
plugins/photoshop/icons/icon-light.png
plugins/photoshop/icons/plugin-icon.png
plugins/photoshop/index.html
plugins/photoshop/manifest.json
plugins/photoshop/package.json
plugins/photoshop/scripts/build.js
plugins/photoshop/src/bridge.js
plugins/photoshop/src/edits.js
plugins/photoshop/src/events.js
plugins/photoshop/src/imaging.js
plugins/photoshop/src/main.js
```

- [ ] **Step 2: Verify manifest is valid JSON**

```bash
node -e "const m = require('./plugins/photoshop/manifest.json'); console.log('Manifest OK:', m.name, m.version);"
```

- [ ] **Step 3: Run core tests to make sure nothing broke**

```bash
cd /Users/iser/workspace/vectorscope/packages/core && npx vitest run
```

Expected: all 73 tests PASS.

- [ ] **Step 4: Commit**

```bash
git commit --allow-empty -m "feat: Plan 3 complete — Photoshop UXP plugin"
```

---

## Follow-up Plans

| Plan | Status | Description |
|------|--------|-------------|
| **Plan 1** | Complete | Monorepo + core vectorscope display engine |
| **Plan 2** | Complete | Harmony overlays + grading interaction + fit-to-scheme |
| **Plan 3** | This plan | Photoshop UXP plugin |
| **Plan 4** | Next | Rust decode binary + Lightroom Classic plugin |
| **Plan 5** | Pending (parallel) | Marketing site + license server + Stripe |
| **Plan 6** | Pending | AI backend + plugin AI integration |
