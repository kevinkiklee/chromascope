const bridge = require("./bridge.js");
const { getDocumentPixels } = require("./imaging.js");
const events = require("./events.js");
const { handleEditCommand } = require("./edits.js");

const statusBar = document.getElementById("status-bar");

let isRefreshing = false;

async function refresh() {
  if (isRefreshing) return;
  isRefreshing = true;

  try {
    statusBar.textContent = "Refreshing...";
    const pixels = await getDocumentPixels();

    if (pixels) {
      bridge.sendPixels(pixels);
      statusBar.textContent = `${pixels.width}×${pixels.height} · ${pixels.colorProfile}`;
    } else {
      statusBar.textContent = "No document open";
    }
  } catch (err) {
    console.error("ChromaScope refresh error:", err);
    statusBar.textContent = "Error: " + (err.message || "unknown");
  } finally {
    isRefreshing = false;
  }
}

async function init() {
  const webview = document.getElementById("scope-webview");
  bridge.init(webview);

  bridge.onScopeMessage(async (msg) => {
    if (msg.type === "edit") {
      await handleEditCommand(msg);
      await refresh();
    }
  });

  await events.startListening(refresh);

  setTimeout(refresh, 500);
}

const entrypoints = require("uxp").entrypoints;

entrypoints.setup({
  panels: {
    chromascopePanel: {
      show() {
        init();
      },
      hide() {
        events.stopListening();
      },
    },
  },
});
