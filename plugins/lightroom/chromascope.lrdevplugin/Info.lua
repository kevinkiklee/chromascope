-- plugins/lightroom/chromascope.lrdevplugin/Info.lua  (ChromaScope)
return {
  LrSdkVersion       = 15.0,
  LrSdkMinimumVersion = 15.0,

  LrToolkitIdentifier = "com.chromascope.lightroom",
  LrPluginName        = LOC "$$$/ChromaScope/PluginName=ChromaScope",
  LrPluginInfoUrl     = "https://chromascope.dev",

  LrExportMenuItems = {
    {
      title   = LOC "$$$/ChromaScope/MenuTitle=ChromaScope",
      file    = "ShowChromaScope.lua",
      enabledWhen = "photosAvailable",
    },
  },

  VERSION = { major = 1, minor = 0, revision = 0 },
}
