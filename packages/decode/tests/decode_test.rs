use std::path::PathBuf;
use std::process::Command;
use image::{RgbImage, Rgb};

fn fixtures_dir() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures")
}

fn binary_path() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("target/release/decode")
}

/// Generate a small solid-colour JPEG for use as a test fixture.
fn ensure_test_jpeg(path: &PathBuf) {
    if path.exists() { return; }
    std::fs::create_dir_all(path.parent().unwrap()).unwrap();
    let mut img = RgbImage::new(512, 512);
    for pixel in img.pixels_mut() {
        *pixel = Rgb([200u8, 100u8, 50u8]);
    }
    img.save(path).unwrap();
}

#[test]
fn decode_jpeg_produces_correct_byte_count() {
    let input = fixtures_dir().join("test.jpg");
    ensure_test_jpeg(&input);

    let output = fixtures_dir().join("test_out.rgb");

    let status = Command::new(binary_path())
        .args([
            "decode",
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
fn decode_jpeg_performance_under_200ms() {
    let input = fixtures_dir().join("test.jpg");
    ensure_test_jpeg(&input);

    let output = fixtures_dir().join("perf_out.rgb");
    let start = std::time::Instant::now();

    let status = Command::new(binary_path())
        .args([
            "decode",
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
        elapsed.as_millis() < 200,
        "decode took {}ms, expected <200ms",
        elapsed.as_millis()
    );
}

#[test]
fn render_produces_valid_jpeg() {
    let input = fixtures_dir().join("test.jpg");
    ensure_test_jpeg(&input);

    let rgb_path = fixtures_dir().join("render_test.rgb");
    let scope_path = fixtures_dir().join("render_test_scope.jpg");

    // First decode JPEG to raw RGB
    let status = Command::new(binary_path())
        .args([
            "decode",
            "--input",  input.to_str().unwrap(),
            "--output", rgb_path.to_str().unwrap(),
            "--width",  "128",
            "--height", "128",
        ])
        .status()
        .expect("failed to run decode");
    assert!(status.success());

    // Then render the vectorscope
    let status = Command::new(binary_path())
        .args([
            "render",
            "--input",  rgb_path.to_str().unwrap(),
            "--output", scope_path.to_str().unwrap(),
            "--width",  "128",
            "--height", "128",
            "--size",   "512",
        ])
        .status()
        .expect("failed to run render");
    assert!(status.success(), "render exited with non-zero status");

    // Verify output is a valid JPEG with correct dimensions
    let scope_img = image::open(&scope_path).expect("output is not a valid image");
    assert_eq!(scope_img.width(), 512);
    assert_eq!(scope_img.height(), 512);

    // Verify it's not all black (graticule + pixels should produce non-bg content)
    let rgb = scope_img.to_rgb8();
    let non_bg_pixels = rgb.pixels().filter(|p| p[0] > 15 || p[1] > 15 || p[2] > 15).count();
    assert!(non_bg_pixels > 100, "rendered scope appears empty ({} non-bg pixels)", non_bg_pixels);

    std::fs::remove_file(&rgb_path).ok();
    std::fs::remove_file(&scope_path).ok();
}
