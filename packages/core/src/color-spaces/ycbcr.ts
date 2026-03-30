import type { ColorSpaceMapper, MappedPoint } from "../types.js";

export class YCbCrMapper implements ColorSpaceMapper {
  readonly id = "ycbcr" as const;
  readonly label = "YCbCr";

  mapPixel(r: number, g: number, b: number): MappedPoint {
    const rn = r / 255;
    const gn = g / 255;
    const bn = b / 255;

    // BT.601 Cb and Cr (range: -0.5 to 0.5)
    const cb = -0.168736 * rn - 0.331264 * gn + 0.5 * bn;
    const cr = 0.5 * rn - 0.418688 * gn - 0.081312 * bn;

    // Scale to [-1, 1] for display
    const x = cb * 2;
    const y = cr * 2;

    const angle = Math.atan2(y, x);
    const radius = Math.sqrt(x * x + y * y);

    return { x, y, angle, radius, r, g, b };
  }
}
