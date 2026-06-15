import { prisma } from "@/lib/prisma";

export async function getCurrentAppVersion(): Promise<string | null> {
  try {
    const release = await prisma.release.findFirst({
      where: { status: "PUBLISHED", isCurrent: true },
      orderBy: { releasedAt: "desc" },
      select: { version: true },
    });
    return release?.version ?? null;
  } catch {
    return null;
  }
}
