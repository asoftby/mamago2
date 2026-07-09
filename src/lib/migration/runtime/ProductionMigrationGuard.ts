import { join } from "node:path";

import { isGlobalNoindexEnabled } from "@/lib/seo/globalNoindex";
import {
  deriveAllowedSectionsFromAppDir,
  loadRedirectManifest,
} from "@/lib/seo/redirectManifest";
import type { MigrationProfile } from "./MigrationProfile";

export interface ProductionMigrationGuardIssue {
  code: string;
  message: string;
}

export interface ProductionMigrationGuardResult {
  passed: boolean;
  issues: ProductionMigrationGuardIssue[];
}

export interface ProductionMigrationGuardInput {
  profile: MigrationProfile;
  confirmProduction: boolean;
  /** Defaults to `<cwd>/manifest.csv`, same as next.config.ts. */
  manifestPath?: string;
  /** Defaults to `REDIRECT_MANIFEST_MIN_ROWS` env or 900, same as next.config.ts. */
  minRedirectRows?: number;
  /** Defaults to `<cwd>/src/app`. */
  appDir?: string;
  /** Injectable for tests; defaults to `isGlobalNoindexEnabled()`. */
  isIndexingBlocked?: () => boolean;
}

/**
 * Preflight for a PRODUCTION-profile migration run. Deliberately narrow:
 * it checks the same redirect-manifest validity next.config.ts enforces at
 * build time and the same global-noindex flag robots.ts reads, rather than
 * a full SEO audit — a bigger SEO preflight is out of scope here.
 */
export function evaluateProductionMigrationGuard(
  input: ProductionMigrationGuardInput,
): ProductionMigrationGuardResult {
  const issues: ProductionMigrationGuardIssue[] = [];

  if (input.profile.name !== "PRODUCTION") {
    return { passed: true, issues };
  }

  if (!input.confirmProduction) {
    issues.push({
      code: "PRODUCTION_CONFIRMATION_MISSING",
      message:
        "Migration profile is PRODUCTION but --confirm-production was not passed. Refusing to run.",
    });
  }

  if (input.profile.redirectPolicy.validateManifest) {
    const manifestPath = input.manifestPath ?? join(process.cwd(), "manifest.csv");
    const appDir = input.appDir ?? join(process.cwd(), "src", "app");
    const minRows =
      input.minRedirectRows ?? Number(process.env.REDIRECT_MANIFEST_MIN_ROWS ?? "900");

    const manifest = loadRedirectManifest({
      manifestPath,
      require: false,
      minRows,
      allowedSections: deriveAllowedSectionsFromAppDir(appDir),
      warn: () => {},
    });

    for (const issue of manifest.issues) {
      issues.push({
        code: `REDIRECT_MANIFEST_${issue.kind.toUpperCase().replace(/-/g, "_")}`,
        message: issue.message,
      });
    }
  }

  if (input.profile.seoPolicy.requireIndexingEnabled) {
    const isIndexingBlocked = input.isIndexingBlocked ?? isGlobalNoindexEnabled;
    if (isIndexingBlocked()) {
      issues.push({
        code: "SEO_INDEXING_DISABLED",
        message:
          "Migration profile requires indexing enabled for production launch, but the site is " +
          "still globally noindexed. Set SITE_INDEXING_ENABLED=true (and confirm " +
          "SITE_NOINDEX_FORCE/SITE_NOINDEX_DEFAULT are not blocking it) before running a " +
          "PRODUCTION migration.",
      });
    }
  }

  return { passed: issues.length === 0, issues };
}

export function assertProductionMigrationGuard(input: ProductionMigrationGuardInput): void {
  const result = evaluateProductionMigrationGuard(input);
  if (!result.passed) {
    throw new Error(
      [
        "Production migration guard failed:",
        ...result.issues.map((issue) => `  - [${issue.code}] ${issue.message}`),
      ].join("\n"),
    );
  }
}
