-- Lua unit tests for Lightroom utils.lua
-- Run: lua tests/e2e/lightroom/lua/test_utils.lua

local script_dir = arg[0]:match("(.*/)")
local plugin_dir = script_dir .. "../../../../plugins/lightroom/chromascope.lrdevplugin/"
package.path = plugin_dir .. "?.lua;" .. package.path

local utils = require("utils")

local passed = 0
local failed = 0
local total = 0

local function test(name, fn)
  total = total + 1
  local ok, err = pcall(fn)
  if ok then
    passed = passed + 1
    print("  PASS: " .. name)
  else
    failed = failed + 1
    print("  FAIL: " .. name .. " — " .. tostring(err))
  end
end

local function assertEquals(actual, expected, msg)
  if actual ~= expected then
    error((msg or "") .. " expected " .. tostring(expected) .. ", got " .. tostring(actual))
  end
end

print("=== utils.lua unit tests ===")
print()

print("hashTable:")
test("consistent output for same input", function()
  local settings = { Exposure = 1.5, Temperature = 5500 }
  local h1 = utils.hashTable(settings, 5381)
  local h2 = utils.hashTable(settings, 5381)
  assertEquals(h1, h2)
end)

test("different output for different input", function()
  local h1 = utils.hashTable({ Exposure = 1.5 }, 5381)
  local h2 = utils.hashTable({ Exposure = 2.0 }, 5381)
  assert(h1 ~= h2, "hashes should differ for different Exposure values")
end)

test("different seed produces different hash", function()
  local settings = { Exposure = 1.5 }
  local h1 = utils.hashTable(settings, 5381)
  local h2 = utils.hashTable(settings, 9999)
  assert(h1 ~= h2, "different seeds should produce different hashes")
end)

test("handles nested tables", function()
  local settings = {
    Exposure = 1.0,
    ToneCurve = { 0, 25, 128, 128, 255, 230 },
  }
  local h = utils.hashTable(settings, 5381)
  assert(type(h) == "number", "hash should be a number")
  assert(h > 0, "hash should be positive")
end)

test("handles nil settings", function()
  local h = utils.hashTable(nil, 5381)
  assertEquals(h, 5381, "nil settings should return seed")
end)

test("handles empty table", function()
  local h = utils.hashTable({}, 5381)
  assert(type(h) == "number", "hash of empty table should be a number")
end)

test("handles boolean values", function()
  local h1 = utils.hashTable({ AutoLateralCA = true }, 5381)
  local h2 = utils.hashTable({ AutoLateralCA = false }, 5381)
  assert(h1 ~= h2, "true and false should hash differently")
end)

test("handles string values", function()
  local h1 = utils.hashTable({ CameraProfile = "Adobe Standard" }, 5381)
  local h2 = utils.hashTable({ CameraProfile = "Camera Matching" }, 5381)
  assert(h1 ~= h2, "different strings should hash differently")
end)

test("skips HASH_SKIP keys", function()
  local base = { Exposure = 1.0 }
  local withSkipped = { Exposure = 1.0, ProcessVersion = "15.4", ToolkitIdentifier = "com.test" }
  local h1 = utils.hashTable(base, 5381)
  local h2 = utils.hashTable(withSkipped, 5381)
  assertEquals(h1, h2, "HASH_SKIP keys should not affect hash")
end)

test("key order does not matter", function()
  local a = {}; a.Exposure = 1.0; a.Temperature = 5500; a.Tint = 10
  local b = {}; b.Tint = 10; b.Temperature = 5500; b.Exposure = 1.0
  local h1 = utils.hashTable(a, 5381)
  local h2 = utils.hashTable(b, 5381)
  assertEquals(h1, h2, "key insertion order should not affect hash")
end)

print()
print("nextFrameIndex:")
test("alternates from 1 to 2", function()
  assertEquals(utils.nextFrameIndex(1), 2)
end)

test("alternates from 2 to 1", function()
  assertEquals(utils.nextFrameIndex(2), 1)
end)

test("cycles correctly through multiple calls", function()
  local idx = 1
  idx = utils.nextFrameIndex(idx)
  assertEquals(idx, 2)
  idx = utils.nextFrameIndex(idx)
  assertEquals(idx, 1)
  idx = utils.nextFrameIndex(idx)
  assertEquals(idx, 2)
end)

print()
print("framePath:")
test("generates correct path for index 1", function()
  local p = utils.framePath("/tmp/chromascope_", 1)
  assertEquals(p, "/tmp/chromascope_scope_0.jpg")
end)

test("generates correct path for index 2", function()
  local p = utils.framePath("/tmp/chromascope_", 2)
  assertEquals(p, "/tmp/chromascope_scope_1.jpg")
end)

print()
print(string.format("=== Results: %d/%d passed, %d failed ===", passed, total, failed))
os.exit(failed > 0 and 1 or 0)
