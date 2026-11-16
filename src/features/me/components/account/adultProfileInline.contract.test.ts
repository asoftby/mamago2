import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { getSettingsSectionByRouteKey } from "../../../../lib/settings/registry";

const read = (p: string) => readFileSync(resolve(process.cwd(), p), "utf8");

// Settings: the USER surface no longer has a separate «Профиль» section;
// business/admin keep «Имя и аватар».
assert.equal(getSettingsSectionByRouteKey("USER", "profile"), undefined, "no profile section on /me/settings");
assert.ok(getSettingsSectionByRouteKey("BUSINESS", "profile"), "business keeps name/avatar settings");
assert.ok(getSettingsSectionByRouteKey("ADMIN", "profile"), "admin keeps name/avatar settings");

// Old links go to /me, where the adult profile is edited inline.
const meProfileRoute = read("src/app/(public)/me/settings/profile/page.tsx");
assert.match(meProfileRoute, /redirect\("\/me"\)/);
assert.doesNotMatch(meProfileRoute, /renderProfileSettingsPage/);
const compatRoute = read("src/app/settings/profile/page.tsx");
assert.match(compatRoute, /=== "USER"\) \{\s*redirect\("\/me"\)/);
assert.doesNotMatch(read("src/app/(public)/me/settings/family-city/page.tsx"), /\/me\/settings\/profile/);

// Adult edit modal: photo upload via the shared upload path, sent with the same PATCH.
const modal = read("src/components/children/AddParticipantModal.tsx");
assert.match(modal, /convertHeicFileToJpegIfNeeded\(avatarFile\)/);
assert.match(modal, /uploadMediaFile\(file\)/);
assert.match(modal, /\{ avatarUrl \}/);
assert.equal((modal.match(/type="file"/g) ?? []).length, 1, "only one photo input");
const adultFormStart = modal.indexOf("{showAdultForm ? (");
const childFormStart = modal.indexOf("{showChildForm ? (");
assert.ok(childFormStart >= 0 && adultFormStart > childFormStart);
assert.ok(modal.indexOf('type="file"') > adultFormStart, "photo input lives in the adult form only, children have no photo");

// The profile API persists the avatar, but only the user's own upload.
const meRoute = read("src/app/api/auth/me/route.ts");
assert.match(meRoute, /resolveAvatarUrlUpdate\(body/);
assert.match(meRoute, /uploadedById: user\.id, publicUrl: url/);
assert.match(meRoute, /updateData\.avatarUrl = avatarUpdate\.avatarUrl/);

// /me family card shows the adult photo; children keep the initial.
const design = read("src/features/me/components/account/AccountDesign.tsx");
assert.match(design, /m\.kind === "me" && m\.avatarUrl/);
const mePage = read("src/app/(public)/me/page.tsx");
assert.match(mePage, /avatarUrl: user\.avatarUrl \?\? null/);

console.log("adultProfileInline.contract.test: ok");
