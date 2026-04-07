mod colorspace;
mod draw;
mod modes;

use image::{Rgb, RgbImage};
use std::f64::consts::PI;

pub(crate) const TWO_PI: f64 = 2.0 * PI;

pub(crate) const BG: Rgb<u8> = Rgb([9, 9, 11]);
pub(crate) const GRID: Rgb<u8> = Rgb([30, 30, 35]);
pub(crate) const LABEL: Rgb<u8> = Rgb([110, 110, 115]);
pub(crate) const SKIN_TONE: Rgb<u8> = Rgb([180, 120, 60]);
pub(crate) const SKIN_TONE_ANGLE: f64 = 123.0 * PI / 180.0;
pub(crate) const ZONE_LINE_WHITE: Rgb<u8> = Rgb([200, 200, 200]);
pub(crate) const ZONE_LINE_YELLOW: Rgb<u8> = Rgb([220, 200, 80]);
pub(crate) const ZONE_LINE_CYAN: Rgb<u8> = Rgb([80, 200, 210]);
pub(crate) const ZONE_LINE_GREEN: Rgb<u8> = Rgb([80, 210, 120]);
pub(crate) const ZONE_LINE_MAGENTA: Rgb<u8> = Rgb([210, 100, 200]);
pub(crate) const ZONE_LINE_ORANGE: Rgb<u8> = Rgb([230, 160, 60]);
pub(crate) const BASE_HALF_WIDTH: f64 = PI / 12.0;

pub struct HarmonyConfig {
    pub scheme: String,
    pub rotation_deg: f64,
    pub overlay_color: String,
}

/// A mapped point in vectorscope space.
pub(crate) struct ScopePoint {
    pub px: f64,
    pub py: f64,
    pub r: u8,
    pub g: u8,
    pub b: u8,
}

pub(crate) struct Zone {
    pub center_angle: f64,
    pub _half_width: f64,
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

fn normalize_angle(a: f64) -> f64 {
    ((a % TWO_PI) + TWO_PI) % TWO_PI
}

fn scheme_base_angles(scheme: &str) -> Vec<f64> {
    match scheme {
        "complementary" => vec![0.0, PI],
        "splitComplementary" => vec![0.0, PI - PI / 12.0, PI + PI / 12.0],
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
            _half_width: BASE_HALF_WIDTH,
        })
        .collect()
}

use colorspace::map_pixels;
use draw::{draw_color_ring, draw_degree_markers, draw_graticule,
           draw_harmony_zones, draw_skin_tone_line};
use modes::{render_bloom, render_heatmap, render_scatter};

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
    draw_color_ring(&mut img, center, radius, size);

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
