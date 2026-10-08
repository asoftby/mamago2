/**
 * Non-throwing Telegram Bot API client used by the forward-to-plan intake.
 *
 * Kept free of `server-only` / config imports so it can be unit-tested with a
 * mocked `fetch`; `telegramCaptureClient.ts` wires the real token. Never
 * logs URLs, bodies or file paths: the bot token is part of every API URL and
 * of the file download URL.
 */

export type TelegramApiResult<T> = { ok: true; value: T } | { ok: false; code: string };

export type TelegramCaptureClientDeps = {
  getBotToken: () => string;
  fetchImpl?: typeof fetch;
  apiTimeoutMs?: number;
  downloadTimeoutMs?: number;
};

export type TelegramFileInfo = { filePath: string; fileSize: number | null };

type ReplyMarkupOptions = {
  replyMarkup?: { inline_keyboard: Array<Array<{ text: string; callback_data?: string; url?: string }>> };
  parseMode?: "HTML";
};

const DEFAULT_API_TIMEOUT_MS = 10_000;
const DEFAULT_DOWNLOAD_TIMEOUT_MS = 15_000;

function logFailure(method: string, code: string): void {
  console.error(`[telegram:capture-client] method=${method} code=${code}`);
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

export function createTelegramCaptureClient(deps: TelegramCaptureClientDeps) {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const apiTimeoutMs = deps.apiTimeoutMs ?? DEFAULT_API_TIMEOUT_MS;
  const downloadTimeoutMs = deps.downloadTimeoutMs ?? DEFAULT_DOWNLOAD_TIMEOUT_MS;

  function readToken(method: string): string | null {
    try {
      const token = deps.getBotToken();
      if (token) return token;
    } catch {
      /* fall through: never surface config errors, they may name env vars */
    }
    logFailure(method, "NO_TOKEN");
    return null;
  }

  async function call<T>(method: string, payload: Record<string, unknown>): Promise<TelegramApiResult<T>> {
    const token = readToken(method);
    if (!token) return { ok: false, code: "NO_TOKEN" };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), apiTimeoutMs);
    try {
      const response = await fetchImpl(`https://api.telegram.org/bot${token}/${method}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        cache: "no-store",
        signal: controller.signal,
      });

      const json = (await response.json().catch(() => null)) as {
        ok?: boolean;
        result?: T;
        error_code?: number;
      } | null;

      if (json?.ok === true && json.result !== undefined) {
        return { ok: true, value: json.result };
      }
      const code =
        typeof json?.error_code === "number"
          ? `TG_${json.error_code}`
          : response.ok
            ? "BAD_RESPONSE"
            : `HTTP_${response.status}`;
      logFailure(method, code);
      return { ok: false, code };
    } catch (error) {
      const code = isAbortError(error) ? "TIMEOUT" : "NETWORK";
      logFailure(method, code);
      return { ok: false, code };
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    sendChatAction(chatId: string | number, action: "typing"): Promise<TelegramApiResult<true>> {
      return call<true>("sendChatAction", { chat_id: chatId, action });
    },

    editMessageText(
      chatId: string | number,
      messageId: number,
      text: string,
      options: ReplyMarkupOptions = {},
    ): Promise<TelegramApiResult<unknown>> {
      return call("editMessageText", {
        chat_id: chatId,
        message_id: messageId,
        text,
        ...(options.replyMarkup ? { reply_markup: options.replyMarkup } : {}),
        ...(options.parseMode ? { parse_mode: options.parseMode } : {}),
      });
    },

    answerCallbackQuery(
      callbackQueryId: string,
      options: { text?: string; showAlert?: boolean } = {},
    ): Promise<TelegramApiResult<true>> {
      return call<true>("answerCallbackQuery", {
        callback_query_id: callbackQueryId,
        ...(options.text ? { text: options.text } : {}),
        show_alert: options.showAlert ?? false,
      });
    },

    async getFile(fileId: string): Promise<TelegramApiResult<TelegramFileInfo>> {
      const result = await call<{ file_path?: string; file_size?: number }>("getFile", { file_id: fileId });
      if (!result.ok) return result;
      if (!result.value.file_path) {
        logFailure("getFile", "NO_FILE_PATH");
        return { ok: false, code: "NO_FILE_PATH" };
      }
      return {
        ok: true,
        value: { filePath: result.value.file_path, fileSize: result.value.file_size ?? null },
      };
    },

    /** Downloads into memory only; never touches the disk. */
    async downloadFile(
      filePath: string,
      options: { maxBytes: number },
    ): Promise<TelegramApiResult<Uint8Array>> {
      const token = readToken("downloadFile");
      if (!token) return { ok: false, code: "NO_TOKEN" };

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), downloadTimeoutMs);
      try {
        const response = await fetchImpl(`https://api.telegram.org/file/bot${token}/${filePath}`, {
          method: "GET",
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) {
          const code = `HTTP_${response.status}`;
          logFailure("downloadFile", code);
          return { ok: false, code };
        }

        const declared = Number(response.headers.get("content-length"));
        if (Number.isFinite(declared) && declared > options.maxBytes) {
          await response.body?.cancel().catch(() => undefined);
          logFailure("downloadFile", "TOO_LARGE");
          return { ok: false, code: "TOO_LARGE" };
        }

        if (!response.body) {
          const buffer = new Uint8Array(await response.arrayBuffer());
          if (buffer.byteLength > options.maxBytes) {
            logFailure("downloadFile", "TOO_LARGE");
            return { ok: false, code: "TOO_LARGE" };
          }
          return { ok: true, value: buffer };
        }

        const reader = response.body.getReader();
        const chunks: Uint8Array[] = [];
        let total = 0;
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          total += value.byteLength;
          if (total > options.maxBytes) {
            await reader.cancel().catch(() => undefined);
            logFailure("downloadFile", "TOO_LARGE");
            return { ok: false, code: "TOO_LARGE" };
          }
          chunks.push(value);
        }
        const out = new Uint8Array(total);
        let offset = 0;
        for (const chunk of chunks) {
          out.set(chunk, offset);
          offset += chunk.byteLength;
        }
        return { ok: true, value: out };
      } catch (error) {
        const code = isAbortError(error) ? "TIMEOUT" : "NETWORK";
        logFailure("downloadFile", code);
        return { ok: false, code };
      } finally {
        clearTimeout(timer);
      }
    },
  };
}

export type TelegramCaptureClient = ReturnType<typeof createTelegramCaptureClient>;
