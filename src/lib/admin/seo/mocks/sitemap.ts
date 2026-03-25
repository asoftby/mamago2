import type {
  RobotsIndexationSettings,
  SitemapSectionStatus,
  SitemapStatusSnapshot,
} from "../domain/types";

export const MOCK_SITEMAP_STATUS: SitemapStatusSnapshot = {
  sitemapUrl: "https://mamago.example/sitemap.xml",
  lastGeneratedAt: "2025-03-22T04:15:00.000Z",
  indexedPagesCount: 18420,
  includedSectionsSummary: [
    "SEO pages",
    "Articles",
    "Events",
    "Places",
    "Routes",
  ],
  regenerationStatus: "idle",
};

export const MOCK_SITEMAP_SECTIONS: SitemapSectionStatus[] = [
  {
    id: "sec-seo-pages",
    section: "SEO pages",
    includedInSitemap: true,
    pagesCount: 320,
    lastUpdatedAt: "2025-03-22T04:14:12.000Z",
  },
  {
    id: "sec-articles",
    section: "Articles",
    includedInSitemap: true,
    pagesCount: 640,
    lastUpdatedAt: "2025-03-21T18:02:00.000Z",
  },
  {
    id: "sec-events",
    section: "Events",
    includedInSitemap: true,
    pagesCount: 12400,
    lastUpdatedAt: "2025-03-22T04:14:55.000Z",
  },
  {
    id: "sec-places",
    section: "Places",
    includedInSitemap: true,
    pagesCount: 4100,
    lastUpdatedAt: "2025-03-22T03:58:00.000Z",
  },
  {
    id: "sec-routes",
    section: "Routes",
    includedInSitemap: true,
    pagesCount: 960,
    lastUpdatedAt: "2025-03-20T12:00:00.000Z",
  },
];

export const MOCK_ROBOTS_SETTINGS: RobotsIndexationSettings = {
  allowIndexing: true,
  noindexEnvironments: ["preview", "staging"],
  robotsStatus: "ok",
  futureControlsNote:
    "Планируется: правила для отдельных ботов, лимиты краулинга по секциям, отдельный sitemap index.",
};
