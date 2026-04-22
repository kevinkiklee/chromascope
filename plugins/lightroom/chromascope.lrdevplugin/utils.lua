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

function M.hashTable(settings, seed)
  if not settings then return seed end

  local MOD  = 2147483647
  local hash = seed % MOD

  local function mixStr(s)
    for i = 1, #s do
      hash = (hash * 33 + string.byte(s, i)) % MOD
    end
    hash = (hash * 33) % MOD
  end

  local function mixNum(n)
    local scaled = math.floor(n * 100000 + 0.5)
    hash = (hash * 33 + (scaled % MOD)) % MOD
    hash = (hash * 33) % MOD
  end

  local function walk(t, depth)
    if depth > 8 then return end
    local keys, ki = {}, 0
    for k in pairs(t) do
      local kt = type(k)
      if kt ~= "table" and kt ~= "userdata" and not HASH_SKIP[k] then
        ki = ki + 1
        keys[ki] = k
      end
    end
    table.sort(keys, _keyLess)
    for i = 1, ki do
      local k = keys[i]
      mixStr(tostring(k))
      local v  = t[k]
      local tv = type(v)
      if     tv == "table"   then mixStr("{"); walk(v, depth + 1); mixStr("}")
      elseif tv == "number"  then mixNum(v)
      elseif tv == "string"  then mixStr(v)
      elseif tv == "boolean" then mixStr(v and "t" or "f")
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
