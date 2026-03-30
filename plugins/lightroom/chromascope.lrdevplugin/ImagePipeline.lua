-- plugins/lightroom/chromascope.lrdevplugin/ImagePipeline.lua  (Chromascope)

local LrApplication   = import "LrApplication"
local LrTasks         = import "LrTasks"
local LrFileUtils     = import "LrFileUtils"
local LrPathUtils     = import "LrPathUtils"

ImagePipeline = {}

local _tempDir = LrPathUtils.getStandardFilePath("temp")
local _busy    = false
local _pendingRefresh = false

-- Single fixed output path — no frame alternation
local _scopePath = LrPathUtils.child(_tempDir, "chromascope_scope.jpg")

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
  return cmd
end

function ImagePipeline.scopePath()
  return _scopePath
end

function ImagePipeline.ensurePlaceholder(props)
  if LrFileUtils.exists(_scopePath) then
    props.imagePath = _scopePath
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
    binary(), blackRgb, _scopePath
  ))
  LrFileUtils.delete(blackRgb)
  props.imagePath = _scopePath
  props.status = "Ready"
end

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

-- Full render. Overwrites the fixed scope path in place.
-- After writing, bumps the imagePath binding to force f:picture reload.
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

  -- Render with optional harmony overlay
  local fullSize = tonumber(props.scopeSize) or 500
  local renderCmd = appendOverlayFlags(string.format(
    '"%s" render --input "%s" --output "%s" --width 128 --height 128 --size %d',
    bin, rgbPath, _scopePath, fullSize
  ), props)
  exitCode = LrTasks.execute(renderCmd)
  -- Keep rgbPath for refreshOverlayOnly to re-use
  if exitCode ~= 0 then
    props.status = string.format("Render failed (%s)", tostring(exitCode))
    _busy = false
    return
  end

  -- Force f:picture to re-read by toggling the path binding
  props.imagePath = nil
  props.imagePath = _scopePath
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

  local renderCmd = appendOverlayFlags(string.format(
    '"%s" render --input "%s" --output "%s" --width 128 --height 128 --size 128',
    bin, rgbPath, _scopePath
  ), props)
  LrTasks.execute(renderCmd)

  props.imagePath = nil
  props.imagePath = _scopePath
  _busy = false
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

  local fullSize = tonumber(props.scopeSize) or 500
  local renderCmd = appendOverlayFlags(string.format(
    '"%s" render --input "%s" --output "%s" --width 128 --height 128 --size %d',
    bin, rgbPath, _scopePath, fullSize
  ), props)
  LrTasks.execute(renderCmd)

  props.imagePath = nil
  props.imagePath = _scopePath
  _busy = false
end

return ImagePipeline
