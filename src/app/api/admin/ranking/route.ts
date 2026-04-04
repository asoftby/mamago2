import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { prisma } from "@/lib/prisma";

const DEFAULT_INTENTS = [
  { intent: "today",   title: "Сегодня",    order: 0, allowedTypes: ["events", "offers"] },
  { intent: "weekend", title: "Выходные",   order: 1, allowedTypes: ["events", "offers"] },
  { intent: "free",    title: "Бесплатно",  order: 2, allowedTypes: ["events", "places"] },
  { intent: "near",    title: "Рядом",      order: 3, allowedTypes: ["events", "places"] },
  { intent: "age_3_5", title: "3–5 лет",    order: 4, allowedTypes: ["events", "offers"] },
  { intent: "new",     title: "Новое",      order: 5, allowedTypes: ["events", "offers", "places"] },
];

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

  const [intents, ranking, boost] = await Promise.all([
    prisma.storyIntentConfig.findMany({ orderBy: { order: "asc" } }),
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
    return NextResponse.json(updated);
  }

  return NextResponse.json({ error: "Unknown type" }, { status: 400 });
}
