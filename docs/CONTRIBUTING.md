# Contributing to Chromascope

Thanks for your interest in contributing! This guide will help you get started.

## Getting Started

1. Fork the repository
2. Clone your fork and set up the project:

```sh
git clone https://github.com/<your-username>/chromascope.git
cd chromascope
./scripts/setup.sh
```

See [docs/SETUP.md](docs/SETUP.md) for detailed setup instructions and [docs/LOCAL_DEVELOPMENT.md](docs/LOCAL_DEVELOPMENT.md) for the development workflow.

## Development

### Prerequisites

- Node.js 20+
- Rust toolchain (for `packages/processor`)
- npm 11+

### Build

```sh
npm install
npx turbo build        # Build all packages
npm run build:plugins  # Build core + processor + assemble plugins
```

### Test

```sh
npx turbo test                    # All tests
cd packages/core && npm run test  # Core library (Vitest)
cd packages/processor && cargo test --release  # Rust binary
```

## Making Changes

1. Create a branch from `main`:
   ```sh
   git checkout -b my-feature
   ```
2. Make your changes
3. Run tests and build to verify:
   ```sh
   npx turbo test
   npm run build:plugins
   ```
4. Commit with a clear message:
   ```sh
   git commit -m "feat: add XYZ support"
   ```
5. Push and open a pull request

### Commit Messages

We follow [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` -- New feature
- `fix:` -- Bug fix
- `docs:` -- Documentation only
- `refactor:` -- Code change that neither fixes a bug nor adds a feature
- `test:` -- Adding or updating tests
- `chore:` -- Build process, CI, or tooling changes

Scope is optional but encouraged: `feat(core):`, `fix(lightroom):`, `fix(photoshop):`.

## Architecture Overview

The project is a Turborepo monorepo:

| Package | Language | Purpose |
|---------|----------|---------|
| `packages/core` | TypeScript | Vectorscope math, rendering, UI controls |
| `packages/processor` | Rust | Image decoding + vectorscope rendering CLI |
| `plugins/photoshop` | JavaScript | Photoshop UXP panel plugin |
| `plugins/lightroom` | Lua | Lightroom Classic plugin (uses Rust binary) |
| `web` | HTML/CSS | Static marketing site + documentation |

Core must build before plugins. See [CLAUDE.md](CLAUDE.md) for detailed architecture notes.

## Reporting Bugs

Open an issue with:

- Steps to reproduce
- Expected vs actual behavior
- Host application and version (e.g., Photoshop 2025, Lightroom Classic 14.2)
- OS and architecture

## Suggesting Features

Open an issue describing:

- The problem you're trying to solve
- Your proposed solution
- Any alternatives you've considered

## Releasing

Releases are automated via GitHub Actions. Maintainers create a release by tagging a commit:

```sh
git tag v1.0.0
git push --tags
```

This triggers the [release workflow](.github/workflows/release.yml), which:

1. Builds the core library and Rust processor on **macOS** and **Windows** runners (native binaries, no cross-compilation)
2. Assembles both plugins (Photoshop UXP + Lightroom Classic)
3. Packages platform-specific ZIPs (`chromascope-macos.zip`, `chromascope-windows.zip`)
4. Creates a GitHub Release with auto-generated release notes, the ZIPs, and SHA-256 checksums

The [download page](https://chromascope.dev/download) links to the latest GitHub Release, so new downloads are available immediately after the workflow completes.

### Version bumping

Version numbers are currently set in several places. Update all of them before tagging:

| File | Field |
|------|-------|
| `packages/core/package.json` | `version` |
| `packages/processor/package.json` | `version` |
| `packages/processor/Cargo.toml` | `version` |
| `plugins/photoshop/package.json` | `version` |
| `plugins/photoshop/manifest.json` | `version` |
| `plugins/lightroom/chromascope.lrdevplugin/Info.lua` | `VERSION` |

### Local packaging (for testing)

You can build and package locally without pushing a tag:

```sh
npm run build:plugins      # Build everything
npm run package:release    # Create ZIPs in dist/
```

Inspect the output in `dist/` before tagging.

## Code Style

- TypeScript: strict mode, no explicit `any`
- Rust: standard `cargo fmt` / `cargo clippy`
- Lua: follow existing patterns in the Lightroom plugin

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
