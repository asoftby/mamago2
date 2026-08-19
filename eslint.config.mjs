import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",

    "node_modules/**",
    ".claude/**",
    ".turbo/**",
    "coverage/**",
    "dist/**",
  ]),
  ...nextVitals,
  ...nextTs,
  {
    // §21 Step 6, Phase D: logAudit() is a frozen legacy compatibility
    // shim over logAdminAudit() — new admin/audit writes must import the
    // canonical logAdminAudit directly. The regex matches the imported
    // module regardless of specifier form (relative or "@/..." alias);
    // importNames scopes the restriction to the single named export
    // `logAudit`, leaving the module's read helpers (getUserAuditLog,
    // getAdminAuditLog) and the AuditLogParams type fully importable.
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              regex: "auditLog\\.service$",
              importNames: ["logAudit"],
              message:
                "logAudit is a frozen legacy compatibility shim (§21 Step 6). New admin/audit writes must import logAdminAudit from '@/server/services/adminAuditLog.service' instead.",
            },
          ],
        },
      ],
    },
  },
  {
    // Grandfathered exact files (§21 Step 6, Phase D) — not a folder
    // exemption: userModeration.service.ts is the sole existing legacy
    // production caller, kept until naturally touched; the adapter test
    // must import the real logAudit to test the compatibility shim
    // itself, which is not a new product write-path use.
    files: [
      "src/server/services/userModeration.service.ts",
      "src/server/services/auditLog.adapter.test.ts",
    ],
    rules: {
      "no-restricted-imports": "off",
    },
  },
]);

export default eslintConfig;
