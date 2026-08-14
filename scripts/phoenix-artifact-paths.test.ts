import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, realpathSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  requireResolvedArtifact,
  resolvePhoenixArtifactRoot,
  verifyPhoenixArtifactChecksum,
} from "./phoenix-artifact-paths";

const VARIABLE = "PHOENIX_SOURCE_SNAPSHOT_ROOT";
const PRIVATE_MARKER = "private-person@example.invalid";

function fixture(): { root: string; capture: string } {
  const root = mkdtempSync(join(tmpdir(), "phoenix-artifact-root-test-"));
  const directory = join(root, "users");
  const capture = join(directory, "capture.json");
  mkdirSync(directory);
  writeFileSync(capture, JSON.stringify({ private: PRIVATE_MARKER }));
  return { root, capture };
}

test("missing variable fails closed and names only the variable", () => {
  assert.throws(
    () => resolvePhoenixArtifactRoot(VARIABLE, ["users/capture.json"], {}),
    (error: unknown) => {
      assert.match(String(error), new RegExp(`MISSING_${VARIABLE}`));
      assert.doesNotMatch(String(error), new RegExp(PRIVATE_MARKER));
      return true;
    },
  );
});

test("an explicit absolute root resolves only the expected filename", () => {
  const { root, capture } = fixture();
  const resolved = resolvePhoenixArtifactRoot(VARIABLE, ["users/capture.json"], { [VARIABLE]: root });
  assert.equal(requireResolvedArtifact(resolved, "users/capture.json"), realpathSync(capture));
  assert.throws(() => requireResolvedArtifact(resolved, "places/capture.json"), /UNEXPECTED_ARTIFACT_FILENAME/);
});

test("relative roots and traversal escapes are rejected", () => {
  assert.throws(() => resolvePhoenixArtifactRoot(VARIABLE, ["users/capture.json"], { [VARIABLE]: "relative" }), /MUST_BE_ABSOLUTE/);
  const { root } = fixture();
  assert.throws(() => resolvePhoenixArtifactRoot(VARIABLE, ["../capture.json"], { [VARIABLE]: root }), /ARTIFACT_PATH_TRAVERSAL/);
});

test("symlink escapes are rejected where symlinks are supported", (context) => {
  const { root } = fixture();
  const outside = mkdtempSync(join(tmpdir(), "phoenix-artifact-outside-test-"));
  writeFileSync(join(outside, "capture.json"), "outside");
  mkdirSync(join(root, "linked"));
  try {
    symlinkSync(join(outside, "capture.json"), join(root, "linked", "capture.json"));
  } catch {
    context.skip("symlinks are unavailable on this platform");
    return;
  }
  assert.throws(() => resolvePhoenixArtifactRoot(VARIABLE, ["linked/capture.json"], { [VARIABLE]: root }), /ARTIFACT_SYMLINK_ESCAPE/);
});

test("checksum validation still executes without exposing file content", () => {
  const { capture } = fixture();
  const checksum = createHash("sha256").update(JSON.stringify({ private: PRIVATE_MARKER })).digest("hex");
  verifyPhoenixArtifactChecksum(capture, checksum);
  assert.throws(
    () => verifyPhoenixArtifactChecksum(capture, "0".repeat(64)),
    (error: unknown) => {
      assert.match(String(error), /ARTIFACT_CHECKSUM_MISMATCH/);
      assert.doesNotMatch(String(error), new RegExp(PRIVATE_MARKER));
      return true;
    },
  );
});
