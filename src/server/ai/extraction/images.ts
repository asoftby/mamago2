import { createHash } from "node:crypto";
import { BROWSER_LIKE_HEADERS, fetchBinary } from "@/server/modules/import/parsers/fetchHtml";
import type { TelegramCaptureClient } from "@/server/services/telegram/capture/telegramCaptureClient.core";

/**
 * Image loading for multimodal extraction. Every adapter yields the same
 * `LoadedImage`, so the model call does not care where the bytes came from.
 * Images are identified by the `sha256` of their bytes, never by URL.
 */
export type LoadedImage = {
  bytes: Uint8Array;
  mime: string;
  sha256: string;
  origin: "telegram-file" | "web";
};

export type ImageLoadResult = { ok: true; value: LoadedImage } | { ok: false; code: string };

export type ImageSource<Ref> = { load(ref: Ref): Promise<ImageLoadResult> };

export function imageMimeFromPath(filePath: string): string {
  const lower = filePath.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  return "image/jpeg";
}

export function imageToDataUrl(image: LoadedImage): string {
  return `data:${image.mime};base64,${Buffer.from(image.bytes).toString("base64")}`;
}

export type TelegramFileImageSourceOptions = { maxBytes: number };

/** `file_id` -> `getFile` + `downloadFile`, as Capture has always done it. */
export function createTelegramFileImageSource(
  telegram: Pick<TelegramCaptureClient, "getFile" | "downloadFile">,
  options: TelegramFileImageSourceOptions,
): ImageSource<string> {
  return {
    async load(fileId) {
      const file = await telegram.getFile(fileId);
      if (!file.ok) return { ok: false, code: file.code };
      const bytes = await telegram.downloadFile(file.value.filePath, { maxBytes: options.maxBytes });
      if (!bytes.ok) return { ok: false, code: bytes.code };
      return {
        ok: true,
        value: {
          bytes: bytes.value,
          mime: imageMimeFromPath(file.value.filePath),
          sha256: createHash("sha256").update(bytes.value).digest("hex"),
          origin: "telegram-file",
        },
      };
    },
  };
}

/** Заголовки запроса картинки: как у браузера, без признаков сборщика и проекта. */
export function webImageRequestHeaders(): Record<string, string> {
  return {
    "User-Agent": BROWSER_LIKE_HEADERS["User-Agent"],
    "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
    "Accept-Language": BROWSER_LIKE_HEADERS["Accept-Language"],
  };
}

export type WebImageSourceOptions = {
  maxBytes: number;
  /** Разрешённые хосты картинок; всё остальное отклоняется до запроса и на каждом редиректе. */
  isAllowedHost: (hostname: string) => boolean;
  timeoutMs?: number;
};

const WEB_IMAGE_FETCH_FAILED = "IMAGE_FETCH_FAILED";
const WEB_IMAGE_NOT_AN_IMAGE = "IMAGE_NOT_AN_IMAGE";

function mimeFromContentType(contentType: string | undefined): string | null {
  const type = contentType?.split(";")[0]?.trim().toLowerCase();
  return type && /^image\/(png|jpeg|jpg|webp|gif)$/.test(type) ? type.replace("image/jpg", "image/jpeg") : null;
}

/**
 * URL картинки -> `fetchBinary` (SSRF-защита, лимит размера, проверка хоста на
 * каждом редиректе). Ошибки приводятся к безопасным кодам: адрес с токенами и
 * тексты сетевых ошибок наружу не попадают.
 */
export function createWebImageSource(options: WebImageSourceOptions): ImageSource<string> {
  return {
    async load(url) {
      try {
        const response = await fetchBinary(url, {
          maxBytes: options.maxBytes,
          timeoutMs: options.timeoutMs,
          headers: webImageRequestHeaders(),
          validateUrl: (candidate) => {
            if (candidate.protocol !== "https:" || !options.isAllowedHost(candidate.hostname.toLowerCase())) {
              throw new Error("Image host is not allowed");
            }
          },
        });
        const mime = mimeFromContentType(response.headers["content-type"]) ?? null;
        if (!mime) return { ok: false, code: WEB_IMAGE_NOT_AN_IMAGE };
        const bytes = new Uint8Array(response.buffer);
        return {
          ok: true,
          value: {
            bytes,
            mime,
            sha256: createHash("sha256").update(bytes).digest("hex"),
            origin: "web",
          },
        };
      } catch {
        return { ok: false, code: WEB_IMAGE_FETCH_FAILED };
      }
    },
  };
}
