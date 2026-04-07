import { Chromascope } from "./chromascope.js";
import { onHostMessage } from "./protocol.js";
import { createControls } from "./ui/controls.js";
import { attachScopeInteraction } from "./interaction/scope-interaction.js";
import type { PixelData, ChromascopeSettings } from "./types.js";

const canvas = document.getElementById("scope-canvas") as HTMLCanvasElement | null;
const container = document.getElementById("scope-canvas-container") as HTMLElement | null;
const controlsEl = document.getElementById("controls-container") as HTMLElement | null;

if (!canvas || !container || !controlsEl) {
  console.warn("Chromascope: required DOM elements not found (scope-canvas, scope-canvas-container, controls-container)");
  throw new Error("Chromascope: missing required DOM elements");
}

const ctx = canvas.getContext("2d");
if (!ctx) {
  throw new Error("Chromascope: failed to get 2d canvas context");
}

const scope = new Chromascope();

const controls = createControls(controlsEl, scope.settings, {
  onSettingsChange(partial: Partial<ChromascopeSettings>) {
    scope.updateSettings(partial);
    draw();
  },
});

attachScopeInteraction(
  canvas,
  () => canvas.width,
  {
    onHover(_polar) {},
    onHarmonyRotate(delta) {
      const newRotation = scope.settings.harmony.rotation + delta;
      scope.updateSettings({
        harmony: { ...scope.settings.harmony, rotation: newRotation },
      });
      controls.update(scope.settings);
      draw();
    },
    requestRedraw: () => draw(),
  },
);

function resize(): void {
  const rect = container.getBoundingClientRect();
  const size = Math.floor(Math.min(rect.width, rect.height));
  if (size < 10) return;

  canvas.width = size;
  canvas.height = size;
  canvas.style.width = `${size}px`;
  canvas.style.height = `${size}px`;
  draw();
}

const resizeObserver = new ResizeObserver(resize);
resizeObserver.observe(container);
window.addEventListener("beforeunload", () => resizeObserver.disconnect());

function draw(): void {
  const size = canvas.width;
  if (size < 10) return;
  scope.render(ctx, size);
}

onHostMessage((msg) => {
  switch (msg.type) {
    case "pixels": {
      const pixelData: PixelData = {
        data: new Uint8Array(msg.data),
        width: msg.width,
        height: msg.height,
        colorProfile: msg.colorProfile,
      };
      scope.setPixels(pixelData);
      draw();
      break;
    }
    case "settings": {
      const partial: Partial<ChromascopeSettings> = {};
      if (msg.colorSpace) partial.colorSpace = msg.colorSpace;
      if (msg.densityMode) partial.densityMode = msg.densityMode;
      if (msg.logScale !== undefined) partial.logScale = msg.logScale;
      if (msg.harmony) partial.harmony = msg.harmony;
      scope.updateSettings(partial);
      controls.update(scope.settings);
      draw();
      break;
    }
    case "highlight": {
      // Intentionally unhandled — reserved for future pixel-region highlighting
      break;
    }
  }
});

resize();
