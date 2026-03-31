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
  local ext = WIN_ENV and "decode.exe" or "decode"
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
  -- Build a simple string hash from photo ID + key develop values
  local id = photo.localIdentifier or 0
  local settings = photo:getDevelopSettings()
  if not settings then return tostring(id) end

  -- Hash the most commonly changed sliders
  local parts = {
    tostring(id),
    tostring(settings.Exposure2012 or 0),
    tostring(settings.Contrast2012 or 0),
    tostring(settings.Highlights2012 or 0),
    tostring(settings.Shadows2012 or 0),
    tostring(settings.Whites2012 or 0),
    tostring(settings.Blacks2012 or 0),
    tostring(settings.Clarity2012 or 0),
    tostring(settings.Vibrance or 0),
    tostring(settings.Saturation or 0),
    tostring(settings.HueAdjustmentRed or 0),
    tostring(settings.HueAdjustmentOrange or 0),
    tostring(settings.HueAdjustmentYellow or 0),
    tostring(settings.HueAdjustmentGreen or 0),
    tostring(settings.HueAdjustmentAqua or 0),
    tostring(settings.HueAdjustmentBlue or 0),
    tostring(settings.HueAdjustmentPurple or 0),
    tostring(settings.SaturationAdjustmentRed or 0),
    tostring(settings.SaturationAdjustmentOrange or 0),
    tostring(settings.SaturationAdjustmentYellow or 0),
    tostring(settings.SaturationAdjustmentGreen or 0),
    tostring(settings.SaturationAdjustmentBlue or 0),
    tostring(settings.LuminanceAdjustmentRed or 0),
    tostring(settings.LuminanceAdjustmentOrange or 0),
    tostring(settings.LuminanceAdjustmentYellow or 0),
    tostring(settings.LuminanceAdjustmentGreen or 0),
    tostring(settings.LuminanceAdjustmentBlue or 0),
    tostring(settings.WhiteBalance or ""),
    tostring(settings.SplitToningHighlightHue or 0),
    tostring(settings.SplitToningShadowHue or 0),
  }
  return table.concat(parts, "|")
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
  photo:requestJpegThumbnail(256, 256, function(jpegData, reason)
    if done then return end  -- Ignore subsequent callbacks (SDK may fire multiple times)
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
  -- Keep rgbPath for refreshOverlayOnly to re-use
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
