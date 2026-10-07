/** Dot color by marker owner. Palette lives in tokens (--plan-child-N); orange is for the family. */
const CHILD_PALETTE_SIZE = 6;

function hash(input: string): number {
  let h = 5381;
  for (let i = 0; i < input.length; i += 1) h = ((h * 33) ^ input.charCodeAt(i)) >>> 0;
  return h;
}

export function ownerColor(owner: string): string {
  if (owner === "family") return "var(--plan-accent)";
  return `var(--plan-child-${(hash(owner) % CHILD_PALETTE_SIZE) + 1})`;
}
