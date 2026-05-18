import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { prisma } from "@/lib/prisma";

function getAgeFromBirthDate(value?: Date | null): number | null {
  if (!value) return null;
  const now = new Date();
  let age = now.getFullYear() - value.getFullYear();
  const monthDiff = now.getMonth() - value.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < value.getDate())) {
    age -= 1;
  }
  if (!Number.isFinite(age) || age < 0 || age > 18) return null;
  return age;
}

export async function GET() {
  const user = await getCurrentUser().catch(() => null);

  if (!user) {
    return NextResponse.json({
      authenticated: false,
      user: null,
      children: [],
    });
  }

  const children = await prisma.child.findMany({
    where: { parentId: user.id },
    select: {
      id: true,
      name: true,
      birthDate: true,
    },
    orderBy: [{ birthDate: "asc" }, { createdAt: "desc" }],
  });

  return NextResponse.json({
    authenticated: true,
    user: {
      id: user.id,
      displayName: user.displayName?.trim() || null,
      email: user.email || null,
      phone: user.phoneVerifiedAt ? user.phoneE164 ?? null : null,
      phoneVerified: Boolean(user.phoneVerifiedAt),
    },
    children: children.map((child) => ({
      id: child.id,
      name: child.name,
      birthDate: child.birthDate?.toISOString() ?? null,
      age: getAgeFromBirthDate(child.birthDate),
    })),
  });
}
