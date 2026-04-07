export { Chromascope } from "./chromascope.js";
export { createControls } from "./ui/controls.js";
export { onHostMessage, sendToHost, setTargetOrigin } from "./protocol.js";
export { renderGraticule, scopeToCanvas } from "./graticule.js";
export { attachScopeInteraction } from "./interaction/scope-interaction.js";
export type {
  MappedPoint, ColorSpaceId, DensityModeId, HarmonySchemeId,
  HarmonyZone, HarmonyConfig, ChromascopeSettings, PixelData,
  ColorSpaceMapper, DensityRenderer,
} from "./types.js";
