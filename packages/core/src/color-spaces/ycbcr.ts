import type { ColorSpaceMapper, MappedPoint } from "../types.js";

export class YCbCrMapper implements ColorSpaceMapper {
  readonly id = "ycbcr" as const;
  readonly label = "YCbCr";

  mapPixel(r: number, g: number, b: number): MappedPoint {
    const rn = r / 255;
    const gn = g / 255;
    const bn = b / 255;

    // BT.601 coefficients for Cb (blue-difference) and Cr (red-difference).
    // Raw range is [-0.5, 0.5]; we scale by 2× to fill the [-1, 1] scope range.
    // These are the standard SDTV coefficients — BT.709 (HDTV) uses different weights.
    const cb = -0.168736 * rn - 0.331264 * gn + 0.5 * bn;
    const cr = 0.5 * rn - 0.418688 * gn - 0.081312 * bn;

    const x = cb * 2;
    const y = cr * 2;

    const angle = Math.atan2(y, x);
    const radius = Math.sqrt(x * x + y * y);

    return { x, y, angle, radius, r, g, b };
  }
}
