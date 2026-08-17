export type EmojiRatingType = "like" | "neutral" | "dislike";

export const EMOJI_RATING_OPTIONS: Array<{
  type: EmojiRatingType;
  emoji: string;
  labelRu: string;
}> = [
  { type: "like", emoji: "😍", labelRu: "Нравится" },
  { type: "neutral", emoji: "🙂", labelRu: "Нормально" },
  { type: "dislike", emoji: "😫", labelRu: "Не нравится" },
];

export function isEmojiRatingType(value: unknown): value is EmojiRatingType {
  return value === "like" || value === "neutral" || value === "dislike";
}

export type EmojiRatingCounts = Record<EmojiRatingType, number>;

export function emptyEmojiRatingCounts(): EmojiRatingCounts {
  return { like: 0, neutral: 0, dislike: 0 };
}

export function countsFromGroupBy(
  rows: Array<{ ratingType: string; _count: number }>,
): EmojiRatingCounts {
  const result = emptyEmojiRatingCounts();
  for (const row of rows) {
    if (isEmojiRatingType(row.ratingType)) {
      result[row.ratingType] = row._count;
    }
  }
  return result;
}

export function ratingVoterIdentifier(args: {
  userId: string | null | undefined;
  /** Resolve via getTrustedClientIp() at the call site — never read raw proxy headers here. */
  ip: string | null;
}): string {
  if (args.userId) return args.userId;
  return `ip:${args.ip ?? "anonymous"}`;
}
