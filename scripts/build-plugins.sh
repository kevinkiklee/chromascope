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

info "Building core library bundle..."
npx turbo run build:lib --filter=@chromascope/core

# ─── 2. Build Rust processor binaries (all platforms) ───────────────────

info "Building Rust processor binaries..."

if ! command -v cargo &> /dev/null; then
  fail "Rust toolchain not found. Install from https://rustup.rs"
fi

cd packages/processor

# Native build (current platform)
cargo build --release
ok "Processor binary built (native)"

# macOS x64 cross-compile (from arm64 host)
ARCH="$(uname -m)"
OS="$(uname -s)"

if [ "$OS" = "Darwin" ] && [ "$ARCH" = "arm64" ]; then
  info "Cross-compiling for macOS x64..."
  rustup target add x86_64-apple-darwin 2>/dev/null || true
  cargo build --release --target x86_64-apple-darwin
  ok "Processor binary built (macOS x64)"
elif [ "$OS" = "Darwin" ] && [ "$ARCH" = "x86_64" ]; then
  info "Cross-compiling for macOS arm64..."
  rustup target add aarch64-apple-darwin 2>/dev/null || true
  cargo build --release --target aarch64-apple-darwin
  ok "Processor binary built (macOS arm64)"
fi

# Windows x64 cross-compile via cross (requires Docker)
if command -v cross &> /dev/null && command -v docker &> /dev/null; then
  info "Cross-compiling for Windows x64 (via Docker)..."
  cross build --release --target x86_64-pc-windows-gnu
  ok "Processor binary built (Windows x64)"
else
  warn "Skipping Windows build — 'cross' or 'docker' not found"
  warn "Install: cargo install cross --git https://github.com/cross-rs/cross"
fi

cd "$REPO_ROOT"

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

# Core HTML is not used by the Lightroom plugin (it has no WebView).
# mkdir -p "$LR_DIR/core"
# cp packages/core/build/index.html "$LR_DIR/core/index.html"

# Copy processor binaries for all available platforms
PROC_DIR="packages/processor/target"

# macOS arm64 (native build on arm64 host)
MACOS_ARM64_BIN="$PROC_DIR/release/processor"
if [ "$OS" = "Darwin" ] && [ "$ARCH" = "arm64" ] && [ -f "$MACOS_ARM64_BIN" ]; then
  mkdir -p "$LR_DIR/bin/macos-arm64"
  cp "$MACOS_ARM64_BIN" "$LR_DIR/bin/macos-arm64/processor"
  chmod +x "$LR_DIR/bin/macos-arm64/processor"
  ok "Copied processor → $LR_DIR/bin/macos-arm64/processor"
fi

# macOS arm64 (cross-compiled from x64 host)
MACOS_ARM64_CROSS="$PROC_DIR/aarch64-apple-darwin/release/processor"
if [ "$OS" = "Darwin" ] && [ "$ARCH" = "x86_64" ] && [ -f "$MACOS_ARM64_CROSS" ]; then
  mkdir -p "$LR_DIR/bin/macos-arm64"
  cp "$MACOS_ARM64_CROSS" "$LR_DIR/bin/macos-arm64/processor"
  chmod +x "$LR_DIR/bin/macos-arm64/processor"
  ok "Copied processor → $LR_DIR/bin/macos-arm64/processor"
fi

# macOS x64 (native build on x64 host)
if [ "$OS" = "Darwin" ] && [ "$ARCH" = "x86_64" ] && [ -f "$MACOS_ARM64_BIN" ]; then
  mkdir -p "$LR_DIR/bin/macos-x64"
  cp "$MACOS_ARM64_BIN" "$LR_DIR/bin/macos-x64/processor"
  chmod +x "$LR_DIR/bin/macos-x64/processor"
  ok "Copied processor → $LR_DIR/bin/macos-x64/processor"
fi

# macOS x64 (cross-compiled from arm64 host)
MACOS_X64_CROSS="$PROC_DIR/x86_64-apple-darwin/release/processor"
if [ -f "$MACOS_X64_CROSS" ]; then
  mkdir -p "$LR_DIR/bin/macos-x64"
  cp "$MACOS_X64_CROSS" "$LR_DIR/bin/macos-x64/processor"
  chmod +x "$LR_DIR/bin/macos-x64/processor"
  ok "Copied processor → $LR_DIR/bin/macos-x64/processor"
fi

# Windows x64 (cross-compiled via cross/Docker)
WIN_X64_BIN="$PROC_DIR/x86_64-pc-windows-gnu/release/processor.exe"
if [ -f "$WIN_X64_BIN" ]; then
  mkdir -p "$LR_DIR/bin/win-x64"
  cp "$WIN_X64_BIN" "$LR_DIR/bin/win-x64/processor.exe"
  ok "Copied processor → $LR_DIR/bin/win-x64/processor.exe"
fi

# ─── Done ────────────────────────────────────────────────────────────────

echo ""
ok "All plugins built successfully"
echo ""
echo "  Photoshop:  plugins/photoshop/"
echo "  Lightroom:  $LR_DIR/"
echo ""
