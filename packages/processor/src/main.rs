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
}

fn main() -> anyhow::Result<()> {
    let cli = Cli::parse();

    match cli.command {
        Command::Decode(args) => cmd_decode(args),
        Command::Render(args) => cmd_render(args),
    }
}

fn cmd_decode(args: DecodeArgs) -> anyhow::Result<()> {
    let img = image::open(&args.input)
        .map_err(|e| anyhow::anyhow!("Failed to open {:?}: {}", args.input, e))?;

    let resized = img.resize_exact(args.width, args.height, FilterType::Lanczos3);
    let rgb = resized.to_rgb8();
    let raw: &[u8] = rgb.as_raw();

    fs::write(&args.output, raw)
        .map_err(|e| anyhow::anyhow!("Failed to write {:?}: {}", args.output, e))?;

    Ok(())
}

fn cmd_render(args: RenderArgs) -> anyhow::Result<()> {
    let raw = fs::read(&args.input)
        .map_err(|e| anyhow::anyhow!("Failed to read {:?}: {}", args.input, e))?;

    let expected = (args.width * args.height * 3) as usize;
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

    scope.save(&args.output)
        .map_err(|e| anyhow::anyhow!("Failed to save {:?}: {}", args.output, e))?;

    Ok(())
}
