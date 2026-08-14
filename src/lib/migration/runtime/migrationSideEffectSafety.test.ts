import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const files = [
  "scripts/migration-commit-wordpress-db.ts",
  "scripts/migration-user-live.ts",
  "scripts/migration-user-vertical-slice.ts",
  "src/lib/migration/commit/user/UserMigrationVerticalSlice.ts",
  "src/lib/migration/commit/review/ReviewCommitRunner.ts",
  "src/lib/migration/commit/offer/OfferCommitRunner.ts",
  "src/lib/migration/commit/place/PlaceCommitRunner.ts",
  "src/lib/migration/commit/event/EventCommitRunner.ts",
  "src/lib/migration/commit/article/ArticleCommitRunner.ts",
  "src/lib/migration/commit/route/RouteCommitRunner.ts",
];

const forbiddenImportNeedles = [
  "@/server/email",
  "@/lib/email",
  "nodemailer",
  "@/server/notifications",
  "@/lib/telegram",
  "twilio",
  "@/server/billing",
  "@/lib/prisma",
];

for (const relative of files) {
  const source = readFileSync(join(root, relative), "utf8");
  const importLines = source
    .split("\n")
    .filter((line) => /^\s*import\s/.test(line) || /^\s*export\s/.test(line) && line.includes(" from "));
  const haystack = importLines.join("\n").toLowerCase();
  for (const token of forbiddenImportNeedles) {
    assert.equal(
      haystack.includes(token.toLowerCase()),
      false,
      `${relative} must not import side-effect module "${token}"`,
    );
  }
}

console.log("migration side-effect safety tests: OK");
