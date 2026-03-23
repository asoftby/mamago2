"use client";

import { usePathname } from "next/navigation";
import { getCityFromPath, getIntentFromPath } from "@/lib/intent";
import { useDiscoveryFilters } from "@/features/filters/discovery/filters.store";
import { useSecondaryFiltersFromUrl } from "@/features/filters/discovery/useSecondaryFiltersFromUrl";
import { whenLabel } from "@/features/filters/discovery/whenLabel";
import { AGE_GROUPS } from "@/features/filters/age/ageGroups";

function ageChips(ageIds: string[]): string[] {
  if (!ageIds.length) return [];
  return ageIds.map(
    (id) => AGE_GROUPS.find((g) => g.value === id)?.label ?? id,
  );
}

/**
 * Под хедером: активные primary (URL: дата, возраст, локация…) + secondary (sec).
 */
export function AppliedFiltersChips() {
  const pathname = usePathname();
  const intent = getIntentFromPath(pathname);
  const city = getCityFromPath(pathname);

  const { applied } = useDiscoveryFilters();
  const { chipLabels: secondary } = useSecondaryFiltersFromUrl(intent);

  if (!intent || !city) return null;

  const primary: string[] = [];

  const dateText = whenLabel(applied);
  if (dateText && dateText !== "Выберите…") {
    primary.push(dateText.includes(" • ") ? dateText.split(" • ")[0]! : dateText);
  }

  primary.push(...ageChips(applied.age));

  if (applied.metro) primary.push(`Метро: ${applied.metro}`);
  if (applied.district) primary.push(applied.district);
  if (applied.nearby) primary.push("Поблизости");

  const all = [...primary, ...secondary];
  if (all.length === 0) return null;

  return (
    <div className="border-b border-neutral-100 bg-neutral-50/80">
      <div className="mx-auto w-full max-w-[1200px] px-4 sm:px-6 lg:px-8 py-2.5">
        <p className="text-xs text-neutral-600 leading-relaxed">
          <span className="font-medium text-neutral-500">Выбрано: </span>
          {all.map((label, i) => (
            <span key={`${label}-${i}`}>
              {i > 0 && <span className="text-neutral-300"> · </span>}
              <span className="text-neutral-800">{label}</span>
            </span>
          ))}
        </p>
      </div>
    </div>
  );
}
