import { defineConfig } from "vite-plus";

export default defineConfig({
  pack: {
    entry: {
      main: 'src/resumable.ts',
      helpers: 'src/resumableHelpers.ts',
    },
    format: 'esm',
    platform: "browser",
    target: 'baseline-widely-available',
    dts: true,
    sourcemap: true,
  },
  fmt: {},
  lint: {
    jsPlugins: [{ name: "vite-plus", specifier: "vite-plus/oxlint-plugin" }],
    rules: { "vite-plus/prefer-vite-plus-imports": "error" },
    options: { typeAware: true, typeCheck: true },
  },
});
