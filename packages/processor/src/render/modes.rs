use image::{Rgb, RgbImage};

use super::ScopePoint;
use super::draw::blend_pixel;

/// Scatter: each point is a single bright pixel with high alpha.
pub(super) fn render_scatter(img: &mut RgbImage, points: &[ScopePoint], size: u32) {
    for p in points {
        let x = p.px.max(0.0) as u32;
        let y = p.py.max(0.0) as u32;
        if x < size && y < size {
            blend_pixel(img, x, y, Rgb([p.r, p.g, p.b]), 0.9);
        }
    }
}

/// Bloom: each point stamps a radial glow with additive blending.
pub(super) fn render_bloom(img: &mut RgbImage, points: &[ScopePoint], size: u32) {
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

/// Heatmap: bin points into a grid and color by frequency (cold->hot ramp).
pub(super) fn render_heatmap(img: &mut RgbImage, points: &[ScopePoint], size: u32) {
    if points.is_empty() { return; }

    let s = size as usize;
    let mut density = vec![0u32; s * s];
    let mut max_density = 0u32;

    for p in points {
        let x = p.px.max(0.0) as u32;
        let y = p.py.max(0.0) as u32;
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

    // Color ramp: black -> blue -> cyan -> green -> yellow -> red -> white
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
