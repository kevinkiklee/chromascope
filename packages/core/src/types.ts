// packages/core/src/types.ts

/** A pixel mapped to vectorscope coordinates */
export interface MappedPoint {
  /** X position on scope (-1 to 1, center is 0) */
  x: number;
  /** Y position on scope (-1 to 1, center is 0) */
  y: number;
  /** Hue angle in radians (0 = right, counter-clockwise) */
  angle: number;
  /** Distance from center (0 to 1) */
  radius: number;
  /** Original RGB for coloring the dot */
  r: number;
  g: number;
  b: number;
}

export type ColorSpaceId = "ycbcr" | "cieluv" | "hsl";
export type DensityModeId = "scatter" | "heatmap" | "bloom";

export interface ColorSpaceMapper {
  readonly id: ColorSpaceId;
  readonly label: string;
  mapPixel(r: number, g: number, b: number): MappedPoint;
}

export interface DensityRenderer {
  readonly id: DensityModeId;
  readonly label: string;
  render(points: MappedPoint[], ctx: CanvasRenderingContext2D, size: number): void;
}

export interface VectorscopeSettings {
  colorSpace: ColorSpaceId;
  densityMode: DensityModeId;
  logScale: boolean;
}

/** Raw pixel data from host plugin */
export interface PixelData {
  /** Interleaved RGB bytes: [R0,G0,B0, R1,G1,B1, ...] */
  data: Uint8Array;
  width: number;
  height: number;
  colorProfile: string;
}
