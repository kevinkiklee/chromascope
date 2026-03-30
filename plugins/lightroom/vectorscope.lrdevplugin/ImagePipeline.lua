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
