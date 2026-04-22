#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
RESULTS_DIR="$REPO_ROOT/test-results"
BASELINES_DIR="$REPO_ROOT/packages/processor/tests/baselines"

mkdir -p "$RESULTS_DIR"

# Detect platform and select processor binary
case "$(uname -s)-$(uname -m)" in
  Darwin-arm64) PROCESSOR="$REPO_ROOT/plugins/lightroom/chromascope.lrdevplugin/bin/macos-arm64/processor" ;;
  Darwin-x86_64) PROCESSOR="$REPO_ROOT/plugins/lightroom/chromascope.lrdevplugin/bin/macos-x64/processor" ;;
  *) echo "SKIP: unsupported platform $(uname -s)-$(uname -m)"; exit 0 ;;
esac

if [ ! -x "$PROCESSOR" ]; then
  echo "SKIP: processor binary not found at $PROCESSOR"
  echo "Run 'npm run build:plugins' first."
  exit 0
fi

TMPDIR=$(mktemp -d)
trap 'rm -rf "$TMPDIR"' EXIT

passed=0
failed=0
results="[]"

add_result() {
  local name="$1" status="$2" detail="${3:-}"
  results=$(echo "$results" | python3 -c "
import sys, json
r = json.load(sys.stdin)
r.append({'name': '$name', 'status': '$status', 'detail': '$detail'})
json.dump(r, sys.stdout)
")
}

# Generate test RGB input: 128x128, RGB(200, 100, 50)
python3 -c "
import sys
d = bytes([200, 100, 50] * (128 * 128))
sys.stdout.buffer.write(d)
" > "$TMPDIR/solid_warm.rgb"

CONFIGS=(
  "hsl scatter none on 0"
  "cieluv heatmap triadic off 120"
  "ycbcr bloom complementary on 0"
)

echo "=== Lightroom Pipeline Smoke Test ==="
echo

for config_str in "${CONFIGS[@]}"; do
  read -r cs density scheme skin rotation <<< "$config_str"
  name="solid_warm_${cs}_${density}_${scheme}_skin${skin}_rot${rotation}"
  out="$TMPDIR/${name}.png"

  args=(
    render
    --input "$TMPDIR/solid_warm.rgb"
    --output "$out"
    --width 128 --height 128 --size 256
    --output-format png
    --color-space "$cs"
    --density "$density"
  )
  if [ "$scheme" != "none" ]; then
    args+=(--scheme "$scheme" --rotation "$rotation")
  fi
  if [ "$skin" = "off" ]; then
    args+=(--hide-skin-tone)
  fi

  if ! "$PROCESSOR" "${args[@]}" 2>/dev/null; then
    echo "  FAIL: $name — processor exited with error"
    add_result "$name" "failed" "processor error"
    failed=$((failed + 1))
    continue
  fi

  if [ ! -f "$out" ]; then
    echo "  FAIL: $name — no output file"
    add_result "$name" "failed" "no output"
    failed=$((failed + 1))
    continue
  fi

  # Check PNG magic bytes
  magic=$(xxd -l 4 -p "$out")
  if [ "$magic" != "89504e47" ]; then
    echo "  FAIL: $name — not a valid PNG (magic: $magic)"
    add_result "$name" "failed" "invalid PNG"
    failed=$((failed + 1))
    continue
  fi

  # Compare against Rust baseline if it exists
  baseline="$BASELINES_DIR/${name}.png"
  if [ -f "$baseline" ]; then
    if cmp -s "$out" "$baseline"; then
      echo "  PASS: $name (exact match with baseline)"
      add_result "$name" "passed" "exact match"
      passed=$((passed + 1))
    else
      echo "  FAIL: $name — output differs from baseline"
      cp "$out" "$RESULTS_DIR/lr_${name}_actual.png"
      add_result "$name" "failed" "baseline mismatch"
      failed=$((failed + 1))
    fi
  else
    echo "  PASS: $name (valid output, no baseline to compare)"
    add_result "$name" "passed" "no baseline"
    passed=$((passed + 1))
  fi
done

echo
echo "=== Results: $passed passed, $failed failed ==="

echo "$results" > "$RESULTS_DIR/lightroom-smoke.json"

exit $failed
