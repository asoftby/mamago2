import assert from "node:assert/strict";

import { resolveDefaultParticipants } from "./resolveDefaultParticipants";
import type { FamilyPersona } from "@/lib/family/familyPersonaTypes";

const ADULT: FamilyPersona = { id: "adult-1", kind: "adult", displayName: "Я" };
const CHILD_A: FamilyPersona = { id: "child-a", kind: "child", displayName: "Аня", birthDate: "2020-01-01" };
const CHILD_B: FamilyPersona = { id: "child-b", kind: "child", displayName: "Боря", birthDate: "2022-01-01" };
const CHILD_C: FamilyPersona = { id: "child-c", kind: "child", displayName: "Витя", birthDate: "2024-01-01" };

// ── Branch 1: last-used ──────────────────────────────────────────────────────

{
  const result = resolveDefaultParticipants({
    lastUsedPersonaIds: [ADULT.id, CHILD_A.id],
    personas: [ADULT, CHILD_A, CHILD_B],
    primaryAdultPersonaId: ADULT.id,
  });
  assert.equal(result.source, "last-used");
  assert.deepEqual("participants" in result ? result.participants : null, [ADULT.id, CHILD_A.id]);
  assert.equal("mode" in result ? result.mode : null, "family");
  console.log("last-used: valid stored composition — OK");
}

{
  // Явный пустой состав — осознанный выбор «свободного» режима, должен быть уважен как last-used.
  const result = resolveDefaultParticipants({
    lastUsedPersonaIds: [],
    personas: [ADULT, CHILD_A],
    primaryAdultPersonaId: ADULT.id,
  });
  assert.equal(result.source, "last-used");
  assert.deepEqual("participants" in result ? result.participants : null, []);
  assert.equal("mode" in result ? result.mode : null, "free");
  console.log("last-used: explicit empty (free) is honored — OK");
}

{
  // Все сохранённые id больше не существуют в профиле (например, ребёнок удалён) — считаем сток протухшим.
  const result = resolveDefaultParticipants({
    lastUsedPersonaIds: ["deleted-child"],
    personas: [ADULT, CHILD_A],
    primaryAdultPersonaId: ADULT.id,
  });
  assert.equal(result.source, "profile");
  console.log("last-used: fully stale stored ids fall through to profile — OK");
}

{
  const result = resolveDefaultParticipants({
    lastUsedPersonaIds: [ADULT.id],
    personas: [ADULT, CHILD_A],
    primaryAdultPersonaId: ADULT.id,
  });
  assert.equal("mode" in result ? result.mode : null, "adult");
  console.log("last-used: adult-only mode derivation — OK");
}

{
  const result = resolveDefaultParticipants({
    lastUsedPersonaIds: [CHILD_A.id],
    personas: [ADULT, CHILD_A],
    primaryAdultPersonaId: ADULT.id,
  });
  assert.equal("mode" in result ? result.mode : null, "child");
  console.log("last-used: child-only mode derivation — OK");
}

// ── Branch 2: profile (all children + "Я") ──────────────────────────────────

{
  const result = resolveDefaultParticipants({
    lastUsedPersonaIds: null,
    personas: [ADULT, CHILD_A, CHILD_B],
    primaryAdultPersonaId: ADULT.id,
  });
  assert.equal(result.source, "profile");
  assert.deepEqual(
    "participants" in result ? [...result.participants].sort() : null,
    [ADULT.id, CHILD_A.id, CHILD_B.id].sort(),
  );
  assert.equal("mode" in result ? result.mode : null, "family");
  console.log("profile: no stored composition, uses all children + adult — OK");
}

{
  // Профиль с несколькими детьми (> MAX_ACTIVE_FAMILY_PERSONAS=3 суммарно) — кап до взрослого + 2 младших.
  const result = resolveDefaultParticipants({
    lastUsedPersonaIds: null,
    personas: [ADULT, CHILD_A, CHILD_B, CHILD_C],
    primaryAdultPersonaId: ADULT.id,
  });
  assert.equal(result.source, "profile");
  const participants = "participants" in result ? result.participants : [];
  assert.equal(participants.length, 3);
  assert.ok(participants.includes(ADULT.id));
  // Младшие по дате рождения — CHILD_B (2022) и CHILD_C (2024), не CHILD_A (2020).
  assert.ok(participants.includes(CHILD_B.id));
  assert.ok(participants.includes(CHILD_C.id));
  assert.ok(!participants.includes(CHILD_A.id));
  assert.equal("mode" in result ? result.mode : null, "family");
  console.log("profile: several children over cap picks adult + 2 youngest — OK");
}

// ── Branch 3: needs-age ──────────────────────────────────────────────────────

{
  const result = resolveDefaultParticipants({
    lastUsedPersonaIds: null,
    personas: [ADULT],
    primaryAdultPersonaId: ADULT.id,
  });
  assert.equal(result.source, "needs-age");
  assert.ok(!("participants" in result));
  console.log("needs-age: no stored composition and zero children — OK");
}

{
  // Полностью пустой профиль (нет ни взрослого, ни детей) — деградирует к needs-age, не падает.
  const result = resolveDefaultParticipants({
    lastUsedPersonaIds: null,
    personas: [],
    primaryAdultPersonaId: null,
  });
  assert.equal(result.source, "needs-age");
  console.log("needs-age: empty profile — OK");
}

console.log("\nresolveDefaultParticipants tests: all OK");
