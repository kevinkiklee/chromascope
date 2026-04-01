import type { ColorSpaceMapper, MappedPoint } from "../types.js";

export class HSLMapper implements ColorSpaceMapper {
  readonly id = "hsl" as const;
  readonly label = "HSL";

  mapPixel(r: number, g: number, b: number): MappedPoint {
    const rn = r / 255;
    const gn = g / 255;
    const bn = b / 255;

    const max = Math.max(rn, gn, bn);
    const min = Math.min(rn, gn, bn);
    const delta = max - min;

    const l = (max + min) / 2;
    let s = 0;
    if (delta !== 0) {
      s = l <= 0.5 ? delta / (max + min) : delta / (2 - max - min);
    }

    // Compute hue in radians. The standard formula gives hue in [0, 6) "sextants",
    // which we convert to radians and normalize to (-π, π] so 0 = red = right side of scope.
    let hueRad = 0;
    if (delta !== 0) {
      let hueDeg: number;
      if (max === rn) {
        hueDeg = ((gn - bn) / delta) % 6;
      } else if (max === gn) {
        hueDeg = (bn - rn) / delta + 2;
      } else {
        hueDeg = (rn - gn) / delta + 4;
      }
      hueRad = (hueDeg / 6) * 2 * Math.PI;
      if (hueRad > Math.PI) hueRad -= 2 * Math.PI;
    }

    // Saturation maps directly to radius: grays at center, vivid colors at the rim.
    // Hue maps to angle: polar coordinates give us the vectorscope position.
    const radius = s;
    const x = radius * Math.cos(hueRad);
    const y = radius * Math.sin(hueRad);

    return { x, y, angle: hueRad, radius, r, g, b };
  }
}
