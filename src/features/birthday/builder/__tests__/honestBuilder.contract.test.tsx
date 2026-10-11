import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { StepPick } from "../components/steps/StepPick";
import { listUserBirthdayParties, getUserBirthdayPartyDetail } from "@/server/services/userBirthdays.service";

const markup = renderToStaticMarkup(createElement(StepPick, { citySlug: "minsk" }));
assert.match(markup, /Каталог праздников обновляется/);
assert.match(markup, /нельзя выбрать услугу или отправить заявку/);
assert.match(markup, /\/minsk\/birthday/);
assert.doesNotMatch(markup, /4\.9|Подтверждено|Забронировано|Отправить заявку/);

const shell = readFileSync("src/features/birthday/builder/components/BirthdayBuilderShell.tsx", "utf8");
for (const forbidden of ["MOCK_PRICES", "buildMockScenarioTimeline", "buildSubmittedScenarioParty", "setSubmittedScenario"]) {
  assert.equal(shell.includes(forbidden), false, "fake booking flow remains: " + forbidden);
}
void (async () => {
  assert.deepEqual(await listUserBirthdayParties("user-a"), []);
  assert.equal(await getUserBirthdayPartyDetail("user-a", "demo-birthday-scenario"), null);
  console.log("honestBuilder.contract.test.tsx: OK");
})();
