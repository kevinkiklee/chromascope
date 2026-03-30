use image::{Rgb, RgbImage};
use std::f64::consts::PI;

const TWO_PI: f64 = 2.0 * PI;

const BG: Rgb<u8> = Rgb([9, 9, 11]);
const GRID: Rgb<u8> = Rgb([30, 30, 35]);
const LABEL: Rgb<u8> = Rgb([70, 70, 75]);
const SKIN_TONE: Rgb<u8> = Rgb([180, 120, 60]);
const SKIN_TONE_ANGLE: f64 = 123.0 * PI / 180.0;
const ZONE_LINE_WHITE: Rgb<u8> = Rgb([200, 200, 200]);
const ZONE_LINE_YELLOW: Rgb<u8> = Rgb([220, 200, 80]);
const ZONE_LINE_CYAN: Rgb<u8> = Rgb([80, 200, 210]);
const ZONE_LINE_GREEN: Rgb<u8> = Rgb([80, 210, 120]);
const ZONE_LINE_MAGENTA: Rgb<u8> = Rgb([210, 100, 200]);
const ZONE_LINE_ORANGE: Rgb<u8> = Rgb([230, 160, 60]);
const BASE_HALF_WIDTH: f64 = PI / 12.0;

pub struct HarmonyConfig {
    pub scheme: String,
    pub rotation_deg: f64,
    pub overlay_color: String,
}

fn resolve_zone_color(name: &str) -> Rgb<u8> {
    match name {
        "white"   => ZONE_LINE_WHITE,
        "yellow"  => ZONE_LINE_YELLOW,
        "cyan"    => ZONE_LINE_CYAN,
        "green"   => ZONE_LINE_GREEN,
        "magenta" => ZONE_LINE_MAGENTA,
        "orange"  => ZONE_LINE_ORANGE,
        _         => ZONE_LINE_YELLOW,
    }
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
    show_skin_tone: bool,
) -> RgbImage {
    let mut img = RgbImage::from_pixel(size, size, BG);
    let center = size as f64 / 2.0;
    let radius = center * 0.9;

    if let Some(config) = harmony {
        let zones = get_zones(config);
        let color = resolve_zone_color(&config.overlay_color);
        draw_harmony_zones(&mut img, &zones, center, radius, size, color);
    }

    draw_graticule(&mut img, center, radius, size);
    draw_degree_markers(&mut img, center, radius, size);

    if show_skin_tone {
        draw_skin_tone_line(&mut img, center, radius);
    }

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
            let dot_r = (r * 0.8 + 80.0).min(255.0) as u8;
            let dot_g = (g * 0.8 + 80.0).min(255.0) as u8;
            let dot_b = (b * 0.8 + 80.0).min(255.0) as u8;
            blend_pixel(&mut img, x, y, Rgb([dot_r, dot_g, dot_b]), 0.9);
        }
    }

    img
}

/// Draw harmony zone edges with connecting arcs along the outer rim.
fn draw_harmony_zones(
    img: &mut RgbImage,
    zones: &[Zone],
    center: f64,
    radius: f64,
    size: u32,
    color: Rgb<u8>,
) {
    for zone in zones {
        let start = -(zone.center_angle + zone.half_width);
        let end = -(zone.center_angle - zone.half_width);

        // Radial edge lines (1px core + soft edges)
        draw_soft_line(img, center, radius, start, size, color, 0.7);
        draw_soft_line(img, center, radius, end, size, color, 0.7);

        // Connecting arc along the outer rim
        draw_arc(img, center, radius, start, end, size, color, 0.7);
    }
}

/// Draw a line from center to rim: 1px core with soft 0.25-alpha edges.
fn draw_soft_line(img: &mut RgbImage, center: f64, radius: f64, angle: f64, size: u32, color: Rgb<u8>, alpha: f64) {
    let steps = (radius * 2.0) as u32;
    let cos_a = angle.cos();
    let sin_a = angle.sin();
    let perp_x = -sin_a;
    let perp_y = cos_a;

    for step in 0..steps {
        let t = step as f64 / steps as f64;
        let r = radius * t;
        let base_x = center + r * cos_a;
        let base_y = center + r * sin_a;

        // Center pixel
        let px = base_x as u32;
        let py = base_y as u32;
        if px < size && py < size {
            blend_pixel(img, px, py, color, alpha);
        }
        // Soft edges
        for offset in &[-1.0_f64, 1.0] {
            let ex = (base_x + perp_x * offset) as u32;
            let ey = (base_y + perp_y * offset) as u32;
            if ex < size && ey < size {
                blend_pixel(img, ex, ey, color, alpha * 0.25);
            }
        }
    }
}

/// Draw an arc between two angles along the outer rim (always takes the short path).
fn draw_arc(img: &mut RgbImage, center: f64, radius: f64, start: f64, end: f64, size: u32, color: Rgb<u8>, alpha: f64) {
    let mut sweep = end - start;
    // Normalize to [-PI, PI] so we always take the short path
    while sweep > PI { sweep -= TWO_PI; }
    while sweep < -PI { sweep += TWO_PI; }

    let circumference = (radius * sweep.abs()) as u32;
    let steps = circumference.max(60);

    for step in 0..=steps {
        let t = step as f64 / steps as f64;
        let angle = start + sweep * t;

        // Center pixel
        let px = (center + radius * angle.cos()) as u32;
        let py = (center + radius * angle.sin()) as u32;
        if px < size && py < size {
            blend_pixel(img, px, py, color, alpha);
        }
        // Soft inner/outer edges
        for r_offset in &[-1.0_f64, 1.0] {
            let r = radius + r_offset;
            let ex = (center + r * angle.cos()) as u32;
            let ey = (center + r * angle.sin()) as u32;
            if ex < size && ey < size {
                blend_pixel(img, ex, ey, color, alpha * 0.25);
            }
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

/// Draw degree markers every 30° as small tick marks and labels around the outer rim.
fn draw_degree_markers(img: &mut RgbImage, center: f64, radius: f64, size: u32) {
    // Digit bitmaps (3x5 pixels each)
    let digits: [[[u8; 3]; 5]; 10] = [
        // 0
        [[1,1,1],[1,0,1],[1,0,1],[1,0,1],[1,1,1]],
        // 1
        [[0,1,0],[1,1,0],[0,1,0],[0,1,0],[1,1,1]],
        // 2
        [[1,1,1],[0,0,1],[1,1,1],[1,0,0],[1,1,1]],
        // 3
        [[1,1,1],[0,0,1],[1,1,1],[0,0,1],[1,1,1]],
        // 4
        [[1,0,1],[1,0,1],[1,1,1],[0,0,1],[0,0,1]],
        // 5
        [[1,1,1],[1,0,0],[1,1,1],[0,0,1],[1,1,1]],
        // 6
        [[1,1,1],[1,0,0],[1,1,1],[1,0,1],[1,1,1]],
        // 7
        [[1,1,1],[0,0,1],[0,0,1],[0,0,1],[0,0,1]],
        // 8
        [[1,1,1],[1,0,1],[1,1,1],[1,0,1],[1,1,1]],
        // 9
        [[1,1,1],[1,0,1],[1,1,1],[0,0,1],[1,1,1]],
    ];

    for i in 0..12 {
        let deg = i * 30;
        let angle = (deg as f64).to_radians();

        // Tick mark at the outer rim
        let tick_inner = radius * 0.92;
        let tick_outer = radius * 1.0;
        let steps = ((tick_outer - tick_inner) * 2.0) as u32;
        for step in 0..steps {
            let t = step as f64 / steps as f64;
            let r = tick_inner + (tick_outer - tick_inner) * t;
            // Canvas: 0° is right, clockwise
            let px = (center + r * angle.cos()) as u32;
            let py = (center - r * angle.sin()) as u32;
            if px < size && py < size {
                blend_pixel(img, px, py, LABEL, 0.6);
            }
        }

        // Label position just outside the rim
        let label_r = radius * 1.08;
        let label_cx = center + label_r * angle.cos();
        let label_cy = center - label_r * angle.sin();

        // Render degree number as pixel digits
        let text = format!("{}", deg);
        let char_w = 4; // 3px digit + 1px spacing
        let total_w = text.len() as i32 * char_w - 1;
        let start_x = label_cx as i32 - total_w / 2;
        let start_y = label_cy as i32 - 2; // center vertically (5px tall / 2)

        for (ci, ch) in text.chars().enumerate() {
            let d = (ch as u8 - b'0') as usize;
            if d > 9 { continue; }
            let bitmap = &digits[d];
            for row in 0..5 {
                for col in 0..3 {
                    if bitmap[row][col] == 1 {
                        let px = start_x + ci as i32 * char_w + col as i32;
                        let py = start_y + row as i32;
                        if px >= 0 && py >= 0 && (px as u32) < size && (py as u32) < size {
                            blend_pixel(img, px as u32, py as u32, LABEL, 0.7);
                        }
                    }
                }
            }
        }
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
