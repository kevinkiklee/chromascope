import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { sendToHost, onHostMessage } from "../src/protocol.js";

describe("sendToHost", () => {
  let postMessageSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    postMessageSpy = vi.fn();
    vi.stubGlobal("window", {
      parent: { postMessage: postMessageSpy },
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("posts an edit message to parent window", () => {
    const msg = { type: "edit" as const, mode: "hsl" as const, params: { hue: 10 } };
    sendToHost(msg);
    expect(postMessageSpy).toHaveBeenCalledWith(msg, "*");
  });

  it("posts a highlight message to parent window", () => {
    const msg = {
      type: "highlight" as const,
      region: { angle: 1.2, radius: 0.5, width: 0.1 },
    };
    sendToHost(msg);
    expect(postMessageSpy).toHaveBeenCalledWith(msg, "*");
  });
});

describe("onHostMessage", () => {
  let addSpy: ReturnType<typeof vi.fn>;
  let removeSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    addSpy = vi.fn();
    removeSpy = vi.fn();
    vi.stubGlobal("window", {
      parent: { postMessage: vi.fn() },
      addEventListener: addSpy,
      removeEventListener: removeSpy,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("registers a message event listener", () => {
    const handler = vi.fn();
    onHostMessage(handler);
    expect(addSpy).toHaveBeenCalledWith("message", expect.any(Function));
  });

  it("returns a cleanup function that removes the listener", () => {
    const handler = vi.fn();
    const cleanup = onHostMessage(handler);
    cleanup();
    expect(removeSpy).toHaveBeenCalledWith("message", expect.any(Function));
  });

  it("calls handler for messages with a type string", () => {
    const handler = vi.fn();
    onHostMessage(handler);

    const listener = addSpy.mock.calls[0][1];
    listener({ data: { type: "pixels", data: [], width: 1, height: 1, colorProfile: "sRGB" } });

    expect(handler).toHaveBeenCalledWith({
      type: "pixels",
      data: [],
      width: 1,
      height: 1,
      colorProfile: "sRGB",
    });
  });

  it("ignores messages without a type string", () => {
    const handler = vi.fn();
    onHostMessage(handler);

    const listener = addSpy.mock.calls[0][1];
    listener({ data: { foo: "bar" } });
    listener({ data: null });
    listener({ data: 42 });

    expect(handler).not.toHaveBeenCalled();
  });

  it("passes settings messages to handler", () => {
    const handler = vi.fn();
    onHostMessage(handler);

    const listener = addSpy.mock.calls[0][1];
    listener({ data: { type: "settings", densityMode: "heatmap" } });

    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({ type: "settings", densityMode: "heatmap" }),
    );
  });
});
