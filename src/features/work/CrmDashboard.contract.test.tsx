import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { CrmDashboard } from "./components/CrmDashboard";

const read = (file: string) => readFileSync(file, "utf8");

test("CRM dashboard follows selected simple layout without invented metrics", () => {
  const html = renderToStaticMarkup(createElement(CrmDashboard, {
    actorId: "clp0o00000000000000000001", openSupportCount: 2,
  }));
  for (const title of ["CRM", "Сегодня", "Лиды", "Сделки", "Сервис", "Ближайшие задачи", "Лиды в работе"]) {
    assert.ok(html.includes(title), `missing ${title}`);
  }
  assert.ok(html.includes("Новое дело"));
  assert.ok(html.includes("Загружаем дела"));
  assert.ok(!html.includes("Семейный клуб «Ромашка»"), "do not hardcode example business data");
});

test("CRM uses staff-only admin navigation and real canonical APIs", () => {
  const nav = read("src/lib/admin/adminSidebarConfig.ts");
  const sidebar = read("src/components/admin/AdminSidebar.tsx");
  const server = read("src/app/admin/work/page.tsx");
  const client = read("src/features/work/useCrmDashboardData.ts");
  assert.match(nav, /id: "crm"/);
  assert.match(nav, /href: adminPath\("\/work"\)/);
  assert.match(sidebar, /entry\.id === "crm" && userRole !== "ADMIN"/);
  assert.match(server, /user\.role !== "ADMIN"/);
  assert.match(server, /prisma\.supportThread\.count/);
  assert.match(client, /\/api\/admin\/work\/items/);
  assert.match(client, /\/api\/admin\/work\/leads/);
});

test("creation form fits short mobile viewports and remains scrollable", () => {
  const source = read("src/features/work/components/CrmCreateDialog.tsx");
  assert.match(source, /max-h-\[calc\(100dvh-2rem\)\]/);
  assert.match(source, /overflow-y-auto/);
  assert.match(source, /overscroll-contain/);
});
