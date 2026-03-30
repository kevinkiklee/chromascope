// packages/core/src/interaction/scope-interaction.ts

import { canvasToPolar, type PolarCoord } from "./hit-test.js";
import { isPointInZone } from "../overlays/harmony-zones.js";
import { sendToHost } from "../protocol.js";
import type { HarmonyZone } from "../types.js";

export interface InteractionCallbacks {
  onHover: (polar: PolarCoord | null) => void;
  onHarmonyRotate: (deltaRadians: number) => void;
  requestRedraw: () => void;
}

export function attachScopeInteraction(
  canvas: HTMLCanvasElement,
  size: () => number,
  getZones: () => HarmonyZone[],
  callbacks: InteractionCallbacks,
): () => void {
  let isDragging = false;
  let dragStartAngle = 0;

  function onPointerMove(e: PointerEvent) {
    const rect = canvas.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const polar = canvasToPolar(px, py, size());

    if (isDragging) {
      const delta = polar.angle - dragStartAngle;
      callbacks.onHarmonyRotate(delta);
      dragStartAngle = polar.angle;
      return;
    }

    if (polar.radius <= 1.0) {
      callbacks.onHover(polar);
      sendToHost({
        type: "highlight",
        region: { angle: polar.angle, radius: polar.radius, width: 0.1 },
      });
    } else {
      callbacks.onHover(null);
    }

    callbacks.requestRedraw();
  }

  function onPointerDown(e: PointerEvent) {
    const rect = canvas.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const polar = canvasToPolar(px, py, size());

    if (polar.radius <= 1.0) {
      isDragging = true;
      dragStartAngle = polar.angle;
      canvas.setPointerCapture(e.pointerId);
    }
  }

  function onPointerUp(e: PointerEvent) {
    isDragging = false;
    canvas.releasePointerCapture(e.pointerId);
  }

  function onPointerLeave() {
    isDragging = false;
    callbacks.onHover(null);
    callbacks.requestRedraw();
  }

  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("pointerleave", onPointerLeave);

  return () => {
    canvas.removeEventListener("pointermove", onPointerMove);
    canvas.removeEventListener("pointerdown", onPointerDown);
    canvas.removeEventListener("pointerup", onPointerUp);
    canvas.removeEventListener("pointerleave", onPointerLeave);
  };
}
