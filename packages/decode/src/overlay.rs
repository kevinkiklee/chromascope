use image::{Rgb, RgbImage};
use std::f64::consts::PI;
use std::path::Path;

const TWO_PI: f64 = 2.0 * PI;
const BASE_HALF_WIDTH: f64 = PI / 12.0; // 15 degrees
const LINE_COLOR: Rgb<u8> = Rgb([255, 255, 255]);
const DASH_COLOR: Rgb<u8> = Rgb([180, 180, 180]);
const BG: Rgb<u8> = Rgb([0, 0, 0]);

struct Zone {
    center_angle: f64,
    half_width: f64,
}

fn normalize_angle(a: f64) -> f64 {
    ((a % TWO_PI) + TWO_PI) % TWO_PI
}

fn scheme_base_angles(scheme: &str) -> Vec<f64> {
    match scheme {
        "complementary" => vec![0.0, PI],
        "splitComplementary" => vec![0.0, PI - PI / 6.0, PI + PI / 6.0],
        "triadic" => vec![0.0, TWO_PI / 3.0, 2.0 * TWO_PI / 3.0],
        "tetradic" => vec![0.0, PI / 2.0, PI, 3.0 * PI / 2.0],
        "analogous" => vec![0.0, PI / 6.0, -PI / 6.0],
        _ => vec![],
    }
}

fn get_zones(scheme: &str, rotation_deg: f64) -> Vec<Zone> {
    let rotation = rotation_deg.to_radians();
    scheme_base_angles(scheme)
        .into_iter()
        .map(|angle| Zone {
            center_angle: normalize_angle(angle + rotation),
            half_width: BASE_HALF_WIDTH,
        })
        .collect()
}

fn draw_line(img: &mut RgbImage, center: f64, radius: f64, angle: f64, color: Rgb<u8>) {
    let size = img.width();
    let steps = (radius * 2.0) as u32;
    for step in 0..steps {
        let t = step as f64 / steps as f64;
        let r = radius * t;
        let px = (center + r * angle.cos()) as u32;
        let py = (center + r * angle.sin()) as u32;
        if px < size && py < size {
            img.put_pixel(px, py, color);
        }
    }
}

fn draw_dashed_line(img: &mut RgbImage, center: f64, radius: f64, angle: f64, color: Rgb<u8>) {
    let size = img.width();
    let steps = (radius * 2.0) as u32;
    for step in 0..steps {
        if (step / 4) % 2 != 0 {
            continue;
        }
        let t = step as f64 / steps as f64;
        let r = radius * t;
        let px = (center + r * angle.cos()) as u32;
        let py = (center + r * angle.sin()) as u32;
        if px < size && py < size {
            img.put_pixel(px, py, color);
        }
    }
}

/// Render a single overlay image: white lines on black background.
pub fn render_overlay(scheme: &str, rotation_deg: f64, size: u32) -> RgbImage {
    let mut img = RgbImage::from_pixel(size, size, BG);
    let center = size as f64 / 2.0;
    let radius = center * 0.9;

    let zones = get_zones(scheme, rotation_deg);
    for zone in &zones {
        let start = -(zone.center_angle + zone.half_width);
        let end = -(zone.center_angle - zone.half_width);
        let mid = -(zone.center_angle);

        draw_line(&mut img, center, radius, start, LINE_COLOR);
        draw_line(&mut img, center, radius, end, LINE_COLOR);
        draw_dashed_line(&mut img, center, radius * 0.9, mid, DASH_COLOR);
    }

    img
}

/// Max-blend two images: final[px] = max(base[px], overlay[px]) per channel.
pub fn composite(base: &RgbImage, overlay: &RgbImage) -> RgbImage {
    let (w, h) = base.dimensions();
    let mut out = RgbImage::new(w, h);
    for y in 0..h {
        for x in 0..w {
            let bp = base.get_pixel(x, y);
            let op = overlay.get_pixel(x, y);
            out.put_pixel(x, y, Rgb([
                bp[0].max(op[0]),
                bp[1].max(op[1]),
                bp[2].max(op[2]),
            ]));
        }
    }
    out
}

pub const SCHEMES: &[&str] = &[
    "complementary",
    "splitComplementary",
    "triadic",
    "tetradic",
    "analogous",
];

/// Generate all overlay images for all schemes and rotations.
pub fn generate_all(output_dir: &Path, size: u32) -> anyhow::Result<usize> {
    let mut count = 0;
    for scheme in SCHEMES {
        let scheme_dir = output_dir.join(scheme);
        std::fs::create_dir_all(&scheme_dir)?;
        for deg in 0..360 {
            let img = render_overlay(scheme, deg as f64, size);
            let path = scheme_dir.join(format!("{:03}.jpg", deg));
            img.save(&path)?;
            count += 1;
        }
    }
    Ok(count)
}
