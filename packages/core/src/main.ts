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

canvas.setAttribute("role", "img");
canvas.setAttribute("aria-label", "Vectorscope visualization showing color distribution");

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

let resizeRafId = 0;
const resizeObserver = new ResizeObserver(() => {
  cancelAnimationFrame(resizeRafId);
  resizeRafId = requestAnimationFrame(resize);
});
resizeObserver.observe(container);
window.addEventListener("beforeunload", () => resizeObserver.disconnect());

// Batches redraw requests within a single animation frame so rapid setting
// changes (slider drag, message bursts) collapse to one render per frame.
let drawScheduled = false;
function draw(): void {
  if (drawScheduled) return;
  drawScheduled = true;
  requestAnimationFrame(() => {
    drawScheduled = false;
    const size = canvas.width;
    if (size < 10) return;
    scope.render(ctx, size);
  });
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

interface ChromascopeTestHarness {
  instance: Chromascope;
  canvas: HTMLCanvasElement;
  injectPixels: (rgbaData: number[], width: number, height: number) => void;
  updateSettings: (partial: Partial<ChromascopeSettings>) => void;
}

declare global {
  interface Window {
    __chromascopeTest?: ChromascopeTestHarness;
  }
}

if (new URLSearchParams(window.location.search).has("test")) {
  const harness: ChromascopeTestHarness = {
    instance: scope,
    canvas,
    injectPixels(rgbaData, width, height) {
      const rgb = new Uint8Array(width * height * 3);
      for (let i = 0, src = 0, dst = 0; i < width * height; i++, src += 4, dst += 3) {
        rgb[dst] = rgbaData[src];
        rgb[dst + 1] = rgbaData[src + 1];
        rgb[dst + 2] = rgbaData[src + 2];
      }
      scope.setPixels({ data: rgb, width, height });
      draw();
    },
    updateSettings(partial) {
      scope.updateSettings(partial);
      controls.update(scope.settings);
      draw();
    },
  };
  window.__chromascopeTest = harness;
}
