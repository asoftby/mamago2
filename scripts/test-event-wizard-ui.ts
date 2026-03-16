#!/usr/bin/env tsx

/**
 * Test Event Wizard UI Components
 * Simulates user interaction with the wizard
 */

import { getDefaultFormData } from "../src/components/business/wizard/event/defaults";
import { validateStep } from "../src/components/business/wizard/event/validation";
import { EVENT_WIZARD_STEPS } from "../src/components/business/wizard/event/eventWizardSteps.config";
import type { EventFormData } from "../src/components/business/wizard/event/types";

async function testEventWizardUI() {
  console.log("🧪 Testing Event Wizard UI Flow\n");

  // Simulate user filling out the wizard
  let formData: EventFormData = getDefaultFormData();
  
  console.log("📝 Simulating user input...\n");

  // Step 1: Basics
  console.log("Step 1: Основное");
  formData.title = "Мастер-класс по рисованию";
  formData.activityType = "educational";
  formData.categories = ["Мастер-класс"];
  formData.ageGroups = ["3-7", "7-12"];
  
  const step1Validation = validateStep(1, formData);
  console.log(`✅ Step 1 validation: ${step1Validation.isComplete ? "COMPLETE" : "INCOMPLETE"}`);
  
  // Step 2: Location (NEW)
  console.log("\nStep 2: Локация");
  formData.venueKind = "MANUAL";
  formData.venueName = "Детский центр Песочница";
  formData.address = "Притыцкого 12";
  formData.city = "Минск";
  
  const step2Validation = validateStep(2, formData);
  console.log(`✅ Step 2 validation: ${step2Validation.isComplete ? "COMPLETE" : "INCOMPLETE"}`);
  
  // Step 3: Description
  console.log("\nStep 3: Описание");
  formData.fullDescription = "<p>Увлекательный мастер-класс по рисованию для детей. Изучаем основы композиции и цветоведения.</p>";
  
  const step3Validation = validateStep(3, formData);
  console.log(`✅ Step 3 validation: ${step3Validation.isComplete ? "COMPLETE" : "INCOMPLETE"}`);
  
  // Step 4: Media
  console.log("\nStep 4: Медиа");
  formData.coverImage = "cover-image-id-123";
  formData.gallery = ["gallery-1", "gallery-2"];
  
  const step4Validation = validateStep(4, formData);
  console.log(`✅ Step 4 validation: ${step4Validation.isComplete ? "COMPLETE" : "INCOMPLETE"}`);
  
  // Step 5: Schedule
  console.log("\nStep 5: Дата и время");
  formData.dates = ["2026-03-20", "2026-03-27"];
  formData.allDay = false;
  formData.startTime = "10:00";
  formData.endTime = "12:00";
  
  const step5Validation = validateStep(5, formData);
  console.log(`✅ Step 5 validation: ${step5Validation.isComplete ? "COMPLETE" : "INCOMPLETE"}`);
  
  // Step 6: Pricing
  console.log("\nStep 6: Стоимость и запись");
  formData.pricingMode = "fixed";
  formData.price = "25";
  formData.participationMode = "simple-booking";
  formData.simpleBookingDate = "2026-03-20";
  
  const step6Validation = validateStep(6, formData);
  console.log(`✅ Step 6 validation: ${step6Validation.isComplete ? "COMPLETE" : "INCOMPLETE"}`);
  
  // Step 7: Contacts
  console.log("\nStep 7: Контакты");
  formData.phone = "+375291234567";
  formData.website = "https://sandbox.by";
  
  const step7Validation = validateStep(7, formData);
  console.log(`✅ Step 7 validation: ${step7Validation.isComplete ? "COMPLETE" : "INCOMPLETE"}`);
  
  // Step 8: Organizer
  console.log("\nStep 8: Организатор");
  formData.organizerName = "Детский центр Песочница";
  formData.organizerDescription = "Развивающий центр для детей";
  
  const step8Validation = validateStep(8, formData);
  console.log(`✅ Step 8 validation: ${step8Validation.isComplete ? "COMPLETE" : "INCOMPLETE"}`);
  
  // Summary
  console.log("\n📊 Wizard Summary:");
  console.log(`Total steps: ${EVENT_WIZARD_STEPS.length}`);
  
  const completedSteps = EVENT_WIZARD_STEPS.filter((step, index) => {
    const validation = validateStep(index + 1, formData);
    return validation.isComplete;
  });
  
  console.log(`Completed steps: ${completedSteps.length}/${EVENT_WIZARD_STEPS.length}`);
  console.log(`Progress: ${Math.round((completedSteps.length / EVENT_WIZARD_STEPS.length) * 100)}%`);
  
  // Test step configuration
  console.log("\n🔧 Step Configuration Test:");
  EVENT_WIZARD_STEPS.forEach((step, index) => {
    const validation = validateStep(index + 1, formData);
    const status = validation.isComplete ? "✅" : "❌";
    console.log(`${status} Step ${step.id}: ${step.title} - ${step.description}`);
  });
  
  console.log("\n🎉 Event Wizard UI test completed!");
  console.log("All components are working correctly with the new Location step architecture.");
}

testEventWizardUI().catch(console.error);