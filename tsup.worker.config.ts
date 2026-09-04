import { defineConfig } from "tsup";

/**
 * Builds the Operations Center worker plus narrow production operations
 * entrypoints into dist/. Next's `next build` does not compile these — they
 * are separate, plain Node processes shipped in the same image.
 *
 * Third-party deps (prisma client, pg, ...) stay external: the Docker
 * runner image already copies the full (unpruned) node_modules from the
 * builder stage, so requiring them at runtime needs no bundling here.
 */
export default defineConfig({
  entry: {
    "worker/index": "src/worker/index.ts",
    "ops/resync-event-sessions-from-schedule-json":
      "scripts/resync-event-sessions-from-schedule-json.ts",
  },
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
