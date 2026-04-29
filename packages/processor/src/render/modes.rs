use image::RgbImage;

use super::ScopePoint;

// α=0.9 blend, byte-identical to blend_pixel(.., 0.9). Uses the same
// `((old as f64) * 0.1 + (new as f64) * 0.9).round()` math but inlined so
// scatter can write straight into the raw buffer instead of paying per-pixel
// bounds-checked get_pixel/put_pixel calls.
#[inline(always)]
fn blend_alpha09(old: u8, new: u8) -> u8 {
    ((old as f64) * 0.1 + (new as f64) * 0.9).round() as u8
}

/// Scatter: each point is a single bright pixel with high alpha.
pub(super) fn render_scatter(img: &mut RgbImage, points: &[ScopePoint], size: u32) {
    let s = size as usize;
    let raw = img.as_mut();
    for p in points {
        // px/py are computed via center + nx*radius, so they're always > 0 for
        // in-bounds points; guard against the edge case where rounding/garbage
        // produces a NaN or negative anyway.
        if !(p.px >= 0.0 && p.py >= 0.0) { continue; }
        let x = p.px as u32;
        let y = p.py as u32;
        if x >= size || y >= size { continue; }

        let idx = (y as usize * s + x as usize) * 3;
        raw[idx]     = blend_alpha09(raw[idx], p.r);
        raw[idx + 1] = blend_alpha09(raw[idx + 1], p.g);
        raw[idx + 2] = blend_alpha09(raw[idx + 2], p.b);
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

    let glow_r_sq = glow_radius * glow_radius;
    let inv_glow_r = (1.0 / glow_radius) as f32;

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
            let dy = iy as f64 - cy;
            let dy_sq = dy * dy;
            let row_off = iy as usize * s;
            // Hoist the slice-window once per row so the inner loop is over a
            // single contiguous &mut [f32] — kills row-multiplication and lets
            // the optimiser skip per-iteration bounds checks on each accumulator.
            let row_r = &mut buf_r[row_off..row_off + s];
            let row_g = &mut buf_g[row_off..row_off + s];
            let row_b = &mut buf_b[row_off..row_off + s];
            for ix in x_min..=x_max {
                let dx = ix as f64 - cx;
                let dist_sq = dx * dx + dy_sq;
                if dist_sq > glow_r_sq { continue; }

                // Use f32 sqrt (faster than f64) — output is f32 anyway and
                // glow_radius is small, so precision loss is well below RMSE.
                let falloff = 1.0 - (dist_sq as f32).sqrt() * inv_glow_r;
                let xi = ix as usize;
                row_r[xi] += pr * falloff;
                row_g[xi] += pg * falloff;
                row_b[xi] += pb * falloff;
            }
        }
    }

    // Composite buffer onto image additively. Direct mutable access into the
    // raw pixel buffer skips the per-pixel bounds checks of get_pixel/put_pixel.
    let raw = img.as_mut();
    for y in 0..size as usize {
        let row = y * s;
        let raw_row = y * s * 3;
        for x in 0..s {
            let idx = row + x;
            let ar = buf_r[idx];
            let ag = buf_g[idx];
            let ab = buf_b[idx];
            if ar <= 0.0 && ag <= 0.0 && ab <= 0.0 { continue; }

            let raw_idx = raw_row + x * 3;
            let nr = (raw[raw_idx] as f32 + ar).min(255.0) as u8;
            let ng = (raw[raw_idx + 1] as f32 + ag).min(255.0) as u8;
            let nb = (raw[raw_idx + 2] as f32 + ab).min(255.0) as u8;
            raw[raw_idx] = nr;
            raw[raw_idx + 1] = ng;
            raw[raw_idx + 2] = nb;
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
    let last_seg = ramp.len() - 2;
    let seg_count = (ramp.len() - 1) as f64;

    let raw = img.as_mut();
    for y in 0..size {
        let row_off = y as usize * s;
        for x in 0..size {
            let idx = row_off + x as usize;
            let d = density[idx];
            if d == 0 { continue; }

            let t = (d as f64 + 1.0).ln() / log_max;
            let pos = t * seg_count;
            let lo = (pos as usize).min(last_seg);
            let frac = pos - lo as f64;

            let lo_c = ramp[lo];
            let hi_c = ramp[lo + 1];
            let r = (lo_c.0 + (hi_c.0 - lo_c.0) * frac) as u8;
            let g = (lo_c.1 + (hi_c.1 - lo_c.1) * frac) as u8;
            let b = (lo_c.2 + (hi_c.2 - lo_c.2) * frac) as u8;

            // Direct write skips two get_pixel/put_pixel bounds checks per cell
            // (size² cells per render). Output is byte-identical to blend_pixel(.., 0.9).
            let raw_idx = idx * 3;
            raw[raw_idx]     = blend_alpha09(raw[raw_idx], r);
            raw[raw_idx + 1] = blend_alpha09(raw[raw_idx + 1], g);
            raw[raw_idx + 2] = blend_alpha09(raw[raw_idx + 2], b);
        }
    }
}
