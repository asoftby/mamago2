import assert from "node:assert/strict";
import { buildChildPersonas } from "./buildChildPersonas";

const personas = buildChildPersonas([
  { id: "a", name: null, birthDate: "2020-05-01" },
  { id: "b", name: "  ", birthDate: null },
  { id: "c", name: "Маша", birthDate: "2021-06-15" },
]);

assert.deepEqual(personas.map((persona) => persona.displayName), ["Ребёнок 1", "Ребёнок 2", "Маша"]);
assert.equal(personas.every((persona) => typeof persona.displayName === "string"), true);

console.log("buildChildPersonas.test.ts: OK");
