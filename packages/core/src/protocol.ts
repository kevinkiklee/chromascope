// packages/core/src/protocol.ts

import type { ColorSpaceId, DensityModeId, HarmonyConfig, VectorscopeSettings } from "./types.js";

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

export function sendToHost(message: ScopeMessage): void {
  window.parent.postMessage(message, "*");
}

export function onHostMessage(handler: (msg: HostMessage) => void): () => void {
  const listener = (event: MessageEvent) => {
    const data = event.data;
    if (data && typeof data.type === "string") {
      handler(data as HostMessage);
    }
  };
  window.addEventListener("message", listener);
  return () => window.removeEventListener("message", listener);
}
