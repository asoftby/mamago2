import assert from "node:assert/strict";
import {
  attachAssetToPlaceWizard,
  loadPlaceMediaLibraryPage,
  removeWizardTempMedia,
  reorderWizardTempGallery,
} from "./placeWizardMediaAdapter";

async function main() {
  const calls: Array<{ url: string; method: string; body?: Record<string, unknown> }> = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    const body = typeof init?.body === "string" ? JSON.parse(init.body) : undefined;
    calls.push({ url, method: init?.method ?? "GET", body });
    if (url.startsWith("/api/business/media-picker?")) {
      return Response.json({
        items: [{ id: "asset-1", publicUrl: "/image.webp", alt: null, title: "Test" }],
        nextCursor: "next", hasMore: true,
      });
    }
    if (url === "/api/business/temp-media" && init?.method === "POST") {
      return Response.json({ media: { id: "temp-1", url: "/image.webp" } });
    }
    if (url.includes("/images/reorder") || url.endsWith("/reorder") || init?.method === "DELETE") {
      return Response.json({ success: true });
    }
    throw new Error("Unexpected mocked request " + url);
  };

  try {
    const page = await loadPlaceMediaLibraryPage({ cursor: "cursor-1", limit: 24 });
    assert.deepEqual(page.items.map((i) => i.id), ["asset-1"]);
    assert.equal(page.hasMore, true);
    assert.equal(page.nextCursor, "next");
    assert.match(calls[0].url, /cursor=cursor-1/);
    assert.match(calls[0].url, /limit=24/);

    const linked = await attachAssetToPlaceWizard("asset-1", "session-1", "PLACE_GALLERY", 3);
    assert.deepEqual(linked, { id: "temp-1", url: "/image.webp" });
    const attachCall = calls.find((call) => call.method === "POST" && call.url === "/api/business/temp-media");
    assert.ok(attachCall);
    assert.deepEqual(attachCall.body, {
      wizardSessionId: "session-1",
      kind: "PLACE_GALLERY",
      mediaAssetId: "asset-1",
      sortOrder: 3,
    }, "the client must never send an arbitrary public URL when attaching media");

    await reorderWizardTempGallery("session-1", [{ id: "temp-1", sortOrder: 0 }]);
    assert.deepEqual(calls.find((call) => call.url.endsWith("/reorder"))?.body, {
      wizardSessionId: "session-1",
      updates: [{ id: "temp-1", sortOrder: 0 }],
    });
    await removeWizardTempMedia("temp-1");
    assert.equal(calls.at(-1)?.method, "DELETE");

    await assert.rejects(
      attachAssetToPlaceWizard("asset-1", "", "PLACE_LOGO"),
      /Сессия создания места/,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
