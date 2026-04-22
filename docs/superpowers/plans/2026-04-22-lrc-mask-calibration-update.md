# LrC Mask & Calibration Change Detection — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Lightroom Classic vectorscope update when the user adjusts masks, calibration, and all other currently-undetected develop panels.

**Architecture:** Replace the fixed-field hash in `ImagePipeline.hashSettings()` with a recursive djb2 hash over the full `photo:getDevelopSettings()` table. Remove the now-unnecessary `resetChangeDetection()` function, add a post-refresh hash sync, and wrap the poll loop in a busy guard.

**Tech Stack:** Lua 5.1 (LrC sandbox), no local Lua toolchain available — syntax verified only at runtime in Lightroom. Build via `npm run build:plugins`.

**Spec:** `docs/superpowers/specs/2026-04-22-lrc-mask-calibration-update-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `plugins/lightroom/chromascope.lrdevplugin/ImagePipeline.lua` | Modify | Replace `hashSettings`, delete `resetChangeDetection`, delete dead `_lastPhotoId`, add post-refresh hash sync |
| `plugins/lightroom/chromascope.lrdevplugin/ChromascopeDialog.lua` | Modify | Remove `resetChangeDetection()` call, add busy guard in poll loop |

No new files created.

---

### Task 1: Add verification debug dump

Before implementing the hash change, verify that `photo:getDevelopSettings()` actually contains mask and calibration data. This is a gate check — if masks are absent, the approach needs a fallback (see spec).

**Files:**
- Modify: `plugins/lightroom/chromascope.lrdevplugin/ImagePipeline.lua:249-270`

- [ ] **Step 1: Add a one-shot debug dump at the top of `ImagePipeline.refresh()`**

Insert immediately after the `local photo = catalog:getTargetPhoto()` line (currently line 264), before the nil check on line 265:

```lua
  -- DEBUG: one-shot dump of getDevelopSettings keys (remove before merge)
  if not _debugDumped then
    _debugDumped = true
    local debugSettings = photo:getDevelopSettings()
    if debugSettings then
      local logPath = LrPathUtils.child(
        LrPathUtils.getStandardFilePath("home"),
        "chromascope-debug-keys.txt"
      )
      local df = io.open(logPath, "w")
      if df then
        local function dumpKeys(t, prefix, depth)
          if depth > 3 then return end
          for k, v in pairs(t) do
            df:write(prefix .. tostring(k) .. " (" .. type(v) .. ")\n")
            if type(v) == "table" then
              dumpKeys(v, prefix .. "  ", depth + 1)
            end
          end
        end
        dumpKeys(debugSettings, "", 0)
        df:close()
      end
      debugSettings = nil
    end
  end
```

Also add the flag at module level (after `local _frameIndex = 1` on line 23):

```lua
local _debugDumped = false
```

- [ ] **Step 2: Build the plugin**

Run: `npm run build:plugins`
Expected: Build succeeds. No Lua syntax errors would show here — they only appear at runtime.

- [ ] **Step 3: Test in Lightroom Classic**

1. Open Lightroom Classic, select a photo that has at least one mask and a non-default Calibration Red Primary Hue.
2. Open the Chromascope dialog (Library > Plug-in Extras > Chromascope).
3. Check `~/chromascope-debug-keys.txt`.
4. Confirm:
   - `CameraCalibrationRedHue` (or similar `CameraCalibration*` keys) are present.
   - A mask-family key is present: `MaskGroupBasedCorrections`, `CircularGradientBasedCorrections`, `GradientBasedCorrections`, `PaintBasedCorrections`, or `RetouchAreas`.
5. If masks are **absent**, stop here and consult the spec's fallback plan before proceeding.
6. If both are **present**, continue to Task 2.

- [ ] **Step 4: Commit the debug dump (temporary)**

```bash
git add plugins/lightroom/chromascope.lrdevplugin/ImagePipeline.lua
git commit -m "chore(lrc): add one-shot debug dump of getDevelopSettings keys"
```

---

### Task 2: Replace hashSettings with recursive djb2 hash

Replace the fixed-field hash with a recursive walk of the full settings table.

**Files:**
- Modify: `plugins/lightroom/chromascope.lrdevplugin/ImagePipeline.lua:62-153`

- [ ] **Step 1: Add `HASH_SKIP` table after the `VALID_DENSITY` table**

Insert after line 69 (`local VALID_DENSITY = ...`), before the blank line:

```lua

local HASH_SKIP = {
  ToolkitIdentifier = true,
  ProcessVersion = true,
  CameraProfileDigest = true,
}
```

- [ ] **Step 2: Delete `_lastPhotoId` on line 104**

Remove this line entirely:

```lua
local _lastPhotoId = nil
```

- [ ] **Step 3: Replace the `hashSettings` function (lines 106–153)**

Replace the entire function — from `local function hashSettings(photo)` through its closing `end` — with:

```lua
local function hashSettings(photo)
  local id = photo.localIdentifier or 0
  local settings = photo:getDevelopSettings()
  if not settings then return id end

  local MOD  = 2147483647
  local hash = 5381 + (id % MOD)

  local function mixStr(s)
    for i = 1, #s do
      hash = (hash * 33 + string.byte(s, i)) % MOD
    end
    hash = (hash * 33) % MOD
  end

  local function mixNum(n)
    mixStr(string.format("%.5g", n))
  end

  local function walk(t, depth)
    if depth > 8 then return end
    local keys = {}
    for k in pairs(t) do
      local kt = type(k)
      if kt ~= "table" and kt ~= "userdata" and not HASH_SKIP[k] then
        keys[#keys + 1] = k
      end
    end
    table.sort(keys, function(a, b) return tostring(a) < tostring(b) end)
    for _, k in ipairs(keys) do
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
  settings = nil
  return hash
end
```

- [ ] **Step 4: Build**

Run: `npm run build:plugins`
Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add plugins/lightroom/chromascope.lrdevplugin/ImagePipeline.lua
git commit -m "feat(lrc): replace fixed-field hash with recursive djb2 over full settings"
```

---

### Task 3: Add post-refresh hash sync in ImagePipeline.lua

After a successful render, store the current hash so the poll loop doesn't re-trigger a redundant refresh.

**Files:**
- Modify: `plugins/lightroom/chromascope.lrdevplugin/ImagePipeline.lua`

- [ ] **Step 1: Add hash sync at end of `refresh()`**

In `ImagePipeline.refresh(props)`, find these consecutive lines:

```lua
  props.imagePath = outPath
  props.status = "Updated"

  _busy = false
```

Replace with:

```lua
  props.imagePath = outPath
  props.status = "Updated"

  _lastSettingsHash = hashSettings(photo)

  _busy = false
```

The `photo` local is already defined earlier in `refresh()` (line 264: `local photo = catalog:getTargetPhoto()`), so no new lookup is needed.

- [ ] **Step 2: Build**

Run: `npm run build:plugins`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add plugins/lightroom/chromascope.lrdevplugin/ImagePipeline.lua
git commit -m "fix(lrc): sync settings hash after successful refresh"
```

---

### Task 4: Remove resetChangeDetection and add busy guard

Remove `resetChangeDetection()` — both the call site in ChromascopeDialog.lua and the function definition in ImagePipeline.lua — in one atomic commit. Also add the busy guard in the poll loop.

**Files:**
- Modify: `plugins/lightroom/chromascope.lrdevplugin/ChromascopeDialog.lua:125-174`
- Modify: `plugins/lightroom/chromascope.lrdevplugin/ImagePipeline.lua`

- [ ] **Step 1: Remove `resetChangeDetection()` call from observer callback**

In `ChromascopeDialog.lua`, in the `addAdjustmentChangeObserver` callback (around line 170), find and remove this line:

```lua
        ImagePipeline.resetChangeDetection()  -- Force hash re-check so poll loop doesn't skip
```

The surrounding code should read (after removal):

```lua
        _adjustTaskRunning = false
        ImagePipeline.refresh(props)
```

- [ ] **Step 2: Delete `resetChangeDetection()` function definition**

In `ImagePipeline.lua`, remove these lines entirely (currently around lines 170–173, line numbers will have shifted from Task 2 edits):

```lua
-- Force the next settingsChanged() call to return true.
function ImagePipeline.resetChangeDetection()
  _lastSettingsHash = nil
end
```

- [ ] **Step 3: Add busy guard in poll loop**

In `ChromascopeDialog.lua`, in the poll loop async task (around line 133), find:

```lua
        if ImagePipeline.settingsChanged() then
          ImagePipeline.refresh(props)
        else
          -- Only re-render overlay if overlay settings changed
          local oh = tostring(props.scheme) .. tostring(props.rotation) ..
            tostring(props.skinTone) .. tostring(props.overlayColor) ..
            tostring(props.density) .. tostring(props.colorSpace)
          if oh ~= lastOverlayHash then
            lastOverlayHash = oh
            ImagePipeline.refreshOverlayFull(props)
          end
        end
```

Replace with:

```lua
        if not ImagePipeline.isBusy() then
          if ImagePipeline.settingsChanged() then
            ImagePipeline.refresh(props)
          else
            -- Only re-render overlay if overlay settings changed
            local oh = tostring(props.scheme) .. tostring(props.rotation) ..
              tostring(props.skinTone) .. tostring(props.overlayColor) ..
              tostring(props.density) .. tostring(props.colorSpace)
            if oh ~= lastOverlayHash then
              lastOverlayHash = oh
              ImagePipeline.refreshOverlayFull(props)
            end
          end
        end
```

- [ ] **Step 4: Build**

Run: `npm run build:plugins`
Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add plugins/lightroom/chromascope.lrdevplugin/ImagePipeline.lua plugins/lightroom/chromascope.lrdevplugin/ChromascopeDialog.lua
git commit -m "fix(lrc): remove resetChangeDetection, add busy guard to poll loop"
```

---

### Task 5: Remove debug dump, final build, and manual test

Clean up the temporary verification code from Task 1 and run the full test plan.

**Files:**
- Modify: `plugins/lightroom/chromascope.lrdevplugin/ImagePipeline.lua`

- [ ] **Step 1: Remove the debug dump code**

Delete the `local _debugDumped = false` line added in Task 1 (near line 23).

Delete the entire debug block added in Task 1 inside `refresh()` (the `if not _debugDumped then ... end` block).

- [ ] **Step 2: Delete the debug log file**

```bash
rm -f ~/chromascope-debug-keys.txt
```

- [ ] **Step 3: Final build**

Run: `npm run build:plugins`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add plugins/lightroom/chromascope.lrdevplugin/ImagePipeline.lua
git commit -m "chore(lrc): remove verification debug dump"
```

- [ ] **Step 5: Manual test in Lightroom Classic**

Run through the full test plan from the spec:

1. **Regression — Basic panel.** Drag Exposure slider. Scope updates within ~500ms.
2. **Regression — HSL.** Drag Orange Saturation. Scope updates.
3. **Regression — Color Grading.** Drag Midtone Hue. Scope updates.
4. **New — Calibration.** Open Calibration panel, drag Red Primary Hue. Scope updates within ~500ms.
5. **New — Mask add.** In Masking, add a radial mask. Scope updates.
6. **New — Mask adjust.** With mask selected, drag its Exposure. Scope updates within ~500ms.
7. **No-op check.** Open dialog, leave untouched for 60 seconds. No visible flicker or refresh activity.
8. **Long-session memory.** Drag sliders across all panels for 10 minutes. Check Activity Monitor — Lightroom RSS should be stable (no unbounded growth from Chromascope).

If any test fails, check:
- Scope image path alternation still works (no single-path memory leak).
- Observer callback still fires for Basic/HSL (no regression from removing `resetChangeDetection`).
- Hash is deterministic across ticks (no false-positive churn).
