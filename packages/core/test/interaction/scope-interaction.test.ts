import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { attachScopeInteraction } from "../../src/interaction/scope-interaction.js";

// Mock sendToHost -- it calls window.parent.postMessage
vi.mock("../../src/protocol.js", () => ({
  sendToHost: vi.fn(),
}));

import { sendToHost } from "../../src/protocol.js";

function createMockCanvas(size: number) {
  const listeners: Record<string, Function> = {};
  return {
    getBoundingClientRect: () => ({ left: 0, top: 0, width: size, height: size }),
    addEventListener: vi.fn((type: string, fn: Function) => {
      listeners[type] = fn;
    }),
    removeEventListener: vi.fn((type: string, _fn: Function) => {
      delete listeners[type];
    }),
    setPointerCapture: vi.fn(),
    releasePointerCapture: vi.fn(),
    _fire(type: string, overrides: Partial<PointerEvent> = {}) {
      listeners[type]?.({
        clientX: size / 2,
        clientY: size / 2,
        pointerId: 1,
        ...overrides,
      } as PointerEvent);
    },
    _listeners: listeners,
  } as unknown as HTMLCanvasElement & { _fire: Function; _listeners: Record<string, Function> };
}

describe("attachScopeInteraction", () => {
  const SIZE = 400;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("registers 4 pointer event listeners", () => {
    const canvas = createMockCanvas(SIZE);
    const cb = { onHover: vi.fn(), onHarmonyRotate: vi.fn(), requestRedraw: vi.fn() };
    attachScopeInteraction(canvas, () => SIZE, cb);
    expect(canvas.addEventListener).toHaveBeenCalledTimes(4);
  });

  it("returns a cleanup function that removes all listeners", () => {
    const canvas = createMockCanvas(SIZE);
    const cb = { onHover: vi.fn(), onHarmonyRotate: vi.fn(), requestRedraw: vi.fn() };
    const cleanup = attachScopeInteraction(canvas, () => SIZE, cb);
    cleanup();
    expect(canvas.removeEventListener).toHaveBeenCalledTimes(4);
  });

  it("calls onHover with polar coords when pointer moves inside scope", () => {
    const canvas = createMockCanvas(SIZE);
    const cb = { onHover: vi.fn(), onHarmonyRotate: vi.fn(), requestRedraw: vi.fn() };
    attachScopeInteraction(canvas, () => SIZE, cb);

    // Move to center -- radius should be ~0
    (canvas as any)._fire("pointermove", { clientX: 200, clientY: 200 });
    expect(cb.onHover).toHaveBeenCalledWith(
      expect.objectContaining({ radius: expect.any(Number) }),
    );
    expect(cb.onHover.mock.calls[0][0].radius).toBeLessThan(0.1);
  });

  it("calls onHover(null) when pointer moves outside scope radius", () => {
    const canvas = createMockCanvas(SIZE);
    const cb = { onHover: vi.fn(), onHarmonyRotate: vi.fn(), requestRedraw: vi.fn() };
    attachScopeInteraction(canvas, () => SIZE, cb);

    // Move to corner -- far outside maxR
    (canvas as any)._fire("pointermove", { clientX: 0, clientY: 0 });
    expect(cb.onHover).toHaveBeenCalledWith(null);
  });

  it("sends highlight message to host on hover inside scope", () => {
    const canvas = createMockCanvas(SIZE);
    const cb = { onHover: vi.fn(), onHarmonyRotate: vi.fn(), requestRedraw: vi.fn() };
    attachScopeInteraction(canvas, () => SIZE, cb);

    (canvas as any)._fire("pointermove", { clientX: 200, clientY: 200 });
    expect(sendToHost).toHaveBeenCalledWith(
      expect.objectContaining({ type: "highlight" }),
    );
  });

  it("calls requestRedraw on pointer move", () => {
    const canvas = createMockCanvas(SIZE);
    const cb = { onHover: vi.fn(), onHarmonyRotate: vi.fn(), requestRedraw: vi.fn() };
    attachScopeInteraction(canvas, () => SIZE, cb);

    (canvas as any)._fire("pointermove", { clientX: 200, clientY: 200 });
    expect(cb.requestRedraw).toHaveBeenCalled();
  });

  it("enters drag mode on pointerdown inside scope", () => {
    const canvas = createMockCanvas(SIZE);
    const cb = { onHover: vi.fn(), onHarmonyRotate: vi.fn(), requestRedraw: vi.fn() };
    attachScopeInteraction(canvas, () => SIZE, cb);

    (canvas as any)._fire("pointerdown", { clientX: 200, clientY: 200, pointerId: 1 });
    expect(canvas.setPointerCapture).toHaveBeenCalledWith(1);
  });

  it("calls onHarmonyRotate during drag", () => {
    const canvas = createMockCanvas(SIZE);
    const cb = { onHover: vi.fn(), onHarmonyRotate: vi.fn(), requestRedraw: vi.fn() };
    attachScopeInteraction(canvas, () => SIZE, cb);

    // Start drag at center
    (canvas as any)._fire("pointerdown", { clientX: 200, clientY: 200, pointerId: 1 });
    // Move while dragging
    (canvas as any)._fire("pointermove", { clientX: 250, clientY: 200 });
    expect(cb.onHarmonyRotate).toHaveBeenCalled();
  });

  it("exits drag mode on pointerup", () => {
    const canvas = createMockCanvas(SIZE);
    const cb = { onHover: vi.fn(), onHarmonyRotate: vi.fn(), requestRedraw: vi.fn() };
    attachScopeInteraction(canvas, () => SIZE, cb);

    (canvas as any)._fire("pointerdown", { clientX: 200, clientY: 200, pointerId: 1 });
    (canvas as any)._fire("pointerup", { pointerId: 1 });
    expect(canvas.releasePointerCapture).toHaveBeenCalledWith(1);

    // Subsequent move should call onHover, not onHarmonyRotate
    cb.onHarmonyRotate.mockClear();
    (canvas as any)._fire("pointermove", { clientX: 250, clientY: 200 });
    expect(cb.onHarmonyRotate).not.toHaveBeenCalled();
  });

  it("resets drag state and calls onHover(null) on pointerleave", () => {
    const canvas = createMockCanvas(SIZE);
    const cb = { onHover: vi.fn(), onHarmonyRotate: vi.fn(), requestRedraw: vi.fn() };
    attachScopeInteraction(canvas, () => SIZE, cb);

    (canvas as any)._fire("pointerleave");
    expect(cb.onHover).toHaveBeenCalledWith(null);
    expect(cb.requestRedraw).toHaveBeenCalled();
  });
});
