export function pluralizeStories(count: number): string {
  const mod100 = Math.abs(count) % 100;
  const mod10 = Math.abs(count) % 10;
  if (mod100 >= 11 && mod100 <= 14) return `${count} историй`;
  if (mod10 === 1) return `${count} история`;
  if (mod10 >= 2 && mod10 <= 4) return `${count} истории`;
  return `${count} историй`;
}
