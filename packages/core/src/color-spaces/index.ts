import type { ColorSpaceMapper, ColorSpaceId } from "../types.js";
import { YCbCrMapper } from "./ycbcr.js";
import { CIELUVMapper } from "./cieluv.js";
import { HSLMapper } from "./hsl.js";

const mappers: Record<ColorSpaceId, () => ColorSpaceMapper> = {
  ycbcr: () => new YCbCrMapper(),
  cieluv: () => new CIELUVMapper(),
  hsl: () => new HSLMapper(),
};

export function createColorSpaceMapper(id: ColorSpaceId): ColorSpaceMapper {
  return mappers[id]();
}

export { YCbCrMapper } from "./ycbcr.js";
export { CIELUVMapper } from "./cieluv.js";
export { HSLMapper } from "./hsl.js";
