import assert from "node:assert/strict";
import {
  fetchNotificationsPageApi,
  postMarkNotificationsOpenApi,
} from "./notification-actions";

const originalFetch = globalThis.fetch;
const requestedUrls: string[] = [];

globalThis.fetch = (async (input: string | URL | Request) => {
  requestedUrls.push(typeof input === "string" ? input : input.toString());
  return new Response(
    JSON.stringify({
      notifications: [],
      hasMore: false,
      showTelegramPrompt: false,
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    },
  );
}) as typeof fetch;

try {
  await fetchNotificationsPageApi(0, 7, "user", "unread");
  const userFeedUrl = new URL(requestedUrls.at(-1)!, "https://mamago.by");
  assert.equal(userFeedUrl.pathname, "/api/notifications");
  assert.equal(
    userFeedUrl.searchParams.has("stream"),
    false,
    "User/admin header feed must stay unified so it matches the unified unread badge",
  );
  assert.equal(userFeedUrl.searchParams.get("tab"), "unread");

  await fetchNotificationsPageApi(0, 7, "business", "unread");
  const businessFeedUrl = new URL(requestedUrls.at(-1)!, "https://mamago.by");
  assert.equal(businessFeedUrl.searchParams.get("stream"), "business");

  await postMarkNotificationsOpenApi("user");
  const userOpenUrl = new URL(requestedUrls.at(-1)!, "https://mamago.by");
  assert.equal(
    userOpenUrl.searchParams.has("stream"),
    false,
    "Opening the unified user/admin feed must mark the same accessible audiences as opened",
  );

  await postMarkNotificationsOpenApi("business");
  const businessOpenUrl = new URL(requestedUrls.at(-1)!, "https://mamago.by");
  assert.equal(businessOpenUrl.searchParams.get("stream"), "business");

  console.log("notification unified-feed client contract: OK");
} finally {
  globalThis.fetch = originalFetch;
}
