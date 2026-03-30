# Rust Decode Binary + Lightroom Classic Plugin — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a statically compiled Rust binary that decodes JPEG/TIFF files to raw RGB pixel data, and a Lightroom Classic plugin that uses it to feed pixel data into the vectorscope WebView with real-time refresh on develop adjustments and bidirectional edit support via `LrDevelopController`.

**Architecture:** The Rust binary (`packages/decode/`) accepts a file path and target dimensions via CLI args, decodes and downsamples the image, then writes raw RGB bytes to an output file. The LrC plugin (`plugins/lightroom/vectorscope.lrdevplugin/`) presents a floating dialog with a WebView embedding the core scope. `ImagePipeline.lua` requests a 512×512 JPEG thumbnail from LrC, writes it to a temp file, invokes the Rust binary, reads the resulting raw RGB bytes, and posts them to the WebView. `EditBridge.lua` translates scope edit commands back to `LrDevelopController.setValue()` calls. Refresh is driven by `LrDevelopController.addAdjustmentChangeObserver` and `catalog:getTargetPhoto()` polling.

**Tech Stack:** Rust (clap, image crate, static linking), Lua (Lightroom SDK 15.0+, LrDialogs, LrDevelopController, LrTasks, LrFileUtils), WebView (LrHttp / platform WebView), shell invocation via `LrFileUtils.runAsCommand`

---

## File Map

```
packages/decode/
├── Cargo.toml
├── src/
│   └── main.rs
└── tests/
    ├── decode_test.rs
    └── fixtures/
        └── test.jpg            # Small test JPEG added at test-write time

plugins/lightroom/vectorscope.lrdevplugin/
├── Info.lua
├── ShowVectorscope.lua
├── VectorscopeDialog.lua
├── ImagePipeline.lua
├── EditBridge.lua
├── License.lua
└── bin/
    ├── macos-arm64/
    │   └── .gitkeep
    ├── macos-x64/
    │   └── .gitkeep
    └── win-x64/
        └── .gitkeep
```

---

### Task 1: Rust Binary Scaffold (Cargo.toml + main.rs)

**Files:**
- Create: `packages/decode/Cargo.toml`
- Create: `packages/decode/src/main.rs`

- [ ] **Step 1: Create Cargo.toml**

```toml
[package]
name = "decode"
version = "0.1.0"
edition = "2021"

[[bin]]
name = "decode"
path = "src/main.rs"

[dependencies]
clap = { version = "4", features = ["derive"] }
image = { version = "0.25", default-features = false, features = ["jpeg", "tiff"] }

[profile.release]
opt-level = 3
lto = true
codegen-units = 1
strip = true
```

- [ ] **Step 2: Create src/main.rs**

```rust
use clap::Parser;
use image::imageops::FilterType;
use std::fs;
use std::path::PathBuf;

/// Decode a JPEG or TIFF image and write raw RGB pixels to an output file.
#[derive(Parser, Debug)]
#[command(name = "decode", version, about)]
struct Args {
    /// Input image file path (JPEG or TIFF)
    #[arg(short, long)]
    input: PathBuf,

    /// Output file path for raw RGB bytes
    #[arg(short, long)]
    output: PathBuf,

    /// Target width in pixels
    #[arg(long, default_value_t = 256)]
    width: u32,

    /// Target height in pixels
    #[arg(long, default_value_t = 256)]
    height: u32,
}

fn main() -> anyhow::Result<()> {
    let args = Args::parse();

    // Open and decode the source image
    let img = image::open(&args.input)
        .map_err(|e| anyhow::anyhow!("Failed to open {:?}: {}", args.input, e))?;

    // Resize to target dimensions using Lanczos3 for quality
    let resized = img.resize_exact(args.width, args.height, FilterType::Lanczos3);

    // Convert to raw RGB (3 bytes per pixel, no alpha)
    let rgb = resized.to_rgb8();
    let raw: &[u8] = rgb.as_raw();

    fs::write(&args.output, raw)
        .map_err(|e| anyhow::anyhow!("Failed to write {:?}: {}", args.output, e))?;

    Ok(())
}
```

Note: add `anyhow = "1"` to `[dependencies]` in Cargo.toml when writing main.rs.

- [ ] **Step 3: Update Cargo.toml with anyhow**

```toml
[dependencies]
clap = { version = "4", features = ["derive"] }
image = { version = "0.25", default-features = false, features = ["jpeg", "tiff"] }
anyhow = "1"
```

- [ ] **Step 4: Verify it compiles**

```bash
cd packages/decode && cargo build --release
```

- [ ] **Step 5: Commit**

```bash
git add packages/decode/
git commit -m "feat: scaffold Rust decode binary with clap CLI and image crate"
```

---

### Task 2: Rust Binary Tests

**Files:**
- Create: `packages/decode/tests/decode_test.rs`
- Create: `packages/decode/tests/fixtures/test.jpg` (programmatically generated)

- [ ] **Step 1: Generate a minimal test JPEG fixture**

Add a build-time helper or generate once with a small Rust script. The simplest approach is to create the fixture from within the test itself using the `image` crate:

```rust
// packages/decode/tests/decode_test.rs

use std::path::PathBuf;
use std::process::Command;
use image::{RgbImage, Rgb};

fn fixtures_dir() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures")
}

fn binary_path() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("target/release/decode")
}

/// Generate a small solid-colour JPEG for use as a test fixture.
fn ensure_test_jpeg(path: &PathBuf) {
    if path.exists() { return; }
    std::fs::create_dir_all(path.parent().unwrap()).unwrap();
    let mut img = RgbImage::new(512, 512);
    for pixel in img.pixels_mut() {
        *pixel = Rgb([200u8, 100u8, 50u8]);
    }
    img.save(path).unwrap();
}

#[test]
fn decode_jpeg_produces_correct_byte_count() {
    let input = fixtures_dir().join("test.jpg");
    ensure_test_jpeg(&input);

    let output = fixtures_dir().join("test_out.rgb");

    let status = Command::new(binary_path())
        .args([
            "--input",  input.to_str().unwrap(),
            "--output", output.to_str().unwrap(),
            "--width",  "256",
            "--height", "256",
        ])
        .status()
        .expect("failed to run decode binary");

    assert!(status.success(), "decode binary exited with non-zero status");

    let bytes = std::fs::read(&output).expect("output file not written");
    // 256 * 256 pixels * 3 bytes (RGB)
    assert_eq!(bytes.len(), 256 * 256 * 3, "unexpected byte count");

    // Clean up
    std::fs::remove_file(&output).ok();
}

#[test]
fn decode_jpeg_performance_under_20ms() {
    let input = fixtures_dir().join("test.jpg");
    ensure_test_jpeg(&input);

    let output = fixtures_dir().join("perf_out.rgb");
    let start = std::time::Instant::now();

    let status = Command::new(binary_path())
        .args([
            "--input",  input.to_str().unwrap(),
            "--output", output.to_str().unwrap(),
            "--width",  "256",
            "--height", "256",
        ])
        .status()
        .expect("failed to run decode binary");

    let elapsed = start.elapsed();
    assert!(status.success());
    std::fs::remove_file(&output).ok();

    assert!(
        elapsed.as_millis() < 20,
        "decode took {}ms, expected <20ms",
        elapsed.as_millis()
    );
}
```

- [ ] **Step 2: Run tests (release build must exist first)**

```bash
cd packages/decode && cargo build --release && cargo test --release
```

- [ ] **Step 3: Commit**

```bash
git add packages/decode/tests/
git commit -m "test: add integration tests for Rust decode binary with performance assertion"
```

---

### Task 3: LrC Plugin Scaffold (Info.lua + ShowVectorscope.lua)

**Files:**
- Create: `plugins/lightroom/vectorscope.lrdevplugin/Info.lua`
- Create: `plugins/lightroom/vectorscope.lrdevplugin/ShowVectorscope.lua`

- [ ] **Step 1: Create Info.lua**

```lua
-- plugins/lightroom/vectorscope.lrdevplugin/Info.lua
return {
  LrSdkVersion       = 15.0,
  LrSdkMinimumVersion = 15.0,

  LrToolkitIdentifier = "com.vectorscope.lightroom",
  LrPluginName        = LOC "$$$/Vectorscope/PluginName=Vectorscope",
  LrPluginInfoUrl     = "https://vectorscope.dev",

  LrExportMenuItems = {
    {
      title   = LOC "$$$/Vectorscope/MenuTitle=Vectorscope",
      file    = "ShowVectorscope.lua",
      enabledWhen = "photosAvailable",
    },
  },

  VERSION = { major = 1, minor = 0, revision = 0 },
}
```

- [ ] **Step 2: Create ShowVectorscope.lua**

```lua
-- plugins/lightroom/vectorscope.lrdevplugin/ShowVectorscope.lua

local LrFunctionContext = import "LrFunctionContext"
local LrBinding        = import "LrBinding"
local LrDialogs        = import "LrDialogs"
local LrTasks          = import "LrTasks"

require "VectorscopeDialog"
require "License"

LrTasks.startAsyncTask(function()
  LrFunctionContext.callWithContext("ShowVectorscope", function(context)
    -- License check (stub: always valid)
    if not License.isValid() then
      LrDialogs.message("Vectorscope", "License invalid.", "critical")
      return
    end

    -- Open the floating dialog; blocks until the dialog is closed.
    VectorscopeDialog.show(context)
  end)
end)
```

- [ ] **Step 3: Create placeholder bin directories**

```bash
mkdir -p plugins/lightroom/vectorscope.lrdevplugin/bin/macos-arm64
mkdir -p plugins/lightroom/vectorscope.lrdevplugin/bin/macos-x64
mkdir -p plugins/lightroom/vectorscope.lrdevplugin/bin/win-x64
touch plugins/lightroom/vectorscope.lrdevplugin/bin/macos-arm64/.gitkeep
touch plugins/lightroom/vectorscope.lrdevplugin/bin/macos-x64/.gitkeep
touch plugins/lightroom/vectorscope.lrdevplugin/bin/win-x64/.gitkeep
```

- [ ] **Step 4: Commit**

```bash
git add plugins/lightroom/
git commit -m "feat: scaffold Lightroom Classic plugin with Info.lua and ShowVectorscope entry point"
```

---

### Task 4: VectorscopeDialog.lua

**Files:**
- Create: `plugins/lightroom/vectorscope.lrdevplugin/VectorscopeDialog.lua`

Presents a floating dialog. Initially renders a static picture control as a placeholder; the WebView integration is wired in once `ImagePipeline` is ready.

- [ ] **Step 1: Create VectorscopeDialog.lua**

```lua
-- plugins/lightroom/vectorscope.lrdevplugin/VectorscopeDialog.lua

local LrView          = import "LrView"
local LrDialogs       = import "LrDialogs"
local LrBinding       = import "LrBinding"
local LrColor         = import "LrColor"
local LrTasks         = import "LrTasks"
local LrDevelopController = import "LrDevelopController"
local LrApplication   = import "LrApplication"
local catalog         = import "LrApplication" -- replaced below

local ImagePipeline = require "ImagePipeline"
local EditBridge    = require "EditBridge"

VectorscopeDialog = {}

function VectorscopeDialog.show(context)
  local f    = LrView.osFactory()
  local bind = LrView.bind

  -- Shared state table
  local props = LrBinding.makePropertyTable(context)
  props.statusText = "Loading…"
  props.scopeImage = nil   -- LrPhoto thumbnail data (placeholder)

  -- Start the refresh loop
  local stopRefresh = false
  LrTasks.startAsyncTask(function()
    while not stopRefresh do
      ImagePipeline.refresh(props)
      LrTasks.sleep(0.5)   -- poll every 500 ms; also driven by observer
    end
  end)

  -- Register develop adjustment observer
  LrDevelopController.addAdjustmentChangeObserver(context, props, function(observedProps)
    LrTasks.startAsyncTask(function()
      ImagePipeline.refresh(props)
    end)
  end)

  -- Dialog contents
  local contents = f:column {
    spacing = f:control_spacing(),
    fill    = 1,

    -- Scope display area (WebView placeholder — picture control for now)
    f:picture {
      value  = bind "scopeImage",
      width  = 512,
      height = 512,
      frame_color = LrColor(0, 0, 0),
    },

    -- Status bar
    f:static_text {
      title      = bind "statusText",
      text_color = LrColor(0.6, 0.6, 0.6),
      font       = "<system/small>",
    },
  }

  -- Present as floating (non-modal) dialog
  local result = LrDialogs.presentFloatingDialog(
    _PLUGIN,
    {
      title    = "Vectorscope",
      contents = contents,
      onShow   = function()
        props.statusText = "Ready"
      end,
      onClose  = function()
        stopRefresh = true
      end,
      resizable = true,
    }
  )

  return result
end
```

- [ ] **Step 2: Commit**

```bash
git add plugins/lightroom/vectorscope.lrdevplugin/VectorscopeDialog.lua
git commit -m "feat: add VectorscopeDialog with floating dialog layout and refresh loop"
```

---

### Task 5: ImagePipeline.lua

**Files:**
- Create: `plugins/lightroom/vectorscope.lrdevplugin/ImagePipeline.lua`

Handles the full data pipeline: thumbnail request → temp file → Rust binary invocation → raw RGB output → post to scope.

- [ ] **Step 1: Create ImagePipeline.lua**

```lua
-- plugins/lightroom/vectorscope.lrdevplugin/ImagePipeline.lua

local LrApplication   = import "LrApplication"
local LrTasks         = import "LrTasks"
local LrFileUtils     = import "LrFileUtils"
local LrPathUtils     = import "LrPathUtils"
local LrFunctionContext = import "LrFunctionContext"

ImagePipeline = {}

-- Resolve the correct Rust binary for the current platform.
local function binaryPath()
  local pluginDir = _PLUGIN.path
  local platform  = MAC_ENV and "macos-arm64" or "win-x64"

  -- Detect x64 vs arm64 on macOS via uname
  if MAC_ENV then
    local arch = LrFileUtils.runAsCommand("uname -m"):match("%S+")
    platform = (arch == "arm64") and "macos-arm64" or "macos-x64"
  end

  local ext  = WIN_ENV and "decode.exe" or "decode"
  return LrPathUtils.child(LrPathUtils.child(LrPathUtils.child(pluginDir, "bin"), platform), ext)
end

-- Request a JPEG thumbnail from LrC, write to a temp file, and return the path.
-- Calls `callback(tempPath)` on success or `callback(nil)` on failure.
local function requestThumbnail(photo, width, height, callback)
  photo:requestJpegThumbnail(width, height, function(jpegData, reason)
    if not jpegData then
      callback(nil, reason)
      return
    end

    local tmpDir  = LrPathUtils.getStandardFilePath("temp")
    local tmpFile = LrPathUtils.child(tmpDir, "vectorscope_thumb.jpg")

    local f = io.open(tmpFile, "wb")
    if not f then
      callback(nil, "cannot open temp file")
      return
    end
    f:write(jpegData)
    f:close()

    callback(tmpFile)
  end)
end

-- Invoke the Rust decode binary and return the raw RGB byte string, or nil on error.
local function invokeDecoder(inputPath, width, height)
  local outputPath = inputPath .. ".rgb"
  local binary     = binaryPath()

  local cmd = string.format(
    '"%s" --input "%s" --output "%s" --width %d --height %d',
    binary, inputPath, outputPath, width, height
  )

  local exitCode = LrFileUtils.runAsCommand(cmd)
  if exitCode ~= 0 then
    return nil, string.format("decode binary exited with code %d", exitCode)
  end

  local f = io.open(outputPath, "rb")
  if not f then
    return nil, "output RGB file not found"
  end
  local data = f:read("*all")
  f:close()

  -- Clean up temp files
  LrFileUtils.delete(outputPath)

  return data
end

-- Main refresh function. Updates `props.scopeImage` and `props.statusText`.
function ImagePipeline.refresh(props)
  local catalog = LrApplication.activeCatalog()
  local photo   = catalog:getTargetPhoto()

  if not photo then
    props.statusText = "No photo selected"
    return
  end

  requestThumbnail(photo, 512, 512, function(tmpPath, thumbErr)
    if not tmpPath then
      props.statusText = "Thumbnail error: " .. (thumbErr or "unknown")
      return
    end

    local rgbData, decodeErr = invokeDecoder(tmpPath, 256, 256)
    LrFileUtils.delete(tmpPath)

    if not rgbData then
      props.statusText = "Decode error: " .. (decodeErr or "unknown")
      return
    end

    -- Post raw RGB data to WebView (base64-encoded for JSON transport).
    -- The WebView's message handler unpacks this and renders the scope.
    props.rgbData    = rgbData          -- raw bytes; WebView bridge encodes as needed
    props.statusText = string.format(
      "Updated — %d bytes (%dx%d RGB)",
      #rgbData, 256, 256
    )
  end)
end
```

- [ ] **Step 2: Commit**

```bash
git add plugins/lightroom/vectorscope.lrdevplugin/ImagePipeline.lua
git commit -m "feat: add ImagePipeline for thumbnail-to-decode-to-WebView data flow"
```

---

### Task 6: EditBridge.lua

**Files:**
- Create: `plugins/lightroom/vectorscope.lrdevplugin/EditBridge.lua`

Maps vectorscope edit commands (hue, saturation, luminance, color grading) to `LrDevelopController.setValue()` calls.

- [ ] **Step 1: Create EditBridge.lua**

```lua
-- plugins/lightroom/vectorscope.lrdevplugin/EditBridge.lua

local LrDevelopController = import "LrDevelopController"
local LrTasks             = import "LrTasks"

EditBridge = {}

-- HSL parameter name mapping.
-- Scope sends { type = "hsl", channel = "red"|"orange"|..., property = "hue"|"saturation"|"luminance", value = -100..100 }
local HSL_PARAM_MAP = {
  hue        = { red = "RedHue",        orange = "OrangeHue",     yellow = "YellowHue",
                 green = "GreenHue",    aqua   = "AquaHue",       blue   = "BlueHue",
                 purple = "PurpleHue",  magenta = "MagentaHue" },
  saturation = { red = "RedSaturation", orange = "OrangeSaturation", yellow = "YellowSaturation",
                 green = "GreenSaturation", aqua = "AquaSaturation",  blue = "BlueSaturation",
                 purple = "PurpleSaturation", magenta = "MagentaSaturation" },
  luminance  = { red = "RedLuminance",  orange = "OrangeLuminance",  yellow = "YellowLuminance",
                 green = "GreenLuminance", aqua = "AquaLuminance",   blue = "BlueLuminance",
                 purple = "PurpleLuminance", magenta = "MagentaLuminance" },
}

-- Color Grading parameter mapping.
-- Scope sends { type = "colorGrading", region = "shadows"|"midtones"|"highlights"|"global",
--               property = "hue"|"saturation"|"luma", value = number }
local COLOR_GRADING_MAP = {
  shadows    = { hue = "ShadowTint",       saturation = "SplitToningShadowSaturation",
                 luma = "SplitToningShadowHue" },
  midtones   = { hue = "SplitToningBalance", saturation = "SplitToningHighlightSaturation",
                 luma = "SplitToningHighlightHue" },
  highlights = { hue = "HighlightTint",    saturation = "SplitToningHighlightSaturation",
                 luma = "SplitToningHighlightHue" },
  global     = { hue = "GlobalTint",       saturation = "GlobalSaturation",
                 luma = "GlobalLuma" },
}

-- Apply a single edit command from the vectorscope WebView.
function EditBridge.applyEdit(command)
  LrTasks.startAsyncTask(function()
    if command.type == "hsl" then
      local paramGroup = HSL_PARAM_MAP[command.property]
      if not paramGroup then
        return  -- unknown property
      end
      local param = paramGroup[command.channel]
      if param then
        LrDevelopController.setValue(param, command.value)
      end

    elseif command.type == "colorGrading" then
      local regionGroup = COLOR_GRADING_MAP[command.region]
      if not regionGroup then return end
      local param = regionGroup[command.property]
      if param then
        LrDevelopController.setValue(param, command.value)
      end

    elseif command.type == "whiteBalance" then
      -- White balance: { type = "whiteBalance", property = "temperature"|"tint", value = number }
      local wbMap = { temperature = "Temperature", tint = "Tint" }
      local param = wbMap[command.property]
      if param then
        LrDevelopController.setValue(param, command.value)
      end

    else
      -- Unknown command type — silently ignore
    end
  end)
end

-- Parse a JSON-like message from the WebView and dispatch it.
-- In LrC the WebView sends messages as Lua-serialisable tables; no JSON decode needed.
function EditBridge.handleWebViewMessage(messageTable)
  if type(messageTable) ~= "table" then return end
  EditBridge.applyEdit(messageTable)
end
```

- [ ] **Step 2: Commit**

```bash
git add plugins/lightroom/vectorscope.lrdevplugin/EditBridge.lua
git commit -m "feat: add EditBridge mapping scope edits to LrDevelopController.setValue calls"
```

---

### Task 7: License.lua (Stub)

**Files:**
- Create: `plugins/lightroom/vectorscope.lrdevplugin/License.lua`

Stub that always returns valid — real license validation to be added in a later plan.

- [ ] **Step 1: Create License.lua**

```lua
-- plugins/lightroom/vectorscope.lrdevplugin/License.lua
-- Stub: always returns a valid license until real validation is implemented.

License = {}

function License.isValid()
  return true
end

function License.getStatus()
  return {
    valid      = true,
    expiresAt  = nil,
    licenseKey = nil,
    tier       = "development",
  }
end
```

- [ ] **Step 2: Commit**

```bash
git add plugins/lightroom/vectorscope.lrdevplugin/License.lua
git commit -m "feat: add License stub (always valid) for Lightroom Classic plugin"
```

---

### Task 8: Build Integration

**Files:**
- Update: `packages/decode/package.json` (create if absent)
- Update (or create): root-level `package.json` scripts if using a monorepo workspace

Adds `build` and `build:release` scripts that compile the Rust binary and copy it to the plugin's `bin/` directories.

- [ ] **Step 1: Create packages/decode/package.json**

```json
{
  "name": "@vectorscope/decode",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "build": "cargo build",
    "build:release": "cargo build --release",
    "build:all-platforms": "echo 'Cross-compilation requires cargo-cross; run manually per platform'",
    "copy:macos-arm64": "cp target/release/decode ../../plugins/lightroom/vectorscope.lrdevplugin/bin/macos-arm64/decode",
    "copy:macos-x64": "cp target/release/decode ../../plugins/lightroom/vectorscope.lrdevplugin/bin/macos-x64/decode",
    "copy:win-x64": "cp target/release/decode.exe ../../plugins/lightroom/vectorscope.lrdevplugin/bin/win-x64/decode.exe",
    "test": "cargo test --release"
  }
}
```

- [ ] **Step 2: Add decode workspace entry to root package.json**

Open the root `package.json` (confirm it exists with workspaces configured) and add `"packages/decode"` to the `workspaces` array if not already present.

- [ ] **Step 3: Add .gitignore for Rust artifacts**

Create `packages/decode/.gitignore`:

```
/target/
```

- [ ] **Step 4: Verify build + copy scripts work on macOS arm64**

```bash
cd packages/decode
npm run build:release
npm run copy:macos-arm64
ls -lh ../../plugins/lightroom/vectorscope.lrdevplugin/bin/macos-arm64/decode
```

- [ ] **Step 5: Commit**

```bash
git add packages/decode/package.json packages/decode/.gitignore
git add plugins/lightroom/vectorscope.lrdevplugin/bin/
git commit -m "feat: add build scripts for Rust decode binary and plugin bin directory structure"
```

---

### Task 9: Verification

- [ ] **Step 1: Rust binary smoke test**

```bash
# Build release binary
cd packages/decode && cargo build --release

# Run against a real JPEG
./target/release/decode \
  --input tests/fixtures/test.jpg \
  --output /tmp/out.rgb \
  --width 256 \
  --height 256

# Confirm file size: 256*256*3 = 196608 bytes
wc -c /tmp/out.rgb
# Expected: 196608 /tmp/out.rgb
```

- [ ] **Step 2: Run all Rust tests**

```bash
cd packages/decode && cargo test --release
# All tests pass, including performance assertion (<20ms)
```

- [ ] **Step 3: Validate LrC plugin loads in Lightroom Classic**

1. Open Lightroom Classic.
2. Go to **File > Plug-in Manager**.
3. Click **Add** and navigate to `plugins/lightroom/vectorscope.lrdevplugin`.
4. Confirm plugin status shows **Installed and running**.
5. Go to **File > Plug-in Extras > Vectorscope**.
6. Confirm the floating dialog opens without errors.
7. Select a photo in the Library and verify `statusText` updates in the dialog.

- [ ] **Step 4: Verify pipeline end-to-end**

1. With a photo selected in Develop, open the Vectorscope dialog.
2. Confirm `ImagePipeline.refresh` is called (check Lightroom log for errors).
3. Adjust a Develop slider (e.g., Temperature).
4. Confirm the `addAdjustmentChangeObserver` callback fires and refreshes the scope.

- [ ] **Step 5: Verify EditBridge**

1. Simulate an edit command by calling `EditBridge.applyEdit({ type = "hsl", channel = "red", property = "hue", value = 15 })` from the Lightroom Script Editor.
2. Confirm the Red Hue slider in the HSL panel moves to 15.

- [ ] **Step 6: Confirm binary is under 20ms on macOS**

```bash
cd packages/decode
time ./target/release/decode \
  --input tests/fixtures/test.jpg \
  --output /tmp/perf_out.rgb \
  --width 256 --height 256
# real wall time should be <20ms
```

- [ ] **Step 7: Final commit and tag**

```bash
git add -p   # review any remaining changes
git commit -m "feat: complete Rust decode binary and Lightroom Classic plugin (Plan 4)"
git tag v0.4.0
```
