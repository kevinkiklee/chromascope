import type {
  ColorSpaceMapper,
  DensityRenderer,
  HarmonyZone,
  MappedPoint,
  PixelData,
  ChromascopeSettings,
} from "./types.js";
import { createColorSpaceMapper } from "./color-spaces/index.js";
import { createDensityRenderer } from "./renderers/index.js";
import { renderGraticule } from "./graticule.js";
import { getHarmonyZones, renderHarmonyOverlay, renderSkinToneLine } from "./overlays/index.js";

const DEFAULT_SETTINGS: ChromascopeSettings = {
  colorSpace: "ycbcr",
  densityMode: "scatter",
  logScale: false,
  harmony: {
    scheme: null,
    rotation: 0,
    zoneWidth: 0.1,
    pullStrengths: [],
  },
};

export class Chromascope {
  settings: ChromascopeSettings;
  mappedPoints: MappedPoint[] = [];
  harmonyZones: HarmonyZone[] = [];

  private mapper: ColorSpaceMapper;
  private renderer: DensityRenderer;
  private pixels: PixelData | null = null;
  private graticuleCacheSize = 0;

  constructor(settings?: Partial<ChromascopeSettings>) {
    this.settings = { ...DEFAULT_SETTINGS, ...settings };
    this.mapper = createColorSpaceMapper(this.settings.colorSpace);
    this.renderer = createDensityRenderer(this.settings.densityMode);
    this.harmonyZones = getHarmonyZones(this.settings.harmony);
  }

  updateSettings(partial: Partial<ChromascopeSettings>): void {
    const prev = { ...this.settings };
    Object.assign(this.settings, partial);

    if (this.settings.colorSpace !== prev.colorSpace) {
      this.mapper = createColorSpaceMapper(this.settings.colorSpace);
      this.remapPoints();
    }

    if (this.settings.densityMode !== prev.densityMode) {
      this.renderer = createDensityRenderer(this.settings.densityMode);
    }

    if (this.settings.harmony !== prev.harmony) {
      this.harmonyZones = getHarmonyZones(this.settings.harmony);
    }
  }

  setPixels(pixelData: PixelData): void {
    if (pixelData.width <= 0 || pixelData.height <= 0) {
      throw new Error("setPixels: width and height must be greater than zero");
    }
    const expectedLength = pixelData.width * pixelData.height * 3;
    if (pixelData.data.length < expectedLength) {
      throw new Error(
        `setPixels: data length ${pixelData.data.length} is less than expected ${expectedLength} (${pixelData.width}x${pixelData.height}x3)`
      );
    }
    this.pixels = pixelData;
    this.remapPoints();
  }

  /** Render order matters: graticule (background) → harmony zones → skin tone line → pixel data (foreground) */
  render(ctx: CanvasRenderingContext2D, size: number): void {
    renderGraticule(ctx, size);
    this.graticuleCacheSize = size;

    if (this.harmonyZones.length > 0) {
      renderHarmonyOverlay(ctx, this.harmonyZones, size);
    }

    renderSkinToneLine(ctx, size);

    if (this.mappedPoints.length > 0) {
      this.renderer.render(this.mappedPoints, ctx, size);
    }
  }

  private remapPoints(): void {
    if (!this.pixels) {
      this.mappedPoints = [];
      return;
    }

    const { data, width, height } = this.pixels;
    const totalPixels = width * height;
    // Pre-allocate array for performance — avoids repeated push/resize
    const points: MappedPoint[] = new Array(totalPixels);

    for (let i = 0; i < totalPixels; i++) {
      const offset = i * 3;
      points[i] = this.mapper.mapPixel(data[offset], data[offset + 1], data[offset + 2]);
    }

    this.mappedPoints = points;
  }
}
