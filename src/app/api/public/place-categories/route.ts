/**
 * GET /api/public/place-categories
 * 
 * Возвращает категории и подкатегории для Place (publicationType = PLACE).
 * Структура: корневые категории с вложенными подкатегориями.
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    // Получаем все активные категории PLACE
    const allCategories = await prisma.eventCategory.findMany({
      where: {
        publicationType: "PLACE",
        isActive: true,
      },
      select: {
        id: true,
        nameRu: true,
        nameEn: true,
        slug: true,
        icon: true,
        sortOrder: true,
        parentId: true,
      },
      orderBy: {
        sortOrder: "asc",
      },
    });

    // Разделяем на корневые и дочерние
    const roots = allCategories.filter((c) => c.parentId === null);
    const children = allCategories.filter((c) => c.parentId !== null);

    // Группируем детей по parentId
    const childrenByParent = new Map<string, typeof children>();
    for (const child of children) {
      if (!child.parentId) continue;
      const existing = childrenByParent.get(child.parentId) || [];
      existing.push(child);
      childrenByParent.set(child.parentId, existing);
    }

    // Собираем структуру
    const categories = roots.map((root) => ({
      id: root.id,
      nameRu: root.nameRu,
      nameEn: root.nameEn,
      slug: root.slug,
      icon: root.icon,
      sortOrder: root.sortOrder,
      parentId: root.parentId,
      children: (childrenByParent.get(root.id) || []).map((child) => ({
        id: child.id,
        nameRu: child.nameRu,
        nameEn: child.nameEn,
        slug: child.slug,
        sortOrder: child.sortOrder,
        parentId: child.parentId,
      })),
    }));

    return NextResponse.json({ categories });
  } catch (error) {
    console.error("[place-categories] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch place categories" },
      { status: 500 }
    );
  }
}
