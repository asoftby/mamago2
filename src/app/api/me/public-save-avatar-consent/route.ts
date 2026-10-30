import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { prisma } from "@/lib/prisma";

const VERSION = "save-avatar-v1";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const consent = await prisma.publicSaveAvatarConsent.findUnique({ where: { userId: user.id } });
  return NextResponse.json({ enabled: consent?.revokedAt === null && consent.textVersion === VERSION }, {
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let input: { enabled?: unknown };
  try { input = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  if (typeof input.enabled !== "boolean") {
    return NextResponse.json({ error: "Invalid consent choice" }, { status: 400 });
  }

  const now = new Date();
  await prisma.publicSaveAvatarConsent.upsert({
    where: { userId: user.id },
    create: { userId: user.id, textVersion: VERSION, acceptedAt: now, revokedAt: input.enabled ? null : now },
    update: {
      textVersion: VERSION,
      ...(input.enabled ? { acceptedAt: now, revokedAt: null } : { revokedAt: now }),
    },
  });
  return NextResponse.json({ enabled: input.enabled }, { headers: { "Cache-Control": "no-store" } });
}
