use image::{Rgb, RgbImage};
use std::f64::consts::PI;

use super::{Zone, GRID, LABEL, SKIN_TONE, SKIN_TONE_ANGLE};

pub(crate) fn blend_pixel(img: &mut RgbImage, x: u32, y: u32, color: Rgb<u8>, alpha: f64) {
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

/// Draw harmony zone edges as lines from center to rim (matching Photoshop plugin style).
pub(super) fn draw_harmony_zones(
    img: &mut RgbImage,
    zones: &[Zone],
    center: f64,
    radius: f64,
    size: u32,
    color: Rgb<u8>,
) {
    for (i, zone) in zones.iter().enumerate() {
        let mid = -(zone.center_angle);
        draw_soft_line(img, center, radius, mid, size, color, 0.7);

        // First zone is the key -- draw arrowhead at the rim
        if i == 0 {
            draw_arrowhead(img, center, radius, mid, size, color, 0.85);
        }
    }
}

/// Draw a small arrowhead at the tip of a line near the outer rim.
fn draw_arrowhead(img: &mut RgbImage, center: f64, radius: f64, angle: f64, size: u32, color: Rgb<u8>, alpha: f64) {
    let tip_r = radius * 0.92;
    let arrow_len = radius * 0.08;
    let arrow_half_w = radius * 0.03;

    let tip_x = center + tip_r * angle.cos();
    let tip_y = center + tip_r * angle.sin();

    // Two base points of the triangle, spread perpendicular to the line
    let base_r = tip_r - arrow_len;
    let perp_x = -angle.sin();
    let perp_y = angle.cos();

    let base_cx = center + base_r * angle.cos();
    let base_cy = center + base_r * angle.sin();

    let b1_x = base_cx + perp_x * arrow_half_w;
    let b1_y = base_cy + perp_y * arrow_half_w;
    let b2_x = base_cx - perp_x * arrow_half_w;
    let b2_y = base_cy - perp_y * arrow_half_w;

    // Fill the triangle by scanning a bounding box
    let min_x = tip_x.min(b1_x).min(b2_x).floor() as i32 - 1;
    let max_x = tip_x.max(b1_x).max(b2_x).ceil() as i32 + 1;
    let min_y = tip_y.min(b1_y).min(b2_y).floor() as i32 - 1;
    let max_y = tip_y.max(b1_y).max(b2_y).ceil() as i32 + 1;

    for py in min_y..=max_y {
        for px in min_x..=max_x {
            if px < 0 || py < 0 || px as u32 >= size || py as u32 >= size { continue; }
            let fx = px as f64;
            let fy = py as f64;

            // Barycentric test: is (fx, fy) inside triangle (tip, b1, b2)?
            let d1 = (fx - b2_x) * (b1_y - b2_y) - (b1_x - b2_x) * (fy - b2_y);
            let d2 = (fx - tip_x) * (b2_y - tip_y) - (b2_x - tip_x) * (fy - tip_y);
            let d3 = (fx - b1_x) * (tip_y - b1_y) - (tip_x - b1_x) * (fy - b1_y);

            let has_neg = d1 < 0.0 || d2 < 0.0 || d3 < 0.0;
            let has_pos = d1 > 0.0 || d2 > 0.0 || d3 > 0.0;

            if !(has_neg && has_pos) {
                blend_pixel(img, px as u32, py as u32, color, alpha);
            }
        }
    }
}

/// Draw an anti-aliased line from center to rim using Wu's algorithm approach.
fn draw_soft_line(img: &mut RgbImage, center: f64, radius: f64, angle: f64, size: u32, color: Rgb<u8>, alpha: f64) {
    let x0 = center;
    let y0 = center;
    let x1 = center + radius * angle.cos();
    let y1 = center + radius * angle.sin();

    let dx = (x1 - x0).abs();
    let dy = (y1 - y0).abs();
    let steps = dx.max(dy).ceil() as u32;
    if steps == 0 { return; }

    let x_step = (x1 - x0) / steps as f64;
    let y_step = (y1 - y0) / steps as f64;

    for i in 0..=steps {
        let fx = x0 + x_step * i as f64;
        let fy = y0 + y_step * i as f64;

        let ix = fx.floor() as i32;
        let iy = fy.floor() as i32;
        let frac_x = fx - fx.floor();
        let frac_y = fy - fy.floor();

        // Anti-aliased: distribute alpha across 4 neighboring pixels
        let weights = [
            (ix, iy, (1.0 - frac_x) * (1.0 - frac_y)),
            (ix + 1, iy, frac_x * (1.0 - frac_y)),
            (ix, iy + 1, (1.0 - frac_x) * frac_y),
            (ix + 1, iy + 1, frac_x * frac_y),
        ];

        for &(px, py, w) in &weights {
            if px >= 0 && py >= 0 && (px as u32) < size && (py as u32) < size && w > 0.01 {
                blend_pixel(img, px as u32, py as u32, color, alpha * w);
            }
        }
    }
}

pub(super) fn draw_graticule(img: &mut RgbImage, center: f64, radius: f64, size: u32) {
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

/// Draw degree markers every 30 degrees as small tick marks and labels around the outer rim.
pub(super) fn draw_degree_markers(img: &mut RgbImage, center: f64, radius: f64, size: u32) {
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

/// Convert HSV (h: 0-360, s: 0-1, v: 0-1) to RGB.
fn hsv_to_rgb(h: f64, s: f64, v: f64) -> Rgb<u8> {
    let h = ((h % 360.0) + 360.0) % 360.0;
    let c = v * s;
    let x = c * (1.0 - ((h / 60.0) % 2.0 - 1.0).abs());
    let m = v - c;
    let (r, g, b) = if h < 60.0 { (c, x, 0.0) }
        else if h < 120.0 { (x, c, 0.0) }
        else if h < 180.0 { (0.0, c, x) }
        else if h < 240.0 { (0.0, x, c) }
        else if h < 300.0 { (x, 0.0, c) }
        else { (c, 0.0, x) };
    Rgb([((r + m) * 255.0) as u8, ((g + m) * 255.0) as u8, ((b + m) * 255.0) as u8])
}

/// Draw a continuous color ring just outside the graticule.
/// Matches Lightroom's color grading wheel: red at 0 degrees (right), yellow at ~60 degrees (top-right),
/// green at ~120 degrees (top-left), cyan at 180 degrees (left), blue at ~240 degrees (bottom-left),
/// magenta at ~300 degrees (bottom-right). This is a standard HSV hue wheel with hue 0 = red at 3 o'clock.
pub(super) fn draw_color_ring(img: &mut RgbImage, center: f64, radius: f64, size: u32) {
    let ring_inner = radius * 1.005;
    let ring_outer = radius * 1.02;
    let ring_mid = (ring_inner + ring_outer) / 2.0;
    let ring_half = (ring_outer - ring_inner) / 2.0;

    let scan_min = (center - ring_outer - 1.0).max(0.0) as u32;
    let scan_max = (center + ring_outer + 1.0).min(size as f64 - 1.0) as u32;

    for py in scan_min..=scan_max {
        for px in scan_min..=scan_max {
            let dx = px as f64 - center;
            let dy = py as f64 - center;
            let dist = (dx * dx + dy * dy).sqrt();

            let ring_dist = (dist - ring_mid).abs();
            if ring_dist > ring_half + 0.5 { continue; }

            let alpha = if ring_dist > ring_half - 0.5 {
                (1.0 - (ring_dist - (ring_half - 0.5))).clamp(0.0, 1.0)
            } else {
                1.0
            };

            // Angle: 0 degrees at right, counter-clockwise (matching graticule).
            // atan2(-dy, dx) because canvas y points down.
            let angle_rad = (-dy).atan2(dx);
            let hue_deg = ((angle_rad.to_degrees()) + 360.0) % 360.0;

            // Direct HSV hue wheel: hue 0 (red) at 0 degrees (right), matching Lightroom's layout
            let color = hsv_to_rgb(hue_deg, 0.9, 0.85);
            blend_pixel(img, px, py, color, alpha * 0.85);
        }
    }
}

pub(super) fn draw_skin_tone_line(img: &mut RgbImage, center: f64, radius: f64) {
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
