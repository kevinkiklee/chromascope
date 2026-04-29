import type { DensityRenderer, MappedPoint } from "../types.js";
import { RADIUS_FACTOR } from "../constants.js";

/** Cold-to-hot color ramp: black → blue → cyan → green → yellow → red → white.
 * Stored as flat typed arrays so the hot inline lookup avoids tuple allocations. */
const HEATMAP_R = new Uint8Array([0, 0,   0,   0,   255, 255, 255]);
const HEATMAP_G = new Uint8Array([0, 0,   128, 255, 255, 64,  255]);
const HEATMAP_B = new Uint8Array([0, 128, 255, 128, 0,   0,   255]);
const HEATMAP_LAST = HEATMAP_R.length - 1;

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
    const cx = size / 2;
    const cy = size / 2;
    const maxR = size * RADIUS_FACTOR;

    for (let i = 0, len = points.length; i < len; i++) {
      const p = points[i];
      const gx = (cx + p.x * maxR + 0.5) | 0;
      const gy = (cy - p.y * maxR + 0.5) | 0;
      if (gx >= 0 && gx < size && gy >= 0 && gy < size) {
        const idx = gy * size + gx;
        const next = grid[idx] + 1;
        grid[idx] = next;
        if (next > maxCount) maxCount = next;
      }
    }

    // Render grid to ImageData
    const imageData = ctx.createImageData(size, size);
    const pixels = imageData.data;

    if (maxCount > 0) {
      // Log scale compresses the range so low-density areas are visible
      // alongside high-density clusters (linear scale would crush them to black).
      // Hoist 1/log1p(maxCount) and ramp-segment count out of the per-cell loop.
      const invLogMax = 1 / Math.log1p(maxCount);
      const segCount = HEATMAP_LAST;
      const len = grid.length;
      for (let i = 0; i < len; i++) {
        const v = grid[i];
        if (v === 0) continue; // leave transparent (alpha = 0) so graticule shows through

        let t = Math.log1p(v) * invLogMax;
        if (t < 0) t = 0;
        else if (t > 1) t = 1;

        const scaled = t * segCount;
        const idx = scaled | 0;
        const pi = i * 4;
        if (idx >= segCount) {
          pixels[pi]     = HEATMAP_R[segCount];
          pixels[pi + 1] = HEATMAP_G[segCount];
          pixels[pi + 2] = HEATMAP_B[segCount];
        } else {
          const frac = scaled - idx;
          const next = idx + 1;
          const ar = HEATMAP_R[idx], ag = HEATMAP_G[idx], ab = HEATMAP_B[idx];
          pixels[pi]     = (ar + (HEATMAP_R[next] - ar) * frac + 0.5) | 0;
          pixels[pi + 1] = (ag + (HEATMAP_G[next] - ag) * frac + 0.5) | 0;
          pixels[pi + 2] = (ab + (HEATMAP_B[next] - ab) * frac + 0.5) | 0;
        }
        pixels[pi + 3] = 255;
      }
    }

    ctx.putImageData(imageData, 0, 0);
    ctx.restore();
  }
}
