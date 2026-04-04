import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/server";
import { prisma } from "@/lib/prisma";
import { SYSTEM_INTERESTS } from "@/lib/config/interests";

const createChildSchema = z.object({
  name: z.string().min(1, "Укажите имя").max(50),
  birthDate: z
    .union([z.string(), z.null()])
    .optional()
    .refine((date) => {
      if (date == null || date === "") return true;
      const parsed = new Date(date);
      const now = new Date();
      return parsed <= now && parsed > new Date(now.getFullYear() - 25, 0, 1);
    }, "Некорректная дата рождения"),
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

    // Validate system interests
    const validSystemInterests = data.systemInterests.filter(slug => 
      SYSTEM_INTERESTS.some(interest => interest.slug === slug)
    );

    // Create child with interests in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create child
      const child = await tx.child.create({
        data: {
          name: data.name,
          birthDate: data.birthDate ? new Date(data.birthDate) : null,
          parentId: user.id,
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

    return NextResponse.json({ success: true, child: result });
  } catch (error) {
    console.error("Create child error:", error);

    if (error instanceof z.ZodError) {
      console.error("Validation errors:", error.issues);
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

    // Log the actual error for debugging
    if (error instanceof Error) {
      console.error("Error message:", error.message);
      console.error("Error stack:", error.stack);
    }

    return NextResponse.json(
      { error: "Не удалось добавить ребенка" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: "Требуется авторизация" },
        { status: 401 }
      );
    }

    const children = await prisma.child.findMany({
      where: { parentId: user.id },
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