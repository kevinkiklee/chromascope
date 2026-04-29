// packages/core/src/protocol.ts

import type { ColorSpaceId, DensityModeId, HarmonyConfig } from "./types.js";

// --- Messages from Host → WebView ---

export interface PixelsMessage {
  type: "pixels";
  data: number[];
  width: number;
  height: number;
  colorProfile: string;
}

export interface HighlightFromHostMessage {
  type: "highlight";
  x: number;
  y: number;
}

export interface SettingsMessage {
  type: "settings";
  colorSpace?: ColorSpaceId;
  densityMode?: DensityModeId;
  logScale?: boolean;
  harmony?: HarmonyConfig;
}

export type HostMessage = PixelsMessage | HighlightFromHostMessage | SettingsMessage;

// --- Messages from WebView → Host ---

export interface EditMessage {
  type: "edit";
  mode: "hsl" | "colorGrading" | "curves" | "pixels";
  params: Record<string, number>;
}

export interface HighlightFromScopeMessage {
  type: "highlight";
  region: { angle: number; radius: number; width: number };
}

export type ScopeMessage = EditMessage | HighlightFromScopeMessage;

// --- Helpers ---

// Configurable target origin for postMessage security.
// Host plugins should call setTargetOrigin() before communication begins.
let _targetOrigin = "*";

export function setTargetOrigin(origin: string): void {
  _targetOrigin = origin;
}

export function sendToHost(message: ScopeMessage): void {
  window.parent.postMessage(message, _targetOrigin);
}

const VALID_HOST_TYPES: ReadonlySet<string> = new Set(["pixels", "highlight", "settings"]);
const VALID_COLOR_SPACES: ReadonlySet<string> = new Set(["ycbcr", "cieluv", "hsl"]);
const VALID_DENSITY_MODES: ReadonlySet<string> = new Set(["scatter", "bloom", "heatmap"]);

export function onHostMessage(handler: (msg: HostMessage) => void): () => void {
  const listener = (event: MessageEvent) => {
    const data = event.data;
    if (!data || typeof data.type !== "string" || !VALID_HOST_TYPES.has(data.type)) {
      return;
    }
    if (data.type === "pixels") {
      if (!Array.isArray(data.data) || typeof data.width !== "number" || typeof data.height !== "number") {
        console.warn("Chromascope: invalid pixels message — missing data, width, or height");
        return;
      }
      if (data.width <= 0 || data.height <= 0 || !Number.isFinite(data.width) || !Number.isFinite(data.height)) {
        console.warn("Chromascope: invalid pixels message — width/height must be positive finite numbers");
        return;
      }
      const expected = data.width * data.height * 3;
      if (data.data.length < expected) {
        console.warn(`Chromascope: invalid pixels message — data length ${data.data.length} < expected ${expected}`);
        return;
      }
    } else if (data.type === "settings") {
      if (data.colorSpace !== undefined && !VALID_COLOR_SPACES.has(data.colorSpace)) {
        console.warn(`Chromascope: invalid settings message — unknown colorSpace ${data.colorSpace}`);
        return;
      }
      if (data.densityMode !== undefined && !VALID_DENSITY_MODES.has(data.densityMode)) {
        console.warn(`Chromascope: invalid settings message — unknown densityMode ${data.densityMode}`);
        return;
      }
    }
    handler(data as HostMessage);
  };
  window.addEventListener("message", listener);
  return () => window.removeEventListener("message", listener);
}
