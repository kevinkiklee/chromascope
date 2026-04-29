use super::{ScopePoint, TWO_PI};

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
    if denom.abs() < 1e-10 {
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
    if delta < 1e-10 {
        return (0.0, 0.0);
    }

    let s = if l <= 0.5 { delta / (max + min) } else { delta / (2.0 - max - min) };

    let hue_seg = if max == rn {
        let h = ((gn - bn) / delta) % 6.0;
        if h < 0.0 { h + 6.0 } else { h }
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
pub(super) fn map_pixels(rgb_data: &[u8], width: u32, height: u32, center: f64, radius: f64, color_space: &str) -> Vec<ScopePoint> {
    // Resolve the dispatch ONCE so the per-pixel loop pays no string-match cost.
    let map_fn: fn(f64, f64, f64) -> (f64, f64) = match color_space {
        "ycbcr" => map_ycbcr,
        "cieluv" => map_cieluv,
        _ => map_hsl,
    };

    let total = (width * height) as usize;
    let mut points = Vec::with_capacity(total);

    // Iterate by chunks to let the bounds-check elider see fixed RGB triplets.
    for chunk in rgb_data.chunks_exact(3).take(total) {
        let r = chunk[0] as f64;
        let g = chunk[1] as f64;
        let b = chunk[2] as f64;

        let (nx, ny) = map_fn(r, g, b);

        // Squared compare avoids a sqrt for every out-of-circle pixel.
        if nx * nx + ny * ny > 1.0 {
            continue;
        }

        points.push(ScopePoint {
            px: center + nx * radius,
            py: center - ny * radius,
            r: (r * 0.9 + 30.0).min(255.0) as u8,
            g: (g * 0.9 + 30.0).min(255.0) as u8,
            b: (b * 0.9 + 30.0).min(255.0) as u8,
        });
    }
    points
}
