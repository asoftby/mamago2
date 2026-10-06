/**
 * Routing + legacy regression for TelegramWebhookService against a scratch
 * Postgres (DATABASE_URL, all migrations applied). Needs the react-server
 * condition because the service imports `server-only`:
 *   NODE_OPTIONS=--conditions=react-server tsx <this file>
 * Telegram credentials below are fake test values; nothing leaves the process.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test, { after } from "node:test";
import { PrismaClient } from "@prisma/client";

process.env.TELEGRAM_BOT_TOKEN_DEV = "test-token-not-real";
process.env.TELEGRAM_BOT_USERNAME_DEV = "@pr2_routing_test_bot";
delete process.env.APP_ENV;

const db = new PrismaClient();
const runId = randomUUID().slice(0, 8);
const userIds: string[] = [];

type ChannelCall = { method: string; input: Record<string, unknown> };

function makeChannel() {
  const calls: ChannelCall[] = [];
  return {
    calls,
    channel: {
      async sendMessage(input: Record<string, unknown>) {
        calls.push({ method: "sendMessage", input });
        return { message_id: 1 };
      },
      async editMessageText(input: Record<string, unknown>) {
        calls.push({ method: "editMessageText", input });
      },
      async answerCallbackQuery(input: Record<string, unknown>) {
        calls.push({ method: "answerCallbackQuery", input });
      },
    },
  };
}

async function load() {
  const { TelegramWebhookService } = await import("../TelegramWebhookService");
  return TelegramWebhookService;
}

type Spy = {
  allowlist: string[];
  connection: { userId: string } | null;
  counters: { find: number; touch: number; receive: number; callback: number; ack: number };
  received: Array<{ userId: string; environment: string }>;
  deps: import("./captureWiring").CaptureRoutingDeps;
};

function makeSpy(allowlist: string[], connection: { userId: string } | null): Spy {
  const counters = { find: 0, touch: 0, receive: 0, callback: 0, ack: 0 };
  const received: Spy["received"] = [];
  const deps: Spy["deps"] = {
    getAllowlist: () => new Set(allowlist),
    findActiveConnection: async () => {
      counters.find += 1;
      return connection;
    },
    touchConnection: async () => {
      counters.touch += 1;
    },
    getEnvironment: () => "DEV",
    receive: async (owner, environment) => {
      counters.receive += 1;
      received.push({ userId: owner.userId, environment });
      return { outcome: { status: "duplicate" }, afterResponse: async () => undefined };
    },
    handleCallback: async () => {
      counters.callback += 1;
    },
    acknowledgeCallback: async () => {
      counters.ack += 1;
    },
  };
  return { allowlist, connection, counters, received, deps };
}

function textUpdate(extra: Record<string, unknown> = {}, chat: Record<string, unknown> = { id: 777, type: "private" }) {
  return {
    update_id: 9001,
    message: {
      message_id: 5,
      date: 1_790_000_000,
      chat,
      from: { id: 777, is_bot: false, first_name: "Test" },
      text: "Экскурсия 9 октября",
      ...extra,
    },
  };
}

after(async () => {
  await db.telegramConnection.deleteMany({ where: { userId: { in: userIds } } });
  await db.telegramLinkToken.deleteMany({ where: { userId: { in: userIds } } });
  await db.user.deleteMany({ where: { id: { in: userIds } } });
  await db.$disconnect();
});

test("empty allowlist: capture is off, nothing touches capture deps or the channel", async () => {
  const Service = await load();
  const { channel, calls } = makeChannel();
  const spy = makeSpy([], { userId: "u1" });
  const result = await new Service(channel as never, spy.deps).handleUpdate(textUpdate() as never);
  assert.deepEqual(result, {});
  assert.deepEqual(spy.counters, { find: 0, touch: 0, receive: 0, callback: 0, ack: 0 });
  assert.deepEqual(calls, []);
});

test("gate closed: user not on the allowlist or no active connection falls through to legacy silence", async () => {
  const Service = await load();
  const notListed = makeSpy(["other"], { userId: "u1" });
  const a = makeChannel();
  assert.deepEqual(await new Service(a.channel as never, notListed.deps).handleUpdate(textUpdate() as never), {});
  assert.equal(notListed.counters.receive, 0);
  assert.deepEqual(a.calls, []);

  const unlinked = makeSpy(["u1"], null);
  const b = makeChannel();
  assert.deepEqual(await new Service(b.channel as never, unlinked.deps).handleUpdate(textUpdate() as never), {});
  assert.equal(unlinked.counters.receive, 0);
  assert.deepEqual(b.calls, []);
});

test("gate open: capture goes to intake with the plan owner and passes afterResponse through", async () => {
  const Service = await load();
  const { channel, calls } = makeChannel();
  const spy = makeSpy(["u1"], { userId: "u1" });
  const result = await new Service(channel as never, spy.deps).handleUpdate(textUpdate() as never);
  assert.equal(typeof result.afterResponse, "function");
  assert.deepEqual(spy.received, [{ userId: "u1", environment: "DEV" }]);
  assert.equal(spy.counters.touch, 1);
  assert.deepEqual(calls, []);
});

test("non-private chats and commands never reach intake", async () => {
  const Service = await load();
  const spy = makeSpy(["u1"], { userId: "u1" });
  const svc = new Service(makeChannel().channel as never, spy.deps);
  await svc.handleUpdate(textUpdate({}, { id: -5, type: "supergroup" }) as never);
  await svc.handleUpdate(textUpdate({ text: "/help", entities: [{ type: "bot_command", offset: 0 }] }) as never);
  assert.equal(spy.counters.receive, 0);
});

test("legacy /start without payload still greets, even with capture enabled", async () => {
  const Service = await load();
  const { channel, calls } = makeChannel();
  const spy = makeSpy(["u1"], { userId: "u1" });
  await new Service(channel as never, spy.deps).handleUpdate(
    textUpdate({ text: "/start", entities: [{ type: "bot_command", offset: 0 }] }) as never,
  );
  assert.equal(spy.counters.receive, 0);
  assert.equal(calls.length, 1);
  assert.equal(calls[0]!.method, "sendMessage");
  assert.match(String(calls[0]!.input.text), /Откройте ссылку из mamaGo/);
});

test("legacy /start link_<token> still links Telegram to the account", async () => {
  const Service = await load();
  const userId = `routing-${runId}-link`;
  await db.user.create({ data: { id: userId, email: `${userId}@example.test` } });
  userIds.push(userId);
  const token = `tok-${runId}`;
  await db.telegramLinkToken.create({
    data: { token, userId, environment: "DEV", expiresAt: new Date(Date.now() + 600_000) },
  });

  const chatId = 880_000_000 + Math.floor(Math.random() * 1_000_000);
  const { channel, calls } = makeChannel();
  const spy = makeSpy([userId], null);
  await new Service(channel as never, spy.deps).handleUpdate({
    update_id: 9002,
    message: {
      message_id: 6,
      date: 1_790_000_000,
      chat: { id: chatId, type: "private" },
      from: { id: chatId, is_bot: false, first_name: "Anna" },
      text: `/start link_${token}`,
      entities: [{ type: "bot_command", offset: 0 }],
    },
  } as never);

  assert.equal(spy.counters.receive, 0);
  const connection = await db.telegramConnection.findUniqueOrThrow({
    where: { userId_environment: { userId, environment: "DEV" } },
  });
  assert.equal(connection.telegramChatId, String(chatId));
  assert.equal(connection.isActive, true);
  assert.ok(calls.some((call) => call.method === "sendMessage" && String(call.input.text).includes("подключён")));
});

test("legacy callbacks: unknown and application:* buttons keep their old answers", async () => {
  const Service = await load();
  const { channel, calls } = makeChannel();
  const spy = makeSpy(["u1"], { userId: "u1" });
  const svc = new Service(channel as never, spy.deps);

  await svc.handleUpdate({
    update_id: 9003,
    callback_query: { id: "cb-unknown", data: "something:else", from: { id: 1 }, message: { message_id: 1, chat: { id: 1 } } },
  } as never);
  assert.equal(calls[0]!.method, "answerCallbackQuery");
  assert.equal(calls[0]!.input.text, "Действие не поддерживается");

  await svc.handleUpdate({
    update_id: 9004,
    callback_query: {
      id: "cb-app",
      data: "application:abc:confirm",
      from: { id: 1 },
      message: { message_id: 1, chat: { id: 123456 } },
    },
  } as never);
  assert.equal(calls[1]!.method, "answerCallbackQuery");
  assert.equal(calls[1]!.input.text, "Telegram не связан с аккаунтом mamaGo для этой среды");
  assert.equal(spy.counters.ack, 0);
});

test("inb: and req: callbacks route through capture handlers when the gate is open", async () => {
  const Service = await load();
  const { channel, calls } = makeChannel();
  const spy = makeSpy(["u1"], { userId: "u1" });
  const svc = new Service(channel as never, spy.deps);
  for (const [id, data] of [
    ["cb1", "inb:add:cmabc"],
    ["cb2", "inb:child:cmabc:cmchild"],
    ["cb3", "req:done:cmreq"],
  ] as const) {
    await svc.handleUpdate({
      update_id: 9100,
      callback_query: { id, data, from: { id: 1 }, message: { message_id: 1, chat: { id: 1 } } },
    } as never);
  }
  assert.equal(spy.counters.callback, 3);
  assert.equal(spy.counters.ack, 0);
  assert.equal(spy.counters.touch, 3);
  assert.deepEqual(calls, []);
});
