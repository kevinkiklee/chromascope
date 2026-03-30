use clap::{Parser, Subcommand};
use image::imageops::FilterType;
use std::fs;
use std::path::PathBuf;

mod overlay;
mod render;

/// Chromascope image decoder and vectorscope renderer.
#[derive(Parser, Debug)]
#[command(name = "decode", version, about)]
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

    /// Max-blend a base scope image with a pre-rendered overlay.
    Composite(CompositeArgs),

    /// Generate all pre-rendered overlay images (run at build time).
    GenerateOverlays(GenerateOverlaysArgs),
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
}

#[derive(Parser, Debug)]
struct CompositeArgs {
    /// Base vectorscope JPEG
    #[arg(long)]
    base: PathBuf,

    /// Pre-rendered overlay JPEG
    #[arg(long)]
    overlay: PathBuf,

    /// Output JPEG path
    #[arg(short, long)]
    output: PathBuf,
}

#[derive(Parser, Debug)]
struct GenerateOverlaysArgs {
    /// Output directory for overlay images
    #[arg(short, long)]
    output: PathBuf,

    /// Image size (square)
    #[arg(long, default_value_t = 256)]
    size: u32,
}

fn main() -> anyhow::Result<()> {
    let cli = Cli::parse();

    match cli.command {
        Command::Decode(args) => cmd_decode(args),
        Command::Render(args) => cmd_render(args),
        Command::Composite(args) => cmd_composite(args),
        Command::GenerateOverlays(args) => cmd_generate_overlays(args),
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

    let scope = render::render_vectorscope(&raw, args.width, args.height, args.size);
    scope.save(&args.output)
        .map_err(|e| anyhow::anyhow!("Failed to save {:?}: {}", args.output, e))?;

    Ok(())
}

fn cmd_composite(args: CompositeArgs) -> anyhow::Result<()> {
    let base = image::open(&args.base)
        .map_err(|e| anyhow::anyhow!("Failed to open base {:?}: {}", args.base, e))?
        .to_rgb8();

    let over = image::open(&args.overlay)
        .map_err(|e| anyhow::anyhow!("Failed to open overlay {:?}: {}", args.overlay, e))?
        .to_rgb8();

    let result = overlay::composite(&base, &over);
    result.save(&args.output)
        .map_err(|e| anyhow::anyhow!("Failed to save {:?}: {}", args.output, e))?;

    Ok(())
}

fn cmd_generate_overlays(args: GenerateOverlaysArgs) -> anyhow::Result<()> {
    let count = overlay::generate_all(&args.output, args.size)?;
    eprintln!("Generated {} overlay images in {:?}", count, args.output);
    Ok(())
}
