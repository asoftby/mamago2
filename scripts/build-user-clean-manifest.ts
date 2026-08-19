import { writeFileSync } from "node:fs";

import { buildCleanUserManifest } from "../src/lib/migration/commit/user";

const outputIndex = process.argv.indexOf("--out");
const output = outputIndex >= 0 ? process.argv[outputIndex + 1] : undefined;
const rootIndex = process.argv.indexOf("--snapshot-root");
const snapshotRoot = rootIndex >= 0 ? process.argv[rootIndex + 1] : "/tmp/scratchpad/users";
if (!output) throw new Error("Missing required --out path.");
const manifest = buildCleanUserManifest(snapshotRoot);
writeFileSync(output, `${JSON.stringify(manifest, null, 2)}\n`, { flag: "wx" });
console.log(JSON.stringify({ entries: manifest.entries.length, excluded: manifest.excludedCount, manifestHash: manifest.manifestHash }));
