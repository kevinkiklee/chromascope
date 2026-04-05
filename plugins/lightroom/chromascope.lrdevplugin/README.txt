Chromascope for Adobe Lightroom Classic
=======================================

A chrominance vectorscope plugin for Adobe Lightroom Classic.
Plots pixel color on a circular graph with density visualizations
and harmony overlays.

Requirements
------------
- Adobe Lightroom Classic (with SDK 15.0 support)
- macOS (Apple Silicon or Intel) or Windows

Installation
------------
1. Copy the entire "chromascope.lrdevplugin" folder to a
   permanent location on your computer, for example:
   - macOS:  ~/Library/Application Support/Adobe/Lightroom/Modules/
   - Windows: %APPDATA%\Adobe\Lightroom\Modules\

2. Open Lightroom Classic.

3. Go to File > Plug-in Manager.

4. Click "Add" and navigate to the "chromascope.lrdevplugin"
   folder you copied in step 1. Select the folder itself
   (not a file inside it).

5. The plugin should show as "Installed and running" in the
   Plug-in Manager.

Usage
-----
1. Select a photo in the Library or Develop module.
2. Go to File > Plug-in Extras > Chromascope.
3. The vectorscope window opens showing the color distribution
   of the selected image.
4. As you make adjustments in the Develop module, the
   vectorscope updates automatically.

Controls:
- Density Mode: Switch between Point, Heat Map, and Cloud renders.
- Harmony Overlay: Show complementary, analogous, triadic, or
  split-complementary harmony guides.
- Skin Tone Line: Toggle the skin tone reference line (I-line).

Folder Structure
----------------
chromascope.lrdevplugin/
  bin/              Platform-specific processor binaries
    macos-arm64/    Apple Silicon binary (macOS only)
    macos-x64/      Intel binary (macOS only)
    win-x64/        Windows binary (Windows only)
  core/             Vectorscope rendering engine
  *.lua             Plugin source files

More Info
---------
https://chromascope.dev
https://github.com/kevinkiklee/chromascope
