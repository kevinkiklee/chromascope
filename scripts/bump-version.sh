#!/usr/bin/env bash
set -euo pipefail

if [ $# -lt 1 ]; then
  echo "Usage: $0 <version>"
  echo "Example: $0 1.2.0"
  exit 1
fi

VERSION="$1"

if ! echo "$VERSION" | grep -qE '^[0-9]+\.[0-9]+\.[0-9]+$'; then
  echo "Error: Version must be in X.Y.Z format (got: $VERSION)"
  exit 1
fi

MAJOR=$(echo "$VERSION" | cut -d. -f1)
MINOR=$(echo "$VERSION" | cut -d. -f2)
PATCH=$(echo "$VERSION" | cut -d. -f3)

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

echo "Bumping version to $VERSION..."

sed -i.bak 's/"version": "[^"]*"/"version": "'"$VERSION"'"/' packages/core/package.json
sed -i.bak 's/"version": "[^"]*"/"version": "'"$VERSION"'"/' packages/processor/package.json
sed -i.bak 's/^version = "[^"]*"/version = "'"$VERSION"'"/' packages/processor/Cargo.toml
sed -i.bak 's/"version": "[^"]*"/"version": "'"$VERSION"'"/' plugins/photoshop/package.json
sed -i.bak 's/"version": "[^"]*"/"version": "'"$VERSION"'"/' plugins/photoshop/manifest.json
sed -i.bak "s/VERSION = { major = [0-9]*, minor = [0-9]*, revision = [0-9]* }/VERSION = { major = $MAJOR, minor = $MINOR, revision = $PATCH }/" \
  plugins/lightroom/chromascope.lrdevplugin/Info.lua

find . -name "*.bak" -delete 2>/dev/null || true

echo ""
echo "Updated files:"
git diff --stat
echo ""
echo "Version bumped to $VERSION"
