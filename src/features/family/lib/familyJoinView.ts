/** Family Core M3a: pure view helpers for the join page. */
import type { MergeDecision } from "@/server/family/familyMergePure";

export type JoinPreview = {
  joinerChildren: Array<{ id: string; name: string | null; birthYear: number | null }>;
  targetChildren: Array<{ id: string; name: string | null; birthYear: number | null }>;
  suggestions: Record<string, string | null>;
  planItemCount: number;
};

/** The merge step is shown only when the joiner brings data. */
export function needsMergeStep(p: JoinPreview): boolean {
  return p.joinerChildren.length > 0 || p.planItemCount > 0;
}

/**
 * Starting point for the merge form. A suggested match is preselected as "same child"
 * but the joiner still confirms the form: nothing is applied without the final click.
 */
export function initialMergeDecision(p: JoinPreview): MergeDecision {
  const used = new Set<string>();
  return {
    plan: "PRIVATE",
    children: p.joinerChildren.map((c) => {
      const target = p.suggestions[c.id];
      if (target && !used.has(target)) {
        used.add(target);
        return { childId: c.id, action: "SAME" as const, targetChildId: target };
      }
      return { childId: c.id, action: "ADD" as const };
    }),
  };
}

const ERRORS: Record<string, string> = {
  disabled: "Присоединение к семье пока недоступно.",
  consent_unavailable: "Присоединение к семье пока недоступно.",
  consent_required: "Нужно ваше согласие, чтобы продолжить.",
  invalid_invite: "Ссылка недействительна: её уже использовали или отозвали.",
  already_member: "Вы уже состоите в этой семье.",
  has_other_adults: "Вы уже в семье с другим взрослым. Сначала выйдите из неё в профиле.",
  needs_merge: "Нужно решить, что сделать с вашими детьми и планом.",
  merge_invalid: "Проверьте выбор по детям и плану.",
  conflict: "Данные изменились. Обновите страницу и попробуйте ещё раз.",
  rate_limited: "Слишком много попыток. Попробуйте позже.",
};

export function joinErrorMessage(code: string | null | undefined): string {
  return (code && ERRORS[code]) || "Не получилось. Попробуйте ещё раз.";
}

export function inviterTitle(name: string | null): string {
  return name ? `${name} приглашает вас в семью` : "Вас приглашают в семью";
}
