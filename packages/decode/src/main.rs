use clap::Parser;
use image::imageops::FilterType;
use std::fs;
use std::path::PathBuf;

/// Decode a JPEG or TIFF image and write raw RGB pixels to an output file.
#[derive(Parser, Debug)]
#[command(name = "decode", version, about)]
struct Args {
    /// Input image file path (JPEG or TIFF)
    #[arg(short, long)]
    input: PathBuf,

    /// Output file path for raw RGB bytes
    #[arg(short, long)]
    output: PathBuf,

    /// Target width in pixels
    #[arg(long, default_value_t = 256)]
    width: u32,

    /// Target height in pixels
    #[arg(long, default_value_t = 256)]
    height: u32,
}

fn main() -> anyhow::Result<()> {
    let args = Args::parse();

    // Open and decode the source image
    let img = image::open(&args.input)
        .map_err(|e| anyhow::anyhow!("Failed to open {:?}: {}", args.input, e))?;

    // Resize to target dimensions using Lanczos3 for quality
    let resized = img.resize_exact(args.width, args.height, FilterType::Lanczos3);

    // Convert to raw RGB (3 bytes per pixel, no alpha)
    let rgb = resized.to_rgb8();
    let raw: &[u8] = rgb.as_raw();

    fs::write(&args.output, raw)
        .map_err(|e| anyhow::anyhow!("Failed to write {:?}: {}", args.output, e))?;

    Ok(())
}
