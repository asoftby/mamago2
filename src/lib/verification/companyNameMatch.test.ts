import assert from "node:assert/strict";

import { companyNamesLikelyMatch, normalizeCompanyName } from "./companyNameMatch";

// --- exact match after normalization ---
assert.equal(normalizeCompanyName("ООО «Ромашка»"), "ромашка");
assert.equal(companyNamesLikelyMatch("Ромашка", ["ООО «Ромашка»"]), true);

// --- legal form differs, base name matches ---
assert.equal(
  companyNamesLikelyMatch("ИП Дударчик Геннадий Тимофеевич", ["Дударчик Геннадий Тимофеевич"]),
  true,
);

// --- abbreviated input vs full official name (substring containment) ---
assert.equal(companyNamesLikelyMatch("Тайга", ["Кооператив \"Тайга\""]), true);

// --- real GRP examples from empirical Phase 1 check ---
assert.equal(
  companyNamesLikelyMatch("Фирма Надежда", ["ПУЧП \"Фирма Надежда\"", "Производственное унитарное частное предприятие \"Фирма Надежда\""]),
  true,
);

// --- strong mismatch ---
assert.equal(companyNamesLikelyMatch("Ромашка", ["ООО \"Одуванчик\""]), false);

// --- empty input never matches ---
assert.equal(companyNamesLikelyMatch("", ["ООО \"Ромашка\""]), false);
assert.equal(companyNamesLikelyMatch("Ромашка", [null, undefined]), false);

console.log("companyNameMatch tests: OK");
