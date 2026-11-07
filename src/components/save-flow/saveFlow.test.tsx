/**
 * Save-flow shared primitives (extracted from SaveToPlanModal, no behavior change).
 * Run: npx tsx src/components/save-flow/saveFlow.test.tsx
 */
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { MY_PLAN_V3_TOKENS } from "@/features/my-plan/components/v3/myPlanV3Tokens";
import { C } from "./tokens";
import { fmtDateChip, fmtDateLong, fmtDateShort, formatSessionDotsLabel, pluralRu } from "./dateFormat";
import { KickerLine } from "./KickerLine";
import { SaveConfirmBar } from "./SaveConfirmBar";
import { DateSlider } from "./DateSlider";

// Tokens are frozen: changing them changes the look of the Save modal.
assert.deepEqual({ ...C }, {
  bg: "#FFFFFF", paper: "#FAF7F1", ink: "#141210", peach: "#F7C3AD", peachLine: "#F3A684",
  ink2: "#3A332B", ink3: "rgba(20,18,16,.55)", line: "rgba(20,18,16,.10)", line2: "rgba(20,18,16,.18)",
  accent: "#E86A3A", accentDeep: "#C24E22", accentSoft: "#FFE8DC", green: "#1F8A5B", greenBg: "rgba(31,138,91,.12)",
});
// The only tokens shared with myPlanV3Tokens must stay identical to it.
const v3 = MY_PLAN_V3_TOKENS as Record<string, string>;
assert.equal(C.peach.toLowerCase(), v3["--mp-chip-on-bg"]);
assert.equal(C.peachLine.toLowerCase(), v3["--mp-chip-on-line"]);

// Dates (local, no TZ shifts).
assert.deepEqual(fmtDateChip("2026-12-05"), { dow: "сб", day: "5", month: "дек", monthIdx: 11, year: 2026 });
assert.equal(fmtDateLong("2026-12-06"), "Воскресенье, 6 декабря");
assert.equal(fmtDateShort("2026-12-06"), "6 декабря");
assert.equal(pluralRu(2, ["сеанс", "сеанса", "сеансов"]), "сеанса");
assert.equal(formatSessionDotsLabel(1), "1 сеанс в этот день");
assert.equal(formatSessionDotsLabel(5), "3 или больше сеансов в этот день");

// KickerLine.
const kicker = renderToStaticMarkup(<KickerLine label="в плане" />);
assert.ok(kicker.includes("в плане") && kicker.includes("text-transform:uppercase"));

// SaveConfirmBar: label, date text, disabled gate decided by the caller.
const enabled = renderToStaticMarkup(<SaveConfirmBar iso="2026-12-06" time="11:00" onConfirm={() => {}} label="Перенести" />);
assert.ok(enabled.includes("Перенести") && enabled.includes("Воскресенье") && enabled.includes("декабря") && enabled.includes("11:00"));
assert.ok(!enabled.includes("disabled"));
const disabled = renderToStaticMarkup(<SaveConfirmBar iso="2026-12-06" onConfirm={() => {}} disabled />);
assert.ok(disabled.includes("disabled") && disabled.includes("Выберите, для кого сохраняем"));
assert.ok(!disabled.includes("<ArrowIcon"));

// DateSlider.
const slider = renderToStaticMarkup(
  <DateSlider options={["2026-12-05", "2026-12-06"]} selISO="2026-12-05" onSelect={() => {}} sessionCountsByDate={{ "2026-12-05": 2 }} />,
);
assert.ok(slider.includes('data-iso="2026-12-05"') && slider.includes("2 сеанса в этот день"));

console.log("save-flow primitives tests: OK");
