import type { SchemaOverviewCard, SchemaTemplate } from "./domain/types";

export function aggregateOverviewMetrics(
  card: SchemaOverviewCard,
  templatesById: Map<string, SchemaTemplate>,
): {
  active: boolean;
  coverageCount: number;
  warningsCount: number;
} {
  const linked = card.templateIds
    .map((id) => templatesById.get(id))
    .filter((t): t is SchemaTemplate => Boolean(t));
  if (linked.length === 0) {
    return { active: false, coverageCount: 0, warningsCount: 0 };
  }
  return {
    active: linked.every((t) => t.active),
    coverageCount: linked.reduce((s, t) => s + t.coverageCount, 0),
    warningsCount: linked.reduce((s, t) => s + t.warningsCount, 0),
  };
}
