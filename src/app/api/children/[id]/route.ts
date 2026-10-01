import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/server";
import { prisma } from "@/lib/prisma";
import { SYSTEM_INTERESTS } from "@/lib/config/interests";
import { normalizeChildName, ChildBirthValidationError } from "@/lib/child/birth";
import { parseChildBirthPayload } from "@/lib/child/birthApi";

/**
 * Deterministically PII-safe error log fields: error class name + Prisma
 * error code (both symbolic, never user data) — never the raw message,
 * which can be assembled by a lower layer from the request's own values
 * (e.g. a Prisma constraint error can echo back a field value).
 */
function safeErrorInfo(error: unknown): { errorName: string; errorCode?: string } {
  const errorName = error instanceof Error ? error.name : typeof error;
  const code =
    error && typeof error === "object" && "code" in error && typeof (error as { code: unknown }).code === "string"
      ? (error as { code: string }).code
      : undefined;
  return code ? { errorName, errorCode: code } : { errorName };
}

// systemInterests/customInterests are intentionally NOT `.default([])`: an
// omitted field means "don't touch this", while an explicit `[]` means
// "clear it". Defaulting to [] here previously wiped a child's interests on
// any update that didn't happen to know about them (e.g. a birth-date-only
// save) — see docs/engineering/backlog.md D05.
const updateChildSchema = z.object({
  name: z.string().max(50).nullish(),
  birthDate: z.union([z.string(), z.null()]).optional(),
  birthPrecision: z.enum(["DAY", "MONTH"]).nullish(),
  birthYear: z.number().int().optional(),
  birthMonth: z.number().int().optional(),
  systemInterests: z.array(z.string()).optional(),
  customInterests: z.array(z.string().max(50)).optional(),
});

export type UpdateChildInput = z.infer<typeof updateChildSchema>;

/**
 * Pure update logic (no HTTP/auth), extracted so it's directly testable.
 * `systemInterests`/`customInterests` being `undefined` (vs. `[]`) means
 * "leave alone" — see the schema comment above.
 */
export async function applyChildUpdate(childId: string, data: UpdateChildInput) {
  const birth = parseChildBirthPayload(data as Record<string, unknown>);
  const touchesSystemInterests = data.systemInterests !== undefined;
  const touchesCustomInterests = data.customInterests !== undefined;
  const validSystemInterests = touchesSystemInterests
    ? data.systemInterests!.filter(slug => SYSTEM_INTERESTS.some(interest => interest.slug === slug))
    : [];

  return prisma.$transaction(async (tx) => {
    const child = await tx.child.update({
      where: { id: childId },
      data: {
        ...(data.name !== undefined ? { name: normalizeChildName(data.name) } : {}),
        ...(birth.touched
          ? {
              birthDate: birth.value?.birthDate ?? null,
              birthPrecision: birth.value?.birthPrecision ?? null,
            }
          : {}),
      },
    });

    if (touchesSystemInterests) {
      await tx.childInterest.deleteMany({ where: { childId } });
      if (validSystemInterests.length > 0) {
        await tx.childInterest.createMany({
          data: validSystemInterests.map(slug => ({ childId, interestSlug: slug })),
        });
      }
    }

    if (touchesCustomInterests) {
      await tx.childCustomInterest.deleteMany({ where: { childId } });
      if (data.customInterests!.length > 0) {
        await tx.childCustomInterest.createMany({
          data: data.customInterests!.map(label => ({ childId, label: label.trim() })),
        });
      }
    }

    return child;
  });
}

export async function PUT(
  request: NextRequest,
  context: { params: { id: string } }
) {
  const url = new URL(request.url);
  const pathSegments = url.pathname.split('/');
  const idFromPath = pathSegments[pathSegments.length - 1];
  const { params } = context;
  const childId = params?.id || idFromPath;

  try {
    if (!childId || childId === 'route.ts') {
      return NextResponse.json(
        { error: "Некорректный ID ребенка" },
        { status: 400 }
      );
    }

    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: "Требуется авторизация" },
        { status: 401 }
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Некорректный формат данных" },
        { status: 400 }
      );
    }

    let data: z.infer<typeof updateChildSchema>;
    try {
      data = updateChildSchema.parse(body);
    } catch (validationError) {
      if (validationError instanceof z.ZodError) {
        return NextResponse.json(
          {
            error: "Некорректные данные",
            details: validationError.issues.map(issue => ({
              field: issue.path.join('.'),
              message: issue.message
            }))
          },
          { status: 400 }
        );
      }
      if (validationError instanceof ChildBirthValidationError) {
        return NextResponse.json({ error: validationError.message }, { status: 400 });
      }
      return NextResponse.json(
        { error: "Ошибка валидации данных" },
        { status: 400 }
      );
    }

    // Check if child belongs to user
    let existingChild;
    try {
      existingChild = await prisma.child.findFirst({
        where: { id: childId, parentId: user.id },
        select: { id: true },
      });
    } catch (dbError) {
      console.error("[children/PUT] db error finding child", { childId, ...safeErrorInfo(dbError) });
      return NextResponse.json(
        { error: "Ошибка базы данных при поиске ребенка" },
        { status: 500 }
      );
    }

    if (!existingChild) {
      return NextResponse.json(
        { error: "Ребенок не найден" },
        { status: 404 }
      );
    }

    let result;
    try {
      result = await applyChildUpdate(childId, data);
    } catch (transactionError) {
      if (transactionError instanceof ChildBirthValidationError) {
        return NextResponse.json({ error: transactionError.message }, { status: 400 });
      }
      console.error("[children/PUT] transaction failed", { childId, ...safeErrorInfo(transactionError) });
      return NextResponse.json(
        { error: "Ошибка при обновлении данных ребенка" },
        { status: 500 }
      );
    }

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

    console.error("[children/PUT] update failed", { childId, ...safeErrorInfo(error) });
    return NextResponse.json(
      { error: "Не удалось обновить ребенка" },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: "Требуется авторизация" },
        { status: 401 }
      );
    }

    const childId = params.id;

    const child = await prisma.child.findFirst({
      where: { id: childId, parentId: user.id },
      include: {
        systemInterests: true,
        customInterests: true,
      },
    });

    if (!child) {
      return NextResponse.json(
        { error: "Ребенок не найден" },
        { status: 404 }
      );
    }

    return NextResponse.json({ child });
  } catch (error) {
    console.error("[children/GET] failed", { childId: params?.id, ...safeErrorInfo(error) });
    return NextResponse.json(
      { error: "Не удалось загрузить ребенка" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: { id: string } }
) {
  const url = new URL(request.url);
  const pathSegments = url.pathname.split('/');
  const idFromPath = pathSegments[pathSegments.length - 1];
  const { params } = context;
  const childId = params?.id || idFromPath;

  try {
    if (!childId || childId === 'route.ts') {
      return NextResponse.json(
        { error: "Некорректный ID ребенка" },
        { status: 400 }
      );
    }

    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: "Требуется авторизация" },
        { status: 401 }
      );
    }

    const existingChild = await prisma.child.findFirst({
      where: { id: childId, parentId: user.id },
      select: { id: true },
    });

    if (!existingChild) {
      return NextResponse.json(
        { error: "Ребенок не найден" },
        { status: 404 }
      );
    }

    // Interests are deleted via cascade.
    await prisma.child.delete({ where: { id: childId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[children/DELETE] failed", { childId, ...safeErrorInfo(error) });
    return NextResponse.json(
      { error: "Не удалось удалить ребенка" },
      { status: 500 }
    );
  }
}
