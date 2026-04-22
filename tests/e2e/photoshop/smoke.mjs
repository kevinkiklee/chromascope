#!/usr/bin/env node

import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../../..");
const RESULTS_DIR = path.join(REPO_ROOT, "test-results");
const JSX_PATH = path.join(__dirname, "create-test-doc.jsx");

fs.mkdirSync(RESULTS_DIR, { recursive: true });

const PS_APP_NAME = process.env.PS_APP_NAME || "Adobe Photoshop 2025";

function isPhotoshopRunning() {
  try {
    execSync("pgrep -x 'Adobe Photoshop'", { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

function runExtendScript(scriptPath) {
  try {
    execSync(
      `osascript -e 'tell application "${PS_APP_NAME}" to do javascript file "${scriptPath}"'`,
      { stdio: "pipe", timeout: 30000 }
    );
    return true;
  } catch (e) {
    console.error("  ExtendScript error:", e.message);
    console.error("  If your PS version differs, set PS_APP_NAME env var (e.g., PS_APP_NAME='Adobe Photoshop 2024')");
    return false;
  }
}

const results = [];
let passed = 0;
let failed = 0;

console.log("=== Photoshop Smoke Test ===");
console.log();

if (!isPhotoshopRunning()) {
  console.log("SKIP: Photoshop is not running.");
  console.log("Start Photoshop and load the Chromascope plugin, then re-run.");
  fs.writeFileSync(
    path.join(RESULTS_DIR, "photoshop-smoke.json"),
    JSON.stringify([{ name: "photoshop_smoke", status: "skipped", detail: "Photoshop not running" }], null, 2)
  );
  process.exit(0);
}

// Step 1: Create test document
console.log("Creating test document...");
if (!runExtendScript(JSX_PATH)) {
  console.log("  FAIL: Could not create test document.");
  console.log("  Note: You may need to grant automation permissions in System Settings > Privacy & Security > Automation.");
  results.push({ name: "create_test_doc", status: "failed", detail: "ExtendScript failed" });
  failed++;
} else {
  console.log("  PASS: Test document created.");
  results.push({ name: "create_test_doc", status: "passed" });
  passed++;
}

// Step 2: Verify plugin build artifacts
console.log();
console.log("Verifying plugin artifacts...");

const artifacts = [
  ["scope_bundle", path.join(REPO_ROOT, "plugins/photoshop/core/scope-bundle.js")],
  ["manifest", path.join(REPO_ROOT, "plugins/photoshop/manifest.json")],
  ["test_harness", path.join(REPO_ROOT, "plugins/photoshop/src/test-harness.js")],
];

for (const [name, filePath] of artifacts) {
  if (fs.existsSync(filePath)) {
    console.log(`  PASS: ${name} exists`);
    results.push({ name: `artifact_${name}`, status: "passed" });
    passed++;
  } else {
    console.log(`  FAIL: ${name} missing at ${filePath}`);
    results.push({ name: `artifact_${name}`, status: "failed", detail: "file missing" });
    failed++;
  }
}

console.log();
console.log("NOTE: Full automated bridge-based testing requires the UXP Developer Tool.");
console.log("The test harness is built into the plugin (test-harness.js) for future use.");
console.log();
console.log(`=== Results: ${passed} passed, ${failed} failed ===`);

fs.writeFileSync(
  path.join(RESULTS_DIR, "photoshop-smoke.json"),
  JSON.stringify(results, null, 2)
);

process.exit(failed > 0 ? 1 : 0);
