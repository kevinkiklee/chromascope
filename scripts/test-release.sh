#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

echo "=============================="
echo " Chromascope Pre-Release Tests"
echo "=============================="
echo

# Phase 0: Build
echo "--- Phase 0: Build ---"
npm run build:plugins
echo

# Phase 1: Layer 1 — Headless Visual Regression
echo "--- Phase 1: Headless Visual Regression ---"

echo "Running Rust visual regression..."
cargo test --release --manifest-path packages/processor/Cargo.toml --test visual_regression -- --nocapture
echo

if command -v npx &>/dev/null && [ -f packages/core/playwright.config.ts ]; then
  echo "Running TypeScript core visual regression..."
  cd packages/core
  npx playwright test --config playwright.config.ts
  cd "$REPO_ROOT"
  echo
else
  echo "SKIP: TypeScript core visual regression (Playwright not configured)"
  echo
fi

# Phase 2: Layer 2 — Smoke Tests
echo "--- Phase 2: Smoke Tests ---"

echo "Running Lightroom pipeline smoke test..."
bash tests/e2e/lightroom/smoke.sh || true
echo

if command -v lua &>/dev/null; then
  echo "Running Lightroom Lua unit tests..."
  lua tests/e2e/lightroom/lua/test_utils.lua
  echo
else
  echo "SKIP: Lua unit tests (lua not installed — brew install lua)"
  echo
fi

echo "Running Photoshop smoke test..."
node tests/e2e/photoshop/smoke.mjs || true
echo

# Phase 3: Report
echo "--- Phase 3: Report ---"
node scripts/visual-report.js || true

REPORT="$REPO_ROOT/test-results/visual-report.html"
if [ -f "$REPORT" ]; then
  echo
  echo "Report: $REPORT"
  if command -v open &>/dev/null; then
    open "$REPORT"
  fi
fi
