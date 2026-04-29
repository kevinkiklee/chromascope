import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default [
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["packages/core/src/**/*.ts"],
    rules: {
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    },
  },
  {
    files: ["plugins/photoshop/src/**/*.js"],
    languageOptions: {
      globals: {
        require: "readonly",
        module: "readonly",
        console: "readonly",
        window: "readonly",
        document: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        requestAnimationFrame: "readonly",
        cancelAnimationFrame: "readonly",
        btoa: "readonly",
        atob: "readonly",
        CanvasRenderingContext2D: "readonly",
        Uint8Array: "readonly",
        Uint8ClampedArray: "readonly",
        Uint32Array: "readonly",
        Float32Array: "readonly",
        Float64Array: "readonly",
        // ChromascopeCore is the IIFE exported by the bundled core HTML at runtime.
        ChromascopeCore: "readonly",
      },
      sourceType: "commonjs",
    },
    rules: {
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" }],
      "no-redeclare": "off",
      "@typescript-eslint/no-require-imports": "off",
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
  {
    ignores: [
      "**/build/**",
      "**/build-lib/**",
      "**/dist/**",
      "**/node_modules/**",
      "**/core/scope-bundle.js",
      "**/*.test.*",
      "**/__tests__/**",
    ],
  },
];
