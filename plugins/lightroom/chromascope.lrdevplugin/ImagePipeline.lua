-- plugins/lightroom/chromascope.lrdevplugin/ImagePipeline.lua  (Chromascope)

local LrApplication   = import "LrApplication"
local LrTasks         = import "LrTasks"
local LrFileUtils     = import "LrFileUtils"
local LrPathUtils     = import "LrPathUtils"

ImagePipeline = {}

local _tempDir = LrPathUtils.getStandardFilePath("temp")
local _busy    = false
local _pendingRefresh = false

-- Frame alternation: two output paths to force f:picture cache eviction.
-- Writing to the same path and nil-toggling causes Lightroom to accumulate
-- cached image data without releasing, leading to unbounded memory growth.
local _framePaths = {
  LrPathUtils.child(_tempDir, "chromascope_scope_0.jpg"),
  LrPathUtils.child(_tempDir, "chromascope_scope_1.jpg"),
}
local _frameIndex = 1
local function nextScopePath()
  _frameIndex = (_frameIndex % 2) + 1
  return _framePaths[_frameIndex]
end

local function currentScopePath()
  return _framePaths[_frameIndex]
end

local function getBinary()
  local pluginDir = _PLUGIN.path
  local platform  = MAC_ENV and "macos-arm64" or "win-x64"
  if MAC_ENV then
    local handle = io.popen("uname -m")
    local arch = handle and handle:read("*l") or "x86_64"
    if handle then handle:close() end
    platform = (arch == "arm64") and "macos-arm64" or "macos-x64"
  end
  local ext = WIN_ENV and "processor.exe" or "processor"
  return LrPathUtils.child(LrPathUtils.child(LrPathUtils.child(pluginDir, "bin"), platform), ext)
end

local _binary = nil
local function binary()
  if not _binary then _binary = getBinary() end
  return _binary
end

local function appendOverlayFlags(cmd, props)
  local scheme = props.scheme
  if scheme and scheme ~= "none" then
    cmd = cmd .. string.format(
      ' --scheme %s --rotation %d',
      scheme, math.floor((props.rotation or 0) + 0.5) % 360
    )
  end
  if props.skinTone == false then
    cmd = cmd .. ' --hide-skin-tone'
  end
  local overlayColor = props.overlayColor
  if overlayColor and overlayColor ~= "" then
    cmd = cmd .. string.format(' --overlay-color %s', overlayColor)
  end
  local density = props.density
  if density and density ~= "" and density ~= "scatter" then
    cmd = cmd .. string.format(' --density %s', density)
  end
  local colorSpace = props.colorSpace
  if colorSpace and colorSpace ~= "" and colorSpace ~= "ycbcr" then
    cmd = cmd .. string.format(' --color-space %s', colorSpace)
  end
  return cmd
end

function ImagePipeline.isBusy()
  return _busy
end

function ImagePipeline.scopePath()
  return currentScopePath()
end

-- Track develop settings to avoid unnecessary requestJpegThumbnail calls.
-- getDevelopSettings() is cheap (reads stored numbers), requestJpegThumbnail is expensive (allocates JPEG).
local _lastSettingsHash = nil
local _lastPhotoId = nil

local function hashSettings(photo)
  -- Simple additive hash of key develop sliders to detect changes.
  -- Uses addition with positional weighting (not multiplication) to avoid
  -- Lua number overflow — Lua 5.1 uses doubles, and large multiplications
  -- can lose precision or wrap unpredictably.
  local id = photo.localIdentifier or 0
  local settings = photo:getDevelopSettings()
  if not settings then return tostring(id) end

  -- Sum key slider values with position weighting to avoid collisions
  local sum = id
  local vals = {
    settings.Exposure2012, settings.Contrast2012,
    settings.Highlights2012, settings.Shadows2012,
    settings.Whites2012, settings.Blacks2012,
    settings.Clarity2012, settings.Vibrance, settings.Saturation,
    settings.HueAdjustmentRed, settings.HueAdjustmentOrange,
    settings.HueAdjustmentYellow, settings.HueAdjustmentGreen,
    settings.HueAdjustmentBlue, settings.HueAdjustmentPurple,
    settings.SaturationAdjustmentRed, settings.SaturationAdjustmentOrange,
    settings.SaturationAdjustmentYellow, settings.SaturationAdjustmentGreen,
    settings.SaturationAdjustmentBlue,
    settings.LuminanceAdjustmentRed, settings.LuminanceAdjustmentOrange,
    settings.LuminanceAdjustmentYellow, settings.LuminanceAdjustmentGreen,
    settings.LuminanceAdjustmentBlue,
    settings.SplitToningHighlightHue, settings.SplitToningShadowHue,
  }
  for i, v in ipairs(vals) do
    sum = sum + (v or 0) * i
  end
  settings = nil
  return tostring(sum)
end

-- Check if develop settings changed since last render.
-- Returns true if a full refresh is needed.
function ImagePipeline.settingsChanged()
  local catalog = LrApplication.activeCatalog()
  local photo = catalog:getTargetPhoto()
  if not photo then return false end

  local hash = hashSettings(photo)
  if hash ~= _lastSettingsHash then
    _lastSettingsHash = hash
    return true
  end
  return false
end

-- Clean up stale temp files from previous sessions
function ImagePipeline.cleanup()
  local staleFiles = {
    "chromascope_scope.jpg", "chromascope_base.jpg",
    "chromascope_display_0.jpg", "chromascope_display_1.jpg",
    "chromascope_composite.jpg", "chromascope_standalone.html",
    "chromascope_latest.rgb", "chromascope_debug.log",
    "chromascope_thumb.jpg", "chromascope_thumb.jpg.rgb",
    "chromascope_black.rgb",
  }
  for _, name in ipairs(staleFiles) do
    local p = LrPathUtils.child(_tempDir, name)
    if LrFileUtils.exists(p) then LrFileUtils.delete(p) end
  end
end

function ImagePipeline.ensurePlaceholder(props)
  local path = currentScopePath()
  if LrFileUtils.exists(path) then
    props.imagePath = path
    props.status = "Ready"
    return
  end

  local blackRgb = LrPathUtils.child(_tempDir, "chromascope_black.rgb")
  local bf = io.open(blackRgb, "wb")
  if not bf then return end
  bf:write(string.rep("\0", 8 * 8 * 3))
  bf:close()

  LrTasks.execute(string.format(
    '"%s" render --input "%s" --output "%s" --width 8 --height 8 --size 256',
    binary(), blackRgb, path
  ))
  LrFileUtils.delete(blackRgb)
  props.imagePath = path
  props.status = "Ready"
end

local function exportThumbnail(photo, outPath)
  local done, ok, errMsg = false, false, nil
  -- requestJpegThumbnail fires the callback multiple times as higher-quality
  -- thumbnails become available. We only want the first one — subsequent calls
  -- after done=true would write to a closed file and retain jpegData strings.
  photo:requestJpegThumbnail(256, 256, function(jpegData, reason)
    if done then return end
    if not jpegData then
      errMsg = reason or "no data"
      done = true
      return
    end
    local f = io.open(outPath, "wb")
    if not f then errMsg = "cannot open file"; done = true; return end
    f:write(jpegData)
    f:close()
    jpegData = nil  -- Release reference to JPEG binary string for GC
    ok = true
    done = true
  end)
  -- Cooperative wait: LrTasks.sleep yields the coroutine, letting LrC process
  -- the thumbnail request. Without this, the callback would never fire.
  while not done do LrTasks.sleep(0.05) end
  return ok, errMsg
end

-- Full render. Writes to the next frame path (alternating between two files)
-- so f:picture sees a genuinely new path and releases the old image from cache.
function ImagePipeline.refresh(props)
  if _busy then
    _pendingRefresh = true
    return
  end
  _busy = true

  local catalog = LrApplication.activeCatalog()
  local photo   = catalog:getTargetPhoto()
  if not photo then
    props.status = "No photo selected"
    _busy = false
    return
  end

  local tmpThumb = LrPathUtils.child(_tempDir, "chromascope_thumb.jpg")
  local rgbPath  = LrPathUtils.child(_tempDir, "chromascope_pixels.rgb")
  local bin      = binary()

  local ok, err = exportThumbnail(photo, tmpThumb)
  if not ok then
    props.status = "Thumbnail: " .. (err or "failed")
    _busy = false
    return
  end

  local exitCode = LrTasks.execute(string.format(
    '"%s" decode --input "%s" --output "%s" --width 128 --height 128',
    bin, tmpThumb, rgbPath
  ))
  LrFileUtils.delete(tmpThumb)
  if exitCode ~= 0 then
    props.status = string.format("Decode failed (%s)", tostring(exitCode))
    _busy = false
    return
  end

  -- Render with optional harmony overlay to the NEXT frame path
  local outPath = nextScopePath()
  local fullSize = tonumber(props.scopeSize) or 500
  local renderCmd = appendOverlayFlags(string.format(
    '"%s" render --input "%s" --output "%s" --width 128 --height 128 --size %d',
    bin, rgbPath, outPath, fullSize
  ), props)
  exitCode = LrTasks.execute(renderCmd)
  -- Keep rgbPath on disk — refreshOverlayFast/Full re-use it to skip the
  -- expensive decode step when only the overlay settings changed.
  if exitCode ~= 0 then
    props.status = string.format("Render failed (%s)", tostring(exitCode))
    _busy = false
    return
  end

  -- Set f:picture to the new path — different from previous, so LrC releases old cache
  props.imagePath = outPath
  props.status = "Updated"

  _busy = false

  if _pendingRefresh then
    _pendingRefresh = false
    ImagePipeline.refresh(props)
  end
end

-- Fast overlay re-render at reduced resolution (3ms vs 178ms).
-- Re-uses last decoded RGB. Renders at 128x128 for speed — f:picture upscales.
function ImagePipeline.refreshOverlayFast(props)
  if _busy then return end
  _busy = true

  local rgbPath = LrPathUtils.child(_tempDir, "chromascope_pixels.rgb")
  local bin     = binary()

  if not LrFileUtils.exists(rgbPath) then
    _busy = false
    ImagePipeline.refresh(props)
    return
  end

  local outPath = nextScopePath()
  local renderCmd = appendOverlayFlags(string.format(
    '"%s" render --input "%s" --output "%s" --width 128 --height 128 --size 128',
    bin, rgbPath, outPath
  ), props)
  LrTasks.execute(renderCmd)

  props.imagePath = outPath
  _busy = false

  if _pendingRefresh then
    _pendingRefresh = false
    ImagePipeline.refresh(props)
  end
end

-- Full-quality overlay re-render at native resolution.
-- Called after slider stops to sharpen the image.
function ImagePipeline.refreshOverlayFull(props)
  if _busy then return end
  _busy = true

  local rgbPath = LrPathUtils.child(_tempDir, "chromascope_pixels.rgb")
  local bin     = binary()

  if not LrFileUtils.exists(rgbPath) then
    _busy = false
    return
  end

  local outPath = nextScopePath()
  local fullSize = tonumber(props.scopeSize) or 500
  local renderCmd = appendOverlayFlags(string.format(
    '"%s" render --input "%s" --output "%s" --width 128 --height 128 --size %d',
    bin, rgbPath, outPath, fullSize
  ), props)
  LrTasks.execute(renderCmd)

  props.imagePath = outPath

  _busy = false

  if _pendingRefresh then
    _pendingRefresh = false
    ImagePipeline.refresh(props)
  end
end

return ImagePipeline
