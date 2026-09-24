import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const discoverySource = readFileSync(
  "src/components/discovery/DiscoveryActivitiesGrid.tsx",
  "utf8",
);

assert.match(
  discoverySource,
  /<OfferCard[\s\S]*?imagePriority=\{feedBucket === "primary" && position <= 4\}[\s\S]*?<EventCard/u,
);
assert.match(
  discoverySource,
  /<EventCard[\s\S]*?imagePriority=\{feedBucket === "primary" && position <= 4\}/u,
);

const programsSource = readFileSync(
  "src/app/(public)/[city]/programs/page.tsx",
  "utf8",
);

assert.match(programsSource, /programActivities\.map\(\(program, index\) =>/u);
assert.match(programsSource, /<OfferCard[\s\S]*?imagePriority=\{index < 4\}/u);

console.log("discovery image priority tests: OK");
