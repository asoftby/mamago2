/**
 * Family Core M3b: pure rules for merging a joiner's own data into the family they join.
 * Nothing is merged automatically: suggestions only, the joiner decides every child.
 */

export type MergeChildDecision =
  | { childId: string; action: "SAME"; targetChildId: string }
  | { childId: string; action: "ADD" }
  | { childId: string; action: "SKIP" };

/** What happens to the joiner's personal plan items. PRIVATE is the default. */
export type MergePlanDecision = "PRIVATE" | "FAMILY" | "SKIP";

export type MergeDecision = { children: MergeChildDecision[]; plan: MergePlanDecision };

export type MergeChild = { id: string; name: string | null; birthDate: Date | null };

export function normalizeChildName(name: string | null | undefined): string {
  return (name ?? "").trim().toLowerCase().replace(/ё/g, "е").replace(/\s+/g, " ");
}

/**
 * Suggested "same child": equal non-empty normalized name and equal birth year
 * (both missing counts as equal). Each target child is suggested at most once.
 */
export function suggestChildMatches(
  joiner: MergeChild[],
  target: MergeChild[],
): Map<string, string | null> {
  const used = new Set<string>();
  const out = new Map<string, string | null>();
  for (const child of joiner) {
    const name = normalizeChildName(child.name);
    let match: string | null = null;
    if (name) {
      const year = child.birthDate?.getUTCFullYear() ?? null;
      const hit = target.find(
        (t) =>
          !used.has(t.id) &&
          normalizeChildName(t.name) === name &&
          (t.birthDate?.getUTCFullYear() ?? null) === year,
      );
      if (hit) {
        match = hit.id;
        used.add(hit.id);
      }
    }
    out.set(child.id, match);
  }
  return out;
}

/** Returns an error message, or null when the decision is complete and consistent. */
export function validateMergeDecision(
  joinerChildIds: string[],
  targetChildIds: string[],
  decision: MergeDecision,
): string | null {
  if (!["PRIVATE", "FAMILY", "SKIP"].includes(decision.plan)) return "plan decision invalid";
  const joiner = new Set(joinerChildIds);
  const target = new Set(targetChildIds);
  const seen = new Set<string>();
  const usedTargets = new Set<string>();
  for (const d of decision.children) {
    if (!joiner.has(d.childId)) return `unknown child ${d.childId}`;
    if (seen.has(d.childId)) return `child ${d.childId} decided twice`;
    seen.add(d.childId);
    if (d.action === "SAME") {
      if (!target.has(d.targetChildId)) return `unknown target child ${d.targetChildId}`;
      if (usedTargets.has(d.targetChildId)) return `target child ${d.targetChildId} used twice`;
      usedTargets.add(d.targetChildId);
    } else if (d.action !== "ADD" && d.action !== "SKIP") {
      return "child action invalid";
    }
  }
  if (seen.size !== joiner.size) return "every child needs a decision";
  return null;
}

/** Interests are comma-separated text: union, target order first, case-insensitive. */
export function mergeInterestsText(target: string | null, joiner: string | null): string | null {
  const parts = (s: string | null) =>
    (s ?? "").split(",").map((x) => x.trim()).filter(Boolean);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of [...parts(target), ...parts(joiner)]) {
    const key = p.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(p);
  }
  return out.length ? out.join(", ") : null;
}

/**
 * Visibility of a moved plan item. FAMILY is downgraded to PRIVATE when the
 * family already has an active FAMILY item for the same activity (no duplicates
 * in the shared plan).
 */
export function mergedPlanVisibility(
  plan: Exclude<MergePlanDecision, "SKIP">,
  item: { activityId: string | null },
  familyActivityIds: Set<string>,
): "PRIVATE" | "FAMILY" {
  if (plan === "PRIVATE") return "PRIVATE";
  if (item.activityId && familyActivityIds.has(item.activityId)) return "PRIVATE";
  return "FAMILY";
}
