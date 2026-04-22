import { defineConfig } from "vite";

export default defineConfig({
  build: {
    lib: {
      entry: "src/lib.ts",
      name: "ChromascopeCore",
      fileName: "chromascope-core",
      formats: ["iife"],
    },
    outDir: "build-lib",
    emptyOutDir: true,
    minify: true,
    rollupOptions: {
      output: {
        extend: true,
      },
    },
  },
});
