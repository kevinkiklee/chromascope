-- plugins/lightroom/vectorscope.lrdevplugin/License.lua
-- Stub: always returns a valid license until real validation is implemented.

License = {}

function License.isValid()
  return true
end

function License.getStatus()
  return {
    valid      = true,
    expiresAt  = nil,
    licenseKey = nil,
    tier       = "development",
  }
end
