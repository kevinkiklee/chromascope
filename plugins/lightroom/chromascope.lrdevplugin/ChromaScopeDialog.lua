-- plugins/lightroom/chromascope.lrdevplugin/ChromaScopeDialog.lua

local LrView          = import "LrView"
local LrDialogs       = import "LrDialogs"
local LrBinding       = import "LrBinding"
local LrColor         = import "LrColor"
local LrTasks         = import "LrTasks"
local LrDevelopController = import "LrDevelopController"

local ImagePipeline = require "ImagePipeline"

ChromaScopeDialog = {}

function ChromaScopeDialog.show(context)
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
      title    = "ChromaScope",
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
