import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { CollectionPublicationFrame } from "./CollectionPublicationFrame";

test("collection publications share the same responsive layout", () => {
  const html = renderToStaticMarkup(
    <CollectionPublicationFrame title="Тест: Праздник" media={<div>Фото</div>} identity={<span>Праздники</span>} description={<p>Подробности</p>}>
      <button type="button">Оставить заявку</button>
    </CollectionPublicationFrame>,
  );
  assert.match(html, /md:grid-cols-\[minmax\(0,5fr\)_minmax\(0,7fr\)\]/);
  assert.match(html, /!text-\[20px\]/);
  assert.match(html, /Оставить заявку/);
  assert.match(html, /aria-expanded="false"/);
  assert.match(html, /Описание/);
});

test("editorial accordions share styling and cap their count at four", () => {
  const html = renderToStaticMarkup(
    <CollectionPublicationFrame title="Лагерь" media={<div />} identity={<div />} description={<p>Вводная информация</p>}
      sections={["Смены", "Проживание и питание", "Что входит", "Лишний раздел"].map((title, index) => ({ id: `extra-${index}`, title, lines: ["Сведения"] }))}>
      <div>Стоимость</div>
    </CollectionPublicationFrame>,
  );
  assert.equal((html.match(/aria-expanded="false"/g) ?? []).length, 4);
  assert.match(html, /Описание/);
  assert.match(html, /Смены/);
  assert.doesNotMatch(html, /Лишний раздел/);
});
