/**
 * Standalone, local-only React Email preview.
 *
 * React Email's official 5.x CLI may crash while bootstrapping its separate
 * Next.js preview server in this repository. This preview uses the same
 * @react-email/render library as production without starting another Next app.
 *
 * No database connection or email delivery is performed.
 */
import { createServer } from "node:http";
import * as React from "react";
import { render } from "@react-email/render";

import MamagoWelcome from "../emails/mamago-welcome";
import VerifyEmailTemplate from "../src/features/email/templates/verify-email";
import PasswordResetTemplate from "../src/features/email/templates/password-reset";
import BusinessInviteTemplate from "../src/features/email/templates/business-invite";
import FamilyInviteTemplate from "../src/features/email/templates/family-invite";

type TemplateKey = "welcome" | "verify" | "reset" | "business" | "family";
type PreviewEntry = {
  label: string;
  description: string;
  element: React.ReactElement;
};

const sampleTemplates: Record<TemplateKey, PreviewEntry> = {
  welcome: {
    label: "Приветственное письмо",
    description: "Первое знакомство с mamaGo",
    element: <MamagoWelcome userName="Катя" ctaUrl="https://mamago.by/me/plan" />,
  },
  verify: {
    label: "Подтверждение email",
    description: "Подтверждение адреса после регистрации",
    element: (
      <VerifyEmailTemplate verifyUrl="https://mamago.by/api/auth/verify-email/preview-only" />
    ),
  },
  reset: {
    label: "Сброс пароля",
    description: "Безопасное восстановление доступа",
    element: <PasswordResetTemplate resetUrl="https://mamago.by/reset-password/preview-only" />,
  },
  business: {
    label: "Приглашение бизнеса",
    description: "Приглашение в команду организации",
    element: (
      <BusinessInviteTemplate
        businessName="Семейный клуб"
        inviterName="Анна"
        acceptUrl="https://mamago.by/business/invites/preview-only"
        expiresInDays={7}
      />
    ),
  },
  family: {
    label: "Приглашение в семью",
    description: "Совместное планирование семейного отдыха",
    element: (
      <FamilyInviteTemplate
        inviterName="Анна"
        acceptUrl="https://mamago.by/me/family/invites/preview-only"
      />
    ),
  },
};

const DEFAULT_PORT = 3011;
const port = Number(process.env.EMAIL_PREVIEW_PORT ?? DEFAULT_PORT);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("EMAIL_PREVIEW_PORT must be a number between 1 and 65535.");
}

function isTemplateKey(value: string): value is TemplateKey {
  return Object.prototype.hasOwnProperty.call(sampleTemplates, value);
}

function htmlPage(key: TemplateKey, viewport: "desktop" | "mobile"): string {
  const entry = sampleTemplates[key];
  const navigation = Object.entries(sampleTemplates)
    .map(([value, item]) => {
      const active = value === key ? "active" : "";
      return `<a class="template-option ${active}" href="/?template=${value}&view=${viewport}">${item.label}</a>`;
    })
    .join("");

  return `<!doctype html>
<html lang="ru">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>mamaGo — предпросмотр писем</title>
<style>
  * { box-sizing: border-box; }
  body { margin: 0; background: #f8f7f5; color: #211f1d; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif; }
  header { background: white; border-bottom: 1px solid #eae5df; padding: 22px 28px; }
  .brand { font-size: 24px; letter-spacing: -.04em; font-weight: 800; }
  .brand span { color: #ef8759; }
  .subtitle { color: #68635e; font-size: 13px; margin: 4px 0 0; }
  main { padding: 25px 22px 40px; max-width: 1160px; margin: auto; }
  h1 { font-size: 23px; margin: 0 0 6px; }
  .description { margin: 0 0 22px; color: #68635e; font-size: 14px; }
  .layout { display: grid; grid-template-columns: 240px minmax(0, 1fr); gap: 24px; align-items: start; }
  nav { background: white; border: 1px solid #eae5df; border-radius: 16px; padding: 10px; }
  .template-option { display: block; padding: 13px 12px; border-radius: 10px; font-size: 14px; text-decoration: none; color: #383431; }
  .template-option:hover { background: #fff2eb; }
  .template-option.active { background: #fff2eb; color: #9d4e28; font-weight: 700; }
  .panel { min-width: 0; }
  .toolbar { display: flex; align-items: center; gap: 10px; margin-bottom: 15px; flex-wrap: wrap; }
  .toolbar a { text-decoration: none; border: 1px solid #dfd8d0; border-radius: 9px; padding: 9px 13px; font-size: 13px; color: #383431; background: white; }
  .toolbar a.active { background: #211f1d; border-color: #211f1d; color: white; }
  .toolbar .external { margin-left: auto; }
  .preview-frame { display: block; width: 100%; max-width: 690px; height: 900px; border: 1px solid #eae5df; border-radius: 16px; background: white; margin: 0 auto; }
  .preview-frame.mobile { width: 390px; max-width: 100%; height: 850px; }
  .hint { color: #847c74; font-size: 12px; margin-top: 14px; text-align: center; }
  @media(max-width: 730px) { main { padding: 18px 12px 32px; } .layout { display: block; } nav { display: flex; flex-wrap: wrap; gap: 3px; margin-bottom: 17px; } .template-option { padding: 9px; } header { padding: 18px; } }
</style>
</head>
<body>
<header><div class="brand">mama<span>Go</span> · Email Preview</div><p class="subtitle">Локальный предпросмотр React Email — без отправки писем</p></header>
<main>
<h1>${entry.label}</h1>
<p class="description">${entry.description}</p>
<div class="layout">
  <nav aria-label="Шаблоны писем">${navigation}</nav>
  <section class="panel">
    <div class="toolbar">
      <a class="${viewport === "desktop" ? "active" : ""}" href="/?template=${key}&view=desktop">Компьютер</a>
      <a class="${viewport === "mobile" ? "active" : ""}" href="/?template=${key}&view=mobile">Телефон · 390 px</a>
      <a class="external" target="_blank" rel="noopener noreferrer" href="/preview/${key}">Открыть HTML ↗</a>
    </div>
    <iframe title="Предпросмотр письма: ${entry.label}" class="preview-frame ${viewport}" src="/preview/${key}"></iframe>
    <p class="hint">Примерные данные. Реальная отправка, база данных и настройки пользователей не используются.</p>
  </section>
</div>
</main>
</body>
</html>`;
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", `http://127.0.0.1:${port}`);
  const keyParam = url.searchParams.get("template") ?? "welcome";
  const key: TemplateKey = isTemplateKey(keyParam) ? keyParam : "welcome";
  const view = url.searchParams.get("view") === "mobile" ? "mobile" : "desktop";

  response.setHeader("Cache-Control", "no-store");
  response.setHeader("X-Content-Type-Options", "nosniff");

  try {
    if (url.pathname === "/health") {
      response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
      response.end(JSON.stringify({ status: "ok", templates: Object.keys(sampleTemplates) }));
      return;
    }

    if (url.pathname.startsWith("/preview/")) {
      const template = url.pathname.slice("/preview/".length);
      if (!isTemplateKey(template)) {
        response.writeHead(404);
        response.end("Шаблон не найден");
        return;
      }

      const emailHtml = await render(sampleTemplates[template].element);
      response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      response.end(emailHtml);
      return;
    }

    if (url.pathname !== "/") {
      response.writeHead(404);
      response.end("Страница не найдена");
      return;
    }

    response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    response.end(htmlPage(key, view));
  } catch (error) {
    console.error("[email:preview] Failed to render template:", error);
    response.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Ошибка построения предпросмотра. Смотрите вывод терминала.");
  }
});

server.on("error", (error) => {
  console.error("[email:preview] Unable to start local preview:", error);
  process.exitCode = 1;
});

server.listen(port, "127.0.0.1", () => {
  console.info(`mamaGo Email Preview ready: http://127.0.0.1:${port}`);
});
