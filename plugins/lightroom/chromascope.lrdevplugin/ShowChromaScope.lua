-- plugins/lightroom/chromascope.lrdevplugin/ShowChromascope.lua

local LrFunctionContext = import "LrFunctionContext"
local LrDialogs        = import "LrDialogs"
local LrTasks          = import "LrTasks"

require "ChromascopeDialog"
require "License"

LrTasks.startAsyncTask(function()
  LrFunctionContext.callWithContext("ShowChromascope", function(context)
    if not License.isValid() then
      LrDialogs.message("Chromascope", "License invalid.", "critical")
      return
    end
    ChromascopeDialog.show(context)
  end)
end)
