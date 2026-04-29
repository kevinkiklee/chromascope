# Processor CLI Reference

The `processor` binary decodes images and renders vectorscopes. Used by the Lightroom plugin.

## Commands

### `processor pipeline`

Decode a JPEG or TIFF and render a vectorscope in a single process. This is the primary command used by the Lightroom plugin — it saves ~50-100ms vs. running `decode` and `render` as separate processes.

```
processor pipeline --input <path> --output <path> [options]
```

| Flag | Default | Description |
|------|---------|-------------|
| `--input` | required | Input JPEG/TIFF path |
| `--output` | required | Output vectorscope JPEG/PNG path |
| `--width` | 128 | Decode width in pixels |
| `--height` | 128 | Decode height in pixels |
| `--size` | 512 | Output vectorscope size |
| `--save-rgb` | — | Write decoded RGB bytes to this path (for overlay-only re-renders) |
| `--density` | scatter | Mode: scatter, bloom, heatmap |
| `--color-space` | hsl | Space: hsl, ycbcr, cieluv |
| `--scheme` | — | Harmony: complementary, splitComplementary, triadic, tetradic, analogous |
| `--rotation` | 0.0 | Harmony rotation in degrees |
| `--overlay-color` | yellow | Color: white, yellow, cyan, green, magenta, orange |
| `--hide-skin-tone` | false | Hide 123 degree skin tone line |
| `--output-format` | jpeg | Output format: jpeg, png |

### `processor decode`

Decode a JPEG or TIFF image to raw RGB bytes.

```
processor decode --input <path> --output <path> [--width 256] [--height 256]
```

| Flag | Default | Description |
|------|---------|-------------|
| `--input` | required | Input JPEG/TIFF path |
| `--output` | required | Output raw RGB path |
| `--width` | 256 | Output width in pixels |
| `--height` | 256 | Output height in pixels |

### `processor render`

Render a vectorscope JPEG from raw RGB pixel data.

```
processor render --input <path> --output <path> [options]
```

| Flag | Default | Description |
|------|---------|-------------|
| `--input` | required | Input raw RGB path |
| `--output` | required | Output JPEG path |
| `--width` | 256 | Input image width |
| `--height` | 256 | Input image height |
| `--size` | 512 | Output vectorscope size |
| `--density` | scatter | Mode: scatter, bloom, heatmap |
| `--color-space` | hsl | Space: hsl, ycbcr, cieluv |
| `--scheme` | — | Harmony: complementary, splitComplementary, triadic, tetradic, analogous |
| `--rotation` | 0.0 | Harmony rotation in degrees |
| `--overlay-color` | yellow | Color: white, yellow, cyan, green, magenta, orange |
| `--hide-skin-tone` | false | Hide 123 degree skin tone line |

## Examples

```bash
# One-shot decode + render (primary workflow)
processor pipeline --input photo.jpg --output scope.jpg \
  --width 128 --height 128 --size 512 \
  --density bloom --scheme complementary --rotation 45

# Same, but save decoded RGB for overlay-only re-renders
processor pipeline --input photo.jpg --output scope.jpg \
  --width 128 --height 128 --size 512 --save-rgb pixels.rgb

# Decode a JPEG to 128x128 raw RGB (standalone)
processor decode --input photo.jpg --output pixels.rgb --width 128 --height 128

# Render a vectorscope from cached raw RGB
processor render --input pixels.rgb --output scope.jpg \
  --width 128 --height 128 --size 512 \
  --density bloom --scheme complementary --rotation 45
```
