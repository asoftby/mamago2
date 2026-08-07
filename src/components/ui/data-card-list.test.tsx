/**
 * Нет React test harness в репозитории (нет testing-library/jsdom) — статически
 * рендерим через react-dom/server и проверяем разметку строковыми проверками.
 */
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import {
  DataCardList,
  DataCard,
  DataCardHeader,
  DataCardRow,
  DataCardActions,
} from "./data-card-list";

// 1. Список карточек скрыт от md и выше — на десктопе используется <table>, не дублируется.
{
  const html = renderToStaticMarkup(
    <DataCardList>
      <DataCard>demo</DataCard>
    </DataCardList>,
  );
  assert.ok(html.includes("md:hidden"), "card list must be hidden from md breakpoint up");
}

// 2. Пустые поля не рендерятся вообще (ни лейбл, ни значение).
{
  const html = renderToStaticMarkup(
    <DataCard>
      <DataCardRow label="Email" value="a@example.com" />
      <DataCardRow label="Телефон" value={null} />
      <DataCardRow label="Telegram" value="" />
    </DataCard>,
  );
  assert.ok(html.includes("Email"), "populated row must render");
  assert.ok(html.includes("a@example.com"), "populated value must render");
  assert.ok(!html.includes("Телефон"), "row with null value must not render label");
  assert.ok(!html.includes("Telegram"), "row with empty string value must not render label");
}

// 3. Заголовок карточки: badge необязателен.
{
  const withBadge = renderToStaticMarkup(
    <DataCardHeader title="Иван Иванов" badge={<span data-testid="badge">Активен</span>} />,
  );
  assert.ok(withBadge.includes("Иван Иванов"));
  assert.ok(withBadge.includes("Активен"));

  const withoutBadge = renderToStaticMarkup(<DataCardHeader title="Иван Иванов" />);
  assert.ok(withoutBadge.includes("Иван Иванов"));
}

// 4. Действия карточки — контейнер с достаточной зоной нажатия (используется вместе с Button).
{
  const html = renderToStaticMarkup(
    <DataCardActions>
      <button type="button">Открыть</button>
    </DataCardActions>,
  );
  assert.ok(html.includes("flex-wrap"), "actions must wrap instead of overflowing the card");
  assert.ok(html.includes("Открыть"));
}

console.log("data-card-list.test.tsx OK");
