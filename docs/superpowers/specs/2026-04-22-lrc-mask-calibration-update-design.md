# LrC Plugin — Detect Mask & Calibration Changes

**Date:** 2026-04-22
**Scope:** `plugins/lightroom/chromascope.lrdevplugin/ImagePipeline.lua` (primary), `ChromascopeDialog.lua` (minor)

## Problem

The vectorscope only updates when the user adjusts sliders in panels currently hashed by `ImagePipeline.hashSettings()` — Basic, HSL, Color Grading, Parametric Tone Curve. Changes made in the **Masking** module or the **Calibration** panel do not trigger a refresh. The scope stays frozen until the user touches a hashed slider, at which point it catches up to the combined state.

Two detection mechanisms exist today, and both are blind to mask and calibration changes:

1. **`LrDevelopController.addAdjustmentChangeObserver`** — empirically does not fire for mask or calibration adjustments in our plugin.
2. **Poll loop (500ms) → `hashSettings()`** — only hashes a fixed allowlist of fields. Calibration (`CameraCalibration*`) is absent; masks (`MaskGroupBasedCorrections` or equivalent) are absent.

## Goals

- Mask and calibration adjustments trigger a vectorscope refresh within the existing 500ms poll window.
- No regression for currently-working panels (Basic, HSL, Color Grading, Tone Curve, etc.).
- No new memory-growth risk in the long-lived LrC process.
- No measurable CPU overhead in the "nothing changed" poll path.

## Non-Goals

- Faster-than-500ms latency for newly-detected panels. Parity with the current poll cadence is sufficient.
- Observing `LrDevelopController` for mask-specific notifications. The SDK doesn't expose a reliable hook, and we don't need one if the poll loop covers everything.
- Refactoring unrelated parts of `ImagePipeline.lua` or `ChromascopeDialog.lua`.

## Approach

Replace the hand-maintained field list in `hashSettings()` with a recursive, deterministic fingerprint of the entire `photo:getDevelopSettings()` table. The fingerprint is a rolling djb2-style integer hash computed without building intermediate strings, so it adds no GC pressure over multi-hour editing sessions.

Two small follow-on cleanups remove a double-refresh footgun and a redundant hash call while a refresh is in flight.

### Why a rolling hash and not string concat

Building a `table.concat`-style fingerprint allocates a transient ~5–50KB string on every poll tick (every 500ms). Over a 2-hour session that's ~14,400 short-lived allocations. Lua 5.1's incremental GC handles this, but it's wasteful and measurable. The rolling hash walks the table and mixes bytes into a single integer — zero transient strings, one number of state.

djb2 is not cryptographic. Its only job here is change detection, and the failure mode of a hash collision is "one missed refresh, caught 500ms later on the next real change." Acceptable.

### Float quantization

Some LrC develop values store doubles with trailing floating-point noise (e.g. `0.9999999` where the UI shows `1`). Hashing raw doubles would cause spurious non-equality and infinite refresh loops. The fix: format numbers with `%.5g` before mixing. 5 significant figures preserve every real slider increment (the finest LrC sliders move in 0.001 steps over ranges ≤1000) while absorbing float jitter.

### Field exclusions

A small allowlist of keys is skipped because they can change without any pixel-level consequence:

- `ToolkitIdentifier`, `ProcessVersion` — identifiers, not values
- `CameraProfileDigest` — opaque profile hash that can differ between writes without visual change

This list is intentionally minimal. When in doubt, include the field — a false positive costs one extra render; a false negative is a missed update.

### Depth cap

Recursion is capped at depth 8. `MaskGroupBasedCorrections` nests ~3 levels (corrections → masks → mask-parts). Depth 8 is loose headroom; the cap exists primarily to neutralize any pathological cyclic or unbounded structure the SDK might hand us.

### Table keys

Tables with table-typed keys are not expected in `getDevelopSettings()`. If one appears, we skip it (rather than hashing `tostring(key)`, which would yield an unstable memory-address string).

## Detailed Changes

### `ImagePipeline.lua`

Replace the current `hashSettings` with:

```lua
local HASH_SKIP = {
  ToolkitIdentifier = true,
  ProcessVersion = true,
  CameraProfileDigest = true,
}

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
      if type(k) ~= "table" and not HASH_SKIP[k] then
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

Update `ImagePipeline.refresh(props)` so that, after a successful render, it stores the current hash to keep the observer path and poll path in sync:

```lua
-- after props.status = "Updated"
_lastSettingsHash = hashSettings(photo)
```

The `photo` local is already in scope at this point, so no extra lookup is needed. This removes the need for `resetChangeDetection()` in the observer callback — delete that call from `ChromascopeDialog.lua` (see below). The function itself can stay for dialog-reopen scenarios but is no longer called on every adjustment.

### `ChromascopeDialog.lua`

**Observer callback:** remove the `ImagePipeline.resetChangeDetection()` line. The refresh itself now updates the hash. Without this change, the 500ms poll that follows an observer-triggered refresh sees `_lastSettingsHash == nil` and issues a redundant second refresh.

**Poll loop:** wrap the `settingsChanged()` call in a busy check:

```lua
if not ImagePipeline.isBusy() then
  if ImagePipeline.settingsChanged() then
    ImagePipeline.refresh(props)
  else
    -- existing overlay-only check
  end
end
```

This avoids hashing while a refresh is already in-flight. Trivial but removes a useless ~5KB-walk from any tick that overlaps a render.

## Verification Before Implementation

The approach assumes `photo:getDevelopSettings()` actually contains mask data. If it doesn't, this fix addresses calibration but not masks, and we need a different mechanism for masks.

**Verification step (one-shot, removed before merge):**

1. Add a debug line in `ImagePipeline.refresh` that writes the top-level keys of `getDevelopSettings()` to `~/Library/Logs/chromascope-debug.txt` (macOS) once per dialog open.
2. Open a photo with at least one mask and a non-default calibration red-primary hue.
3. Inspect the log. Confirm both:
   - A `CameraCalibration*`-family key is present.
   - A mask-family key is present. The exact key name varies by LrC version: `MaskGroupBasedCorrections` (modern masking), `RetouchAreas`, `GradientBasedCorrections`, or `PaintBasedCorrections`.

**If masks are present** → proceed with the spec as written.

**If masks are absent** → do not merge this approach for masks. Fall back plan: use `photo:getRawMetadata("editCount")` or `lastEditTime` as a coarse change detector that covers anything LrC considers an edit, including masks. Calibration fix still stands via the hash. Write a follow-up spec for the mask fallback.

## Testing Plan

1. **Regression — Basic panel.** Drag Exposure. Scope updates within 500ms.
2. **Regression — HSL.** Drag Orange Saturation. Scope updates.
3. **Regression — Color Grading.** Drag Midtone Hue. Scope updates.
4. **New — Calibration.** Drag Red Primary Hue. Scope updates within 500ms.
5. **New — Mask add.** In Masking, add a radial mask. Scope updates.
6. **New — Mask adjust.** With a mask selected, drag its Exposure. Scope updates.
7. **No-op check.** Open dialog, don't touch anything for 60 seconds. No refreshes logged (poll loop sees equal hashes).
8. **Long-session memory.** Open dialog, drag sliders across all panels for 10 minutes. `ps`/Activity Monitor shows Lightroom RSS stable (within normal develop-module variance). Specifically: no unbounded growth attributable to Chromascope temp files or Lua state.
9. **Cross-platform.** Repeat test 8 on Windows.

## Risks

- **Unknown SDK shape** — masks may not be in `getDevelopSettings()`. Mitigated by the verification step above before we commit to the approach.
- **Future Adobe schema changes** — new nested structures would be hashed automatically (strength of the recursive approach), but any new "noisy" fields that change without visual consequence could cause spurious refreshes. Mitigation: add to `HASH_SKIP` as discovered.
- **Float-format locale** — `string.format("%.5g", n)` is locale-independent in Lua's `string` library, so comma-vs-period decimal separators don't affect the hash. No action needed.

## Out of Scope

- Observer-level mask detection.
- Reworking the two-path (observer + poll) update model.
- Adding new UI to reflect change-detection state.
