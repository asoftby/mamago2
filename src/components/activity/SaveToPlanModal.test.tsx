/**
 * Regression coverage for the Article "idea-only" save UI (no date picker,
 * ever) vs. the untouched Activity/Event date-slider flow.
 * No jsdom/RTL in this repo's test harness (see ArticleGallery.test.tsx), so
 * clicks aren't simulated — this asserts on the static markup for presence/
 * absence of the date-picker UI and required copy. Click → onCommit wiring
 * for Article is covered separately in persistArticleSave.test.ts.
 *
 * Run: npx tsx src/components/activity/SaveToPlanModal.test.tsx
 */
import { IdeaCollectionStep } from "./IdeaCollectionStep";
import { addDaysLocal, getLocalDateKey } from "@/lib/date/localDateKey";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import {
  SaveToPlanPickerBody,
  type SaveScenario,
  type SaveToPlanPickerBodyProps,
} from "./SaveToPlanModal";

function render(props: Omit<SaveToPlanPickerBodyProps, "onCommit" | "onClose">): string {
  return renderToStaticMarkup(
    <SaveToPlanPickerBody {...props} onCommit={() => {}} onClose={() => {}} />,
  );
}

const articleScenario: SaveScenario = {
  kind: "quickdate",
  title: "Детская зона MamaGo на фестивале огня Феникс",
  ideaOnly: true,
};

// ── Article: unsaved state ──────────────────────────────────────────────────
{
  const html = render({ scenario: articleScenario, isIdea: false, inPlan: false });

  // Required copy present (rendered lowercase in source; uppercase is a pure
  // CSS text-transform, same convention as the pre-existing "сохранить
  // активность" eyebrow — see IdeaOnlyView).
  assert.ok(html.includes("сохранить публикацию"), "shared publication save header");
  // "на потом" is a nested <span> (editorial serif italic accent) inside the
  // heading, so match the two parts rather than one exact phrase.
  assert.ok(html.includes("Сохранить"), "shared heading base present");
  assert.ok(html.includes("в идеи"), "shared heading accent present");
  assert.ok(
    html.includes("Детская зона MamaGo на фестивале огня Феникс"),
    "article title present",
  );
  assert.ok(html.includes("Сохранить в идеи"), "single action: save to ideas");
  assert.ok(
    html.includes("Вернуться к публикации позже"),
    "ideas action subtitle: article-specific, no 'без конкретного дня'",
  );

  // Date-picker UI must be entirely absent — not just hidden via CSS.
  assert.ok(!html.includes("Показать все"), "no 'show all dates' button");
  assert.ok(!html.includes("или без даты"), "no 'or without date' divider text");
  assert.ok(!html.includes("Время по записи"), "no time-chip/session UI");
  assert.ok(!html.includes("В какой"), "no date-slider heading");
  assert.ok(!html.includes("напомнить"), "no date-slider heading");
  assert.ok(!html.includes("Куда сохранить"), "no editorial date-choice heading");
  // Activity's default IdeasRow copy must not leak into the Article view.
  assert.ok(!html.includes("или без даты"), "article still has no date selection");
}

// ── Article: already saved as idea ──────────────────────────────────────────
{
  const html = render({ scenario: articleScenario, isIdea: true, inPlan: false });

  assert.ok(html.includes("уже в идеях"), "saved-as-idea state shown in shared header");
  assert.ok(
    html.includes("Детская зона MamaGo на фестивале огня Феникс"),
    "article title present in saved state",
  );
  assert.ok(html.includes("В коллекцию"), "collection selection remains available");

  // No upsell to plan a date, and no date UI at all, even if legacy
  // inPlan/planDate state existed.
  assert.ok(!html.includes("Готовы выбрать день"), "no plan-upsell nudge for articles");
  assert.ok(!html.includes("Запланировать"), "no schedule-from-idea action for articles");
}

// ── Article: ideaOnly ignores any legacy inPlan/planDate state ──────────────
{
  const html = render({
    scenario: articleScenario,
    isIdea: false,
    inPlan: true,
    planDate: "2026-01-01",
    planItemId: "legacy-plan-item",
  });
  assert.ok(!html.includes("Показать все"), "no date UI even with legacy inPlan state");
  assert.ok(!html.includes("В план"), "no plan-management view for articles");
  assert.ok(html.includes("Сохранить в идеи"), "still offers idea save");
}

// ── Activity/Event regression: date UI must be unaffected ──────────────────
const activityScenario: SaveScenario = {
  kind: "quickdate",
  title: "Мастер-класс по лепке",
  eventPlanDateOptions: [
    "2026-09-01",
    "2026-09-02",
    "2026-09-03",
    "2026-09-04",
    "2026-09-05",
    "2026-09-06",
    "2026-09-07",
  ],
};

{
  const html = render({ scenario: activityScenario, isIdea: false, inPlan: false });

  assert.ok(html.includes("В какой"), "date-slider heading still renders for activities");
  assert.ok(html.includes("напомнить"), "date-slider heading still renders for activities");
  assert.ok(html.includes("Показать все 7 дат"), "'show all dates' still available");
  assert.ok(html.includes("или без даты"), "'or without date' divider still present");
  assert.ok(html.includes("Сохранить в идеи"), "idea fallback still offered alongside dates, default copy unchanged");
  // Article-specific copy must never leak into the Activity scenario.
  assert.ok(!html.includes("Добавить в идеи"), "Article's idea CTA copy not reused for Activity");
  assert.ok(!html.includes("Оставь"), "Article headline not reused for Activity");
}

// Saved events use the same date slider as new events, with context actions.
{
  const html = render({ scenario: activityScenario, isIdea: true, inPlan: false });
  assert.ok(html.includes("В какой"), "saved events use the shared date picker");
  assert.ok(html.includes("Уже в идеях"), "saved state appears in the shared picker");
  assert.ok(html.includes("Убрать из идей"), "saved state can still be removed");
  assert.ok(!html.includes("Готовы"), "old separate upsell screen is not rendered");
}

// Review regressions: lone start date must not generate arbitrary alternatives.
{
  const start = addDaysLocal(getLocalDateKey(), 5);
  const html = render({
    scenario: { kind: "quickdate", title: "Разовое событие", eventPlanDateISO: start },
    isIdea: true,
  });
  assert.ok(html.includes("1 дата"), "one-day event exposes exactly one date");
  assert.ok(!html.includes("Показать все 7 дат"), "no invented week of dates");
}

// For existing plans the initial selection must be the plan date, not the first session.
{
  const earliest = addDaysLocal(getLocalDateKey(), 2);
  const planned = addDaysLocal(getLocalDateKey(), 4);
  const html = render({
    scenario: { kind: "quickdate", title: "Повторяющееся событие", eventPlanDateOptions: [earliest, planned] },
    isIdea: true,
    inPlan: true,
    planDate: planned,
  });
  assert.ok(html.includes("Изменить дату"), "existing plan has contextual update action");
  assert.ok(html.includes(planned.slice(8)), "existing plan date appears in the selected confirmation");
}

// The article collection slide retains its entity label and scrolls as a whole
// on short desktop viewports, keeping the footer reachable.
{
  const html = renderToStaticMarkup(<IdeaCollectionStep title="Статья" kicker="сохранить статью"
    isIdea={false} onBack={() => {}} onApply={() => {}} />);
  assert.ok(html.includes("сохранить статью"));
  assert.ok(!html.includes("сохранить активность"));
  assert.ok(html.includes("Куда сохранить"));
  assert.ok(html.includes("max-h-[85dvh] overflow-y-auto"));
  assert.ok(html.includes("Без коллекции"));
}

console.log("SaveToPlanModal (Article ideaOnly vs Activity regression) tests: OK");
