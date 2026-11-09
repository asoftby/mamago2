import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { CollectionEventMediaGallery } from "./CollectionEventMediaGallery";

test("empty gallery preserves the calendar placeholder without navigation", () => {
  const html = renderToStaticMarkup(<CollectionEventMediaGallery items={[]} title="Событие" />);
  assert.match(html, /Галерея: Событие/);
  assert.doesNotMatch(html, /Следующее медиа/);
});

test("multiple media show dots and previous/next controls", () => {
  const html = renderToStaticMarkup(<CollectionEventMediaGallery title="Событие" items={[
    { type: "image", id: "first", src: "/one.jpg", alt: "Первое фото" },
    { type: "youtube", id: "video", url: "https://youtu.be/abcdef123", embedId: "abcdef123", posterSrc: null, title: "Видео" },
  ]} />);
  assert.match(html, /Следующее медиа/);
  assert.match(html, /Предыдущее медиа/);
  assert.match(html, /Слайд 1 из 2/);
  assert.match(html, /Слайд 2 из 2/);
  assert.match(html, /Открыть Видео/);
});
