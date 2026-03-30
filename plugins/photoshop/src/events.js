const { action } = require("photoshop");

const DEBOUNCE_MS = 200;

let refreshCallback = null;
let debounceTimer = null;

const TRACKED_EVENTS = [
  "set", "select", "make", "delete",
  "open", "close", "save",
  "move", "transform", "crop",
  "fill", "stroke", "paint",
  "adjustments",
];

function debouncedRefresh() {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    if (refreshCallback) refreshCallback();
  }, DEBOUNCE_MS);
}

function handleEvent(eventName, descriptor) {
  debouncedRefresh();
}

async function startListening(onRefresh) {
  refreshCallback = onRefresh;
  await action.addNotificationListener(TRACKED_EVENTS, handleEvent);
}

async function stopListening() {
  if (debounceTimer) clearTimeout(debounceTimer);
  refreshCallback = null;

  try {
    await action.removeNotificationListener(TRACKED_EVENTS, handleEvent);
  } catch (e) {
    // Ignore errors during cleanup
  }
}

module.exports = { startListening, stopListening };
