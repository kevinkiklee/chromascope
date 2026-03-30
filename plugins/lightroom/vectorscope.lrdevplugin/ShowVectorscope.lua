-- plugins/lightroom/vectorscope.lrdevplugin/ShowVectorscope.lua

local LrFunctionContext = import "LrFunctionContext"
local LrBinding        = import "LrBinding"
local LrDialogs        = import "LrDialogs"
local LrTasks          = import "LrTasks"

require "VectorscopeDialog"
require "License"

LrTasks.startAsyncTask(function()
  LrFunctionContext.callWithContext("ShowVectorscope", function(context)
    -- License check (stub: always valid)
    if not License.isValid() then
      LrDialogs.message("Vectorscope", "License invalid.", "critical")
      return
    end

    -- Open the floating dialog; blocks until the dialog is closed.
    VectorscopeDialog.show(context)
  end)
end)
