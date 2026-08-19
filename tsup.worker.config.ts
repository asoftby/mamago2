import { defineConfig } from "tsup";

/**
 * Builds the Operations Center worker entrypoint into dist/worker/index.js.
 * Next's `next build` does not compile this — it's a separate, plain Node
 * process shipped in the same image, started with a different command.
 *
 * Third-party deps (prisma client, pg, ...) stay external: the Docker
 * runner image already copies the full (unpruned) node_modules from the
 * builder stage, so requiring them at runtime needs no bundling here.
 */
export default defineConfig({
  entry: { "worker/index": "src/worker/index.ts" },
  format: ["cjs"],
  platform: "node",
  target: "node22",
  outDir: "dist",
  clean: true,
  sourcemap: true,
  splitting: false,
  dts: false,
  skipNodeModulesBundle: true,
  tsconfig: "tsconfig.json",
});
