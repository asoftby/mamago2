/**
 * Static wiring regression for the P2 review fix: additional-subcategory
 * chips must be disabled until a primary subcategory is chosen, since
 * `addAdditionalSubcategory()` is a no-op without one.
 *
 * Step1Profile is a client component that can't be mounted in this repo's
 * plain-tsx test harness (no jsdom/RTL — confirmed by every other
 * `*.test.tsx` file here, e.g. EventAdvancedFilters.test.tsx, using the
 * same readFileSync + assertion approach rather than rendering). The pure
 * disabled-predicate itself is covered directly, with real inputs, in
 * placeSubcategorySelection.test.ts; this file only proves the component
 * actually wires that function in, instead of a parallel inline check that
 * could silently drift from it.
 *
 * Запуск: npx tsx src/components/business/wizard/place/steps/Step1Profile.test.tsx
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./Step1Profile.tsx", import.meta.url), "utf8");

assert.match(
  source,
  /isAdditionalSubcategoryChipDisabled/,
  "Step1Profile must import and use the shared isAdditionalSubcategoryChipDisabled predicate",
);

// The chip's `disabled` prop must be computed via the shared predicate, not
// a parallel inline expression that could drift from it.
const disabledCallMatch = source.match(
  /disabled:\s*isAdditionalSubcategoryChipDisabled\(\{([\s\S]*?)\}\)/,
);
assert.ok(
  disabledCallMatch,
  "the additional-subcategory chip's `disabled` prop must call isAdditionalSubcategoryChipDisabled({...})",
);
const callArgs = disabledCallMatch![1];
assert.match(callArgs, /isEditable/, "must pass isEditable through");
assert.match(callArgs, /isSelected/, "must pass isSelected through");
assert.match(
  callArgs,
  /hasPrimary:\s*Boolean\(subcategorySelection\.primary\)/,
  "must derive hasPrimary from subcategorySelection.primary — the same source of truth the primary FilterSelect reads",
);
assert.match(callArgs, /additionalLimitReached:\s*atMax/, "must pass the additional-cap flag through");

// The old, buggy inline formula (disabled only depended on isEditable/atMax,
// never on whether a primary existed) must not have crept back in as a
// second, competing computation.
assert.doesNotMatch(
  source,
  /disabled:\s*!isEditable\s*\|\|\s*\(!isSelected\s*&&\s*atMax\)/,
  "the pre-fix inline disabled formula (missing the no-primary check) must not reappear",
);

// Helper copy under the chips must explain the disabled state without a new
// warning/card — just a conditional string in the existing helper <p>.
assert.match(
  source,
  /Сначала выберите основную подкатегорию/,
  "the additional-subcategories helper text must explain why the chips are disabled before a primary is chosen",
);
assert.match(
  source,
  /Можно добавить ещё до \$\{MAX_ADDITIONAL_SUBCATEGORIES\} подходящих вариантов/,
  "the original helper text must still be shown once a primary is chosen",
);

console.log("Step1Profile additional-subcategory wiring: OK");
