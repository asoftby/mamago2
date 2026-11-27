/**
 * AUDIT-XR-28: every parent-constructor and business party endpoint answers a
 * real 404 while birthday is outside the release, before auth or any database
 * access, so no party data can be created or changed.
 */
import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { NextRequest } from "next/server";

const ROOTS = ["src/app/api/parent/parties", "src/app/api/business/party-requests"];
const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;

function routeFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? routeFiles(path) : entry.name === "route.ts" ? [path] : [];
  });
}

async function main() {
  delete process.env.ENABLE_PUBLIC_BIRTHDAY;
  let handlers = 0;
  for (const file of ROOTS.flatMap(routeFiles)) {
    const mod = (await import(pathToFileURL(resolve(file)).href)) as Record<string, unknown>;
    for (const method of METHODS) {
      const handler = mod[method] as ((r: NextRequest, c: unknown) => Promise<Response>) | undefined;
      if (!handler) continue;
      const request = new NextRequest("http://localhost/api/test", {
        method,
        ...(method === "GET" ? {} : { body: "{}", headers: { "content-type": "application/json" } }),
      });
      const response = await handler(request, { params: Promise.resolve({ id: "x", quoteId: "y" }) });
      assert.equal(response.status, 404, `${method} ${file}`);
      assert.deepEqual(await response.json(), { error: "NOT_FOUND" }, `${method} ${file}`);
      handlers += 1;
    }
  }
  assert.equal(handlers, 16, "a new party handler must be added behind the release gate");
  console.log("birthday API release scope: OK", handlers);
}

main().then(() => process.exit(0)).catch((error) => { console.error(error); process.exit(1); });
