#!/usr/bin/env bash
set -euo pipefail

# Ensure Rust toolchain is on PATH
export PATH="$HOME/.cargo/bin:$PATH"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

info()  { echo -e "${CYAN}[info]${NC}  $1"; }
ok()    { echo -e "${GREEN}[ok]${NC}    $1"; }
warn()  { echo -e "${YELLOW}[warn]${NC}  $1"; }
fail()  { echo -e "${RED}[fail]${NC}  $1"; exit 1; }

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

echo ""
echo "========================================="
echo "  Chromascope - Build All Plugins"
echo "========================================="
echo ""

# ─── 1. Build core library ──────────────────────────────────────────────

info "Building core library..."
npx turbo run build --filter=@chromascope/core

if [ ! -f packages/core/build/index.html ]; then
  fail "Core build output not found at packages/core/build/index.html"
fi
ok "Core library built"

# ─── 2. Build Rust decode binary ─────────────────────────────────────────

info "Building Rust decode binary..."

if ! command -v cargo &> /dev/null; then
  fail "Rust toolchain not found. Install from https://rustup.rs"
fi

cd packages/decode
cargo build --release
cd "$REPO_ROOT"

DECODE_BIN="packages/decode/target/release/decode"
if [ ! -f "$DECODE_BIN" ]; then
  fail "Decode binary not found at $DECODE_BIN"
fi
ok "Decode binary built"

# ─── 3. Build Photoshop plugin ───────────────────────────────────────────

info "Building Photoshop plugin..."
npx turbo run build --filter=@chromascope/photoshop

if [ ! -f plugins/photoshop/core/index.html ]; then
  fail "Photoshop plugin build failed — core/index.html not found"
fi
ok "Photoshop plugin built"

# ─── 4. Assemble Lightroom plugin ────────────────────────────────────────

info "Assembling Lightroom plugin..."

LR_DIR="plugins/lightroom/chromascope.lrdevplugin"

# Copy core build into Lightroom plugin
mkdir -p "$LR_DIR/core"
cp packages/core/build/index.html "$LR_DIR/core/index.html"
ok "Copied core build → $LR_DIR/core/index.html"

# Copy decode binary for current platform
ARCH="$(uname -m)"
OS="$(uname -s)"

if [ "$OS" = "Darwin" ]; then
  if [ "$ARCH" = "arm64" ]; then
    PLATFORM_DIR="$LR_DIR/bin/macos-arm64"
  else
    PLATFORM_DIR="$LR_DIR/bin/macos-x64"
  fi
elif [ "$OS" = "Linux" ] || [[ "$OS" == MINGW* ]] || [[ "$OS" == MSYS* ]]; then
  PLATFORM_DIR="$LR_DIR/bin/win-x64"
else
  warn "Unknown platform $OS/$ARCH — skipping decode binary copy"
  PLATFORM_DIR=""
fi

if [ -n "$PLATFORM_DIR" ]; then
  mkdir -p "$PLATFORM_DIR"
  cp "$DECODE_BIN" "$PLATFORM_DIR/decode"
  chmod +x "$PLATFORM_DIR/decode"
  ok "Copied decode binary → $PLATFORM_DIR/decode"
fi

# ─── Done ────────────────────────────────────────────────────────────────

echo ""
ok "All plugins built successfully"
echo ""
echo "  Photoshop:  plugins/photoshop/"
echo "  Lightroom:  $LR_DIR/"
echo ""
