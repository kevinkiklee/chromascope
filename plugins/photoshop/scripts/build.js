const fs = require("fs");
const path = require("path");

const coreSource = path.resolve(__dirname, "../../../packages/core/build/index.html");
const coreDest = path.resolve(__dirname, "../core/index.html");

if (fs.existsSync(coreSource)) {
  fs.mkdirSync(path.dirname(coreDest), { recursive: true });
  fs.copyFileSync(coreSource, coreDest);
  console.log("Copied core build → plugins/photoshop/core/index.html");
} else {
  console.error("Core build not found! Run 'turbo run build --filter=@vectorscope/core' first.");
  process.exit(1);
}

console.log("Photoshop plugin build complete.");
