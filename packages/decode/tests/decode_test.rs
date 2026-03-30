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
            "--input",  input.to_str().unwrap(),
            "--output", output.to_str().unwrap(),
            "--width",  "256",
            "--height", "256",
        ])
        .status()
        .expect("failed to run decode binary");

    assert!(status.success(), "decode binary exited with non-zero status");

    let bytes = std::fs::read(&output).expect("output file not written");
    // 256 * 256 pixels * 3 bytes (RGB)
    assert_eq!(bytes.len(), 256 * 256 * 3, "unexpected byte count");

    // Clean up
    std::fs::remove_file(&output).ok();
}

#[test]
fn decode_jpeg_performance_under_20ms() {
    let input = fixtures_dir().join("test.jpg");
    ensure_test_jpeg(&input);

    let output = fixtures_dir().join("perf_out.rgb");
    let start = std::time::Instant::now();

    let status = Command::new(binary_path())
        .args([
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
        elapsed.as_millis() < 20,
        "decode took {}ms, expected <20ms",
        elapsed.as_millis()
    );
}
