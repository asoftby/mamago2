import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { prisma } from "@/lib/prisma";
import { revalidateTag } from "next/cache";
import { STORY_INTENTS_CACHE_TAG } from "@/server/stories/storyIntentConfig";

const DEFAULT_INTENTS = [
  { intent: "today",        title: "Сегодня",       order: 0, allowedTypes: ["events"] },
  { intent: "tomorrow",     title: "Завтра",        order: 1, allowedTypes: ["events"] },
  { intent: "weekend",      title: "Выходные",      order: 2, allowedTypes: ["events"] },
  { intent: "breaking_news", title: "Breaking news", order: 3, allowedTypes: ["articles"] },
  { intent: "free",         title: "Бесплатно",      order: 4, allowedTypes: ["events"] },
];
const ACTIVE_STORY_INTENTS = DEFAULT_INTENTS.map((item) => item.intent);

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || (user.role !== "ADMIN" && user.role !== "MODERATOR")) {
    return null;
  }
  return user;
}

export async function GET() {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Seed defaults if missing
  for (const def of DEFAULT_INTENTS) {
    await prisma.storyIntentConfig.upsert({
      where: { intent: def.intent },
      create: { ...def, itemLimit: 5, enabled: true },
      update: {},
    });
  }
  await prisma.storyIntentConfig.updateMany({
    where: { intent: { notIn: ACTIVE_STORY_INTENTS }, enabled: true },
    data: { enabled: false },
  });

  const [intents, ranking, boost] = await Promise.all([
    prisma.storyIntentConfig.findMany({ where: { intent: { in: ACTIVE_STORY_INTENTS } }, orderBy: { order: "asc" } }),
    prisma.rankingSettings.upsert({
      where: { id: "singleton" },
      create: { id: "singleton" },
      update: {},
    }),
    prisma.boostSettings.upsert({
      where: { id: "singleton" },
      create: { id: "singleton" },
      update: {},
    }),
  ]);

  return NextResponse.json({ intents, ranking, boost });
}

export async function POST(req: Request) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { type, data } = body as { type: "ranking" | "boost" | "intent"; data: Record<string, unknown> };

  if (type === "ranking") {
    const updated = await prisma.rankingSettings.upsert({
      where: { id: "singleton" },
      create: { id: "singleton", ...data },
      update: data,
    });
    return NextResponse.json(updated);
  }

  if (type === "boost") {
    const updated = await prisma.boostSettings.upsert({
      where: { id: "singleton" },
      create: { id: "singleton", ...data },
      update: data,
    });
    return NextResponse.json(updated);
  }

  if (type === "intent") {
    const { id, ...rest } = data as { id: string; [k: string]: unknown };
    const updated = await prisma.storyIntentConfig.update({
      where: { id },
      data: rest,
    });
    revalidateTag(STORY_INTENTS_CACHE_TAG, "max");
    return NextResponse.json(updated);
  }

  return NextResponse.json({ error: "Unknown type" }, { status: 400 });
}
