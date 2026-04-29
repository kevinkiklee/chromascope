-- plugins/lightroom/chromascope.lrdevplugin/utils.lua  (Chromascope)
-- Pure-logic utilities: no LrC SDK dependencies.
-- Works both inside Lightroom Classic (via require) and with a standalone
-- Lua 5.4 interpreter for testing.

local M = {}

local HASH_SKIP = {
  ToolkitIdentifier = true,
  ProcessVersion = true,
  CameraProfileDigest = true,
}

local function _keyLess(a, b)
  local ta, tb = type(a), type(b)
  if ta ~= tb then return ta < tb end
  if ta == "number" or ta == "string" then return a < b end
  return tostring(a) < tostring(b)
end

-- Hot-path constants and locals for hashTable. Lifting `string.byte`,
-- `string.sub`, `math.floor`, etc. into upvalues avoids a global table lookup
-- on every byte/number mixed; this runs ~50–200 keys per poll, every 500ms.
local _byte  = string.byte
local _floor = math.floor
local _type  = type
local _tostring = tostring
local _pairs = pairs
local _sort  = table.sort
local HASH_MOD = 2147483647

function M.hashTable(settings, seed)
  if not settings then return seed end

  local hash = seed % HASH_MOD

  -- mixStr / mixNum are inlined into walk to avoid creating two closures
  -- per call (which would be re-created on every hashTable invocation).
  local function walk(t, depth)
    if depth > 8 then return end
    local keys, ki = {}, 0
    for k in _pairs(t) do
      local kt = _type(k)
      if kt ~= "table" and kt ~= "userdata" and not HASH_SKIP[k] then
        ki = ki + 1
        keys[ki] = k
      end
    end
    _sort(keys, _keyLess)
    for i = 1, ki do
      local k = keys[i]
      -- mixStr(tostring(k))
      local sk = _tostring(k)
      for j = 1, #sk do
        hash = (hash * 33 + _byte(sk, j)) % HASH_MOD
      end
      hash = (hash * 33) % HASH_MOD

      local v  = t[k]
      local tv = _type(v)
      if tv == "table" then
        -- mixStr("{")
        hash = (hash * 33 + 123) % HASH_MOD -- 123 = byte('{')
        hash = (hash * 33) % HASH_MOD
        walk(v, depth + 1)
        -- mixStr("}")
        hash = (hash * 33 + 125) % HASH_MOD -- 125 = byte('}')
        hash = (hash * 33) % HASH_MOD
      elseif tv == "number" then
        local scaled = _floor(v * 100000 + 0.5)
        hash = (hash * 33 + (scaled % HASH_MOD)) % HASH_MOD
        hash = (hash * 33) % HASH_MOD
      elseif tv == "string" then
        for j = 1, #v do
          hash = (hash * 33 + _byte(v, j)) % HASH_MOD
        end
        hash = (hash * 33) % HASH_MOD
      elseif tv == "boolean" then
        hash = (hash * 33 + (v and 116 or 102)) % HASH_MOD -- 't' / 'f'
        hash = (hash * 33) % HASH_MOD
      end
    end
  end

  walk(settings, 0)
  return hash
end

function M.nextFrameIndex(currentIndex)
  return (currentIndex % 2) + 1
end

function M.framePath(prefix, index)
  return prefix .. "scope_" .. (index - 1) .. ".jpg"
end

return M
