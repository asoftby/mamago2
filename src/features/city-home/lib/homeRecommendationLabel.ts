import type { HomeFamilyContext } from "./familyHome";

/** Short nominative → dative for common Russian child names.
 * Unrecognized names use a neutral colon rather than invented inflection.
 */
function childNameDative(name: string): string | null {
  if (!/^[А-ЯЁа-яё-]+$/u.test(name)) return null;
  if (/ия$/iu.test(name)) return name.slice(0, -1) + "и";
  if (/а$/iu.test(name)) return name.slice(0, -1) + "е";
  if (/я$/iu.test(name)) return name.slice(0, -1) + "е";
  if (/[йь]$/iu.test(name)) return name.slice(0, -1) + "ю";
  if (/[бвгджзклмнпрстфхцчшщ]$/iu.test(name)) return name + "у";
  return null;
}

/** Conservative family fit: an adult is never inferred from child-only eligibility. */
export function homeRecommendationLabel(
  item: { agePolicy: string; ageMinMonths: number | null; ageMaxMonths: number | null; matchedChildIds: string[] },
  context: Pick<HomeFamilyContext, "children">,
): string | null {
  if (item.agePolicy === "ADULT_ONLY" || (item.ageMinMonths != null && item.ageMinMonths >= 216)) {
    return "Подходит вам";
  }
  const children = context.children.filter(child => item.matchedChildIds.includes(child.id));
  if (!children.length) return null;
  const everyChild = context.children.length > 0 && children.length === context.children.length;
  // A child-only event is not automatically suitable for adult family members.
  const allowsAdults = item.agePolicy === "UNRESTRICTED" ||
    (item.ageMaxMonths == null && (item.ageMinMonths == null || item.ageMinMonths < 216));
  if (everyChild && allowsAdults) return "Подходит всей семье";
  const names = children.map(child => childNameDative(child.name?.trim() || ""));
  if (names.some(name => !name)) return "Подходит: " + children.map(child => child.name?.trim() || "ребёнок").join(", ");
  return "Подходит " + names.join(" и ");
}
