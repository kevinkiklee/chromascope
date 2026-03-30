use image::{Rgb, RgbImage};
use std::f64::consts::PI;

const TWO_PI: f64 = 2.0 * PI;

const BG: Rgb<u8> = Rgb([9, 9, 11]);
const GRID: Rgb<u8> = Rgb([30, 30, 35]);
const SKIN_TONE: Rgb<u8> = Rgb([180, 120, 60]);
const SKIN_TONE_ANGLE: f64 = 123.0 * PI / 180.0;
const ZONE_LINE: Rgb<u8> = Rgb([200, 200, 200]);
const ZONE_CENTER_LINE: Rgb<u8> = Rgb([140, 140, 140]);
const BASE_HALF_WIDTH: f64 = PI / 12.0; // 15 degrees

pub struct HarmonyConfig {
    pub scheme: String,
    pub rotation_deg: f64,
}

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

fn get_zones(config: &HarmonyConfig) -> Vec<Zone> {
    let rotation = config.rotation_deg.to_radians();
    scheme_base_angles(&config.scheme)
        .into_iter()
        .map(|angle| Zone {
            center_angle: normalize_angle(angle + rotation),
            half_width: BASE_HALF_WIDTH,
        })
        .collect()
}

pub fn render_vectorscope(
    rgb_data: &[u8],
    width: u32,
    height: u32,
    size: u32,
    harmony: Option<&HarmonyConfig>,
) -> RgbImage {
    let mut img = RgbImage::from_pixel(size, size, BG);
    let center = size as f64 / 2.0;
    let radius = center * 0.9;

    // Harmony zones (behind graticule and data)
    if let Some(config) = harmony {
        let zones = get_zones(config);
        draw_harmony_zones(&mut img, &zones, center, radius, size);
    }

    draw_graticule(&mut img, center, radius, size);
    draw_skin_tone_line(&mut img, center, radius);

    // Plot pixels
    let total = (width * height) as usize;
    for i in 0..total {
        let off = i * 3;
        let r = rgb_data[off] as f64;
        let g = rgb_data[off + 1] as f64;
        let b = rgb_data[off + 2] as f64;

        let cb = -0.168736 * r - 0.331264 * g + 0.500000 * b;
        let cr =  0.500000 * r - 0.418688 * g - 0.081312 * b;

        let norm_cb = cb / 128.0;
        let norm_cr = cr / 128.0;

        let dist = (norm_cb * norm_cb + norm_cr * norm_cr).sqrt();
        if dist > 1.0 {
            continue;
        }

        let px = center + norm_cb * radius;
        let py = center - norm_cr * radius;

        let x = px as u32;
        let y = py as u32;

        if x < size && y < size {
            let dot_r = (r * 0.6 + 40.0).min(255.0) as u8;
            let dot_g = (g * 0.6 + 40.0).min(255.0) as u8;
            let dot_b = (b * 0.6 + 40.0).min(255.0) as u8;
            blend_pixel(&mut img, x, y, Rgb([dot_r, dot_g, dot_b]), 0.8);
        }
    }

    img
}

fn draw_harmony_zones(
    img: &mut RgbImage,
    zones: &[Zone],
    center: f64,
    radius: f64,
    size: u32,
) {
    for zone in zones {
        let start = -(zone.center_angle + zone.half_width);
        let end = -(zone.center_angle - zone.half_width);
        let mid = -(zone.center_angle);

        // Solid edge lines
        draw_line(img, center, radius, start, size, ZONE_LINE, 0.7);
        draw_line(img, center, radius, end, size, ZONE_LINE, 0.7);

        // Dashed center line
        draw_dashed_line(img, center, radius * 0.9, mid, size, ZONE_CENTER_LINE, 0.5);
    }
}

fn draw_line(img: &mut RgbImage, center: f64, radius: f64, angle: f64, size: u32, color: Rgb<u8>, alpha: f64) {
    let steps = (radius * 2.0) as u32;
    for step in 0..steps {
        let t = step as f64 / steps as f64;
        let r = radius * t;
        let px = (center + r * angle.cos()) as u32;
        let py = (center + r * angle.sin()) as u32;
        if px < size && py < size {
            blend_pixel(img, px, py, color, alpha);
        }
    }
}

fn draw_dashed_line(img: &mut RgbImage, center: f64, radius: f64, angle: f64, size: u32, color: Rgb<u8>, alpha: f64) {
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
            blend_pixel(img, px, py, color, alpha);
        }
    }
}

fn draw_graticule(img: &mut RgbImage, center: f64, radius: f64, size: u32) {
    for ring in &[0.25, 0.5, 0.75, 1.0] {
        let r = radius * ring;
        let circumference = (2.0 * PI * r) as u32;
        let steps = circumference.max(360);
        for step in 0..steps {
            let angle = 2.0 * PI * (step as f64) / (steps as f64);
            let px = (center + r * angle.cos()) as u32;
            let py = (center + r * angle.sin()) as u32;
            if px < size && py < size {
                img.put_pixel(px, py, GRID);
            }
        }
    }

    for i in 0..size {
        let c = center as u32;
        blend_pixel(img, i, c, GRID, 0.5);
        blend_pixel(img, c, i, GRID, 0.5);
    }
}

fn draw_skin_tone_line(img: &mut RgbImage, center: f64, radius: f64) {
    let steps = (radius * 1.5) as u32;
    for step in 0..steps {
        let t = step as f64 / steps as f64;
        let r = radius * t;
        let px = (center + r * SKIN_TONE_ANGLE.cos()) as u32;
        let py = (center - r * SKIN_TONE_ANGLE.sin()) as u32;
        let size = img.width();
        if px < size && py < size {
            let alpha = 0.7 * (1.0 - t * 0.4);
            blend_pixel(img, px, py, SKIN_TONE, alpha);
        }
    }
}

fn blend_pixel(img: &mut RgbImage, x: u32, y: u32, color: Rgb<u8>, alpha: f64) {
    let existing = img.get_pixel(x, y);
    let blend = |old: u8, new: u8| -> u8 {
        ((old as f64) * (1.0 - alpha) + (new as f64) * alpha).round() as u8
    };
    img.put_pixel(x, y, Rgb([
        blend(existing[0], color[0]),
        blend(existing[1], color[1]),
        blend(existing[2], color[2]),
    ]));
}
