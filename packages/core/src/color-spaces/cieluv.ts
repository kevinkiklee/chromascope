import type { ColorSpaceMapper, MappedPoint } from "../types.js";

// D65 illuminant (standard daylight) white point in CIE XYZ
const Xn = 0.95047;
const Yn = 1.0;
const Zn = 1.08883;
// Reference u', v' chromaticity coordinates for the white point
const un = (4 * Xn) / (Xn + 15 * Yn + 3 * Zn);
const vn = (9 * Yn) / (Xn + 15 * Yn + 3 * Zn);

/** sRGB gamma decoding: convert sRGB [0,1] to linear light [0,1] */
function linearize(c: number): number {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

export class CIELUVMapper implements ColorSpaceMapper {
  readonly id = "cieluv" as const;
  readonly label = "CIE LUV";

  // Normalization constant: u*/v* values are divided by this to fit within [-1, 1].
  // 180 accommodates the most saturated sRGB colors without clipping.
  private readonly maxChroma = 180;

  mapPixel(r: number, g: number, b: number): MappedPoint {
    const rl = linearize(r / 255);
    const gl = linearize(g / 255);
    const bl = linearize(b / 255);

    // sRGB to CIE XYZ using the standard 3×3 matrix (D65 adapted)
    const X = 0.4124564 * rl + 0.3575761 * gl + 0.1804375 * bl;
    const Y = 0.2126729 * rl + 0.7151522 * gl + 0.0721750 * bl;
    const Z = 0.0193339 * rl + 0.1191920 * gl + 0.9503041 * bl;

    const denom = X + 15 * Y + 3 * Z;
    if (denom === 0) {
      return { x: 0, y: 0, angle: 0, radius: 0, r, g, b };
    }

    const uPrime = (4 * X) / denom;
    const vPrime = (9 * Y) / denom;

    const yr = Y / Yn;
    const L = yr > 0.008856 ? 116 * Math.cbrt(yr) - 16 : 903.3 * yr;

    const uStar = 13 * L * (uPrime - un);
    const vStar = 13 * L * (vPrime - vn);

    const x = uStar / this.maxChroma;
    const y = vStar / this.maxChroma;

    const angle = Math.atan2(y, x);
    const radius = Math.sqrt(x * x + y * y);

    return { x, y, angle, radius, r, g, b };
  }
}
