"use client";

import Script from "next/script";
import { useCallback, useRef, useState } from "react";
import { expandMiniApp } from "@/lib/telegram/expandMiniApp";

type TelegramWebApp = {
  initData: string;
  ready: () => void;
  expand?: () => void;
};
export function BusinessTelegramOpenClient({ destination }: { destination: string }) {
  const started = useRef(false);
  const [error, setError] = useState<string | null>(null);

  const authenticate = useCallback(async () => {
    if (started.current) return;
    const webApp = (window as Window & { Telegram?: { WebApp?: TelegramWebApp } }).Telegram?.WebApp;
    if (!webApp?.initData) {
      setError("Не удалось подтвердить Telegram. Откройте кнопку из личного чата с бизнес-ботом.");
      return;
    }
    started.current = true;
    try {
      expandMiniApp(webApp);
      webApp.ready();
      const response = await fetch("/api/auth/business-telegram-webapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        cache: "no-store",
        body: JSON.stringify({ initData: webApp.initData }),
      });
      if (!response.ok) {
        const payload: unknown = await response.json().catch(() => null);
        const code = payload && typeof payload === "object" && "error" in payload
          ? (payload as { error?: unknown }).error : null;
        const messages: Record<string, string> = {
          INVALID_ORIGIN: "Не удалось проверить адрес mamaGo. Откройте кнопку в бизнес-боте повторно.",
          TELEGRAM_NOT_LINKED: "Этот Telegram не подключён к действующему бизнес-аккаунту. Подключите бизнес-бота в настройках кабинета.",
          ACCOUNT_UNAVAILABLE: "Бизнес-аккаунт недоступен для входа. Обратитесь в поддержку.",
          INVALID_INIT_DATA: "Не удалось подтвердить Telegram. Откройте кнопку из бизнес-бота ещё раз.",
          AUTH_UNAVAILABLE: "Вход через бизнес-бота временно недоступен.",
        };
        setError(typeof code === "string" && Object.hasOwn(messages, code)
          ? messages[code] : "Не удалось войти через бизнес-бота.");
        started.current = false;
        return;
      }
      // The server has checked the current Business Bot, environment and live
      // OWNER/MANAGER membership. Navigating reloads the protected inbox.
      window.location.replace(destination);
    } catch {
      setError("Ошибка соединения. Проверьте подключение и повторите попытку.");
      started.current = false;
    }
  }, [destination]);

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-5">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 text-center shadow-sm">
        <h1 className="font-heading text-xl font-semibold">Открываем записи и заказы</h1>
        {error ? (
          <>
            <p role="alert" className="mt-3 text-sm leading-6 text-muted-foreground">{error}</p>
            <button
              className="mt-5 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground"
              onClick={() => { setError(null); void authenticate(); }}
            >Повторить попытку</button>
          </>
        ) : (
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Проверяем подключение бизнес-бота и права доступа к заявкам…
          </p>
        )}
      </div>
      <Script
        src="https://telegram.org/js/telegram-web-app.js"
        strategy="afterInteractive"
        onReady={() => { void authenticate(); }}
        onError={() => setError("Не удалось загрузить Telegram Mini App. Откройте кнопку повторно.")}
      />
    </main>
  );
}
