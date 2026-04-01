import type { DensityRenderer, MappedPoint } from "../types.js";
import { scopeToCanvas } from "../graticule.js";

/**
 * Scatter plot renderer.
 * Draws each mapped point as a small colored dot with additive blending.
 * Overlapping dots accumulate brightness, showing density.
 */
export class ScatterRenderer implements DensityRenderer {
  readonly id = "scatter" as const;
  readonly label = "Scatter";

  render(points: MappedPoint[], ctx: CanvasRenderingContext2D, size: number): void {
    ctx.save();
    ctx.globalCompositeOperation = "lighter"; // Additive blending
    // Adaptive alpha: fewer points → more opaque, many points → more transparent.
    // Prevents over-saturation on dense images while keeping sparse plots visible.
    ctx.globalAlpha = Math.max(0.02, Math.min(0.5, 500 / points.length));

    const dotSize = Math.max(1, Math.round(size / 200));

    for (const p of points) {
      const { px, py } = scopeToCanvas(p.x, p.y, size);
      ctx.fillStyle = `rgb(${p.r},${p.g},${p.b})`;
      ctx.fillRect(px - dotSize / 2, py - dotSize / 2, dotSize, dotSize);
    }

    ctx.restore();
  }
}
