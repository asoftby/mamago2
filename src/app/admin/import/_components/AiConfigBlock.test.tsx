import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { getAiConfigStatus } from "@/lib/ai/aiConfigStatus";
import { AiConfigBlock } from "./AiConfigBlock";

const KEY = "sk-or-v1-SECRETSENTINEL-0123456789abcdef";
const render = (env: Record<string, string | undefined>) =>
  renderToStaticMarkup(createElement(AiConfigBlock, { status: getAiConfigStatus(env) }));

// ── Everything configured ───────────────────────────────────────────────────
{
  const html = render({
    OPENROUTER_API_KEY: KEY,
    OPENROUTER_CAPTURE_MODEL: "google/gemini-2.5-flash",
    OPENROUTER_CAPTURE_MODEL_STRONG: "anthropic/claude-sonnet-4.5",
    OPENROUTER_MODEL: "openai/gpt-4o-mini",
    OPENROUTER_SITE_URL: "https://example.org",
    OPENROUTER_APP_NAME: "Afisha",
  });
  assert.match(html, /Конфигурация AI/);
  assert.equal((html.match(/data-severity="ok"/g) ?? []).length, 5, "every row is ok");
  assert.doesNotMatch(html, /⚠️/);
  assert.doesNotMatch(html, /role="alert"/, "no blocking alert when configured");
  assert.match(html, /google\/gemini-2\.5-flash/, "model names are shown");
  assert.match(html, /Зависят: Capture, нормализатор постов каналов/);
  assert.doesNotMatch(html, /SECRETSENTINEL|sk-or|example\.org|Afisha/, "no secret or site value in the markup");
}

// ── Nothing configured ──────────────────────────────────────────────────────
{
  const html = render({});
  assert.match(html, /role="alert"/);
  assert.match(html, /Посты каналов откладываются, Capture не распознаёт скриншоты/);
  assert.equal((html.match(/data-severity="warning"/g) ?? []).length, 2, "key and fast model are warnings");
  assert.equal((html.match(/data-severity="info"/g) ?? []).length, 3, "optional rows are informational, not alarms");
  assert.equal((html.match(/⚠️/g) ?? []).length, 2);
  assert.match(html, /OPENROUTER_API_KEY/);
  assert.match(html, /OPENROUTER_CAPTURE_MODEL/);
  assert.match(html, /OPENROUTER_CAPTURE_MODEL_STRONG/);
  assert.match(html, /OPENROUTER_MODEL/);
  assert.match(html, /не задано/);
  assert.match(html, /используется модель по умолчанию openai\/gpt-4o-mini/);
  assert.match(html, /обогащение событий/, "dependent features are named");
}

// ── Only the fast model is missing: the consequence is spelled out ───────────
{
  const html = render({ OPENROUTER_API_KEY: KEY });
  assert.match(html, /role="alert"/);
  assert.match(html, /OPENROUTER_CAPTURE_MODEL/);
  assert.doesNotMatch(html, /SECRETSENTINEL/);
}

console.log("AiConfigBlock tests: OK");
