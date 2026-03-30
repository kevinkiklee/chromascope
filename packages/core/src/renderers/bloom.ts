import type { DensityRenderer, MappedPoint } from "../types.js";
import { scopeToCanvas } from "../graticule.js";

/**
 * Bloom/glow renderer.
 * Draws each point as a radial gradient (glowing dot) with additive blending.
 * Dominant colors where many points overlap create a bright bloom effect.
 */
export class BloomRenderer implements DensityRenderer {
  readonly id = "bloom" as const;
  readonly label = "Bloom";

  render(points: MappedPoint[], ctx: CanvasRenderingContext2D, size: number): void {
    if (points.length === 0) return;

    ctx.save();
    ctx.globalCompositeOperation = "lighter";

    // Adaptive: smaller glow for more points, larger for fewer
    const glowRadius = Math.max(2, Math.min(20, size / 20 * (500 / points.length)));
    const alpha = Math.max(0.01, Math.min(0.3, 200 / points.length));

    for (const p of points) {
      const { px, py } = scopeToCanvas(p.x, p.y, size);

      const gradient = ctx.createRadialGradient(px, py, 0, px, py, glowRadius);
      gradient.addColorStop(0, `rgba(${p.r},${p.g},${p.b},${alpha})`);
      gradient.addColorStop(1, `rgba(${p.r},${p.g},${p.b},0)`);

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(px, py, glowRadius, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }
}
