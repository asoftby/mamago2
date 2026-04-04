import prisma from "@/lib/prisma";

export async function validateEventProgramCategories(args: {
  primaryRootCategoryId: string | null | undefined;
  primaryLeafCategoryId?: string | null | undefined;
  programCategoryIds: unknown;
}): Promise<{ ok: true; programCategoryIds: string[] }> {
  const raw = args.programCategoryIds;
  const programIds = Array.isArray(raw)
    ? raw.map((x) => String(x)).filter((x) => x.trim().length > 0)
    : [];

  const deduped = Array.from(new Set(programIds));

  const primaryRootId =
    typeof args.primaryRootCategoryId === "string" && args.primaryRootCategoryId.trim()
      ? args.primaryRootCategoryId
      : null;
  const primaryLeafId =
    typeof args.primaryLeafCategoryId === "string" && args.primaryLeafCategoryId.trim()
      ? args.primaryLeafCategoryId
      : null;

  if (!primaryRootId) {
    if (deduped.length > 0) {
      throw new Error("Категории программы нельзя задавать без основной категории");
    }
    return { ok: true, programCategoryIds: [] };
  }

  const primary = await prisma.eventCategory.findUnique({
    where: { id: primaryRootId },
    select: { id: true, supportsProgram: true },
  });
  if (!primary) {
    throw new Error("Некорректная основная категория события");
  }

  if (!primary.supportsProgram) {
    if (deduped.length > 0) {
      throw new Error("Для выбранной основной категории программа недоступна");
    }
    return { ok: true, programCategoryIds: [] };
  }

  if (deduped.includes(primaryRootId) || (primaryLeafId && deduped.includes(primaryLeafId))) {
    throw new Error("Основную категорию нельзя добавлять в программу");
  }

  if (deduped.length === 0) {
    return { ok: true, programCategoryIds: [] };
  }

  const rows = await prisma.eventCategory.findMany({
    where: { id: { in: deduped } },
    select: { id: true, selectableInProgram: true, isActive: true, publicationType: true },
  });

  const found = new Set(rows.map((r) => r.id));
  const missing = deduped.filter((id) => !found.has(id));
  if (missing.length > 0) {
    throw new Error("Некоторые категории программы не найдены");
  }

  const invalid = rows.filter((r) => !r.selectableInProgram || r.publicationType !== "EVENT");
  if (invalid.length > 0) {
    throw new Error("Некоторые категории нельзя использовать в программе");
  }

  return { ok: true, programCategoryIds: deduped };
}

