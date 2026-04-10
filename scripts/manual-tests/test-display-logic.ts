import { resolveDisplayFilename } from "../../src/lib/media/resolveDisplayFilename";

// Test data from database
const media = {
  id: "cmmoqhk59000pwsr7wa105rz7",
  filename: "1773083559183-h4v2u5ryyn9.blob",
  extension: "webp",
  mimeType: "image/webp",
  title: "Фото места Пуговка — Минск",
  alt: "Фотография места Пуговка, Минск, Восточная 137, Минск",
};

const displayFilename = resolveDisplayFilename({
  filename: media.filename,
  extension: media.extension,
  mimeType: media.mimeType,
});

const hasTitle = !!media.title;
const displayTitle = media.title || displayFilename;

console.log("Media ID:", media.id);
console.log("Filename:", media.filename);
console.log("Title:", media.title);
console.log("Display Filename:", displayFilename);
console.log("Has Title:", hasTitle);
console.log("Display Title:", displayTitle);
console.log("\nExpected behavior:");
console.log("- Should show:", displayTitle);
console.log("- Should show filename below:", hasTitle ? displayFilename : "no");
