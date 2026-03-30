-- plugins/lightroom/chromascope.lrdevplugin/ShowChromaScope.lua

local LrFunctionContext = import "LrFunctionContext"
local LrDialogs        = import "LrDialogs"
local LrTasks          = import "LrTasks"

require "ChromaScopeDialog"
require "License"

LrTasks.startAsyncTask(function()
  LrFunctionContext.callWithContext("ShowChromaScope", function(context)
    -- License check (stub: always valid)
    if not License.isValid() then
      LrDialogs.message("ChromaScope", "License invalid.", "critical")
      return
    end

    -- Open the floating dialog; blocks until the dialog is closed.
    ChromaScopeDialog.show(context)
  end)
end)
