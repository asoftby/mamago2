import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { auditSourceDirectory, toMarkdown } from "./design-system-audit.mjs";

test("inventory scans JSX source, ignores tests, and reports exact line numbers", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mamago-ds-audit-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, "src", "components"), { recursive: true });
  fs.writeFileSync(path.join(root, "src", "components", "Sample.tsx"), [
    'export function Sample() {',
    '  return <><button className="bg-[#EF8759] rounded-[16px]">OK</button><Chip active>Filter</Chip></>;',
    '}',
  ].join("\n"));
  fs.writeFileSync(path.join(root, "src", "components", "Sample.test.tsx"), '<button>ignored</button>');
  const report = auditSourceDirectory(root);
  assert.equal(report.scannedFiles, 1);
  assert.equal(report.counts["native-button"], 1);
  assert.equal(report.counts["hex-color"], 1);
  assert.equal(report.counts["arbitrary-radius"], 1);
  assert.equal(report.counts["chip-component"], 1);
  assert.equal(report.findings.find((item) => item.rule === "native-button")?.line, 2);
  assert.match(toMarkdown(report), /Sample\.tsx:2/);
});

test("empty project returns zero counts", () => {
  const report = auditSourceDirectory(path.join(os.tmpdir(), "missing-mamago-ds-project"));
  assert.equal(report.scannedFiles, 0);
  assert.equal(report.counts["native-button"], 0);
});
