import * as assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { CtaCalendarEditor } from "./CtaCalendarEditor";

const day = {
  id: "day-1",
  date: "2026-12-12",
  capacity: null as number | null,
  slots: [{
    id: "slot-1",
    startTime: "10:00",
    endTime: "11:00",
    capacity: null as number | null,
  }],
};
const onChange = () => {};
const onModeChange = () => {};

for (const mode of ["DATE_ONLY", "DATE_AND_TIME"] as const) {
  const html = renderToStaticMarkup(
    <CtaCalendarEditor
      days={[day]}
      mode={mode}
      requireCapacity
      onChange={onChange}
      onModeChange={onModeChange}
    />,
  );
  assert.ok(html.includes("Вместимость"), "capacity label is present");
  assert.ok(html.includes("Укажите вместимость (чел.)"), "required-field error is visible");
  assert.ok(html.includes('aria-required="true"'), "capacity is marked as mandatory");
  assert.ok(html.includes('aria-invalid="true"'), "invalid capacity is announced to assistive technology");

  const optional = renderToStaticMarkup(
    <CtaCalendarEditor days={[day]} mode={mode} onChange={onChange} onModeChange={onModeChange} />,
  );
  assert.ok(!optional.includes('aria-required="true"'), "other publication calendars keep optional capacity");
}

console.log("CtaCalendarEditor.capacity.test.tsx: OK");
