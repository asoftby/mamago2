/**
 * Lint-guard regression test (§21 Step 6, Phase F).
 *
 * Uses ESLint's Node API with lintText() — everything is linted as an
 * in-memory virtual file against the repo's real eslint.config.mjs;
 * nothing is written to disk, so no violating fixture ever lands in the
 * commit.
 *
 * Run: npx tsx src/server/services/auditLog.eslintGuard.test.ts
 */
import assert from "node:assert/strict";
import { ESLint } from "eslint";

async function lint(code: string, filePath: string) {
  const eslint = new ESLint({ cwd: process.cwd() });
  const results = await eslint.lintText(code, { filePath });
  return results[0]?.messages ?? [];
}

async function main() {
  // A brand-new, non-grandfathered file importing logAudit violates the guard.
  {
    const messages = await lint(
      `import { logAudit } from "@/server/services/auditLog.service";\nexport const x = logAudit;\n`,
      "src/server/services/__fixture_new_logAudit_use.ts",
    );
    const hit = messages.find((m) => m.ruleId === "no-restricted-imports");
    assert.ok(hit, "a new, non-grandfathered logAudit import must violate no-restricted-imports");
  }

  // The canonical logAdminAudit import remains fully allowed.
  {
    const messages = await lint(
      `import { logAdminAudit } from "@/server/services/adminAuditLog.service";\nexport const x = logAdminAudit;\n`,
      "src/server/services/__fixture_logAdminAudit_use.ts",
    );
    const hit = messages.find((m) => m.ruleId === "no-restricted-imports");
    assert.equal(hit, undefined, "logAdminAudit import must remain unrestricted");
  }

  // Legacy read helpers and the params type from the same module stay importable.
  {
    const messages = await lint(
      `import { getUserAuditLog, getAdminAuditLog, type AuditLogParams } from "@/server/services/auditLog.service";\nexport const x = { getUserAuditLog, getAdminAuditLog };\nexport type Y = AuditLogParams;\n`,
      "src/server/services/__fixture_legacy_reads_use.ts",
    );
    const hit = messages.find((m) => m.ruleId === "no-restricted-imports");
    assert.equal(hit, undefined, "read helpers and the params type must remain importable everywhere");
  }

  // The production legacy caller stays exempt, relative-import form included.
  {
    const messages = await lint(
      `import { logAudit } from "./auditLog.service";\nexport const x = logAudit;\n`,
      "src/server/services/userModeration.service.ts",
    );
    const hit = messages.find((m) => m.ruleId === "no-restricted-imports");
    assert.equal(hit, undefined, "the grandfathered production caller must remain exempt from the restriction");
  }

  // The adapter's own test file is grandfathered too — it must import the
  // real logAudit to test the compatibility shim, which is not a new
  // product write-path use.
  {
    const messages = await lint(
      `import { logAudit } from "./auditLog.service";\nexport const x = logAudit;\n`,
      "src/server/services/auditLog.adapter.test.ts",
    );
    const hit = messages.find((m) => m.ruleId === "no-restricted-imports");
    assert.equal(hit, undefined, "the adapter's own test file must remain exempt from the restriction");
  }

  console.log("auditLog.eslintGuard.test.ts: OK");
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
