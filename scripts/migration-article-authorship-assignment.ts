import { PrismaClient } from "@prisma/client";

import {
  ArticleAuthorshipAssignmentRunner,
  USER_575_ARTICLE_SOURCE_RECORD_KEYS,
} from "../src/lib/migration/commit/article-authorship";
import { assertLocalDatabaseUrl } from "./migration-user-vertical-slice";

function parseArgs(argv: readonly string[]): void {
  if (!argv.includes("--confirm-writes")) {
    throw new Error("Missing --confirm-writes.");
  }
  if (argv.some((arg) => arg === "--all" || arg === "--limit" || arg === "--source-record-key")) {
    throw new Error("Slice 20 scope is fixed; --all/--limit/--source-record-key are forbidden.");
  }
}

async function main() {
  parseArgs(process.argv.slice(2));
  assertLocalDatabaseUrl(process.env.DATABASE_URL);
  const prisma = new PrismaClient();
  try {
    const runner = new ArticleAuthorshipAssignmentRunner(prisma);
    const results = [];
    for (const sourceRecordKey of USER_575_ARTICLE_SOURCE_RECORD_KEYS) {
      assertLocalDatabaseUrl(process.env.DATABASE_URL);
      results.push(await runner.executeOne(sourceRecordKey));
    }
    console.log(JSON.stringify({
      environment: "LOCAL",
      userSourceRecordKey: "wordpress-db:user:575",
      results,
    }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
