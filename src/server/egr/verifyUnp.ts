import { isValidUnpChecksum } from "@/lib/verification/unpChecksum";

export type EgrPayerStatus = "ACTIVE" | "LIQUIDATING" | "EXCLUDED" | "UNKNOWN";

export interface EgrLookupResult {
  found: boolean;
  unp: string;
  officialNameFull?: string; // vnaimp
  officialNameShort?: string; // vnaimk
  address?: string | null; // vpadres
  registeredAt?: string; // dreg
  status: EgrPayerStatus; // из ckodsost/vkods
  statusRaw?: string; // vkods как есть, для логов/UI
  liquidatedAt?: string | null;
  /**
   * true, если found: false вызван недоступностью реестра (таймаут/5xx после
   * ретраев), а не тем, что ГРП вернул пустой ответ. Нужно Фазе 2, чтобы
   * различить unpVerificationStatus NOT_FOUND vs LOOKUP_FAILED — спецификация
   * типа в задаче этого поля не содержала, добавлено как минимальное
   * расширение (см. STOP-отчёт Фазы 1).
   */
  networkFailed?: boolean;
}

interface LookupUnpOptions {
  /** Для тестов: подмена fetch, чтобы не дёргать реальный API. */
  fetchImpl?: typeof fetch;
  /** Для тестов: убрать реальную задержку между ретраями. */
  retryBaseDelayMs?: number;
}

interface GrpRow {
  vunp?: string;
  vnaimp?: string;
  vnaimk?: string;
  vpadres?: string | null;
  dreg?: string;
  nmns?: string;
  vmns?: string;
  ckodsost?: string;
  vkods?: string;
  dlikv?: string | null;
  vlikv?: string | null;
}

const GRP_ENDPOINT = "https://grp.nalog.gov.by/api/grp-public/data";
// Значения переняты у существующего inline HTTP-паттерна в
// src/server/company/resolveByUnp.ts — единый стандарт таймаутов/ретраев
// для gov.by-интеграций в проекте, а не второй параллельный набор чисел.
const REQUEST_TIMEOUT_MS = 15000;
const MAX_RETRIES = 1;
const DEFAULT_RETRY_BASE_DELAY_MS = 300;

function sleep(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableStatus(status: number): boolean {
  return status === 502 || status === 503;
}

// Один HTTP-запрос к ГРП с таймаутом; возвращает { ok, row, retryable }.
async function fetchGrpOnce(
  unp: string,
  fetchImpl: typeof fetch,
): Promise<{ row: GrpRow | null; retryable: boolean }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort("Request timeout"), REQUEST_TIMEOUT_MS);

  try {
    const url = `${GRP_ENDPOINT}?unp=${unp}&charset=UTF-8&type=json`;
    const res = await fetchImpl(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: controller.signal,
      cache: "no-store",
    });

    if (!res.ok) {
      if (isRetryableStatus(res.status)) {
        return { row: null, retryable: true };
      }
      console.error(`[EGR] GRP lookup for ${unp} failed: HTTP ${res.status}`);
      return { row: null, retryable: false };
    }

    const json = await res.json();
    const row = json?.row;

    // `row` отсутствует/null — УНП не найден в реестре (эмпирически подтверждено
    // форматом ответа ГРП: успешный ответ без записи просто не содержит `row`).
    if (!row || typeof row !== "object" || Array.isArray(row)) {
      return { row: null, retryable: false };
    }

    return { row: row as GrpRow, retryable: false };
  } catch (error) {
    const isAbort = error instanceof Error && error.name === "AbortError";
    console.error(`[EGR] GRP lookup for ${unp} ${isAbort ? "timed out" : "errored"}:`, error);
    return { row: null, retryable: true };
  } finally {
    clearTimeout(timeoutId);
  }
}

async function fetchGrpRowWithRetry(
  unp: string,
  fetchImpl: typeof fetch,
  retryBaseDelayMs: number,
): Promise<{ row: GrpRow | null; networkFailed: boolean }> {
  let sawRetryableFailure = false;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const { row, retryable } = await fetchGrpOnce(unp, fetchImpl);

    if (row !== null) {
      return { row, networkFailed: false };
    }

    if (!retryable) {
      // Успешный ответ, но записи нет — это НЕ сетевая ошибка, а "не найден".
      return { row: null, networkFailed: false };
    }

    sawRetryableFailure = true;
    if (attempt < MAX_RETRIES) {
      await sleep(retryBaseDelayMs * 2 ** attempt);
    }
  }

  return { row: null, networkFailed: sawRetryableFailure };
}

// Маппинг ckodsost проверен эмпирически на живых запросах к grp.nalog.gov.by
// (2026-07-01, ~8 случайных валидных-по-checksum УНП):
//   "1" + vkods "Действующий"          -> ACTIVE       (dlikv: null)
//   "M" + vkods "В процессе ликвидации" -> LIQUIDATING  (dlikv: заполнена)
//   "L" + vkods "Ликвидирован"          -> EXCLUDED     (dlikv: заполнена)
// dlikv заполнена в ОБОИХ случаях M и L — по нему нельзя отличить
// LIQUIDATING от EXCLUDED, различает только сам код ckodsost.
// TODO(product): встречены только 3 кода на маленькой выборке; другие
// возможные статусы (реорганизация, приостановлен и т.п.) не проверены —
// уточнить полный список кодов, если/когда столкнёмся с неизвестным.
function mapPayerStatus(row: GrpRow): { status: EgrPayerStatus; statusRaw?: string } {
  const statusRaw = typeof row.vkods === "string" && row.vkods.trim() ? row.vkods : undefined;

  switch (row.ckodsost) {
    case "1":
      return { status: "ACTIVE", statusRaw };
    case "M":
      return { status: "LIQUIDATING", statusRaw };
    case "L":
      return { status: "EXCLUDED", statusRaw };
    default:
      return { status: "UNKNOWN", statusRaw };
  }
}

/**
 * Проверяет УНП через публичный API ГРП РБ.
 * Fail-open: при недоступности реестра после ретраев не бросает исключение —
 * возвращает found: false, status: "UNKNOWN" (согласовано с продуктом:
 * внешний реестр — доп. сигнал, не gate для регистрации).
 *
 * @throws {Error} если формат/контрольная сумма УНП некорректны — сетевой
 * вызов в этом случае не выполняется вовсе.
 */
export async function lookupUnpInEgr(
  unp: string,
  options: LookupUnpOptions = {},
): Promise<EgrLookupResult> {
  const cleaned = unp.replace(/\D/g, "").trim();

  if (!isValidUnpChecksum(cleaned)) {
    throw new Error("Некорректный УНП: неверный формат или контрольная сумма");
  }

  const fetchImpl = options.fetchImpl ?? fetch;
  const retryBaseDelayMs = options.retryBaseDelayMs ?? DEFAULT_RETRY_BASE_DELAY_MS;

  const { row, networkFailed } = await fetchGrpRowWithRetry(cleaned, fetchImpl, retryBaseDelayMs);

  if (!row) {
    return { found: false, unp: cleaned, status: "UNKNOWN", networkFailed };
  }

  const { status, statusRaw } = mapPayerStatus(row);

  return {
    found: true,
    unp: cleaned,
    officialNameFull: row.vnaimp || undefined,
    officialNameShort: row.vnaimk || undefined,
    address: row.vpadres ?? null,
    registeredAt: row.dreg || undefined,
    status,
    statusRaw,
    liquidatedAt: row.dlikv ?? null,
  };
}
