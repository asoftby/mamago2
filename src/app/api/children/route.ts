import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/server";
import { prisma } from "@/lib/prisma";
import { childScopeFor, familyIdForWrite } from "@/server/family/familyAccess";
import { SYSTEM_INTERESTS } from "@/lib/config/interests";
import { trackUserEvent } from "@/server/services/analytics/AnalyticsEventService";
import { getSessionRowIdFromCookies } from "@/lib/analytics/getSessionRowId";
import { normalizeChildName, ChildBirthValidationError } from "@/lib/child/birth";
import { parseChildBirthPayload } from "@/lib/child/birthApi";

const createChildSchema = z.object({
  name: z.string().max(50).nullish(),
  birthDate: z.union([z.string(), z.null()]).optional(),
  birthPrecision: z.enum(["DAY", "MONTH"]).nullish(),
  birthYear: z.number().int().optional(),
  birthMonth: z.number().int().optional(),
  systemInterests: z.array(z.string()).default([]),
  customInterests: z.array(z.string().max(50)).default([]),
});

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: "Требуется авторизация" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const data = createChildSchema.parse(body);
    const birth = parseChildBirthPayload(data as Record<string, unknown>);

    // Validate system interests
    const validSystemInterests = data.systemInterests.filter(slug => 
      SYSTEM_INTERESTS.some(interest => interest.slug === slug)
    );

    const familyId = await familyIdForWrite(user.id);

    // Create child with interests in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create child
      const child = await tx.child.create({
        data: {
          name: normalizeChildName(data.name),
          birthDate: birth.touched ? birth.value?.birthDate ?? null : null,
          birthPrecision: birth.touched ? birth.value?.birthPrecision ?? null : null,
          parentId: user.id,
          familyId,
          createdById: user.id,
        },
      });

      // Add system interests
      if (validSystemInterests.length > 0) {
        await tx.childInterest.createMany({
          data: validSystemInterests.map(slug => ({
            childId: child.id,
            interestSlug: slug,
          })),
        });
      }

      // Add custom interests
      if (data.customInterests.length > 0) {
        await tx.childCustomInterest.createMany({
          data: data.customInterests.map(label => ({
            childId: child.id,
            label: label.trim(),
          })),
        });
      }

      return child;
    });

    void trackUserEvent({
      userId: user.id,
      sessionId: await getSessionRowIdFromCookies(),
      eventType: "CHILD_SAVED",
      meta: {
        hasBirthDate: birth.touched && birth.value != null,
        interestCount: validSystemInterests.length + data.customInterests.length,
      },
    });

    return NextResponse.json({ success: true, child: result });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          error: "Некорректные данные", 
          details: error.issues.map(issue => ({
            field: issue.path.join('.'),
            message: issue.message
          }))
        },
        { status: 400 }
      );
    }

    if (error instanceof ChildBirthValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    console.error("[children/POST] failed", {
      errorName: error instanceof Error ? error.name : typeof error,
    });

    return NextResponse.json(
      { error: "Не удалось добавить ребенка" },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: "Требуется авторизация" },
        { status: 401 }
      );
    }

    const children = await prisma.child.findMany({
      where: await childScopeFor(user.id),
      include: {
        systemInterests: true,
        customInterests: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ children });
  } catch (error) {
    console.error("Get children error:", error);
    return NextResponse.json(
      { error: "Не удалось загрузить детей" },
      { status: 500 }
    );
  }
}
