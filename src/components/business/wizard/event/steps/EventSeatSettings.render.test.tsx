import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { renderToStaticMarkup } from "react-dom/server";
import { getDefaultFormData } from "../defaults";
import { getEventBookingCapacityIssues } from "../eventBookingCapacityValidation";
import { buildEventPayload, mapEventToFormData, type ActivityWithRelations } from "../mappers";
import type { EventFormData } from "../types";
// The production bundler handles styles. Keep the real React components in this Node render.
const require = createRequire(import.meta.url);
const originalCssLoader = require.extensions[".css"];
require.extensions[".css"] = () => {};
const { Step5PricingParticipation } =
  require("./Step5PricingParticipation") as typeof import("./Step5PricingParticipation");
if (originalCssLoader) require.extensions[".css"] = originalCssLoader;
else delete require.extensions[".css"];

function eventWithSlot(capacity: number | null): EventFormData {
  return {
    ...getDefaultFormData(),
    participationMode: "time-slots",
    eventSeatMode: "SEPARATE",
    adultSeatCapacity: 17,
    childSeatCapacity: 23,
    timeSlots: {
      dates: [{
        id: "test-date",
        isoDate: "2027-01-20",
        label: "20 января",
        slots: [{ id: "test-slot", startTime: "10:00", endTime: "11:00", capacity }],
      }],
    },
  };
}

function renderEditor(data: EventFormData, ctaStepEnabled: boolean): string {
  return renderToStaticMarkup(
    <Step5PricingParticipation data={data} onChange={() => {}} isEditable ctaStepEnabled={ctaStepEnabled} />,
  );
}

const saved = buildEventPayload(eventWithSlot(31));
const restored = mapEventToFormData({
  id: "seat-settings-test",
  title: "Событие",
  description: "",
  ageTags: [],
  scheduleJson: saved.scheduleJson,
  format: getDefaultFormData().format,
} as ActivityWithRelations);

for (const ctaStepEnabled of [false, true]) {
  const editor = ctaStepEnabled ? "shared" : "legacy";
  const data = restored;
  const html = renderEditor(data, ctaStepEnabled);
  const seatHeading = "Кто занимает место?";
  const slotLabel = "Вместимость (чел.) *";
  assert.equal(html.split(seatHeading).length - 1, 1, `${editor}: single seat settings block`);
  assert.ok(html.indexOf(seatHeading) < html.indexOf(slotLabel), `${editor}: seat settings before slots`);
  const inputs = html.match(/<input\b[^>]*>/g) ?? [];
  assert.equal(inputs.filter((input) => input.includes('name="eventSeatMode"')).length, 4);
  assert.ok(inputs.some((input) => input.includes('value="SEPARATE"') && input.includes('checked=""')));
  for (const value of [17, 23, 31]) {
    assert.equal(inputs.filter((input) => input.includes(`value="${value}"`)).length, 1);
  }
  assert.ok(inputs.some((input) =>
    input.includes('value="31"') && input.includes('aria-required="true"') && input.includes('min="1"') && input.includes('step="1"'),
  ));
  assert.deepEqual(getEventBookingCapacityIssues(data), []);
  const incomplete = eventWithSlot(null);
  assert.match(renderEditor(incomplete, ctaStepEnabled), /Укажите вместимость/);
  assert.match(getEventBookingCapacityIssues(incomplete).join(" "), /вместимость/);
}

console.log("Event seat settings render once and preserve capacity in legacy and shared editors: PASS");
