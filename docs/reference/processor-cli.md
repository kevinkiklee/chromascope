# Processor CLI Reference

The `processor` binary decodes images and renders vectorscopes. Used by the Lightroom plugin.

## Commands

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
# Decode a JPEG to 128x128 raw RGB
processor decode --input photo.jpg --output pixels.rgb --width 128 --height 128

# Render a vectorscope with bloom and complementary harmony
processor render --input pixels.rgb --output scope.jpg \
  --width 128 --height 128 --size 512 \
  --density bloom --scheme complementary --rotation 45
```
