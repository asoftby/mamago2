/**
 * Test script for AI Category Detection
 * 
 * Usage:
 *   pnpm tsx scripts/test-ai-category-detection.ts
 */

import { detectEventCategory } from "../src/lib/ai/detectEventCategory";

const testCases = [
  {
    name: "Концерт рок-группы",
    input: {
      title: "Концерт группы Би-2",
      description: "Легендарная рок-группа выступит с новой программой",
      venueName: "Минск-Арена",
      categoryCandidates: ["музыка", "концерт"],
    },
  },
  {
    name: "Мастер-класс для детей",
    input: {
      title: "Мастер-класс по рисованию для детей",
      description: "Научим детей рисовать акварелью",
      ageText: "5-10 лет",
      categoryCandidates: ["творчество", "дети"],
    },
  },
  {
    name: "Выставка в музее",
    input: {
      title: "Выставка современного искусства",
      description: "Представлены работы современных белорусских художников",
      venueName: "Национальный художественный музей",
    },
  },
  {
    name: "Детский спектакль",
    input: {
      title: "Красная Шапочка",
      description: "Детский спектакль по мотивам сказки",
      venueName: "Театр юного зрителя",
      ageText: "3-8 лет",
      categoryCandidates: ["театр", "дети", "сказка"],
    },
  },
  {
    name: "Спортивное мероприятие",
    input: {
      title: "Забег на 5 км",
      description: "Благотворительный забег в парке Горького",
      addressText: "Парк Горького, Минск",
      categoryCandidates: ["спорт", "бег"],
    },
  },
];

async function runTests() {
  console.log("🧪 Testing AI Category Detection\n");
  console.log("=" .repeat(80));

  for (const testCase of testCases) {
    console.log(`\n📝 Test: ${testCase.name}`);
    console.log("-".repeat(80));
    console.log("Input:");
    console.log(`  Title: ${testCase.input.title}`);
    if (testCase.input.description) {
      console.log(`  Description: ${testCase.input.description.slice(0, 60)}...`);
    }
    if (testCase.input.venueName) {
      console.log(`  Venue: ${testCase.input.venueName}`);
    }
    if (testCase.input.ageText) {
      console.log(`  Age: ${testCase.input.ageText}`);
    }
    if (testCase.input.categoryCandidates) {
      console.log(`  Tags: ${testCase.input.categoryCandidates.join(", ")}`);
    }

    try {
      const result = await detectEventCategory(testCase.input);

      if (result) {
        console.log("\n✅ Result:");
        console.log(`  Category: ${result.categoryPath}`);
        console.log(`  Slug: ${result.categorySlug}`);
        console.log(`  Confidence: ${(result.confidence * 100).toFixed(1)}%`);
        console.log(`  Reason: ${result.reason}`);
        console.log(`  Root ID: ${result.rootCategoryId}`);
        if (result.subcategoryId) {
          console.log(`  Subcategory ID: ${result.subcategoryId}`);
        }
      } else {
        console.log("\n❌ No category detected (confidence too low or error)");
      }
    } catch (error) {
      console.log("\n❌ Error:");
      console.error(error);
    }
  }

  console.log("\n" + "=".repeat(80));
  console.log("✅ Tests completed\n");
}

runTests()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
