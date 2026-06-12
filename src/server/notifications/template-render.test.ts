import assert from "node:assert/strict";

import {
  TemplateRenderError,
  escapeHtml,
  extractTemplateVariables,
  interpolateTemplate,
  renderTemplateForChannelCore,
  renderWithFallbackCore,
  sanitizeEmailHtml,
  sanitizeTelegramHtml,
  toPlainText,
  validateTemplateVariables,
} from "./template-render-core";

// ── Интерполяция ──────────────────────────────────────────────────────────────

{
  const result = interpolateTemplate({
    template: "В {{startsAtTime}} у вас в плане: {{eventTitle}}",
    payload: { startsAtTime: "16:00", eventTitle: "Йога" },
    allowedVariables: ["startsAtTime", "eventTitle"],
  });
  assert.equal(result, "В 16:00 у вас в плане: Йога");
}

// optional-переменная из схемы, отсутствующая в payload → пустая строка
{
  const result = interpolateTemplate({
    template: "Место: {{placeName}}.",
    payload: {},
    allowedVariables: ["placeName"],
  });
  assert.equal(result, "Место: .");
}

// пробелы внутри скобок допустимы
{
  const result = interpolateTemplate({
    template: "{{ eventTitle }}",
    payload: { eventTitle: "Йога" },
    allowedVariables: ["eventTitle"],
  });
  assert.equal(result, "Йога");
}

// ── Отказ при неизвестной переменной ─────────────────────────────────────────

{
  assert.throws(
    () =>
      interpolateTemplate({
        template: "Привет, {{userName}} и {{hacker}}!",
        payload: { userName: "Анна" },
        allowedVariables: ["userName"],
      }),
    (error: unknown) => {
      assert.ok(error instanceof TemplateRenderError);
      assert.deepEqual(error.unknownVariables, ["hacker"]);
      return true;
    },
  );
}

// ── Валидация шаблона при сохранении ─────────────────────────────────────────

{
  assert.deepEqual(extractTemplateVariables("{{a}} x {{b}} x {{a}}"), ["a", "b"]);

  const ok = validateTemplateVariables("Привет, {{userName}}", ["userName"]);
  assert.deepEqual(ok, { ok: true });

  const bad = validateTemplateVariables("{{userName}} {{oops}} {{bad}}", ["userName"]);
  assert.deepEqual(bad, { ok: false, unknownVariables: ["oops", "bad"] });
}

// ── HTML-эскейп переменных для Telegram (payload с < > &) — обязательный ─────

{
  const result = renderTemplateForChannelCore({
    channel: "TELEGRAM",
    subjectTemplate: "Скоро событие",
    bodyTemplate: "В плане: <b>{{eventTitle}}</b>",
    payload: { eventTitle: `Школа "Я & <Ты>" <script>alert(1)</script>` },
    allowedVariables: ["eventTitle"],
  });

  // subject вкладывается в body (у Telegram нет отдельного subject)
  assert.equal(result.subject, null);
  // переменная полностью эскейпнута, теги остались только из тела шаблона
  assert.equal(
    result.body,
    "Скоро событие\n\nВ плане: <b>Школа &quot;Я &amp; &lt;Ты&gt;&quot; &lt;script&gt;alert(1)&lt;/script&gt;</b>",
  );
  assert.ok(!result.body.includes("<script>"));
}

// ── Telegram: санитизация/балансировка на ИТОГОВОЙ склейке title + body ──────

// незакрытый тег в subject не должен приводить к отказу Telegram → автозакрытие
{
  const result = renderTemplateForChannelCore({
    channel: "TELEGRAM",
    subjectTemplate: "<b>Срочно",
    bodyTemplate: "текст напоминания",
    payload: {},
    allowedVariables: [],
  });
  assert.equal(result.subject, null);
  assert.equal(result.body, "<b>Срочно\n\nтекст напоминания</b>");
  // сбалансировано: число <b> равно числу </b>
  assert.equal((result.body.match(/<b>/g) ?? []).length, (result.body.match(/<\/b>/g) ?? []).length);
}

// тег, открытый в subject и закрытый в body, остаётся валидным сквозь границу
{
  const result = renderTemplateForChannelCore({
    channel: "TELEGRAM",
    subjectTemplate: "<b>Заголовок",
    bodyTemplate: "и тело</b> дальше",
    payload: {},
    allowedVariables: [],
  });
  assert.equal(result.body, "<b>Заголовок\n\nи тело</b> дальше");
}

// висячий закрывающий тег без пары — вычищается
{
  assert.equal(sanitizeTelegramHtml("текст</b> ещё"), "текст ещё");
  // идемпотентность на уже чистом HTML
  const once = sanitizeTelegramHtml("<b>x</b>");
  assert.equal(sanitizeTelegramHtml(once), once);
}

// ── Санитизация Telegram HTML-сабсета ────────────────────────────────────────

{
  const dirty =
    `<div>x</div><b>bold</b><script>alert(1)</script>` +
    `<a href="https://mamago.by">ok</a><a href="javascript:alert(1)">bad</a>` +
    `<span class="tg-spoiler">spoiler</span><span onclick="x()">plain</span>`;
  const clean = sanitizeTelegramHtml(dirty);
  assert.equal(
    clean,
    `x<b>bold</b>alert(1)<a href="https://mamago.by">ok</a>bad` +
      `<span class="tg-spoiler">spoiler</span>plain`,
  );
}

// ── Санитизация email HTML (общий sanitizeHtmlAllowlist) ─────────────────────
// Требование: <script>, <img onerror>, javascript:-href — всё вычищено.

{
  const dirty =
    `<p onclick="evil()">Привет</p><script>alert(1)</script>` +
    `<img src="x" onerror="alert(1)">` +
    `<a href="javascript:alert(1)">x</a><a href="https://mamago.by">ok</a>` +
    `<iframe src="https://evil"></iframe>`;
  const clean = sanitizeEmailHtml(dirty);
  assert.ok(!clean.includes("<script"), "script вычищен");
  assert.ok(!clean.includes("alert(1)"), "весь активный код (script/onerror/js-href) вычищен");
  assert.ok(!clean.includes("onclick"), "on*-обработчик вычищен");
  assert.ok(!clean.includes("onerror"), "img onerror вычищен");
  assert.ok(!clean.includes("<img"), "img (нет в allowlist) вычищен");
  assert.ok(!clean.includes("javascript:"), "javascript:-протокол вычищен");
  assert.ok(!clean.includes("<iframe"), "iframe вычищен");
  assert.ok(clean.includes(`<a href="https://mamago.by">ok</a>`), "валидная ссылка сохранена");
  assert.ok(clean.includes("Привет"), "текст сохранён");
}

// ── EMAIL: subject — plain text (без эскейпа), body — с эскейпом ─────────────

{
  const result = renderTemplateForChannelCore({
    channel: "EMAIL",
    subjectTemplate: "Заявка от {{customerName}}",
    bodyTemplate: "<p>{{customerName}}</p>",
    payload: { customerName: "ООО «А&Б»" },
    allowedVariables: ["customerName"],
  });
  assert.equal(result.subject, "Заявка от ООО «А&Б»");
  assert.equal(result.body, "<p>ООО «А&amp;Б»</p>");
}

// ── IN_APP: plain text + обрезка ─────────────────────────────────────────────

{
  const result = renderTemplateForChannelCore({
    channel: "IN_APP",
    subjectTemplate: "Скоро событие",
    bodyTemplate: "<b>{{eventTitle}}</b> в плане",
    payload: { eventTitle: "Йога" },
    allowedVariables: ["eventTitle"],
  });
  assert.equal(result.body, "Йога в плане");

  const long = toPlainText("а".repeat(2000), 100);
  assert.equal(long.length, 100);
  assert.ok(long.endsWith("…"));
}

// IN_APP: < > & в значении переменной сохраняются как есть (паритет со старым рендером)
{
  const result = renderTemplateForChannelCore({
    channel: "IN_APP",
    subjectTemplate: null,
    bodyTemplate: "{{eventTitle}} в плане",
    payload: { eventTitle: "Йога & <дети>" },
    allowedVariables: ["eventTitle"],
  });
  assert.equal(result.body, "Йога & <дети> в плане");
}

// эскейп html ровно один раз: escapeHtml идемпотентность не требуется, но контракт фиксируем
{
  assert.equal(escapeHtml(`<a & "b" 'c'>`), "&lt;a &amp; &quot;b&quot; &#39;c&#39;&gt;");
}

// ── Каскад override → дефолт → null ──────────────────────────────────────────

{
  // здоровый override побеждает дефолт
  const result = renderWithFallbackCore({
    channel: "IN_APP",
    payload: { title: "T", body: "B" },
    allowedVariables: ["title", "body"],
    override: { subject: "Свой: {{title}}", body: "{{body}}!" },
    fallbackDefault: { kind: "template", subject: "{{title}}", body: "{{body}}" },
  });
  assert.deepEqual(result, { subject: "Свой: T", body: "B!", source: "OVERRIDE" });
}

{
  // сломанный override (неизвестная переменная) → fallback на дефолт + лог
  let overrideError: unknown = null;
  const result = renderWithFallbackCore({
    channel: "IN_APP",
    payload: { title: "T", body: "B" },
    allowedVariables: ["title", "body"],
    override: { subject: null, body: "{{nope}}" },
    fallbackDefault: { kind: "template", subject: "{{title}}", body: "{{body}}" },
    onOverrideError: (error) => {
      overrideError = error;
    },
  });
  assert.deepEqual(result, { subject: "T", body: "B", source: "DEFAULT" });
  assert.ok(overrideError instanceof TemplateRenderError);
}

{
  // дефолт kind:"code" без override → null (рендерит код)
  const result = renderWithFallbackCore({
    channel: "EMAIL",
    payload: { verifyUrl: "https://x" },
    allowedVariables: ["verifyUrl"],
    override: null,
    fallbackDefault: { kind: "code", note: "react" },
  });
  assert.equal(result, null);
}

{
  // override при дефолте kind:"code" — рендерится (transactional override)
  const result = renderWithFallbackCore({
    channel: "EMAIL",
    payload: { verifyUrl: "https://x" },
    allowedVariables: ["verifyUrl"],
    override: { subject: "Подтвердите", body: `<a href="{{verifyUrl}}">Кнопка</a>` },
    fallbackDefault: { kind: "code", note: "react" },
  });
  assert.deepEqual(result, {
    subject: "Подтвердите",
    body: `<a href="https://x">Кнопка</a>`,
    source: "OVERRIDE",
  });
}

console.log("template-render tests: OK");
