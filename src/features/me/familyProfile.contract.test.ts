import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ageYearsAt, childDisplayName } from "@/lib/child/birth";
import { ProfileInterestsConstraintSchema } from "@/lib/decision/decisionContext";

const profilePage = readFileSync("src/app/(public)/me/profile/page.tsx", "utf8");
const modal = readFileSync("src/components/children/AddParticipantModal.tsx", "utf8");
const mePage = readFileSync("src/app/(public)/me/page.tsx", "utf8");
const suggestionRoute = readFileSync("src/app/api/plan/suggestions/route.ts", "utf8");

assert.doesNotMatch(profilePage, /redirect\(["']\/me["']\)/);
assert.match(profilePage, /redirect\("\/login\?redirectTo=\/me\/profile"\)/);
assert.match(profilePage, /<ChildrenCard/);
assert.doesNotMatch(modal, /label="Возрастной диапазон"/);
assert.doesNotMatch(modal, /ageBandLabel:/);
assert.match(modal, /familyRole: familyRole \|\| null/);
assert.match(modal, /childOnly/);
assert.match(modal, /childInterestsDirty/);
assert.match(modal, /!isEditChild \|\| childInterestsDirty/);
assert.match(modal, /notifyFamilyPersonasChanged\(\)/);
assert.doesNotMatch(mePage, /user\.ageBandLabel/);
assert.match(mePage, /ageYearsAt/);
assert.match(suggestionRoute, /buildSelectedProfileContext/);
assert.match(suggestionRoute, /profileInterestSlugs: selectedProfileContext\.systemInterestSlugs/);
assert.doesNotMatch(suggestionRoute, /searchParams\.get\(["']interestSlugs/);
const subjectsSource = readFileSync("src/lib/decision/subjects.ts", "utf8");
assert.match(subjectsSource, /parentId: input\.userId/);
assert.match(subjectsSource, /systemInterestSlugs/);
assert.equal(ProfileInterestsConstraintSchema.safeParse({ value: ["science"], source: "profile" }).success, true);
assert.equal(ProfileInterestsConstraintSchema.safeParse({ value: ["child name"], source: "profile" }).success, false);

assert.equal(childDisplayName(null, 1), "Ребёнок 1");
assert.equal(childDisplayName("", 2), "Ребёнок 2");
const target = new Date("2026-06-15T00:00:00.000Z");
assert.equal(ageYearsAt({ birthDate: "2020-06-20", birthPrecision: "DAY" }, target), 5);
assert.equal(ageYearsAt({ birthDate: "2020-06-01", birthPrecision: "MONTH" }, target), 6);
assert.equal(ageYearsAt({ birthDate: "2020-06-01", birthPrecision: null }, target), 6);

console.log("familyProfile.contract.test.ts: OK");
