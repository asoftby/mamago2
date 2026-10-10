import assert from "node:assert/strict";
import test from "node:test";
import { draft, entry } from "./captureDraft.testkit";
import {
  renderCaptureCard,
  renderChildChoiceCard,
} from "./captureCard";

test("CREATE card renders add/edit/no callbacks and inferred markers", () => {
  const value = draft({
    entries: [
      entry({
        child: { childId: "child-1", raw: null, state: "inferred" },
        startsAt: {
          value: "2026-10-09T09:30:00+03:00",
          state: "inferred",
          basis: "9 октября",
        },
        location: {
          value: "Музей",
          placeId: null,
          state: "stated",
        },
        requirements: [
          {
            kind: "BRING",
            text: "взять воду",
            dueAt: null,
            dueHasTime: false,
            amount: null,
            currency: null,
            state: "stated",
          },
        ],
      }),
    ],
  });

  const card = renderCaptureCard(
    "inbox-1",
    value,
    [],
    new Map([["child-1", "Тая"]]),
  );

  assert.match(card.text, /Нашёл событие/);
  assert.match(card.text, /⚠️/);
  assert.match(card.text, /Тая/);
  assert.match(card.text, /взять воду/);
  assert.deepEqual(
    card.replyMarkup?.inline_keyboard.flat().map((button) => button.callback_data),
    ["inb:add:inbox-1", "inb:edit:inbox-1", "inb:replace:inbox-1", "inb:no:inbox-1"],
  );
});

test("duplicate card never silently creates a second item", () => {
  const card = renderCaptureCard(
    "inbox-2",
    draft(),
    ["DUPLICATE_FOUND"],
    new Map(),
  );

  assert.match(card.text, /уже в плане/);
  assert.deepEqual(
    card.replyMarkup?.inline_keyboard.flat().map((button) => button.callback_data),
    ["inb:no:inbox-2", "inb:dup:inbox-2", "inb:edit:inbox-2", "inb:replace:inbox-2"],
  );
});

test("child choice uses inbox_child callbacks", () => {
  const card = renderChildChoiceCard("inbox-3", [
    { id: "c1", name: "Тая" },
    { id: "c2", name: "Стёпа" },
  ]);

  assert.equal(card.text, "Для кого это?");
  assert.deepEqual(
    card.replyMarkup?.inline_keyboard.flat().map((button) => button.callback_data),
    ["inb:child:inbox-3:c1", "inb:child:inbox-3:c2", "inb:edit:inbox-3", "inb:replace:inbox-3", "inb:no:inbox-3"],
  );
});

test("a screenshot interpreted as NONE still offers a way to replace the text", () => {
  const card = renderCaptureCard(
    "inbox-none",
    draft({ intent: "NONE", entries: [] }),
    [],
    new Map(),
  );
  assert.match(card.text, /исправленное описание/);
  assert.deepEqual(
    card.replyMarkup?.inline_keyboard.flat().map((button) => button.callback_data),
    ["inb:replace:inbox-none", "inb:no:inbox-none"],
  );
});

test("a screenshot interpreted as UPDATE still allows full text replacement", () => {
  const card = renderCaptureCard(
    "inbox-update",
    draft({ intent: "UPDATE" }),
    [],
    new Map(),
  );
  assert.deepEqual(
    card.replyMarkup?.inline_keyboard.flat().map((button) => button.callback_data),
    ["inb:replace:inbox-update", "inb:no:inbox-update"],
  );
});
