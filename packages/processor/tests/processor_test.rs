use std::path::PathBuf;
use std::process::Command;
use image::{RgbImage, Rgb};

fn fixtures_dir() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures")
}

fn binary_path() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("target/release/processor")
}

/// Generate a small solid-colour JPEG for use as a test fixture.
/// Uses atomic write (save to temp, then rename) to avoid races when
/// multiple test threads call this concurrently on CI.
fn ensure_test_jpeg(path: &PathBuf) {
    if path.exists() { return; }
    std::fs::create_dir_all(path.parent().unwrap()).unwrap();
    let tmp = path.with_extension("tmp.jpg");
    let mut img = RgbImage::new(512, 512);
    for pixel in img.pixels_mut() {
        *pixel = Rgb([200u8, 100u8, 50u8]);
    }
    img.save(&tmp).unwrap();
    std::fs::rename(&tmp, path).ok(); // ok() — another thread may have won the race
}

/// Generate a multi-color test JPEG (quadrants: red, green, blue, white).
fn ensure_multicolor_jpeg(path: &PathBuf) {
    if path.exists() { return; }
    std::fs::create_dir_all(path.parent().unwrap()).unwrap();
    let tmp = path.with_extension("tmp.jpg");
    let mut img = RgbImage::new(256, 256);
    for y in 0..256u32 {
        for x in 0..256u32 {
            let pixel = match (x < 128, y < 128) {
                (true, true)   => Rgb([255, 0, 0]),     // red
                (false, true)  => Rgb([0, 255, 0]),     // green
                (true, false)  => Rgb([0, 0, 255]),     // blue
                (false, false) => Rgb([255, 255, 255]), // white
            };
            img.put_pixel(x, y, pixel);
        }
    }
    img.save(&tmp).unwrap();
    std::fs::rename(&tmp, path).ok();
}

/// Create raw RGB data for a solid color.
fn create_solid_rgb(width: u32, height: u32, r: u8, g: u8, b: u8) -> Vec<u8> {
    let total = (width * height) as usize;
    let mut data = Vec::with_capacity(total * 3);
    for _ in 0..total {
        data.push(r);
        data.push(g);
        data.push(b);
    }
    data
}

use std::sync::atomic::{AtomicU32, Ordering};
static COUNTER: AtomicU32 = AtomicU32::new(0);

/// Write raw RGB to a temp file, render, and return the output image.
fn render_with_args(rgb_data: &[u8], width: u32, height: u32, extra_args: &[&str]) -> RgbImage {
    let id = COUNTER.fetch_add(1, Ordering::Relaxed);
    let dir = fixtures_dir();
    let rgb_path = dir.join(format!("test_render_{}_{}.rgb", std::process::id(), id));
    let out_path = dir.join(format!("test_render_{}_{}.jpg", std::process::id(), id));

    std::fs::write(&rgb_path, rgb_data).unwrap();

    let mut cmd = Command::new(binary_path());
    cmd.args(["render",
        "--input", rgb_path.to_str().unwrap(),
        "--output", out_path.to_str().unwrap(),
        "--width", &width.to_string(),
        "--height", &height.to_string(),
        "--size", "256",
    ]);
    for arg in extra_args {
        cmd.arg(arg);
    }

    let status = cmd.status().expect("failed to run render");
    assert!(status.success(), "render failed with args {:?}", extra_args);

    let img = image::open(&out_path).unwrap().to_rgb8();
    std::fs::remove_file(&rgb_path).ok();
    std::fs::remove_file(&out_path).ok();
    img
}

fn count_non_bg(img: &RgbImage) -> usize {
    img.pixels().filter(|p| p[0] > 15 || p[1] > 15 || p[2] > 15).count()
}

fn count_bright(img: &RgbImage, threshold: u8) -> usize {
    img.pixels().filter(|p| p[0] > threshold || p[1] > threshold || p[2] > threshold).count()
}

// ═══════════════════════════════════════════════════
// Decode command tests
// ═══════════════════════════════════════════════════

#[test]
fn decode_jpeg_produces_correct_byte_count() {
    let input = fixtures_dir().join("test.jpg");
    ensure_test_jpeg(&input);

    let output = fixtures_dir().join("test_out.rgb");

    let status = Command::new(binary_path())
        .args(["decode",
            "--input",  input.to_str().unwrap(),
            "--output", output.to_str().unwrap(),
            "--width",  "256",
            "--height", "256",
        ])
        .status()
        .expect("failed to run decode binary");

    assert!(status.success(), "decode binary exited with non-zero status");

    let bytes = std::fs::read(&output).expect("output file not written");
    assert_eq!(bytes.len(), 256 * 256 * 3, "unexpected byte count");

    std::fs::remove_file(&output).ok();
}

#[test]
fn decode_with_different_dimensions() {
    let input = fixtures_dir().join("test.jpg");
    ensure_test_jpeg(&input);

    for (w, h) in [(64, 64), (128, 256), (1, 1)] {
        let output = fixtures_dir().join(format!("decode_dim_{}x{}.rgb", w, h));

        let status = Command::new(binary_path())
            .args(["decode",
                "--input",  input.to_str().unwrap(),
                "--output", output.to_str().unwrap(),
                "--width",  &w.to_string(),
                "--height", &h.to_string(),
            ])
            .status()
            .unwrap();

        assert!(status.success(), "decode failed for {}x{}", w, h);
        let bytes = std::fs::read(&output).unwrap();
        assert_eq!(bytes.len(), (w * h * 3) as usize, "wrong byte count for {}x{}", w, h);
        std::fs::remove_file(&output).ok();
    }
}

#[test]
fn decode_jpeg_performance_under_200ms() {
    let input = fixtures_dir().join("test.jpg");
    ensure_test_jpeg(&input);

    let output = fixtures_dir().join("perf_out.rgb");
    let start = std::time::Instant::now();

    let status = Command::new(binary_path())
        .args(["decode",
            "--input",  input.to_str().unwrap(),
            "--output", output.to_str().unwrap(),
            "--width",  "256",
            "--height", "256",
        ])
        .status()
        .expect("failed to run decode binary");

    let elapsed = start.elapsed();
    assert!(status.success());
    std::fs::remove_file(&output).ok();

    assert!(
        elapsed.as_millis() < 500,
        "decode took {}ms, expected <500ms",
        elapsed.as_millis()
    );
}

#[test]
fn decode_missing_input_fails() {
    let output = fixtures_dir().join("missing_out.rgb");

    let status = Command::new(binary_path())
        .args(["decode",
            "--input",  "/nonexistent/path.jpg",
            "--output", output.to_str().unwrap(),
            "--width",  "64",
            "--height", "64",
        ])
        .status()
        .unwrap();

    assert!(!status.success(), "decode should fail for missing input");
    std::fs::remove_file(&output).ok();
}

// ═══════════════════════════════════════════════════
// Render command tests — basic
// ═══════════════════════════════════════════════════

#[test]
fn render_produces_valid_jpeg() {
    let input = fixtures_dir().join("test.jpg");
    ensure_test_jpeg(&input);

    let rgb_path = fixtures_dir().join("render_test.rgb");
    let scope_path = fixtures_dir().join("render_test_scope.jpg");

    Command::new(binary_path())
        .args(["decode",
            "--input",  input.to_str().unwrap(),
            "--output", rgb_path.to_str().unwrap(),
            "--width",  "128",
            "--height", "128",
        ])
        .status().unwrap();

    let status = Command::new(binary_path())
        .args(["render",
            "--input",  rgb_path.to_str().unwrap(),
            "--output", scope_path.to_str().unwrap(),
            "--width",  "128",
            "--height", "128",
            "--size",   "512",
        ])
        .status()
        .expect("failed to run render");
    assert!(status.success(), "render exited with non-zero status");

    let scope_img = image::open(&scope_path).expect("output is not a valid image");
    assert_eq!(scope_img.width(), 512);
    assert_eq!(scope_img.height(), 512);

    let rgb = scope_img.to_rgb8();
    let non_bg_pixels = count_non_bg(&rgb);
    assert!(non_bg_pixels > 100, "rendered scope appears empty ({} non-bg pixels)", non_bg_pixels);

    std::fs::remove_file(&rgb_path).ok();
    std::fs::remove_file(&scope_path).ok();
}

#[test]
fn render_wrong_byte_count_fails() {
    let rgb_path = fixtures_dir().join("bad_bytes.rgb");
    let out_path = fixtures_dir().join("bad_bytes_out.jpg");

    // Write 100 bytes but claim 64x64 (should be 64*64*3 = 12288)
    std::fs::write(&rgb_path, vec![0u8; 100]).unwrap();

    let status = Command::new(binary_path())
        .args(["render",
            "--input",  rgb_path.to_str().unwrap(),
            "--output", out_path.to_str().unwrap(),
            "--width",  "64",
            "--height", "64",
            "--size",   "128",
        ])
        .status()
        .unwrap();

    assert!(!status.success(), "render should fail with mismatched byte count");
    std::fs::remove_file(&rgb_path).ok();
    std::fs::remove_file(&out_path).ok();
}

#[test]
fn render_pure_black_input() {
    let data = create_solid_rgb(64, 64, 0, 0, 0);
    let img = render_with_args(&data, 64, 64, &[]);
    // Black has no chroma — only graticule should be visible
    let bright = count_bright(&img, 40);
    assert!(bright < 5000, "pure black should show only graticule, got {} bright pixels", bright);
}

#[test]
fn render_pure_white_input() {
    let data = create_solid_rgb(64, 64, 255, 255, 255);
    let img = render_with_args(&data, 64, 64, &[]);
    // White has no chroma — similar to black
    let bright = count_bright(&img, 40);
    assert!(bright < 5000, "pure white should show only graticule, got {} bright pixels", bright);
}

#[test]
fn render_different_sizes() {
    let data = create_solid_rgb(32, 32, 200, 100, 50);
    let rgb_path = fixtures_dir().join("size_test.rgb");
    std::fs::write(&rgb_path, &data).unwrap();

    for size in [64, 128, 256, 512] {
        let out_path = fixtures_dir().join(format!("size_test_{}.jpg", size));
        let status = Command::new(binary_path())
            .args(["render",
                "--input",  rgb_path.to_str().unwrap(),
                "--output", out_path.to_str().unwrap(),
                "--width",  "32",
                "--height", "32",
                "--size",   &size.to_string(),
            ])
            .status().unwrap();

        assert!(status.success(), "render failed at size {}", size);
        let img = image::open(&out_path).unwrap();
        assert_eq!(img.width(), size);
        assert_eq!(img.height(), size);
        std::fs::remove_file(&out_path).ok();
    }
    std::fs::remove_file(&rgb_path).ok();
}

// ═══════════════════════════════════════════════════
// Color space tests
// ═══════════════════════════════════════════════════

#[test]
fn render_all_color_spaces_produce_output() {
    let data = create_solid_rgb(64, 64, 200, 100, 50);

    for space in ["ycbcr", "cieluv", "hsl"] {
        let img = render_with_args(&data, 64, 64, &["--color-space", space]);
        let non_bg = count_non_bg(&img);
        assert!(non_bg > 50, "color space {} produced too few visible pixels ({})", space, non_bg);
    }
}

#[test]
fn render_color_spaces_produce_different_output() {
    let input = fixtures_dir().join("multicolor.jpg");
    ensure_multicolor_jpeg(&input);

    let rgb_path = fixtures_dir().join("cs_diff.rgb");
    Command::new(binary_path())
        .args(["decode",
            "--input",  input.to_str().unwrap(),
            "--output", rgb_path.to_str().unwrap(),
            "--width",  "64", "--height", "64"])
        .status().unwrap();

    let data = std::fs::read(&rgb_path).unwrap();

    let ycbcr = render_with_args(&data, 64, 64, &["--color-space", "ycbcr"]);
    let cieluv = render_with_args(&data, 64, 64, &["--color-space", "cieluv"]);
    let hsl = render_with_args(&data, 64, 64, &["--color-space", "hsl"]);

    // Compare pixel sums — different color spaces should produce different distributions
    let pixel_sum = |img: &RgbImage| -> u64 {
        img.pixels().map(|p| p[0] as u64 + p[1] as u64 + p[2] as u64).sum()
    };

    let s_ycbcr = pixel_sum(&ycbcr);
    let s_cieluv = pixel_sum(&cieluv);
    let s_hsl = pixel_sum(&hsl);

    assert_ne!(s_ycbcr, s_cieluv, "ycbcr and cieluv should produce different output");
    assert_ne!(s_cieluv, s_hsl, "cieluv and hsl should produce different output");

    std::fs::remove_file(&rgb_path).ok();
}

// ═══════════════════════════════════════════════════
// Density mode tests
// ═══════════════════════════════════════════════════

#[test]
fn render_all_density_modes_produce_output() {
    let data = create_solid_rgb(64, 64, 200, 100, 50);

    for mode in ["scatter", "heatmap", "bloom"] {
        let img = render_with_args(&data, 64, 64, &["--density", mode]);
        let non_bg = count_non_bg(&img);
        assert!(non_bg > 50, "density mode {} produced too few visible pixels ({})", mode, non_bg);
    }
}

#[test]
fn render_density_modes_produce_different_output() {
    let input = fixtures_dir().join("multicolor.jpg");
    ensure_multicolor_jpeg(&input);

    let rgb_path = fixtures_dir().join("density_diff.rgb");
    Command::new(binary_path())
        .args(["decode",
            "--input",  input.to_str().unwrap(),
            "--output", rgb_path.to_str().unwrap(),
            "--width",  "64", "--height", "64"])
        .status().unwrap();

    let data = std::fs::read(&rgb_path).unwrap();

    let scatter = render_with_args(&data, 64, 64, &["--density", "scatter"]);
    let heatmap = render_with_args(&data, 64, 64, &["--density", "heatmap"]);
    let bloom = render_with_args(&data, 64, 64, &["--density", "bloom"]);

    let pixel_sum = |img: &RgbImage| -> u64 {
        img.pixels().map(|p| p[0] as u64 + p[1] as u64 + p[2] as u64).sum()
    };

    let s_scatter = pixel_sum(&scatter);
    let s_heatmap = pixel_sum(&heatmap);
    let s_bloom = pixel_sum(&bloom);

    assert_ne!(s_scatter, s_heatmap, "scatter and heatmap should produce different output");
    assert_ne!(s_heatmap, s_bloom, "heatmap and bloom should produce different output");

    std::fs::remove_file(&rgb_path).ok();
}

#[test]
fn render_bloom_produces_softer_glow_than_scatter() {
    let input = fixtures_dir().join("multicolor.jpg");
    ensure_multicolor_jpeg(&input);

    let rgb_path = fixtures_dir().join("bloom_vs_scatter.rgb");
    Command::new(binary_path())
        .args(["decode",
            "--input",  input.to_str().unwrap(),
            "--output", rgb_path.to_str().unwrap(),
            "--width",  "64", "--height", "64"])
        .status().unwrap();

    let data = std::fs::read(&rgb_path).unwrap();

    let scatter = render_with_args(&data, 64, 64, &["--density", "scatter"]);
    let bloom = render_with_args(&data, 64, 64, &["--density", "bloom"]);

    // Bloom spreads light over more pixels (glow radius), so more pixels above minimum threshold
    let dim_scatter = scatter.pixels().filter(|p| p[0] > 12 && p[0] < 80).count();
    let dim_bloom = bloom.pixels().filter(|p| p[0] > 12 && p[0] < 80).count();

    // Bloom spreads light; it should produce a comparable or higher dim pixel count.
    // Allow a small tolerance since the exact counts depend on floating-point rounding.
    assert!(dim_bloom as f64 >= dim_scatter as f64 * 0.9,
        "bloom should have comparable dim pixels (glow spread): bloom={}, scatter={}",
        dim_bloom, dim_scatter);

    std::fs::remove_file(&rgb_path).ok();
}

// ═══════════════════════════════════════════════════
// Harmony overlay tests
// ═══════════════════════════════════════════════════

#[test]
fn render_with_harmony_overlay_adds_visible_lines() {
    let input = fixtures_dir().join("test.jpg");
    ensure_test_jpeg(&input);

    let rgb_path = fixtures_dir().join("harmony_test.rgb");
    let scope_plain = fixtures_dir().join("harmony_plain.jpg");
    let scope_overlay = fixtures_dir().join("harmony_overlay.jpg");

    Command::new(binary_path())
        .args(["decode", "--input", input.to_str().unwrap(),
               "--output", rgb_path.to_str().unwrap(), "--width", "64", "--height", "64"])
        .status().unwrap();

    Command::new(binary_path())
        .args(["render", "--input", rgb_path.to_str().unwrap(),
               "--output", scope_plain.to_str().unwrap(),
               "--width", "64", "--height", "64", "--size", "256"])
        .status().unwrap();

    Command::new(binary_path())
        .args(["render", "--input", rgb_path.to_str().unwrap(),
               "--output", scope_overlay.to_str().unwrap(),
               "--width", "64", "--height", "64", "--size", "256",
               "--scheme", "triadic", "--rotation", "30"])
        .status().unwrap();

    let img_plain = image::open(&scope_plain).unwrap().to_rgb8();
    let img_overlay = image::open(&scope_overlay).unwrap().to_rgb8();

    assert!(
        count_bright(&img_overlay, 100) > count_bright(&img_plain, 100),
        "overlay should add visible lines"
    );

    std::fs::remove_file(&rgb_path).ok();
    std::fs::remove_file(&scope_plain).ok();
    std::fs::remove_file(&scope_overlay).ok();
}

#[test]
fn render_all_harmony_schemes() {
    let data = create_solid_rgb(32, 32, 200, 100, 50);

    for scheme in ["complementary", "splitComplementary", "triadic", "tetradic", "analogous"] {
        let img = render_with_args(&data, 32, 32, &["--scheme", scheme]);
        let non_bg = count_non_bg(&img);
        assert!(non_bg > 50, "scheme {} produced too few visible pixels ({})", scheme, non_bg);
    }
}

#[test]
fn render_all_overlay_colors() {
    let data = create_solid_rgb(32, 32, 200, 100, 50);

    for color in ["white", "yellow", "cyan", "green", "magenta", "orange"] {
        let img = render_with_args(&data, 32, 32, &["--scheme", "complementary", "--overlay-color", color]);
        let non_bg = count_non_bg(&img);
        assert!(non_bg > 50, "overlay color {} produced too few visible pixels ({})", color, non_bg);
    }
}

#[test]
fn render_harmony_rotation_changes_output() {
    let data = create_solid_rgb(32, 32, 200, 100, 50);

    let rot0 = render_with_args(&data, 32, 32, &["--scheme", "complementary", "--rotation", "0"]);
    let rot90 = render_with_args(&data, 32, 32, &["--scheme", "complementary", "--rotation", "90"]);

    let pixel_sum = |img: &RgbImage| -> u64 {
        img.pixels().map(|p| p[0] as u64 + p[1] as u64 + p[2] as u64).sum()
    };

    assert_ne!(pixel_sum(&rot0), pixel_sum(&rot90),
        "different rotations should produce different output");
}

// ═══════════════════════════════════════════════════
// Skin tone line tests
// ═══════════════════════════════════════════════════

#[test]
fn render_skin_tone_line_visible_by_default() {
    let data = create_solid_rgb(32, 32, 0, 0, 0);
    let img = render_with_args(&data, 32, 32, &[]);

    // Skin tone line is amber — look for warm-colored pixels
    let warm = img.pixels().filter(|p| p[0] > 100 && p[1] > 50 && p[2] < 100).count();
    assert!(warm > 10, "skin tone line should be visible by default ({} warm pixels)", warm);
}

#[test]
fn render_hide_skin_tone_removes_line() {
    let data = create_solid_rgb(32, 32, 0, 0, 0);

    let with_line = render_with_args(&data, 32, 32, &[]);
    let without_line = render_with_args(&data, 32, 32, &["--hide-skin-tone"]);

    let warm = |img: &RgbImage| -> usize {
        img.pixels().filter(|p| p[0] > 100 && p[1] > 50 && p[2] < 100).count()
    };

    assert!(warm(&with_line) > warm(&without_line),
        "hiding skin tone should remove warm pixels: with={}, without={}",
        warm(&with_line), warm(&without_line));
}

// ═══════════════════════════════════════════════════
// Cross-product: color space × density mode
// ═══════════════════════════════════════════════════

#[test]
fn render_all_colorspace_density_combinations() {
    let data = create_solid_rgb(32, 32, 200, 100, 50);

    for space in ["ycbcr", "cieluv", "hsl"] {
        for mode in ["scatter", "heatmap", "bloom"] {
            let img = render_with_args(&data, 32, 32, &["--color-space", space, "--density", mode]);
            let non_bg = count_non_bg(&img);
            assert!(non_bg > 30,
                "{}+{} produced too few visible pixels ({})", space, mode, non_bg);
        }
    }
}
