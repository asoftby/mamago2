import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function source(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

const service = source("src/server/services/userModeration.service.ts");
const client = source("src/app/admin/users/[id]/UserDetailsClient.tsx");

for (const token of [
  "businessMember.findMany",
  "ownerBusinessId: { in: businessIds }",
  "type: ActivityType.EVENT",
  "prisma.offer.findMany",
  "prisma.article.findMany",
  "prisma.planItem.count",
  "prisma.bookingRequest.count",
  "prisma.directThread.count",
  "recentActions",
]) {
  assert.ok(service.includes(token), `user 360 service must include ${token}`);
}

for (const label of [
  "Профиль и доступ",
  "Связи и контент",
  "Бизнесы и роли",
  "Места",
  "Публикации",
  "Пользовательская активность",
  "Последняя значимая активность",
  "История модерации",
  "Журнал аудита",
]) {
  assert.ok(client.includes(label), `user 360 UI must include section "${label}"`);
}

assert.ok(
  service.includes('isOwnedBusiness && !membership.isActive'),
  "inactive owner membership must stay classified as requiring restoration",
);

assert.ok(
  (service.match(/archivedAt: true/g) ?? []).length >= 2,
  "user 360 service must include archive state for places and offers",
);

assert.ok(
  client.includes('place.archivedAt ? "Архив"'),
  "archived places must be visibly marked as archived",
);

assert.ok(
  client.includes('offer.archivedAt ? "Архив"'),
  "archived offers must be visibly marked as archived",
);

assert.ok(
  client.includes("Старый показатель «Активности» заменён на отдельные сущности"),
  "ambiguous legacy activity counter must be explained/replaced",
);

assert.ok(
  client.includes('ID пользователя'),
  "user id must live inside the profile/access card",
);

assert.ok(
  !client.includes('ID: {user.id}'),
  "user id must not be duplicated in the page header",
);

assert.ok(
  !client.includes('{user.displayName ? <p className="truncate text-sm text-gray-600">{user.email}</p> : null}'),
  "email must not be duplicated in the page header",
);

assert.ok(
  client.includes("Тексты переписки и комментариев здесь намеренно не показываются"),
  "admin card must not surface private message/comment bodies by default",
);

console.log("admin user 360 card contract: OK");
