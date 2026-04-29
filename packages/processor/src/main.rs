use clap::{Parser, Subcommand};
use image::imageops::FilterType;
use std::fs;
use std::path::PathBuf;

mod render;

/// Chromascope image processor: decode images and render vectorscopes.
#[derive(Parser, Debug)]
#[command(name = "processor", version, about)]
struct Cli {
    #[command(subcommand)]
    command: Command,
}

#[derive(Subcommand, Debug)]
enum Command {
    /// Decode a JPEG or TIFF image to raw RGB bytes.
    Decode(DecodeArgs),

    /// Render a vectorscope image from raw RGB pixel data.
    Render(RenderArgs),

    /// Decode + render in one shot (skips intermediate file I/O).
    Pipeline(PipelineArgs),
}

#[derive(Parser, Debug)]
struct DecodeArgs {
    #[arg(short, long)]
    input: PathBuf,

    #[arg(short, long)]
    output: PathBuf,

    #[arg(long, default_value_t = 256)]
    width: u32,

    #[arg(long, default_value_t = 256)]
    height: u32,
}

#[derive(Parser, Debug)]
pub struct RenderArgs {
    #[arg(short, long)]
    input: PathBuf,

    #[arg(short, long)]
    output: PathBuf,

    #[arg(long, default_value_t = 256)]
    width: u32,

    #[arg(long, default_value_t = 256)]
    height: u32,

    #[arg(long, default_value_t = 512)]
    size: u32,

    /// Color harmony scheme (complementary, splitComplementary, triadic, tetradic, analogous)
    #[arg(long)]
    scheme: Option<String>,

    /// Harmony rotation offset in degrees (0-360)
    #[arg(long, default_value_t = 0.0)]
    rotation: f64,

    /// Hide skin tone reference line
    #[arg(long, default_value_t = false)]
    hide_skin_tone: bool,

    /// Overlay line color (white, yellow, cyan, green, magenta, orange)
    #[arg(long, default_value = "yellow")]
    overlay_color: String,

    /// Density rendering mode (scatter, heatmap, bloom)
    #[arg(long, default_value = "scatter")]
    density: String,

    /// Color space (hsl, ycbcr, cieluv)
    #[arg(long, default_value = "hsl")]
    color_space: String,

    /// Output image format (jpeg, png)
    #[arg(long, default_value = "jpeg")]
    output_format: String,
}

#[derive(Parser, Debug)]
pub struct PipelineArgs {
    /// Input image (JPEG or TIFF)
    #[arg(short, long)]
    input: PathBuf,

    /// Output vectorscope image
    #[arg(short, long)]
    output: PathBuf,

    /// Decode width
    #[arg(long, default_value_t = 128)]
    width: u32,

    /// Decode height
    #[arg(long, default_value_t = 128)]
    height: u32,

    /// Vectorscope output size
    #[arg(long, default_value_t = 512)]
    size: u32,

    /// Save decoded RGB bytes for overlay-only re-renders
    #[arg(long)]
    save_rgb: Option<PathBuf>,

    #[arg(long)]
    scheme: Option<String>,

    #[arg(long, default_value_t = 0.0)]
    rotation: f64,

    #[arg(long, default_value_t = false)]
    hide_skin_tone: bool,

    #[arg(long, default_value = "yellow")]
    overlay_color: String,

    #[arg(long, default_value = "scatter")]
    density: String,

    #[arg(long, default_value = "hsl")]
    color_space: String,

    #[arg(long, default_value = "jpeg")]
    output_format: String,
}

fn main() -> anyhow::Result<()> {
    let cli = Cli::parse();

    match cli.command {
        Command::Decode(args) => cmd_decode(args),
        Command::Render(args) => cmd_render(args),
        Command::Pipeline(args) => cmd_pipeline(args),
    }
}

fn cmd_decode(args: DecodeArgs) -> anyhow::Result<()> {
    if args.width == 0 || args.height == 0 {
        return Err(anyhow::anyhow!("Width and height must be greater than zero"));
    }

    let img = image::open(&args.input)
        .map_err(|e| anyhow::anyhow!("Failed to open {:?}: {}", args.input, e))?;

    let resized = img.resize_exact(args.width, args.height, FilterType::Lanczos3);
    let rgb = resized.to_rgb8();
    let raw: &[u8] = rgb.as_raw();

    fs::write(&args.output, raw)
        .map_err(|e| anyhow::anyhow!("Failed to write {:?}: {}", args.output, e))?;

    Ok(())
}

fn validate_render_options(density: &str, color_space: &str, scheme: Option<&str>) -> anyhow::Result<()> {
    const VALID_DENSITIES: &[&str] = &["scatter", "heatmap", "bloom"];
    if !VALID_DENSITIES.contains(&density) {
        return Err(anyhow::anyhow!(
            "Unknown density mode '{}'. Valid: {}",
            density, VALID_DENSITIES.join(", ")
        ));
    }

    const VALID_COLOR_SPACES: &[&str] = &["hsl", "ycbcr", "cieluv"];
    if !VALID_COLOR_SPACES.contains(&color_space) {
        return Err(anyhow::anyhow!(
            "Unknown color space '{}'. Valid: {}",
            color_space, VALID_COLOR_SPACES.join(", ")
        ));
    }

    if let Some(s) = scheme {
        const VALID_SCHEMES: &[&str] = &[
            "complementary", "splitComplementary", "triadic", "tetradic", "analogous",
        ];
        if !VALID_SCHEMES.contains(&s) {
            return Err(anyhow::anyhow!(
                "Unknown harmony scheme '{}'. Valid: {}",
                s, VALID_SCHEMES.join(", ")
            ));
        }
    }

    Ok(())
}

fn cmd_render(args: RenderArgs) -> anyhow::Result<()> {
    if args.width == 0 || args.height == 0 {
        return Err(anyhow::anyhow!("Width and height must be greater than zero"));
    }
    if args.size == 0 {
        return Err(anyhow::anyhow!("Output size must be greater than zero"));
    }

    validate_render_options(&args.density, &args.color_space, args.scheme.as_deref())?;

    let raw = fs::read(&args.input)
        .map_err(|e| anyhow::anyhow!("Failed to read {:?}: {}", args.input, e))?;

    let expected = (args.width as u64)
        .checked_mul(args.height as u64)
        .and_then(|x| x.checked_mul(3))
        .and_then(|x| usize::try_from(x).ok())
        .ok_or_else(|| anyhow::anyhow!("Image dimensions too large: {}x{}", args.width, args.height))?;
    if raw.len() != expected {
        return Err(anyhow::anyhow!(
            "Input has {} bytes, expected {} ({}x{}x3)",
            raw.len(), expected, args.width, args.height
        ));
    }

    let harmony = args.scheme.as_deref().map(|s| render::HarmonyConfig {
        scheme: s.to_string(),
        rotation_deg: args.rotation,
        overlay_color: args.overlay_color.clone(),
    });

    let scope = render::render_vectorscope(&raw, args.width, args.height, args.size, harmony.as_ref(), !args.hide_skin_tone, &args.density, &args.color_space);

    match args.output_format.as_str() {
        "png" => scope.save_with_format(&args.output, image::ImageFormat::Png),
        _ => scope.save_with_format(&args.output, image::ImageFormat::Jpeg),
    }
    .map_err(|e| anyhow::anyhow!("Failed to save {:?}: {}", args.output, e))?;

    Ok(())
}

fn cmd_pipeline(args: PipelineArgs) -> anyhow::Result<()> {
    if args.width == 0 || args.height == 0 {
        return Err(anyhow::anyhow!("Width and height must be greater than zero"));
    }
    if args.size == 0 {
        return Err(anyhow::anyhow!("Output size must be greater than zero"));
    }

    validate_render_options(&args.density, &args.color_space, args.scheme.as_deref())?;

    let img = image::open(&args.input)
        .map_err(|e| anyhow::anyhow!("Failed to open {:?}: {}", args.input, e))?;

    let resized = img.resize_exact(args.width, args.height, FilterType::Lanczos3);
    let rgb = resized.to_rgb8();
    let raw: &[u8] = rgb.as_raw();

    if let Some(ref rgb_path) = args.save_rgb {
        fs::write(rgb_path, raw)
            .map_err(|e| anyhow::anyhow!("Failed to write RGB {:?}: {}", rgb_path, e))?;
    }

    let harmony = args.scheme.as_deref().map(|s| render::HarmonyConfig {
        scheme: s.to_string(),
        rotation_deg: args.rotation,
        overlay_color: args.overlay_color.clone(),
    });

    let scope = render::render_vectorscope(raw, args.width, args.height, args.size, harmony.as_ref(), !args.hide_skin_tone, &args.density, &args.color_space);

    match args.output_format.as_str() {
        "png" => scope.save_with_format(&args.output, image::ImageFormat::Png),
        _ => scope.save_with_format(&args.output, image::ImageFormat::Jpeg),
    }
    .map_err(|e| anyhow::anyhow!("Failed to save {:?}: {}", args.output, e))?;

    Ok(())
}
