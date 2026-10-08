/**
 * callback_data codec for inbox/requirement buttons (spec v1.3, section 9).
 * Telegram limits callback_data to 64 bytes; building fails above that.
 */
export const CALLBACK_DATA_MAX_BYTES = 64;

export type InboxCallbackAction = "add" | "edit" | "no" | "dup" | "upd" | "new";

export type DecodedCallback =
  | { kind: "inbox"; action: InboxCallbackAction; inboxItemId: string }
  | { kind: "inbox_child"; inboxItemId: string; childId: string }
  | { kind: "requirement_done"; requirementId: string };

const INBOX_ACTIONS: readonly InboxCallbackAction[] = ["add", "edit", "no", "dup", "upd", "new"];

function assertId(value: string, label: string): void {
  if (!value || value.includes(":")) {
    throw new Error(`Invalid ${label} for callback_data`);
  }
}

export function encodeCallback(decoded: DecodedCallback): string {
  let data: string;
  switch (decoded.kind) {
    case "inbox":
      assertId(decoded.inboxItemId, "inboxItemId");
      data = `inb:${decoded.action}:${decoded.inboxItemId}`;
      break;
    case "inbox_child":
      assertId(decoded.inboxItemId, "inboxItemId");
      assertId(decoded.childId, "childId");
      data = `inb:child:${decoded.inboxItemId}:${decoded.childId}`;
      break;
    case "requirement_done":
      assertId(decoded.requirementId, "requirementId");
      data = `req:done:${decoded.requirementId}`;
      break;
  }
  if (new TextEncoder().encode(data).length > CALLBACK_DATA_MAX_BYTES) {
    throw new Error(`callback_data exceeds ${CALLBACK_DATA_MAX_BYTES} bytes`);
  }
  return data;
}

export function decodeCallback(data: string | null | undefined): DecodedCallback | null {
  if (!data || new TextEncoder().encode(data).length > CALLBACK_DATA_MAX_BYTES) return null;
  const parts = data.split(":");

  if (parts[0] === "inb") {
    if (parts[1] === "child") {
      if (parts.length !== 4 || !parts[2] || !parts[3]) return null;
      return { kind: "inbox_child", inboxItemId: parts[2], childId: parts[3] };
    }
    const action = INBOX_ACTIONS.find((candidate) => candidate === parts[1]);
    if (!action || parts.length !== 3 || !parts[2]) return null;
    return { kind: "inbox", action, inboxItemId: parts[2] };
  }

  if (parts[0] === "req") {
    if (parts[1] !== "done" || parts.length !== 3 || !parts[2]) return null;
    return { kind: "requirement_done", requirementId: parts[2] };
  }

  return null;
}
