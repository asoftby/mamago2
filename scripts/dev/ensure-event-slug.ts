/**
 * Одноразово: slug из title + синк canonical для события (публичный URL /{city}/events/{slug}).
 * Запуск: pnpm exec tsx scripts/dev/ensure-event-slug.ts [activityId]
 */
import prisma from "../../src/lib/prisma";
import { assignActivitySlugIfMissing } from "../../src/lib/slug/activitySlugService";
import { syncActivityCanonical } from "../../src/lib/seo/syncEntityCanonical";

const DEFAULT_ID = "cmnipdtte0007ws9tuz1tqrs4";

async function main() {
  const id = process.argv[2] ?? DEFAULT_ID;
  const a = await prisma.activity.findUnique({
    where: { id },
    select: { id: true, title: true, slug: true },
  });
  if (!a) {
    console.error("Activity not found:", id);
    process.exit(1);
  }
  await assignActivitySlugIfMissing(id, a.title.trim() || "event");
  await syncActivityCanonical(id);
  const updated = await prisma.activity.findUnique({
    where: { id },
    select: { slug: true, seoCanonicalUrl: true, seoCanonicalSource: true },
  });
  console.log("OK", { id, ...updated });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
