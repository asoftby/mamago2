#!/usr/bin/env tsx

/**
 * Test Event Wizard Component Imports
 * Checks if all components can be imported without errors
 */

async function testImports() {
  console.log("🧪 Testing Event Wizard Component Imports\n");

  try {
    console.log("1. Testing EventWizard import...");
    const { EventWizard } = await import("../../src/components/business/wizard/event/EventWizard");
    console.log("✅ EventWizard imported successfully:", typeof EventWizard);

    console.log("\n2. Testing types import...");
    const types = await import("../../src/components/business/wizard/event/types");
    console.log("✅ Types imported successfully:", Object.keys(types).length, "symbols found");

    console.log("\n3. Testing defaults import...");
    const { getDefaultFormData } = await import("../../src/components/business/wizard/event/defaults");
    console.log("✅ Defaults imported successfully");

    console.log("\n4. Testing validation import...");
    const { validateStep } = await import("../../src/components/business/wizard/event/validation");
    console.log("✅ Validation imported successfully");

    console.log("\n5. Testing config import...");
    const { EVENT_WIZARD_STEPS } = await import("../../src/components/business/wizard/event/eventWizardSteps.config");
    console.log("✅ Config imported successfully");

    console.log("\n6. Testing Step2Location import...");
    const { Step2Location } = await import("../../src/components/business/wizard/event/steps/Step2Location");
    console.log("✅ Step2Location imported successfully:", typeof Step2Location);

    console.log("\n7. Testing mappers import...");
    const { buildEventPayload } = await import("../../src/components/business/wizard/event/mappers");
    console.log("✅ Mappers imported successfully:", typeof buildEventPayload);

    console.log("\n8. Testing default form data creation...");
    const defaultData = getDefaultFormData();
    console.log("✅ Default form data created:", {
      venueKind: defaultData.venueKind,
      title: defaultData.title,
      categoryId: defaultData.categoryId,
    });

    console.log("\n9. Testing step validation...");
    const validation = validateStep(1, defaultData);
    console.log("✅ Step validation works:", validation.isValid ? "VALID" : "INVALID");

    console.log("\n10. Testing config structure...");
    console.log("✅ Total steps:", EVENT_WIZARD_STEPS.length);
    console.log("✅ Step 2 title:", EVENT_WIZARD_STEPS[1]?.title);

    console.log("\n🎉 All imports successful!");
    console.log("Event Wizard components are ready to use.");

  } catch (error) {
    console.error("❌ Import error:", error);
    process.exit(1);
  }
}

testImports();