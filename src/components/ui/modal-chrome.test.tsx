/**
 * Chrome contract: no DOM-testing stack required (SSR + source guard).
 * Run: pnpm exec tsx src/components/ui/modal-chrome.test.tsx
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { ModalFooter, ModalHeader, ModalPrimaryAction } from "./modal-chrome";
import { MobileOverlayResetAction } from "@/components/mobile/MobileOverlayResetAction";

const header = renderToStaticMarkup(
  <ModalHeader title={<h2>Поиск</h2>} onClose={() => {}} />,
);
assert.ok(header.includes("<header"), "semantic header");
assert.ok(header.includes(">Поиск</h2>"), "visible centered title");
assert.ok(header.includes('aria-label="Закрыть"'), "accessible close action");
assert.ok(header.includes('type="button"'), "close must not submit forms");
assert.ok(header.includes("justify-between"), "symmetrical centered layout");

const noClose = renderToStaticMarkup(
  <ModalHeader title={<h2>Информация</h2>} />,
);
assert.ok(!noClose.includes('aria-label="Закрыть"'), "close action is optional");

const footer = renderToStaticMarkup(
  <ModalFooter>
    <MobileOverlayResetAction onClick={() => {}}>Сбросить</MobileOverlayResetAction>
    <span className="min-w-0 flex-1" />
    <ModalPrimaryAction onClick={() => {}}>Показать</ModalPrimaryAction>
  </ModalFooter>,
);
assert.ok(footer.includes("safe-area-inset-bottom"), "mobile footer must clear home indicator");
assert.ok(footer.includes(">Сбросить</button>"), "secondary action label stays configurable");
assert.ok(footer.includes(">Показать</button>"), "primary action label stays configurable");
assert.equal((footer.match(/type="button"/g) ?? []).length, 2);

const source = (path: string) => readFileSync(path, "utf8");
for (const path of [
  "src/components/mobile/MobileSearchSheet.tsx",
  "src/components/discovery/MobileFilterSheet.tsx",
  "src/components/filters/MobileSelectSheet.tsx",
]) {
  const code = source(path);
  for (const component of ["ModalHeader", "ModalFooter", "ModalPrimaryAction"]) {
    assert.match(code, new RegExp("<" + component + "\\b"), path + " must reuse " + component);
  }
}

assert.match(
  source("src/components/activity/SaveToPlanModal.tsx"),
  /export function SaveToPlanModal|function SaveToPlanModal/,
  "saved plan flow retains its independent, approved presentation",
);

console.log("modal-chrome.test.tsx: OK");
