/**
 * Нет React test harness в репозитории (нет testing-library/jsdom) — статически
 * рендерим TimeSlotEditor через react-dom/server и проверяем разметку.
 * Интерактив поповера (клавиатура, Escape, фокус) проверяется вручную в браузере.
 */
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { TimeSlotEditor } from "./TimeSlotEditor";

const noop = () => {};
const savedSlot = { id: "slot-1", date: "2026-11-16", startTime: "10:00", endTime: "11:00", capacity: 8 };

function labelledField(html: string): string {
  const match = /<label[^>]*for="(time-slot-date-[^"]+)"/.exec(html);
  assert.ok(match, "visible «Дата» label must point at the date field via for=");
  return match[1]!;
}

// 1. Saved slot: calendar trigger instead of the native date input, same calendar day.
{
  const html = renderToStaticMarkup(<TimeSlotEditor entityType="event" value={[savedSlot]} onChange={noop} />);
  assert.ok(!html.includes('type="date"'), "native date input must be gone");
  assert.ok(html.includes("16 ноября 2026"), "saved YYYY-MM-DD is shown as the same calendar day");
  assert.ok(html.includes("Вместимость (чел.)"), "capacity label states the unit");
  assert.ok(!html.includes(">Вместимость<"), "old bare capacity label must be gone");

  // Accessible name = «Дата» + selected value; hint and trigger are wired together.
  const id = labelledField(html);
  const trigger = new RegExp(`<button[^>]*id="${id}"[^>]*>`).exec(html)?.[0];
  assert.ok(trigger, "trigger button carries the id the label points at");
  assert.ok(trigger.includes(`aria-labelledby="${id}-label ${id}-value"`), "aria-labelledby = label + value");
  assert.ok(trigger.includes(`aria-describedby="${id}-hint"`), "trigger is described by the hint");
  assert.ok(trigger.includes('type="button"'), "must not submit the surrounding wizard form");
  assert.ok(html.includes(`id="${id}-label"`) && html.includes(`id="${id}-value"`) && html.includes(`id="${id}-hint"`));
  assert.ok(!html.includes(`id="${id}-error"`), "no error before the user has touched the field");
  assert.ok(!/\sdisabled(=|\s|>)/.test(trigger), "enabled by default (attribute, not the disabled: class variant)");
}

// 2. #1268: slots prefilled from the event schedule still show their dates.
{
  const html = renderToStaticMarkup(
    <TimeSlotEditor
      entityType="event"
      value={[]}
      onChange={noop}
      suggestions={{
        suggestions: [
          { date: "2026-12-05", startTime: "10:00", endTime: "11:00" },
          { date: "2026-12-12", startTime: "", endTime: "" },
        ],
      }}
    />,
  );
  assert.ok(html.includes("5 декабря 2026"), "first suggested date is rendered");
  assert.ok(html.includes("12 декабря 2026"), "second suggested date is rendered");
  assert.ok(html.includes("Блок 1") && html.includes("Блок 2"), "one block per suggested date");
  assert.ok(!html.includes('type="date"'));
  assert.ok(!html.includes("Добавить из расписания"), "nothing is missing after seeding");
}

// 3. Empty editor: placeholder, still keyboard-reachable button.
{
  const html = renderToStaticMarkup(<TimeSlotEditor entityType="offer" value={[]} onChange={noop} />);
  assert.ok(html.includes("Выберите дату"), "placeholder for an empty date");
  assert.ok(html.includes("Выберите день, когда откроется запись на предложение."), "offer hint kept");
  labelledField(html);
}

// 4. Disabled state reaches the trigger.
{
  const html = renderToStaticMarkup(<TimeSlotEditor entityType="event" value={[savedSlot]} onChange={noop} disabled />);
  const id = labelledField(html);
  const trigger = new RegExp(`<button[^>]*id="${id}"[^>]*>`).exec(html)?.[0] ?? "";
  assert.ok(/\bdisabled(=|\s|>)/.test(trigger), "disabled trigger");
}

// 5. Hydration safety: slot/day ids are random, so the DOM ids must not depend on them.
//    Two independent renders of the same input (server HTML vs hydration) must produce identical ids.
{
  const render = () =>
    renderToStaticMarkup(
      <TimeSlotEditor
        entityType="event"
        value={[]}
        onChange={noop}
        suggestions={{ suggestions: [{ date: "2026-12-05", startTime: "10:00", endTime: "11:00" }] }}
      />,
    );
  const a = render();
  const b = render();
  assert.equal(labelledField(a), labelledField(b), "date field id is stable across renders");
}


// 6. A scheduled event slot without capacity must show an explicit required
// field error; it must not look like a complete slot that can be saved.
{
  const html = renderToStaticMarkup(
    <TimeSlotEditor
      entityType="event"
      value={[{ ...savedSlot, capacity: null }]}
      onChange={noop}
    />,
  );
  assert.ok(html.includes("Вместимость (чел.) *"), "capacity field is visibly required");
  assert.ok(html.includes("Укажите вместимость"), "missing capacity is explained immediately");
  assert.ok(html.includes('aria-required="true"'), "capacity is required for accessibility");
}

console.log("TimeSlotEditor.slotDate.test.tsx: OK");
