import type { DensityRenderer, MappedPoint } from "../types.js";
import { RADIUS_FACTOR } from "../constants.js";

const GLOW_NUM = 500;
const GLOW_MIN = 2;
const GLOW_MAX = 20;
const ALPHA_NUM = 200;
const ALPHA_MIN = 0.01;
const ALPHA_MAX = 0.3;

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
    const glowRadius = Math.max(GLOW_MIN, Math.min(GLOW_MAX, (size / 20) * (GLOW_NUM / points.length)));
    const alpha = Math.max(ALPHA_MIN, Math.min(ALPHA_MAX, ALPHA_NUM / points.length));
    const cx = size / 2;
    const cy = size / 2;
    const maxR = size * RADIUS_FACTOR;
    const TWO_PI = Math.PI * 2;

    for (let i = 0, len = points.length; i < len; i++) {
      const p = points[i];
      const px = cx + p.x * maxR;
      const py = cy - p.y * maxR;

      const gradient = ctx.createRadialGradient(px, py, 0, px, py, glowRadius);
      gradient.addColorStop(0, `rgba(${p.r},${p.g},${p.b},${alpha})`);
      gradient.addColorStop(1, `rgba(${p.r},${p.g},${p.b},0)`);

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(px, py, glowRadius, 0, TWO_PI);
      ctx.fill();
    }

    ctx.restore();
  }
}
