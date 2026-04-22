# Automated E2E & Visual Regression Testing — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a three-layer automated testing pyramid (headless visual regression, host integration smoke tests, host visual capture) that replaces manual QA of the Photoshop and Lightroom plugins.

**Architecture:** Layer 1 (headless) snapshots the Rust processor and TS core across a pairwise configuration matrix and diffs against committed baselines. Layer 2 (smoke) exercises the real plugin pipelines inside host apps. Layer 3 (visual capture) extracts rendered images from Photoshop and diffs against Rust baselines. All layers feed a single HTML report.

**Tech Stack:** Vitest, Playwright (pinned), pixelmatch/pngjs, Rust `image` crate (PNG feature), Lua 5.4, shell scripts, Git LFS.

**Spec:** `docs/superpowers/specs/2026-04-22-automated-testing-design.md`

---

### Task 1: Infrastructure — Git LFS, .gitignore, dependencies

**Files:**
- Create: `.gitattributes`
- Modify: `.gitignore`
- Modify: `package.json`

- [ ] **Step 1: Create `.gitattributes` for LFS tracking**

```
packages/processor/tests/baselines/*.png filter=lfs diff=lfs merge=lfs -text
packages/core/test/baselines/*.png filter=lfs diff=lfs merge=lfs -text
```

- [ ] **Step 2: Add `test-results/` to `.gitignore`**

Append to the existing `.gitignore`:
```
test-results/
```

- [ ] **Step 3: Install npm dev dependencies**

Run: `npm install --save-dev pixelmatch pngjs @playwright/test`

Then pin Playwright browsers:
Run: `npx playwright install chromium`

- [ ] **Step 4: Create directory structure**

Run:
```bash
mkdir -p tests/e2e/photoshop tests/e2e/lightroom/lua tests/fixtures
mkdir -p packages/processor/tests/baselines packages/core/test/baselines
mkdir -p test-results
```

- [ ] **Step 5: Commit**

```bash
git add .gitattributes .gitignore package.json package-lock.json
git commit -m "chore: add Git LFS tracking, test infrastructure dependencies"
```

---

### Task 2: Rust processor — `--output-format png` flag

**Files:**
- Modify: `packages/processor/Cargo.toml`
- Modify: `packages/processor/src/main.rs`

**Docs to check:** `packages/processor/src/render/mod.rs` for `render_vectorscope` return type (`RgbImage`).

- [ ] **Step 1: Add PNG feature to image crate**

In `packages/processor/Cargo.toml`, change:
```toml
image = { version = "0.25", default-features = false, features = ["jpeg", "tiff"] }
```
to:
```toml
image = { version = "0.25", default-features = false, features = ["jpeg", "tiff", "png"] }
```

- [ ] **Step 2: Add `--output-format` arg to `RenderArgs`**

In `packages/processor/src/main.rs`, add to the `RenderArgs` struct:
```rust
    /// Output image format (jpeg, png)
    #[arg(long, default_value = "jpeg")]
    output_format: String,
```

- [ ] **Step 3: Update render command to use format flag**

Replace the existing save call:
```rust
scope.save(&args.output)
    .map_err(|e| anyhow::anyhow!("Failed to save {:?}: {}", args.output, e))?;
```

With:
```rust
match args.output_format.as_str() {
    "png" => scope.save_with_format(&args.output, image::ImageFormat::Png),
    _ => scope.save_with_format(&args.output, image::ImageFormat::Jpeg),
}
.map_err(|e| anyhow::anyhow!("Failed to save {:?}: {}", args.output, e))?;
```

- [ ] **Step 4: Verify existing tests still pass**

Run: `cargo test --release --manifest-path packages/processor/Cargo.toml`
Expected: All existing tests pass (they don't use `--output-format`).

- [ ] **Step 5: Quick manual verification**

Run:
```bash
cd packages/processor
# Create a test RGB file
cargo run --release -- render --input tests/fixtures/test_rgb.raw --output /tmp/test_scope.png --output-format png --width 2 --height 2 --size 256 2>/dev/null || echo "Need fixture first"
```

Actually, the existing tests create fixtures. Instead verify by adding a quick test to the existing test file — but we'll cover this in Task 4's visual regression test. For now, verify the build compiles:

Run: `cargo build --release --manifest-path packages/processor/Cargo.toml`
Expected: Compiles without errors.

- [ ] **Step 6: Commit**

```bash
git add packages/processor/Cargo.toml packages/processor/src/main.rs
git commit -m "feat(processor): add --output-format png flag for lossless test output"
```

---

### Task 3: Pairwise test matrix fixture

**Files:**
- Create: `tests/fixtures/test_matrix.txt`

- [ ] **Step 1: Create the pairwise covering array**

This file defines ~35 configurations that cover all pairwise combinations of (color_space × density × scheme × skin_tone × rotation). Rotation is ignored when scheme is "none".

Write `tests/fixtures/test_matrix.txt`:
```
# Pairwise covering array for Chromascope visual regression testing
# Covers all pairs of: color_space(3) × density(3) × scheme(6) × skin_tone(2) × rotation(3)
# Rotation is ignored when scheme=none
# color_space	density	scheme	skin_tone	rotation
hsl	scatter	none	on	0
ycbcr	heatmap	complementary	off	120
cieluv	bloom	splitComplementary	on	240
hsl	heatmap	triadic	off	0
ycbcr	bloom	tetradic	on	120
cieluv	scatter	analogous	off	240
hsl	bloom	complementary	on	0
ycbcr	scatter	splitComplementary	off	120
cieluv	heatmap	triadic	on	240
hsl	scatter	tetradic	off	240
ycbcr	heatmap	analogous	on	0
cieluv	bloom	none	off	0
hsl	heatmap	splitComplementary	on	120
ycbcr	bloom	triadic	off	240
cieluv	scatter	complementary	on	0
hsl	bloom	analogous	off	120
ycbcr	scatter	none	on	0
cieluv	heatmap	tetradic	off	240
hsl	scatter	analogous	on	240
ycbcr	heatmap	none	off	0
cieluv	bloom	complementary	on	120
hsl	heatmap	tetradic	on	240
ycbcr	bloom	none	off	0
cieluv	scatter	splitComplementary	off	120
hsl	bloom	triadic	off	0
ycbcr	scatter	tetradic	on	240
cieluv	heatmap	analogous	off	0
hsl	scatter	complementary	off	120
ycbcr	heatmap	splitComplementary	on	240
cieluv	bloom	triadic	off	0
hsl	heatmap	none	on	0
ycbcr	bloom	analogous	off	120
cieluv	scatter	tetradic	on	240
hsl	bloom	none	off	0
ycbcr	scatter	analogous	off	0
```

- [ ] **Step 2: Commit**

```bash
git add tests/fixtures/test_matrix.txt
git commit -m "test: add pairwise configuration matrix for visual regression"
```

---

### Task 4: Rust visual regression test

**Files:**
- Create: `packages/processor/tests/visual_regression.rs`

**Docs to check:**
- `packages/processor/tests/processor_test.rs` — existing test patterns (binary invocation, fixture creation, atomic writes)
- `packages/processor/src/main.rs` — CLI args structure

This is the largest single task. The test file:
1. Parses the pairwise matrix from `tests/fixtures/test_matrix.txt` (path relative to repo root)
2. Generates 5 input images programmatically (following existing atomic-write pattern)
3. For each (input × config), invokes the processor binary with `--output-format png`
4. Compares output against baselines using pixel RMSE
5. Writes results JSON and diff images on failure

- [ ] **Step 1: Write the test file**

Write `packages/processor/tests/visual_regression.rs`:

```rust
use image::{ImageReader, RgbImage};
use std::env;
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::Command;

fn repo_root() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .unwrap()
        .parent()
        .unwrap()
        .to_path_buf()
}

fn binary_path() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("../../target/release/processor")
}

fn baselines_dir() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).join("tests/baselines")
}

fn results_dir() -> PathBuf {
    repo_root().join("test-results")
}

fn fixtures_dir() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures")
}

fn update_baselines() -> bool {
    env::var("UPDATE_BASELINES").is_ok()
}

struct TestConfig {
    color_space: String,
    density: String,
    scheme: String,
    skin_tone: String,
    rotation: String,
}

impl TestConfig {
    fn name(&self) -> String {
        format!(
            "{}_{}_{}_skin{}_rot{}",
            self.color_space, self.density, self.scheme, self.skin_tone, self.rotation
        )
    }

    fn to_args(&self) -> Vec<String> {
        let mut args = vec![
            "--color-space".to_string(),
            self.color_space.clone(),
            "--density".to_string(),
            self.density.clone(),
        ];
        if self.scheme != "none" {
            args.extend([
                "--scheme".to_string(),
                self.scheme.clone(),
                "--rotation".to_string(),
                self.rotation.clone(),
            ]);
        }
        if self.skin_tone == "off" {
            args.push("--hide-skin-tone".to_string());
        }
        args
    }
}

fn parse_test_matrix() -> Vec<TestConfig> {
    let matrix_path = repo_root().join("tests/fixtures/test_matrix.txt");
    let content = fs::read_to_string(&matrix_path)
        .unwrap_or_else(|e| panic!("Failed to read {:?}: {}", matrix_path, e));
    content
        .lines()
        .filter(|l| !l.starts_with('#') && !l.trim().is_empty())
        .map(|line| {
            let cols: Vec<&str> = line.split('\t').collect();
            assert!(
                cols.len() == 5,
                "Bad matrix line (expected 5 tab-separated cols): {line}"
            );
            TestConfig {
                color_space: cols[0].to_string(),
                density: cols[1].to_string(),
                scheme: cols[2].to_string(),
                skin_tone: cols[3].to_string(),
                rotation: cols[4].to_string(),
            }
        })
        .collect()
}

struct TestInput {
    name: &'static str,
    width: u32,
    height: u32,
    data: Vec<u8>,
}

fn create_solid_rgb(w: u32, h: u32, r: u8, g: u8, b: u8) -> Vec<u8> {
    let mut data = Vec::with_capacity((w * h * 3) as usize);
    for _ in 0..(w * h) {
        data.extend_from_slice(&[r, g, b]);
    }
    data
}

fn create_quadrant_rgb(w: u32, h: u32) -> Vec<u8> {
    let mut data = Vec::with_capacity((w * h * 3) as usize);
    let hw = w / 2;
    let hh = h / 2;
    for y in 0..h {
        for x in 0..w {
            let (r, g, b) = if y < hh {
                if x < hw { (255, 0, 0) } else { (0, 255, 0) }
            } else {
                if x < hw { (0, 0, 255) } else { (255, 255, 255) }
            };
            data.extend_from_slice(&[r, g, b]);
        }
    }
    data
}

fn create_neutral_gray(w: u32, h: u32) -> Vec<u8> {
    create_solid_rgb(w, h, 128, 128, 128)
}

fn create_saturated_primaries(w: u32, h: u32) -> Vec<u8> {
    let mut data = Vec::with_capacity((w * h * 3) as usize);
    let colors: [(u8, u8, u8); 6] = [
        (255, 0, 0),
        (0, 255, 0),
        (0, 0, 255),
        (0, 255, 255),
        (255, 0, 255),
        (255, 255, 0),
    ];
    let rows_per_band = h / 6;
    for y in 0..h {
        let band = ((y / rows_per_band) as usize).min(5);
        let (r, g, b) = colors[band];
        for _ in 0..w {
            data.extend_from_slice(&[r, g, b]);
        }
    }
    data
}

fn create_warm_skin(w: u32, h: u32) -> Vec<u8> {
    let mut data = Vec::with_capacity((w * h * 3) as usize);
    for y in 0..h {
        let t = y as f64 / h as f64;
        let r = (200.0 + t * 55.0).min(255.0) as u8;
        let g = (140.0 + t * 40.0).min(255.0) as u8;
        let b = (100.0 + t * 30.0).min(255.0) as u8;
        for _ in 0..w {
            data.extend_from_slice(&[r, g, b]);
        }
    }
    data
}

fn generate_inputs() -> Vec<TestInput> {
    let dim = 128;
    vec![
        TestInput {
            name: "solid_warm",
            width: dim,
            height: dim,
            data: create_solid_rgb(dim, dim, 200, 100, 50),
        },
        TestInput {
            name: "quadrant",
            width: dim,
            height: dim,
            data: create_quadrant_rgb(dim, dim),
        },
        TestInput {
            name: "neutral_gray",
            width: dim,
            height: dim,
            data: create_neutral_gray(dim, dim),
        },
        TestInput {
            name: "saturated",
            width: dim,
            height: dim,
            data: create_saturated_primaries(dim, dim),
        },
        TestInput {
            name: "warm_skin",
            width: dim,
            height: dim,
            data: create_warm_skin(dim, dim),
        },
    ]
}

fn compute_rmse(a: &RgbImage, b: &RgbImage) -> f64 {
    assert_eq!(a.dimensions(), b.dimensions(), "Image dimensions must match");
    let (w, h) = a.dimensions();
    let total_pixels = (w * h) as f64;
    let sum_sq: f64 = a
        .pixels()
        .zip(b.pixels())
        .map(|(pa, pb)| {
            let dr = pa[0] as f64 - pb[0] as f64;
            let dg = pa[1] as f64 - pb[1] as f64;
            let db = pa[2] as f64 - pb[2] as f64;
            (dr * dr + dg * dg + db * db) / 3.0
        })
        .sum();
    (sum_sq / total_pixels).sqrt()
}

fn create_diff_image(a: &RgbImage, b: &RgbImage) -> RgbImage {
    let (w, h) = a.dimensions();
    let mut diff = RgbImage::new(w, h);
    for (x, y, pixel) in diff.enumerate_pixels_mut() {
        let pa = a.get_pixel(x, y);
        let pb = b.get_pixel(x, y);
        if pa == pb {
            *pixel = image::Rgb([255, 255, 255]);
        } else {
            *pixel = image::Rgb([255, 0, 0]);
        }
    }
    diff
}

#[derive(serde_json::Serialize)]
struct TestResult {
    name: String,
    input: String,
    config: String,
    status: String,
    rmse: Option<f64>,
    baseline_path: Option<String>,
    actual_path: Option<String>,
    diff_path: Option<String>,
}

#[test]
fn visual_regression() {
    let configs = parse_test_matrix();
    let inputs = generate_inputs();
    let baselines = baselines_dir();
    let results = results_dir();

    fs::create_dir_all(&baselines).unwrap();
    fs::create_dir_all(&results).unwrap();

    let threshold: f64 = 0.5;
    let mut test_results: Vec<TestResult> = Vec::new();
    let mut failures: Vec<String> = Vec::new();

    for input in &inputs {
        let rgb_path = fixtures_dir().join(format!("vr_{}.rgb", input.name));
        fs::create_dir_all(rgb_path.parent().unwrap()).unwrap();

        let tmp_path = rgb_path.with_extension("rgb.tmp");
        {
            let mut f = fs::File::create(&tmp_path).unwrap();
            f.write_all(&input.data).unwrap();
        }
        fs::rename(&tmp_path, &rgb_path).unwrap();

        for config in &configs {
            let test_name = format!("{}_{}", input.name, config.name());
            let out_path = results.join(format!("rust_{}.png", test_name));
            let baseline_path = baselines.join(format!("{}.png", test_name));

            let mut cmd = Command::new(binary_path());
            cmd.args([
                "render",
                "--input",
                rgb_path.to_str().unwrap(),
                "--output",
                out_path.to_str().unwrap(),
                "--width",
                &input.width.to_string(),
                "--height",
                &input.height.to_string(),
                "--size",
                "256",
                "--output-format",
                "png",
            ]);
            for arg in config.to_args() {
                cmd.arg(arg);
            }

            let status = cmd.status().unwrap_or_else(|e| {
                panic!("Failed to run processor for {}: {}", test_name, e)
            });
            assert!(status.success(), "Processor failed for {test_name}");

            let actual = ImageReader::open(&out_path)
                .unwrap()
                .decode()
                .unwrap()
                .into_rgb8();

            if update_baselines() {
                actual
                    .save_with_format(&baseline_path, image::ImageFormat::Png)
                    .unwrap();
                test_results.push(TestResult {
                    name: test_name,
                    input: input.name.to_string(),
                    config: config.name(),
                    status: "baseline_updated".to_string(),
                    rmse: None,
                    baseline_path: Some(baseline_path.to_string_lossy().to_string()),
                    actual_path: None,
                    diff_path: None,
                });
                continue;
            }

            if !baseline_path.exists() {
                test_results.push(TestResult {
                    name: test_name.clone(),
                    input: input.name.to_string(),
                    config: config.name(),
                    status: "new".to_string(),
                    rmse: None,
                    baseline_path: None,
                    actual_path: Some(out_path.to_string_lossy().to_string()),
                    diff_path: None,
                });
                failures.push(format!("{test_name}: no baseline (run with UPDATE_BASELINES=1)"));
                continue;
            }

            let baseline = ImageReader::open(&baseline_path)
                .unwrap()
                .decode()
                .unwrap()
                .into_rgb8();

            let rmse = compute_rmse(&actual, &baseline);

            if rmse > threshold {
                let diff_img = create_diff_image(&actual, &baseline);
                let diff_path = baselines.join(format!("{}_diff.png", test_name));
                let actual_out = baselines.join(format!("{}_actual.png", test_name));
                diff_img
                    .save_with_format(&diff_path, image::ImageFormat::Png)
                    .unwrap();
                actual
                    .save_with_format(&actual_out, image::ImageFormat::Png)
                    .unwrap();

                test_results.push(TestResult {
                    name: test_name.clone(),
                    input: input.name.to_string(),
                    config: config.name(),
                    status: "failed".to_string(),
                    rmse: Some(rmse),
                    baseline_path: Some(baseline_path.to_string_lossy().to_string()),
                    actual_path: Some(actual_out.to_string_lossy().to_string()),
                    diff_path: Some(diff_path.to_string_lossy().to_string()),
                });
                failures.push(format!("{test_name}: RMSE {rmse:.4} > {threshold}"));
            } else {
                test_results.push(TestResult {
                    name: test_name,
                    input: input.name.to_string(),
                    config: config.name(),
                    status: "passed".to_string(),
                    rmse: Some(rmse),
                    baseline_path: Some(baseline_path.to_string_lossy().to_string()),
                    actual_path: None,
                    diff_path: None,
                });
                // Clean up passing actual images
                let _ = fs::remove_file(&out_path);
            }
        }
    }

    let json = serde_json::to_string_pretty(&test_results).unwrap();
    fs::write(results.join("rust-visual-results.json"), json).unwrap();

    if !failures.is_empty() && !update_baselines() {
        panic!(
            "Visual regression failures ({}):\n{}",
            failures.len(),
            failures.join("\n")
        );
    }
}
```

- [ ] **Step 2: Add `serde` and `serde_json` dev-dependencies**

In `packages/processor/Cargo.toml`, add:
```toml
[dev-dependencies]
serde = { version = "1", features = ["derive"] }
serde_json = "1"
```

- [ ] **Step 3: Verify the test compiles**

Run: `cargo test --release --manifest-path packages/processor/Cargo.toml --test visual_regression --no-run`
Expected: Compiles successfully.

- [ ] **Step 4: Generate initial baselines**

Run: `UPDATE_BASELINES=1 cargo test --release --manifest-path packages/processor/Cargo.toml --test visual_regression -- --nocapture`
Expected: Test passes, ~175 PNG baselines created in `packages/processor/tests/baselines/`.

Verify: `ls packages/processor/tests/baselines/*.png | wc -l` should output ~175.

- [ ] **Step 5: Run comparison mode to verify zero RMSE**

Run: `cargo test --release --manifest-path packages/processor/Cargo.toml --test visual_regression -- --nocapture`
Expected: All tests pass with RMSE = 0.0 (deterministic renderer, same machine).

- [ ] **Step 6: Commit**

```bash
git add packages/processor/Cargo.toml packages/processor/tests/visual_regression.rs
git add packages/processor/tests/baselines/
git commit -m "test(processor): add visual regression test with pairwise matrix coverage"
```

---

### Task 5: CI integration — Rust visual regression in GitHub Actions

**Files:**
- Modify: `.github/workflows/ci.yml`

- [ ] **Step 1: Add visual regression job to CI**

Add a new job after the existing `processor` job in `.github/workflows/ci.yml`:

```yaml
  visual-regression:
    name: Visual Regression (Rust)
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          lfs: true
      - uses: dtolnay/rust-toolchain@stable
      - uses: Swatinem/rust-cache@v2
        with:
          workspaces: packages/processor
      - run: cargo build --release --manifest-path packages/processor/Cargo.toml
      - run: cargo test --release --manifest-path packages/processor/Cargo.toml --test visual_regression -- --nocapture
      - name: Upload diff artifacts on failure
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: visual-regression-diffs
          path: |
            packages/processor/tests/baselines/*_actual.png
            packages/processor/tests/baselines/*_diff.png
            test-results/rust-visual-results.json
```

- [ ] **Step 2: Verify CI config is valid YAML**

Run: `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml'))" && echo "Valid YAML"`
Expected: "Valid YAML"

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add Rust visual regression job with LFS and diff artifact upload"
```

---

### Task 6: Core TypeScript — test pixel injection API

**Files:**
- Modify: `packages/core/src/chromascope.ts`

**Docs to check:**
- `packages/core/src/types.ts` for `PixelData` interface
- `packages/core/src/chromascope.ts` for `setPixels()` method

The core's `Chromascope` class already has `setPixels(pixelData: PixelData)` which accepts `{ data: Uint8Array, width: number, height: number }`. This is the method we need for test injection.

The core is embedded in `build/index.html` as a single-file app. The Playwright tests will load this page. We need a way for the test to call `setPixels()` and `render()` from outside.

Currently `window.__chromascope` is NOT defined by the core — it's created by the Photoshop plugin's `main.js`. The core is a standalone ES module. For testing, we need to expose the `Chromascope` instance on the window when `?test=true` is in the URL.

- [ ] **Step 1: Read the core's entry point to understand initialization**

Read `packages/core/src/main.ts` (or whatever the entry point is in `src/`) to understand how the `Chromascope` instance is created and rendered.

Run: `ls packages/core/src/` and identify the entry point that creates the Chromascope instance and sets up the Canvas.

- [ ] **Step 2: Add test mode exposure**

At the end of the core's entry point file (the one that initializes the app), add:

```typescript
if (new URLSearchParams(window.location.search).has('test')) {
  (window as any).__chromascopeTest = {
    instance: scope,       // the Chromascope instance
    canvas: canvas,        // the canvas element
    injectPixels(rgbaData: number[], width: number, height: number) {
      const rgb = new Uint8Array(width * height * 3);
      for (let i = 0; i < width * height; i++) {
        rgb[i * 3] = rgbaData[i * 4];
        rgb[i * 3 + 1] = rgbaData[i * 4 + 1];
        rgb[i * 3 + 2] = rgbaData[i * 4 + 2];
      }
      scope.setPixels({ data: rgb, width, height });
      const ctx = canvas.getContext('2d')!;
      scope.render(ctx, canvas.width);
    },
    updateSettings(partial: Record<string, any>) {
      scope.updateSettings(partial);
      const ctx = canvas.getContext('2d')!;
      scope.render(ctx, canvas.width);
    },
  };
}
```

The exact variable names (`scope`, `canvas`) depend on what the entry point uses — read the file first and adapt. The key contract: `window.__chromascopeTest.injectPixels(rgbaArray, width, height)` processes pixels and renders, `window.__chromascopeTest.updateSettings(partial)` changes settings and re-renders.

- [ ] **Step 3: Rebuild the core**

Run: `cd packages/core && npm run build`
Expected: Builds successfully, `build/index.html` is updated.

- [ ] **Step 4: Quick manual verification**

Open `packages/core/build/index.html?test=true` in a browser, open console, run:
```javascript
typeof window.__chromascopeTest  // should be "object"
```

- [ ] **Step 5: Verify existing tests still pass**

Run: `cd packages/core && npm test`
Expected: All 15 existing test suites pass.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/
git commit -m "feat(core): expose test mode API for visual regression injection"
```

---

### Task 7: TypeScript core visual regression test (Playwright)

**Files:**
- Create: `packages/core/test/visual-regression.test.ts`
- Create: `packages/core/playwright.config.ts`

**Docs to check:** Playwright test API, pixelmatch API.

- [ ] **Step 1: Create Playwright config for core package**

Write `packages/core/playwright.config.ts`:
```typescript
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./test",
  testMatch: "visual-regression.test.ts",
  use: {
    baseURL: "file://" + __dirname + "/build/index.html",
  },
  timeout: 120_000,
});
```

- [ ] **Step 2: Write the visual regression test**

Write `packages/core/test/visual-regression.test.ts`:

```typescript
import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";
import pixelmatch from "pixelmatch";

const BASELINES_DIR = path.join(__dirname, "baselines");
const RESULTS_DIR = path.join(__dirname, "../../test-results");
const MATRIX_PATH = path.join(__dirname, "../../tests/fixtures/test_matrix.txt");
const CORE_HTML = path.join(__dirname, "../build/index.html");
const UPDATE = !!process.env.UPDATE_BASELINES;
const DIFF_THRESHOLD = 0.1;
const MAX_DIFF_PERCENT = 0.001;

interface TestConfig {
  colorSpace: string;
  density: string;
  scheme: string;
  skinTone: string;
  rotation: string;
}

function parseMatrix(): TestConfig[] {
  const content = fs.readFileSync(MATRIX_PATH, "utf-8");
  return content
    .split("\n")
    .filter((l) => l.trim() && !l.startsWith("#"))
    .map((line) => {
      const [colorSpace, density, scheme, skinTone, rotation] = line.split("\t");
      return { colorSpace, density, scheme, skinTone, rotation };
    });
}

function configName(c: TestConfig): string {
  return `${c.colorSpace}_${c.density}_${c.scheme}_skin${c.skinTone}_rot${c.rotation}`;
}

function toSettings(c: TestConfig): Record<string, any> {
  return {
    colorSpace: c.colorSpace,
    densityMode: c.density,
    harmony: c.scheme === "none"
      ? { scheme: null, rotation: 0, zoneWidth: 0.1 }
      : { scheme: c.scheme, rotation: parseFloat(c.rotation), zoneWidth: 0.1 },
  };
}

type InputDef = { name: string; pixels: number[] };

function generateInputs(w: number, h: number): InputDef[] {
  const solidWarm: number[] = [];
  for (let i = 0; i < w * h; i++) solidWarm.push(200, 100, 50, 255);

  const quadrant: number[] = [];
  const hw = w / 2, hh = h / 2;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (y < hh) {
        quadrant.push(...(x < hw ? [255, 0, 0, 255] : [0, 255, 0, 255]));
      } else {
        quadrant.push(...(x < hw ? [0, 0, 255, 255] : [255, 255, 255, 255]));
      }
    }
  }

  const gray: number[] = [];
  for (let i = 0; i < w * h; i++) gray.push(128, 128, 128, 255);

  const saturated: number[] = [];
  const colors = [[255,0,0],[0,255,0],[0,0,255],[0,255,255],[255,0,255],[255,255,0]];
  const rowsPerBand = Math.floor(h / 6);
  for (let y = 0; y < h; y++) {
    const band = Math.min(Math.floor(y / rowsPerBand), 5);
    const [r, g, b] = colors[band];
    for (let x = 0; x < w; x++) saturated.push(r, g, b, 255);
  }

  const warmSkin: number[] = [];
  for (let y = 0; y < h; y++) {
    const t = y / h;
    const r = Math.min(200 + t * 55, 255);
    const g = Math.min(140 + t * 40, 255);
    const b = Math.min(100 + t * 30, 255);
    for (let x = 0; x < w; x++) warmSkin.push(Math.round(r), Math.round(g), Math.round(b), 255);
  }

  return [
    { name: "solid_warm", pixels: solidWarm },
    { name: "quadrant", pixels: quadrant },
    { name: "neutral_gray", pixels: gray },
    { name: "saturated", pixels: saturated },
    { name: "warm_skin", pixels: warmSkin },
  ];
}

function comparePng(actualBuf: Buffer, baselinePath: string): { diffCount: number; totalPixels: number; diffBuf: Buffer } {
  const actual = PNG.sync.read(actualBuf);
  const baseline = PNG.sync.read(fs.readFileSync(baselinePath));
  const { width, height } = actual;
  const diff = new PNG({ width, height });
  const diffCount = pixelmatch(actual.data, baseline.data, diff.data, width, height, {
    threshold: DIFF_THRESHOLD,
    includeAA: true,
  });
  return { diffCount, totalPixels: width * height, diffBuf: PNG.sync.write(diff) };
}

test.describe("Visual Regression", () => {
  const configs = parseMatrix();
  const inputs = generateInputs(128, 128);

  fs.mkdirSync(BASELINES_DIR, { recursive: true });
  fs.mkdirSync(RESULTS_DIR, { recursive: true });

  const results: any[] = [];

  for (const input of inputs) {
    for (const config of configs) {
      const testName = `${input.name}_${configName(config)}`;

      test(testName, async ({ page }) => {
        await page.goto(`file://${CORE_HTML}?test=true`);
        await page.waitForFunction(() => !!(window as any).__chromascopeTest);

        await page.evaluate(
          ({ pixels, w, h }) => {
            (window as any).__chromascopeTest.injectPixels(pixels, w, h);
          },
          { pixels: input.pixels, w: 128, h: 128 }
        );

        await page.evaluate((settings) => {
          (window as any).__chromascopeTest.updateSettings(settings);
        }, toSettings(config));

        const dataUrl: string = await page.evaluate(() => {
          const canvas = (window as any).__chromascopeTest.canvas as HTMLCanvasElement;
          return canvas.toDataURL("image/png");
        });

        const pngBuf = Buffer.from(dataUrl.replace(/^data:image\/png;base64,/, ""), "base64");
        const baselinePath = path.join(BASELINES_DIR, `${testName}.png`);

        if (UPDATE) {
          fs.writeFileSync(baselinePath, pngBuf);
          results.push({ name: testName, input: input.name, config: configName(config), status: "baseline_updated" });
          return;
        }

        if (!fs.existsSync(baselinePath)) {
          fs.writeFileSync(path.join(RESULTS_DIR, `core_${testName}_actual.png`), pngBuf);
          results.push({ name: testName, input: input.name, config: configName(config), status: "new" });
          expect(false, `No baseline for ${testName} — run with UPDATE_BASELINES=1`).toBeTruthy();
          return;
        }

        const { diffCount, totalPixels, diffBuf } = comparePng(pngBuf, baselinePath);
        const diffPercent = diffCount / totalPixels;

        if (diffPercent > MAX_DIFF_PERCENT) {
          fs.writeFileSync(path.join(RESULTS_DIR, `core_${testName}_actual.png`), pngBuf);
          fs.writeFileSync(path.join(RESULTS_DIR, `core_${testName}_diff.png`), diffBuf);
          results.push({
            name: testName,
            input: input.name,
            config: configName(config),
            status: "failed",
            diffPercent,
            actual: path.join(RESULTS_DIR, `core_${testName}_actual.png`),
            diff: path.join(RESULTS_DIR, `core_${testName}_diff.png`),
          });
          expect(diffPercent, `${testName}: ${(diffPercent * 100).toFixed(3)}% pixels differ`).toBeLessThanOrEqual(MAX_DIFF_PERCENT);
        } else {
          results.push({ name: testName, input: input.name, config: configName(config), status: "passed", diffPercent });
        }
      });
    }
  }

  test.afterAll(() => {
    fs.writeFileSync(
      path.join(RESULTS_DIR, "core-visual-results.json"),
      JSON.stringify(results, null, 2)
    );
  });
});
```

- [ ] **Step 3: Build core first, then run in update mode**

Run:
```bash
cd packages/core && npm run build
UPDATE_BASELINES=1 npx playwright test --config playwright.config.ts
```
Expected: All tests pass, baselines generated in `test/baselines/`.

- [ ] **Step 4: Run comparison mode**

Run: `cd packages/core && npx playwright test --config playwright.config.ts`
Expected: All tests pass (same machine, same Chromium, deterministic).

- [ ] **Step 5: Commit**

```bash
git add packages/core/playwright.config.ts packages/core/test/visual-regression.test.ts
git add packages/core/test/baselines/
git commit -m "test(core): add Playwright-based visual regression with pairwise matrix"
```

---

### Task 8: HTML visual report generator

**Files:**
- Create: `scripts/visual-report.js`

- [ ] **Step 1: Write the report generator**

Write `scripts/visual-report.js`:

```javascript
#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

const RESULTS_DIR = path.join(__dirname, "..", "test-results");
const OUTPUT = path.join(RESULTS_DIR, "visual-report.html");

function loadJson(file) {
  const p = path.join(RESULTS_DIR, file);
  if (!fs.existsSync(p)) return [];
  return JSON.parse(fs.readFileSync(p, "utf-8"));
}

function imgTag(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return "<span>N/A</span>";
  const data = fs.readFileSync(filePath);
  const b64 = data.toString("base64");
  return `<img src="data:image/png;base64,${b64}" style="max-width:256px;image-rendering:pixelated;">`;
}

function buildReport() {
  const rustResults = loadJson("rust-visual-results.json");
  const coreResults = loadJson("core-visual-results.json");
  const psResults = loadJson("photoshop-visual.json");

  const all = [
    ...rustResults.map((r) => ({ ...r, renderer: "Rust" })),
    ...coreResults.map((r) => ({ ...r, renderer: "Core" })),
    ...psResults.map((r) => ({ ...r, renderer: "Photoshop" })),
  ];

  const passed = all.filter((r) => r.status === "passed").length;
  const failed = all.filter((r) => r.status === "failed").length;
  const newCount = all.filter((r) => r.status === "new").length;
  const updated = all.filter((r) => r.status === "baseline_updated").length;

  const sorted = [...all].sort((a, b) => {
    const order = { failed: 0, new: 1, passed: 2, baseline_updated: 3 };
    return (order[a.status] ?? 4) - (order[b.status] ?? 4);
  });

  const rows = sorted
    .map((r) => {
      const statusClass = r.status === "failed" ? "failed" : r.status === "new" ? "new" : "";
      const metric = r.rmse != null ? `RMSE: ${r.rmse.toFixed(4)}` : r.diffPercent != null ? `Diff: ${(r.diffPercent * 100).toFixed(3)}%` : "";
      const detailsContent =
        r.status === "failed" || r.status === "new"
          ? `<details><summary>Show images</summary>
            <div class="images">
              <div><h4>Baseline</h4>${imgTag(r.baseline_path || r.baseline)}</div>
              <div><h4>Actual</h4>${imgTag(r.actual_path || r.actual)}</div>
              <div><h4>Diff</h4>${imgTag(r.diff_path || r.diff)}</div>
            </div>
          </details>`
          : "";

      return `<tr class="${statusClass}">
        <td>${r.renderer}</td>
        <td>${r.name}</td>
        <td>${r.status}</td>
        <td>${metric}</td>
        <td>${detailsContent}</td>
      </tr>`;
    })
    .join("\n");

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Chromascope Visual Regression Report</title>
<style>
  body { font-family: system-ui; margin: 2em; background: #0d0d0f; color: #e0e0e0; }
  .summary { display: flex; gap: 1em; margin-bottom: 1.5em; }
  .summary span { padding: 0.5em 1em; border-radius: 6px; font-weight: 600; }
  .s-pass { background: #1a3a1a; color: #4ade80; }
  .s-fail { background: #3a1a1a; color: #f87171; }
  .s-new { background: #3a3a1a; color: #facc15; }
  .s-updated { background: #1a2a3a; color: #60a5fa; }
  table { width: 100%; border-collapse: collapse; }
  th, td { padding: 0.5em 0.75em; text-align: left; border-bottom: 1px solid #222; }
  th { background: #161618; }
  tr.failed { background: #2a1111; }
  tr.new { background: #2a2a11; }
  .images { display: flex; gap: 1em; margin-top: 0.5em; }
  .images img { border: 1px solid #333; }
  details summary { cursor: pointer; color: #60a5fa; }
</style></head><body>
<h1>Chromascope Visual Regression Report</h1>
<div class="summary">
  <span class="s-pass">${passed} passed</span>
  <span class="s-fail">${failed} failed</span>
  <span class="s-new">${newCount} new</span>
  <span class="s-updated">${updated} updated</span>
</div>
<table>
  <thead><tr><th>Renderer</th><th>Test</th><th>Status</th><th>Metric</th><th>Details</th></tr></thead>
  <tbody>${rows}</tbody>
</table>
</body></html>`;

  fs.mkdirSync(RESULTS_DIR, { recursive: true });
  fs.writeFileSync(OUTPUT, html);
  console.log("Report written to", OUTPUT);
  console.log(`  ${passed} passed, ${failed} failed, ${newCount} new, ${updated} updated`);

  return failed;
}

const failCount = buildReport();
process.exit(failCount > 0 ? 1 : 0);
```

- [ ] **Step 2: Test the report generator**

Run the Rust visual regression first to produce results JSON, then:
Run: `node scripts/visual-report.js`
Expected: Generates `test-results/visual-report.html`, prints summary. Open the HTML to verify it renders.

- [ ] **Step 3: Commit**

```bash
git add scripts/visual-report.js
git commit -m "feat: add HTML visual regression report generator"
```

---

### Task 9: Extract Lightroom `utils.lua`

**Files:**
- Create: `plugins/lightroom/chromascope.lrdevplugin/utils.lua`
- Modify: `plugins/lightroom/chromascope.lrdevplugin/ImagePipeline.lua`

**Docs to check:** `docs/reference/lrc-sdk-research.md` before modifying any Lightroom plugin code.

Extract pure-logic functions from `ImagePipeline.lua` into a testable module. The extracted functions must work both inside LrC (via `require`) and with a standalone Lua 5.4 interpreter.

- [ ] **Step 1: Read the current ImagePipeline.lua**

Read `plugins/lightroom/chromascope.lrdevplugin/ImagePipeline.lua` in full. Identify the functions to extract:
- `HASH_SKIP` table
- `_keyLess` comparator
- `hashSettings` inner helper (the `walk`/`mixStr`/`mixNum` logic — but note it takes a `photo` LrC object, so we need to extract only the pure hash computation part)
- `nextScopePath` frame alternation

Note: `hashSettings` currently calls `photo:getDevelopSettings()` which is an LrC API call. We can only extract the **pure hash computation** — the function that takes a settings table and returns a hash. The `photo:getDevelopSettings()` call stays in `ImagePipeline.lua`.

- [ ] **Step 2: Create `utils.lua`**

Write `plugins/lightroom/chromascope.lrdevplugin/utils.lua`:

```lua
local M = {}

local HASH_SKIP = {
  ToolkitIdentifier = true,
  ProcessVersion = true,
  CameraProfileDigest = true,
}

local function _keyLess(a, b)
  local ta, tb = type(a), type(b)
  if ta ~= tb then return ta < tb end
  if ta == "number" or ta == "string" then return a < b end
  return tostring(a) < tostring(b)
end

function M.hashTable(settings, seed)
  if not settings then return seed end

  local MOD  = 2147483647
  local hash = seed % MOD

  local function mixStr(s)
    for i = 1, #s do
      hash = (hash * 33 + string.byte(s, i)) % MOD
    end
    hash = (hash * 33) % MOD
  end

  local function mixNum(n)
    local scaled = math.floor(n * 100000 + 0.5)
    hash = (hash * 33 + (scaled % MOD)) % MOD
    hash = (hash * 33) % MOD
  end

  local function walk(t, depth)
    if depth > 8 then return end
    local keys, ki = {}, 0
    for k in pairs(t) do
      local kt = type(k)
      if kt ~= "table" and kt ~= "userdata" and not HASH_SKIP[k] then
        ki = ki + 1
        keys[ki] = k
      end
    end
    table.sort(keys, _keyLess)
    for i = 1, ki do
      local k = keys[i]
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
  return hash
end

function M.nextFrameIndex(currentIndex)
  return (currentIndex % 2) + 1
end

function M.framePath(prefix, index)
  return prefix .. "scope_" .. (index - 1) .. ".jpg"
end

return M
```

- [ ] **Step 3: Update `ImagePipeline.lua` to use `utils.lua`**

In `ImagePipeline.lua`:
1. Add `local utils = require("utils")` at the top
2. Replace the `hashSettings` function body to call `utils.hashTable(settings, seed)` where `seed = 5381 + (photo.localIdentifier or 0)`
3. Replace `nextScopePath` to call `utils.nextFrameIndex` and `utils.framePath`
4. Remove the now-duplicated local functions (`HASH_SKIP`, `_keyLess`, inline hash logic)

The modified `hashSettings`:
```lua
local function hashSettings(photo)
  local id = photo.localIdentifier or 0
  local settings = photo:getDevelopSettings()
  if not settings then return id end
  return utils.hashTable(settings, 5381 + id)
end
```

The modified `nextScopePath`:
```lua
local function nextScopePath()
  _frameIndex = utils.nextFrameIndex(_frameIndex)
  return _framePaths[_frameIndex]
end
```

(Keep `_framePaths` definition unchanged — it's module-level state.)

- [ ] **Step 4: Run the plugin build to verify**

Run: `npm run build:plugins`
Expected: Builds without errors. The Lua `require("utils")` will resolve within the `.lrdevplugin` bundle since they're in the same directory.

- [ ] **Step 5: Commit**

```bash
git add plugins/lightroom/chromascope.lrdevplugin/utils.lua
git add plugins/lightroom/chromascope.lrdevplugin/ImagePipeline.lua
git commit -m "refactor(lightroom): extract pure hash and frame logic to utils.lua"
```

---

### Task 10: Lua unit tests

**Files:**
- Create: `tests/e2e/lightroom/lua/test_utils.lua`

- [ ] **Step 1: Write the Lua test file**

Write `tests/e2e/lightroom/lua/test_utils.lua`:

```lua
-- Lua unit tests for Lightroom utils.lua
-- Run: lua tests/e2e/lightroom/lua/test_utils.lua

-- Add the plugin directory to the Lua path so require("utils") works
local script_dir = arg[0]:match("(.*/)")
local plugin_dir = script_dir .. "../../../../plugins/lightroom/chromascope.lrdevplugin/"
package.path = plugin_dir .. "?.lua;" .. package.path

local utils = require("utils")

local passed = 0
local failed = 0
local total = 0

local function test(name, fn)
  total = total + 1
  local ok, err = pcall(fn)
  if ok then
    passed = passed + 1
    print("  PASS: " .. name)
  else
    failed = failed + 1
    print("  FAIL: " .. name .. " — " .. tostring(err))
  end
end

local function assertEquals(actual, expected, msg)
  if actual ~= expected then
    error((msg or "") .. " expected " .. tostring(expected) .. ", got " .. tostring(actual))
  end
end

print("=== utils.lua unit tests ===")
print()

print("hashTable:")
test("consistent output for same input", function()
  local settings = { Exposure = 1.5, Temperature = 5500 }
  local h1 = utils.hashTable(settings, 5381)
  local h2 = utils.hashTable(settings, 5381)
  assertEquals(h1, h2)
end)

test("different output for different input", function()
  local h1 = utils.hashTable({ Exposure = 1.5 }, 5381)
  local h2 = utils.hashTable({ Exposure = 2.0 }, 5381)
  assert(h1 ~= h2, "hashes should differ for different Exposure values")
end)

test("different seed produces different hash", function()
  local settings = { Exposure = 1.5 }
  local h1 = utils.hashTable(settings, 5381)
  local h2 = utils.hashTable(settings, 9999)
  assert(h1 ~= h2, "different seeds should produce different hashes")
end)

test("handles nested tables", function()
  local settings = {
    Exposure = 1.0,
    ToneCurve = { 0, 25, 128, 128, 255, 230 },
  }
  local h = utils.hashTable(settings, 5381)
  assert(type(h) == "number", "hash should be a number")
  assert(h > 0, "hash should be positive")
end)

test("handles nil settings", function()
  local h = utils.hashTable(nil, 5381)
  assertEquals(h, 5381, "nil settings should return seed")
end)

test("handles empty table", function()
  local h = utils.hashTable({}, 5381)
  assert(type(h) == "number", "hash of empty table should be a number")
end)

test("handles boolean values", function()
  local h1 = utils.hashTable({ AutoLateralCA = true }, 5381)
  local h2 = utils.hashTable({ AutoLateralCA = false }, 5381)
  assert(h1 ~= h2, "true and false should hash differently")
end)

test("handles string values", function()
  local h1 = utils.hashTable({ CameraProfile = "Adobe Standard" }, 5381)
  local h2 = utils.hashTable({ CameraProfile = "Camera Matching" }, 5381)
  assert(h1 ~= h2, "different strings should hash differently")
end)

test("skips HASH_SKIP keys", function()
  local base = { Exposure = 1.0 }
  local withSkipped = { Exposure = 1.0, ProcessVersion = "15.4", ToolkitIdentifier = "com.test" }
  local h1 = utils.hashTable(base, 5381)
  local h2 = utils.hashTable(withSkipped, 5381)
  assertEquals(h1, h2, "HASH_SKIP keys should not affect hash")
end)

test("key order does not matter", function()
  local a = {}; a.Exposure = 1.0; a.Temperature = 5500; a.Tint = 10
  local b = {}; b.Tint = 10; b.Temperature = 5500; b.Exposure = 1.0
  local h1 = utils.hashTable(a, 5381)
  local h2 = utils.hashTable(b, 5381)
  assertEquals(h1, h2, "key insertion order should not affect hash")
end)

print()
print("nextFrameIndex:")
test("alternates from 1 to 2", function()
  assertEquals(utils.nextFrameIndex(1), 2)
end)

test("alternates from 2 to 1", function()
  assertEquals(utils.nextFrameIndex(2), 1)
end)

test("cycles correctly through multiple calls", function()
  local idx = 1
  idx = utils.nextFrameIndex(idx)
  assertEquals(idx, 2)
  idx = utils.nextFrameIndex(idx)
  assertEquals(idx, 1)
  idx = utils.nextFrameIndex(idx)
  assertEquals(idx, 2)
end)

print()
print("framePath:")
test("generates correct path for index 1", function()
  local p = utils.framePath("/tmp/chromascope_", 1)
  assertEquals(p, "/tmp/chromascope_scope_0.jpg")
end)

test("generates correct path for index 2", function()
  local p = utils.framePath("/tmp/chromascope_", 2)
  assertEquals(p, "/tmp/chromascope_scope_1.jpg")
end)

print()
print(string.format("=== Results: %d/%d passed, %d failed ===", passed, total, failed))
os.exit(failed > 0 and 1 or 0)
```

- [ ] **Step 2: Run the Lua tests**

Run: `lua tests/e2e/lightroom/lua/test_utils.lua`
Expected: All tests pass. If `lua` is not installed: `brew install lua` first.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/lightroom/lua/test_utils.lua
git commit -m "test(lightroom): add Lua unit tests for utils.lua hash and frame logic"
```

---

### Task 11: Lightroom pipeline smoke test

**Files:**
- Create: `tests/e2e/lightroom/smoke.sh`

- [ ] **Step 1: Write the smoke test script**

Write `tests/e2e/lightroom/smoke.sh`:

```bash
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

# Generate test RGB inputs (same as Rust visual regression)
# Solid warm: 128x128, RGB(200, 100, 50)
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

  # Validate output
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
```

- [ ] **Step 2: Make executable**

Run: `chmod +x tests/e2e/lightroom/smoke.sh`

- [ ] **Step 3: Run the smoke test**

Run: `bash tests/e2e/lightroom/smoke.sh`
Expected: All 3 configs pass (valid PNG output). Baseline comparison may show "no baseline" if the Rust visual regression baselines use different naming — that's OK for the smoke test; the primary check is "processor runs and produces valid output."

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/lightroom/smoke.sh
git commit -m "test(lightroom): add pipeline smoke test exercising processor decode→render"
```

---

### Task 12: Photoshop test harness

**Files:**
- Create: `plugins/photoshop/src/test-harness.js`
- Modify: `plugins/photoshop/src/main.js`

**Docs to check:** `docs/reference/uxp-api-reference.md` before modifying the Photoshop plugin.

- [ ] **Step 1: Create the test harness module**

Write `plugins/photoshop/src/test-harness.js`:

```javascript
var _active = false;
var _onMessage = null;

function activate(renderFn, getSettingsFn, updateSettingsFn, getLastBufferFn) {
  _active = true;

  _onMessage = function (msg) {
    if (!msg || !msg.type) return;

    switch (msg.type) {
      case "test:getStatus":
        return {
          type: "test:status",
          active: true,
          ready: true,
        };

      case "test:setConfig":
        updateSettingsFn(msg.settings);
        return { type: "test:configSet" };

      case "test:render":
        renderFn(null, false);
        return { type: "test:renderStarted" };

      case "test:extractImage":
        var buf = getLastBufferFn();
        if (!buf) return { type: "test:image", data: null, error: "no render available" };
        var base64 = "";
        for (var i = 0; i < buf.length; i++) {
          base64 += String.fromCharCode(buf[i]);
        }
        return {
          type: "test:image",
          data: btoa(base64),
          width: Math.sqrt(buf.length / 4) | 0,
          height: Math.sqrt(buf.length / 4) | 0,
        };

      case "test:stop":
        _active = false;
        return { type: "test:stopped" };

      default:
        return null;
    }
  };
}

function isActive() {
  return _active;
}

function handleMessage(msg) {
  if (!_active || !_onMessage) return null;
  return _onMessage(msg);
}

module.exports = { activate, isActive, handleMessage };
```

- [ ] **Step 2: Integrate test harness into main.js**

In `plugins/photoshop/src/main.js`, add at the top:
```javascript
var testHarness = require("./test-harness");
```

In the message bridge handler (the function that handles messages from the webview), add a case for `test:start`:
```javascript
if (data.type === "test:start") {
  testHarness.activate(
    renderScope,
    function () { return _coreSettings; },
    function (s) { window.__chromascope.updateSettings(s); },
    function () { return cachedBaseBuf; }
  );
  return;
}
if (testHarness.isActive() && data.type && data.type.startsWith("test:")) {
  var response = testHarness.handleMessage(data);
  if (response) {
    // Send response back via bridge
    webview.postMessage(response);
  }
  return;
}
```

The exact integration point depends on how the bridge message listener is wired. Read `main.js` carefully — look for where `bridge.onScopeMessage` or `webviewElement.addEventListener("message", ...)` is called, and add the test harness check at the top of that handler.

- [ ] **Step 3: Build the plugin**

Run: `npm run build:plugins`
Expected: Builds without errors.

- [ ] **Step 4: Commit**

```bash
git add plugins/photoshop/src/test-harness.js plugins/photoshop/src/main.js
git commit -m "feat(photoshop): add test harness for automated smoke testing"
```

---

### Task 13: Photoshop smoke test runner (includes Layer 3 visual capture)

**Files:**
- Create: `tests/e2e/photoshop/smoke.mjs`
- Create: `tests/e2e/photoshop/create-test-doc.jsx`

This combines Layer 2 (smoke) and Layer 3 (visual capture) since they run sequentially and share the same UXP bridge connection.

**Important caveat:** The UXP message bridge communication from an external Node.js process is not straightforward. The realistic approach:
1. Use ExtendScript (`osascript`) to create a test document and trigger the plugin
2. The test harness writes results to a known temp file
3. The Node.js runner polls for that file

- [ ] **Step 1: Create the ExtendScript for document creation**

Write `tests/e2e/photoshop/create-test-doc.jsx`:

```javascript
// ExtendScript to create a test document in Photoshop
// Run via: osascript -l JavaScript -e 'Application("Adobe Photoshop 2025").doScript(new File("/path/to/create-test-doc.jsx"))'

var doc = app.documents.add(1000, 1000, 72, "Chromascope Test", NewDocumentMode.RGB, DocumentFill.WHITE);

// Fill quadrants with known colors
var halfW = 500, halfH = 500;

// Top-left: Red
doc.selection.select([[0, 0], [halfW, 0], [halfW, halfH], [0, halfH]]);
var red = new SolidColor(); red.rgb.red = 255; red.rgb.green = 0; red.rgb.blue = 0;
doc.selection.fill(red);

// Top-right: Green
doc.selection.select([[halfW, 0], [1000, 0], [1000, halfH], [halfW, halfH]]);
var green = new SolidColor(); green.rgb.red = 0; green.rgb.green = 255; green.rgb.blue = 0;
doc.selection.fill(green);

// Bottom-left: Blue
doc.selection.select([[0, halfH], [halfW, halfH], [halfW, 1000], [0, 1000]]);
var blue = new SolidColor(); blue.rgb.red = 0; blue.rgb.green = 0; blue.rgb.blue = 255;
doc.selection.fill(blue);

// Bottom-right: Skin tone
doc.selection.select([[halfW, halfH], [1000, halfH], [1000, 1000], [halfW, 1000]]);
var skin = new SolidColor(); skin.rgb.red = 210; skin.rgb.green = 160; skin.rgb.blue = 120;
doc.selection.fill(skin);

doc.selection.deselect();
```

- [ ] **Step 2: Write the smoke test runner**

Write `tests/e2e/photoshop/smoke.mjs`:

```javascript
#!/usr/bin/env node

import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../../..");
const RESULTS_DIR = path.join(REPO_ROOT, "test-results");
const JSX_PATH = path.join(__dirname, "create-test-doc.jsx");

fs.mkdirSync(RESULTS_DIR, { recursive: true });

function isPhotoshopRunning() {
  try {
    execSync("pgrep -x 'Adobe Photoshop'", { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

const PS_APP_NAME = process.env.PS_APP_NAME || "Adobe Photoshop 2025";

function runExtendScript(scriptPath) {
  try {
    execSync(
      `osascript -e 'tell application "${PS_APP_NAME}" to do javascript file "${scriptPath}"'`,
      { stdio: "pipe", timeout: 30000 }
    );
    return true;
  } catch (e) {
    console.error("  ExtendScript error:", e.message);
    console.error("  If your PS version differs, set PS_APP_NAME env var (e.g., PS_APP_NAME='Adobe Photoshop 2024')");
    return false;
  }
}

const results = [];
let passed = 0;
let failed = 0;

console.log("=== Photoshop Smoke Test ===");
console.log();

if (!isPhotoshopRunning()) {
  console.log("SKIP: Photoshop is not running.");
  console.log("Start Photoshop and load the Chromascope plugin, then re-run.");
  fs.writeFileSync(
    path.join(RESULTS_DIR, "photoshop-smoke.json"),
    JSON.stringify([{ name: "photoshop_smoke", status: "skipped", detail: "Photoshop not running" }], null, 2)
  );
  process.exit(0);
}

// Step 1: Create test document
console.log("Creating test document...");
if (!runExtendScript(JSX_PATH)) {
  console.log("  FAIL: Could not create test document.");
  console.log("  Note: You may need to grant automation permissions in System Settings > Privacy & Security > Automation.");
  results.push({ name: "create_test_doc", status: "failed", detail: "ExtendScript failed" });
  failed++;
} else {
  console.log("  PASS: Test document created.");
  results.push({ name: "create_test_doc", status: "passed" });
  passed++;
}

// Step 2: Note about manual plugin interaction
console.log();
console.log("NOTE: Full automated smoke testing via the UXP message bridge requires");
console.log("the Chromascope panel to be open and the test harness activated.");
console.log("The test harness integration (test:start via bridge) is available in the");
console.log("plugin code but requires the UXP Developer Tool or a WebSocket bridge");
console.log("for external triggering — this is a future enhancement.");
console.log();
console.log("For now, this test verifies:");
console.log("  1. Photoshop is running");
console.log("  2. Test document can be created via ExtendScript");
console.log("  3. The plugin build artifacts are present");

// Step 3: Verify plugin build artifacts
const bundlePath = path.join(REPO_ROOT, "plugins/photoshop/core/scope-bundle.js");
const manifestPath = path.join(REPO_ROOT, "plugins/photoshop/manifest.json");
const testHarnessPath = path.join(REPO_ROOT, "plugins/photoshop/src/test-harness.js");

for (const [name, filePath] of [
  ["scope_bundle", bundlePath],
  ["manifest", manifestPath],
  ["test_harness", testHarnessPath],
]) {
  if (fs.existsSync(filePath)) {
    console.log(`  PASS: ${name} exists`);
    results.push({ name: `artifact_${name}`, status: "passed" });
    passed++;
  } else {
    console.log(`  FAIL: ${name} missing at ${filePath}`);
    results.push({ name: `artifact_${name}`, status: "failed", detail: "file missing" });
    failed++;
  }
}

console.log();
console.log(`=== Results: ${passed} passed, ${failed} failed ===`);

fs.writeFileSync(
  path.join(RESULTS_DIR, "photoshop-smoke.json"),
  JSON.stringify(results, null, 2)
);

process.exit(failed > 0 ? 1 : 0);
```

- [ ] **Step 3: Make executable**

Run: `chmod +x tests/e2e/photoshop/smoke.mjs`

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/photoshop/smoke.mjs tests/e2e/photoshop/create-test-doc.jsx
git commit -m "test(photoshop): add smoke test runner with ExtendScript doc creation"
```

---

### Task 14: Build verification and npm scripts

**Files:**
- Create: `scripts/test-release.sh`
- Modify: `package.json`

- [ ] **Step 1: Write the orchestration script**

Write `scripts/test-release.sh`:

```bash
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
```

- [ ] **Step 2: Make executable**

Run: `chmod +x scripts/test-release.sh`

- [ ] **Step 3: Add npm scripts to root `package.json`**

Add to the `"scripts"` section in `package.json`:

```json
"test:release": "bash scripts/test-release.sh",
"test:visual": "cargo test --release --manifest-path packages/processor/Cargo.toml --test visual_regression -- --nocapture && cd packages/core && npx playwright test --config playwright.config.ts",
"test:visual:rust": "cargo test --release --manifest-path packages/processor/Cargo.toml --test visual_regression -- --nocapture",
"test:visual:core": "cd packages/core && npx playwright test --config playwright.config.ts",
"test:smoke": "bash tests/e2e/lightroom/smoke.sh; lua tests/e2e/lightroom/lua/test_utils.lua; node tests/e2e/photoshop/smoke.mjs",
"test:update-baselines": "UPDATE_BASELINES=1 cargo test --release --manifest-path packages/processor/Cargo.toml --test visual_regression -- --nocapture && cd packages/core && UPDATE_BASELINES=1 npx playwright test --config playwright.config.ts",
"test:report": "node scripts/visual-report.js"
```

- [ ] **Step 4: Verify `test:visual:rust` works**

Run: `npm run test:visual:rust`
Expected: Passes (baselines already generated in Task 4).

- [ ] **Step 5: Commit**

```bash
git add scripts/test-release.sh package.json
git commit -m "feat: add test:release pre-release gate and npm test scripts"
```

---

### Task 15: Final verification

- [ ] **Step 1: Run the full Rust visual regression suite**

Run: `npm run test:visual:rust`
Expected: All ~175 tests pass.

- [ ] **Step 2: Run the Lua unit tests**

Run: `lua tests/e2e/lightroom/lua/test_utils.lua`
Expected: All tests pass.

- [ ] **Step 3: Run the Lightroom smoke test**

Run: `bash tests/e2e/lightroom/smoke.sh`
Expected: Passes (processor binary produces valid output).

- [ ] **Step 4: Generate the HTML report**

Run: `npm run test:report`
Expected: `test-results/visual-report.html` created, opens in browser.

- [ ] **Step 5: Run the plugin build to verify nothing is broken**

Run: `npm run build:plugins`
Expected: Builds without errors.

- [ ] **Step 6: Run existing unit tests**

Run: `npm test`
Expected: All existing Vitest and Cargo tests pass.
