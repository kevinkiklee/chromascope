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
        CanvasRenderingContext2D: "readonly",
        Uint8Array: "readonly",
        Uint8ClampedArray: "readonly",
        Float32Array: "readonly",
        Float64Array: "readonly",
      },
      sourceType: "commonjs",
    },
    rules: {
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
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
