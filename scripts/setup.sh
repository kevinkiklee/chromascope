#!/usr/bin/env bash
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

info()  { echo -e "${CYAN}[info]${NC}  $1"; }
ok()    { echo -e "${GREEN}[ok]${NC}    $1"; }
warn()  { echo -e "${YELLOW}[warn]${NC}  $1"; }
fail()  { echo -e "${RED}[fail]${NC}  $1"; }

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

echo ""
echo "========================================="
echo "  Chromascope - Initial Setup"
echo "========================================="
echo ""

# ─── 1. Check prerequisites ───────────────────────────────────────────

MISSING=()

info "Checking prerequisites..."

# Node.js
if command -v node &>/dev/null; then
  NODE_VER="$(node -v)"
  NODE_MAJOR="${NODE_VER#v}"
  NODE_MAJOR="${NODE_MAJOR%%.*}"
  if (( NODE_MAJOR < 18 )); then
    fail "Node.js $NODE_VER found, but v18+ is required"
    MISSING+=("node")
  else
    ok "Node.js $NODE_VER"
  fi
else
  fail "Node.js not found"
  MISSING+=("node")
fi

# npm
if command -v npm &>/dev/null; then
  ok "npm $(npm -v)"
else
  fail "npm not found"
  MISSING+=("npm")
fi

# Rust / Cargo (optional but needed for decode package)
if command -v cargo &>/dev/null; then
  ok "Cargo $(cargo --version | awk '{print $2}')"
  HAS_RUST=true
else
  warn "Cargo not found -- packages/decode will not build (install via https://rustup.rs)"
  HAS_RUST=false
fi

if (( ${#MISSING[@]} > 0 )); then
  echo ""
  fail "Missing required tools: ${MISSING[*]}"
  echo "  Install them and re-run this script."
  exit 1
fi

echo ""

# ─── 2. Install npm dependencies ──────────────────────────────────────

info "Installing npm dependencies (workspaces)..."
npm install
ok "npm install complete"
echo ""

# ─── 3. Build all packages ────────────────────────────────────────────

info "Building all packages via Turborepo..."
npx turbo build
ok "Turbo build complete"
echo ""

# ─── 4. Build Rust decode binary ──────────────────────────────────────

if [ "$HAS_RUST" = true ]; then
  info "Building Rust decode binary (release)..."
  (cd packages/decode && cargo build --release)
  ok "Rust binary built at packages/decode/target/release/decode"
  echo ""
fi

# ─── 5. Run tests ─────────────────────────────────────────────────────

info "Running tests..."
npx turbo test
ok "All tests passed"
echo ""

# ─── 6. Set up web app .env.local ─────────────────────────────────────

ENV_FILE="apps/web/.env.local"
ENV_EXAMPLE="apps/web/.env.example"

if [ ! -f "$ENV_FILE" ]; then
  if [ -f "$ENV_EXAMPLE" ]; then
    cp "$ENV_EXAMPLE" "$ENV_FILE"
    warn "Created $ENV_FILE from .env.example -- fill in your real values"
  else
    cat > "$ENV_FILE" <<'EOF'
# Neon Postgres
DATABASE_URL=

# Stripe
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
EOF
    warn "Created $ENV_FILE with placeholder keys -- fill in your real values"
  fi
else
  ok "$ENV_FILE already exists"
fi

echo ""

# ─── 7. Summary ───────────────────────────────────────────────────────

echo "========================================="
echo "  Setup complete!"
echo "========================================="
echo ""
echo "  Next steps:"
echo ""
echo "  1. Fill in apps/web/.env.local with your"
echo "     Neon and Stripe credentials."
echo ""
echo "  2. Start developing:"
echo "     npx turbo dev          # all dev servers"
echo "     cd packages/core && npm run dev   # core only"
echo "     cd apps/web && npm run dev        # web only"
echo ""
if [ "$HAS_RUST" = false ]; then
  echo "  3. Install Rust (https://rustup.rs) to build"
  echo "     the decode binary for Lightroom."
  echo ""
fi
