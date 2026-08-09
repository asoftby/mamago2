/**
 * Human-readable Russian labels for `CTA_CLICK` events' `meta.targetAction`
 * values. Centralized so every admin surface that breaks CTA_CLICK down by
 * action shows the same labels. Values come from the actual call sites that
 * emit CTA_CLICK (see grep for `targetAction:` across src/components,
 * src/app/api) — this list is not exhaustive by design: unknown/future
 * values degrade to a readable fallback rather than disappearing.
 */
const CTA_TARGET_ACTION_LABELS: Record<string, string> = {
  call: "Позвонили",
  website: "Перешли на сайт",
  instagram: "Открыли Instagram",
  buy: "Купили билет",
  plan: "Открыли добавление в план",
  primary: "Основное действие",
  book: "Записались",
};

/** Raw `meta.targetAction` (or `null`/`undefined` when absent) -> Russian label. Never returns raw JSON. */
export function labelForCtaTargetAction(action: string | null | undefined): string {
  if (!action || !action.trim()) return "Без указания действия";
  const known = CTA_TARGET_ACTION_LABELS[action];
  if (known) return known;
  // Unknown/future action value: readable fallback, not a disappearing bucket.
  const humanized = action
    .replace(/[_-]+/g, " ")
    .trim()
    .replace(/^./, (c) => c.toUpperCase());
  return `Действие «${humanized}»`;
}
