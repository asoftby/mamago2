/**
 * prisma/seed/discovery-section-filters.ts
 *
 * Seeds FilterDefinition + FilterOption + DiscoveryFilterPlacement
 * from the canonical secondary-filter config, establishing DB as the
 * single source of truth for the public filter modal.
 *
 * Idempotent — safe to run multiple times.
 *
 * TODO(budget): Add a "budget" range filter for kuda/birthday once the
 * discovery query layer can compute max(priceFrom) per section at runtime.
 * Publications already have priceFrom/priceTo fields (Float?) in schema.
 * Steps: (1) add FilterDefinition slug="budget" type="range" ui="range",
 * (2) expose max budget in /api/public/discovery-filters?intent=kuda,
 * (3) render BudgetSliderFilter in SecondaryFiltersForm when kind="range".
 */

import { PrismaClient } from "@prisma/client";

type FilterOptionSeed = { id: string; label: string };

type FilterGroupSeed =
  | { id: string; label: string; kind: "single" | "multiple"; options: FilterOptionSeed[] }
  | { id: string; label: string; kind: "boolean"; trueLabel: string };

type IntentFilters = {
  intent: string;
  groups: FilterGroupSeed[];
};

const INTENT_FILTERS: IntentFilters[] = [
  {
    intent: "kuda",
    groups: [
      {
        id: "venue",
        label: "Где",
        kind: "single",
        options: [
          { id: "indoor", label: "В помещении" },
          { id: "outdoor", label: "На улице" },
        ],
      },
      {
        id: "price",
        label: "Цена",
        kind: "single",
        options: [
          { id: "free", label: "Бесплатно" },
          { id: "paid", label: "Платно" },
        ],
      },
      {
        id: "open_now",
        label: "Сейчас",
        kind: "boolean",
        trueLabel: "Сейчас открыто",
      },
      {
        id: "activity_type",
        label: "Как проходит событие",
        kind: "multiple",
        options: [
          { id: "calm_relaxed", label: "Спокойно и расслабленно" },
          { id: "educational", label: "Познавательно" },
          { id: "playful", label: "Игриво" },
          { id: "active_energetic", label: "Активно и энергично" },
          { id: "shows", label: "Спектакли" },
          { id: "exhibitions", label: "Выставки" },
          { id: "parks", label: "Парки" },
        ],
      },
      // Replaces the old SectionSystemFilter FREE_ONLY toggle.
      // showTitle=false: the switcher label (trueLabel) is self-explanatory.
      {
        id: "free_only",
        label: "Только бесплатно",
        kind: "boolean",
        trueLabel: "Только бесплатно",
      },
      {
        id: "adult_only",
        label: "Только 18+",
        kind: "boolean",
        trueLabel: "Только 18+",
      },
    ],
  },
  {
    intent: "classes",
    groups: [
      {
        id: "duration",
        label: "Длительность",
        kind: "single",
        options: [
          { id: "short", label: "До 45 мин" },
          { id: "medium", label: "45–90 мин" },
          { id: "long", label: "90+ мин" },
        ],
      },
      {
        id: "format",
        label: "Формат",
        kind: "single",
        options: [
          { id: "once", label: "Разовое" },
          { id: "course", label: "Курс" },
        ],
      },
      {
        id: "trial",
        label: "Пробное",
        kind: "boolean",
        trueLabel: "Есть пробное занятие",
      },
    ],
  },
  {
    intent: "birthday",
    groups: [
      {
        id: "service_type",
        label: "Тип услуги",
        kind: "single",
        options: [
          { id: "venue", label: "Площадка" },
          { id: "animators", label: "Аниматоры" },
          { id: "turnkey", label: "Под ключ" },
        ],
      },
      {
        id: "budget",
        label: "Бюджет",
        kind: "single",
        options: [
          { id: "low", label: "До 300 BYN" },
          { id: "mid", label: "300–700 BYN" },
          { id: "high", label: "700+ BYN" },
        ],
      },
      {
        id: "includes",
        label: "Включено",
        kind: "multiple",
        options: [
          { id: "food", label: "Еда" },
          { id: "decor", label: "Декор" },
          { id: "show", label: "Шоу-программа" },
        ],
      },
    ],
  },
  {
    intent: "routes",
    groups: [
      {
        id: "duration",
        label: "Длительность",
        kind: "single",
        options: [
          { id: "short", label: "До 2 ч" },
          { id: "half_day", label: "Полдня" },
          { id: "full_day", label: "Целый день" },
        ],
      },
      {
        id: "format",
        label: "Формат",
        kind: "single",
        options: [
          { id: "walk", label: "Пешком" },
          { id: "car", label: "На авто" },
          { id: "mixed", label: "Смешанный" },
        ],
      },
      {
        id: "stroller",
        label: "С коляской",
        kind: "boolean",
        trueLabel: "Удобно с коляской",
      },
    ],
  },
];

function uiForKind(kind: string): string {
  if (kind === "boolean") return "switcher";
  if (kind === "multiple") return "chips";
  return "chips";
}

export async function seedDiscoverySectionFilters(prisma: PrismaClient) {
  let created = 0;
  let updated = 0;

  for (const { intent, groups } of INTENT_FILTERS) {
    for (let gIndex = 0; gIndex < groups.length; gIndex++) {
      const group = groups[gIndex];

      // Upsert FilterDefinition
      const existing = await prisma.filterDefinition.findUnique({
        where: { slug: group.id },
      });

      let filterDef: { id: string };

      // boolean switcher filters don't need a visible group title —
      // the trueLabel inside the control is self-explanatory.
      const showTitle = group.kind !== "boolean";

      if (existing) {
        filterDef = await prisma.filterDefinition.update({
          where: { slug: group.id },
          data: {
            title: group.label,
            type: group.kind,
            ui: uiForKind(group.kind),
            isActive: true,
            orderIndex: gIndex,
            showTitle,
          },
          select: { id: true },
        });
        updated++;
      } else {
        filterDef = await prisma.filterDefinition.create({
          data: {
            slug: group.id,
            title: group.label,
            type: group.kind,
            ui: uiForKind(group.kind),
            isSystem: false,
            isActive: true,
            orderIndex: gIndex,
            order: gIndex,
            showTitle,
          },
          select: { id: true },
        });
        created++;
      }

      // Upsert options
      if (group.kind === "boolean") {
        const existingOpt = await prisma.filterOption.findUnique({
          where: { filterId_value: { filterId: filterDef.id, value: "true" } },
        });
        if (existingOpt) {
          await prisma.filterOption.update({
            where: { filterId_value: { filterId: filterDef.id, value: "true" } },
            data: { label: group.trueLabel, orderIndex: 0, isActive: true },
          });
        } else {
          await prisma.filterOption.create({
            data: {
              filterId: filterDef.id,
              value: "true",
              label: group.trueLabel,
              orderIndex: 0,
              order: 0,
              isActive: true,
            },
          });
        }
      } else {
        for (let oIndex = 0; oIndex < group.options.length; oIndex++) {
          const opt = group.options[oIndex];
          const existingOpt = await prisma.filterOption.findUnique({
            where: { filterId_value: { filterId: filterDef.id, value: opt.id } },
          });
          if (existingOpt) {
            await prisma.filterOption.update({
              where: { filterId_value: { filterId: filterDef.id, value: opt.id } },
              data: { label: opt.label, orderIndex: oIndex, isActive: true },
            });
          } else {
            await prisma.filterOption.create({
              data: {
                filterId: filterDef.id,
                value: opt.id,
                label: opt.label,
                orderIndex: oIndex,
                order: oIndex,
                isActive: true,
              },
            });
          }
        }
      }

      // Upsert DiscoveryFilterPlacement (intent-level, no categoryId).
      // Use findFirst because Prisma rejects null in compound unique findUnique.
      const existingPlacement = await prisma.discoveryFilterPlacement.findFirst({
        where: { filterId: filterDef.id, intent, categoryId: null },
      });

      if (existingPlacement) {
        await prisma.discoveryFilterPlacement.update({
          where: { id: existingPlacement.id },
          data: { sortOrder: gIndex, isActive: true },
        });
      } else {
        await prisma.discoveryFilterPlacement.create({
          data: {
            filterId: filterDef.id,
            intent,
            sortOrder: gIndex,
            isActive: true,
          },
        });
      }
    }
  }

  console.log(
    `  ✓ discovery section filters — ${created} created, ${updated} updated`
  );
}
