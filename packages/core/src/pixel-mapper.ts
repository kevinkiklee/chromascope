import type { ColorSpaceMapper, MappedPoint, PixelData } from "./types.js";

/**
 * Map raw RGB pixel data to vectorscope coordinates using the given color space mapper.
 * Pre-allocates the output array for performance.
 */
export function mapPixels(pixels: PixelData, mapper: ColorSpaceMapper): MappedPoint[] {
  const { data, width, height } = pixels;
  const totalPixels = width * height;
  const points: MappedPoint[] = new Array(totalPixels);

  for (let i = 0; i < totalPixels; i++) {
    const offset = i * 3;
    points[i] = mapper.mapPixel(data[offset], data[offset + 1], data[offset + 2]);
  }

  return points;
}
