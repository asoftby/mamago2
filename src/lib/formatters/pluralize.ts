/** Russian count agreement; the form tuple is [one, few, many]. */
export function pluralize(count: number, forms: readonly [string, string, string]): string {
  const n = Math.abs(Math.trunc(count));
  const mod100 = n % 100;
  const mod10 = n % 10;
  const form = mod100 >= 11 && mod100 <= 14 ? forms[2]
    : mod10 === 1 ? forms[0]
    : mod10 >= 2 && mod10 <= 4 ? forms[1]
    : forms[2];
  return `${count} ${form}`;
}
