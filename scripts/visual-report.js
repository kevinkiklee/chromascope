#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

const RESULTS_DIR = path.join(__dirname, "..", "test-results");
const OUTPUT = path.join(RESULTS_DIR, "visual-report.html");

function loadJson(file) {
  const p = path.join(RESULTS_DIR, file);
  if (!fs.existsSync(p)) return [];
  return JSON.parse(fs.readFileSync(p, "utf-8"));
}

function imgTag(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return "<span>N/A</span>";
  const data = fs.readFileSync(filePath);
  const b64 = data.toString("base64");
  return `<img src="data:image/png;base64,${b64}" style="max-width:256px;image-rendering:pixelated;">`;
}

function buildReport() {
  const rustResults = loadJson("rust-visual-results.json");
  const coreResults = loadJson("core-visual-results.json");
  const psResults = loadJson("photoshop-visual.json");

  const all = [
    ...rustResults.map(r => ({ ...r, renderer: "Rust" })),
    ...coreResults.map(r => ({ ...r, renderer: "Core" })),
    ...psResults.map(r => ({ ...r, renderer: "Photoshop" })),
  ];

  const passed = all.filter(r => r.status === "passed").length;
  const failed = all.filter(r => r.status === "failed").length;
  const newCount = all.filter(r => r.status === "new").length;
  const updated = all.filter(r => r.status === "baseline_updated").length;

  const sorted = [...all].sort((a, b) => {
    const order = { failed: 0, new: 1, passed: 2, baseline_updated: 3 };
    return (order[a.status] ?? 4) - (order[b.status] ?? 4);
  });

  const rows = sorted.map(r => {
    const statusClass = r.status === "failed" ? "failed" : r.status === "new" ? "new" : "";
    const metric = r.rmse != null
      ? `RMSE: ${r.rmse.toFixed(4)}`
      : r.diffPercent != null
        ? `Diff: ${(r.diffPercent * 100).toFixed(3)}%`
        : "";
    const detailsContent = (r.status === "failed" || r.status === "new")
      ? `<details><summary>Show images</summary>
          <div class="images">
            <div><h4>Baseline</h4>${imgTag(r.baseline_path || r.baseline)}</div>
            <div><h4>Actual</h4>${imgTag(r.actual_path || r.actual)}</div>
            <div><h4>Diff</h4>${imgTag(r.diff_path || r.diff)}</div>
          </div>
        </details>`
      : "";

    return `<tr class="${statusClass}">
      <td>${r.renderer}</td>
      <td>${r.name}</td>
      <td>${r.status}</td>
      <td>${metric}</td>
      <td>${detailsContent}</td>
    </tr>`;
  }).join("\n");

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Chromascope Visual Regression Report</title>
<style>
  body { font-family: system-ui; margin: 2em; background: #0d0d0f; color: #e0e0e0; }
  .summary { display: flex; gap: 1em; margin-bottom: 1.5em; }
  .summary span { padding: 0.5em 1em; border-radius: 6px; font-weight: 600; }
  .s-pass { background: #1a3a1a; color: #4ade80; }
  .s-fail { background: #3a1a1a; color: #f87171; }
  .s-new { background: #3a3a1a; color: #facc15; }
  .s-updated { background: #1a2a3a; color: #60a5fa; }
  table { width: 100%; border-collapse: collapse; }
  th, td { padding: 0.5em 0.75em; text-align: left; border-bottom: 1px solid #222; }
  th { background: #161618; }
  tr.failed { background: #2a1111; }
  tr.new { background: #2a2a11; }
  .images { display: flex; gap: 1em; margin-top: 0.5em; }
  .images img { border: 1px solid #333; }
  details summary { cursor: pointer; color: #60a5fa; }
</style></head><body>
<h1>Chromascope Visual Regression Report</h1>
<div class="summary">
  <span class="s-pass">${passed} passed</span>
  <span class="s-fail">${failed} failed</span>
  <span class="s-new">${newCount} new</span>
  <span class="s-updated">${updated} updated</span>
</div>
<table>
  <thead><tr><th>Renderer</th><th>Test</th><th>Status</th><th>Metric</th><th>Details</th></tr></thead>
  <tbody>${rows}</tbody>
</table>
</body></html>`;

  fs.mkdirSync(RESULTS_DIR, { recursive: true });
  fs.writeFileSync(OUTPUT, html);
  console.log("Report written to", OUTPUT);
  console.log(`  ${passed} passed, ${failed} failed, ${newCount} new, ${updated} updated`);

  return failed;
}

const failCount = buildReport();
process.exit(failCount > 0 ? 1 : 0);
