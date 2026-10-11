import { encodeCallback } from "./callbackCodec";
import type { CaptureDraft, CaptureEntry } from "./captureDraft.schema";
import { CAPTURE_TARGET_ALL_RULE, CAPTURE_TARGET_CHILD_RULE, CAPTURE_TARGET_ME_RULE } from "./captureReplies";

export type CaptureCard = {
  text: string;
  replyMarkup?: {
    inline_keyboard: Array<Array<{ text: string; callback_data: string }>>;
  };
};

function dateTime(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  const datePart = new Intl.DateTimeFormat("ru-BY", {
    timeZone: "Europe/Minsk",
    day: "numeric",
    month: "long",
  }).format(date);
  const timePart = new Intl.DateTimeFormat("ru-BY", {
    timeZone: "Europe/Minsk",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
  return `${datePart}, ${timePart}`;
}

function entryLines(
  entry: CaptureEntry,
  childNames: ReadonlyMap<string, string>,
): string[] {
  const lines: string[] = [];
  lines.push(
    entry.title.value.trim() ||
      (entry.entryType === "TASK" ? "Задача" : "Событие"),
  );

  const when = dateTime(entry.startsAt.value ?? entry.dueAt.value);
  const childName = entry.child.childId
    ? childNames.get(entry.child.childId)
    : null;
  const meta: string[] = [];
  if (when) {
    const inferred =
      entry.startsAt.state === "inferred" || entry.dueAt.state === "inferred";
    meta.push(`${inferred ? "⚠️ " : ""}${when}`);
  }
  if (childName) {
    meta.push(`${entry.child.state === "inferred" ? "⚠️ " : ""}${childName}`);
  }
  if (meta.length) lines.push(meta.join(" · "));

  if (entry.location.value) {
    lines.push(
      `${entry.location.state === "inferred" ? "⚠️ " : ""}${entry.location.value}`,
    );
  }

  if (entry.requirements.length) {
    lines.push("", "Подготовить:");
    for (const requirement of entry.requirements) {
      const due = dateTime(requirement.dueAt);
      lines.push(`• ${requirement.text}${due ? ` — до ${due}` : ""}`);
    }
  }
  return lines;
}

export function renderChildChoiceCard(
  inboxItemId: string,
  children: Array<{ id: string; name: string | null }>,
): CaptureCard {
  return {
    text: "Для кого это?",
    replyMarkup: {
      inline_keyboard: [
        ...children.map((child) => [
          {
            text: child.name?.trim() || "Ребёнок",
            callback_data: encodeCallback({
              kind: "inbox_child" as const,
              inboxItemId,
              childId: child.id,
            }),
          },
        ]),
        [
          { text: "Изменить", callback_data: encodeCallback({ kind: "inbox", action: "edit", inboxItemId }) },
          { text: "Исправить текст", callback_data: encodeCallback({ kind: "inbox", action: "replace", inboxItemId }) },
        ],
        [{ text: "Не то", callback_data: encodeCallback({ kind: "inbox", action: "no", inboxItemId }) }],
      ],
    },
  };
}

export function renderCaptureCard(
  inboxItemId: string,
  draft: CaptureDraft,
  ruleCodes: readonly string[],
  childNames: ReadonlyMap<string, string>,
): CaptureCard {
  if (draft.intent === "NONE" || draft.entries.length === 0) {
    return {
      text: "Не нашёл здесь событие или задачу. Можно отправить исправленное описание целиком.",
      replyMarkup: {
        inline_keyboard: [
          [{ text: "Исправить текст", callback_data: encodeCallback({ kind: "inbox", action: "replace", inboxItemId }) }],
          [{ text: "Не то", callback_data: encodeCallback({ kind: "inbox", action: "no", inboxItemId }) }],
        ],
      },
    };
  }

  if (draft.intent !== "CREATE") {
    return {
      text: "Похоже, это изменение уже добавленного события. Подтверждение изменений пока недоступно; можно исправить текст и распознать заново.",
      replyMarkup: {
        inline_keyboard: [
          [{ text: "Исправить текст", callback_data: encodeCallback({ kind: "inbox", action: "replace", inboxItemId }) }],
          [{ text: "Не то", callback_data: encodeCallback({ kind: "inbox", action: "no", inboxItemId }) }],
        ],
      },
    };
  }

  const duplicate = ruleCodes.includes("DUPLICATE_FOUND");
  const header = duplicate
    ? "Похоже, это уже в плане"
    : draft.entries.length > 1
      ? "Нашёл несколько пунктов"
      : draft.entries[0]!.entryType === "TASK"
        ? "Нашёл задачу"
        : "Нашёл событие";

  const target = ruleCodes.includes(CAPTURE_TARGET_ME_RULE)
    ? "Я"
    : ruleCodes.includes(CAPTURE_TARGET_ALL_RULE)
      ? "Для всех"
      : ruleCodes.includes(CAPTURE_TARGET_CHILD_RULE)
        ? childNames.get(draft.entries[0]?.child.childId ?? "") ?? "Ребёнок"
        : null;
  const choices = [
    { text: `${target === "Я" ? "✓ " : ""}Я`, callback_data: encodeCallback({ kind: "inbox_target", target: "me", inboxItemId }) },
    ...[...childNames.entries()].map(([childId, name]) => ({
      text: `${target === name ? "✓ " : ""}${name}`,
      callback_data: encodeCallback({ kind: "inbox_child", inboxItemId, childId }),
    })),
    { text: `${target === "Для всех" ? "✓ " : ""}Для всех`, callback_data: encodeCallback({ kind: "inbox_target", target: "all", inboxItemId }) },
  ];
  const targetRows = [];
  for (let i = 0; i < choices.length; i += 3) targetRows.push(choices.slice(i, i + 3));

  const body = draft.entries.flatMap((entry, index) => [
    ...(index ? ["", "—"] : []),
    ...entryLines(entry, childNames),
  ]);

  return {
    text: [header, "", ...body, "", `Для кого: ${target ?? "выберите перед добавлением"}`].join("\n"),
    replyMarkup: duplicate
      ? {
          inline_keyboard: [
            ...targetRows,
            [
              {
                text: "Уже добавлено",
                callback_data: encodeCallback({
                  kind: "inbox",
                  action: "no",
                  inboxItemId,
                }),
              },
              {
                text: "Добавить ещё раз",
                callback_data: encodeCallback({
                  kind: "inbox",
                  action: "dup",
                  inboxItemId,
                }),
              },
            ],
            [
              { text: "Изменить", callback_data: encodeCallback({ kind: "inbox", action: "edit", inboxItemId }) },
              { text: "Исправить текст", callback_data: encodeCallback({ kind: "inbox", action: "replace", inboxItemId }) },
            ],
          ],
        }
      : {
          inline_keyboard: [
            ...targetRows,
            [
              {
                text: "Добавить в план",
                callback_data: encodeCallback({
                  kind: "inbox",
                  action: "add",
                  inboxItemId,
                }),
              },
            ],
            [
              {
                text: "Изменить",
                callback_data: encodeCallback({
                  kind: "inbox",
                  action: "edit",
                  inboxItemId,
                }),
              },
              {
                text: "Исправить текст",
                callback_data: encodeCallback({
                  kind: "inbox",
                  action: "replace",
                  inboxItemId,
                }),
              },
            ],
            [
              {
                text: "Не то",
                callback_data: encodeCallback({
                  kind: "inbox",
                  action: "no",
                  inboxItemId,
                }),
              },
            ],
          ],
        },
  };
}
