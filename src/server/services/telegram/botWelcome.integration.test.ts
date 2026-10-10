/**
 * Bot welcome (first link, /start, /help) against a scratch Postgres
 * (DATABASE_URL, all migrations applied). Needs the react-server condition:
 *   NODE_OPTIONS=--conditions=react-server tsx <this file>
 * Telegram credentials are fake; the channel is a recording stub.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test, { after } from "node:test";
import { PrismaClient } from "@prisma/client";

process.env.TELEGRAM_BOT_TOKEN_DEV = "test-token-not-real";
process.env.TELEGRAM_BOT_USERNAME_DEV = "@welcome_test_bot";
process.env.APP_PUBLIC_URL = "https://example.test";
delete process.env.APP_ENV;

const db = new PrismaClient();
const runId = randomUUID().slice(0, 8);
const userIds: string[] = [];

type Sent = { chatId: string; text: string; parseMode?: string; replyMarkup?: unknown };

function makeChannel(opts: { failFirst?: boolean } = {}) {
  const sent: Sent[] = [];
  let failures = opts.failFirst ? 1 : 0;
  return {
    sent,
    channel: {
      async sendMessage(input: Sent) {
        if (failures > 0) {
          failures -= 1;
          throw new Error("telegram down");
        }
        sent.push(input);
        return { message_id: 1 };
      },
      async editMessageText() {},
      async answerCallbackQuery() {},
    },
  };
}

function deps(allowlist: string[]) {
  return {
    getAllowlist: () => new Set(allowlist),
    findActiveConnection: async () => null,
    touchConnection: async () => undefined,
    getEnvironment: () => "DEV" as const,
    tryEdit: async () => null,
    receive: async () => {
      throw new Error("capture must not run for commands");
    },
    handleCallback: async () => undefined,
    acknowledgeCallback: async () => undefined,
  };
}

async function service(allowlist: string[], channel: unknown) {
  const { TelegramWebhookService } = await import("./TelegramWebhookService");
  return new TelegramWebhookService(channel as never, deps(allowlist) as never);
}

let chatSeq = 870_000_000 + Math.floor(Math.random() * 1_000_000);

async function makeUser(label: string) {
  const userId = `welcome-${runId}-${label}`;
  await db.user.create({ data: { id: userId, email: `${userId}@example.test` } });
  userIds.push(userId);
  return userId;
}

async function makeLinkedUser(label: string, welcomeSentAt: Date | null = null) {
  const userId = await makeUser(label);
  const chatId = String(chatSeq++);
  const connection = await db.telegramConnection.create({
    data: {
      userId,
      environment: "DEV",
      botUsername: "welcome_test_bot",
      telegramUserId: chatId,
      telegramChatId: chatId,
      welcomeSentAt,
    },
  });
  return { userId, chatId, connection };
}

async function linkToken(userId: string) {
  const token = `tok-${randomUUID()}`;
  await db.telegramLinkToken.create({
    data: { token, userId, environment: "DEV", expiresAt: new Date(Date.now() + 600_000) },
  });
  return token;
}

function command(chatId: string, text: string, updateId = 1) {
  return {
    update_id: updateId,
    message: {
      message_id: updateId,
      date: 1_790_000_000,
      chat: { id: Number(chatId), type: "private" },
      from: { id: Number(chatId), is_bot: false, first_name: "Anna" },
      text,
      entities: [{ type: "bot_command", offset: 0 }],
    },
  } as never;
}

async function welcomeSentAt(connectionId: string) {
  return (await db.telegramConnection.findUniqueOrThrow({ where: { id: connectionId } })).welcomeSentAt;
}

after(async () => {
  await db.telegramConnection.deleteMany({ where: { userId: { in: userIds } } });
  await db.telegramLinkToken.deleteMany({ where: { userId: { in: userIds } } });
  await db.user.deleteMany({ where: { id: { in: userIds } } });
  await db.$disconnect();
});

test("first link: allowlisted user gets the full welcome once, with the plan button", async () => {
  const userId = await makeUser("full");
  const chatId = String(chatSeq++);
  const token = await linkToken(userId);
  const { sent, channel } = makeChannel();
  await (await service([userId], channel)).handleUpdate(command(chatId, `/start link_${token}`));

  assert.equal(sent.length, 1);
  assert.equal(sent[0]!.parseMode, "HTML");
  assert.match(sent[0]!.text, /Помогаю семье ничего не забывать/);
  assert.match(sent[0]!.text, /Попробуйте прямо сейчас/);
  assert.deepEqual(sent[0]!.replyMarkup, {
    inline_keyboard: [[{ text: "Открыть Мой план", url: "https://example.test/me/plan" }]],
  });
  const connection = await db.telegramConnection.findUniqueOrThrow({
    where: { userId_environment: { userId, environment: "DEV" } },
  });
  assert.ok(connection.welcomeSentAt);
});

test("first link: non-allowlisted user gets the short welcome without the forwarding paragraph", async () => {
  const userId = await makeUser("short");
  const chatId = String(chatSeq++);
  const token = await linkToken(userId);
  const { sent, channel } = makeChannel();
  await (await service(["someone-else"], channel)).handleUpdate(command(chatId, `/start link_${token}`));

  assert.equal(sent.length, 1);
  assert.match(sent[0]!.text, /Буду присылать напоминания/);
  assert.doesNotMatch(sent[0]!.text, /перешлите|Попробуйте прямо сейчас|Помогаю семье/i);
  assert.ok(sent[0]!.replyMarkup);
});

test("repeated /start after the welcome gives only the short 'on the line' reply", async () => {
  const { chatId, connection } = await makeLinkedUser("repeat");
  const { sent, channel } = makeChannel();
  const svc = await service([], channel);
  await svc.handleUpdate(command(chatId, "/start", 1));
  assert.match(sent[0]!.text, /Помогаю|Буду присылать/);
  const stamp = await welcomeSentAt(connection.id);
  assert.ok(stamp);

  await svc.handleUpdate(command(chatId, "/start", 2));
  assert.equal(sent.length, 2);
  assert.equal(sent[1]!.text, "Я на связи 👋");
  assert.ok(sent[1]!.replyMarkup);
  assert.equal((await welcomeSentAt(connection.id))?.getTime(), stamp.getTime());
});

test("/start for an existing connection (welcomeSentAt NULL) sends the welcome once", async () => {
  const { userId, chatId } = await makeLinkedUser("existing");
  const { sent, channel } = makeChannel();
  await (await service([userId], channel)).handleUpdate(command(chatId, "/start"));
  assert.match(sent[0]!.text, /Помогаю семье/);
});

test("/help always shows the welcome and does not touch welcomeSentAt", async () => {
  const stamp = new Date("2026-10-01T10:00:00Z");
  const { userId, chatId, connection } = await makeLinkedUser("help", stamp);
  const { sent, channel } = makeChannel();
  const svc = await service([userId], channel);
  await svc.handleUpdate(command(chatId, "/help", 1));
  await svc.handleUpdate(command(chatId, "/help@welcome_test_bot", 2));
  assert.equal(sent.length, 2);
  assert.ok(sent.every((m) => /Помогаю семье/.test(m.text)));
  assert.equal((await welcomeSentAt(connection.id))?.getTime(), stamp.getTime());
});

test("/start and /help from an unlinked chat keep the connect instruction", async () => {
  const { sent, channel } = makeChannel();
  const svc = await service([], channel);
  const chatId = String(chatSeq++);
  await svc.handleUpdate(command(chatId, "/start", 1));
  await svc.handleUpdate(command(chatId, "/help", 2));
  assert.equal(sent.length, 2);
  assert.ok(sent.every((m) => /Откройте ссылку из mamaGo/.test(m.text)));
});

test("race: parallel /start deliveries send exactly one welcome", async () => {
  const { userId, chatId, connection } = await makeLinkedUser("race");
  const { sent, channel } = makeChannel();
  const svc = await service([userId], channel);
  await Promise.all(
    Array.from({ length: 6 }, (_, i) => svc.handleUpdate(command(chatId, "/start", 100 + i))),
  );
  const welcomes = sent.filter((m) => /Помогаю семье/.test(m.text));
  assert.equal(welcomes.length, 1);
  assert.equal(sent.length - welcomes.length, 5);
  assert.ok(await welcomeSentAt(connection.id));
});

test("race: two link tokens for one user at once still send one welcome", async () => {
  const userId = await makeUser("linkrace");
  const chatId = String(chatSeq++);
  const [t1, t2] = [await linkToken(userId), await linkToken(userId)];
  const { sent, channel } = makeChannel();
  const svc = await service([userId], channel);
  await Promise.all([
    svc.handleUpdate(command(chatId, `/start link_${t1}`, 1)),
    svc.handleUpdate(command(chatId, `/start link_${t2}`, 2)),
  ]);
  assert.equal(sent.filter((m) => /Помогаю семье/.test(m.text)).length, 1);
});

test("re-link after the welcome gets only the short confirmation", async () => {
  const { userId, chatId } = await makeLinkedUser("relink", new Date("2026-10-01T10:00:00Z"));
  const token = await linkToken(userId);
  const { sent, channel } = makeChannel();
  await (await service([userId], channel)).handleUpdate(command(chatId, `/start link_${token}`));
  assert.equal(sent.length, 1);
  assert.equal(sent[0]!.text, "✅ Telegram подключён к mamaGo.");
});

test("a failed welcome send gives the claim back so the next /start retries", async () => {
  const { userId, chatId, connection } = await makeLinkedUser("retry");
  const { sent, channel } = makeChannel({ failFirst: true });
  const svc = await service([userId], channel);
  await svc.handleUpdate(command(chatId, "/start", 1));
  assert.equal(sent.length, 0);
  assert.equal(await welcomeSentAt(connection.id), null);
  await svc.handleUpdate(command(chatId, "/start", 2));
  assert.match(sent[0]!.text, /Помогаю семье/);
});

test("the welcome flow logs no message text or chat id", async () => {
  const { userId, chatId } = await makeLinkedUser("logs");
  const lines: string[] = [];
  const originals = { log: console.log, error: console.error, warn: console.warn };
  console.log = console.error = console.warn = (...args: unknown[]) => {
    lines.push(args.map(String).join(" "));
  };
  try {
    const { channel } = makeChannel({ failFirst: true });
    const svc = await service([userId], channel);
    await svc.handleUpdate(command(chatId, "/start", 1));
    await svc.handleUpdate(command(chatId, "/help", 2));
  } finally {
    Object.assign(console, originals);
  }
  const joined = lines.join("\n");
  assert.ok(!joined.includes(chatId), "chat id must not be logged");
  assert.ok(!/Помогаю семье|Буду присылать/.test(joined), "welcome text must not be logged");
});
