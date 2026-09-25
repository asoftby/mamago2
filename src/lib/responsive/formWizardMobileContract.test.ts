/**
 * Regression contract for shared entity wizards on narrow viewports.
 *
 * The event wizard exposed three coupled mobile regressions:
 * - nested page/card padding made the actual form too narrow;
 * - Back and Continue lived in different vertical rows;
 * - 8–10 step labels were compressed into the progress strip.
 *
 * Keep these assertions source-level so the shared shell cannot silently
 * regress without a browser harness.
 *
 * Run: pnpm test:responsive-wizard
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function read(path: string): string {
  return readFileSync(path, "utf8");
}

const header = read("src/components/form-shell/FormWizardHeader.tsx");
const content = read("src/components/form-shell/FormPrimaryContentCard.tsx");
const actions = read("src/components/form-shell/FormStickyActionBar.tsx");
const progress = read("src/components/ui/wizard-progress.tsx");
const eventWizard = read("src/components/business/wizard/event/EventWizard.tsx");

assert.match(
  header,
  /max-w-5xl/,
  "Wizard shell should use the wider max-w-5xl editing surface",
);
assert.match(
  header,
  /px-4 py-3 sm:px-6 sm:py-4 lg:px-8/,
  "Mobile header should keep a compact 16px viewport inset",
);
assert.match(
  content,
  /pb-40 pt-3 sm:px-6 sm:pb-32 sm:pt-6 lg:px-8/,
  "Mobile form container must not add horizontal page padding on top of card padding",
);
assert.match(
  content,
  /bg-card px-4 py-5 sm:rounded-xl sm:border sm:p-6 sm:shadow-sm lg:p-8/,
  "Mobile form should be an edge-to-edge surface with only a 16px readable inset",
);

assert.match(
  actions,
  /pb-\[max\(0\.75rem,env\(safe-area-inset-bottom\)\)\]/,
  "Sticky mobile actions must respect iOS safe-area",
);
assert.match(
  actions,
  /className="sm:hidden"/,
  "Sticky action bar must have a dedicated mobile layout",
);
assert.match(
  actions,
  /flex min-h-11 items-stretch gap-2/,
  "Mobile wizard actions must share one aligned 44px row",
);
assert.match(
  actions,
  /h-11 min-w-0 flex-1 touch-manipulation/,
  "The mobile primary action must consume the remaining row width",
);

assert.match(
  progress,
  /hidden items-center gap-1 whitespace-nowrap text-xs font-medium[^"]*sm:flex/,
  "Step labels must be hidden on narrow mobile and restored from sm upward",
);
assert.match(
  progress,
  /h-6 w-6[^"]*sm:h-5 sm:w-5/,
  "Mobile progress should use readable numbered step dots",
);
assert.match(
  progress,
  /aria-label=\{\`Шаг \$\{step\.id\}: \$\{step\.label\}\`\}/,
  "Hidden mobile labels must remain available to assistive technology",
);

assert.match(
  eventWizard,
  /<FormWizardHeader/,
  "Event wizard must stay on the shared responsive header contract",
);
assert.match(
  eventWizard,
  /<FormPrimaryContentCard>/,
  "Event wizard must stay on the shared responsive content contract",
);
assert.match(
  eventWizard,
  /<FormStickyActionBar/,
  "Event wizard must stay on the shared responsive action contract",
);
assert.match(
  eventWizard,
  /<WizardProgress/,
  "Event wizard must stay on the shared mobile progress contract",
);

console.log("formWizardMobileContract.test.ts: OK");
