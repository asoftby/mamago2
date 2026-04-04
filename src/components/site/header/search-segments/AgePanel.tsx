"use client";

import { useMemo } from "react";
import { ChipsRow, type ChipItem } from "@/components/ui/chips-row";
import { AGE_GROUPS } from "@/features/filters/age/ageGroups";
import type { DiscoveryFilters } from "@/features/filters/discovery/filters.store";
import { ageYearsFromBirthDate } from "@/lib/family/ageYearsFromBirthDate";
import type { FamilyAgeMode } from "@/lib/family/familyAgeMode";

interface AgePanelProps {
  onClose: () => void;
  applied: DiscoveryFilters;
  actions: { setDraft: (patch: Partial<DiscoveryFilters>) => void };
  selectedChildIds?: string[];
  availableChildren?: Array<{ id: string; name: string; birthDate?: string }>;
  onToggleChild?: (childId: string) => void;
  /** Основной взрослый (личный аккаунт) — чип «Для …»; birthDate для порядка чипов по возрасту */
  primaryAdult?: { id: string; displayName: string; birthDate?: string } | null;
  adultSelected?: boolean;
  onToggleAdult?: () => void;
  /**
   * derived — выбраны дети-персоны: возраст только производный, чипы не кликаются.
   * manual — возраст независимый fallback.
   */
  ageMode?: FamilyAgeMode;
  autoAgeValues?: string[];
  /** Без карточки, рамки и заголовка — внутри моб. аккордеона */
  embedded?: boolean;
  /** Лимит 3 персоны: нельзя добавить новую, пока не снять выбор с другой */
  personaPickAtLimit?: boolean;
  /** Режим «Для всех» (никого не выбрано при наличии семьи в профиле) */
  whoFreeMode?: boolean;
  /** «Для всех»: сброс персон и возраста; дальше возраст можно выбрать вручную */
  onSelectEveryone?: () => void;
}

export function AgePanel({
  applied,
  actions,
  selectedChildIds = [],
  availableChildren = [],
  onToggleChild,
  primaryAdult = null,
  adultSelected = false,
  onToggleAdult,
  ageMode = "manual",
  autoAgeValues = [],
  embedded = false,
  personaPickAtLimit = false,
  whoFreeMode = false,
  onSelectEveryone,
}: AgePanelProps) {
  /** Только при выбранных детях-персонах возраст производный и чипы заблокированы. */
  const ageReadOnly = ageMode === "derived";

  const toGenitiveName = (name: string): string => {
    const n = name.trim();
    if (!n) return name;
    const lower = n.toLowerCase();
    if (lower.endsWith("а")) {
      const base = n.slice(0, -1);
      const prev = base.slice(-1).toLowerCase();
      const ending = ["г", "к", "х", "ж", "ч", "ш", "щ"].includes(prev) ? "и" : "ы";
      return `${base}${ending}`;
    }
    if (lower.endsWith("я")) return `${n.slice(0, -1)}и`;
    if (lower.endsWith("й")) return `${n.slice(0, -1)}я`;
    if (lower.endsWith("ь")) return `${n.slice(0, -1)}я`;
    return `${n}а`;
  };

  const handleAgeToggle = (ageValue: string) => {
    if (ageReadOnly) return;
    const currentAges = applied.age ?? [];
    let newAges: string[];

    if (currentAges.includes(ageValue)) {
      newAges = currentAges.filter((age: string) => age !== ageValue);
    } else {
      newAges = [...currentAges, ageValue];
    }

    actions.setDraft({ age: newAges });
  };

  const autoAgeSet = new Set(autoAgeValues);
  const items: ChipItem[] = AGE_GROUPS.map((ageGroup) => {
    const active = applied.age.includes(ageGroup.value);
    const isAuto = active && autoAgeSet.has(ageGroup.value);
    const readOnly = ageReadOnly;
    return {
      id: ageGroup.value,
      label: ageGroup.label,
      active,
      disabled: readOnly,
      className: isAuto
        ? "ring-1 ring-[#EF8759]/30 bg-[#EF8759]/8 text-neutral-800 border-gray-200/80"
        : undefined,
      onClick: () => handleAgeToggle(ageGroup.value),
    };
  });

  const showChildrenBlock = availableChildren.length > 0 && !!onToggleChild;

  const showAdultChip = !!primaryAdult && !!onToggleAdult;

  type PersonaChipRow =
    | { kind: "adult" }
    | { kind: "child"; child: (typeof availableChildren)[number] };

  const personaChipsOrder = useMemo((): PersonaChipRow[] => {
    const rows: PersonaChipRow[] = [];
    if (showAdultChip && primaryAdult) {
      rows.push({ kind: "adult" });
    }
    for (const child of availableChildren) {
      rows.push({ kind: "child", child });
    }
    rows.sort((a, b) => {
      const birthA =
        a.kind === "adult" ? primaryAdult?.birthDate : a.child.birthDate;
      const birthB =
        b.kind === "adult" ? primaryAdult?.birthDate : b.child.birthDate;
      const ya = ageYearsFromBirthDate(birthA);
      const yb = ageYearsFromBirthDate(birthB);
      if (ya !== yb) return ya - yb;
      const idA = a.kind === "adult" ? primaryAdult!.id : a.child.id;
      const idB = b.kind === "adult" ? primaryAdult!.id : b.child.id;
      return idA.localeCompare(idB);
    });
    return rows;
  }, [availableChildren, primaryAdult, showAdultChip]);

  const childrenChips = showChildrenBlock ? (
    <div className="mb-4 space-y-2">
      <h3 className="text-sm font-medium text-gray-900">Для кого?</h3>
      <div
        className="flex max-w-full flex-wrap items-center gap-2"
        role="group"
        aria-label="Выбор семьи"
      >
        {personaChipsOrder.map((row) => {
          if (row.kind === "adult") {
            if (!primaryAdult) return null;
            return (
              <button
                key={primaryAdult.id}
                type="button"
                onClick={onToggleAdult}
                disabled={personaPickAtLimit && !adultSelected}
                aria-pressed={adultSelected}
                className={[
                  "inline-flex max-w-full shrink-0 items-center justify-center rounded-full border px-5 py-2.5 text-sm font-medium transition-colors",
                  adultSelected
                    ? "border-transparent bg-[#F8C4B4] text-gray-900"
                    : "border-gray-200 bg-gray-100 text-gray-900 hover:bg-gray-50",
                  personaPickAtLimit && !adultSelected
                    ? "cursor-not-allowed opacity-45 hover:bg-gray-100"
                    : "",
                ].join(" ")}
              >
                {toGenitiveName(primaryAdult.displayName)}
              </button>
            );
          }
          const { child } = row;
          const inSelection = selectedChildIds.includes(child.id);
          const active = inSelection;
          const pickBlocked = personaPickAtLimit && !inSelection;
          return (
            <button
              key={child.id}
              type="button"
              onClick={() => onToggleChild?.(child.id)}
              disabled={pickBlocked}
              aria-pressed={active}
              className={[
                "inline-flex max-w-full shrink-0 items-center justify-center rounded-full border px-5 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "border-transparent bg-[#F8C4B4] text-gray-900"
                  : "border-gray-200 bg-gray-100 text-gray-900 hover:bg-gray-50",
                pickBlocked ? "cursor-not-allowed opacity-45 hover:bg-gray-100" : "",
              ].join(" ")}
            >
              {toGenitiveName(child.name)}
            </button>
          );
        })}
        {onSelectEveryone ? (
          <button
            type="button"
            onClick={onSelectEveryone}
            aria-pressed={whoFreeMode}
            className={[
              "inline-flex max-w-full shrink-0 items-center justify-center rounded-full border px-5 py-2.5 text-sm font-medium transition-colors",
              whoFreeMode
                ? "border-transparent bg-[#F8C4B4] text-gray-900"
                : "border-gray-200 bg-gray-100 text-gray-900 hover:bg-gray-50",
            ].join(" ")}
          >
            Для всех
          </button>
        ) : null}
      </div>
    </div>
  ) : null;

  const chips = (
    <>
      {childrenChips}
      <h3 className="mb-3 text-sm font-medium text-gray-900">Возраст детей</h3>
      <ChipsRow
        layout="masonry"
        aria-label="Возраст детей"
        items={items}
      />
    </>
  );

  if (embedded) {
    return (
      <div className="p-[15px]">
        {chips}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-lg">
      <div className="p-4 sm:p-6">
        {chips}
      </div>
    </div>
  );
}
