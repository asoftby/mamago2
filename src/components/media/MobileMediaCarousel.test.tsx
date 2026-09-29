import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { MobileMediaCarousel } from "./MobileMediaCarousel";
import type { MediaGalleryItem } from "@/lib/media/galleryTypes";

const source = readFileSync(new URL("./MobileMediaCarousel.tsx", import.meta.url), "utf8");
assert.ok(source.includes("data-mobile-media-carousel"));
assert.ok(source.includes("snap-x") && source.includes("snap-mandatory"));
assert.ok(source.includes("w-full shrink-0 snap-start"));
assert.ok(source.includes("overflow-x-auto"));
assert.ok(!source.includes("touch-action:pan-y"));
assert.equal(renderToStaticMarkup(<MobileMediaCarousel items={[]} />), "");

const items: MediaGalleryItem[] = [
  { type: "image", id: "cover", src: "/cover.jpg", alt: "Cover" },
  { type: "image", id: "second", src: "/second.jpg", alt: "Second" },
];
const html = renderToStaticMarkup(<MobileMediaCarousel items={items} />);
assert.ok(html.includes('aria-label="Открыть фото 1 из 2"'));
assert.ok(html.includes('aria-label="Открыть фото 2 из 2"'));
assert.ok(html.includes("1 / 2"));
