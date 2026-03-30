-- plugins/lightroom/chromascope.lrdevplugin/ChromascopeDialog.lua

local LrView          = import "LrView"
local LrDialogs       = import "LrDialogs"
local LrBinding       = import "LrBinding"
local LrColor         = import "LrColor"
local LrTasks         = import "LrTasks"
local LrFunctionContext = import "LrFunctionContext"
local LrDevelopController = import "LrDevelopController"

local ImagePipeline = require "ImagePipeline"

ChromascopeDialog = {}

-- Persists across dialog reopens
local _savedSize         = 500
local _savedScheme       = "none"
local _savedRotation     = 0
local _savedSkinTone     = false
local _savedOverlayColor = "yellow"
local _reopening         = false

function ChromascopeDialog.show(context)
  local f    = LrView.osFactory()
  local bind = LrView.bind

  local props = LrBinding.makePropertyTable(context)
  props.status       = "Starting…"
  props.imagePath    = nil
  props.scheme       = _savedScheme
  props.rotation     = _savedRotation
  props.skinTone     = _savedSkinTone
  props.overlayColor = _savedOverlayColor
  props.scopeSize    = tostring(_savedSize)

  local stopRefresh = false
  local _settleVersion = 0

  -- Overlay changes: fast render during interaction, full on settle
  local function onOverlayChange()
    LrTasks.startAsyncTask(function()
      ImagePipeline.refreshOverlayFast(props)
    end)
    _settleVersion = _settleVersion + 1
    local v = _settleVersion
    LrTasks.startAsyncTask(function()
      LrTasks.sleep(0.4)
      if v == _settleVersion then
        ImagePipeline.refreshOverlayFull(props)
      end
    end)
  end

  props:addObserver("scheme", function() onOverlayChange() end)
  props:addObserver("rotation", function() onOverlayChange() end)
  props:addObserver("skinTone", function() onOverlayChange() end)
  props:addObserver("overlayColor", function() onOverlayChange() end)

  -- Size change: save all state and reopen
  props:addObserver("scopeSize", function()
    local newSize = tonumber(props.scopeSize) or 500
    if newSize ~= _savedSize then
      _savedSize         = newSize
      _savedScheme       = props.scheme
      _savedRotation     = props.rotation
      _savedSkinTone     = props.skinTone
      _savedOverlayColor = props.overlayColor
      _reopening         = true
      stopRefresh        = true
      LrDialogs.stopModalWithResult(props, "reopen")
    end
  end)

  -- Initial render + polling loop
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

  -- Develop slider changes
  LrDevelopController.addAdjustmentChangeObserver(context, props, function()
    LrTasks.startAsyncTask(function()
      ImagePipeline.refresh(props)
    end)
  end)

  local picSize = _savedSize
  local labelW = 55
  local labelColor = LrColor(0.4, 0.4, 0.4)

  local contents = f:column {
    bind_to_object = props,
    spacing = 2,
    margin_left = 8,
    margin_right = 8,
    margin_bottom = 6,

    f:picture {
      value       = bind "imagePath",
      width       = picSize,
      height      = picSize,
      frame_color = LrColor(0, 0, 0),
    },

    f:spacer { height = 4 },

    -- Row 1: Harmony + Size
    f:row {
      spacing = f:label_spacing(),
      f:static_text {
        title = "Harmony",
        width = labelW,
        font  = "<system/small>",
        text_color = labelColor,
      },
      f:popup_menu {
        value = bind "scheme",
        width = 150,
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
      f:popup_menu {
        value = bind "scopeSize",
        width = 68,
        font  = "<system/small>",
        items = {
          { title = "S",  value = "250" },
          { title = "M",  value = "500" },
          { title = "L",  value = "700" },
        },
      },
    },

    -- Row 2: Rotation
    f:row {
      spacing = f:label_spacing(),
      f:static_text {
        title = "Rotation",
        width = labelW,
        font  = "<system/small>",
        text_color = labelColor,
      },
      f:slider {
        value    = bind "rotation",
        min      = 0,
        max      = 359,
        integral = true,
        width    = 160,
      },
      f:edit_field {
        value       = bind "rotation",
        width_in_digits = 3,
        min         = 0,
        max         = 359,
        increment   = 1,
        precision   = 0,
        font        = "<system/small>",
      },
    },

    -- Row 3: Options
    f:row {
      spacing = f:label_spacing(),
      f:static_text {
        title = "Options",
        width = labelW,
        font  = "<system/small>",
        text_color = labelColor,
      },
      f:checkbox {
        value = bind "skinTone",
        title = "Skin tone",
        font  = "<system/small>",
      },
      f:popup_menu {
        value = bind "overlayColor",
        width = 80,
        font  = "<system/small>",
        items = {
          { title = "Yellow",  value = "yellow" },
          { title = "Cyan",    value = "cyan" },
          { title = "Green",   value = "green" },
          { title = "Magenta", value = "magenta" },
          { title = "Orange",  value = "orange" },
          { title = "White",   value = "white" },
        },
      },
    },
  }

  LrDialogs.presentFloatingDialog(
    _PLUGIN,
    {
      title    = "Chromascope",
      contents = contents,
      onClose  = function()
        stopRefresh = true
        if not _reopening then
          _savedScheme       = props.scheme
          _savedRotation     = props.rotation
          _savedSkinTone     = props.skinTone
          _savedOverlayColor = props.overlayColor
        end
      end,
      resizable = false,
    }
  )

  if _reopening then
    _reopening = false
    LrFunctionContext.callWithContext("ChromascopeResize", function(ctx)
      ChromascopeDialog.show(ctx)
    end)
  end
end

return ChromascopeDialog
