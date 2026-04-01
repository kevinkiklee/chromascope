import type { DensityRenderer, MappedPoint } from "../types.js";
import { scopeToCanvas } from "../graticule.js";

/** Cold-to-hot color ramp: black → blue → cyan → green → yellow → red → white */
const HEATMAP_COLORS: Array<[number, number, number]> = [
  [0, 0, 0],       // 0%
  [0, 0, 128],     // ~17%
  [0, 128, 255],   // ~33%
  [0, 255, 128],   // ~50%
  [255, 255, 0],   // ~67%
  [255, 64, 0],    // ~83%
  [255, 255, 255], // 100%
];

function heatColor(t: number): [number, number, number] {
  const clamped = Math.max(0, Math.min(1, t));
  const scaled = clamped * (HEATMAP_COLORS.length - 1);
  const idx = Math.floor(scaled);
  const frac = scaled - idx;

  if (idx >= HEATMAP_COLORS.length - 1) return HEATMAP_COLORS[HEATMAP_COLORS.length - 1];

  const a = HEATMAP_COLORS[idx];
  const b = HEATMAP_COLORS[idx + 1];
  return [
    Math.round(a[0] + (b[0] - a[0]) * frac),
    Math.round(a[1] + (b[1] - a[1]) * frac),
    Math.round(a[2] + (b[2] - a[2]) * frac),
  ];
}

/**
 * Heatmap renderer.
 * Bins points into a pixel grid and colors each cell by frequency.
 */
export class HeatmapRenderer implements DensityRenderer {
  readonly id = "heatmap" as const;
  readonly label = "Heatmap";

  render(points: MappedPoint[], ctx: CanvasRenderingContext2D, size: number): void {
    ctx.save();

    // Build density grid
    const grid = new Float32Array(size * size);
    let maxCount = 0;

    for (const p of points) {
      const { px, py } = scopeToCanvas(p.x, p.y, size);
      const gx = Math.round(px);
      const gy = Math.round(py);
      if (gx >= 0 && gx < size && gy >= 0 && gy < size) {
        const idx = gy * size + gx;
        grid[idx]++;
        if (grid[idx] > maxCount) maxCount = grid[idx];
      }
    }

    // Render grid to ImageData
    const imageData = ctx.createImageData(size, size);
    const pixels = imageData.data;

    if (maxCount > 0) {
      for (let i = 0; i < grid.length; i++) {
        if (grid[i] > 0) {
          // Log scale compresses the range so low-density areas are visible
          // alongside high-density clusters (linear scale would crush them to black)
          const t = Math.log1p(grid[i]) / Math.log1p(maxCount);
          const [r, g, b] = heatColor(t);
          const pi = i * 4;
          pixels[pi] = r;
          pixels[pi + 1] = g;
          pixels[pi + 2] = b;
          pixels[pi + 3] = 255;
        }
        // Else: leave transparent (alpha = 0) so graticule shows through
      }
    }

    ctx.putImageData(imageData, 0, 0);
    ctx.restore();
  }
}
