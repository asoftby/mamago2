import { prisma } from "../src/lib/prisma";

async function checkMediaTitle() {
  console.log("Checking media assets with title...\n");

  const mediaWithTitle = await prisma.mediaAsset.findMany({
    where: {
      title: {
        not: null,
      },
    },
    select: {
      id: true,
      filename: true,
      title: true,
      alt: true,
      caption: true,
    },
    take: 10,
  });

  console.log(`Found ${mediaWithTitle.length} media assets with title:\n`);
  
  mediaWithTitle.forEach((media) => {
    console.log(`ID: ${media.id}`);
    console.log(`Filename: ${media.filename}`);
    console.log(`Title: ${media.title}`);
    console.log(`Alt: ${media.alt}`);
    console.log(`Caption: ${media.caption}`);
    console.log("---");
  });

  // Check total count
  const total = await prisma.mediaAsset.count();
  const withTitle = await prisma.mediaAsset.count({
    where: { title: { not: null } },
  });

  console.log(`\nTotal media assets: ${total}`);
  console.log(`With title: ${withTitle}`);
  console.log(`Without title: ${total - withTitle}`);
}

checkMediaTitle()
  .then(() => {
    console.log("\nDone!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Error:", error);
    process.exit(1);
  });
