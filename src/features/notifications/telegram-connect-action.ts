export type TelegramConnectResult =
  | { ok: true; alreadyConnected: true }
  | { ok: true; alreadyConnected: false; url: string }
  | { ok: false; message: string };

async function syncTelegramOnboardingCompletion(): Promise<void> {
  await fetch("/api/me/telegram/connected", {
    method: "POST",
    credentials: "include",
  }).catch(() => {
    // Не блокируем UX, если sync endpoint недоступен
  });
}

export async function requestTelegramConnectLink(): Promise<TelegramConnectResult> {
  const statusRes = await fetch("/api/settings/telegram/status", {
    credentials: "include",
    cache: "no-store",
  });

  if (statusRes.status === 401) {
    return { ok: false, message: "Требуется вход" };
  }

  if (statusRes.ok) {
    const status = (await statusRes.json()) as { linked?: boolean };
    if (status.linked) {
      await syncTelegramOnboardingCompletion();
      return { ok: true, alreadyConnected: true };
    }
  }

  const linkRes = await fetch("/api/settings/telegram/link", {
    method: "POST",
    credentials: "include",
  });
  const json = (await linkRes.json().catch(() => ({}))) as {
    url?: string;
    error?: string;
  };

  if (!linkRes.ok || !json.url) {
    return {
      ok: false,
      message: json.error ?? "Не удалось подготовить Telegram",
    };
  }

  return { ok: true, alreadyConnected: false, url: json.url };
}

export function openTelegramConnectUrl(url: string): void {
  window.open(url, "_blank", "noopener,noreferrer");
}
