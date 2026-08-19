/**
 * Нет React test harness в репозитории (нет testing-library/jsdom) — статически
 * рендерим через react-dom/server и проверяем разметку строковыми проверками,
 * как это делает src/components/city/DiscoveryIntentTabs.test.tsx.
 */
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import {
  TableContainer,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  stickyActionColumnCellClass,
  stickyActionColumnHeadClass,
} from "./table";

// 1. TableContainer — скроллящийся регион с корректными aria/keyboard атрибутами.
{
  const html = renderToStaticMarkup(
    <TableContainer minWidthClassName="min-w-[640px]" scrollLabel="Список пользователей">
      <table className="w-full">
        <tbody>
          <tr>
            <td>demo</td>
          </tr>
        </tbody>
      </table>
    </TableContainer>,
  );

  assert.ok(html.includes('role="region"'), "scroll region must have role=region");
  assert.ok(html.includes('aria-label="Список пользователей"'), "scroll region must carry aria-label");
  assert.ok(html.includes('tabindex="0"'), "scroll region must be keyboard-focusable");
  assert.ok(html.includes("overflow-x-auto"), "scroll region must allow horizontal scroll");
  assert.ok(html.includes("min-w-0"), "outer wrapper must not force page overflow");
  assert.ok(html.includes("min-w-[640px]"), "min width class must be applied to inner wrapper");
}

// 2. Без overflow контент не должен ломать layout — min-w-0/max-w-full всегда на месте.
{
  const html = renderToStaticMarkup(
    <TableContainer>
      <table>
        <tbody>
          <tr>
            <td>short</td>
          </tr>
        </tbody>
      </table>
    </TableContainer>,
  );
  assert.ok(html.includes("max-w-full"), "container must cap width to its parent");
}

// 3. Семантика <table> сохраняется при использовании примитивов.
{
  const html = renderToStaticMarkup(
    <Table containerProps={{ scrollLabel: "Демо-таблица" }}>
      <TableHeader>
        <TableRow>
          <TableHead>Имя</TableHead>
          <TableHead className={stickyActionColumnHeadClass}>Действия</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow>
          <TableCell>Иван</TableCell>
          <TableCell className={stickyActionColumnCellClass}>Открыть</TableCell>
        </TableRow>
      </TableBody>
    </Table>,
  );

  assert.ok(html.includes("<table"), "must render a real <table> for accessibility/semantics");
  assert.ok(html.includes("<thead"), "must render <thead>");
  assert.ok(html.includes("<tbody"), "must render <tbody>");
  assert.ok(html.includes("<th"), "must render <th>");
  assert.ok(html.includes("sticky"), "sticky action column class must be applied when requested");
}

console.log("table.test.tsx OK");
