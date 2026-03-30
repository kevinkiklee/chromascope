-- plugins/lightroom/chromascope.lrdevplugin/Info.lua  (Chromascope)
return {
  LrSdkVersion       = 15.0,
  LrSdkMinimumVersion = 15.0,

  LrToolkitIdentifier = "com.chromascope.lightroom",
  LrPluginName        = LOC "$$$/Chromascope/PluginName=Chromascope",
  LrPluginInfoUrl     = "https://chromascope.dev",

  LrExportMenuItems = {
    {
      title   = LOC "$$$/Chromascope/MenuTitle=Chromascope",
      file    = "ShowChromascope.lua",
      enabledWhen = "photosAvailable",
    },
  },

  VERSION = { major = 1, minor = 0, revision = 0 },
}
