import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"], // single entry point
  outDir: "dist",
  format: ["esm", "cjs"],
  dts: true, // generates index.d.ts
  target: "es2019", // good balance for Node 14+
  splitting: false, // library, not app
  sourcemap: false,
  clean: true,
});
