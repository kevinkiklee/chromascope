import type { DensityRenderer, DensityModeId } from "../types.js";
import { ScatterRenderer } from "./scatter.js";
import { HeatmapRenderer } from "./heatmap.js";
import { BloomRenderer } from "./bloom.js";

const renderers: Record<DensityModeId, () => DensityRenderer> = {
  scatter: () => new ScatterRenderer(),
  heatmap: () => new HeatmapRenderer(),
  bloom: () => new BloomRenderer(),
};

export function createDensityRenderer(id: DensityModeId): DensityRenderer {
  return renderers[id]();
}

export { ScatterRenderer } from "./scatter.js";
export { HeatmapRenderer } from "./heatmap.js";
export { BloomRenderer } from "./bloom.js";
