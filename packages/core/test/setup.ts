import { vi } from "vitest";

/**
 * Minimal OffscreenCanvas polyfill for the Node/Vitest test environment.
 * OffscreenCanvas is a browser API not available in Node — this stub allows
 * code that creates an OffscreenCanvas to run without errors in tests.
 */
function createMockCtx2D() {
  return {
    clearRect: vi.fn(),
    fillRect: vi.fn(),
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
    font: "",
    textAlign: "center",
    textBaseline: "middle",
    globalAlpha: 1,
    globalCompositeOperation: "source-over",
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    arc: vi.fn(),
    stroke: vi.fn(),
    fill: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    fillText: vi.fn(),
    drawImage: vi.fn(),
    createImageData: vi.fn(),
    putImageData: vi.fn(),
    getImageData: vi.fn(),
    setLineDash: vi.fn(),
    getLineDash: vi.fn(() => []),
    closePath: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    scale: vi.fn(),
  };
}

class MockOffscreenCanvas {
  width: number;
  height: number;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
  }

  getContext(contextId: string) {
    if (contextId === "2d") return createMockCtx2D();
    return null;
  }
}

if (typeof globalThis.OffscreenCanvas === "undefined") {
  // @ts-expect-error — polyfilling browser API in Node test environment
  globalThis.OffscreenCanvas = MockOffscreenCanvas;
}
