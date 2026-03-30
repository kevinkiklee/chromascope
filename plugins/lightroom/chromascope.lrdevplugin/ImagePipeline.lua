-- plugins/lightroom/chromascope.lrdevplugin/ImagePipeline.lua  (Chromascope)

local LrApplication   = import "LrApplication"
local LrTasks         = import "LrTasks"
local LrFileUtils     = import "LrFileUtils"
local LrPathUtils     = import "LrPathUtils"

ImagePipeline = {}

local _tempDir = LrPathUtils.getStandardFilePath("temp")
local _frame   = 0
local _busy    = false
local _pendingRefresh = false

-- Base scope path (no overlay) — persists between overlay swaps
local _baseScopePath = LrPathUtils.child(_tempDir, "chromascope_base.jpg")

-- Display paths alternate to force f:picture reload
local function displayPath(n)
  return LrPathUtils.child(_tempDir, string.format("chromascope_display_%d.jpg", n))
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

-- Resolve the overlay JPEG path for a given scheme and rotation.
local function overlayPath(scheme, rotation)
  return LrPathUtils.child(
    LrPathUtils.child(
      LrPathUtils.child(_PLUGIN.path, "overlays"),
      scheme
    ),
    string.format("%03d.jpg", rotation % 360)
  )
end

-- Swap the display frame and update the picture binding.
local function swapDisplay(props, sourcePath)
  local nextFrame = 1 - _frame
  local outPath = displayPath(nextFrame)

  -- Copy source to display path (or it IS the source if no overlay)
  local f_in = io.open(sourcePath, "rb")
  if not f_in then return end
  local data = f_in:read("*all")
  f_in:close()

  local f_out = io.open(outPath, "wb")
  if not f_out then return end
  f_out:write(data)
  f_out:close()

  local oldPath = displayPath(_frame)
  _frame = nextFrame
  props.imagePath = outPath

  if LrFileUtils.exists(oldPath) then
    LrFileUtils.delete(oldPath)
  end
end

-- Render placeholder (empty scope).
function ImagePipeline.ensurePlaceholder(props)
  if LrFileUtils.exists(_baseScopePath) then
    swapDisplay(props, _baseScopePath)
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
    binary(), blackRgb, _baseScopePath
  ))
  LrFileUtils.delete(blackRgb)

  swapDisplay(props, _baseScopePath)
  props.status = "Ready"
end

-- Bridge async thumbnail callback to sync task context.
local function exportThumbnail(photo, outPath)
  local done, ok, errMsg = false, false, nil
  photo:requestJpegThumbnail(256, 256, function(jpegData, reason)
    if not jpegData then
      errMsg = reason or "no data"
      done = true
      return
    end
    local f = io.open(outPath, "wb")
    if not f then errMsg = "cannot open file"; done = true; return end
    f:write(jpegData)
    f:close()
    ok = true
    done = true
  end)
  while not done do LrTasks.sleep(0.05) end
  return ok, errMsg
end

-- SLOW PATH: Full render (photo/develop changes).
-- Renders base scope, then composites overlay if active.
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

  exitCode = LrTasks.execute(string.format(
    '"%s" render --input "%s" --output "%s" --width 128 --height 128 --size 256',
    bin, rgbPath, _baseScopePath
  ))
  LrFileUtils.delete(rgbPath)
  if exitCode ~= 0 then
    props.status = string.format("Render failed (%s)", tostring(exitCode))
    _busy = false
    return
  end

  -- Apply overlay if active
  ImagePipeline.applyOverlay(props)

  props.status = "Updated"
  _busy = false

  if _pendingRefresh then
    _pendingRefresh = false
    ImagePipeline.refresh(props)
  end
end

-- FAST PATH: Composite base scope + pre-rendered overlay (~3ms).
-- Called on scheme/rotation changes without re-rendering the scope.
function ImagePipeline.applyOverlay(props)
  local scheme = props.scheme
  if not scheme or scheme == "none" then
    -- No overlay — show base scope directly
    swapDisplay(props, _baseScopePath)
    return
  end

  local rotation = math.floor((props.rotation or 0) + 0.5) % 360
  local ovPath = overlayPath(scheme, rotation)

  if not LrFileUtils.exists(ovPath) then
    swapDisplay(props, _baseScopePath)
    return
  end

  local compositePath = LrPathUtils.child(_tempDir, "chromascope_composite.jpg")
  local exitCode = LrTasks.execute(string.format(
    '"%s" composite --base "%s" --overlay "%s" --output "%s"',
    binary(), _baseScopePath, ovPath, compositePath
  ))

  if exitCode == 0 then
    swapDisplay(props, compositePath)
    LrFileUtils.delete(compositePath)
  else
    swapDisplay(props, _baseScopePath)
  end
end

return ImagePipeline
