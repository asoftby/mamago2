import { childDisplayName } from "@/lib/child/birth";
import type { FamilyPersona } from "./familyPersonaTypes";

export type FamilyChildRow = {
  id: string;
  name: string | null;
  birthDate?: string | null;
};

export function buildChildPersonas(children: FamilyChildRow[]): FamilyPersona[] {
  let unnamedIndex = 0;
  return children.map((child) => {
    if (!child.name?.trim()) unnamedIndex += 1;
    return {
      id: child.id,
      kind: "child",
      displayName: childDisplayName(child.name, child.name?.trim() ? undefined : unnamedIndex),
      birthDate: child.birthDate ?? null,
    };
  });
}
