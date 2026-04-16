/**
 * Статические проверки парсера family-by-afisha-event (без сети).
 */
import assert from "node:assert/strict";

import {
  extractAfishaFullDescription,
  extractAfishaScheduleRaw,
  extractAfishaVenueLocation,
  extractNewsIdInnerHtml,
  normalizeAfishaAddressText,
  parseRussianDayMonthTimeToIsoMinsk,
} from "./family-by-afisha-event.parser";

const iso = parseRussianDayMonthTimeToIsoMinsk("18 апреля 18:00");
assert.ok(iso, "ISO string");
const d = new Date(iso!);
assert.equal(d.getUTCMonth(), 3);
assert.equal(d.getUTCDate(), 18);
assert.equal(d.getUTCHours(), 15);
assert.equal(d.getUTCMinutes(), 0);

// ── Место: venue + address (как на family.by) ─────────────────────────────
{
  const html = `<div>
<strong>Место:</strong> <a href="/spravka/muzej/123-muzey.html">Музей природы и экологии</a>, ул. М.Богдановича, 9А
<b>Возраст:</b> от 3 лет
</div>`;
  const r = extractAfishaVenueLocation(html, "https://family.by/afisha/19343-test.html");
  assert.equal(r.venueName, "Музей природы и экологии");
  assert.equal(r.addressText, "ул. М.Богдановича, 9А");
  assert.ok(r.venueUrl?.includes("family.by"), "absolute venue url");
}

{
  const html = `<b>Место:</b> Музей природы и экологии, ул. М.Богдановича, 9А<b>Возраст:</b> 3+`;
  const r = extractAfishaVenueLocation(html);
  assert.equal(r.venueName, "Музей природы и экологии");
  assert.equal(r.addressText, "ул. М.Богдановича, 9А");
  assert.equal(r.venueUrl, null);
}

{
  const html = `<b>Место:</b> <a href="/x.html">Музей природы и экологии, ул. М.Богдановича, 9А</a><b>Возраст:</b>`;
  const r = extractAfishaVenueLocation(html, "https://family.by/afisha/e.html");
  assert.equal(r.venueName, "Музей природы и экологии");
  assert.equal(r.addressText, "ул. М.Богдановича, 9А");
}

assert.equal(
  normalizeAfishaAddressText("  , ул. М.Богдановича,9А  , "),
  "ул. М.Богдановича, 9А",
);

// ── Полное тело новости + расписание (nested div) ──────────────────────────
{
  const html = `<!doctype html><html><body>
<div id="news-id-19343">
<p>Вводный текст про выставку рептилий.</p>
<img src="/uploads/posts/2025-04/poster.jpg" width="400" />
<p>Второй длинный абзац с подробным описанием экспозиции и правилами посещения для семей.</p>
<div class="innerwrap">
<strong>Время проведения:</strong>
<div class="xfpovtor">
<div>10 апреля 14:00</div>
<div>11 апреля 15:30</div>
<div>12 апреля 11:00</div>
</div>
</div>
</div>
<div class="title_stype_brn2">Читайте также</div>
<p>Мусор после карточки</p>
</body></html>`;

  const inner = extractNewsIdInnerHtml(html);
  assert.ok(inner && inner.includes("Второй длинный абзац"), "full inner, not first </div> only");
  assert.ok(inner.includes("poster.jpg"), "image tag preserved in inner");

  const sched = extractAfishaScheduleRaw(html);
  assert.ok(sched?.raw.includes("10 апреля"), "schedule line 1");
  assert.ok(sched?.raw.includes("12 апреля"), "schedule last line");
  assert.ok(sched?.raw.includes("\n"), "multiline schedule");

  const title = "Выставка рептилий • Family.by";
  const desc = extractAfishaFullDescription(html, title);
  assert.ok(desc && desc.includes("Вводный текст"), "intro");
  assert.ok(desc && desc.includes("Второй длинный абзац"), "text after image");
  assert.ok(desc && !desc.includes("10 апреля"), "schedule stripped from description");
  assert.ok(desc && !desc.includes("Читайте также"), "footer marker truncated");
}
