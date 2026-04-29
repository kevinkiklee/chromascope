use image::{RgbImage, Rgb};
use serde::Serialize;
use std::path::PathBuf;
use std::process::Command;

// ═══════════════════════════════════════════════════
// Path helpers
// ═══════════════════════════════════════════════════

fn repo_root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .unwrap()
        .parent()
        .unwrap()
        .to_path_buf()
}

fn binary_path() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("target/release/processor")
}

fn baselines_dir() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("tests/baselines")
}

fn results_dir() -> PathBuf {
    repo_root().join("test-results")
}

fn fixtures_dir() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("tests/fixtures")
}

fn update_baselines() -> bool {
    std::env::var("UPDATE_BASELINES").is_ok()
}

// ═══════════════════════════════════════════════════
// TestConfig
// ═══════════════════════════════════════════════════

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
            args.push("--scheme".to_string());
            args.push(self.scheme.clone());
            args.push("--rotation".to_string());
            args.push(self.rotation.clone());
        }
        if self.skin_tone == "off" {
            args.push("--hide-skin-tone".to_string());
        }
        args
    }
}

// ═══════════════════════════════════════════════════
// Parse test matrix
// ═══════════════════════════════════════════════════

fn parse_test_matrix() -> Vec<TestConfig> {
    let matrix_path = repo_root().join("tests/fixtures/test_matrix.txt");
    let content = std::fs::read_to_string(&matrix_path)
        .unwrap_or_else(|e| panic!("Failed to read test matrix at {:?}: {}", matrix_path, e));

    let mut configs = Vec::new();
    for line in content.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.starts_with('#') {
            continue;
        }
        let cols: Vec<&str> = trimmed.split('\t').collect();
        assert_eq!(
            cols.len(),
            5,
            "Expected 5 tab-separated columns, got {}: {:?}",
            cols.len(),
            trimmed
        );
        configs.push(TestConfig {
            color_space: cols[0].to_string(),
            density: cols[1].to_string(),
            scheme: cols[2].to_string(),
            skin_tone: cols[3].to_string(),
            rotation: cols[4].to_string(),
        });
    }
    configs
}

// ═══════════════════════════════════════════════════
// Input generators
// ═══════════════════════════════════════════════════

fn create_solid_rgb(w: u32, h: u32, r: u8, g: u8, b: u8) -> Vec<u8> {
    let total = (w * h) as usize;
    let mut data = Vec::with_capacity(total * 3);
    for _ in 0..total {
        data.push(r);
        data.push(g);
        data.push(b);
    }
    data
}

fn create_quadrant_rgb(w: u32, h: u32) -> Vec<u8> {
    let mut data = Vec::with_capacity((w * h * 3) as usize);
    for y in 0..h {
        for x in 0..w {
            let (r, g, b) = match (x < w / 2, y < h / 2) {
                (true, true) => (255u8, 0u8, 0u8),   // TL: red
                (false, true) => (0u8, 255u8, 0u8),  // TR: green
                (true, false) => (0u8, 0u8, 255u8),  // BL: blue
                (false, false) => (255u8, 255u8, 255u8), // BR: white
            };
            data.push(r);
            data.push(g);
            data.push(b);
        }
    }
    data
}

fn create_neutral_gray(w: u32, h: u32) -> Vec<u8> {
    create_solid_rgb(w, h, 128, 128, 128)
}

fn create_saturated_primaries(w: u32, h: u32) -> Vec<u8> {
    // 6 horizontal bands: R, G, B, C, M, Y
    let bands: [(u8, u8, u8); 6] = [
        (255, 0, 0),   // Red
        (0, 255, 0),   // Green
        (0, 0, 255),   // Blue
        (0, 255, 255), // Cyan
        (255, 0, 255), // Magenta
        (255, 255, 0), // Yellow
    ];
    let mut data = Vec::with_capacity((w * h * 3) as usize);
    for y in 0..h {
        let band = ((y as usize * 6) / h as usize).min(5);
        let (r, g, b) = bands[band];
        for _ in 0..w {
            data.push(r);
            data.push(g);
            data.push(b);
        }
    }
    data
}

fn create_warm_skin(w: u32, h: u32) -> Vec<u8> {
    // Gradient from (200, 140, 100) to (255, 180, 130)
    let mut data = Vec::with_capacity((w * h * 3) as usize);
    for y in 0..h {
        let t = y as f64 / (h as f64 - 1.0).max(1.0);
        let r = (200.0 + t * (255.0 - 200.0)) as u8;
        let g = (140.0 + t * (180.0 - 140.0)) as u8;
        let b = (100.0 + t * (130.0 - 100.0)) as u8;
        for _ in 0..w {
            data.push(r);
            data.push(g);
            data.push(b);
        }
    }
    data
}

// ═══════════════════════════════════════════════════
// Test input descriptor
// ═══════════════════════════════════════════════════

struct TestInput {
    name: &'static str,
    width: u32,
    height: u32,
    data: Vec<u8>,
}

fn generate_inputs() -> Vec<TestInput> {
    vec![
        TestInput {
            name: "solid_warm",
            width: 128,
            height: 128,
            data: create_solid_rgb(128, 128, 200, 100, 50),
        },
        TestInput {
            name: "quadrant",
            width: 128,
            height: 128,
            data: create_quadrant_rgb(128, 128),
        },
        TestInput {
            name: "neutral_gray",
            width: 128,
            height: 128,
            data: create_neutral_gray(128, 128),
        },
        TestInput {
            name: "saturated",
            width: 128,
            height: 128,
            data: create_saturated_primaries(128, 128),
        },
        TestInput {
            name: "warm_skin",
            width: 128,
            height: 128,
            data: create_warm_skin(128, 128),
        },
    ]
}

// ═══════════════════════════════════════════════════
// RMSE and diff image
// ═══════════════════════════════════════════════════

fn compute_rmse(a: &RgbImage, b: &RgbImage) -> f64 {
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
    for y in 0..h {
        for x in 0..w {
            let pa = a.get_pixel(x, y);
            let pb = b.get_pixel(x, y);
            let pixel = if pa == pb {
                Rgb([255u8, 255u8, 255u8]) // white: match
            } else {
                Rgb([255u8, 0u8, 0u8]) // red: different
            };
            diff.put_pixel(x, y, pixel);
        }
    }
    diff
}

// ═══════════════════════════════════════════════════
// TestResult
// ═══════════════════════════════════════════════════

#[derive(Serialize)]
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

// ═══════════════════════════════════════════════════
// Main visual regression test
// ═══════════════════════════════════════════════════

#[test]
fn visual_regression() {
    let configs = parse_test_matrix();
    let inputs = generate_inputs();

    let baselines = baselines_dir();
    let results = results_dir();
    let fixtures = fixtures_dir();

    std::fs::create_dir_all(&baselines).unwrap();
    std::fs::create_dir_all(&results).unwrap();
    std::fs::create_dir_all(&fixtures).unwrap();

    let threshold = 0.5_f64;
    let mut test_results: Vec<TestResult> = Vec::new();
    let mut failures: Vec<String> = Vec::new();

    // Write all input RGB files using atomic write pattern
    for input in &inputs {
        let rgb_path = fixtures.join(format!("vr_{}.rgb", input.name));
        if !rgb_path.exists() {
            let tmp = fixtures.join(format!("vr_{}.tmp.rgb", input.name));
            std::fs::write(&tmp, &input.data).unwrap();
            std::fs::rename(&tmp, &rgb_path).ok();
        }
    }

    for input in &inputs {
        let rgb_path = fixtures.join(format!("vr_{}.rgb", input.name));

        for config in &configs {
            let case_name = format!("{}_{}", input.name, config.name());
            let baseline_path = baselines.join(format!("{}.png", case_name));
            let actual_path = results.join(format!("{}_actual.png", case_name));
            let diff_path = results.join(format!("{}_diff.png", case_name));

            // Build command
            let mut cmd = Command::new(binary_path());
            cmd.args([
                "render",
                "--input",
                rgb_path.to_str().unwrap(),
                "--output",
                actual_path.to_str().unwrap(),
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
                cmd.arg(&arg);
            }

            let status = cmd
                .status()
                .unwrap_or_else(|e| panic!("Failed to run processor for {}: {}", case_name, e));
            assert!(
                status.success(),
                "Processor render failed for {}: exit code {:?}",
                case_name,
                status.code()
            );

            // Load actual output
            let actual = image::open(&actual_path)
                .unwrap_or_else(|e| panic!("Failed to load actual output for {}: {}", case_name, e))
                .to_rgb8();

            if update_baselines() {
                // Copy actual to baseline
                std::fs::copy(&actual_path, &baseline_path)
                    .unwrap_or_else(|e| panic!("Failed to copy baseline for {}: {}", case_name, e));
                std::fs::remove_file(&actual_path).ok();
                println!("[baseline_updated] {}", case_name);
                test_results.push(TestResult {
                    name: case_name.clone(),
                    input: input.name.to_string(),
                    config: config.name(),
                    status: "baseline_updated".to_string(),
                    rmse: None,
                    baseline_path: Some(baseline_path.to_string_lossy().into_owned()),
                    actual_path: None,
                    diff_path: None,
                });
                continue;
            }

            if !baseline_path.exists() {
                println!("[new] {} — no baseline found", case_name);
                failures.push(format!("{} (no baseline)", case_name));
                test_results.push(TestResult {
                    name: case_name.clone(),
                    input: input.name.to_string(),
                    config: config.name(),
                    status: "new".to_string(),
                    rmse: None,
                    baseline_path: None,
                    actual_path: Some(actual_path.to_string_lossy().into_owned()),
                    diff_path: None,
                });
                continue;
            }

            // Load baseline and compare
            let baseline = image::open(&baseline_path)
                .unwrap_or_else(|e| panic!("Failed to load baseline for {}: {}", case_name, e))
                .to_rgb8();

            let rmse = compute_rmse(&actual, &baseline);

            if rmse > threshold {
                // Write diff image
                let diff_img = create_diff_image(&actual, &baseline);
                diff_img.save(&diff_path).ok();
                println!("[FAILED] {} — RMSE={:.4} (threshold={})", case_name, rmse, threshold);
                failures.push(format!("{} (RMSE={:.4})", case_name, rmse));
                test_results.push(TestResult {
                    name: case_name.clone(),
                    input: input.name.to_string(),
                    config: config.name(),
                    status: "failed".to_string(),
                    rmse: Some(rmse),
                    baseline_path: Some(baseline_path.to_string_lossy().into_owned()),
                    actual_path: Some(actual_path.to_string_lossy().into_owned()),
                    diff_path: Some(diff_path.to_string_lossy().into_owned()),
                });
            } else {
                std::fs::remove_file(&actual_path).ok();
                println!("[passed] {} — RMSE={:.4}", case_name, rmse);
                test_results.push(TestResult {
                    name: case_name.clone(),
                    input: input.name.to_string(),
                    config: config.name(),
                    status: "passed".to_string(),
                    rmse: Some(rmse),
                    baseline_path: Some(baseline_path.to_string_lossy().into_owned()),
                    actual_path: None,
                    diff_path: None,
                });
            }
        }
    }

    // Write results JSON
    let results_json = results.join("rust-visual-results.json");
    let json = serde_json::to_string_pretty(&test_results)
        .unwrap_or_else(|e| panic!("Failed to serialize results: {}", e));
    std::fs::write(&results_json, &json)
        .unwrap_or_else(|e| panic!("Failed to write results JSON: {}", e));
    println!("Results written to {:?}", results_json);

    if !failures.is_empty() && !update_baselines() {
        panic!(
            "{} visual regression failure(s):\n{}",
            failures.len(),
            failures.join("\n")
        );
    }
}
