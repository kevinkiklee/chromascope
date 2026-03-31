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
local _savedDensity      = "scatter"
local _savedColorSpace   = "ycbcr"
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
  props.density      = _savedDensity
  props.colorSpace   = _savedColorSpace
  props.scopeSize    = tostring(_savedSize)

  local stopRefresh = false
  local _settleVersion = 0

  -- Overlay changes: debounce via version counter.
  -- Only ONE settle task runs at a time — stale ones exit early.
  -- The fast task is also versioned so rapid slider ticks don't pile up.
  local _fastVersion = 0

  local function onOverlayChange()
    -- Bump both versions — any in-flight tasks will see they're stale and exit
    _settleVersion = _settleVersion + 1
    _fastVersion = _fastVersion + 1
    local fv = _fastVersion
    local sv = _settleVersion

    LrTasks.startAsyncTask(function()
      if fv ~= _fastVersion then return end  -- stale, exit immediately
      ImagePipeline.refreshOverlayFast(props)
    end)

    LrTasks.startAsyncTask(function()
      LrTasks.sleep(0.4)
      if sv ~= _settleVersion then return end  -- stale, exit immediately
      ImagePipeline.refreshOverlayFull(props)
    end)
  end

  props:addObserver("scheme", function() onOverlayChange() end)
  props:addObserver("rotation", function() onOverlayChange() end)
  props:addObserver("skinTone", function() onOverlayChange() end)
  props:addObserver("overlayColor", function() onOverlayChange() end)

  -- Density mode change: full re-render
  props:addObserver("density", function()
    _savedDensity = props.density
    _settleVersion = _settleVersion + 1
    local sv = _settleVersion
    LrTasks.startAsyncTask(function()
      if sv ~= _settleVersion then return end
      ImagePipeline.refresh(props)
    end)
  end)

  -- Color space change: full re-render (different mapping algorithm)
  props:addObserver("colorSpace", function()
    _savedColorSpace = props.colorSpace
    _settleVersion = _settleVersion + 1
    local sv = _settleVersion
    LrTasks.startAsyncTask(function()
      if sv ~= _settleVersion then return end
      ImagePipeline.refresh(props)
    end)
  end)

  -- Size change: save all state and reopen
  props:addObserver("scopeSize", function()
    local newSize = tonumber(props.scopeSize) or 500
    if newSize ~= _savedSize then
      _savedSize         = newSize
      _savedScheme       = props.scheme
      _savedRotation     = props.rotation
      _savedSkinTone     = props.skinTone
      _savedOverlayColor = props.overlayColor
      _savedDensity      = props.density
      _savedColorSpace   = props.colorSpace
      _reopening         = true
      stopRefresh        = true
      LrDialogs.stopModalWithResult(props, "reopen")
    end
  end)

  -- Initial render + smart poll loop.
  -- Every 1s, checks if develop settings changed (cheap: reads slider values).
  -- Only calls full refresh (with requestJpegThumbnail) when settings actually changed.
  -- Also re-renders overlay each cycle to pick up scheme/rotation changes.
  LrTasks.startAsyncTask(function()
    ImagePipeline.cleanup()
    ImagePipeline.ensurePlaceholder(props)
    ImagePipeline.refresh(props)
    while not stopRefresh do
      LrTasks.sleep(1)
      if not stopRefresh then
        if ImagePipeline.settingsChanged() then
          -- Settings changed — full pipeline (thumbnail + decode + render)
          ImagePipeline.refresh(props)
        else
          -- No change — cheap re-render for overlay updates only
          ImagePipeline.refreshOverlayFull(props)
        end
      end
    end
  end)

  -- Develop slider changes: full pipeline
  LrDevelopController.addAdjustmentChangeObserver(context, props, function()
    LrTasks.startAsyncTask(function()
      ImagePipeline.refresh(props)
    end)
  end)

  local picSize = _savedSize
  local labelW = 95
  local labelColor = LrColor(0.35, 0.35, 0.35)
  local rbFont = "<system/small>"

  local contents = f:column {
    bind_to_object = props,
    spacing = f:control_spacing(),
    margin_left = 10,
    margin_right = 10,
    margin_bottom = 10,
    margin_top = 2,

    -- Vectorscope
    f:picture {
      value       = bind "imagePath",
      width       = picSize,
      height      = picSize,
      frame_color = LrColor(0, 0, 0),
    },

    f:spacer { height = 6 },
    f:separator { fill_horizontal = 1 },
    f:spacer { height = 4 },

    -- Color Scheme (radio buttons, 2 rows)
    f:row {
      spacing = f:label_spacing(),
      f:static_text {
        title = "Color Scheme",
        width = labelW,
        font  = rbFont,
        text_color = labelColor,
      },
      f:column {
        spacing = 1,
        f:row {
          spacing = f:label_spacing(),
          f:radio_button { value = bind "scheme", title = "None",   checked_value = "none",   font = rbFont },
          f:radio_button { value = bind "scheme", title = "Comp.",  checked_value = "complementary", font = rbFont },
          f:radio_button { value = bind "scheme", title = "Split",  checked_value = "splitComplementary", font = rbFont },
        },
        f:row {
          spacing = f:label_spacing(),
          f:radio_button { value = bind "scheme", title = "Triadic",   checked_value = "triadic",   font = rbFont },
          f:radio_button { value = bind "scheme", title = "Tetradic",  checked_value = "tetradic",  font = rbFont },
          f:radio_button { value = bind "scheme", title = "Analogous", checked_value = "analogous", font = rbFont },
        },
      },
    },

    f:spacer { height = 2 },

    -- Overlay Color
    f:row {
      spacing = f:label_spacing(),
      f:static_text {
        title = "Overlay Color",
        width = labelW,
        font  = rbFont,
        text_color = labelColor,
      },
      f:popup_menu {
        value = bind "overlayColor",
        width = 100,
        font  = rbFont,
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

    f:spacer { height = 2 },

    -- Rotation
    f:row {
      spacing = f:label_spacing(),
      f:static_text {
        title = "Rotation",
        width = labelW,
        font  = rbFont,
        text_color = labelColor,
      },
      f:slider {
        value    = bind "rotation",
        min      = 0,
        max      = 359,
        integral = true,
        width    = 120,
      },
      f:edit_field {
        value       = bind "rotation",
        width_in_digits = 3,
        min         = 0,
        max         = 359,
        increment   = 1,
        precision   = 0,
        font        = rbFont,
      },
    },

    f:spacer { height = 6 },
    f:separator { fill_horizontal = 1 },
    f:spacer { height = 4 },

    -- Color Space
    f:row {
      spacing = f:label_spacing(),
      f:static_text {
        title = "Color Space",
        width = labelW,
        font  = rbFont,
        text_color = labelColor,
      },
      f:popup_menu {
        value = bind "colorSpace",
        width = 100,
        font  = rbFont,
        items = {
          { title = "YCbCr",    value = "ycbcr" },
          { title = "CIE LUV",  value = "cieluv" },
          { title = "HSL",      value = "hsl" },
        },
      },
    },

    f:spacer { height = 2 },

    -- Density (radio buttons in isolated view)
    f:row {
      spacing = f:label_spacing(),
      f:static_text {
        title = "Density",
        width = labelW,
        font  = rbFont,
        text_color = labelColor,
      },
      f:view {
        bind_to_object = props,
        f:row {
          spacing = f:label_spacing(),
          f:radio_button { value = bind "density", title = "Scatter", checked_value = "scatter", font = rbFont },
          f:radio_button { value = bind "density", title = "Heatmap", checked_value = "heatmap", font = rbFont },
          f:radio_button { value = bind "density", title = "Bloom",   checked_value = "bloom",   font = rbFont },
        },
      },
    },

    f:spacer { height = 2 },

    f:row {
      spacing = f:label_spacing(),
      f:static_text {
        title = "Size",
        width = labelW,
        font  = rbFont,
        text_color = labelColor,
      },
      f:popup_menu {
        value = bind "scopeSize",
        width = 120,
        font  = rbFont,
        items = {
          { title = "Small (250px)",   value = "250" },
          { title = "Medium (500px)",  value = "500" },
          { title = "Large (700px)",   value = "700" },
        },
      },
    },

    f:spacer { height = 2 },

    -- Skin color indicator
    f:row {
      spacing = f:label_spacing(),
      f:static_text {
        title = "",
        width = labelW,
        font  = rbFont,
      },
      f:checkbox {
        value = bind "skinTone",
        title = "Skin color indicator",
        font  = rbFont,
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
          _savedDensity      = props.density
          _savedColorSpace   = props.colorSpace
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
