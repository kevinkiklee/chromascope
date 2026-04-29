import type { DensityRenderer, MappedPoint } from "../types.js";
import { RADIUS_FACTOR } from "../constants.js";

/** Render-time tuning. Larger denominators bias toward more transparency on dense plots. */
const ALPHA_NUMERATOR = 500;
const ALPHA_MIN = 0.02;
const ALPHA_MAX = 0.5;

/**
 * Scatter plot renderer.
 * Draws each mapped point as a small colored dot with additive blending.
 * Overlapping dots accumulate brightness, showing density.
 */
export class ScatterRenderer implements DensityRenderer {
  readonly id = "scatter" as const;
  readonly label = "Scatter";

  render(points: MappedPoint[], ctx: CanvasRenderingContext2D, size: number): void {
    if (points.length === 0) return;

    ctx.save();
    ctx.globalCompositeOperation = "lighter"; // Additive blending
    // Adaptive alpha: fewer points → more opaque, many points → more transparent.
    // Prevents over-saturation on dense images while keeping sparse plots visible.
    ctx.globalAlpha = Math.max(ALPHA_MIN, Math.min(ALPHA_MAX, ALPHA_NUMERATOR / points.length));

    const dotSize = Math.max(1, Math.round(size / 200));
    const halfDot = dotSize / 2;
    // Pre-compute scope→canvas geometry once per render rather than per point.
    const cx = size / 2;
    const cy = size / 2;
    const maxR = size * RADIUS_FACTOR;

    for (let i = 0, len = points.length; i < len; i++) {
      const p = points[i];
      const px = cx + p.x * maxR;
      const py = cy - p.y * maxR;
      ctx.fillStyle = `rgb(${p.r},${p.g},${p.b})`;
      ctx.fillRect(px - halfDot, py - halfDot, dotSize, dotSize);
    }

    ctx.restore();
  }
}
