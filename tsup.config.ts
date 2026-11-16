import { defineConfig } from "tsup";

const shared = {
  outDir: "dist",
  format: ["esm", "cjs"] as ("esm" | "cjs")[],
  dts: true,
  target: "es2019",
  splitting: false,
  sourcemap: false,
  external: ["next", "react", "react-dom"],
};

export default defineConfig([
  {
    ...shared,
    entry: { index: "src/index.ts" },
    clean: true,
    // tsup strips directives, so re-add it for the client entry.
    banner: { js: '"use client";' },
  },
  {
    ...shared,
    entry: { server: "src/server.ts" },
  },
]);
