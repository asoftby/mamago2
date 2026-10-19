/**
 * Подпись участника плана. Взрослый — это сам пользователь: «Имя (Я)», а если имя в профиле
 * не задано — просто «Я» (displayName персоны тогда подставлен из email и не годится для показа).
 */
export function personaPlanLabel(persona: {
  kind: string;
  displayName?: string | null;
  isProfileComplete?: boolean;
}): string {
  const name = persona.displayName?.trim() ?? "";
  if (persona.kind !== "adult") return name;
  return persona.isProfileComplete && name ? `${name} (Я)` : "Я";
}
