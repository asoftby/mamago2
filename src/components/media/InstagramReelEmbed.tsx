"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import Script from "next/script";

const EMBED_SCRIPT_SRC = "https://www.instagram.com/embed.js";

declare global {
  interface Window {
    instgrm?: { Embeds?: { process?: () => void } };
  }
}

/**
 * Официальный встраиваемый плеер Instagram (blockquote + embed.js).
 * В отличие от голого `/embed/` iframe, тут Reels действительно
 * воспроизводится инлайн. Используется в модалке просмотра медиа.
 *
 * Пока embed.js не подменил blockquote на iframe, сырой blockquote
 * (белая полоса с текстом-ссылкой) скрыт — вместо него показываем лоадер.
 */
export function InstagramReelEmbed({ url, title }: { url: string; title?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(false);
    const container = containerRef.current;
    if (!container) return;

    const tryProcess = () => window.instgrm?.Embeds?.process?.();

    let revealTimer: ReturnType<typeof setTimeout> | undefined;
    const reveal = () => setReady(true);

    // Показываем плеер только когда iframe реально загрузился — иначе
    // сквозь него на миг видна сырая «белая полоса» blockquote.
    const onIframe = (iframe: HTMLIFrameElement) => {
      observer.disconnect();
      iframe.addEventListener("load", reveal, { once: true });
      // Подстраховка: если load уже был / не сработает — открываем по таймеру.
      revealTimer = setTimeout(reveal, 1200);
    };

    const findIframe = () => {
      const iframe = container.querySelector("iframe");
      if (iframe) {
        onIframe(iframe as HTMLIFrameElement);
        return true;
      }
      return false;
    };

    tryProcess();

    const observer = new MutationObserver(() => findIframe());
    if (!findIframe()) {
      observer.observe(container, { childList: true, subtree: true });
    }

    // embed.js мог ещё грузиться — повторяем process().
    const retry = setInterval(tryProcess, 500);
    const stopRetry = setTimeout(() => clearInterval(retry), 6000);

    return () => {
      observer.disconnect();
      clearInterval(retry);
      clearTimeout(stopRetry);
      if (revealTimer) clearTimeout(revealTimer);
    };
  }, [url]);

  return (
    <div
      className="relative mx-auto w-full"
      style={{ maxWidth: "min(92vw, 420px)" }}
      onClick={(e) => e.stopPropagation()}
    >
      <Script
        src={EMBED_SCRIPT_SRC}
        strategy="afterInteractive"
        onLoad={() => window.instgrm?.Embeds?.process?.()}
      />

      {/* Лоадер, пока IG не отрендерил плеер */}
      {!ready && (
        <div
          className="flex items-center justify-center rounded-2xl bg-white/[0.06]"
          style={{ height: "min(80svh, 640px)" }}
        >
          <Loader2 className="h-7 w-7 animate-spin text-white/60" aria-label="Загрузка Reels" />
        </div>
      )}

      <div
        ref={containerRef}
        style={{
          opacity: ready ? 1 : 0,
          height: ready ? "auto" : 0,
          overflow: "hidden",
          transition: "opacity 200ms ease",
        }}
      >
        <blockquote
          className="instagram-media"
          data-instgrm-permalink={url}
          data-instgrm-version="14"
          style={{
            background: "#fff",
            borderRadius: 16,
            margin: 0,
            maxWidth: "100%",
            width: "100%",
            minWidth: 0,
          }}
        >
          <a href={url} target="_blank" rel="noopener noreferrer">
            {title ?? "Открыть Reels в Instagram"}
          </a>
        </blockquote>
      </div>
    </div>
  );
}
