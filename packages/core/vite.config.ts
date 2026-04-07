import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

export default defineConfig({
  root: "src",
  build: {
    outDir: "../build",
    emptyOutDir: true,
  },
  plugins: [viteSingleFile()],
  test: {
    include: ["../test/**/*.test.ts"],
    setupFiles: ["../test/setup.ts"],
  },
});
