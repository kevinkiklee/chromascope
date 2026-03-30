import type { DensityRenderer, DensityModeId } from "../types.js";
import { ScatterRenderer } from "./scatter.js";

const renderers: Record<DensityModeId, () => DensityRenderer> = {
  scatter: () => new ScatterRenderer(),
  heatmap: () => { throw new Error("Heatmap not yet implemented"); },
  bloom: () => { throw new Error("Bloom not yet implemented"); },
};

export function createDensityRenderer(id: DensityModeId): DensityRenderer {
  return renderers[id]();
}

export { ScatterRenderer } from "./scatter.js";
