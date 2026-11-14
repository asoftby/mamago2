import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (p: string) => readFileSync(resolve(process.cwd(), p), "utf8");

// Каркас: контейнер, одна ссылка назад, h1 эталона «Моя семья».
const shell = read("src/components/account/AccountPage.tsx");
assert.match(shell, /mx-auto min-h-\[70vh\] w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8/);
assert.match(shell, /inline-flex min-h-11 items-center text-sm text-neutral-600 hover:text-neutral-900/);
assert.match(shell, /text-3xl font-semibold tracking-tight text-neutral-950 sm:text-4xl/);
assert.match(shell, /mt-2 max-w-2xl text-neutral-600/);
assert.doesNotMatch(shell, /font-serif|font-mono|uppercase/, "no editorial serif/mono kicker in the shell");

// Размер h1 на телефоне задаётся классом на layout + правилом в globals.css.
assert.match(read("src/app/(public)/me/layout.tsx"), /className="me-page /);
assert.match(read("src/app/globals.css"), /\.me-page h1\s*\{\s*font-size: 34px !important;/);

// Страницы кабинета используют общий каркас (список растёт по мере переноса).
const ON_SHELL = [
  "src/app/(public)/me/profile/page.tsx",
  "src/features/me/components/account/AccountDesign.tsx",
  "src/app/(public)/me/bookings/ParentBookingsClient.tsx",
  "src/app/(public)/me/direct/DirectListClient.tsx",
  "src/app/(public)/me/direct/[threadId]/DirectThreadClient.tsx",
  "src/features/ideas-collections/IdeasCollections.tsx",
  "src/app/(public)/me/wishlists/page.tsx",
  "src/app/(public)/me/wishlists/[id]/page.tsx",
  "src/app/(public)/me/events/page.tsx",
  "src/app/(public)/me/routes/RoutesClient.tsx",
  "src/app/(public)/me/day/[date]/page.tsx",
  "src/app/(public)/me/birthdays/page.tsx",
  "src/app/(public)/me/settings/family-city/page.tsx",
  "src/components/settings/SettingsPageLayout.tsx",
  "src/features/me/components/PartyOrderStatusScreen.tsx",
];
for (const file of ON_SHELL) {
  const src = read(file);
  assert.match(src, /<AccountPage\b/, `${file} uses AccountPage`);
  assert.doesNotMatch(src, /mg-acc|<h1\b|styles\.(breadcrumbs|heroTitle|heroGrid|kick)\b/, `${file} has no bespoke page chrome`);
}
// Страницы без собственного контейнера/hero (каркас даёт AccountPage).
for (const file of [
  "src/app/(public)/me/wishlists/page.tsx",
  "src/app/(public)/me/events/page.tsx",
  "src/app/(public)/me/routes/page.tsx",
  "src/app/(public)/me/day/[date]/page.tsx",
  "src/app/(public)/me/birthdays/page.tsx",
]) {
  assert.doesNotMatch(read(file), /<main\b|min-h-screen|<Container\b/, `${file} has no bespoke container`);
}
// Исключения: превью, /me/plan, деталь записи-билета (не используется).
// Бизнес-режим личной переписки не переведён на каркас кабинета.
assert.match(read("src/app/(public)/me/direct/[threadId]/DirectThreadClient.tsx"), /businessPage/);
// Только корневая /me без ссылки назад.
assert.doesNotMatch(read("src/features/me/components/account/AccountDesign.tsx"), /backHref/);
assert.match(read("src/app/(public)/me/profile/page.tsx"), /backHref="\/me"/);

console.log("AccountPage.contract.test: ok");
