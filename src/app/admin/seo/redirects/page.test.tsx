import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { RedirectCenterClient } from "@/components/admin/seo/RedirectCenterClient";

const html = renderToStaticMarkup(
  <RedirectCenterClient
    automatic={[
      {
        id: "/legacy-proof",
        fromUrl: "/legacy-proof",
        toUrl: "/minsk/blog/proof",
        ruleType: "legacy_migration",
        source: "wp-redirect-map.json",
        enabled: true,
        status: "active",
        lastCheckedAt: null,
        disposition: "EXACT_REDIRECT",
        resolvedTable: "Article",
      },
    ]}
    automaticPagination={{
      page: 1,
      total: 1,
      totalPages: 1,
      start: 1,
      end: 1,
    }}
    manual={[]}
    summary={{
      systemTotal: 893,
      manualCount: 0,
      counts: {
        EXACT_REDIRECT: 12,
        VALID_HUB_REMAP: 21,
        P1_START_OR_CONTAINS: 24,
        INVALID_TARGET: 836,
        COLLISION: 0,
        CHAIN: 0,
        LOOP: 0,
      },
    }}
    currentSearch=""
    currentFilter="ALL"
    currentParams={{}}
  />,
);

assert.match(html, /System \/ Migration/);
assert.match(html, />893</);
assert.match(html, /legacy-proof/);
assert.match(html, /Системный · Только чтение/);
assert.doesNotMatch(html, /Сохранить в список/);

console.log("redirect admin page server-render contract: PASS");
