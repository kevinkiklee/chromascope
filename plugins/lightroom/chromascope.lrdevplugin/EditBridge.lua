-- plugins/lightroom/chromascope.lrdevplugin/EditBridge.lua  (ChromaScope)

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

-- Apply a single edit command from the chromascope WebView.
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
