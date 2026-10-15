"use client";

import Script from "next/script";
import { useCallback, useRef, useState } from "react";

type WebApp = {
  initData: string;
  ready: () => void;
};
declare global {
  interface Window {
    Telegram?: { WebApp?: WebApp };
  }
}

export function TelegramOpenClient({ destination }: { destination: string }) {
  const started = useRef(false);
  const [error, setError] = useState<string | null>(null);

  const authenticate = useCallback(async () => {
    if (started.current) return;
    const webApp = window.Telegram?.WebApp;
    if (!webApp?.initData) {
      setError("Не удалось подтвердить аккаунт Telegram. Откройте эту страницу кнопкой из личного чата с ботом.");
      return;
    }

    started.current = true;
    try {
      webApp.ready();
      const response = await fetch("/api/auth/telegram-webapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        cache: "no-store",
        body: JSON.stringify({ initData: webApp.initData }),
      });
      if (!response.ok) {
        setError(response.status === 403
          ? "Этот Telegram не подключён к активному аккаунту mamaGo. Подключите бота через настройки своего профиля."
          : "Не удалось подтвердить вход. Закройте окно и откройте ссылку из бота ещё раз.");
        started.current = false;
        return;
      }
      // Full navigation refreshes server and client auth state. The previous
      // browser account is never rendered as if it were the Telegram owner.
      window.location.replace(destination);
    } catch {
      setError("Не удалось соединиться с mamaGo. Проверьте подключение и попробуйте ещё раз.");
      started.current = false;
    }
  }, [destination]);

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-5">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 text-center shadow-sm">
        <h1 className="font-heading text-xl font-semibold">Открываем ваш план</h1>
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
            Проверяем подключение Telegram к вашему аккаунту mamaGo…
          </p>
        )}
      </div>
      <Script
        src="https://telegram.org/js/telegram-web-app.js"
        strategy="afterInteractive"
        onReady={() => { void authenticate(); }}
        onError={() => setError("Не удалось загрузить проверку Telegram. Откройте ссылку из бота повторно.")}
      />
    </main>
  );
}
