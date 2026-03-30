const { entrypoints } = require("uxp");

let getDocumentPixels, events, handleEditCommand;
let isRefreshing = false;
let statusBar = null;

async function refresh() {
  if (isRefreshing) return;
  isRefreshing = true;

  try {
    if (statusBar) statusBar.textContent = "Refreshing...";
    const pixels = await getDocumentPixels();

    if (pixels) {
      // Call core directly -- no webview postMessage needed
      if (window.__chromascope) {
        window.__chromascope.setPixels(pixels);
      }
      if (statusBar) statusBar.textContent = `${pixels.width}×${pixels.height} · ${pixels.colorProfile}`;
    } else {
      if (statusBar) statusBar.textContent = "No document open";
    }
  } catch (err) {
    console.error("Chromascope refresh error:", err);
    if (statusBar) statusBar.textContent = "Error: " + String(err);
  } finally {
    isRefreshing = false;
  }
}

async function init() {
  const imaging = require("./src/imaging.js");
  getDocumentPixels = imaging.getDocumentPixels;
  events = require("./src/events.js");
  handleEditCommand = require("./src/edits.js").handleEditCommand;

  statusBar = document.getElementById("status-bar");

  console.log("[main] __chromascope available:", !!window.__chromascope);

  // Trigger canvas resize after panel layout is stable
  setTimeout(() => {
    const container = document.getElementById("scope-canvas-container");
    const canvas = document.getElementById("scope-canvas");
    if (container && canvas) {
      const rect = container.getBoundingClientRect();
      const size = Math.floor(Math.min(rect.width, rect.height));
      console.log("[main] container size:", rect.width, "x", rect.height, "canvas:", size);
      if (size > 10) {
        canvas.width = size;
        canvas.height = size;
        canvas.style.width = size + "px";
        canvas.style.height = size + "px";
      }
    }
    refresh();
  }, 300);

  await events.startListening(refresh);
}

entrypoints.setup({
  panels: {
    chromascopePanel: {
      show() {
        init();
      },
      hide() {
        if (events) events.stopListening();
      },
    },
  },
});
