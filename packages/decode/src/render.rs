use image::{Rgb, RgbImage};
use std::f64::consts::PI;

const TWO_PI: f64 = 2.0 * PI;

const BG: Rgb<u8> = Rgb([9, 9, 11]);
const GRID: Rgb<u8> = Rgb([30, 30, 35]);
const LABEL: Rgb<u8> = Rgb([110, 110, 115]);
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

/// A mapped point in vectorscope space.
struct ScopePoint {
    px: f64,
    py: f64,
    r: u8,
    g: u8,
    b: u8,
}

// ── Color space mapping ──

/// Map a pixel to normalized x,y (-1..1) using YCbCr BT.601.
fn map_ycbcr(r: f64, g: f64, b: f64) -> (f64, f64) {
    let cb = -0.168736 * r - 0.331264 * g + 0.500000 * b;
    let cr =  0.500000 * r - 0.418688 * g - 0.081312 * b;
    // Scale by 1.33x so typical saturation fills to the outer ring
    (cb / 96.0, cr / 96.0)
}

/// sRGB linearization (inverse gamma).
fn linearize(c: f64) -> f64 {
    if c <= 0.04045 { c / 12.92 } else { ((c + 0.055) / 1.055).powf(2.4) }
}

/// Map a pixel to normalized x,y (-1..1) using CIE LUV.
fn map_cieluv(r: f64, g: f64, b: f64) -> (f64, f64) {
    const XN: f64 = 0.95047;
    const YN: f64 = 1.0;
    const ZN: f64 = 1.08883;
    const UN: f64 = (4.0 * XN) / (XN + 15.0 * YN + 3.0 * ZN);
    const VN: f64 = (9.0 * YN) / (XN + 15.0 * YN + 3.0 * ZN);
    const MAX_CHROMA: f64 = 180.0;

    let rl = linearize(r / 255.0);
    let gl = linearize(g / 255.0);
    let bl = linearize(b / 255.0);

    let x_xyz = 0.4124564 * rl + 0.3575761 * gl + 0.1804375 * bl;
    let y_xyz = 0.2126729 * rl + 0.7151522 * gl + 0.0721750 * bl;
    let z_xyz = 0.0193339 * rl + 0.1191920 * gl + 0.9503041 * bl;

    let denom = x_xyz + 15.0 * y_xyz + 3.0 * z_xyz;
    if denom == 0.0 {
        return (0.0, 0.0);
    }

    let u_prime = (4.0 * x_xyz) / denom;
    let v_prime = (9.0 * y_xyz) / denom;

    let yr = y_xyz / YN;
    let l = if yr > 0.008856 { 116.0 * yr.cbrt() - 16.0 } else { 903.3 * yr };

    let u_star = 13.0 * l * (u_prime - UN);
    let v_star = 13.0 * l * (v_prime - VN);

    (u_star / MAX_CHROMA, v_star / MAX_CHROMA)
}

/// Map a pixel to normalized x,y (-1..1) using HSL (hue as angle, saturation as radius).
fn map_hsl(r: f64, g: f64, b: f64) -> (f64, f64) {
    let rn = r / 255.0;
    let gn = g / 255.0;
    let bn = b / 255.0;

    let max = rn.max(gn).max(bn);
    let min = rn.min(gn).min(bn);
    let delta = max - min;

    let l = (max + min) / 2.0;
    if delta == 0.0 {
        return (0.0, 0.0);
    }

    let s = if l <= 0.5 { delta / (max + min) } else { delta / (2.0 - max - min) };

    let hue_seg = if max == rn {
        ((gn - bn) / delta) % 6.0
    } else if max == gn {
        (bn - rn) / delta + 2.0
    } else {
        (rn - gn) / delta + 4.0
    };
    let hue_rad = (hue_seg / 6.0) * TWO_PI;

    let x = s * hue_rad.cos();
    let y = s * hue_rad.sin();
    (x, y)
}

/// Map RGB pixels to vectorscope coordinates using the specified color space.
fn map_pixels(rgb_data: &[u8], width: u32, height: u32, center: f64, radius: f64, color_space: &str) -> Vec<ScopePoint> {
    let total = (width * height) as usize;
    let mut points = Vec::with_capacity(total);

    for i in 0..total {
        let off = i * 3;
        let r = rgb_data[off] as f64;
        let g = rgb_data[off + 1] as f64;
        let b = rgb_data[off + 2] as f64;

        let (nx, ny) = match color_space {
            "cieluv" => map_cieluv(r, g, b),
            "hsl" => map_hsl(r, g, b),
            _ => map_ycbcr(r, g, b),
        };

        let dist = (nx * nx + ny * ny).sqrt();
        if dist > 1.0 {
            continue;
        }

        points.push(ScopePoint {
            px: center + nx * radius,
            py: center - ny * radius,
            r: (r * 0.8 + 80.0).min(255.0) as u8,
            g: (g * 0.8 + 80.0).min(255.0) as u8,
            b: (b * 0.8 + 80.0).min(255.0) as u8,
        });
    }
    points
}

/// Scatter: each point is a single bright pixel with high alpha.
fn render_scatter(img: &mut RgbImage, points: &[ScopePoint], size: u32) {
    for p in points {
        let x = p.px as u32;
        let y = p.py as u32;
        if x < size && y < size {
            blend_pixel(img, x, y, Rgb([p.r, p.g, p.b]), 0.9);
        }
    }
}

/// Bloom: each point stamps a radial glow with additive blending.
fn render_bloom(img: &mut RgbImage, points: &[ScopePoint], size: u32) {
    if points.is_empty() { return; }

    let count = points.len() as f64;
    let glow_radius = (size as f64 / 20.0 * (500.0 / count)).clamp(2.0, 20.0);
    let alpha = (200.0 / count).clamp(0.01, 0.3);
    // Use a floating-point accumulation buffer for additive blending
    let s = size as usize;
    let mut buf_r = vec![0.0f32; s * s];
    let mut buf_g = vec![0.0f32; s * s];
    let mut buf_b = vec![0.0f32; s * s];

    for p in points {
        let cx = p.px;
        let cy = p.py;
        let pr = p.r as f32 * alpha as f32;
        let pg = p.g as f32 * alpha as f32;
        let pb = p.b as f32 * alpha as f32;

        let x_min = ((cx - glow_radius) as i32).max(0);
        let x_max = ((cx + glow_radius) as i32).min(size as i32 - 1);
        let y_min = ((cy - glow_radius) as i32).max(0);
        let y_max = ((cy + glow_radius) as i32).min(size as i32 - 1);

        for iy in y_min..=y_max {
            for ix in x_min..=x_max {
                let dx = ix as f64 - cx;
                let dy = iy as f64 - cy;
                let dist = (dx * dx + dy * dy).sqrt();
                if dist > glow_radius { continue; }

                let falloff = (1.0 - dist / glow_radius) as f32;
                let idx = iy as usize * s + ix as usize;
                buf_r[idx] += pr * falloff;
                buf_g[idx] += pg * falloff;
                buf_b[idx] += pb * falloff;
            }
        }
    }

    // Composite buffer onto image additively
    for y in 0..size {
        for x in 0..size {
            let idx = y as usize * s + x as usize;
            let ar = buf_r[idx];
            let ag = buf_g[idx];
            let ab = buf_b[idx];
            if ar <= 0.0 && ag <= 0.0 && ab <= 0.0 { continue; }

            let existing = img.get_pixel(x, y);
            let nr = (existing[0] as f32 + ar).min(255.0) as u8;
            let ng = (existing[1] as f32 + ag).min(255.0) as u8;
            let nb = (existing[2] as f32 + ab).min(255.0) as u8;
            img.put_pixel(x, y, Rgb([nr, ng, nb]));
        }
    }
}

/// Heatmap: bin points into a grid and color by frequency (cold→hot ramp).
fn render_heatmap(img: &mut RgbImage, points: &[ScopePoint], size: u32) {
    if points.is_empty() { return; }

    let s = size as usize;
    let mut density = vec![0u32; s * s];
    let mut max_density = 0u32;

    for p in points {
        let x = p.px as u32;
        let y = p.py as u32;
        if x < size && y < size {
            let idx = y as usize * s + x as usize;
            density[idx] += 1;
            if density[idx] > max_density {
                max_density = density[idx];
            }
        }
    }

    if max_density == 0 { return; }
    let log_max = (max_density as f64 + 1.0).ln();

    // Color ramp: black → blue → cyan → green → yellow → red → white
    let ramp: [(f64, f64, f64); 7] = [
        (0.0, 0.0, 0.0),       // black
        (0.0, 0.0, 200.0),     // blue
        (0.0, 180.0, 220.0),   // cyan
        (0.0, 200.0, 0.0),     // green
        (220.0, 220.0, 0.0),   // yellow
        (255.0, 60.0, 0.0),    // red
        (255.0, 255.0, 255.0), // white
    ];

    for y in 0..size {
        for x in 0..size {
            let idx = y as usize * s + x as usize;
            let d = density[idx];
            if d == 0 { continue; }

            let t = (d as f64 + 1.0).ln() / log_max;
            let pos = t * (ramp.len() - 1) as f64;
            let lo = (pos as usize).min(ramp.len() - 2);
            let frac = pos - lo as f64;

            let r = (ramp[lo].0 + (ramp[lo + 1].0 - ramp[lo].0) * frac) as u8;
            let g = (ramp[lo].1 + (ramp[lo + 1].1 - ramp[lo].1) * frac) as u8;
            let b = (ramp[lo].2 + (ramp[lo + 1].2 - ramp[lo].2) * frac) as u8;

            blend_pixel(img, x, y, Rgb([r, g, b]), 0.9);
        }
    }
}

#[allow(clippy::too_many_arguments)]
pub fn render_vectorscope(
    rgb_data: &[u8],
    width: u32,
    height: u32,
    size: u32,
    harmony: Option<&HarmonyConfig>,
    show_skin_tone: bool,
    density_mode: &str,
    color_space: &str,
) -> RgbImage {
    let mut img = RgbImage::from_pixel(size, size, BG);
    let center = size as f64 / 2.0;
    let radius = center * 0.82;

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

    let points = map_pixels(rgb_data, width, height, center, radius, color_space);

    match density_mode {
        "bloom" => render_bloom(&mut img, &points, size),
        "heatmap" => render_heatmap(&mut img, &points, size),
        _ => render_scatter(&mut img, &points, size),
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
#[allow(clippy::too_many_arguments)]
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
        for r_offset in &[-2.0_f64, -1.0, 1.0, 2.0] {
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
    // Digit bitmaps (3x5 base, rendered at 2x scale = 6x10 pixels)
    let digits: [[[u8; 3]; 5]; 10] = [
        [[1,1,1],[1,0,1],[1,0,1],[1,0,1],[1,1,1]], // 0
        [[0,1,0],[1,1,0],[0,1,0],[0,1,0],[1,1,1]], // 1
        [[1,1,1],[0,0,1],[1,1,1],[1,0,0],[1,1,1]], // 2
        [[1,1,1],[0,0,1],[1,1,1],[0,0,1],[1,1,1]], // 3
        [[1,0,1],[1,0,1],[1,1,1],[0,0,1],[0,0,1]], // 4
        [[1,1,1],[1,0,0],[1,1,1],[0,0,1],[1,1,1]], // 5
        [[1,1,1],[1,0,0],[1,1,1],[1,0,1],[1,1,1]], // 6
        [[1,1,1],[0,0,1],[0,0,1],[0,0,1],[0,0,1]], // 7
        [[1,1,1],[1,0,1],[1,1,1],[1,0,1],[1,1,1]], // 8
        [[1,1,1],[1,0,1],[1,1,1],[0,0,1],[1,1,1]], // 9
    ];

    let scale: i32 = 2; // 2x rendering scale
    let digit_h: i32 = 5 * scale;
    let char_w: i32 = 3 * scale + scale; // digit width + spacing

    for i in 0..12 {
        let deg = i * 30;
        let angle = (deg as f64).to_radians();

        // Tick mark at the outer rim
        let tick_inner = radius * 0.94;
        let tick_outer = radius;
        let steps = ((tick_outer - tick_inner) * 2.5) as u32;
        for step in 0..steps {
            let t = step as f64 / steps as f64;
            let r = tick_inner + (tick_outer - tick_inner) * t;
            let px = (center + r * angle.cos()) as u32;
            let py = (center - r * angle.sin()) as u32;
            if px < size && py < size {
                blend_pixel(img, px, py, LABEL, 0.7);
            }
        }

        // Label position further outside the rim
        let label_r = radius * 1.09;
        let label_cx = center + label_r * angle.cos();
        let label_cy = center - label_r * angle.sin();

        // Render degree number at 2x scale
        let text = format!("{}", deg);
        let total_w = text.len() as i32 * char_w - scale;
        let start_x = label_cx as i32 - total_w / 2;
        let start_y = label_cy as i32 - digit_h / 2;

        for (ci, ch) in text.chars().enumerate() {
            let d = (ch as u8 - b'0') as usize;
            if d > 9 { continue; }
            let bitmap = &digits[d];
            for (row, bitmap_row) in bitmap.iter().enumerate() {
                for (col, &pixel) in bitmap_row.iter().enumerate() {
                    if pixel == 1 {
                        // Draw a scale x scale block for each pixel
                        for sy in 0..scale {
                            for sx in 0..scale {
                                let px = start_x + ci as i32 * char_w + col as i32 * scale + sx;
                                let py = start_y + row as i32 * scale + sy;
                                if px >= 0 && py >= 0 && (px as u32) < size && (py as u32) < size {
                                    blend_pixel(img, px as u32, py as u32, LABEL, 0.85);
                                }
                            }
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
