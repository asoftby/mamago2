import { prisma } from "@/lib/prisma";

/**
 * Строка под карточкой взрослого: до 2 предпочтений + формат досуга.
 * При отсутствии signal-полей — fallback на legacy текстовые поля.
 */
export async function buildAdultPreferenceDisplayLine(params: {
  preferenceSignalIds: string[];
  leisureFormatSignalId: string | null;
  preferenceSummary: string | null;
  leisureFormatSummary: string | null;
}): Promise<string> {
  const {
    preferenceSignalIds,
    leisureFormatSignalId,
    preferenceSummary,
    leisureFormatSummary,
  } = params;

  const hasStructured =
    (preferenceSignalIds?.length ?? 0) > 0 || !!leisureFormatSignalId;

  if (hasStructured) {
    const prefIds = preferenceSignalIds.slice(0, 2);
    const ids = [...prefIds, ...(leisureFormatSignalId ? [leisureFormatSignalId] : [])];
    if (ids.length === 0) return "Настроим рекомендации";
    const defs = await prisma.signalDefinition.findMany({
      where: { id: { in: ids } },
      select: { id: true, title: true },
    });
    const byId = new Map(defs.map((d) => [d.id, d.title]));
    const prefParts = prefIds
      .map((id) => byId.get(id))
      .filter((t): t is string => !!t?.trim());
    const fmt = leisureFormatSignalId ? byId.get(leisureFormatSignalId) : null;
    const parts = [...prefParts, ...(fmt?.trim() ? [fmt.trim()] : [])];
    return parts.length > 0 ? parts.join(" · ") : "Настроим рекомендации";
  }

  const p = preferenceSummary?.trim();
  const l = leisureFormatSummary?.trim();
  if (p && l) return `${p} · ${l}`;
  if (p) return p;
  if (l) return l;
  return "Настроим рекомендации";
}
