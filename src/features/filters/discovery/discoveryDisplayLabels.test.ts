import assert from "node:assert/strict";
import test from "node:test";
import type { ReadonlyURLSearchParams } from "next/navigation";
import { AGE_GROUPS } from "@/features/filters/age/ageGroups";
import { getActivityFormatLabel } from "@/domain/activities/activity-format";
import { defaultFilters, parseAppliedFromUrl, serializeAppliedToSearchParams } from "./filters.store";

test("adult age keeps canonical 18+ while displaying #nokids", () => {
  const adult = AGE_GROUPS.find((group) => group.value === "18+");
  assert.equal(adult?.value, "18+");
  assert.equal(adult?.label, "#nokids");
  const params = serializeAppliedToSearchParams(new URLSearchParams(), { ...defaultFilters, age: ["18+"] });
  assert.equal(params.get("age"), "18+");
  assert.deepEqual(parseAppliedFromUrl(params as unknown as ReadonlyURLSearchParams).age, ["18+"]);
});

test("HYBRID remains canonical while its public label is Mix", () => {
  assert.equal(getActivityFormatLabel("HYBRID"), "Микс");
  assert.equal(serializeAppliedToSearchParams(new URLSearchParams(), { ...defaultFilters, format: "HYBRID" }).get("format"), "hybrid");
});
