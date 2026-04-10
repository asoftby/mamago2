import { getAdminMediaList } from "../../src/server/services/media/media-query.service";

async function testMediaListAPI() {
  console.log("Testing getAdminMediaList API...\n");

  const result = await getAdminMediaList({}, { page: 1, limit: 50 });

  console.log(`Total items: ${result.items.length}\n`);

  result.items.forEach((media) => {
    console.log(`ID: ${media.id}`);
    console.log(`Filename: ${media.filename}`);
    console.log(`Title: ${media.title || "(no title)"}`);
    console.log(`Alt: ${media.alt || "(no alt)"}`);
    console.log(`Has title field: ${"title" in media}`);
    console.log("---");
  });

  // Check if the media with title is in the list
  const mediaWithTitle = result.items.find((m) => m.title);
  if (mediaWithTitle) {
    console.log("\n✓ Found media with title:");
    console.log(JSON.stringify(mediaWithTitle, null, 2));
  } else {
    console.log("\n✗ No media with title found in the list");
  }
}

testMediaListAPI()
  .then(() => {
    console.log("\nDone!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Error:", error);
    process.exit(1);
  });
