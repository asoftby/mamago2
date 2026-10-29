import { z } from "zod";

/**
 * Ответ модели по одному посту публичного канала. Строгая схема, как у
 * Capture: лишние поля и неверные значения означают невалидный ответ
 * (повтор, затем сильная модель), а не данные.
 *
 * Каждое ключевое значение несёт состояние (`stated` / `inferred` / `missing`)
 * и происхождение `from`: `TEXT`, `IMAGE:<номер картинки>` или `BOTH`.
 */
export const FieldState = z.enum(["stated", "inferred", "missing"]);

/** `TEXT`, `BOTH` или `IMAGE:<индекс>`. */
const Origin = z.string().regex(/^(TEXT|BOTH|IMAGE:\d{1,2})$/);

const IsoDateTime = z.string().datetime({ offset: true });

const TextField = z.strictObject({
  value: z.string().nullable(),
  state: FieldState,
  from: Origin.nullable(),
});

const DateField = z.strictObject({
  value: IsoDateTime.nullable(),
  state: FieldState,
  from: Origin.nullable(),
});

const OccurrenceSchema = z.strictObject({
  startAt: DateField,
  /** Название подсобытия внутри фестиваля (день, показ, фильм), если есть. */
  title: z.string().nullable(),
});

const PriceField = z.strictObject({
  value: z.string().nullable(),
  isFree: z.boolean().nullable(),
  state: FieldState,
  from: Origin.nullable(),
});

const RegistrationField = z.strictObject({
  required: z.boolean().nullable(),
  url: z.string().nullable(),
  method: z.enum(["LINK", "PHONE", "INSTAGRAM_DM", "TELEGRAM", "EMAIL", "OTHER"]).nullable(),
  from: Origin.nullable(),
});

const ConflictSchema = z.strictObject({
  field: z.string(),
  /** Значение из текста поста. */
  text: z.string().nullable(),
  /** Значение с картинки с её номером. */
  image: z.strictObject({ index: z.number().int().min(0).max(20), value: z.string().nullable() }).nullable(),
});

const Score = z.number().min(0).max(1);

export const TelegramEventSchema = z.strictObject({
  title: TextField,
  /** 1–2 предложения своими словами, не копия текста поста. */
  summary: z.string().nullable(),
  venueName: TextField,
  addressText: TextField,
  cityName: TextField,
  addressNote: z.string().nullable(),
  occurrences: z.array(OccurrenceSchema),
  ageText: TextField,
  audienceHint: z.string().nullable(),
  price: PriceField,
  registration: RegistrationField,
  ticketsUrl: z.string().nullable(),
  socialUrls: z.array(z.string()),
  categoryCandidates: z.array(z.string()),
  conflicts: z.array(ConflictSchema),
  confidence: z.strictObject({ dates: Score, venue: Score, age: Score }),
});

export const POST_KINDS = ["EVENT", "FESTIVAL", "DIGEST", "NOT_EVENT"] as const;
export type PostKind = (typeof POST_KINDS)[number];

export const TelegramPostSchema = z
  .strictObject({
    postKind: z.enum(POST_KINDS),
    images: z.array(
      z.strictObject({
        index: z.number().int().min(0).max(20),
        role: z.enum(["POSTER", "PHOTO", "OTHER"]),
      }),
    ),
    events: z.array(TelegramEventSchema),
  })
  .superRefine((post, ctx) => {
    if (post.postKind === "NOT_EVENT" && post.events.length > 0) {
      ctx.addIssue({ code: "custom", path: ["events"], message: "NOT_EVENT requires empty events" });
    }
    if ((post.postKind === "EVENT" || post.postKind === "FESTIVAL") && post.events.length !== 1) {
      ctx.addIssue({ code: "custom", path: ["events"], message: `${post.postKind} requires exactly one event` });
    }
    if (post.postKind === "DIGEST" && post.events.length < 1) {
      ctx.addIssue({ code: "custom", path: ["events"], message: "DIGEST requires at least one event" });
    }
  });

export type TelegramPostExtraction = z.infer<typeof TelegramPostSchema>;
export type TelegramEventExtraction = z.infer<typeof TelegramEventSchema>;

export type ParsePostResult =
  | { ok: true; value: TelegramPostExtraction }
  | { ok: false; code: "INVALID_JSON" | "INVALID_SCHEMA" };

/** Принимает чистый JSON или JSON в markdown-ограде. */
export function parseTelegramPostExtraction(raw: string): ParsePostResult {
  const trimmed = raw.trim();
  const unfenced = trimmed.startsWith("```")
    ? trimmed.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "")
    : trimmed;
  let json: unknown;
  try {
    json = JSON.parse(unfenced);
  } catch {
    return { ok: false, code: "INVALID_JSON" };
  }
  const parsed = TelegramPostSchema.safeParse(json);
  return parsed.success ? { ok: true, value: parsed.data } : { ok: false, code: "INVALID_SCHEMA" };
}

export function telegramPostJsonSchema(): Record<string, unknown> {
  return z.toJSONSchema(TelegramPostSchema, { target: "draft-7" }) as Record<string, unknown>;
}
