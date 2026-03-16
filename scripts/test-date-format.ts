#!/usr/bin/env tsx

/**
 * Test date formatting for Russian locale
 */

function testDateFormatting() {
  console.log("📅 Testing Russian Date Formatting");
  
  const testDates = [
    "2026-03-16", // Sunday, 16 March
    "2026-03-17", // Monday, 17 March  
    "2026-01-01", // New Year
    "2026-12-31", // New Year's Eve
  ];
  
  // Russian months in genitive case (used with day numbers)
  const monthsGenitive = [
    "января", "февраля", "марта", "апреля", "мая", "июня",
    "июля", "августа", "сентября", "октября", "ноября", "декабря"
  ];
  
  testDates.forEach(dateStr => {
    const date = new Date(dateStr);
    const weekday = date.toLocaleDateString("ru-RU", { weekday: "long" });
    const day = date.getDate();
    const month = monthsGenitive[date.getMonth()];
    
    // Capitalize first letter of weekday
    const capitalizedWeekday = weekday.charAt(0).toUpperCase() + weekday.slice(1);
    const formattedDate = `${capitalizedWeekday}, ${day} ${month}`;
    
    console.log(`${dateStr} → "${formattedDate}"`);
  });
  
  console.log("\n✅ Date formatting test completed");
}

testDateFormatting();