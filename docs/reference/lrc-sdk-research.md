# Lightroom Classic SDK Research Summary

Research conducted 2026-03-29 from Adobe LrC 15.2 SDK (Build: "202602111402-ec4112e8").

---

## 1. Plugin Architecture

### Plugin Types
- `.lrdevplugin` directory containing `Info.lua` manifest + Lua scripts
- Plugin types: Export, Publish, Metadata, Web Gallery, Library Filter
- **No Develop module panel type** — cannot add panels to the Develop right panel

### Info.lua Manifest
```lua
return {
  LrSdkVersion = 15.0,
  LrSdkMinimumVersion = 6.0,
  LrToolkitIdentifier = "com.example.chromascope",
  LrPluginName = "ChromaScope",
  LrLibraryMenuItems = {{ title = "ChromaScope", file = "ShowChromaScope.lua" }},
  VERSION = { major=1, minor=0, revision=0, build=1 }
}
```

### Entry Points
- `LrLibraryMenuItems` — Menu items in Library module
- `LrExportMenuItems` — Menu items in File > Plug-in Extras
- `LrExportServiceProvider` — Full export workflow
- `LrMetadataProvider` — Custom metadata fields

---

## 2. Pixel/Image Data Access

**CRITICAL LIMITATION: No direct pixel access from Lua.**

Closest mechanisms:
- **`photo:requestJpegThumbnail(width, height, callback)`** — Async JPEG thumbnail (binary string). No built-in JPEG decoder in Lua.
- **`LrExportSession`** — Export rendered JPEG/TIFF to temp file. Requires external tool to read pixels.
- **`photo:getDevelopSettings()`** — Slider values only, not pixel data.
- **`photo:getRawMetadata(key)`** — File metadata (dimensions, path, color space).

### Workarounds for Pixel Access
1. Use `requestJpegThumbnail` + external binary to decode JPEG → compute chromascope
2. Export rendition to temp file + external binary to process
3. Use `LrShell` or `LrTasks.execute()` to invoke external tools

---

## 3. UI System (LrView)

**No canvas/drawing API. Widget-based only.**

### Available Controls
- **Layout**: `row`, `column`, `view`, `group_box`, `scrolled_view`, `tab_view`, `spacer`, `separator`
- **Input**: `edit_field`, `checkbox`, `radio_button`, `push_button`, `slider`, `popup_menu`, `combo_box`, `simple_list`, `password_field`
- **Display**: `static_text`, `picture` (static image file), `catalog_photo` (thumbnail), `color_well`
- **Data binding**: `LrView.bind()` for two-way binding to `LrObservableTable`

### ChromaScope Display Strategy
The `picture` control can display an image file:
```lua
viewFactory:picture { value = "/path/to/chromascope.png" }
```
Generate the chromascope image externally, display via `picture`, refresh on changes.

### Dialogs
- `LrDialogs.presentModalDialog(args)` — Modal dialog
- `LrDialogs.presentFloatingDialog(args)` — Modeless floating window (best for chromascope)

---

## 4. Develop Module Integration

### LrDevelopController
- **`addAdjustmentChangeObserver(context, observer, callback)`** — Fires on any develop slider change
- **`getValue(param)` / `setValue(param, value)`** — Read/write develop parameters
- **`getRange(param)`** — Get min/max for parameter
- **`revealPanel(panelID)`** — Scroll to panel
- **`getSelectedTool()` / `selectTool(tool)`** — Active tool management

### Observable Events
- `addAdjustmentChangeObserver` — develop parameter changes
- No direct "active photo changed" observer — must poll `catalog:getTargetPhoto()` via `LrTasks`

---

## 5. Key Modules

| Module | Purpose |
|--------|---------|
| `LrApplication` | App state, active catalog |
| `LrApplicationView` | Module switching, current module |
| `LrCatalog` | Photo access, collections, metadata |
| `LrPhoto` | Photo properties, thumbnails, develop settings |
| `LrDevelopController` | Develop slider control and observation |
| `LrView` | UI widget factory |
| `LrDialogs` | Modal/floating dialogs |
| `LrTasks` | Async tasks, coroutines, `execute()` for shell commands |
| `LrShell` | Launch external apps |
| `LrColor` | Simple RGBA color (no color space conversion) |
| `LrFileUtils` | File operations |
| `LrPathUtils` | Path manipulation |
| `LrLogger` | Debug logging |
| `LrFunctionContext` | Resource management, cleanup handlers |

---

## 6. Recommended Architecture for LrC ChromaScope

Given the severe limitations, the only viable approach:

1. **Floating dialog** opened from Library/Export menu item
2. **External binary** (compiled C/C++/Rust) that:
   - Receives image path or JPEG data
   - Decodes the image
   - Computes chromascope visualization
   - Renders to PNG file
3. **`picture` control** in floating dialog displays the PNG
4. **`addAdjustmentChangeObserver`** triggers re-export + re-render
5. **Polling via `LrTasks`** for active photo changes

### Key Challenges
- Latency: export → external process → render → display loop adds delay
- JPEG thumbnails may not reflect current develop settings (cached previews)
- No real-time pixel access like Photoshop UXP
- External binary adds distribution/installation complexity
