#!/usr/bin/env bash
set -euo pipefail

# Package built plugins into release ZIPs for distribution.
# Run after `npm run build:plugins` has completed successfully.
#
# Output:
#   dist/chromascope-macos.zip    — Photoshop + Lightroom plugins (macOS universal)
#   dist/chromascope-windows.zip  — Photoshop + Lightroom plugins (Windows x64)
#   dist/checksums.txt            — SHA-256 checksums

RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
NC='\033[0m'

info()  { echo -e "${CYAN}[info]${NC}  $1"; }
ok()    { echo -e "${GREEN}[ok]${NC}    $1"; }
fail()  { echo -e "${RED}[fail]${NC}  $1"; exit 1; }

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

DIST_DIR="$REPO_ROOT/dist"
STAGE_DIR="$REPO_ROOT/dist/.stage"

PS_DIR="plugins/photoshop"
LR_DIR="plugins/lightroom/chromascope.lrdevplugin"

# Verify build output exists
[ -f "$PS_DIR/core/index.html" ] || fail "Photoshop plugin not built. Run 'npm run build:plugins' first."
[ -f "$LR_DIR/Info.lua" ]        || fail "Lightroom plugin not built. Run 'npm run build:plugins' first."

rm -rf "$DIST_DIR"
mkdir -p "$DIST_DIR" "$STAGE_DIR"

echo ""
echo "========================================="
echo "  Chromascope - Package Release"
echo "========================================="
echo ""

# ─── macOS ZIP ──────────────────────────────────────────────────────────

info "Packaging macOS release..."

MACOS_STAGE="$STAGE_DIR/chromascope-macos"
mkdir -p "$MACOS_STAGE"

# Photoshop plugin (only distributable files)
PS_DEST="$MACOS_STAGE/Chromascope-Photoshop"
mkdir -p "$PS_DEST/core" "$PS_DEST/icons"
cp "$PS_DIR/manifest.json" "$PS_DEST/"
cp "$PS_DIR/index.html" "$PS_DEST/"
cp "$PS_DIR/core/index.html" "$PS_DEST/core/"
cp "$PS_DIR/core/scope-bundle.js" "$PS_DEST/core/"
[ -d "$PS_DIR/icons" ] && cp -r "$PS_DIR/icons/"* "$PS_DEST/icons/" 2>/dev/null || true

# Lightroom plugin — include only macOS binaries
mkdir -p "$MACOS_STAGE/chromascope.lrdevplugin/bin/macos-arm64"
mkdir -p "$MACOS_STAGE/chromascope.lrdevplugin/bin/macos-x64"

# Copy all Lua + core files
for f in "$LR_DIR"/*.lua; do
  cp "$f" "$MACOS_STAGE/chromascope.lrdevplugin/"
done
if [ -d "$LR_DIR/core" ]; then
  cp -r "$LR_DIR/core" "$MACOS_STAGE/chromascope.lrdevplugin/core"
fi

# Copy macOS binaries
if [ -f "$LR_DIR/bin/macos-arm64/processor" ]; then
  cp "$LR_DIR/bin/macos-arm64/processor" "$MACOS_STAGE/chromascope.lrdevplugin/bin/macos-arm64/processor"
  chmod +x "$MACOS_STAGE/chromascope.lrdevplugin/bin/macos-arm64/processor"
fi
if [ -f "$LR_DIR/bin/macos-x64/processor" ]; then
  cp "$LR_DIR/bin/macos-x64/processor" "$MACOS_STAGE/chromascope.lrdevplugin/bin/macos-x64/processor"
  chmod +x "$MACOS_STAGE/chromascope.lrdevplugin/bin/macos-x64/processor"
fi

# Create ZIP
(cd "$STAGE_DIR" && zip -rq "$DIST_DIR/chromascope-macos.zip" chromascope-macos/)
ok "chromascope-macos.zip"

# ─── Windows ZIP ────────────────────────────────────────────────────────

info "Packaging Windows release..."

WIN_STAGE="$STAGE_DIR/chromascope-windows"
mkdir -p "$WIN_STAGE"

# Photoshop plugin (only distributable files)
PS_DEST="$WIN_STAGE/Chromascope-Photoshop"
mkdir -p "$PS_DEST/core" "$PS_DEST/icons"
cp "$PS_DIR/manifest.json" "$PS_DEST/"
cp "$PS_DIR/index.html" "$PS_DEST/"
cp "$PS_DIR/core/index.html" "$PS_DEST/core/"
cp "$PS_DIR/core/scope-bundle.js" "$PS_DEST/core/"
[ -d "$PS_DIR/icons" ] && cp -r "$PS_DIR/icons/"* "$PS_DEST/icons/" 2>/dev/null || true

# Lightroom plugin — include only Windows binaries
mkdir -p "$WIN_STAGE/chromascope.lrdevplugin/bin/win-x64"

for f in "$LR_DIR"/*.lua; do
  cp "$f" "$WIN_STAGE/chromascope.lrdevplugin/"
done
if [ -d "$LR_DIR/core" ]; then
  cp -r "$LR_DIR/core" "$WIN_STAGE/chromascope.lrdevplugin/core"
fi

if [ -f "$LR_DIR/bin/win-x64/processor.exe" ]; then
  cp "$LR_DIR/bin/win-x64/processor.exe" "$WIN_STAGE/chromascope.lrdevplugin/bin/win-x64/processor.exe"
fi

(cd "$STAGE_DIR" && zip -rq "$DIST_DIR/chromascope-windows.zip" chromascope-windows/)
ok "chromascope-windows.zip"

# ─── Checksums ──────────────────────────────────────────────────────────

info "Generating checksums..."
(cd "$DIST_DIR" && shasum -a 256 chromascope-macos.zip chromascope-windows.zip > checksums.txt)
ok "checksums.txt"

# ─── Cleanup ────────────────────────────────────────────────────────────

rm -rf "$STAGE_DIR"

echo ""
ok "Release packages ready in dist/"
echo ""
cat "$DIST_DIR/checksums.txt" | while read -r line; do
  echo "  $line"
done
echo ""
