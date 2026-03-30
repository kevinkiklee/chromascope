-- plugins/lightroom/chromascope.lrdevplugin/ChromascopeDialog.lua

local LrView      = import "LrView"
local LrDialogs   = import "LrDialogs"
local LrBinding   = import "LrBinding"
local LrColor     = import "LrColor"
local LrTasks     = import "LrTasks"
local LrDevelopController = import "LrDevelopController"

local ImagePipeline = require "ImagePipeline"

ChromascopeDialog = {}

function ChromascopeDialog.show(context)
  local f    = LrView.osFactory()
  local bind = LrView.bind

  local props = LrBinding.makePropertyTable(context)
  props.status    = "Starting…"
  props.imagePath = nil
  props.scheme    = "none"
  props.rotation  = 0

  local stopRefresh = false

  -- FAST PATH: overlay changes (scheme/rotation) — just composite, ~3ms
  props:addObserver("scheme", function()
    LrTasks.startAsyncTask(function()
      ImagePipeline.applyOverlay(props)
    end)
  end)

  props:addObserver("rotation", function()
    LrTasks.startAsyncTask(function()
      ImagePipeline.applyOverlay(props)
    end)
  end)

  -- SLOW PATH: initial render + develop changes — full decode + render
  LrTasks.startAsyncTask(function()
    ImagePipeline.ensurePlaceholder(props)
    ImagePipeline.refresh(props)
    while not stopRefresh do
      LrTasks.sleep(3)
      if not stopRefresh then
        ImagePipeline.refresh(props)
      end
    end
  end)

  LrDevelopController.addAdjustmentChangeObserver(context, props, function()
    LrTasks.startAsyncTask(function()
      ImagePipeline.refresh(props)
    end)
  end)

  local contents = f:column {
    bind_to_object = props,
    spacing = f:control_spacing(),

    f:picture {
      value       = bind "imagePath",
      width       = 256,
      height      = 256,
      frame_color = LrColor(0, 0, 0),
    },

    f:row {
      spacing = f:label_spacing(),
      f:static_text {
        title = "Harmony",
        width = 52,
        font  = "<system/small>",
        text_color = LrColor(0.5, 0.5, 0.5),
      },
      f:popup_menu {
        value = bind "scheme",
        width = 130,
        font  = "<system/small>",
        items = {
          { title = "None",                value = "none" },
          { title = "Complementary",       value = "complementary" },
          { title = "Split Complementary", value = "splitComplementary" },
          { title = "Triadic",             value = "triadic" },
          { title = "Tetradic",            value = "tetradic" },
          { title = "Analogous",           value = "analogous" },
        },
      },
    },

    f:row {
      spacing = f:label_spacing(),
      f:static_text {
        title = "Rotation",
        width = 52,
        font  = "<system/small>",
        text_color = LrColor(0.5, 0.5, 0.5),
      },
      f:slider {
        value = bind "rotation",
        min   = 0,
        max   = 359,
        integral = true,
        width = 120,
      },
      f:static_text {
        title = bind { key = "rotation", transform = function(v) return string.format("%d", v or 0) end },
        width = 26,
        font  = "<system/small>",
        text_color = LrColor(0.5, 0.5, 0.5),
      },
      f:static_text {
        title = "°",
        font  = "<system/small>",
        text_color = LrColor(0.5, 0.5, 0.5),
      },
    },

    f:static_text {
      title = bind "status",
      width = 256,
      truncation = "middle",
      font  = "<system/small>",
      text_color = LrColor(0.6, 0.6, 0.6),
    },
  }

  LrDialogs.presentFloatingDialog(
    _PLUGIN,
    {
      title    = "Chromascope",
      contents = contents,
      onClose  = function()
        stopRefresh = true
      end,
      resizable = false,
    }
  )
end

return ChromascopeDialog
