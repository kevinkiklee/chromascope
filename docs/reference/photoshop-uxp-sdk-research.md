# Photoshop UXP Plugin SDK Research Summary

Research conducted 2026-03-29 from Adobe's official UXP documentation (GitHub source: AdobeDocs/uxp-photoshop).

---

## 1. Plugin Architecture

### Plugin Types

UXP supports two entry point types:

- **Panel**: Persistent UI panel docked in Photoshop's workspace. Has lifecycle methods: `create(rootNode)`, `show(rootNode, data)`, `hide(rootNode, data)`, `destroy(rootNode)`, `invokeMenu(menuId)`. Supports size constraints (`minimumSize`, `maximumSize`, `preferredDockedSize`, `preferredFloatingSize`).

- **Command**: Headless execution triggered by menu items. Lifecycle: `run()`, `cancel()`. No persistent UI.

A single plugin can declare multiple entry points of mixed types.

### Manifest v5 Structure

```json
{
  "manifestVersion": 5,
  "id": "com.example.chromascope",
  "name": "ChromaScope",
  "version": "1.0.0",
  "main": "index.html",
  "host": {
    "app": "PS",
    "minVersion": "23.3.0"
  },
  "entrypoints": [
    {
      "type": "panel",
      "id": "chromascopePanel",
      "label": { "default": "ChromaScope" },
      "minimumSize": { "width": 230, "height": 230 },
      "preferredDockedSize": { "width": 300, "height": 350 },
      "preferredFloatingSize": { "width": 400, "height": 450 },
      "icons": [
        { "width": 23, "height": 23, "path": "icons/icon-light.png", "scale": [1, 2], "theme": ["light", "lightest"] },
        { "width": 23, "height": 23, "path": "icons/icon-dark.png", "scale": [1, 2], "theme": ["dark", "darkest"] }
      ]
    }
  ],
  "icons": [
    { "width": 48, "height": 48, "path": "icons/plugin-icon.png", "scale": [1, 2], "theme": ["darkest", "dark", "medium", "light", "lightest"], "species": ["generic"] }
  ],
  "requiredPermissions": {
    "network": { "domains": [] },
    "clipboard": "readAndWrite",
    "localFileSystem": "request"
  }
}
```

### Entry Point & Loading

- `main` field in manifest points to an HTML file (e.g., `index.html`)
- JavaScript modules loaded via `window.require()` or ES imports
- Photoshop API accessed via `require('photoshop')`
- Plugins loaded/debugged through UXP Developer Tool (UDT)
- UDT supports: Load, Reload, Watch (auto-reload on file changes), Unload
- Lifecycle methods have a 300ms timeout for promise resolution

### Key Modules

| Module | Access | Purpose |
|--------|--------|---------|
| `photoshop.app` | `require('photoshop').app` | Application state, active document, color profiles |
| `photoshop.core` | `require('photoshop').core` | executeAsModal, layer tree, menu commands, events |
| `photoshop.action` | `require('photoshop').action` | batchPlay, notification listeners |
| `photoshop.imaging` | `require('photoshop').imaging` | Pixel data read/write (getPixels, putPixels) |
| `photoshop.constants` | `require('photoshop').constants` | Enumerations (BlendMode, ColorMode, etc.) |

---

## 2. Pixel/Image Data Access (Imaging API)

This is the most critical API for building a chromascope. Access via:

```javascript
const imaging = require("photoshop").imaging;
```

### Reading Pixels: `getPixels()`

```javascript
const result = await imaging.getPixels({
  documentID: doc.id,        // Optional, defaults to active document
  layerID: layer.id,         // Optional, omit for document composite
  sourceBounds: { left: 0, top: 0, right: width, bottom: height },
  targetSize: { width: 200, height: 200 },  // Downscale for performance
  colorSpace: "RGB",
  colorProfile: "sRGB IEC61966-2.1",
  componentSize: 8           // 8, 16, or 32 bits per channel
});

// result.imageData is a PhotoshopImageData object
// result.sourceBounds contains actual bounds retrieved
// result.level indicates pyramid level used
```

### PhotoshopImageData Object

Properties:
- `width`, `height`: Pixel dimensions
- `colorSpace`: "RGB", "Grayscale", or "Lab"
- `colorProfile`: Profile name string
- `hasAlpha`: Boolean
- `components`: Components per pixel (3=RGB, 4=RGBA, 1=Gray)
- `componentSize`: 8, 16, or 32
- `pixelFormat`: "RGB", "RGBA", "Grayscale", "LABAlpha"
- `isChunky`: Memory layout (true = interleaved RGBRGB, false = planar RRGGBB)

Methods:
- `getData()`: Async, returns typed array (Uint8Array for 8-bit, Uint16Array for 16-bit, Float32Array for 32-bit)
- `dispose()`: Synchronous, releases native memory immediately

### Component Value Ranges

| Bit Depth | Type | Range | Notes |
|-----------|------|-------|-------|
| 8-bit | Uint8Array | 0-255 | Standard |
| 16-bit | Uint16Array | 0-32768 | Photoshop's non-standard range (NOT 0-65535) |
| 32-bit | Float32Array | 0.0-1.0+ | HDR images may exceed 1.0 |

### Memory Layout

Default is "chunky" (interleaved): `[R0,G0,B0, R1,G1,B1, R2,G2,B2, ...]`

With alpha: `[R0,G0,B0,A0, R1,G1,B1,A1, ...]`

### Performance Optimization

- **targetSize**: Specify a smaller target size to leverage Photoshop's image pyramid cache. Higher pyramid levels are pre-computed half-resolution versions, dramatically faster for previews.
- **dispose()**: Always call when done to prevent memory leaks. UDT warns at 600MB+.
- **Avoid repeated color space conversions**: Match the document's native color space/profile.
- All pixel methods are async (may involve disk I/O for large images).

### Other Imaging Methods

- `getLayerMask()`: Retrieve mask as single-channel grayscale
- `putPixels()`: Write pixel data to a layer (requires executeAsModal)
- `putLayerMask()`: Write mask data (pixel masks only, not vector)
- `getSelection()`: Get selection as grayscale pixel data
- `putSelection()`: Write selection from pixel data
- `createImageDataFromBuffer()`: Build PhotoshopImageData from typed arrays
- `encodeImageData()`: Convert to JPEG/base64 for display in `<img>` elements

### Encoding for Display

```javascript
const jpegData = await imaging.encodeImageData({
  imageData: result.imageData,
  base64: true
});
const dataUrl = "data:image/jpeg;base64," + jpegData;
```

### Color Profile Enumeration

```javascript
const rgbProfiles = await require("photoshop").app.getColorProfiles("RGB");
const grayProfiles = await require("photoshop").app.getColorProfiles("Gray");
```

### Point Sampling

```javascript
// Quick single-pixel color sample
let color = await document.sampleColor({ x: 100, y: 100 });
// Returns SolidColor with .rgb.red, .rgb.green, .rgb.blue
```

---

## 3. UI Capabilities

### What Works

- **HTML**: Standard elements (div, span, input, button, etc.)
- **CSS**: Flexbox layout, standard properties, Spectrum CSS variables for theming
- **JavaScript**: Modern ES6+, async/await, Promises, typed arrays
- **Spectrum UXP Components**: `<sp-heading>`, `<sp-body>`, `<sp-button>`, `<sp-slider>`, etc. -- native-look Photoshop UI
- **`<img>` elements**: Can display base64-encoded JPEG via `encodeImageData()`
- **SVG**: Inline SVG for vector graphics
- **WebView**: Available with `requiredPermissions.webview.allow: "yes"` and domain whitelist

### What Does NOT Work (Critical for ChromaScope)

- **HTML5 Canvas (`<canvas>`)**: NOT SUPPORTED in UXP
- **WebGL**: NOT SUPPORTED (no browser engine)
- **CSS Float**: Not supported (use flexbox)
- **iFrames**: Not supported
- **window.location**: Cannot navigate
- **Drag and drop**: Not supported
- **jQuery**: Not supported
- **data attributes**: Not supported
- **font-face**: Not supported

### ChromaScope Rendering Strategy

Since `<canvas>` is NOT available, the chromascope visualization must use one of:

1. **SVG rendering**: Build the chromascope plot as SVG elements (circles, paths, rects). This is the most viable approach for real-time-ish updates in UXP.

2. **`<img>` with generated JPEG/PNG**: Use `imaging.createImageDataFromBuffer()` to build the plot as raw pixels in JavaScript, then `imaging.encodeImageData()` to convert to base64 JPEG, and set as `<img src>`. This is a "software renderer" approach.

3. **WebView with Canvas**: If a WebView is allowed, you could embed an HTML page with full Canvas 2D/WebGL support inside the WebView, and communicate pixel data to it. This adds complexity but enables high-performance rendering.

4. **Hybrid plugin with native rendering**: Use C++ to render the chromascope natively and pass the result back to the JS UI.

---

## 4. Document Change Observation / Events

### Action Event Notifications

```javascript
const action = require('photoshop').action;

// Listen for document-altering events
await action.addNotificationListener(
  ['open', 'close', 'save', 'select', 'set', 'make', 'delete'],
  (eventName, descriptor) => {
    console.log(`Event: ${eventName}`, descriptor);
    // Trigger chromascope refresh here
  }
);
```

Key action events for chromascope:
- `open` / `close`: Document opened/closed
- `select`: Layer selection changed
- `set`: Property changes (includes many edit operations)
- Canvas Size, Image Size, Flatten Image, Convert Mode
- Merge Layers, Merge Visible, Duplicate
- Undo, Revert, Reset

### Core Event Notifications

```javascript
const core = require('photoshop').core;

core.addNotificationListener('UI', [{ event: 'userIdle' }], (event, descriptor) => {
  // Good place to refresh chromascope after user stops editing
});
```

Core events:
- `userIdle`: Fires after user stops interacting (good for deferred refresh)
- `Panel Visibility Changed`: Know when your panel is shown/hidden
- `Activation Changed`: App focus changes
- `Display Configuration Changed`: Monitor changes

### Cleanup

```javascript
await action.removeNotificationListener(['open', 'close'], handler);
```

### Modal Event Monitoring

```javascript
// Know when modal scopes start/end (other plugins or scripts running)
await action.addNotificationListener(
  ['modalJavaScriptScopeEnter', 'modalJavaScriptScopeExit'],
  handler
);
```

---

## 5. Hybrid Plugin Capabilities (Native C++ Bridge)

### What Hybrid Plugins Are

Hybrid plugins combine JavaScript UXP code with native C++ dynamic libraries (.dylib on macOS, .dll on Windows), similar to Node.js C++ addons. The C++ code runs natively with full system access.

### Use Cases for ChromaScope

- **High-performance pixel processing**: Process millions of pixels in C++ instead of JavaScript
- **Custom rendering**: Render the chromascope visualization natively and pass image data back
- **Direct file system access**: Relaxed sandbox (no storage API required)
- **Photoshop C++ SDK access**: Use `PIUXPSuite` for advanced operations

### Architecture

C++ entry point:
```cpp
export SPErr PSDLLMain(const char* selector, SPBasicSuite* basicSuite, PIActionDescriptor descriptor);
```

### JS <-> C++ Messaging

**C++ to JS:**
```cpp
// C++ side: send message to UXP plugin
sPSUXPSuite->SendUXPMessage(pluginRef, "com.example.chromascope", descriptor);
```

```javascript
// JS side: receive message
require('photoshop').core.addSDKMessagingListener((msg) => {
  console.log(msg.pluginId, msg.content);
});
```

**JS to C++:**
```javascript
// JS side: send message to C++ plugin
require('photoshop').core.sendSDKPluginMessage("NativeComponentID", messageData);
```

```cpp
// C++ side: register listener
sPSUXPSuite->AddUXPMessageListener(pluginRef, myCallback);
```

### Build Requirements

- Download Hybrid Plugin SDK from Adobe Developer Console
- Separate build/packaging process from standard UXP plugins
- macOS: unsigned binaries require manual security approval in System Preferences
- Debugging: JS via UDT, C++ via attaching debugger to Photoshop.exe process

---

## 6. executeAsModal (Required for Document Modifications)

Any operation that modifies Photoshop state requires `executeAsModal`:

```javascript
const core = require('photoshop').core;

async function analyzeDocument() {
  await core.executeAsModal(async (executionContext) => {
    const imaging = require('photoshop').imaging;
    const doc = require('photoshop').app.activeDocument;

    const result = await imaging.getPixels({
      documentID: doc.id,
      targetSize: { width: 256, height: 256 },
      colorSpace: "RGB",
      componentSize: 8
    });

    const pixels = await result.imageData.getData();
    // Process pixels for chromascope...

    result.imageData.dispose();
  }, { commandName: "Analyze Image" });
}
```

Key points:
- Only one plugin can be in modal state at a time
- Progress bar appears after 2 seconds (customizable via `reportProgress`)
- User can cancel via Escape key
- History suspension available to group changes
- Interactive mode (PS 23.3+) allows user input during modal scope
- **Note**: `getPixels()` is read-only -- it may NOT require executeAsModal for simple reads. Test this; the docs say modal is needed for "modifications to Photoshop state."

---

## 7. Key Limitations and Constraints

### Rendering Limitations (Most Critical)
- **No HTML5 Canvas**: The biggest limitation for a chromascope. Must use SVG, generated images, or WebView workaround.
- **No WebGL**: No GPU-accelerated rendering in the plugin panel.
- **No CSS float**: Must use flexbox.

### Performance Constraints
- All pixel access is async (potential disk I/O)
- Memory warnings at 600MB+
- JavaScript is single-threaded; heavy pixel processing blocks the UI
- Must call `dispose()` on all PhotoshopImageData objects

### API Constraints
- Cannot construct PhotoshopImageData directly; must use API methods
- 16-bit images use 0-32768 range (not 0-65535)
- `encodeImageData()` only supports RGB (not Lab or Grayscale)
- Layer class has no direct pixel read methods; must use `imaging.getPixels()` with layerID
- Panel lifecycle methods have 300ms timeout

### Platform Constraints
- Photoshop v23+ required (v23.3+ for manifest v5 and interactive modal)
- Plugin communication requires explicit manifest permission
- Network access requires domain whitelist in manifest
- File system access requires permission declaration

---

## 8. Comparison: Photoshop UXP vs Lightroom Classic SDK

| Capability | Photoshop UXP | Lightroom Classic SDK |
|-----------|---------------|----------------------|
| **Language** | JavaScript (HTML/CSS/JS) | Lua |
| **Pixel Access** | Full read/write via Imaging API (`getPixels`/`putPixels`) | None -- no direct pixel access. Only rendered export via `LrExportRendition` |
| **UI Framework** | HTML/CSS/JS panels with Spectrum components | LrView declarative UI (limited widgets) |
| **Canvas/Drawing** | No `<canvas>`, but SVG and generated images work | No drawing primitives at all |
| **WebView** | Available with permissions | `LrWebViewFactory` available but limited |
| **Color Data** | Full pixel arrays, color space conversion, profiling | `LrColor` for develop settings only, not pixel data |
| **Event System** | Rich notification listeners for document/layer changes | `LrCatalog:addPropertyChangeObserver`, limited events |
| **Native Code** | Hybrid plugins (C++ bridge) | External tool filter providers (launch external executables) |
| **Develop/Edit Control** | Direct pixel manipulation, batchPlay for any PS operation | `LrDevelopController` for adjust sliders; no pixel ops |
| **Document Model** | Full DOM (Document, Layer, Channel, Path, Selection, History) | Catalog-centric (LrCatalog, LrPhoto, LrCollection) |
| **Plugin Types** | Panel, Command | Export, Publish, Metadata, Web Gallery, Filter |
| **File Access** | Sandboxed with permissions; hybrid plugins have full access | Full Lua file I/O |

### Key Advantage for ChromaScope

Photoshop UXP can directly read pixel data from the active document or any layer using `imaging.getPixels()`. This is the fundamental requirement for a chromascope -- you need access to actual pixel color values to plot them on a chrominance diagram.

Lightroom Classic SDK has **no equivalent capability**. LrC plugins cannot read pixel data from images. The closest workaround would be to export a rendered JPEG/TIFF via `LrExportRendition`, read the file bytes, and decode the image in Lua (which has no built-in image decoding). This makes a native LrC chromascope plugin essentially impractical without external tools.

---

## 9. Recommended Architecture for ChromaScope Plugin

Based on this research, the recommended approach:

### Minimum Viable Plugin (SVG-based)

1. **Panel plugin** with HTML/CSS/JS UI
2. **Imaging API** to read downscaled pixel data (`targetSize` for performance)
3. **JavaScript pixel processing** to compute chrominance distribution
4. **SVG rendering** for the chromascope plot (dynamically generated SVG elements)
5. **Event listeners** to auto-refresh on document/layer changes
6. **userIdle** core event for deferred refresh (avoid refreshing on every keystroke)

### Enhanced Plugin (WebView-based)

1. Same as above, but embed a **WebView** for the visualization
2. WebView gets full Canvas 2D API for smooth, high-performance rendering
3. Pass processed color data from main JS to WebView via messaging
4. More complex but significantly better rendering performance

### Maximum Performance (Hybrid)

1. **Hybrid plugin** with C++ native module
2. C++ handles pixel processing (color space conversion, histogram binning)
3. C++ renders chromascope to raw pixel buffer
4. Pass rendered image to JS via messaging, display as `<img>` with base64 encoding
5. Most complex to build and distribute, but best performance for large images
