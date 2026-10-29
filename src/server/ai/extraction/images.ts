import { createHash } from "node:crypto";
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
  origin: "telegram-file";
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
