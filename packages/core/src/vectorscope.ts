import type {
  ColorSpaceMapper,
  DensityRenderer,
  MappedPoint,
  PixelData,
  VectorscopeSettings,
} from "./types.js";
import { createColorSpaceMapper } from "./color-spaces/index.js";
import { createDensityRenderer } from "./renderers/index.js";
import { renderGraticule } from "./graticule.js";

const DEFAULT_SETTINGS: VectorscopeSettings = {
  colorSpace: "ycbcr",
  densityMode: "scatter",
  logScale: false,
  harmony: {
    scheme: null,
    rotation: 0,
    zoneWidth: 1.0,
    pullStrengths: [],
  },
};

export class Vectorscope {
  settings: VectorscopeSettings;
  mappedPoints: MappedPoint[] = [];

  private mapper: ColorSpaceMapper;
  private renderer: DensityRenderer;
  private pixels: PixelData | null = null;
  private graticuleCache: ImageData | null = null;
  private graticuleCacheSize = 0;

  constructor(settings?: Partial<VectorscopeSettings>) {
    this.settings = { ...DEFAULT_SETTINGS, ...settings };
    this.mapper = createColorSpaceMapper(this.settings.colorSpace);
    this.renderer = createDensityRenderer(this.settings.densityMode);
  }

  /** Update settings. Re-maps points if color space changed. Swaps renderer if density mode changed. */
  updateSettings(partial: Partial<VectorscopeSettings>): void {
    const prev = { ...this.settings };
    Object.assign(this.settings, partial);

    if (this.settings.colorSpace !== prev.colorSpace) {
      this.mapper = createColorSpaceMapper(this.settings.colorSpace);
      this.remapPoints();
    }

    if (this.settings.densityMode !== prev.densityMode) {
      this.renderer = createDensityRenderer(this.settings.densityMode);
    }
  }

  /** Receive new pixel data from the host plugin. */
  setPixels(pixelData: PixelData): void {
    this.pixels = pixelData;
    this.remapPoints();
  }

  /** Render the full vectorscope onto the given canvas context. */
  render(ctx: CanvasRenderingContext2D, size: number): void {
    // Draw graticule (cached)
    if (this.graticuleCacheSize !== size || !this.graticuleCache) {
      // Render graticule to an offscreen operation then cache
      renderGraticule(ctx, size);
      // For now, render inline. Caching with getImageData is optional optimization.
      this.graticuleCacheSize = size;
    } else {
      renderGraticule(ctx, size);
    }

    // Draw density plot on top
    if (this.mappedPoints.length > 0) {
      this.renderer.render(this.mappedPoints, ctx, size);
    }
  }

  /** Re-map all pixels through the current color space mapper. */
  private remapPoints(): void {
    if (!this.pixels) {
      this.mappedPoints = [];
      return;
    }

    const { data, width, height } = this.pixels;
    const totalPixels = width * height;
    const points: MappedPoint[] = new Array(totalPixels);

    for (let i = 0; i < totalPixels; i++) {
      const offset = i * 3;
      points[i] = this.mapper.mapPixel(data[offset], data[offset + 1], data[offset + 2]);
    }

    this.mappedPoints = points;
  }
}
