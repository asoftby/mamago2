import assert from "node:assert/strict";
import { describePostponed, summarizeNormalization } from "./normalization-notes";

const ok = { success: true };
const failed = { success: false, error: "AI_INVALID_OUTPUT" };
const noModel = { success: false, error: "postponed: model_not_configured" };
const budget = { success: false, error: "postponed: budget" };

// Postponed posts are neither successes nor failures.
assert.deepEqual(summarizeNormalization([]), { success: 0, failed: 0, postponed: 0, postponedReasons: [] });
assert.deepEqual(summarizeNormalization([ok, ok, failed, noModel, noModel, budget]), {
  success: 2, failed: 1, postponed: 3, postponedReasons: ["model_not_configured", "budget"],
});
// A real failure whose text merely mentions "postponed" later is still a failure.
assert.equal(summarizeNormalization([{ success: false, error: "not postponed: boom" }]).failed, 1);

// Nothing postponed: no note.
assert.equal(describePostponed(summarizeNormalization([ok, failed])), null);

// The reason an admin sees on DEV: the model is not configured.
{
  const note = describePostponed(summarizeNormalization(Array.from({ length: 10 }, () => noModel)), 60)!;
  assert.match(note, /^10 постов ждут нормализации\./);
  assert.match(note, /Модель не настроена/);
  assert.match(note, /OPENROUTER_API_KEY и OPENROUTER_CAPTURE_MODEL/);
  assert.match(note, /запустите импорт ещё раз/);
  assert.doesNotMatch(note, /лимит/);
}
// Budget reason names the limit.
{
  const note = describePostponed(summarizeNormalization([budget]), 60)!;
  assert.match(note, /^1 пост ждёт нормализации\./);
  assert.match(note, /Исчерпан лимит вызовов модели на запуск \(60\)/);
  assert.doesNotMatch(note, /Модель не настроена/);
}
// Both reasons are explained.
{
  const note = describePostponed(summarizeNormalization([noModel, budget]))!;
  assert.match(note, /Модель не настроена/);
  assert.match(note, /Исчерпан лимит вызовов модели на запуск:/);
}
// Russian plural forms.
for (const [n, phrase] of [[1, "1 пост ждёт"], [2, "2 поста ждут"], [5, "5 постов ждут"], [11, "11 постов ждут"], [21, "21 пост ждёт"], [22, "22 поста ждут"]] as const) {
  assert.match(describePostponed(summarizeNormalization(Array.from({ length: n }, () => noModel)))!, new RegExp(`^${phrase} нормализации`));
}

console.log("normalization-notes tests: OK");
