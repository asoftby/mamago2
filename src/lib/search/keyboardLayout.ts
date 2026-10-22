/** Convert text typed with the opposite physical RU/EN keyboard layout. */
const EN = "`qwertyuiop[]asdfghjkl;'zxcvbnm,./";
const RU = "ёйцукенгшщзхъфывапролджэячсмитьбю.";
const enKeys = EN.slice(1);
const ruKeys = RU.slice(1);
const enToRu = new Map([...enKeys].map((key, i) => [key, ruKeys[i]]));
const ruToEn = new Map([...ruKeys].map((key, i) => [key, enKeys[i]]));
enToRu.set("`", "ё");
ruToEn.set("ё", "`");

export function swapKeyboardLayout(query: string): string | null {
  const english = (query.match(/[a-z]/gi) ?? []).length;
  const russian = (query.match(/[а-яё]/gi) ?? []).length;
  // Mixed-script input is usually intentional (brands, names, punctuation).
  if (!english && !russian || english && russian) return null;
  const mapping = english ? enToRu : ruToEn;
  const swapped = [...query].map((char) => {
    const lower = char.toLowerCase();
    const converted = mapping.get(lower);
    if (!converted) return char;
    return char !== lower ? converted.toUpperCase() : converted;
  }).join("");
  return swapped === query ? null : swapped;
}
