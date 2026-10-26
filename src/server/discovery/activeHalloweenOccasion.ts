import prisma from "@/lib/prisma";

export type ActiveOccasionWindow = {
  isActive: boolean;
  startsAt: Date | null;
  endsAt: Date | null;
};

/** Shared seasonal visibility policy for listing and city homepage. */
export function isOccasionWithinActiveWindow(
  occasion: ActiveOccasionWindow | null,
  now: Date,
): boolean {
  return Boolean(
    occasion?.isActive &&
    occasion.startsAt &&
    occasion.endsAt &&
    occasion.startsAt <= now &&
    now <= occasion.endsAt,
  );
}

/** The existing occasion record in the admin area remains the source of truth. */
export async function isHalloweenOccasionActive(now: Date = new Date()): Promise<boolean> {
  const occasion = await prisma.occasion.findUnique({
    where: { slug: "halloween" },
    select: { isActive: true, startsAt: true, endsAt: true },
  });
  return isOccasionWithinActiveWindow(occasion, now);
}
