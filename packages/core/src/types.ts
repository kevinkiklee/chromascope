// packages/core/src/types.ts

/** A pixel mapped to chromascope coordinates */
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

export type HarmonySchemeId =
  | "complementary"
  | "splitComplementary"
  | "triadic"
  | "tetradic"
  | "analogous";

/** A single angular zone on the chromascope circle */
export interface HarmonyZone {
  /** Center angle in radians (0 = right, counter-clockwise) */
  centerAngle: number;
  /** Half-width of the zone in radians */
  halfWidth: number;
  /** Pull strength for Fit to Scheme (0 to 1) */
  pullStrength: number;
}

/** Full harmony overlay configuration */
export interface HarmonyConfig {
  /** Which scheme is active, or null for no overlay */
  scheme: HarmonySchemeId | null;
  /** Rotation offset in radians applied to all zones */
  rotation: number;
  /** Zone width multiplier (0.5 = narrow, 2.0 = wide). Default 1.0 */
  zoneWidth: number;
  /** Per-zone pull strengths (indexed same as zones array). Falls back to 0.5 */
  pullStrengths: number[];
}

export interface ChromascopeSettings {
  colorSpace: ColorSpaceId;
  densityMode: DensityModeId;
  logScale: boolean;
  harmony: HarmonyConfig;
}

/** Raw pixel data from host plugin */
export interface PixelData {
  /** Interleaved RGB bytes: [R0,G0,B0, R1,G1,B1, ...] */
  data: Uint8Array;
  width: number;
  height: number;
  colorProfile: string;
}
