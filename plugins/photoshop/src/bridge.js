let webviewElement = null;

function init(webview) {
  webviewElement = webview;
}

function sendPixels(pixelResult) {
  if (!webviewElement || !pixelResult) return;

  webviewElement.postMessage({
    type: "pixels",
    data: Array.from(pixelResult.data),
    width: pixelResult.width,
    height: pixelResult.height,
    colorProfile: pixelResult.colorProfile,
  });
}

function sendSettings(settings) {
  if (!webviewElement) return;
  webviewElement.postMessage({ type: "settings", ...settings });
}

function sendHighlight(x, y) {
  if (!webviewElement) return;
  webviewElement.postMessage({ type: "highlight", x, y });
}

function onScopeMessage(handler) {
  if (!webviewElement) return () => {};

  const listener = (event) => {
    const data = event.data;
    if (data && typeof data.type === "string") {
      handler(data);
    }
  };

  webviewElement.addEventListener("message", listener);
  return () => webviewElement.removeEventListener("message", listener);
}

module.exports = { init, sendPixels, sendSettings, sendHighlight, onScopeMessage };
