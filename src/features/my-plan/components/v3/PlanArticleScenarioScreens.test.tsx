import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { PlanArticleScreen, planArticleHref } from "./PlanArticleScreen";
import { PlanScenarioScreen } from "./PlanScenarioScreen";
import type { PlanItemWithActivity } from "../../types/event";

const base = {
  userId: "u",
  activityId: null,
  startsAt: null,
  coverImageUrl: null,
  createdAt: new Date("2026-10-01"),
  source: "CATALOG",
  activity: null,
} as const;

const article = {
  ...base,
  id: "p1",
  date: "2026-11-14",
  title: "Как подготовить ребёнка к стоматологу",
  articleId: "art1",
  article: { slug: "stomatolog", excerpt: "Что рассказать заранее.", category: { nameRu: "Здоровье" }, city: { slug: "minsk" } },
} as unknown as PlanItemWithActivity;

assert.equal(planArticleHref(article, "grodno"), "/minsk/blog/stomatolog");
assert.equal(planArticleHref({ ...article, article: null } as PlanItemWithActivity, "minsk"), null);

const html = renderToStaticMarkup(
  <PlanArticleScreen item={article} onBack={() => undefined} onRemove={() => undefined} />,
);
assert.match(html, /Рубрика «Здоровье»/);
assert.match(html, /Читать статью/);
assert.match(html, /href="\/minsk\/blog\/stomatolog"/);

const step = (id: string, title: string, at: string | null) =>
  ({ ...base, id, date: "2026-11-15", title, startsAt: at ? new Date(`2026-11-15T${at}:00`) : null }) as unknown as PlanItemWithActivity;
const scen = renderToStaticMarkup(
  <PlanScenarioScreen
    date="2026-11-15"
    items={[step("b", "Обед", "13:00"), step("a", "Прогулка", "10:00"), step("c", "Без времени", null)]}
    changed
    onBack={() => undefined}
    onOpen={() => undefined}
  />,
);
assert.ok(scen.indexOf("Прогулка") < scen.indexOf("Обед"), "шаги по времени");
assert.doesNotMatch(scen, /Без времени/);
assert.match(scen, /План изменился/);
assert.match(scen, /Открыть сценарий/);
console.log("Article/Scenario screens: OK");
