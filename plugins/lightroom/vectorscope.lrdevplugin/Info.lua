-- plugins/lightroom/vectorscope.lrdevplugin/Info.lua
return {
  LrSdkVersion       = 15.0,
  LrSdkMinimumVersion = 15.0,

  LrToolkitIdentifier = "com.vectorscope.lightroom",
  LrPluginName        = LOC "$$$/Vectorscope/PluginName=Vectorscope",
  LrPluginInfoUrl     = "https://vectorscope.dev",

  LrExportMenuItems = {
    {
      title   = LOC "$$$/Vectorscope/MenuTitle=Vectorscope",
      file    = "ShowVectorscope.lua",
      enabledWhen = "photosAvailable",
    },
  },

  VERSION = { major = 1, minor = 0, revision = 0 },
}
