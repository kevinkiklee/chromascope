import type { ColorSpaceMapper, ColorSpaceId } from "../types.js";
import { YCbCrMapper } from "./ycbcr.js";

const mappers: Record<ColorSpaceId, () => ColorSpaceMapper> = {
  ycbcr: () => new YCbCrMapper(),
  cieluv: () => { throw new Error("CIE LUV not yet implemented"); },
  hsl: () => { throw new Error("HSL not yet implemented"); },
};

export function createColorSpaceMapper(id: ColorSpaceId): ColorSpaceMapper {
  return mappers[id]();
}

export { YCbCrMapper } from "./ycbcr.js";
